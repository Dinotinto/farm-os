import type { CropProfile, FarmOsData, FarmOsTab } from "@/lib/farm-os-types";
import {
  costPerCategory,
  costPerPlot,
  expectedProfit,
  expectedRevenue,
  formatQty,
  getPlotName,
  itemStock,
  labelize,
  moneyIn,
  moneyOut,
  naira,
  netCashflow,
  planCost,
  procurementNeeds,
  receivables
} from "@/lib/farm-os-calculations";
import { bestPlotsForCrop, buildFarmInsights, irrigationCostForPlot, profitByCrop, workerWeekPlan } from "@/lib/farm-os-advisor";

export type AgentAction = {
  label: string;
  tab: FarmOsTab;
};

export type AgentAnswer = {
  answer: string;
  bullets?: string[];
  actions?: AgentAction[];
  source: "rules";
};

type BuiltInCropKnowledge = {
  name: string;
  aliases: string[];
  directAnswer: string;
  nurseryDays?: string;
  maturityDays: string;
  harvestWindow?: string;
  waterNeed: "low" | "medium" | "high";
  irrigation: string;
  varieties?: Record<string, string>;
  setupTip: string;
};

const BUILT_IN_CROPS: BuiltInCropKnowledge[] = [
  {
    name: "Cucumber",
    aliases: ["cucumber", "cucumbers", "darina", "african giant", "african giant cucumber"],
    directAnswer:
      "Cucumber is a fast crop. In warm Nigerian conditions, most cucumber varieties start harvesting around 40–55 days after planting, but the exact timing depends on the variety, water, fertility and pest pressure.",
    maturityDays: "40–55 days after planting",
    harvestWindow: "first harvest is usually followed by repeated picking every 2–3 days",
    waterNeed: "high",
    irrigation: "Steady water is strongly recommended; drought stress can reduce fruit size and cause poor shape.",
    varieties: {
      darina: "Darina cucumber is usually treated as an early/medium cucumber; start checking for harvest from about 38–45 days if growth is strong.",
      "african giant": "African Giant cucumber is usually budgeted around 45–55 days to first harvest, depending on management."
    },
    setupTip: "Add Cucumber in Crop Catalog with your chosen variety, then Planting Planner can calculate expected harvest dates automatically."
  },
  {
    name: "Tomato",
    aliases: ["tomato", "tomatoes", "cobra", "cobra f1", "roma", "utc tomato"],
    directAnswer:
      "Tomato normally needs nursery first. A practical planning range is 21–35 days in nursery, then about 70–90 days from transplanting to main harvest depending on variety and conditions.",
    nurseryDays: "21–35 days",
    maturityDays: "70–90 days after transplanting",
    harvestWindow: "harvest can continue in flushes if disease, water and nutrition are managed",
    waterNeed: "medium",
    irrigation: "Regular moisture helps fruit set and reduces cracking/blossom-end issues; avoid waterlogging.",
    setupTip: "Create the tomato variety in Crop Catalog, then use Planting Planner to calculate nursery, transplant and harvest dates."
  },
  {
    name: "Bell pepper",
    aliases: ["bell pepper", "sweet pepper", "tatashe", "pepper"],
    directAnswer:
      "Bell pepper is usually started in nursery, then transplanted. Plan roughly 42–56 days in nursery and about 75–95 days after transplanting before strong harvest starts.",
    nurseryDays: "42–56 days",
    maturityDays: "75–95 days after transplanting",
    waterNeed: "high",
    irrigation: "Irrigation is strongly recommended for steady flowering and fruit sizing.",
    setupTip: "Add Bell pepper in Crop Catalog and set water need to high so the app warns you when a plot is not irrigated."
  },
  {
    name: "Scotch bonnet",
    aliases: ["scotch bonnet", "atarodo", "habanero"],
    directAnswer:
      "Scotch bonnet/atarodo is slower than cucumber and usually needs nursery. A safe planning range is 42–56 days in nursery and about 90–120 days after transplanting to meaningful harvest.",
    nurseryDays: "42–56 days",
    maturityDays: "90–120 days after transplanting",
    waterNeed: "medium",
    irrigation: "Steady moisture improves flowering and fruiting, but the crop should not sit in waterlogged soil.",
    setupTip: "Add Scotch bonnet in Crop Catalog, then use market price per kg or basket to forecast revenue."
  },
  {
    name: "Garden egg",
    aliases: ["garden egg", "garden eggs", "eggplant", "aubergine"],
    directAnswer:
      "Garden egg is normally raised in nursery, then transplanted. Plan about 35–45 days in nursery and roughly 70–90 days after transplanting to first useful harvest.",
    nurseryDays: "35–45 days",
    maturityDays: "70–90 days after transplanting",
    waterNeed: "medium",
    irrigation: "Moderate, steady watering is useful, especially during flowering and fruit setting.",
    setupTip: "Create Garden egg in Crop Catalog so tasks for nursery, transplanting, spraying and harvest can be generated later."
  },
  {
    name: "Sweet corn",
    aliases: ["sweet corn", "sweetcorn", "maize", "corn"],
    directAnswer:
      "Sweet corn is usually direct planted. Many sweet-corn types mature around 60–90 days after planting depending on the variety.",
    maturityDays: "60–90 days after planting",
    harvestWindow: "harvest timing is short; check cobs closely when silks dry and kernels fill",
    waterNeed: "medium",
    irrigation: "Water is important around tasselling and cob filling; drought at that stage can cut yield badly.",
    setupTip: "Add Sweet corn in Crop Catalog and enter expected yield per acre plus market price per cob, bag or kg."
  },
  {
    name: "Plantain",
    aliases: ["plantain", "plantains", "sucker", "suckers"],
    directAnswer:
      "Plantain is a long-cycle crop. In many Nigerian conditions, first harvest is commonly planned around 9–15 months after planting suckers, depending on variety, water, spacing and management.",
    maturityDays: "9–15 months after planting suckers",
    harvestWindow: "after first harvest, ratoon crops can continue if the stand is well managed",
    waterNeed: "high",
    irrigation: "Plantain benefits from reliable moisture and mulching, especially in dry periods.",
    setupTip: "Use Planting Planner for long-term costing because plantain profit should be viewed over months, not weeks."
  },
  {
    name: "Okra",
    aliases: ["okra", "okro", "lady finger", "ila"],
    directAnswer:
      "Okra is a fast, mostly direct-planted crop. In warm Nigerian conditions it commonly starts harvesting around 45–60 days after planting, then is picked repeatedly.",
    maturityDays: "45–60 days after planting",
    harvestWindow: "pick young pods every 2–3 days; pods get woody if left too long",
    waterNeed: "medium",
    irrigation: "Tolerates heat well but steady moisture keeps pods tender and improves yield.",
    setupTip: "Add Okra in Crop Catalog as a direct-planted crop and price per basket or kg."
  },
  {
    name: "Watermelon",
    aliases: ["watermelon", "water melon", "melon"],
    directAnswer:
      "Watermelon is usually direct-planted and matures fast in the dry season with irrigation. Plan roughly 75–90 days from planting to harvest.",
    maturityDays: "75–90 days after planting",
    harvestWindow: "harvest when the ground-spot turns creamy yellow and the tendril near the fruit dries",
    waterNeed: "high",
    irrigation: "Needs steady water during vine growth and fruit sizing, then ease off near maturity for sweeter fruit.",
    setupTip: "Add Watermelon in Crop Catalog, set water need high, and price per piece or kg."
  },
  {
    name: "Cassava",
    aliases: ["cassava", "manioc", "ege", "gari crop"],
    directAnswer:
      "Cassava is a long-cycle crop planted from stem cuttings. Most varieties are harvested around 9–12 months, though sweet varieties can be lifted from about 8 months.",
    maturityDays: "9–12 months after planting cuttings",
    harvestWindow: "roots can stay in the ground and be harvested in stages as needed",
    waterNeed: "low",
    irrigation: "Drought-tolerant once established; rain-fed is normal in most of Nigeria.",
    setupTip: "Use Planting Planner for long-cycle costing and plant from healthy stem cuttings, not seed."
  },
  {
    name: "Yam",
    aliases: ["yam", "yams", "isu", "white yam", "water yam"],
    directAnswer:
      "Yam is a long-cycle crop grown from setts/seed yam on mounds or ridges. First harvest is commonly planned around 7–10 months depending on variety and whether you take early ('milking') or full harvest.",
    maturityDays: "7–10 months after planting setts",
    harvestWindow: "leaves yellowing and dying back signals maturity; can be harvested once or in two stages",
    waterNeed: "medium",
    irrigation: "Mostly rain-fed; needs good moisture during tuber bulking but well-drained mounds to avoid rot.",
    setupTip: "Add Yam in Crop Catalog, plan staking and weeding tasks, and price per tuber or per 100 tubers."
  },
  {
    name: "Onion",
    aliases: ["onion", "onions", "alubosa", "red onion"],
    directAnswer:
      "Onion is usually raised in nursery then transplanted. Plan about 35–45 days in nursery and roughly 90–120 days from transplanting to bulb harvest.",
    nurseryDays: "35–45 days",
    maturityDays: "90–120 days after transplanting",
    harvestWindow: "harvest when most tops fall over and necks soften; cure in shade before storage",
    waterNeed: "medium",
    irrigation: "Needs steady water during bulbing, then stop watering as tops fall over to help curing and storage.",
    setupTip: "Add Onion in Crop Catalog as a nursery crop and price per bag or kg."
  },
  {
    name: "Carrot",
    aliases: ["carrot", "carrots"],
    directAnswer:
      "Carrot is direct-sown (it does not transplant well) and prefers loose, stone-free soil. Plan roughly 70–90 days from sowing to harvest.",
    maturityDays: "70–90 days after sowing",
    harvestWindow: "harvest when roots reach usable size; lift before they crack or get woody",
    waterNeed: "medium",
    irrigation: "Keep soil evenly moist for straight roots and good germination; irregular water causes splitting.",
    setupTip: "Add Carrot in Crop Catalog as a direct-sown crop; thin seedlings early for good root size."
  },
  {
    name: "Fluted pumpkin (Ugu)",
    aliases: ["ugu", "ugwu", "fluted pumpkin", "pumpkin leaf"],
    directAnswer:
      "Ugu (fluted pumpkin) is grown from seed for leaves and shoots. First leaf cutting commonly starts around 30–45 days after planting, then repeats.",
    maturityDays: "30–45 days to first leaf harvest",
    harvestWindow: "cut tender shoots/leaves regularly; frequent cutting encourages more growth",
    waterNeed: "medium",
    irrigation: "Steady moisture keeps leaves tender and green; stake the vines for cleaner harvest.",
    setupTip: "Add Ugu in Crop Catalog and price per bundle; plan repeated harvesting tasks."
  },
  {
    name: "Green amaranth (Tete)",
    aliases: ["tete", "amaranth", "green", "efo tete", "soko"],
    directAnswer:
      "Tete (amaranth) is a very fast leafy vegetable, usually direct-sown. It is often ready for harvest around 25–35 days after sowing.",
    maturityDays: "25–35 days after sowing",
    harvestWindow: "harvest whole plants or cut and let regrow; very quick turnaround",
    waterNeed: "medium",
    irrigation: "Frequent light watering keeps leaves soft and fast-growing.",
    setupTip: "Add Tete in Crop Catalog as a fast direct-sown crop and price per bundle or basket."
  }
];

const SUGGESTED_QUESTIONS = [
  "How long does cucumber take to mature?",
  "Best way to fight whiteflies",
  "I want to set up a new 300 by 100 acre",
  "How much will irrigation cost for a plot?",
  "Help me add cucumber and calculate harvest dates",
  "Which plot needs clearing?",
  "What should each worker do this week?",
  "Which costs are too high?"
];

export function suggestedQuestions() {
  return SUGGESTED_QUESTIONS;
}

function safeArray<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function findCrop(data: FarmOsData, question: string) {
  const lower = question.toLowerCase();
  return safeArray(data.cropProfiles).find((crop) => lower.includes(crop.cropName.toLowerCase()));
}

function findKnownCrop(question: string) {
  const lower = question.toLowerCase();
  return BUILT_IN_CROPS.find((crop) => crop.aliases.some((alias) => lower.includes(alias)) || lower.includes(crop.name.toLowerCase()));
}

function findPlot(data: FarmOsData, question: string) {
  const lower = question.toLowerCase();
  return safeArray(data.plots).find(
    (plot) => lower.includes(plot.plotCode.toLowerCase()) || lower.includes(plot.plotName.toLowerCase())
  );
}

function setupActions(data: FarmOsData): AgentAction[] {
  const actions: AgentAction[] = [];
  if (!safeArray(data.plots).length) actions.push({ label: "Go to Farm Map", tab: "farm-map" });
  if (!safeArray(data.irrigationMaterials).length) actions.push({ label: "Add irrigation materials", tab: "irrigation" });
  if (!safeArray(data.cropProfiles).length) actions.push({ label: "Add crop catalog", tab: "crop-catalog" });
  if (!safeArray(data.workers).length) actions.push({ label: "Add workers", tab: "workers" });
  return actions;
}

function hasCropSetup(data: FarmOsData, cropName: string) {
  return safeArray(data.cropProfiles).some((crop) => crop.cropName.toLowerCase() === cropName.toLowerCase());
}

function cropMaturityAnswer(data: FarmOsData, question: string, savedCrop?: CropProfile): AgentAnswer | null {
  const known = findKnownCrop(question);
  const isMaturityQuestion =
    question.includes("how long") ||
    question.includes("mature") ||
    question.includes("maturity") ||
    question.includes("harvest") ||
    question.includes("how many days") ||
    question.includes("duration");

  if (!known && !(savedCrop && isMaturityQuestion)) return null;
  if (!isMaturityQuestion && !known) return null;

  const varietyNote = known?.varieties
    ? Object.entries(known.varieties).find(([alias]) => question.includes(alias))?.[1]
    : undefined;

  if (savedCrop?.expectedDurationToHarvestDays) {
    return {
      answer: `${savedCrop.cropName} is saved in your Crop Catalog with ${savedCrop.expectedDurationToHarvestDays} day(s) to harvest/maturity. If you create a planting plan and leave the harvest date blank, the app will use that saved number to calculate the expected harvest date.`,
      bullets: [
        savedCrop.nurseryRequired ? `Nursery duration saved: ${savedCrop.nurseryDurationDays || "not entered"} day(s).` : "Direct planting is allowed in the saved crop profile.",
        `Water need saved: ${savedCrop.waterNeed}.`,
        "Open Planting Planner, select this crop and a plot, then enter the planting date."
      ],
      actions: [{ label: "Open Planting Planner", tab: "planting-planner" }, { label: "Edit Crop Catalog", tab: "crop-catalog" }],
      source: "rules"
    };
  }

  if (!known) return null;
  const saved = hasCropSetup(data, known.name);
  return {
    answer: varietyNote || known.directAnswer,
    bullets: [
      `Planning maturity: ${known.maturityDays}.`,
      known.nurseryDays ? `Nursery stage: about ${known.nurseryDays}.` : "Nursery stage: usually not required unless you choose to raise seedlings first.",
      known.harvestWindow ? `Harvest note: ${known.harvestWindow}.` : known.irrigation,
      saved ? `${known.name} is already in your Crop Catalog.` : `You have not saved ${known.name} in Crop Catalog yet, so save it there before building a planting plan.`,
      known.setupTip
    ],
    actions: saved
      ? [{ label: "Open Planting Planner", tab: "planting-planner" }, { label: "Edit Crop Catalog", tab: "crop-catalog" }]
      : [{ label: "Add to Crop Catalog", tab: "crop-catalog" }, { label: "Open Planting Planner", tab: "planting-planner" }],
    source: "rules"
  };
}

function pestAdvice(question: string): AgentAnswer | null {
  const q = question.toLowerCase();
  const crop = findKnownCrop(q)?.name;
  const isPestOrDisease =
    q.includes("whitefl") ||
    q.includes("white fly") ||
    q.includes("white flies") ||
    q.includes("aphid") ||
    q.includes("thrip") ||
    q.includes("mite") ||
    q.includes("armyworm") ||
    q.includes("borer") ||
    q.includes("fung") ||
    q.includes("disease") ||
    q.includes("blight") ||
    q.includes("wilt") ||
    q.includes("pest") ||
    q.includes("spray") ||
    q.includes("fight") ||
    q.includes("control");
  if (!isPestOrDisease) return null;

  if (q.includes("whitefl") || q.includes("white fly") || q.includes("white flies")) {
    return {
      answer:
        "For whiteflies, use integrated control: inspect under leaves, remove heavily affected leaves, clear weeds around the crop, use yellow sticky traps where available, and spray only when pressure is building. Rotate chemical groups if you use insecticide, because whiteflies develop resistance quickly.",
      bullets: [
        "Scout early morning or evening; whiteflies hide under leaves.",
        "Control weeds and old crop residues around the plot.",
        "For light pressure, neem/soap-based control may help if used properly.",
        "For serious pressure, use a registered insecticide, follow the label, wear PPE and obey harvest intervals.",
        "Record the attack in Observations and create a spraying/scouting task."
      ],
      actions: [{ label: "Record observation", tab: "observations" }, { label: "Create spray/scouting task", tab: "tasks" }],
      source: "rules"
    };
  }

  return {
    answer: `For ${crop ? `${crop} ` : ""}pest or disease control, start by identifying the exact symptom before spraying. Check whether the issue is insects, fungal disease, water stress, nutrient deficiency or virus, then record the observation and plan a targeted response instead of spraying blindly.`,
    bullets: [
      "Inspect leaves, stems, flowers and fruit; note where the damage starts.",
      "Take photos and record severity, affected area and date in Observations.",
      "Remove badly affected plant parts only when it will not spread the issue further.",
      "Use the right product for the confirmed problem, rotate active ingredients, wear PPE and follow label rates/harvest intervals.",
      "Create follow-up scouting tasks so you know if the treatment worked."
    ],
    actions: [{ label: "Record observation", tab: "observations" }, { label: "Create task", tab: "tasks" }],
    source: "rules"
  };
}

function plantingWorkflow(data: FarmOsData, question: string): AgentAnswer {
  const crop = findCrop(data, question);
  const known = findKnownCrop(question);
  const actions = setupActions(data);
  if (!safeArray(data.plots).length || !safeArray(data.cropProfiles).length) {
    return {
      answer: known
        ? `${known.name} can be planned, but the app needs your plot and crop profile first so it can calculate your dates, costs and profit from real records.`
        : "Before a planting plan can calculate dates, costs and profit, you need at least one plot and one crop profile. Start with Farm Map for the acre size, then Crop Catalog for the crop maturity days, then Planting Planner.",
      bullets: [
        "Step 1: create the plot/acre, e.g. 300 × 100 ft or 200 × 150 ft.",
        known ? `Step 2: add/select ${known.name} in Crop Catalog and save maturity as ${known.maturityDays}.` : "Step 2: add/select the crop profile, variety and maturity days.",
        "Step 3: create the planting plan so dates and profit can calculate."
      ],
      actions: actions.length ? actions : [{ label: "Open Planting Planner", tab: "planting-planner" }],
      source: "rules"
    };
  }
  return {
    answer: crop
      ? `To plant ${crop.cropName}, use its saved profile in the Planting Planner. The app will use about ${crop.nurseryDurationDays || 0} nursery day(s) and ${crop.expectedDurationToHarvestDays || "the saved"} days to harvest/maturity when date fields are left blank.`
      : known
        ? `${known.name} should first be saved as a Crop Catalog profile, then selected in Planting Planner with the plot. Planning maturity: ${known.maturityDays}.`
        : "To start planting, choose a saved crop and a saved plot in Planting Planner. If the crop is not in the catalog, add it first so maturity days, yield unit, water need and pest risks can be reused.",
    bullets: [
      "Pick the crop profile instead of typing the crop again.",
      "Pick the plot so land readiness and irrigation warnings can run.",
      "Enter yield per acre and price per kg/ton/crate/bag/bunch for revenue calculation.",
      "Leave transplant/harvest dates blank if you want them calculated from the crop profile."
    ],
    actions: [{ label: "Open Planting Planner", tab: "planting-planner" }, { label: "Open Crop Catalog", tab: "crop-catalog" }],
    source: "rules"
  };
}

/**
 * Rules-based farm assistant. It answers direct crop/farm questions first, then
 * gives workflow links. Gemini can extend the answer, but the deterministic
 * layer still protects farm-specific calculations from guessing.
 */
export function answerFarmQuestion(data: FarmOsData, rawQuestion: string): AgentAnswer {
  const question = rawQuestion.trim();
  const q = question.toLowerCase();
  const crop = findCrop(data, q);
  const plot = findPlot(data, q);

  // Pest/disease/spray intent wins over crop-maturity even when a crop is named,
  // e.g. "How do I control whiteflies on pepper?" is a pest question, not maturity.
  const directPestAnswer = pestAdvice(q);
  if (directPestAnswer) return directPestAnswer;

  const directCropAnswer = cropMaturityAnswer(data, q, crop);
  if (directCropAnswer) return directCropAnswer;

  if (q.includes("set up") || q.includes("setup") || q.includes("new acre") || q.includes("300 by 100") || q.includes("200 by 150")) {
    return {
      answer: "Set the farm up in this order: create the plot first, then add irrigation materials, then add crop profiles, then create planting plans. For your Nigerian farm-acre workflow, use 300 × 100 ft or 200 × 150 ft as 30,000 sq ft, which is about 0.69 of a conventional acre.",
      bullets: [
        "Farm Map: name the plot, choose the Nigerian acre preset, and save actual length/width.",
        "Irrigation: add pump/well/tank/hose/drip-line/labour prices, then create a plan for that plot.",
        "Crop Catalog: add cucumber, plantain, pepper, tomato, garden egg or your own crop/variety.",
        "Planting Planner: select crop + plot so dates, warnings, yield and profit calculate."
      ],
      actions: [{ label: "Start on Farm Map", tab: "farm-map" }, { label: "Ask AI again after saving plot", tab: "ask-ai" }],
      source: "rules"
    };
  }

  if (q.includes("plant") || q.includes("crop plan") || q.includes("harvest date") || q.includes("maturity") || q.includes("mature")) {
    return plantingWorkflow(data, q);
  }

  // Best plot for a crop
  if ((q.includes("best") || q.includes("where") || q.includes("which plot")) && (crop || q.includes("plant") || q.includes("grow"))) {
    const targetCrop = crop || safeArray(data.cropProfiles)[0];
    const ranked = bestPlotsForCrop(data, targetCrop);
    if (!targetCrop) {
      return { answer: "Add a crop profile first so I know the crop's water need, nursery duration and expected harvest timing.", actions: [{ label: "Add crop profile", tab: "crop-catalog" }], source: "rules" };
    }
    if (!ranked.length) return { answer: "No plots are registered yet, so I can't recommend a location. Add a plot/acre first.", actions: [{ label: "Go to Farm Map", tab: "farm-map" }], source: "rules" };
    const top = ranked[0];
    return {
      answer: `Best plot for ${targetCrop.cropName}: ${getPlotName(data, top.plot.id)}.`,
      bullets: [
        ...top.reasons,
        ...(top.plot.irrigated ? [] : [`If irrigation is needed, setup would cost ~${naira.format(irrigationCostForPlot(data, top.plot))}.`]),
        ...ranked.slice(1, 3).map((entry) => `Alternative: ${entry.plot.plotCode} (${entry.reasons[0]})`)
      ],
      actions: [{ label: "Open Planting Planner", tab: "planting-planner" }],
      source: "rules"
    };
  }

  // Clearing
  if (q.includes("clear") || q.includes("bushy") || q.includes("prepare")) {
    if (!safeArray(data.plots).length) {
      return { answer: "No plots are registered yet. Add the acre/plot first, then I can tell you whether it needs clearing and what the clearing plan should look like.", actions: [{ label: "Go to Farm Map", tab: "farm-map" }], source: "rules" };
    }
    const needs = safeArray(data.plots).filter((p) =>
      ["bushy", "needs_clearing", "needs_ridging", "needs_ploughing", "needs_manual_labor", "needs_herbicide", "waterlogged"].includes(p.landStatus)
    );
    if (!needs.length) return { answer: "No plots currently need clearing based on the statuses entered. If a plot is actually bushy, update it on Farm Map or create a clearing plan.", actions: [{ label: "Open Farm Map", tab: "farm-map" }], source: "rules" };
    return {
      answer: `${needs.length} plot(s) need land work before planting.`,
      bullets: needs.map((p) => `${p.plotCode}: ${labelize(p.landStatus).toLowerCase()}`),
      actions: [{ label: "Create clearing plan", tab: "land-clearing" }],
      source: "rules"
    };
  }

  // Irrigation cost / should we irrigate
  if (q.includes("irrigat") || q.includes("water") || q.includes("pump") || q.includes("drip")) {
    if (!safeArray(data.plots).length) {
      return {
        answer: "I cannot price irrigation yet because no plot/acre has been set up. First go to Farm Map, create the plot size such as 300 × 100 ft or 200 × 150 ft, then come back and ask me for irrigation cost.",
        bullets: ["Create plot name/code", "Choose Nigerian farm acre preset or enter custom size", "Then add pump, well, tank, drip lines and labour on Irrigation"],
        actions: [{ label: "Set up plot", tab: "farm-map" }],
        source: "rules"
      };
    }
    if (!safeArray(data.irrigationMaterials).length) {
      return {
        answer: "The plots exist, but no irrigation materials/prices have been entered yet. Add the pump, water source, tank, pipe/drip line, fittings, transport and labour rows first; then I can calculate plot-specific cost.",
        bullets: data.plots.map((p) => `${p.plotCode}: ${Number(p.equivalentAcres || 0).toFixed(2)} conventional acres recorded`),
        actions: [{ label: "Add irrigation materials", tab: "irrigation" }],
        source: "rules"
      };
    }
    if (plot) {
      const cost = irrigationCostForPlot(data, plot);
      return {
        answer: `For ${plot.plotCode} (${Number(plot.equivalentAcres || 0).toFixed(2)} conventional acres), the estimated irrigation setup cost is about ${naira.format(cost)} from your current material list.`,
        bullets: [
          `Current status: ${plot.irrigated ? "marked irrigated" : "not irrigated"} (${labelize(plot.irrigationStatus).toLowerCase()}).`,
          "Create a plot-specific irrigation plan and tick only the exact materials you want to use for this acre.",
          "If the cost looks wrong, edit/delete the material rows and enter the actual quotes."
        ],
        actions: [{ label: "Open Irrigation", tab: "irrigation" }],
        source: "rules"
      };
    }
    const dry = data.plots.filter((p) => !p.irrigated);
    const listed = (dry.length ? dry : data.plots).slice(0, 6);
    return {
      answer: dry.length
        ? `Which plot do you mean? ${dry.length} plot(s) are not irrigated. Here are estimated setup costs from your current materials.`
        : "All plots are currently marked irrigated, but I can still review or rebuild irrigation cost if you choose a plot. If that status is wrong, update the plot on Farm Map.",
      bullets: listed.map((p) => `${p.plotCode}: ~${naira.format(irrigationCostForPlot(data, p))} (${Number(p.equivalentAcres || 0).toFixed(2)} conventional acres)`),
      actions: [{ label: "Open Irrigation", tab: "irrigation" }, { label: "Update plot status", tab: "farm-map" }],
      source: "rules"
    };
  }

  // Worker plan
  if ((q.includes("worker") || q.includes("staff") || q.includes("labour") || q.includes("labor") || q.includes("team") || q.includes("payroll") || q.includes("salary")) && (q.includes("do") || q.includes("week") || q.includes("task") || q.includes("plan") || q.includes("pay") || q.includes("issue"))) {
    const plans = workerWeekPlan(data);
    if (!plans.length) return { answer: "No active workers are registered. Add workers first, then assign tasks and salary/attendance records.", actions: [{ label: "Add workers", tab: "workers" }, { label: "Open Salary", tab: "salary" }], source: "rules" };
    return {
      answer: "Here is what each active worker has on this week:",
      bullets: plans.map(({ worker, openTasks, outstandingPay }) => {
        const tasks = openTasks.length ? openTasks.map((t) => t.taskTitle).join(", ") : "no open tasks";
        const pay = outstandingPay > 0 ? ` — owed ${naira.format(outstandingPay)}` : "";
        return `${worker.name}: ${tasks}${pay}`;
      }),
      actions: [{ label: "Open Tasks", tab: "tasks" }, { label: "Open Salary & Payroll", tab: "salary" }],
      source: "rules"
    };
  }

  // Profit
  if (q.includes("profit") || q.includes("revenue") || q.includes("make money") || q.includes("earn")) {
    if (!safeArray(data.plantingPlans).length) {
      return { answer: "No planting plans exist yet, so profit cannot be calculated. Create a crop profile, market price and planting plan first.", actions: [{ label: "Open Crop Catalog", tab: "crop-catalog" }, { label: "Open Planting Planner", tab: "planting-planner" }], source: "rules" };
    }
    if (crop) {
      const row = profitByCrop(data).find((r) => r.cropName.toLowerCase() === crop.cropName.toLowerCase());
      if (!row) return { answer: `No planting plans exist for ${crop.cropName} yet.`, actions: [{ label: "Create planting plan", tab: "planting-planner" }], source: "rules" };
      return {
        answer: `${crop.cropName}: expected profit ${naira.format(row.profit)} across ${row.plans} plan(s).`,
        bullets: [`Cost ${naira.format(row.cost)}`, `Revenue ${naira.format(row.revenue)}`],
        actions: [{ label: "Open Reports", tab: "reports" }],
        source: "rules"
      };
    }
    const rows = profitByCrop(data);
    const total = data.plantingPlans.reduce((sum, plan) => sum + expectedProfit(plan), 0);
    return {
      answer: `Total expected profit across all planting plans: ${naira.format(total)}.`,
      bullets: rows.map((r) => `${r.cropName}: ${naira.format(r.profit)} profit (revenue ${naira.format(r.revenue)})`),
      actions: [{ label: "Open Reports", tab: "reports" }],
      source: "rules"
    };
  }

  // Costs too high
  if (q.includes("cost") && (q.includes("high") || q.includes("too much") || q.includes("expensive") || q.includes("save") || q.includes("biggest"))) {
    const categories = costPerCategory(data);
    const plots = costPerPlot(data).filter((p) => p.total > 0);
    const totalInputs = categories.reduce((sum, c) => sum + c.total, 0);
    if (!totalInputs) return { answer: "No input costs have been logged yet. Add seed, fertiliser, labour, irrigation, fuel and transport costs first.", actions: [{ label: "Open Inputs & Costs", tab: "inputs" }], source: "rules" };
    const bullets = categories.slice(0, 4).map((c) => `${labelize(c.category)}: ${naira.format(c.total)} (${Math.round((c.total / totalInputs) * 100)}%)`);
    const lossPlans = data.plantingPlans.filter((plan) => expectedProfit(plan) < 0);
    for (const plan of lossPlans) {
      bullets.push(`⚠ ${plan.cropName} on ${getPlotName(data, plan.plotId)} runs at a loss (cost ${naira.format(planCost(plan))} vs revenue ${naira.format(expectedRevenue(plan))})`);
    }
    return {
      answer: `Your biggest cost is ${labelize(categories[0].category).toLowerCase()} at ${naira.format(categories[0].total)}. Most expensive plot: ${plots[0] ? plots[0].plot.plotCode : "n/a"}.`,
      bullets,
      actions: [{ label: "Open Inputs & Costs", tab: "inputs" }, { label: "Open Reports", tab: "reports" }],
      source: "rules"
    };
  }

  // Inventory / stock — "do I have enough", "how much X left", "what's in stock"
  if (q.includes("stock") || q.includes("inventory") || q.includes("enough") || q.includes("in store") || q.includes("how much") || q.includes("do i have") || q.includes("run out")) {
    if (!safeArray(data.inventoryItems).length) {
      return { answer: "Your inventory is empty. Add seeds, fertilizer and crop protection in Inventory first — plans can only draw from stock you actually record.", actions: [{ label: "Open Inventory", tab: "inputs" }], source: "rules" };
    }
    const needs = procurementNeeds(data);
    const named = safeArray(data.inventoryItems).find((item) => q.includes(item.name.toLowerCase()));
    if (named) {
      return {
        answer: `You have ${formatQty(itemStock(data, named.id), named.unit)} of ${named.name} in stock.`,
        bullets: [named.lastUnitCost ? `Last unit cost: ${naira.format(named.lastUnitCost)}/${named.unit}.` : "No unit cost recorded yet.", "Use Inventory to add stock or record usage."],
        actions: [{ label: "Open Inventory", tab: "inputs" }],
        source: "rules"
      };
    }
    if (needs.length) {
      return {
        answer: `Stock will not cover your active plans — ${needs.length} item(s) need restocking.`,
        bullets: needs.map((n) => `Buy ${formatQty(n.shortfall, n.item.unit)} of ${n.item.name} (have ${formatQty(n.stock, n.item.unit)}, need ${formatQty(n.reserved, n.item.unit)})${n.estCost ? ` ≈ ${naira.format(n.estCost)}` : ""}`),
        actions: [{ label: "Open Inventory", tab: "inputs" }, { label: "Open Planting Planner", tab: "planting-planner" }],
        source: "rules"
      };
    }
    return {
      answer: "Stock covers all planned inputs — you have enough to plant.",
      bullets: safeArray(data.inventoryItems).slice(0, 6).map((item) => `${item.name}: ${formatQty(itemStock(data, item.id), item.unit)}`),
      actions: [{ label: "Open Inventory", tab: "inputs" }],
      source: "rules"
    };
  }

  // Account book — "are we making money", "cash position", "losing money"
  if (q.includes("account") || q.includes("cash") || q.includes("making money") || q.includes("losing") || q.includes("balance") || q.includes("in the red") || q.includes("how much did we spend") || q.includes("sales")) {
    const net = netCashflow(data);
    return {
      answer: net >= 0
        ? `The farm is ${naira.format(net)} ahead so far — sales received exceed money spent.`
        : `The farm is ${naira.format(Math.abs(net))} in the red so far — money spent exceeds sales received.`,
      bullets: [
        `Money in (sales received): ${naira.format(moneyIn(data))}`,
        `Money out (stock + labour + expenses): ${naira.format(moneyOut(data))}`,
        `Still owed to you from sales: ${naira.format(receivables(data))}`
      ],
      actions: [{ label: "Open Sales & Accounts", tab: "accounts" }],
      source: "rules"
    };
  }

  // What changed / status / summary
  if (q.includes("change") || q.includes("recent") || q.includes("status") || q.includes("summary") || q.includes("overview") || q.includes("how is") || q.includes("how's")) {
    const insights = buildFarmInsights(data);
    const actions = insights.filter((i) => i.severity === "action");
    return {
      answer: actions.length
        ? `${actions.length} item(s) need action and ${insights.length - actions.length} are worth watching.`
        : "Nothing urgent right now. A few items are worth keeping an eye on.",
      bullets: insights.slice(0, 6).map((i) => `[${labelize(i.severity)}] ${i.title}`),
      actions: [{ label: "Open Farm Advisor", tab: "advisor" }],
      source: "rules"
    };
  }

  const insights = buildFarmInsights(data);
  const actions = setupActions(data);
  return {
    answer:
      "I can answer the question, but I need one more detail to make it useful. Tell me the crop, plot, pest, cost item or worker you mean. For example: 'how long does cucumber take?', 'how much to irrigate Acre A?', or 'what should I spray for whiteflies?'",
    bullets: insights.length ? insights.slice(0, 4).map((i) => `[${labelize(i.severity)}] ${i.title} — ${i.detail}`) : ["Start by setting up a plot/acre, crop profile and irrigation/material costs."],
    actions: actions.length ? actions : [{ label: "Open Dashboard", tab: "dashboard" }],
    source: "rules"
  };
}
