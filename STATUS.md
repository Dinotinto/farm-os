# Dinotinto Farm OS — Project Status

_A plain-language summary of what the app is and where it stands. Use this to explain the project to anyone._

_Last updated: 2026-06-22_

## What it is

A farm-management app for a Nigerian vegetable/crop farm. One place for everything — plots, crops, inventory, workers, tasks, money — with an AI advisor that tells the farmer what to do next. It runs as a website (`farm.dtinto.com`) and as an Android app.

## How it's delivered

- **Web app** — Next.js, deployed on Vercel. Every push to GitHub `main` auto-updates the live site.
- **Android app** — a thin wrapper (Trusted Web Activity) that loads the live website fullscreen. An installable `.apk` exists; the Play Store bundle (`.aab`) is ready to upload. Because it loads the live site, the phone app updates automatically whenever the website updates — **no rebuild needed for content changes.**
- **Login** — the main app has an invite-only login with three roles (owner, manager, marketer); accounts are set in the `FARM_USERS` environment variable with hashed passwords, and there is no public registration. A separate `/admin` back-office area uses its own hashed password (`ADMIN_PASSWORD_HASH`). Sessions are signed with `SESSION_SECRET`.

## What's built and working today

- **Plots / Farm Map** — register land with real sizes, land status (ready, planted, fallow, needs clearing…), irrigation.
- **Crop catalog** — crop profiles (nursery needs, days to harvest, water need, common pests, fertilizer stages).
- **Planting planner** — ties a crop to a plot, projects cost/yield/profit, raises warnings, and reserves the inputs it will draw from inventory. Creating a plan **automatically marks the plot as planted**; plans move Active → Harvest Done (which rotates the plot to fallow and frees it).
- **Inventory** (single source of truth) — seeds, fertilizer, crop protection. Quantity = what you add minus what you use. Used-up items stay listed at 0 with an "out of stock" tag so you can restock the same item with its history intact. The app tells you exactly what to buy when plans need more than you hold. (Note: a plan _reserves_ stock; stock is only _deducted_ when you record actual usage.)
- **Tasks & Workers** — dated jobs assignable to workers; attendance, salary runs, labour payments, and unpaid-balance reminders.
- **Sales & Accounts** — real money in vs out, receivables, and profit-by-crop.
- **Dashboard + Advisor** — live totals, action alerts, upcoming tasks, and a **"Crop watch"** panel that tells you, per crop in the ground, its growth stage, what you should be seeing now, and the next action — based on crop type and today's date.
- **Ask AI** — a clean single-panel chat (compact header, messages, suggested questions as a scroll row above the input). Answers farm questions and can act across the system on your confirmation: create tasks/observations/planting plans, add workers, log attendance, update plot status, and **edit existing plans** (refinable in chat, e.g. "yes do it but leave the harvest date"). **The Gemini key is set and working** (newer `AQ.`-format key; valid). Falls back to a built-in rules engine only if no key is set.
- **Photo Advisor (AI vision)** — on the Advisor tab: take/upload a photo of a crop, plot or produce → Gemini diagnoses and proposes plot-scoped tasks/observations/plot-status changes; "Apply all" in one tap.
- **Calendar** — month grid of every dated record; tap a day for a popover of its events.
- **Messages** — team chat between users (Owner/Manager/Marketer + future workers): inbox with unread counts, threads with read receipts, new-message browser notifications, unread badges in the nav. Stored in its own `Message` table (live in Neon).
- **Mobile UX** — 2-up compact KPI cards; big "Add" forms behind +Add buttons; record cards collapse to a summary row (tap to expand); long lists show first few + "Show all"; Dashboard/Advisor/Inventory panels collapse to tappable headers.
- **Per-worker feeding cost**, **species/variety-aware planning** (Nigerian variety dropdown + AI species note + "Enhance with AI"), and **photo/receipt upload** on observations & purchases.
- **Walkthrough PDF** — `public/Farm-OS-Planting-Walkthrough.pdf` documents the full flow from empty plot to recorded sale.

## Database — ACTIVE (shared Postgres, on Neon)

The shared database is **live and persisting** (verified 2026-06-24: `GET /api/farm-state` returns `"persisted": true` with real farm data). Neon project "Dtinto-farm" (Postgres 18) is connected via `DATABASE_URL` in Vercel, and the app saves every change to it. Data is shared across devices; the browser localStorage is now just an offline cache/backup. No further setup needed. See `DATABASE-SETUP.md` only if the DB ever needs to be recreated/migrated.

## Roadmap status

**Done (shipped):**
- **Let AI do more** — Ask AI now also creates planting plans, adds workers, and logs attendance (on top of tasks/observations).
- **Report export** — every report has a CSV download; the page has a Print / Save as PDF button.
- **Calendar view** — a "Calendar" tab shows task due dates, nursery/planting/transplant/harvest milestones and salary pay dates on a month grid.
- **More crop knowledge** — offline rules engine extended to ~15 crops (added okra, watermelon, cassava, yam, onion, carrot, ugu, amaranth).
- **Photo / receipt upload** — camera-capable, compressed photos attach to pest/disease observations and stock purchases (receipts), with thumbnails.
- **Role-based access** — nav and tabs are gated by role (owner/manager full; marketer sales-focused; worker role ready for tasks-only).
- **Crop-stage "Crop watch", plan→plot auto-update, inventory "out of stock"** — shipped earlier.

**Remaining:**
1. ~~Database wiring~~ — **DONE.** Live on Neon Postgres, persisting and shared across devices (verified 2026-06-24).

> **False alarm cleared:** the Gemini key is valid and working — the `AQ.`-prefixed format is correct, not malformed (verified live, HTTP 200).

## One-line version

> Farm OS is a working farm-management app (web + Android) covering land, crops, inventory, workers, tasks and money with an AI advisor — fully usable now, with the main next step being to switch on the shared database so data is safe across devices.

## Working across two PCs

The project is developed on two machines, "main" and "sub", kept in sync through GitHub.

- **main** = the machine that holds the Android signing keystore (`android.keystore`) — required for every Play Store update. This is the source of truth for Android builds.
- **sub** = the other machine. Bootstrap it with: `git clone` the repo → copy `android.keystore` from the portable zip → `npm install` → `npm run dev`.
- Sync routine: `git pull` before work, `git add -A && git commit && git push` after. The signing keystore is gitignored (not on GitHub), so it must be copied manually if you build Android on sub.
