import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { hashPassword, isPasswordHash, verifyPassword } from "@/lib/passwords";

describe("password hashing", () => {
  it("accepts the right password and rejects a wrong one", () => {
    const hash = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", hash)).toBe(true);
    expect(verifyPassword("correct horse batterY", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("never stores the password itself and salts every hash", () => {
    const a = hashPassword("same-password-123");
    const b = hashPassword("same-password-123");
    expect(a).not.toContain("same-password-123");
    expect(a).not.toBe(b);
    expect(isPasswordHash(a)).toBe(true);
  });

  it("rejects malformed or plain-text stored values", () => {
    expect(verifyPassword("anything", "anything")).toBe(false);
    expect(verifyPassword("x", "scrypt$abc$8$1$salt$hash")).toBe(false);
    expect(verifyPassword("x", "bcrypt$1$2$3$4$5")).toBe(false);
    expect(isPasswordHash("a plain password")).toBe(false);
  });

  it("matches hashes made by the user:hash script", () => {
    const run = spawnSync(process.execPath, ["scripts/farm-user.mjs"], { input: "script-made-password\n", encoding: "utf-8" });
    expect(run.status, run.stderr).toBe(0);
    const hash = run.stdout.trim();
    expect(verifyPassword("script-made-password", hash)).toBe(true);
    expect(verifyPassword("another-password", hash)).toBe(false);
  });

  it("user:add prints a ready FARM_USERS entry without the password", () => {
    const run = spawnSync(
      process.execPath,
      ["scripts/farm-user.mjs", "--email", "Owner@Example.com", "--name", "Test Owner", "--role", "owner"],
      { input: "a-long-test-password\n", encoding: "utf-8" }
    );
    expect(run.status, run.stderr).toBe(0);
    const entry = JSON.parse(run.stdout);
    expect(entry).toMatchObject({ email: "owner@example.com", displayName: "Test Owner", role: "owner" });
    expect(run.stdout).not.toContain("a-long-test-password");
    expect(verifyPassword("a-long-test-password", entry.passwordHash)).toBe(true);
  });

  it("refuses short passwords and unknown roles", () => {
    const short = spawnSync(process.execPath, ["scripts/farm-user.mjs"], { input: "short\n", encoding: "utf-8" });
    expect(short.status).not.toBe(0);
    const badRole = spawnSync(
      process.execPath,
      ["scripts/farm-user.mjs", "--email", "a@example.com", "--name", "A", "--role", "boss"],
      { input: "a-long-test-password\n", encoding: "utf-8" }
    );
    expect(badRole.status).not.toBe(0);
  });
});
