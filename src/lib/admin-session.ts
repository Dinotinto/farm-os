import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/session-token";

export const adminSessionCookie = "farm_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function hasAdminSession() {
  const cookieStore = await cookies();
  return verifyToken("admin", cookieStore.get(adminSessionCookie)?.value) !== null;
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(adminSessionCookie, signToken("admin", {}, ADMIN_SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(adminSessionCookie);
}
