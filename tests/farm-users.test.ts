import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/passwords";

const ownerHash = hashPassword("owner-test-password");
const managerHash = hashPassword("manager-test-password");

const users = [
  { email: "Owner@Example.com", displayName: "Test Owner", role: "owner", passwordHash: ownerHash },
  { email: "manager@example.com", displayName: "Test Manager", role: "manager", passwordHash: managerHash },
];

async function load(farmUsers: unknown) {
  vi.resetModules();
  vi.stubEnv("FARM_USERS", typeof farmUsers === "string" ? farmUsers : JSON.stringify(farmUsers));
  return import("@/lib/farm-users");
}

afterEach(() => vi.unstubAllEnvs());

describe("farm users from FARM_USERS", () => {
  it("logs in with the right password, case-insensitive email", async () => {
    const { findUser } = await load(users);
    expect(findUser(" OWNER@example.com ", "owner-test-password")?.role).toBe("owner");
    expect(findUser("owner@example.com", "manager-test-password")).toBeNull();
    expect(findUser("nobody@example.com", "owner-test-password")).toBeNull();
  });

  it("roster never includes password hashes", async () => {
    const { farmRoster } = await load(users);
    const roster = farmRoster();
    expect(roster).toHaveLength(2);
    expect(JSON.stringify(roster)).not.toContain("scrypt$");
  });

  it("has no users when FARM_USERS is unset", async () => {
    const { farmUsers, findUser } = await load("");
    expect(farmUsers()).toEqual([]);
    expect(findUser("owner@example.com", "owner-test-password")).toBeNull();
  });

  it.each([
    ["not JSON", "{oops", /not valid JSON/],
    ["not an array", { email: "a@example.com" }, /JSON array/],
    ["plain password instead of a hash", [{ email: "a@example.com", displayName: "A", role: "owner", passwordHash: "hunter22" }], /passwordHash/],
    ["unknown role", [{ ...users[0], role: "boss" }], /role/],
    ["missing name", [{ ...users[0], displayName: " " }], /displayName/],
    ["duplicate email", [users[0], { ...users[1], email: "owner@example.com" }], /duplicate/],
  ])("rejects %s", async (_label, value, message) => {
    const { farmUsers } = await load(value);
    expect(() => farmUsers()).toThrow(message);
  });
});
