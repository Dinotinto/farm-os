import { cookies } from "next/headers";
import { findUserByEmail } from "@/lib/farm-users";
import { signToken, verifyToken } from "@/lib/session-token";

export const SESSION_COOKIE = "farm_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  email: string;
  displayName: string;
  role: string;
}

/**
 * Reads the signed session cookie. The user is looked up again on every request,
 * so removing someone from FARM_USERS or changing their role takes effect at once.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const claims = verifyToken<{ email?: unknown }>("user", cookieStore.get(SESSION_COOKIE)?.value);
  if (!claims || typeof claims.email !== "string") return null;

  const user = findUserByEmail(claims.email);
  if (!user) return null;
  return { email: user.email, displayName: user.displayName, role: user.role };
}

export async function setSessionUser(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signToken("user", { email: user.email }, SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionUser() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
