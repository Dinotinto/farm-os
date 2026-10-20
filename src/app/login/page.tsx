import { loginUser } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8f4] px-5 py-8 text-[#14213d]">
      <form
        action={loginUser}
        className="w-full max-w-md rounded-2xl border border-[#d8dece] bg-white p-8 shadow-sm grid gap-5"
      >
        <div>
          <div className="grid h-14 w-14 place-items-center rounded-xl bg-[#193b28] font-black text-white text-xl mb-4">
            DF
          </div>
          <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">
            Dinotinto Farm OS
          </p>
          <h1 className="mt-1 text-2xl font-black text-[#14213d]">Welcome back</h1>
          <p className="mt-1 text-sm font-bold text-[#667085]">
            Sign in with your farm account to continue.
          </p>
        </div>

        {params.error ? (
          <p className="rounded-lg border border-[#fecdca] bg-[#fff4f2] px-3 py-2 text-sm font-bold text-[#b42318]">
            Incorrect email or password. Please try again.
          </p>
        ) : null}

        <label className="grid gap-1.5 text-sm font-bold text-[#4b5a76]">
          Email address
          <input
            autoComplete="email"
            className="min-h-11 rounded-lg border border-[#d8dece] px-3 text-[#14213d] shadow-sm"
            name="email"
            required
            type="email"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-bold text-[#4b5a76]">
          Password
          <input
            autoComplete="current-password"
            className="min-h-11 rounded-lg border border-[#d8dece] px-3 text-[#14213d] shadow-sm"
            name="password"
            required
            type="password"
          />
        </label>

        <button
          className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white hover:bg-[#0a7460]"
          type="submit"
        >
          Sign in
        </button>

        <p className="text-center text-xs font-bold text-[#667085]">
          Contact the farm owner to get access.
        </p>
      </form>
    </main>
  );
}
