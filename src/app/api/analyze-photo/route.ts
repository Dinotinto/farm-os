import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MODELS = [...new Set(
  [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-001"].filter(Boolean) as string[]
)];

// Operations the photo advisor can propose — same shape the app already applies
// from Ask AI, so the client can reuse applyAiOperation.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    analysis: { type: "string" },
    severity: { type: "string" }, // overall: low | medium | high | critical
    operations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["create_task", "record_observation", "update_plot_status", "edit_plan"] },
          taskTitle: { type: "string" },
          taskType: { type: "string" },
          observationType: { type: "string" },
          cropName: { type: "string" },
          plotCode: { type: "string" },
          priority: { type: "string" },
          severity: { type: "string" },
          dueInDays: { type: "number" },
          landStatus: { type: "string" },
          irrigationStatus: { type: "string" },
          planStatus: { type: "string" },
          expectedHarvestStartDate: { type: "string" },
          expectedHarvestEndDate: { type: "string" },
          expectedTotalYield: { type: "number" },
          appendNote: { type: "string" },
          notes: { type: "string" }
        },
        required: ["type"]
      }
    }
  },
  required: ["analysis"]
};

function cleanStr(v: unknown, max = 200) {
  if (typeof v !== "string") return undefined;
  const s = v.split(/['"{}[\]]/)[0].trim();
  return s ? s.slice(0, max) : undefined;
}
function sanitizeOperation(op: unknown) {
  if (!op || typeof op !== "object") return null;
  const o = op as Record<string, unknown>;
  const type = ["record_observation", "create_task", "update_plot_status", "edit_plan"].includes(o.type as string) ? (o.type as string) : null;
  if (!type) return null;
  const due = Number(o.dueInDays);
  const yld = Number(o.expectedTotalYield);
  return {
    type,
    taskTitle: cleanStr(o.taskTitle),
    taskType: cleanStr(o.taskType),
    observationType: cleanStr(o.observationType),
    cropName: cleanStr(o.cropName),
    plotCode: cleanStr(o.plotCode),
    priority: cleanStr(o.priority),
    severity: cleanStr(o.severity),
    dueInDays: Number.isFinite(due) ? Math.max(0, Math.round(due)) : undefined,
    landStatus: cleanStr(o.landStatus),
    irrigationStatus: cleanStr(o.irrigationStatus),
    planStatus: cleanStr(o.planStatus),
    expectedHarvestStartDate: cleanStr(o.expectedHarvestStartDate, 12),
    expectedHarvestEndDate: cleanStr(o.expectedHarvestEndDate, 12),
    expectedTotalYield: Number.isFinite(yld) ? yld : undefined,
    appendNote: cleanStr(o.appendNote, 300),
    notes: cleanStr(o.notes, 300)
  };
}

type AnalyzeInput = {
  imageDataUrl?: string;
  context?: { plotCode?: string; plotName?: string; crop?: string; planSummary?: string; question?: string; kind?: string };
};

// Pull mimeType + base64 out of a data URL (data:image/jpeg;base64,XXXX).
function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

async function callVision(model: string, key: string, prompt: string, image: { mimeType: string; data: string }) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: image.mimeType, data: image.data } }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 1800, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) return { ok: false as const, status: res.status };
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("").trim();
  if (!text) return { ok: false as const, status: 0 };
  try {
    const parsed = JSON.parse(text) as { analysis?: string; severity?: string; operations?: unknown[] };
    if (!parsed?.analysis) return { ok: false as const, status: 0 };
    const ops = Array.isArray(parsed.operations) ? parsed.operations.slice(0, 5).map(sanitizeOperation).filter(Boolean) : [];
    return { ok: true as const, analysis: parsed.analysis.trim(), severity: cleanStr(parsed.severity) || "", operations: ops };
  } catch {
    return { ok: false as const, status: 0 };
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let input: AnalyzeInput;
  try { input = (await request.json()) as AnalyzeInput; } catch { return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }); }

  const image = input.imageDataUrl ? parseDataUrl(input.imageDataUrl) : null;
  if (!image) return NextResponse.json({ ok: false, error: "No valid image supplied." }, { status: 400 });

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "Photo analysis needs the AI key, which is not configured.", analysis: "", operations: [] }, { status: 503 });
  }

  const ctx = input.context || {};
  const where = [ctx.plotCode ? `plot ${ctx.plotCode}${ctx.plotName ? ` (${ctx.plotName})` : ""}` : null, ctx.crop ? `crop ${ctx.crop}` : null].filter(Boolean).join(", ");
  const prompt = [
    "You are the farm advisor for a Nigerian vegetable/crop farm (currency Naira). The user has uploaded a PHOTO from the farm. Look at the image carefully and help.",
    where ? `This photo is about: ${where}.` : "The user did not say which plot/crop this is.",
    ctx.planSummary ? `Relevant plan note: ${ctx.planSummary}` : "",
    ctx.question ? `The user specifically asks: ${ctx.question}` : "",
    "",
    "Do all of the following in JSON:",
    "1) analysis: 3-6 sentences. Say plainly what you SEE in the photo, then diagnose — pest/disease (name it if you can), nutrient deficiency, water stress, weeds, crop stage/maturity, or for a HARVEST/PRODUCE photo grade the quality, size and market-readiness. Be specific and practical for Nigerian conditions. If you are unsure, say what to check to confirm.",
    "2) severity: overall urgency — low, medium, high or critical.",
    "3) operations: 1-4 concrete next actions as records to add. Use create_task for actions (taskType one of clearing, nursery_work, planting, transplanting, watering, fertilizer, spraying, weeding, harvesting, packing, transport, irrigation_repair, inspection, market_survey, other; set priority and dueInDays); record_observation for logging a pest/disease/issue (observationType e.g. pest_attack, disease, plant_stress, poor_germination; set severity); update_plot_status when the photo shows the plot's condition has changed (landStatus one of ready, bushy, planted, fallow, waterlogged, needs_clearing, recently_cleared, needs_herbicide, needs_manual_labor, needs_ploughing, needs_ridging, needs_manure, too_dry, under_cultivation; and/or irrigationStatus none/planned/partial/active/needs_repair/not_required); and edit_plan when the photo means an EXISTING plan should change — set cropName + plotCode to find it and only the changed fields: planStatus (draft/approved/active/completed/cancelled), expectedHarvestStartDate/expectedHarvestEndDate (YYYY-MM-DD, e.g. push the window if the crop is behind), expectedTotalYield (number, if the crop clearly looks better/worse than planned), and appendNote (a short dated note). ALWAYS set plotCode = the plot this photo is about (use the plot code given above) and cropName, so every change is tied to the right plot. Name only realistic, Nigeria-available products in notes, with a reminder to follow the label/PPE/pre-harvest interval. Keep each operation one complete object.",
    "Be honest: if the photo is unclear or not farm-related, say so in analysis and return no operations."
  ].filter(Boolean).join("\n");

  let lastStatus = 0;
  for (const model of MODELS) {
    try {
      const out = await callVision(model, key, prompt, image);
      if (out.ok) return NextResponse.json({ ok: true, analysis: out.analysis, severity: out.severity, operations: out.operations, model });
      lastStatus = out.status;
    } catch {
      // try next model
    }
  }
  return NextResponse.json({ ok: false, error: `Could not analyze the photo (status ${lastStatus}). Try again.`, analysis: "", operations: [] }, { status: 502 });
}
