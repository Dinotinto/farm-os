import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-that-is-at-least-32-characters-long"; // gitleaks:allow (test fixture)

async function load() {
  vi.resetModules();
  return import("@/lib/session-token");
}

describe("signed session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("round-trips a payload of the right type", async () => {
    const { signToken, verifyToken } = await load();
    const token = signToken("user", { email: "a@example.com" }, 60);
    expect(verifyToken("user", token)).toMatchObject({ email: "a@example.com", typ: "user" });
  });

  it("rejects an edited payload", async () => {
    const { signToken, verifyToken } = await load();
    const token = signToken("user", { email: "worker@example.com" }, 60);
    const [, sig] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ email: "owner@example.com", typ: "user", exp: 9999999999 })).toString("base64url");
    expect(verifyToken("user", `${forgedBody}.${sig}`)).toBeNull();
  });

  it("rejects the old unsigned cookie format", async () => {
    const { verifyToken } = await load();
    const oldStyle = Buffer.from(JSON.stringify({ email: "owner@example.com", role: "owner" })).toString("base64");
    expect(verifyToken("user", oldStyle)).toBeNull();
    expect(verifyToken("admin", "farm-admin-ok")).toBeNull();
  });

  it("won't accept a user token as an admin token", async () => {
    const { signToken, verifyToken } = await load();
    expect(verifyToken("admin", signToken("user", {}, 60))).toBeNull();
  });

  it("expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { signToken, verifyToken } = await load();
    const token = signToken("admin", {}, 60);
    vi.setSystemTime(new Date("2026-01-01T00:00:59Z"));
    expect(verifyToken("admin", token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(verifyToken("admin", token)).toBeNull();
  });

  it("rejects tokens signed with a different secret", async () => {
    const { signToken } = await load();
    const token = signToken("user", { email: "a@example.com" }, 60);
    vi.stubEnv("SESSION_SECRET", "a-completely-different-secret-of-32-plus-chars");
    const { verifyToken } = await load();
    expect(verifyToken("user", token)).toBeNull();
  });

  it("refuses to run in production without a strong secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "too-short");
    const { signToken } = await load();
    expect(() => signToken("user", {}, 60)).toThrow(/SESSION_SECRET/);
  });
});
