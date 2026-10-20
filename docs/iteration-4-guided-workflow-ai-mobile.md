# Iteration 4 — Guided Plot/Irrigation Workflow, Selectable Presets, AI Chat and Mobile Web Polish

## Goal

This iteration changes Farm OS from a set of forms into a more guided farm workflow. The user should not have to guess where to go next. The app now pushes the user through:

1. Set up a real plot/acre.
2. Add irrigation materials and real prices.
3. Build an irrigation plan for that specific plot.
4. Add/select crops from templates or custom entries.
5. Create planting plans that auto-calculate maturity/harvest dates.
6. Ask the AI assistant what to do next, including practical crop questions.

## Major changes

### 1. Nigerian farm-acre plot workflow

The Farm Map now explains the Nigerian farm-acre workflow:

- 300 × 100 ft = 30,000 sq ft
- 200 × 150 ft = 30,000 sq ft
- 30,000 sq ft ≈ 0.69 of a conventional 43,560 sq ft acre

The user can select presets:

- Nigerian farm acre / 300 × 100 ft
- Nigerian farm acre / 200 × 150 ft
- Half Nigerian farm acre / 150 × 100 ft
- Quarter Nigerian farm acre / 100 × 75 ft
- Custom measurement

The selected preset fills the length/width/unit fields, but the user can still edit the values.

### 2. Defined dashboard workflow

The dashboard now includes a visible “Use the app in this order” workflow:

1. Set up plot
2. Add irrigation materials
3. Create crop
4. Plan planting
5. Ask AI

Each workflow card opens the relevant page.

### 3. Irrigation workflow improvements

The irrigation page now has a clearer three-step structure:

1. Create/select a plot such as 300 × 100 ft.
2. Add materials: pump, well, tank, hose, drip lines, fittings, transport and labour.
3. Tick the exact material rows needed for that plot and create the plan.

Water source is now selectable/typeable using options such as:

- Well
- Borehole
- Water tank
- Stream/river
- Pond
- Rainwater harvesting
- Municipal supply
- Tanker delivery
- Other

Suppliers and units also use selectable/typeable inputs where useful.

### 4. Crop catalog templates

The crop catalog now provides selectable crop templates instead of forcing the user to type everything.

Included templates:

- Cucumber, with variety examples like African Giant, Darina, Greengo and Marketmore
- Tomato, with examples like Cobra F1, Roma VF, UC82B and Platinum
- Bell pepper
- Scotch bonnet pepper
- Garden egg
- Sweet corn
- Plantain

Each template pre-fills sensible defaults for:

- planting method
- nursery required
- nursery duration
- direct planting allowed
- water need
- irrigation recommendation
- days to harvest/maturity
- expected yield per acre
- market unit
- fertiliser stages
- pest risks
- care tasks
- notes

The user can edit everything before saving.

### 5. Crop profile becomes selectable across the app

Saved crop profiles are now easier to select/type in other places:

- Farm Map current crop
- Farm Map previous crop
- Planting Planner crop selection
- Seed records
- Task assignment
- Market prices
- Observations

The app uses a selectable/typeable field pattern so the user can pick an existing crop or type a new one when needed.

### 6. Planting planner auto-calculates dates

When creating a planting plan, the app now uses the selected crop profile to calculate dates when fields are left blank.

For nursery crops:

- Expected transplant date = nursery date + nursery duration days
- Expected harvest start = transplant date + maturity days
- Expected harvest end = harvest start + 14 days

For direct/sucker crops:

- Expected harvest start = planting date + maturity days
- Expected harvest end = harvest start + 14 days

The planting plan also records the market price unit, including kg and ton.

### 7. Market prices support kg and ton

Market price units now include:

- kg
- ton
- crate
- bag
- basket
- piece
- bunch

This allows the user to enter, for example, price per kg or price per ton and use that in planning assumptions.

### 8. AI assistant is now more dominant

The Ask AI page has been rebuilt as a proper guided chat area.

It now includes:

- Larger mobile-friendly chat box
- Auto-scroll to latest message
- Suggested prompt chips
- Action buttons inside AI responses
- Page navigation from AI responses
- Clear engine badge showing Gemini or built-in fallback
- Stronger guidance when records are missing

Example behaviours:

- If the user asks irrigation cost before adding plots, the AI says to create a plot first and gives a Farm Map button.
- If plots exist but materials do not, it directs the user to Irrigation.
- If the user asks about whiteflies, it gives practical IPM-style advice instead of saying it cannot answer.
- If the user asks how to start planting, it explains the workflow and links to Crop Catalog or Planting Planner.

### 9. Microphone speech-to-text

The AI chat now has a Speak button using the browser Web Speech API.

Expected behaviour:

- User taps Speak.
- Browser asks for microphone permission.
- User speaks a question.
- The transcript is sent to the AI assistant.

This works best in Chrome/Edge mobile browsers. If the browser does not support speech recognition, the app tells the user to type instead.

### 10. Gemini prompt improved

The Gemini API route now allows broader farming help while keeping farm-specific numbers grounded in verified records.

It can now answer:

- pest questions
- crop care questions
- nursery questions
- irrigation workflow questions
- setup questions

But it should not invent farm-specific numbers if the user has not entered the records.

## Files changed

- `src/components/FarmWorkspace.tsx`
- `src/lib/farm-os-types.ts`
- `src/lib/farm-os-agent.ts`
- `src/app/api/agent/route.ts`
- `docs/iteration-4-guided-workflow-ai-mobile.md`
- `docs/iteration-4-novice-step-by-step-guide.md`
- `docs/iteration-4-codex-handoff.md`

## Validation performed

Passed:

```bash
npx tsc --noEmit --project temporary-farm-os-only-tsconfig.json
npx tsc --noEmit --project temporary-agent-route-tsconfig.json
npm run lint
```

`npm run build` compiled the Next app successfully, then stopped at type-checking because Prisma Client could not be generated in this sandbox. The sandbox cannot reach `binaries.prisma.sh` to run `npx prisma generate`. Codex should run Prisma generation in its normal environment.
