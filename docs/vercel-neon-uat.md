# Vercel + Neon UAT Deployment

Use this when you want to give someone outside your machine a soft UAT link.

## 1. Create Neon database

1. Create a Neon project for `dinotinto-farm-os-uat`.
2. Copy the pooled PostgreSQL connection string.
3. Save it locally in `.env.uat`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DATABASE?sslmode=require"
```

## 2. Push schema and seed UAT data

```bash
npm run uat:env
npm run uat:db:push
npm run uat:db:seed
```

## 3. Create Vercel project

Use the Vercel dashboard or CLI.

Settings:

- Framework: Next.js
- Build command: leave default (`vercel.json` runs the env check, then `npm run deploy:build`)
- Install command: `npm install`
- Output directory: leave default

Add environment variables (the build stops with a clear message if any are missing):

```bash
DATABASE_URL=<same Neon pooled connection string>
SESSION_SECRET=<output of: openssl rand -hex 32, different from production>
FARM_USERS=<JSON array of entries from: npm run user:add -- --email ... --name ... --role ...>
ADMIN_PASSWORD_HASH=<optional, from: npm run user:hash>
GEMINI_API_KEY=<optional, enables the AI features>
```

## 4. Deploy

From the project folder:

```bash
vercel
```

For a production-style UAT URL:

```bash
vercel --prod
```

## 5. Smoke test

Open:

- `/`
- `/admin`

Test:

1. `/` redirects to `/login`; signing in with a `FARM_USERS` account opens the dashboard.
2. Signing out and visiting `/api/farm-state` directly returns `401 Not signed in`.
3. `/admin` asks for the admin password (only if `ADMIN_PASSWORD_HASH` is set).

## Access

Every page and API route needs a signed-in account; there is no public registration.
Use separate `SESSION_SECRET` and `FARM_USERS` values for UAT and production.
