# Codex Handoff — Iteration 4 Guided Workflow, AI and Mobile Update

Use this zip as the next source package.

## Goal

Apply the Iteration 4 update so the app becomes easier for a complete novice to use. The main aim is to create a defined workflow, not just a list of forms.

## Key features to verify

1. Farm Map has Nigerian farm-acre size presets.
2. Farm Map explains that 300 × 100 ft and 200 × 150 ft equal 30,000 sq ft, about 0.69 conventional acre.
3. Dashboard has a step-by-step workflow card section.
4. Irrigation page has a defined workflow.
5. Irrigation water source is selectable/typeable.
6. Irrigation materials can still be added from templates or custom entries.
7. Irrigation plan still allows selecting exact material rows for a specific plot.
8. Crop Catalog has common crop templates.
9. Crop templates include plantain, cucumber, tomato, bell pepper, scotch bonnet, garden egg and sweet corn.
10. Saved crop profiles are selectable/typeable in other workflows.
11. Planting Planner auto-calculates transplant/harvest dates when fields are left blank.
12. Market price unit supports kg and ton.
13. Ask AI is a proper large chat box, not a small panel that jumps to the top.
14. Ask AI has suggested prompts and action buttons to navigate to pages.
15. Ask AI can answer whitefly/pest questions.
16. Ask AI directs the user to Farm Map if there are no plots.
17. Ask AI directs the user to Irrigation if there are no material prices.
18. Ask AI has microphone speech-to-text using browser Web Speech API.
19. Mobile layout remains usable and does not require horizontal scrolling for normal forms.

## Files to inspect first

```text
src/components/FarmWorkspace.tsx
src/lib/farm-os-types.ts
src/lib/farm-os-agent.ts
src/app/api/agent/route.ts
docs/iteration-4-guided-workflow-ai-mobile.md
docs/iteration-4-novice-step-by-step-guide.md
docs/iteration-4-codex-handoff.md
```

## Commands to run

```bash
npm install
npx prisma generate
npm run lint
npm run build
```

If Prisma generation fails locally, run:

```bash
npx prisma generate --schema prisma/schema.prisma
```

or, for the UAT/Postgres schema:

```bash
npx prisma generate --schema prisma/schema.postgres.prisma
```

## Manual UAT checklist

### Farm Map

1. Open Farm Map.
2. Choose “Nigerian farm acre / 300 × 100 ft”.
3. Confirm length and width prefill as 300 and 100.
4. Save the plot.
5. Confirm equivalent acres show about 0.69.
6. Repeat with 200 × 150 ft.

### Irrigation

1. Open Irrigation.
2. Add material from template: pump.
3. Enter real unit cost.
4. Add material from template: water tank.
5. Add material from template: drip lines.
6. Add custom material.
7. Create irrigation plan for one plot.
8. Tick the exact material rows.
9. Leave expected cost blank.
10. Confirm plan cost is calculated from selected materials.

### Crop Catalog

1. Open Crop Catalog.
2. Select cucumber template.
3. Change variety note to African Giant or Darina.
4. Save crop.
5. Select plantain template.
6. Save crop.
7. Confirm both appear as crop profiles.
8. Delete a crop and confirm it disappears.

### Planting Planner

1. Open Planting Planner.
2. Select a saved crop.
3. Select a saved plot.
4. Enter nursery or planting date.
5. Leave harvest dates blank.
6. Enter market price and unit.
7. Save.
8. Confirm transplant/harvest dates are generated.
9. Confirm revenue and profit calculate.

### Ask AI

1. Open Ask AI.
2. Ask: “How much will irrigation cost?” with no plot data and confirm it tells you to create a plot.
3. Ask the same question after adding a plot but before adding materials and confirm it sends you to Irrigation.
4. Ask: “Best way to fight whiteflies” and confirm it gives practical pest guidance.
5. Ask: “Help me plant cucumber” and confirm it directs to Crop Catalog/Planting Planner.
6. Click the action buttons in chat and confirm they open the right pages.
7. Use the Speak button on mobile Chrome/Edge and confirm speech-to-text sends the question.

## Build note

In the sandbox, `npm run build` compiled successfully but failed at type-checking because Prisma Client was not generated. `npx prisma generate` could not download Prisma binaries due offline sandbox access to `binaries.prisma.sh`. This should work in Codex or the deployment environment with network access.

Validated locally:

```bash
npx tsc --noEmit --project temporary-farm-os-only-tsconfig.json
npx tsc --noEmit --project temporary-agent-route-tsconfig.json
npm run lint
```
