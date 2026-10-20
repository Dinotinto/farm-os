import type { CropProfile, FarmOsData, PlantingPlan } from "@/lib/farm-os-types";

// Crop growth-stage engine.
// Turns a planting plan + crop profile + today's date into a plain-language
// "where is this crop now, what should I be seeing, what to do next" briefing.
// Crop-type aware: pulls pest risks, care tasks and fertilizer stages from the
// crop profile so guidance differs for, say, tomato vs plantain.

export type CropStageKey =
  | "not_started"
  | "nursery"
  | "establishment"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "harvest"
  | "overdue_harvest"
  | "done";

export type CropStageInfo = {
  planId: string;
  plotId: string;
  cropName: string;
  variety?: string;
  stage: CropStageKey;
  stageLabel: string;
  /** Days since the plan's effective start (nursery or planting date). Negative = not started. */
  daysIn: number;
  /** Days until harvest window opens (negative once it has opened). */
  daysToHarvest: number | null;
  progressPct: number; // 0-100 toward harvest
  headline: string; // "Day 14 of nursery"
  observe: string[]; // what should be visible / what to look for now
  nextAction: string; // the single next thing to do
  tone: "info" | "watch" | "action";
};

function isoToDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

const STAGE_LABELS: Record<CropStageKey, string> = {
  not_started: "Not started yet",
  nursery: "In the nursery",
  establishment: "Establishment",
  vegetative: "Vegetative growth",
  flowering: "Flowering",
  fruiting: "Fruiting / bulking",
  harvest: "Harvest window",
  overdue_harvest: "Harvest overdue",
  done: "Cycle finished"
};

/** Pick a few crop-specific risks/tasks to surface, with a sensible fallback. */
function pickList(list: string[] | undefined, fallback: string[], max = 2): string[] {
  const cleaned = (list || []).map((s) => s.trim()).filter(Boolean);
  return (cleaned.length ? cleaned : fallback).slice(0, max);
}

/**
 * Compute the current stage for one plan. `today` is an ISO date string so the
 * caller controls the clock (we use the real device date, not the app's
 * hardcoded farmToday, so guidance stays accurate).
 */
export function plantingStage(plan: PlantingPlan, crop: CropProfile | undefined, today: string): CropStageInfo {
  const todayDate = isoToDate(today) || new Date();
  const nurseryDate = crop?.nurseryRequired ? isoToDate(plan.plannedNurseryDate) : null;
  const plantDate = isoToDate(plan.expectedTransplantDate) || isoToDate(plan.plannedPlantingDate);
  const harvestStart = isoToDate(plan.expectedHarvestStartDate);
  const harvestEnd = isoToDate(plan.expectedHarvestEndDate);
  const duration = Number(crop?.expectedDurationToHarvestDays || 0);

  const pestRisks = pickList(crop?.commonPestRisks, ["pests and disease on new leaves"]);
  const careTasks = pickList(crop?.commonCareTasks, ["weeding", "watering"]);
  const fertStages = pickList(crop?.commonFertilizerStages, ["a balanced fertilizer"], 3);

  // Effective start = nursery date (if any) else planting date.
  const start = nurseryDate || plantDate;
  const daysIn = start ? dayDiff(start, todayDate) : -1;
  const daysToHarvest = harvestStart ? dayDiff(todayDate, harvestStart) : null;

  // ---- Not started ----
  if (!start || daysIn < 0) {
    const when = start ? `${Math.abs(daysIn)} day(s)` : "soon";
    return {
      planId: plan.id, plotId: plan.plotId, cropName: plan.cropName, variety: plan.variety,
      stage: "not_started", stageLabel: STAGE_LABELS.not_started, daysIn, daysToHarvest, progressPct: 0,
      headline: `Starts in ${when}`,
      observe: ["Nothing on the ground yet — this is a planned cycle."],
      nextAction: nurseryDate
        ? `Get the nursery tray, media and ${plan.cropName} seed ready before ${plan.plannedNurseryDate}.`
        : `Make sure the plot is cleared and inputs are in stock before ${plan.plannedPlantingDate || "the planting date"}.`,
      tone: "info"
    };
  }

  // ---- Nursery (only if the crop uses one and we haven't passed the transplant date) ----
  const nurseryDays = Number(crop?.nurseryDurationDays || 0);
  if (nurseryDate && plantDate && todayDate < plantDate) {
    const toTransplant = dayDiff(todayDate, plantDate);
    const obs: string[] = [];
    if (daysIn <= 4) obs.push("Seeds should be sprouting — keep media moist, out of harsh sun.");
    else if (daysIn <= Math.max(nurseryDays * 0.6, 10)) obs.push("Seedlings putting out their first true leaves — watch for damping-off and leggy growth.");
    else obs.push(`Seedlings hardening off — ${toTransplant} day(s) to transplant. Reduce shade/water slightly so they toughen up.`);
    obs.push(`Scout early for ${pestRisks.join(" and ")}.`);
    return {
      planId: plan.id, plotId: plan.plotId, cropName: plan.cropName, variety: plan.variety,
      stage: "nursery", stageLabel: STAGE_LABELS.nursery, daysIn, daysToHarvest,
      progressPct: nurseryDays ? Math.min(Math.round((daysIn / nurseryDays) * 100), 100) : 0,
      headline: `Day ${daysIn} in the nursery`,
      observe: obs,
      nextAction: toTransplant <= 4
        ? `Prepare the plot now — transplant ${plan.cropName} around ${plan.expectedTransplantDate || plan.plannedPlantingDate}.`
        : `Keep nursing. Plan the land prep so the bed is ready by ${plan.expectedTransplantDate || plan.plannedPlantingDate}.`,
      tone: toTransplant <= 4 ? "action" : "watch"
    };
  }

  // ---- Field stages, measured from planting/transplant date ----
  const fieldStart = plantDate || start;
  const fieldDays = dayDiff(fieldStart, todayDate);
  const pct = duration > 0 ? Math.min(Math.max(Math.round((fieldDays / duration) * 100), 0), 100) : 0;

  // ---- Past harvest window end ----
  if (harvestEnd && todayDate > harvestEnd) {
    return {
      planId: plan.id, plotId: plan.plotId, cropName: plan.cropName, variety: plan.variety,
      stage: "overdue_harvest", stageLabel: STAGE_LABELS.overdue_harvest, daysIn: fieldDays, daysToHarvest, progressPct: 100,
      headline: `Harvest window closed ${dayDiff(harvestEnd, todayDate)} day(s) ago`,
      observe: ["Fruit/produce left on the field loses quality and invites pests."],
      nextAction: `Harvest and sell what's left, then mark this plan completed so the plot frees up.`,
      tone: "action"
    };
  }

  // ---- In harvest window ----
  if (harvestStart && todayDate >= harvestStart) {
    return {
      planId: plan.id, plotId: plan.plotId, cropName: plan.cropName, variety: plan.variety,
      stage: "harvest", stageLabel: STAGE_LABELS.harvest, daysIn: fieldDays, daysToHarvest, progressPct: 100,
      headline: `Ready to harvest (window ${plan.expectedHarvestStartDate} → ${plan.expectedHarvestEndDate || "?"})`,
      observe: [`${plan.cropName} should be reaching market size/colour — pick at the right maturity for best price.`, "Harvest in the cool of the morning and grade as you pick."],
      nextAction: `Line up buyers (check Market prices), harvest in batches, and log sales under Accounts.`,
      tone: "action"
    };
  }

  // Use fraction of duration to split establishment → vegetative → flowering → fruiting.
  const frac = duration > 0 ? fieldDays / duration : 0;
  let stage: CropStageKey;
  let observe: string[];
  let nextAction: string;
  let tone: CropStageInfo["tone"] = "watch";

  if (frac < 0.2) {
    stage = "establishment";
    observe = [
      `Seedlings/young plants settling in — expect even rows and steady green growth ${fieldDays} day(s) after planting.`,
      `Look for gaps/poor germination and early ${pestRisks[0]}.`
    ];
    nextAction = `Gap-fill any misses, do the first ${careTasks[0]}, and apply your basal/${fertStages[0]} dose.`;
    tone = "watch";
  } else if (frac < 0.5) {
    stage = "vegetative";
    observe = [
      "Strong leaf and stem growth — the canopy should be filling out.",
      `Keep scouting for ${pestRisks.join(" and ")}; weeds compete hardest now.`
    ];
    nextAction = `Top-dress with ${fertStages[1] || fertStages[0]}, stay on top of ${careTasks.join(" and ")}.`;
    tone = "watch";
  } else if (frac < 0.7) {
    stage = "flowering";
    observe = [
      "Flowers opening — this sets your yield, so protect them.",
      `Flower drop, ${pestRisks[0]} and water stress hurt most at this point.`
    ];
    nextAction = `Keep water steady, scout for pests, and feed a flowering/${fertStages[2] || fertStages[1] || fertStages[0]} fertilizer.`;
    tone = "watch";
  } else {
    stage = "fruiting";
    observe = [
      "Fruits/heads/bulbs sizing up — demand for water and potassium peaks.",
      `Watch for fruit rot, ${pestRisks[0]} and sunscald; support heavy plants if needed.`
    ];
    nextAction = harvestStart
      ? `Hold steady — first harvest around ${plan.expectedHarvestStartDate}. Start lining up buyers.`
      : `Maintain protection and feeding; prepare for harvest.`;
    tone = "watch";
  }

  return {
    planId: plan.id, plotId: plan.plotId, cropName: plan.cropName, variety: plan.variety,
    stage, stageLabel: STAGE_LABELS[stage], daysIn: fieldDays, daysToHarvest, progressPct: pct,
    headline: `Day ${fieldDays}${duration ? ` of ~${duration}` : ""} after planting`,
    observe,
    nextAction,
    tone
  };
}

/** Stage briefing for every plan that is currently in the ground (not draft-only, not finished). */
export function cropStageGuidance(data: FarmOsData, today: string): CropStageInfo[] {
  return data.plantingPlans
    .filter((p) => p.status !== "completed" && p.status !== "cancelled")
    .map((plan) => {
      const crop = data.cropProfiles.find((c) => c.id === plan.cropProfileId) || data.cropProfiles.find((c) => c.cropName === plan.cropName);
      return plantingStage(plan, crop, today);
    })
    .sort((a, b) => {
      const rank = { action: 0, watch: 1, info: 2 } as const;
      return rank[a.tone] - rank[b.tone];
    });
}
