import Link from "next/link";
import { loginAdmin } from "@/app/admin/actions";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f4] px-5 py-8 text-[#14213d]">
      <form action={loginAdmin} className="dt-panel grid w-full max-w-md gap-4 p-6">
        <div>
          <p className="text-xs font-black uppercase text-[#0f8b6f]">FarmDitinto UAT</p>
          <h1 className="mt-2 text-3xl font-black">Admin login</h1>
          <p className="mt-2 leading-7 text-[#4b5a76]">Enter the UAT admin password to manage farm records.</p>
        </div>

        {params.error ? (
          <p className="rounded-lg border border-[#fecdca] bg-[#fff4f2] px-3 py-2 text-sm font-bold text-[#b42318]">
            Incorrect password.
          </p>
        ) : null}

        <label className="grid gap-2 text-sm font-bold text-[#4b5a76]">
          Password
          <input
            autoComplete="current-password"
            className="min-h-11 rounded-lg border border-[#d8dece] px-3"
            name="password"
            required
            type="password"
          />
        </label>

        <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">
          Log in
        </button>

        <Link className="text-sm font-black text-[#0f8b6f]" href="/">
          Back to dashboard
        </Link>
      </form>
    </main>
  );
}
