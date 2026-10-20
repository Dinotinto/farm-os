# Turning on the shared database (Postgres)

Right now Farm OS saves all data to the **browser (localStorage)** — per-device, and lost if the cache is cleared. The code to use a shared Postgres database is already written and wired; it just needs a database to point at. Once that's set, every change syncs to the cloud and is the same on every device and the phone app.

**How the code already behaves** (no code change needed):
- On open, it loads from the database if available, else from local storage.
- On every change, it saves to local storage immediately and syncs to the database ~0.8s later.
- If the database is not configured, the API returns 503 and the app silently keeps using local storage. So turning the database on is safe and reversible.

## One-time activation (about 5 minutes, done in Vercel)

1. **Create a Postgres database.**
   - In the Vercel dashboard → your project → **Storage** → **Create Database** → **Postgres** (Neon-backed, free tier is fine).
   - Vercel automatically adds the `DATABASE_URL` (and related `POSTGRES_*`) environment variables to the project.

2. **Confirm the env var.**
   - Vercel → Project → **Settings → Environment Variables** → make sure `DATABASE_URL` exists for Production (a `postgresql://...` string).

3. **Push the table** (creates the `FarmOsState` table). From the project folder on a PC, with the production `DATABASE_URL` available:
   ```bash
   # uses prisma/schema.postgres.prisma
   npm run prod:db:push
   ```
   - If you keep the prod connection string in a local file `.env.prod.local`, use:
     ```bash
     npm run prod:file:db:push
     ```
   - This runs `prisma db push` and creates the single `FarmOsState` table (id, blob, updatedAt). It does not delete anything.

4. **Redeploy** (or just push to `main` so Vercel redeploys). Done.

## Verify it worked
- Open `https://farm.dtinto.com/api/farm-state` in a browser. Before activation it returns `{"persisted":false,...}`. After you've saved at least one change with the DB on, it returns `{"persisted":true,...}` with your data.
- Make a change on one device, open the app on another → the change is there.

## Notes
- The whole farm state is stored as one JSON blob in one row. That's simple and reliable for a single-farm app; if the data ever grows very large, it can be split into proper tables later (the Prisma schema already has placeholder models).
- Photos attached to records (see receipts/observations) are stored inside that JSON as compressed thumbnails. Heavy photo use is the main reason to move to the database rather than the ~5 MB local-storage limit.
- The keystore/secrets are unrelated to this — this is purely the data database.
