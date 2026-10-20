import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-session";
import { getSessionUser, type SessionUser } from "@/lib/user-session";

/** Who the /admin back office acts as when it calls the API. */
export const ADMIN_ACTOR: SessionUser = { email: "admin", displayName: "Admin", role: "admin" };

/**
 * For API route handlers: returns the signed-in farm user (or the admin, when called
 * from the /admin workspace), or a 401 response to send back.
 *
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (user) return user;
  if (await hasAdminSession()) return ADMIN_ACTOR;
  return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
}
