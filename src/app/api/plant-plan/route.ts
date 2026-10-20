import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MODELS = [...new Set(
  [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-001"].filter(Boolean) as string[]
)];

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    varietyNote: { type: "string" },
    transplantInDays: { type: "number" },
    harvestStartInDays: { type: "number" },
    harvestEndInDays: { type: "number" },
    expectedYield: { type: "number" },
    yieldUnit: { type: "string" },
    expectedRevenue: { type: "number" },
    fertilizerPlan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stage: { type: "string" },
          product: { type: "string" },
          quantity: { type: "string" },
          timing: { type: "string" }
        },
        required: ["stage", "product"]
      }
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          taskType: { type: "string" },
          dayOffset: { type: "number" },
          notes: { type: "string" }
        },
        required: ["title", "taskType", "dayOffset"]
      }
    }
  },
  required: ["summary", "tasks"]
};

type PlanInput = {
  crop?: { name?: string; variety?: string; nurseryRequired?: boolean; nurseryDays?: number; maturityDays?: number; waterNeed?: string; marketUnit?: string; pestRisks?: string[]; expectedYieldPerAcre?: number; expectedYieldPerPlant?: number };
  plot?: { code?: string; acres?: number; irrigated?: boolean };
  plantingDate?: string;
  nurseryDate?: string;
  seedCount?: number;
  expectedYieldFromSeeds?: number;
  fertilizers?: { name?: string; category?: string; nutrientFocus?: string; quantityAvailable?: number; unit?: string; totalCost?: number; preferredStage?: string }[];
  fertilizerCost?: number;
  protection?: { name?: string; category?: string; target?: string }[];
  marketPrice?: number;
  marketUnit?: string;
};

const TASK_TYPES = ["clearing", "nursery_work", "planting", "transplanting", "watering", "fertilizer", "spraying", "weeding", "harvesting", "packing", "transport", "irrigation_repair", "inspection", "market_survey", "other"];

function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Deterministic plan from the crop profile — always works without an API key.
function fallbackPlan(input: PlanInput) {
  const crop = input.crop || {};
  const acres = num(input.plot?.acres) || 1;
  const nurseryDays = num(crop.nurseryDays);
  const maturity = num(crop.maturityDays) || 90;
  const transplant = crop.nurseryRequired ? nurseryDays : 0;
  const harvestStart = transplant + maturity;
  const yieldPerAcre = num(crop.expectedYieldPerAcre);
  const yieldPerPlant = num(crop.expectedYieldPerPlant);
  const seedYield = num(input.expectedYieldFromSeeds) || (num(input.seedCount) && yieldPerPlant ? num(input.seedCount) * yieldPerPlant : 0);
  const expectedYield = seedYield ? Math.round(seedYield) : yieldPerAcre ? Math.round(yieldPerAcre * acres) : 0;
  const price = num(input.marketPrice);
  const fertilizers = Array.isArray(input.fertilizers) ? input.fertilizers.filter((item) => item.name) : [];
  const tasks: { title: string; taskType: string; dayOffset: number; notes: string }[] = [];
  if (crop.nurseryRequired) {
    tasks.push({ title: `Prepare nursery for ${crop.name || "crop"}`, taskType: "nursery_work", dayOffset: 0, notes: "Sow seeds, water and shade the nursery." });
    tasks.push({ title: "Transplant seedlings", taskType: "transplanting", dayOffset: transplant, notes: "Harden seedlings before transplanting; water the plot first." });
  } else {
    tasks.push({ title: `Direct sow ${crop.name || "crop"}`, taskType: "planting", dayOffset: 0, notes: "Plant at correct spacing on prepared beds/ridges." });
  }
  // Watering is an ongoing routine, not a one-off. For irrigated plots it's
  // automatic; for rain-fed plots add a single standing reminder, not a schedule.
  const wantsWater = crop.waterNeed === "high" ? "every day (twice on hot dry days)" : crop.waterNeed === "low" ? "every 2-3 days, less after rain" : "daily or every other day";
  if (!input.plot?.irrigated) {
    tasks.push({ title: "Watering routine (ongoing)", taskType: "watering", dayOffset: transplant, notes: `Water ${wantsWater}. This is a continuous daily/near-daily routine through the cycle — adjust to rainfall and heat, not a once-in-a-while task.` });
  }
  const firstFertilizer = fertilizers[0]?.name || "selected fertilizer";
  const secondFertilizer = fertilizers[1]?.name || fertilizers[0]?.name || "selected fertilizer";
  tasks.push({ title: "First fertilizer application", taskType: "fertilizer", dayOffset: transplant + 14, notes: fertilizers.length ? `Use ${firstFertilizer} from your fertilizer base after establishment.` : "Select fertilizer records in Inputs so the plan can use your own stock." });
  const protection = Array.isArray(input.protection) ? input.protection.filter((item) => item.name) : [];
  const herbicide = protection.find((p) => p.category === "herbicide");
  const sprays = protection.filter((p) => p.category !== "herbicide");
  tasks.push({ title: "Weeding", taskType: "weeding", dayOffset: transplant + 21, notes: herbicide ? `Hand-weed, or apply ${herbicide.name} carefully per label if needed.` : "Keep the plot weed-free during early growth." });
  tasks.push({ title: "Pest scouting / spray if needed", taskType: "spraying", dayOffset: transplant + 30, notes: sprays.length ? `Scout first; if pressure builds use ${sprays.map((p) => p.name).join(" or ")} (rotate groups), follow label/PPE/harvest interval.` : "Scout for pests; spray only when pressure builds, follow label/PPE." });
  tasks.push({ title: "Second fertilizer / top dressing", taskType: "fertilizer", dayOffset: transplant + 40, notes: fertilizers.length ? `Use ${secondFertilizer} only if it matches the crop stage and label guidance.` : "Add a potassium/top-dressing fertilizer to your fertilizer base before final approval." });
  tasks.push({ title: `Harvest ${crop.name || "crop"}`, taskType: "harvesting", dayOffset: harvestStart, notes: "Harvest at maturity; repeat picking for fruiting crops." });
  const variety = (crop.variety || "").trim();
  const varietyNote = variety
    ? `Targeted to ${variety} (${crop.name || "crop"}). Timing and yield follow this variety's norms in Nigeria; confirm the exact maturity days on your seed pack, as F1 hybrids and local types differ. Tip: keep records of how this variety performs so future plans get more accurate.`
    : `No specific variety set for ${crop.name || "this crop"}. Choosing a known Nigerian variety (e.g. an F1 hybrid for higher, more uniform yield, or a hardy local type for resilience) lets the plan target real maturity and yield numbers.`;
  return {
    summary: `${crop.name || "Crop"}${variety ? ` (${variety})` : ""} plan over about ${harvestStart} days on ${input.plot?.code || "the plot"} (${acres.toFixed(2)} acres). Dates and tasks are based on the saved crop profile.`,
    varietyNote,
    transplantInDays: transplant,
    harvestStartInDays: harvestStart,
    harvestEndInDays: harvestStart + 21,
    expectedYield,
    yieldUnit: crop.marketUnit || "kg",
    expectedRevenue: expectedYield && price ? Math.round(expectedYield * price) : 0,
    fertilizerPlan: fertilizers.length ? fertilizers.map((item, index) => ({
      stage: item.preferredStage || (index === 0 ? "Establishment" : "Fruiting/top dressing"),
      product: item.name || "Selected fertilizer",
      quantity: `${item.quantityAvailable || 0} ${item.unit || "unit"} available`,
      timing: index === 0 ? `~${transplant + 14} days` : `~${transplant + 40} days`
    })).slice(0, 4) : [
      { stage: "Fertilizer base missing", product: "Add fertilizer records in Inputs", quantity: "Use your actual stock/cost records", timing: "Before approving the plan" }
    ],
    tasks,
    source: "rules" as const
  };
}

function sanitize(plan: Record<string, unknown>, input: PlanInput) {
  const seededYield = num(input.expectedYieldFromSeeds) || (num(input.seedCount) && num(input.crop?.expectedYieldPerPlant) ? num(input.seedCount) * num(input.crop?.expectedYieldPerPlant) : 0);
  const expectedYield = seededYield ? Math.round(seededYield) : Math.max(0, Math.round(num(plan.expectedYield)));
  const expectedRevenue = expectedYield && num(input.marketPrice) ? Math.round(expectedYield * num(input.marketPrice)) : Math.max(0, Math.round(num(plan.expectedRevenue)));
  const allowedFertilizerNames = new Set((input.fertilizers || []).map((item) => String(item.name || "").toLowerCase()).filter(Boolean));
  const tasksRaw = Array.isArray(plan.tasks) ? plan.tasks : [];
  const tasks = tasksRaw.slice(0, 12).map((t) => {
    const o = (t || {}) as Record<string, unknown>;
    const type = typeof o.taskType === "string" && TASK_TYPES.includes(o.taskType) ? o.taskType : "other";
    return {
      title: String(o.title || "Task").slice(0, 120),
      taskType: type,
      dayOffset: Math.max(0, Math.round(num(o.dayOffset))),
      notes: String(o.notes || "").slice(0, 300)
    };
  }).filter((t) => t.title);
  const fpRaw = Array.isArray(plan.fertilizerPlan) ? plan.fertilizerPlan : [];
  const fertilizerPlan = fpRaw.slice(0, 8).map((f) => {
    const o = (f || {}) as Record<string, unknown>;
    return {
      stage: String(o.stage || "").slice(0, 80),
      product: String(o.product || "").slice(0, 120),
      quantity: String(o.quantity || "").slice(0, 80),
      timing: String(o.timing || "").slice(0, 80)
    };
  }).filter((f) => f.product && (!allowedFertilizerNames.size || allowedFertilizerNames.has(f.product.toLowerCase())));
  return {
    summary: String(plan.summary || "").slice(0, 600) || fallbackPlan(input).summary,
    varietyNote: String(plan.varietyNote || "").slice(0, 600) || undefined,
    transplantInDays: Math.max(0, Math.round(num(plan.transplantInDays))),
    harvestStartInDays: Math.max(0, Math.round(num(plan.harvestStartInDays))),
    harvestEndInDays: Math.max(0, Math.round(num(plan.harvestEndInDays))),
    expectedYield,
    yieldUnit: String(plan.yieldUnit || input.crop?.marketUnit || "kg").slice(0, 20),
    expectedRevenue,
    fertilizerPlan: fertilizerPlan.length ? fertilizerPlan : fallbackPlan(input).fertilizerPlan,
    tasks: tasks.length ? tasks : fallbackPlan(input).tasks,
    source: "gemini" as const
  };
}

async function callGemini(model: string, key: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 2600, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } } })
  });
  if (!res.ok) return null;
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("").trim();
  if (!text) return null;
  try { return JSON.parse(text) as Record<string, unknown>; } catch { return null; }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let input: PlanInput;
  try { input = (await request.json()) as PlanInput; } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (key) {
    const prompt = [
      "You are an agronomist assistant for a Nigerian vegetable/crop farm. Produce a complete, practical crop plan as JSON.",
      "Base everything on the crop and plot details provided. dayOffset is the number of days AFTER the start date (nursery date if the crop uses a nursery, else the planting date).",
      "VARIETY/SPECIES: if INPUT.crop.variety is given, TARGET the whole plan to that specific variety as grown in Nigeria — use its real maturity days, nursery duration, spacing, yield potential, disease/heat tolerance and typical market behaviour (these can differ a lot from the generic crop). Adjust transplantInDays, harvestStartInDays, harvestEndInDays and expectedYield to that variety. Also fill 'varietyNote': 2-4 sentences explaining this specific variety to the farmer — its key traits, why timing/yield differ, and one practical tip. If no variety is given, base it on the generic crop and set varietyNote to a short note suggesting common Nigerian varieties for this crop.",
      "tasks: the full schedule from nursery/planting to harvest — nursery prep, transplanting, each fertilizer application, weeding, pest scouting/spraying, and harvest. taskType must be one of: " + TASK_TYPES.join(", ") + ".",
      "WATERING: do NOT schedule watering as a single one-off task or as an occasional (e.g. fortnightly) task. Watering is a daily/near-daily routine: vegetables generally need water every day or every 2-3 days, more in dry/hot weather and on sandy soil, less right after rain. If the plot is NOT irrigated, include at most ONE early 'watering' task at day 0 whose notes state it is an ONGOING daily/near-daily routine (adjust to rainfall) — not a recurring scheduled task. If the plot IS irrigated, mention the watering routine in the summary instead of creating watering tasks. Never imply watering happens only every two weeks.",
      "fertilizerPlan: the fertiliser/manure programme — stage, product (name common Nigerian products/NPK ratios), quantity (scale to the plot acreage), and timing.",
      "expectedYield: estimate from the seed/seedling count and acreage and crop norms; expectedRevenue = expectedYield * market price when a price is given. yieldUnit from the crop's market unit.",
      "Important: fertilizerPlan must use only fertilizer names supplied in INPUT.fertilizers, and expectedYield must use INPUT.expectedYieldFromSeeds when that value is present.",
      "If INPUT.protection has products, include scouting + spray/weeding tasks that name ONLY those products (match category: herbicide for weeds, insecticide/miticide for pests, fungicide for disease), with a reminder to rotate groups and follow label/PPE/pre-harvest interval. Do not invent other agrochemicals.",
      "Keep it realistic and concise.",
      "",
      "INPUT (JSON): " + JSON.stringify(input)
    ].join("\n");
    for (const model of MODELS) {
      try {
        const out = await callGemini(model, key, prompt);
        if (out) return NextResponse.json(sanitize(out, input));
      } catch {
        // try next model
      }
    }
  }
  return NextResponse.json(fallbackPlan(input));
}
