"use server";

import { redirect } from "next/navigation";
import { findUser } from "@/lib/farm-users";
import { setSessionUser, clearSessionUser } from "@/lib/user-session";

export async function loginUser(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const user = findUser(email, password);
  if (!user) {
    redirect("/login?error=1");
  }
  await setSessionUser({ email: user.email, displayName: user.displayName, role: user.role });
  redirect("/");
}

export async function logoutUser() {
  await clearSessionUser();
  redirect("/login");
}
