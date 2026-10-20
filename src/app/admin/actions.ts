"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, setAdminSession } from "@/lib/admin-session";
import { isPasswordHash, verifyPassword } from "@/lib/passwords";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "");
  // ADMIN_PASSWORD_HASH holds a scrypt hash from `npm run user:hash`, never the password itself.
  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!isPasswordHash(expectedHash) || !verifyPassword(password, expectedHash)) {
    redirect("/admin/login?error=1");
  }

  await setAdminSession();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}

// Kept as a compatibility stub for the older admin form. The new big Farm OS
// workspace stores UAT records in localStorage until Codex wires the expanded
// data model into Prisma/Postgres.
export async function addFarmLog() {
  redirect("/admin");
}
