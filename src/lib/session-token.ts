import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Small signed-token helper for session cookies: `<base64url JSON>.<HMAC-SHA256>`.
 * The payload carries its purpose (`typ`) and an expiry (`exp`, unix seconds),
 * so a cookie can't be edited, reused for another purpose, or kept forever.
 */
export type TokenType = "user" | "admin";

const MIN_SECRET_LENGTH = 32;
let developmentSecret: string | undefined;

export function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured && configured.length >= MIN_SECRET_LENGTH) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error(`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production.`);
  }

  // Local development only: a random per-process secret, so sessions reset on restart.
  developmentSecret ??= randomBytes(32).toString("hex");
  return developmentSecret;
}

function signature(body: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(body).digest();
}

export function signToken(type: TokenType, payload: Record<string, unknown>, maxAgeSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, typ: type, exp }), "utf-8").toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  type: TokenType,
  token: string | undefined | null
): (T & { typ: TokenType; exp: number }) | null {
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = signature(body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const claims = payload as T & { typ?: unknown; exp?: unknown };
  if (claims.typ !== type) return null;
  if (typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000)) return null;

  return claims as T & { typ: TokenType; exp: number };
}
