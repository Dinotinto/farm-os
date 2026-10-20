# Dinotinto Farm OS Roadmap

## Vision

Dinotinto Farm OS should become a practical farm operating system: land, irrigation, crop planning, inputs, labour, salaries, harvest, sales, observations, profit and later AI recommendations all connected in one place.

## Phase 1 — UAT foundation now included

- Farm dashboard
- Farm Map / Acre Registry
- Editable plot sizes and acreage calculation
- Land readiness and clearing plans
- Irrigation material costing
- Irrigation plan builder
- Crop catalog
- Planting planner
- Seed and input planning
- Tasks and worker assignment
- Worker register
- Worker editing
- Salary & Payroll
- Attendance / days worked
- Bonuses, deductions and advances
- Salary runs and balances
- Market price tracking
- Yield forecast
- Observations and forecast impact
- Reports

## Phase 2 — Database and reliability

- Wire all UAT/localStorage records into Prisma/Postgres.
- Add proper API routes.
- Add authentication and role permissions if required.
- Add safe delete/archive.
- Add audit log for salary changes, worker edits and payment records.

## Phase 3 — Operational polish

- Dedicated worker detail page.
- Dedicated plot detail page.
- Dedicated crop cycle detail page.
- Calendar view for tasks, irrigation and salary dates.
- Better search/filtering.
- CSV/PDF report export.
- Receipt/photo upload for purchases, labour payments and observations.
- Mobile quick-entry mode for field work.

## Phase 4 — Intelligence layer

- AI weekly farm summary.
- AI planting readiness check.
- AI irrigation cost comparison.
- AI worker task planning.
- AI profit warning when costs or crop risks rise.

## Recommended next build after this zip

The next serious technical step should be database wiring. The UI is now broad enough. The risk is keeping too much important farm data in browser localStorage. Move workers, salary runs, attendance, plots, tasks and cost records to the database before using it for real farm operations.
