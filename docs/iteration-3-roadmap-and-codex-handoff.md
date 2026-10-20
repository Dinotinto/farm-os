# Iteration 3 Roadmap and Codex Handoff

## Iteration 3 goal

Make Dinotinto Farm OS usable from a clean real-world setup instead of relying on demo data.

This iteration focuses on:

- clean starting records
- editable/deletable lists
- beginner guidance on every page
- proper irrigation material selection and costing
- practical user flow from land setup to planting and salary tracking

## Roadmap

### Phase 1 — Clean setup and editable records

Included in this iteration:

- Empty default data instead of forced sample records.
- Ability to delete records from all major modules.
- Clear all records/start fresh from Dashboard.
- Page-by-page explanations for novices.
- Irrigation material templates and custom entries.
- Plot-specific irrigation material selection.
- Calculation based on user-entered costs.

### Phase 2 — Stronger database persistence

Next technical step:

- Move every Farm OS record fully into Prisma/Postgres.
- Make delete behaviour relational and safe.
- Add audit logs for deleted payroll, salary and financial records.
- Add user/role permissions around who can delete or edit sensitive records.

### Phase 3 — Better operational controls

Recommended next build:

- Edit forms for irrigation materials, crop profiles, planting plans and input costs.
- Better inventory balance tracking.
- Worker attendance calendar view.
- Salary approval flow.
- Expense receipt/photo upload.
- Farm task recurrence.
- Export to CSV/PDF.

### Phase 4 — Intelligence layer

Later AI/weather/market features:

- Weather/rainfall integration.
- Market price trend tracking.
- AI farm advisor using actual farm records.
- Weekly work recommendations.
- Crop profitability comparison by season.

## Codex implementation instructions

1. Use this zip as the new source package.
2. Inspect these files first:

```text
src/components/FarmWorkspace.tsx
src/lib/farm-os-defaults.ts
src/lib/farm-os-types.ts
src/lib/farm-os-calculations.ts
docs/iteration-3-clean-editable-data-flow.md
docs/iteration-3-complete-novice-guide.md
docs/iteration-3-roadmap-and-codex-handoff.md
```

3. Confirm `src/lib/farm-os-defaults.ts` contains empty arrays and does not seed demo records.
4. Confirm the top-right **Reset demo data** button is gone.
5. Confirm every main page has a short explanatory **How to use this page** block.
6. Confirm delete controls exist across the main modules.
7. Confirm irrigation materials can be added using prepared templates or custom entries.
8. Confirm irrigation plans allow ticking specific material rows for a selected plot.
9. Confirm calculated irrigation plan cost comes from selected material rows if expected cost is left blank.
10. Confirm workers can be added, edited and deleted.
11. Confirm crops can be added and deleted.
12. Confirm all reports and calculations use saved records, not hardcoded demo values.

## Commands to run

```bash
npm install
npx prisma generate
npm run lint
npm run build
```

If Prisma generation fails because the environment cannot download Prisma binaries, run the same commands in the normal Codex/deployment environment with internet access and the correct Prisma cache.

## Manual UAT checklist

1. Open the app fresh.
2. Confirm no demo plots, workers, crops or irrigation materials appear by default.
3. Add a plot called Acre A with actual length and width.
4. Add a worker and then edit the worker.
5. Delete the worker and confirm it disappears.
6. Add crops such as pepper, cucumber and sweet corn.
7. Delete one crop and confirm it disappears from the list.
8. Add irrigation materials using prepared templates.
9. Add one custom irrigation item.
10. Delete one material row.
11. Create an irrigation plan for Acre A and select only the materials needed.
12. Leave expected cost blank and confirm the app calculates from selected rows.
13. Add a land clearing plan.
14. Add a planting plan and confirm warnings appear if plot/crop conditions are risky.
15. Add seed/input costs.
16. Add a task and assign it to a worker.
17. Add attendance and salary records.
18. Add market price and observation records.
19. Open Reports and confirm figures are based on the records you entered.
20. Use Dashboard **Clear all records and start fresh** and confirm the app returns to a clean state.

## Deployment note

If the deployed database already contains old demo/test records, clear them after deployment using the Dashboard clear action, or manually remove old farm-state data from the database. Do not run old seed scripts unless the user explicitly asks for demo data.
