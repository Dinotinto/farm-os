import { hashPassword, isPasswordHash, verifyPassword } from "@/lib/passwords";

export type UserRole = "owner" | "manager" | "marketer";

export interface FarmUser {
  email: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
}

const ROLES: readonly UserRole[] = ["owner", "manager", "marketer"];

/**
 * Farm accounts come from the FARM_USERS environment variable: a JSON array of
 * `{ "email", "displayName", "role", "passwordHash" }`. Passwords are never stored
 * in the code or the repo. Create an entry with `npm run user:add`.
 */
export function parseFarmUsers(raw: string | undefined): FarmUser[] {
  if (!raw || !raw.trim()) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("FARM_USERS is not valid JSON.");
  }
  if (!Array.isArray(data)) throw new Error("FARM_USERS must be a JSON array of users.");

  const seen = new Set<string>();
  return data.map((entry, index) => {
    const where = `FARM_USERS[${index}]`;
    if (!entry || typeof entry !== "object") throw new Error(`${where} must be an object.`);
    const { email, displayName, role, passwordHash } = entry as Record<string, unknown>;

    if (typeof email !== "string" || !email.includes("@")) throw new Error(`${where}.email is missing or invalid.`);
    if (typeof displayName !== "string" || !displayName.trim()) throw new Error(`${where}.displayName is required.`);
    if (typeof role !== "string" || !ROLES.includes(role as UserRole)) {
      throw new Error(`${where}.role must be one of: ${ROLES.join(", ")}.`);
    }
    if (!isPasswordHash(passwordHash)) {
      throw new Error(`${where}.passwordHash must be a scrypt hash from \`npm run user:add\`, not a plain password.`);
    }

    const normalized = normalizeEmail(email);
    if (seen.has(normalized)) throw new Error(`${where}.email is a duplicate.`);
    seen.add(normalized);

    return { email: normalized, displayName: displayName.trim(), role: role as UserRole, passwordHash };
  });
}

let cache: { raw: string | undefined; users: FarmUser[] } | undefined;

export function farmUsers(): FarmUser[] {
  const raw = process.env.FARM_USERS;
  if (!cache || cache.raw !== raw) cache = { raw, users: parseFarmUsers(raw) };
  return cache.users;
}

let timingHash: string | undefined;

/** Checks an email + password. Unknown emails still pay for a hash, so timing doesn't reveal which emails exist. */
export function findUser(email: string, password: string): FarmUser | null {
  const user = findUserByEmail(email);
  if (!user) {
    timingHash ??= hashPassword("timing-equaliser");
    verifyPassword(password, timingHash);
    return null;
  }
  return verifyPassword(password, user.passwordHash) ? user : null;
}

export function findUserByEmail(email: string): FarmUser | null {
  const normalized = normalizeEmail(email);
  return farmUsers().find((u) => u.email === normalized) ?? null;
}

export type RosterUser = { email: string; displayName: string; role: UserRole };

/** Public roster (no password hashes) — safe to send to the client for messaging. */
export function farmRoster(): RosterUser[] {
  return farmUsers().map(({ email, displayName, role }) => ({ email, displayName, role }));
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}
