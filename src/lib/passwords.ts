import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt. Hashes look like
 * `scrypt$N$r$p$<salt>$<hash>` (salt and hash base64url), so the cost
 * settings travel with each hash and can be raised later.
 *
 * Generate one with `npm run user:hash` (same format, see scripts/farm-user.mjs).
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEMORY });
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltText, hashText] = parts;
  const cost = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEMORY };
  if (![cost.N, cost.r, cost.p].every((value) => Number.isInteger(value) && value > 0)) return false;

  const expected = Buffer.from(hashText, "base64url");
  if (expected.length < 16) return false;

  try {
    const actual = scryptSync(password, Buffer.from(saltText, "base64url"), expected.length, cost);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function isPasswordHash(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("scrypt$") && value.split("$").length === 6;
}
