# Iteration 5 — AI Chat Answering Fix and Gemini Priority

## Problem fixed

The Ask AI page looked like a chat, but the assistant still behaved too much like a guided help card. Some direct questions, such as “How long does cucumber take to mature?”, were being answered with setup instructions instead of a direct farm answer.

This iteration changes the assistant behaviour so it answers the question first, then gives the workflow/page link afterwards.

## Main changes

### 1. Direct crop answers now work

The assistant now has built-in crop knowledge for common crops used in the app:

- Cucumber
- Tomato
- Bell pepper
- Scotch bonnet / atarodo
- Garden egg
- Sweet corn
- Plantain

Example question:

```text
How long does cucumber take to mature?
```

Expected answer:

```text
Cucumber is a fast crop. In warm Nigerian conditions, most cucumber varieties start harvesting around 40–55 days after planting...
```

Then it should give next actions such as adding the crop to Crop Catalog or opening Planting Planner.

### 2. Variety-aware crop guidance

The assistant now recognises examples like:

- Darina cucumber
- African Giant cucumber
- Cobra F1 tomato
- Scotch bonnet / atarodo

It gives a practical maturity range, then tells the user to save the variety in Crop Catalog so the app can calculate dates.

### 3. Pest and disease questions no longer get blocked

The assistant now answers practical farm questions such as:

- Best way to fight whiteflies
- What should I spray for pests?
- How do I control disease?
- How do I handle aphids/thrips/mites?

It gives safe general advice first, then links to Observations and Tasks.

### 4. Gemini key support expanded

The API route now checks more than one possible key name:

```text
GOOGLE_GENERATIVE_AI_API_KEY
GEMINI_API_KEY
GOOGLE_API_KEY
NEXT_PUBLIC_GEMINI_API_KEY
```

This matters because the app previously expected only one key name, so Gemini may not have been used even when a key had been added under another name.

### 5. Gemini prompt strengthened

The Gemini prompt now says:

- answer the user’s actual question directly first
- do not refuse normal farm questions
- answer general agronomy questions using safe practical knowledge
- use app records only for farm-specific numbers
- if records are missing, still answer the general part first, then direct the user to the correct page

### 6. Chat layout tightened

The Ask AI page now uses a more focused maximum-width chat panel and better message area behaviour so it feels less like scattered dashboard cards.

## Files changed

```text
src/lib/farm-os-agent.ts
src/app/api/agent/route.ts
src/components/FarmWorkspace.tsx
docs/iteration-5-ai-answer-fix-codex-handoff.md
```

## Codex checks to run

```bash
npm install
npx prisma generate
npm run lint
npm run build
```

If Prisma generation fails in Codex, check whether `DATABASE_URL` is set and regenerate Prisma using the correct schema.

## Manual UAT checks

1. Open Ask AI.
2. Ask: `How long does cucumber take to mature?`
   - It should answer directly with a cucumber maturity range.
3. Ask: `How long does African Giant cucumber take?`
   - It should give a variety-specific cucumber planning range.
4. Ask: `Best way to fight whiteflies.`
   - It should give practical whitefly advice and link to Observations/Tasks.
5. Ask: `How much will irrigation cost?`
   - If no plots exist, it should direct you to Farm Map.
   - If plots exist but no material prices exist, it should direct you to Irrigation.
   - If materials exist, it should show plot-specific cost estimates.
6. Ask: `Help me plant cucumber on Acre A.`
   - It should use saved crop/plot data if available.
   - If data is missing, it should tell you exactly what to add first.
7. Confirm Gemini badge shows when the server key is configured and the API works.

## Expected result

The AI assistant should now behave like the main farm helper, not just a pre-prepared help section. It should answer direct farming questions, use Gemini when available, and still guide the user to the exact page needed when records are missing.
