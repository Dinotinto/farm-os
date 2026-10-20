import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/user-session";

/**
 * For API route handlers: returns the signed-in user, or a 401 response to send back.
 *
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  return user;
}
