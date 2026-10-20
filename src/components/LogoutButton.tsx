"use client";

import { logoutUser } from "@/app/login/actions";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  return (
    <form action={logoutUser} className="w-full">
      <button
        className="mt-3 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-black text-white/60 hover:bg-white/10 hover:text-white"
        type="submit"
      >
        <LogOut size={13} />
        Sign out
      </button>
    </form>
  );
}
