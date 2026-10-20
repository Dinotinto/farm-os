import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/passwords";

// A tiny stand-in for Next's request cookies.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const readFarmState = vi.fn(async () => ({ updatedAt: new Date(0), blob: JSON.stringify({ plots: [] }) }));
const writeFarmState = vi.fn(async () => true);
vi.mock("@/lib/farm-state-store", () => ({ readFarmState, writeFarmState }));

beforeEach(() => {
  jar.clear();
  readFarmState.mockClear();
  writeFarmState.mockClear();
  vi.stubEnv("SESSION_SECRET", "test-secret-that-is-at-least-32-characters-long");
  vi.stubEnv(
    "FARM_USERS",
    JSON.stringify([{ email: "worker@example.com", displayName: "Test Worker", role: "marketer", passwordHash: hashPassword("worker-test-pass") }])
  );
});
afterEach(() => vi.unstubAllEnvs());

const put = (body: unknown) =>
  new Request("http://localhost/api/farm-state", { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("farm data API requires a signed-in user", () => {
  it("refuses to read or overwrite farm data without a session", async () => {
    const { GET, PUT } = await import("@/app/api/farm-state/route");
    expect((await GET()).status).toBe(401);
    expect((await PUT(put({ wiped: true }))).status).toBe(401);
    expect(readFarmState).not.toHaveBeenCalled();
    expect(writeFarmState).not.toHaveBeenCalled();
  });

  it("refuses a hand-made 'owner' cookie in the old unsigned format", async () => {
    jar.set("farm_session", Buffer.from(JSON.stringify({ email: "worker@example.com", displayName: "X", role: "owner" })).toString("base64"));
    const { GET } = await import("@/app/api/farm-state/route");
    expect((await GET()).status).toBe(401);
  });

  it("works after a real login, with the role taken from FARM_USERS", async () => {
    const { setSessionUser, getSessionUser } = await import("@/lib/user-session");
    await setSessionUser({ email: "worker@example.com", displayName: "ignored", role: "owner" });
    expect((await getSessionUser())?.role).toBe("marketer");

    const { GET, PUT } = await import("@/app/api/farm-state/route");
    expect((await GET()).status).toBe(200);
    expect((await PUT(put({ plots: [] }))).status).toBe(200);
    expect(writeFarmState).toHaveBeenCalledOnce();
  });

  it("lets the /admin workspace load and save farm data with an admin session", async () => {
    const { setAdminSession } = await import("@/lib/admin-session");
    await setAdminSession();
    const { GET, PUT } = await import("@/app/api/farm-state/route");
    expect((await GET()).status).toBe(200);
    expect((await PUT(put({ plots: [] }))).status).toBe(200);
  });

  it("refuses the old fixed admin cookie value", async () => {
    jar.set("farm_admin_session", "farm-admin-ok");
    const { GET } = await import("@/app/api/farm-state/route");
    expect((await GET()).status).toBe(401);
  });

  it("drops the session when the user is removed from FARM_USERS", async () => {
    const { setSessionUser, getSessionUser } = await import("@/lib/user-session");
    await setSessionUser({ email: "worker@example.com", displayName: "Test Worker", role: "marketer" });
    vi.stubEnv("FARM_USERS", "[]");
    expect(await getSessionUser()).toBeNull();
  });

  const aiRoutes = {
    agent: () => import("@/app/api/agent/route"),
    "analyze-photo": () => import("@/app/api/analyze-photo/route"),
    "plant-plan": () => import("@/app/api/plant-plan/route"),
    "seed-estimate": () => import("@/app/api/seed-estimate/route"),
  };

  it.each(Object.keys(aiRoutes) as (keyof typeof aiRoutes)[])("/api/%s refuses anonymous callers", async (name) => {
    const route = await aiRoutes[name]();
    const response = await route.POST(new Request(`http://localhost/api/${name}`, { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });
});
