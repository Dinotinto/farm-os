import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MODELS = [...new Set(
  [process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash-001"].filter(Boolean) as string[]
)];

// Approximate seeds per gram for common Nigerian crops (deterministic fallback).
const SEEDS_PER_GRAM: Record<string, number> = {
  tomato: 300,
  pepper: 150,
  "bell pepper": 150,
  "scotch bonnet": 160,
  chilli: 160,
  "garden egg": 250,
  eggplant: 250,
  aubergine: 250,
  cucumber: 35,
  watermelon: 8,
  okra: 18,
  maize: 3,
  "sweet corn": 3,
  onion: 250,
  cabbage: 300,
  carrot: 800,
  lettuce: 800,
  pumpkin: 4,
  amaranth: 1500,
  spinach: 90
};

function fallbackPerGram(crop: string) {
  const c = crop.toLowerCase().trim();
  for (const key of Object.keys(SEEDS_PER_GRAM)) {
    if (c.includes(key)) return SEEDS_PER_GRAM[key];
  }
  return 0;
}

const SCHEMA = {
  type: "object",
  properties: { seedsPerGram: { type: "number" }, note: { type: "string" } },
  required: ["seedsPerGram"]
};

async function callGemini(model: string, key: string, prompt: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 200, responseMimeType: "application/json", responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } } })
  });
  if (!res.ok) return null;
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("").trim();
  if (!text) return null;
  try { return JSON.parse(text) as { seedsPerGram?: number; note?: string }; } catch { return null; }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  let body: { crop?: string; grams?: number };
  try { body = (await request.json()) as { crop?: string; grams?: number }; } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const crop = String(body.crop || "").trim();
  const grams = Number(body.grams) || 0;
  if (!crop || grams <= 0) return NextResponse.json({ ok: false, error: "Provide crop and grams" }, { status: 400 });

  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (key) {
    const prompt = `Approximately how many seeds are in one gram of ${crop} seed? Give seedsPerGram as a realistic average number for Nigerian vegetable/crop farming, and a one-line note. Reply as JSON.`;
    for (const model of MODELS) {
      try {
        const out = await callGemini(model, key, prompt);
        const perGram = Math.round(Number(out?.seedsPerGram) || 0);
        if (perGram > 0) {
          return NextResponse.json({ ok: true, seedsPerGram: perGram, estimatedSeeds: Math.round(perGram * grams), note: String(out?.note || `~${perGram} ${crop} seeds per gram`).slice(0, 160), source: "gemini" });
        }
      } catch {
        // try next model
      }
    }
  }

  const perGram = fallbackPerGram(crop);
  if (perGram > 0) {
    return NextResponse.json({ ok: true, seedsPerGram: perGram, estimatedSeeds: Math.round(perGram * grams), note: `~${perGram} ${crop} seeds per gram (built-in estimate)`, source: "table" });
  }
  return NextResponse.json({ ok: false, error: "Could not estimate for that crop. Enter seeds per unit directly." });
}
