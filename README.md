# Dinotinto Farm OS

A farm operating system for a Nigerian vegetable and crop farm. It keeps land, irrigation, labour, payroll, crop plans, stock, sales and costs in one place, does the maths, and suggests what to do next. It runs as a web app and as an Android app (a Trusted Web Activity wrapper around the same site).

Built with Next.js (App Router), React 19, TypeScript, Tailwind CSS 4, Prisma and PostgreSQL, with optional Gemini AI features.

## What it does

**Land and irrigation**
- Farm map and acre registry, with Nigerian plot presets (300 × 100 ft, 200 × 150 ft) converted to equivalent acres
- Land readiness tracking and a cost/time comparison of manual, chemical, mechanical and combined clearing
- Irrigation material catalogue and per-plot irrigation plans that scale materials and budget to acreage

**Crops and stock**
- Crop catalogue with templates (cucumber, tomato, bell pepper, scotch bonnet, garden egg, sweet corn, plantain)
- Planting planner that auto-fills nursery, transplant and harvest dates, draws seed and inputs from inventory, and warns about shortfalls
- Inventory with reserved vs available stock, market price tracking and yield forecasts

**People and money**
- Workers, tasks, attendance and a full payroll run: day rates, bonuses, deductions, advances, transport and feeding
- Sales, receivables and money-in vs money-out, with cost per plot, per worker and per category, and profit margin
- Team messaging between farm accounts

**Advice**
- Rules-based Farm Advisor (clearing, irrigation cost, crop placement, worker plans, cost flags)
- Ask AI: questions answered from the farm's own records, using Gemini when configured and the built-in rules assistant otherwise
- Photo Advisor: photograph a crop or plot and get a diagnosis plus suggested tasks

**Works offline**
- Every change is saved to `localStorage` straight away and synced to Postgres through `/api/farm-state`, so a dropped connection never loses work

## Access and security

- **Invite-only.** There's no public sign-up. Accounts (owner, manager, marketer) come from the `FARM_USERS` environment variable, holding scrypt password hashes only. No passwords live in the code.
- **Signed sessions.** Login cookies are HMAC-signed with `SESSION_SECRET` and expire after 7 days. Each request re-checks the account, so removing someone from `FARM_USERS` locks them out at once.
- **Protected API.** Every API route, including farm data and the AI endpoints, returns `401` without a valid session.
- **Fail-fast deploys.** `scripts/check-production-env.mjs` runs before every Vercel build and stops the deploy if a secret is missing, too short or stored as plain text.

## Getting started

Requires Node.js 20+.

```bash
npm install
cp .env.example .env          # local SQLite database by default
npm run db:init               # create the local tables
npm run user:add -- --email you@example.com --name "Your Name" --role owner
```

`user:add` asks for a password at a hidden prompt and prints a JSON entry. Paste it into `FARM_USERS` in `.env`:

```bash
FARM_USERS='[{"email":"you@example.com","displayName":"Your Name","role":"owner","passwordHash":"scrypt$..."}]'
```

Then:

```bash
npm run dev                   # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite file locally, PostgreSQL for UAT and production |
| `SESSION_SECRET` | In production | 32+ random characters (`openssl rand -hex 32`). Locally a random one is generated per run. |
| `FARM_USERS` | Yes | JSON array of accounts from `npm run user:add` |
| `ADMIN_PASSWORD_HASH` | No | Unlocks `/admin`. Create with `npm run user:hash`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | No | Enables the AI features |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit and API tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks |
| `npm run build` | Production build |
| `npm run user:add -- --email … --name … --role …` | Create a `FARM_USERS` entry |
| `npm run user:hash` | Hash a password, e.g. for `ADMIN_PASSWORD_HASH` |
| `npm run prod:env` | Check production environment variables |
| `npm run uat:db:push` / `npm run prod:file:db:push` | Push the Prisma schema to UAT / production |

## Tests and CI

`tests/` covers the security-critical paths:
- password hashing, including hashes made by the CLI script
- signed tokens: tampering, expiry, wrong secret, wrong purpose
- `FARM_USERS` validation
- the API rejecting anonymous and forged-cookie requests

GitHub Actions runs lint, type-check, tests and a production build on every push and pull request.

## Deployment

- **Web:** Vercel and Neon Postgres. See [`docs/vercel-neon-uat.md`](docs/vercel-neon-uat.md) and [`docs/deployment-flow.md`](docs/deployment-flow.md).
- **Android:** Bubblewrap TWA build via `scripts/build-apk.mjs`. Signing passwords come from environment variables, and the keystore is never committed. See [`docs/android-playstore-guide.md`](docs/android-playstore-guide.md).

## Project layout

```
src/app/            Pages and API routes (App Router)
src/components/     FarmWorkspace (main app UI), Messages
src/lib/            Domain logic: calculations, advisor, AI agent, auth and sessions
prisma/             SQLite (local) and Postgres schemas
scripts/            Env checks, DB setup and seeding, user tool, Android build
tests/              Vitest suites
docs/               User guides, roadmap and iteration notes
```

## Licence

Copyright © 2026 Adeolu Idowu. All rights reserved. The source is published so it can be viewed; see [LICENSE](LICENSE).
