# Iteration 1 — Big Farm OS Foundation

## What changed

This iteration expands the UAT app from a small farm records/admin prototype into a broad Farm OS workspace covering roughly 90% of the requested feature scope.

The implementation is deliberately front-end/local-first so the operating workflow can be tested immediately before Codex wires the enlarged data model into Prisma/Postgres.

## Main delivered modules

- Dashboard command centre
- Farm Map / Acre Registry
- Plot details with actual length/width and equivalent acre calculation
- Irrigation materials list
- Irrigation setup costing
- Irrigation plan builder
- Land readiness and clearing plans
- Rain/bush regrowth logic
- Crop catalogue with default crops: Pepper, Garden egg, Sweet corn, Plantain, Cucumber
- Planting planner with warnings
- Seed and input planning
- Task assignment to workers
- Labour force management
- Labour payment tracking and balance calculation
- Market price records
- Yield forecast screen
- Observations and forecast impact logging
- Reports: land status, readiness, irrigation, profit forecast, labour cost, input cost, market price and tasks

## Important implementation note

The new workspace stores UAT records in browser localStorage under:

```txt
 dinotinto-farm-os-big-iteration-v1
```

This makes the app immediately testable without requiring database migrations. The old Prisma files remain in the repo as compatibility/future DB references, but the current build no longer depends on Prisma generation.

## New key files

```txt
src/components/FarmWorkspace.tsx
src/lib/farm-os-types.ts
src/lib/farm-os-defaults.ts
src/lib/farm-os-calculations.ts
docs/iteration-1-big-farm-os.md
```

## Build changes

The project scripts were simplified so the large front-end iteration can build without Prisma binary download issues:

```json
"dev": "next dev",
"build": "next build"
```

Codex can later reintroduce Prisma generation once the expanded schema is created.

## Codex next step

Codex should inspect the new TypeScript types in `src/lib/farm-os-types.ts` and convert them into a real persistence layer. Suggested order:

1. Create expanded Prisma/Postgres schema from the new Farm OS types.
2. Add migrations for plots, irrigation materials, irrigation plans, clearing plans, crop profiles, planting plans, seeds, inputs, workers, payments, tasks, market prices, forecasts and observations.
3. Replace localStorage read/write in `FarmWorkspace.tsx` with server actions or API routes.
4. Keep the same UI and calculations unless a DB-backed version requires small adjustments.
5. Preserve mobile layout and all current screens.
6. Run `npm run lint` and `npm run build`.

## Manual UAT checklist

- Create a plot with 300 x 100 feet and confirm equivalent acres are calculated.
- Create a second plot with different measurements and confirm it does not assume all acres are equal.
- Mark a plot as bushy and non-irrigated.
- Add pump, pipe, drip line and labour irrigation materials.
- Confirm cost per acre, reusable equipment cost, consumable cost and maintenance estimate update.
- Create an irrigation plan for a non-irrigated plot.
- Create a clearing plan and review safety notes.
- Add a crop profile.
- Create a planting plan and confirm warnings show for bushy/non-irrigated/high-water crops.
- Add seed batch and input cost records.
- Add workers and assign tasks to workers.
- Record a labour payment and confirm unpaid balance.
- Add market price records.
- Add observations with yield/cost impact.
- Check the forecast screen for adjusted yield/revenue/profit.
- Check all report tables.
- Check mobile bottom navigation and menu.
