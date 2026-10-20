import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { FarmOsData } from "@/lib/farm-os-types";
import { answerFarmQuestion } from "@/lib/farm-os-agent";
import { itemStock, itemReserved, moneyIn, moneyOut, netCashflow, procurementNeeds, receivables } from "@/lib/farm-os-calculations";

export const dynamic = "force-dynamic";

// Gemini is the primary brain. Try three Gemini models in order before ever
// falling back to the built-in rules assistant. Resilient to a model retirement.
const MODELS = [...new Set(
  [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-001"].filter(Boolean) as string[]
)];

const APP_GUIDE = `WHAT DINOTINTO FARM OS IS
A web/mobile app for a Nigerian vegetable/crop farm to record everything (land, irrigation, labour, crops, costs, sales) and get calculations, recommendations and AI help. Records save automatically to the cloud database with the browser as offline backup. There is no demo data — the farmer enters their own.

RECOMMENDED ORDER OF USE
1) Farm Map: add plots/acres  ->  2) Irrigation: add materials + per-plot plan  ->  3) Crop Catalog: add crops  ->  4) Inventory: add seeds/fertilizer/crop protection stock  ->  5) Planting Planner: plan crop on a plot (draws from inventory)  ->  6) Tasks, Workers, Salary as work happens  ->  7) Sales & Accounts: record sales and see money in vs out  ->  8) Market Prices, Observations  ->  9) Dashboard, Advisor & Reports to review.

NIGERIAN ACRE MATH: a 300x100 ft or 200x150 ft plot = 30,000 sq ft ~= 0.69 conventional acre. Area and equivalent acres are auto-calculated from length x width.

SCREENS (tell the user the exact screen to open when relevant):
- Dashboard: headline numbers, alerts, recommended workflow, and "Clear all records and start fresh".
- Farm Advisor: prioritised recommendations + best-plot-for-a-crop picker + Photo Advisor (upload/take a photo of a crop, plot or produce → AI diagnoses and proposes plot-scoped tasks/observations). On mobile every Advisor panel is collapsible — tap a header to open it.
- Ask AI: this assistant (chat, suggested questions, voice input).
- Farm Map: add/edit/delete plots; fields = name, code, length/width + unit, irrigation status, land status (ready/bushy/needs clearing/etc.), current & previous crop, soil notes, rain-fed suitability.
- Irrigation: add materials from templates (pump, tank, drip lines, hose, labour, etc.) or custom, with quantity/unit/cost/supplier/reusable; pick water source (well, borehole, tank, stream, pond); build a per-plot plan, tick the exact materials, and it calculates setup cost (leave cost blank to auto-calc).
- Land Clearing: compare manual vs chemical vs mechanical vs combined clearing cost/time per plot.
- Crop Catalog: crop profiles (planting method, nursery days, maturity days, water need, expected yield/acre, market unit, pests, care tasks). Templates: cucumber, tomato, bell pepper, scotch bonnet, garden egg, sweet corn, plantain.
- Planting Planner: "Generate a plan with AI" or "Create a plan manually" (both behind +Add buttons). Choose crop + variety (Nigerian variety dropdown) + plot; pick the inputs the plan draws from inventory; auto-fills transplant/harvest dates; shows warnings, stock shortfalls and profit forecast. Each saved plan: Mark Active / Harvest Done / Cancel, and "Enhance with AI" to fill/robustify it.
- Inventory: single source of truth for stock. Grouped items (seeds, fertilizer, crop protection, other) each show current quantity = stock added minus stock used. Add stock (bought/gift/own) and record usage (where it went); quantity can't go below zero.
- Sales & Accounts: record sales (money in) and non-stock expenses; account book shows real money in vs out, net profit/loss so far, receivables, and actual vs forecast profit per crop.
- Tasks: create/assign jobs to workers (clearing, spraying, weeding, harvesting...), with due date, priority, status, cost.
- Workers: add/edit/delete workers (role, employment type, pay rate, status, skills) + quick labour payments.
- Salary & Payroll: attendance/days worked, bonuses/deductions/advances, salary runs with net pay & balance.
- Market Prices: record selling prices (kg, ton, crate, bag, basket, piece, bunch).
- Yield Forecast: expected yield, marketable yield, best/worst-case revenue.
- Observations: log pests, disease, weather, delays with severity and yield/cost impact (these adjust forecasts); can attach a photo.
- Calendar: month grid of every dated record — task due dates, nursery/planting/transplant/harvest milestones, salary pay dates. Tap a day to see its events in a popover.
- Messages: team chat between farm users (Owner, Manager, Marketer and future workers). Inbox with unread counts, threads, read receipts, and new-message notifications.
- Reports: land status, irrigation coverage, crop profit, labour, attendance, cost per plot/worker/category, market, tasks. Each report has a CSV download; the page has Print / Save as PDF.
GENERAL: on mobile, big "Add" forms are behind +Add buttons, record lists collapse to compact cards (tap to expand), long lists show first few with "Show all", and dashboard/advisor panels collapse to tappable headers. Per-worker monthly feeding cost lives on the Workers page.`;

function compactFarm(data: FarmOsData) {
  const n = (arr?: unknown[]) => (Array.isArray(arr) ? arr.length : 0);
  return {
    counts: {
      plots: n(data.plots),
      crops: n(data.cropProfiles),
      plantingPlans: n(data.plantingPlans),
      workers: n(data.workers),
      tasks: n(data.tasks),
      irrigationMaterials: n(data.irrigationMaterials),
      inventoryItems: n(data.inventoryItems),
      expenses: n(data.inputCosts),
      sales: n(data.sales),
      observations: n(data.observations)
    },
    account: {
      moneyIn: moneyIn(data),
      moneyOut: moneyOut(data),
      netSoFar: netCashflow(data),
      owedToFarm: receivables(data)
    },
    inventory: (data.inventoryItems || []).map((item) => ({
      name: item.name,
      group: item.group,
      stock: itemStock(data, item.id),
      unit: item.unit,
      reserved: itemReserved(data, item.id),
      unitCost: item.lastUnitCost || null
    })),
    procurement: procurementNeeds(data).map((need) => ({ item: need.item.name, shortfall: need.shortfall, unit: need.item.unit, estCost: need.estCost })),
    plots: (data.plots || []).map((p) => ({
      code: p.plotCode,
      name: p.plotName,
      acres: p.equivalentAcres,
      irrigated: p.irrigated,
      land: p.landStatus,
      crop: p.currentCrop
    })),
    workers: (data.workers || []).map((w) => ({ name: w.name, role: w.role, status: w.status })),
    crops: (data.cropProfiles || []).map((c) => ({
      name: c.cropName,
      nurseryDays: c.nurseryDurationDays,
      maturityDays: c.expectedDurationToHarvestDays,
      waterNeed: c.waterNeed,
      marketUnit: c.marketUnit
    })),
    // Planting plans with which key fields are already filled vs missing, so the
    // assistant can answer "what else have I not filled in for my X plan".
    plantingPlans: (data.plantingPlans || []).map((p) => {
      const plot = (data.plots || []).find((x) => x.id === p.plotId);
      return {
        crop: p.cropName,
        variety: p.variety || null,
        plot: plot ? plot.plotCode : null,
        status: p.status,
        hasSeedCost: !!p.seedCost,
        hasFertilizerBudget: !!p.fertilizerBudget,
        hasLaborBudget: !!p.laborBudget,
        hasIrrigationBudget: !!p.irrigationBudget,
        hasExpectedYield: !!(p.expectedYieldPerAcre || p.expectedTotalYield),
        hasMarketPrice: !!p.expectedMarketPrice,
        plannedPlantingDate: p.plannedPlantingDate || null,
        warnings: p.warnings || []
      };
    }),
    marketPrices: (data.marketPrices || []).map((m) => ({ crop: m.cropName, price: m.price, unit: m.unit })),
    inputsByCategory: (data.inputCosts || []).reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + Number(i.totalCost || 0);
      return acc;
    }, {}),
    openTasks: (data.tasks || [])
      .filter((t) => t.status !== "completed" && t.status !== "cancelled")
      .map((t) => ({ title: t.taskTitle, type: t.taskType, crop: t.cropName || null, due: t.dueDate }))
  };
}

// Structured output: a reply plus optional actions the app can actually perform.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["create_task", "record_observation", "create_planting_plan", "add_worker", "log_attendance", "update_plot_status", "edit_plan"] },
          taskTitle: { type: "string" },
          landStatus: { type: "string" },
          irrigationStatus: { type: "string" },
          planStatus: { type: "string" },
          plannedPlantingDate: { type: "string" },
          expectedTransplantDate: { type: "string" },
          expectedHarvestStartDate: { type: "string" },
          expectedHarvestEndDate: { type: "string" },
          expectedTotalYield: { type: "number" },
          appendNote: { type: "string" },
          taskType: { type: "string" },
          observationType: { type: "string" },
          cropName: { type: "string" },
          variety: { type: "string" },
          plotCode: { type: "string" },
          workerName: { type: "string" },
          priority: { type: "string" },
          severity: { type: "string" },
          dueInDays: { type: "number" },
          // create_planting_plan
          seedCount: { type: "number" },
          marketPrice: { type: "number" },
          // add_worker
          employmentType: { type: "string" },
          dailyRate: { type: "number" },
          phone: { type: "string" },
          // log_attendance
          attendanceStatus: { type: "string" },
          notes: { type: "string" }
        },
        required: ["type"]
      }
    }
  },
  required: ["reply"]
};

async function callGemini(model: string, key: string, prompt: string, structured: boolean) {
  // Disable "thinking" so the token budget goes to the answer (prevents truncation),
  // and give enough room for a multi-step plan.
  const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } };
  if (structured) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = RESPONSE_SCHEMA;
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig })
    }
  );
  if (!res.ok) return { ok: false as const, status: res.status };
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text)
    .join("")
    .trim();
  if (!text) return { ok: false as const, status: 0 };
  if (!structured) {
    return { ok: true as const, text, operations: [] as ReturnType<typeof sanitizeOperation>[] };
  }
  try {
    const parsed = JSON.parse(text) as { reply?: string; operations?: unknown[] };
    if (!parsed?.reply) return { ok: false as const, status: 0 };
    const raw = Array.isArray(parsed.operations) ? parsed.operations.slice(0, 5) : [];
    return { ok: true as const, text: parsed.reply.trim(), operations: raw.map(sanitizeOperation).filter(Boolean) };
  } catch {
    return { ok: false as const, status: 0 };
  }
}

// Defensive: keep only known fields and plain values, so a malformed model
// response can never inject junk into the app's records.
function cleanStr(v: unknown, max = 120) {
  if (typeof v !== "string") return undefined;
  // Cut at the first character that signals the model leaked structure.
  const s = v.split(/['"{}[\]]/)[0].trim();
  return s ? s.slice(0, max) : undefined;
}

const OP_TYPES = ["record_observation", "create_task", "create_planting_plan", "add_worker", "log_attendance", "update_plot_status", "edit_plan"];
function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function sanitizeOperation(op: unknown) {
  if (!op || typeof op !== "object") return null;
  const o = op as Record<string, unknown>;
  const type = OP_TYPES.includes(o.type as string) ? (o.type as string) : null;
  if (!type) return null;
  const due = Number(o.dueInDays);
  return {
    type,
    taskTitle: cleanStr(o.taskTitle),
    taskType: cleanStr(o.taskType),
    observationType: cleanStr(o.observationType),
    cropName: cleanStr(o.cropName),
    variety: cleanStr(o.variety),
    plotCode: cleanStr(o.plotCode),
    workerName: cleanStr(o.workerName),
    priority: cleanStr(o.priority),
    severity: cleanStr(o.severity),
    dueInDays: Number.isFinite(due) ? Math.max(0, Math.round(due)) : undefined,
    seedCount: num(o.seedCount),
    marketPrice: num(o.marketPrice),
    employmentType: cleanStr(o.employmentType),
    dailyRate: num(o.dailyRate),
    phone: cleanStr(o.phone, 30),
    attendanceStatus: cleanStr(o.attendanceStatus),
    landStatus: cleanStr(o.landStatus),
    irrigationStatus: cleanStr(o.irrigationStatus),
    planStatus: cleanStr(o.planStatus),
    plannedPlantingDate: cleanStr(o.plannedPlantingDate, 12),
    expectedTransplantDate: cleanStr(o.expectedTransplantDate, 12),
    expectedHarvestStartDate: cleanStr(o.expectedHarvestStartDate, 12),
    expectedHarvestEndDate: cleanStr(o.expectedHarvestEndDate, 12),
    expectedTotalYield: num(o.expectedTotalYield),
    appendNote: cleanStr(o.appendNote, 300),
    notes: cleanStr(o.notes, 300)
  };
}

type ChatMessage = { role: "user" | "assistant"; text: string };

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: { data?: FarmOsData; question?: string; history?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const data = (body.data || {}) as FarmOsData;
  const question = (body.question || "").trim();
  const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
  if (!question) return NextResponse.json({ ok: false, error: "Missing question" }, { status: 400 });

  // Deterministic rules engine first — provides grounded farm numbers. Wrapped so a
  // partial/odd payload can never crash the whole assistant route.
  let facts: ReturnType<typeof answerFarmQuestion>;
  try {
    facts = answerFarmQuestion(data, question);
  } catch {
    facts = { answer: "", bullets: [], actions: [], source: "rules" };
  }
  // NOTE: a valid Google API key may start with "AQ." (newer format) or "AIza"
  // (older format). Both are accepted as-is — do NOT treat an "AQ."-prefixed key
  // as malformed. The current production key is "AQ." and is verified working.
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!key) {
    return NextResponse.json({ answer: facts.answer, bullets: facts.bullets || [], actions: facts.actions || [], source: "rules", reason: "no_key" });
  }

  const factText = [facts.answer, ...(facts.bullets || []).map((b) => `- ${b}`)].join("\n");

  const intro = [
    "You are the AI assistant built into Dinotinto Farm OS, a farm management web app used by a vegetable/crop farm in Nigeria (currency Naira, NGN).",
    "Two jobs: (1) answer the user's actual farming question helpfully and directly, and (2) guide them to the right screen in the app.",
    "",
    "ANSWERING RULES:",
    "- Always answer the real question first in plain, practical English. Do NOT just tell the user to go set up data.",
    "- For general agronomy (pests like whiteflies, disease, spraying, crop care, maturity, varieties, nursery, irrigation method, fertiliser timing) use sound practical knowledge for Nigerian conditions. You MAY name common product types/active ingredients/brands sold in Nigeria, with a reminder to confirm local availability, read the label, wear PPE and respect pre-harvest intervals.",
    "- For anything specific to THIS farm (their plots, plans, costs, workers, saved records, what is filled in or missing), READ the FARM SNAPSHOT carefully and use it. Never invent the farm's own figures. The snapshot shows each planting plan and which fields are already filled (hasSeedCost, hasMarketPrice, etc.) — use that to tell the user exactly what is still missing.",
    "- Resolve references from the CONVERSATION SO FAR (e.g. 'do it', 'the garden egg plan', 'on plot A'). Do not ask for details that are already in the snapshot or the conversation.",
    "- If the farm has not set up needed data, answer the general question anyway, then point to the exact screen using the APP GUIDE.",
    "- You can BUILD ACTION PLANS on request (insect/pest-fighting plan, spraying schedule, planting plan, irrigation setup, weekly worker plan) using the farm's actual crops, plots and observations. Lay it out as clear numbered steps.",
    "- For app/how-to questions answer using the APP GUIDE with the exact screen and steps.",
    "- Be concise for simple questions (2-7 sentences); a short numbered list for a plan. No markdown headings."
  ];

  const actionRules = [
    "",
    "PERFORMING ACTIONS (very important):",
    "- When the user asks you to CREATE, ADD, SCHEDULE or RECORD something (e.g. 'create a spray task', 'do it', 'fill in what's missing'), DO IT by returning entries in the 'operations' array — do NOT just tell them to open a screen.",
    "- create_task fields: taskTitle, taskType (clearing, nursery_work, planting, transplanting, watering, fertilizer, spraying, weeding, harvesting, packing, transport, irrigation_repair, inspection, market_survey, other), cropName, plotCode, workerName, priority (low/medium/high/urgent), dueInDays (integer), notes.",
    "- record_observation fields: observationType (e.g. pest_attack, disease), cropName, plotCode, severity (low/medium/high/critical), notes.",
    "- create_planting_plan fields: cropName (must match a crop in the FARM SNAPSHOT crops list), variety, plotCode (must match a plot), dueInDays (days until planting, integer), seedCount (number of seeds/seedlings), marketPrice (expected price per market unit), notes. Use this when the user says e.g. 'plan tomato on Plot A' or 'create a planting plan for cucumber'. Harvest/transplant dates and yields are auto-calculated from the crop profile — do not invent them.",
    "- add_worker fields: workerName (the person's name), employmentType (daily_worker, weekly_worker, monthly_worker, contractor), dailyRate (their pay rate as a number), phone, notes. Use when the user says e.g. 'add a worker called Musa at 5000 a day'.",
    "- log_attendance fields: workerName (must match an existing worker), attendanceStatus (present, half_day, absent, sick, approved_leave), dueInDays (0 = today, use 0 unless the user says otherwise), plotCode, notes. Use when the user says e.g. 'mark Musa present today'.",
    "- update_plot_status fields: plotCode (which plot), landStatus (one of ready, bushy, planted, fallow, waterlogged, needs_clearing, recently_cleared, needs_herbicide, needs_manual_labor, needs_ploughing, needs_ridging, needs_manure, too_dry, under_cultivation) and/or irrigationStatus (none, planned, partial, active, needs_repair, not_required), notes. Use this when something about a PLOT changes — e.g. the user says a plot is now waterlogged/cleared/bushy, or you diagnose a condition that should change the plot's status. Always set plotCode.",
    "- edit_plan fields: plotCode and cropName to find the existing plan, plus ONLY the fields to change — planStatus (draft/approved/active/completed/cancelled), plannedPlantingDate, expectedTransplantDate, expectedHarvestStartDate, expectedHarvestEndDate (all YYYY-MM-DD), marketPrice (number), expectedTotalYield (number), variety, and appendNote (a short dated note appended to the plan, NOT a full rewrite). Use this to revise an EXISTING plan — e.g. push the harvest window when a crop is behind, update the market price, change status, or attach a finding. Do not invent values; only set what genuinely changed. Always set plotCode (and cropName if more than one plan could match).",
    "REFINING PROPOSED ACTIONS: if the conversation shows you already proposed actions and the user replies to apply them with an exclusion or tweak (e.g. 'yes do it but leave the harvest date', 'ok but don't change the price', 'do it except the second task'), RE-EMIT the same operations MINUS the excluded field/operation, or with the requested tweak. Drop only what they asked to leave; keep the rest. Never re-apply a field the user said to leave unchanged.",
    "- Each operation is ONE complete object with all its fields. Do NOT split one record across objects. Multiple operations only for genuinely separate tasks (max 5).",
    "- Every field value is a plain string or number. Never put JSON, braces, quotes or field names inside a value.",
    "- Fill plotCode/workerName by matching the FARM SNAPSHOT, and use the conversation for context (e.g. plan on Plot A).",
    "- If the user's message is an imperative to create/add/schedule/record, you MUST return at least one matching operation.",
    "- For 'do it' / 'create the tasks I need' / 'set it up' about a crop plan, emit one create_task per step (max 5) as operations, not just prose. A typical vegetable plan (pepper/tomato/garden egg/cucumber) is: nursery_work, transplanting, fertilizer, weeding, harvesting — each with cropName and plotCode taken from the conversation/snapshot and sensible dueInDays (e.g. 0, 21, 35, 50, 75).",
    "- WATERING is a daily/near-daily routine, NOT a one-off or fortnightly task. Vegetables generally need water every day or every 2-3 days (more in hot/dry weather, less after rain). Never tell the user to water 'once in two weeks'. If asked about watering, describe it as an ongoing routine; only create a watering task as a single standing reminder (dueInDays 0) whose notes say it is a continuous routine — and skip it entirely if the plot is irrigated."
  ];

  const tail = [
    "",
    "APP GUIDE:",
    APP_GUIDE,
    "",
    "VERIFIED FACTS (computed from live data; may be generic or empty — ignore unless it has concrete numbers/records for this question):",
    factText,
    "",
    "FARM SNAPSHOT (JSON):",
    JSON.stringify(compactFarm(data)),
    "",
    history.length
      ? "CONVERSATION SO FAR (resolve follow-ups like 'do it' or 'give me a brand name' using this context):\n" +
        history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n")
      : "",
    "",
    `USER QUESTION: ${question}`
  ];

  const promptStructured = [...intro, ...actionRules, ...tail].join("\n");
  const promptPlain = [...intro, ...tail].join("\n");

  let lastStatus = 0;

  // Pass 1: structured output (can include operations the app will perform).
  for (const model of MODELS) {
    try {
      const out = await callGemini(model, key, promptStructured, true);
      if (out.ok) {
        return NextResponse.json({ answer: out.text, bullets: [], actions: [], operations: out.operations || [], source: "gemini", model });
      }
      lastStatus = out.status;
    } catch {
      // try next model
    }
  }

  // Pass 2: plain-text Gemini (no schema). Keeps Gemini's quality + context even
  // when structured JSON hiccups, instead of dropping to the basic rules engine.
  for (const model of MODELS) {
    try {
      const out = await callGemini(model, key, promptPlain, false);
      if (out.ok) {
        return NextResponse.json({ answer: out.text, bullets: [], actions: [], operations: [], source: "gemini", model });
      }
      lastStatus = out.status;
    } catch {
      // try next model
    }
  }

  // Only if Gemini is completely unreachable -> rules engine, kept clean (no noisy
  // insight bullets/actions that the user disliked).
  return NextResponse.json({ answer: facts.answer, bullets: [], actions: [], operations: [], source: "rules", reason: `gemini_failed_${lastStatus}` });
}
