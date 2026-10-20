import type {
  CropProfile,
  FarmInputCost,
  FarmObservation,
  FarmOsData,
  FarmPlot,
  InventoryGroup,
  InventoryItem,
  IrrigationMaterial,
  LaborPayment,
  SalaryRun,
  SalaryAdjustment,
  StockMovement,
  WorkerAttendanceRecord,
  FarmWorker,
  PlantingPlan
} from "@/lib/farm-os-types";

export const farmToday = "2026-06-17";

export const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

export const numberFormat = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });

export function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

export function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Measurement abbreviations that never take a plural "s" (e.g. 2 kg, not 2 kgs).
const INVARIANT_UNITS = new Set(["kg", "g", "mg", "ml", "l", "cl", "ha", "cm", "m"]);

/** Pluralise a stock unit for a quantity: 1 bag, 2 bags, 1 bunch, 2 bunches, 2 kg. */
export function pluralizeUnit(unit: string, qty: number) {
  const u = (unit || "").trim();
  if (!u || Math.abs(qty) === 1) return u;
  if (INVARIANT_UNITS.has(u.toLowerCase())) return u;
  if (/(s|x|z|ch|sh)$/i.test(u)) return `${u}es`;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  return `${u}s`;
}

/** "1 bag", "2 bags", "2 kg" — quantity with a correctly pluralised unit. */
export function formatQty(qty: number, unit: string) {
  return `${numberFormat.format(qty)} ${pluralizeUnit(unit, qty)}`.trim();
}

// Common Nigerian crops and vegetables for seed/crop dropdowns.
export const NIGERIAN_CROP_OPTIONS = [
  "Tomato",
  "Bell pepper (Tatashe)",
  "Scotch bonnet (Ata rodo)",
  "Cayenne pepper (Shombo)",
  "Chilli pepper",
  "Habanero pepper",
  "Onion",
  "Spring onion",
  "Garlic",
  "Ginger",
  "Okra",
  "Garden egg",
  "Eggplant (Aubergine)",
  "Cucumber",
  "Watermelon",
  "Carrot",
  "Cabbage",
  "Lettuce",
  "Cauliflower",
  "Green beans",
  "Sweet corn",
  "Maize",
  "Ugu (Fluted pumpkin)",
  "Efo tete (Green amaranth)",
  "Ewedu (Jute leaf)",
  "Waterleaf",
  "Bitter leaf",
  "Scent leaf (Efirin)",
  "Spinach",
  "Soko (Celosia)",
  "Pumpkin",
  "Sweet potato",
  "Irish potato",
  "Cassava",
  "Yam",
  "Cocoyam",
  "Plantain",
  "Banana",
  "Groundnut",
  "Cowpea (Beans)",
  "Soybean",
  "Rice",
  "Sorghum",
  "Millet",
  "Sesame (Beniseed)",
  "Pineapple",
  "Pawpaw (Papaya)",
  "Pepper fruit",
  "Sugarcane"
];

export function calculatePlotArea(plot: Pick<FarmPlot, "length" | "width" | "sizeUnit">) {
  const area = Number(plot.length || 0) * Number(plot.width || 0);
  if (!area) {
    return { calculatedArea: 0, equivalentAcres: 0 };
  }
  const equivalentAcres = plot.sizeUnit === "feet" ? area / 43560 : area / 4046.8564224;
  return { calculatedArea: area, equivalentAcres };
}

export function daysBetween(start?: string, end = farmToday) {
  if (!start) return 0;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);
}

export function addDays(date?: string, days = 0) {
  if (!date) return "";
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function getPlotById(data: FarmOsData, plotId?: string) {
  return data.plots.find((plot) => plot.id === plotId);
}

export function getWorkerName(data: FarmOsData, workerId?: string) {
  if (!workerId) return "Unassigned";
  return data.workers.find((worker) => worker.id === workerId)?.name || "Unknown worker";
}

export function getPlotName(data: FarmOsData, plotId?: string) {
  if (!plotId) return "No plot";
  const plot = getPlotById(data, plotId);
  return plot ? `${plot.plotCode} - ${plot.plotName}` : "Unknown plot";
}

export function materialTotal(material: IrrigationMaterial) {
  return Number(material.quantity || 0) * Number(material.unitCost || 0);
}

export function calculateIrrigationSummary(materials: IrrigationMaterial[], acres = 1) {
  const total = materials.reduce((sum, item) => sum + materialTotal(item), 0);
  const reusable = materials.filter((item) => item.reusable).reduce((sum, item) => sum + materialTotal(item), 0);
  const consumable = total - reusable;
  const labor = materials
    .filter((item) => item.category === "installation_labor" || item.category === "maintenance" || item.category === "repairs")
    .reduce((sum, item) => sum + materialTotal(item), 0);
  const coveredAcres = materials.reduce((max, item) => Math.max(max, Number(item.requiredForAcres || 0)), 0) || acres || 1;
  const costPerAcre = total / Math.max(coveredAcres, 1);

  return {
    total,
    reusable,
    consumable,
    labor,
    maintenanceEstimate: Math.round(total * 0.08),
    costPerAcre,
    selectedPlotCost: costPerAcre * Math.max(acres, 0.01)
  };
}

export function calculateLaborBalance(payment: LaborPayment) {
  return Number(payment.amountDue || 0) - Number(payment.amountPaid || 0);
}

export function planCost(plan: PlantingPlan) {
  const fertilizerCost = Number(plan.selectedFertilizerCost ?? plan.fertilizerBudget ?? 0);
  return (
    Number(plan.seedCost || 0) +
    fertilizerCost +
    Number(plan.laborBudget || 0) +
    Number(plan.irrigationBudget || 0) +
    Number(plan.transportBudget || 0) +
    Number(plan.otherBudget || 0)
  );
}

export function expectedRevenue(plan: PlantingPlan) {
  return Number(plan.expectedTotalYield || 0) * Number(plan.expectedMarketPrice || 0);
}

export function expectedProfit(plan: PlantingPlan) {
  return expectedRevenue(plan) - planCost(plan);
}

export function profitMargin(plan: PlantingPlan) {
  const revenue = expectedRevenue(plan);
  return revenue > 0 ? (expectedProfit(plan) / revenue) * 100 : 0;
}

export function warningsForPlan(plot: FarmPlot | undefined, crop: CropProfile | undefined, plan: Partial<PlantingPlan>) {
  const warnings: string[] = [];
  if (!plot) warnings.push("Plot is missing");
  if (plot?.landStatus === "bushy") warnings.push("Plot is bushy");
  if (plot?.landStatus === "needs_clearing") warnings.push("Clearing needed before planting");
  if (plot?.landStatus === "waterlogged") warnings.push("Plot is waterlogged");
  if (plot && !plot.irrigated && crop?.waterNeed === "high") warnings.push("Crop has high water need and plot is not irrigated");
  if (plot && !plot.irrigated && crop?.irrigationRecommended) warnings.push("Plot is not irrigated but irrigation is recommended");
  if (plot?.rainFedSuitability === "poor") warnings.push("Rain-fed risk is high");
  if (!plan.selectedFertilizerCost && !plan.fertilizerBudget) warnings.push("Fertilizer plan missing");
  if (!plan.seedCost) warnings.push("Seed cost missing");
  if (!plan.expectedMarketPrice) warnings.push("Market price missing");
  return warnings;
}

export function calculateRegrowth(plot: FarmPlot) {
  const days = daysBetween(plot.dateLastCleared);
  const rainySeason = true;
  let expectedBushRegrowth: "low" | "medium" | "high" = "low";
  if (rainySeason && days >= 35) expectedBushRegrowth = "high";
  else if (rainySeason && days >= 21) expectedBushRegrowth = "medium";
  else if (!rainySeason && days >= 56) expectedBushRegrowth = "medium";

  const recommendedInspectionDate = addDays(plot.dateLastCleared, expectedBushRegrowth === "high" ? 42 : 56);
  const recommendedClearingDate = addDays(plot.dateLastCleared, expectedBushRegrowth === "high" ? 49 : 70);
  const recommendation = `${plot.plotCode} was last cleared ${days || "unknown"} days ago. Expected regrowth: ${expectedBushRegrowth}. ${
    expectedBushRegrowth === "high" ? "Inspect and budget clearing before planting." : "Keep monitoring before the next crop plan."
  }`;

  return {
    expectedBushRegrowth,
    recommendedInspectionDate,
    recommendedClearingDate,
    recommendation
  };
}

export function totalInputsForPlan(inputCosts: FarmInputCost[], planId?: string) {
  return inputCosts.filter((input) => input.plantingPlanId === planId).reduce((sum, input) => sum + Number(input.totalCost || 0), 0);
}

export function observationImpact(observations: FarmObservation[], planId?: string) {
  const related = observations.filter((observation) => observation.plantingPlanId === planId);
  return related.reduce(
    (acc, observation) => {
      acc.yieldImpact += Number(observation.expectedYieldImpact || 0);
      acc.costImpact += Number(observation.expectedCostImpact || 0);
      return acc;
    },
    { yieldImpact: 0, costImpact: 0 }
  );
}


export function calculateSalaryBalance(salaryRun: SalaryRun) {
  return Number(salaryRun.netPay || 0) - Number(salaryRun.amountPaid || 0);
}

export function calculateSalaryNetPay(input: Pick<SalaryRun, "baseRate" | "unitsWorked" | "bonuses" | "deductions" | "advancesRecovered">) {
  const grossPay = Number(input.baseRate || 0) * Number(input.unitsWorked || 0);
  const netPay = grossPay + Number(input.bonuses || 0) - Number(input.deductions || 0) - Number(input.advancesRecovered || 0);
  return {
    grossPay,
    netPay: Math.max(netPay, 0)
  };
}

export function workerAttendanceUnits(records: WorkerAttendanceRecord[], workerId?: string, periodStart?: string, periodEnd?: string) {
  return records
    .filter((record) => {
      if (workerId && record.workerId !== workerId) return false;
      if (periodStart && record.date < periodStart) return false;
      if (periodEnd && record.date > periodEnd) return false;
      return record.status !== "absent" && record.status !== "sick" && record.status !== "approved_leave";
    })
    .reduce((sum, record) => sum + Number(record.daysWorked || (record.status === "half_day" ? 0.5 : record.status === "present" ? 1 : 0)), 0);
}

export function workerAdjustmentsTotal(adjustments: SalaryAdjustment[], workerId?: string, periodStart?: string, periodEnd?: string, types?: SalaryAdjustment["adjustmentType"][]) {
  return adjustments
    .filter((adjustment) => {
      if (workerId && adjustment.workerId !== workerId) return false;
      if (periodStart && adjustment.date < periodStart) return false;
      if (periodEnd && adjustment.date > periodEnd) return false;
      if (types?.length && !types.includes(adjustment.adjustmentType)) return false;
      return adjustment.status !== "cancelled";
    })
    .reduce((sum, adjustment) => sum + Number(adjustment.amount || 0), 0);
}

// ---- Monthly salary payment tracking ----

export function ymKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function ymLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
}

/** Recent salary months (YYYY-MM) for a worker, from their start month (capped) up to the current month. */
export function salaryMonthKeys(startDate: string | undefined, now: Date, maxMonths = 6): string[] {
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  let begin = new Date(current);
  begin.setMonth(begin.getMonth() - (maxMonths - 1));
  if (startDate) {
    const s = new Date(`${startDate}T00:00:00`);
    if (!Number.isNaN(s.getTime())) {
      const startMonth = new Date(s.getFullYear(), s.getMonth(), 1);
      if (startMonth > begin) begin = startMonth;
    }
  }
  const keys: string[] = [];
  const cursor = new Date(begin);
  while (cursor <= current && keys.length < 24) {
    keys.push(ymKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

/** Salary for a month is due on the 1st of the FOLLOWING month. */
export function salaryDueDate(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 1); // month index m == next month (0-based input m-1)
}

/** A month is overdue if unpaid and more than `graceDays` past its due date. */
export function salaryMonthOverdue(key: string, monthsPaid: string[] | undefined, now: Date, graceDays = 2) {
  if ((monthsPaid || []).includes(key)) return false;
  const due = salaryDueDate(key);
  const deadline = new Date(due);
  deadline.setDate(deadline.getDate() + graceDays);
  return now > deadline;
}

export function workerExpectedPay(worker: FarmWorker, days = 1) {
  const rate = Number(worker.salaryOrDailyRate || 0);
  if (worker.employmentType === "monthly_worker") return rate;
  if (worker.employmentType === "weekly_worker") return rate * Math.max(days, 1);
  if (worker.employmentType === "contractor") return rate;
  return rate * Math.max(days, 1);
}

// ---- Cost intelligence (spec section L) ----

/** Total logged input cost grouped by plot. */
export function costPerPlot(data: FarmOsData) {
  const map = new Map<string, number>();
  for (const input of data.inputCosts) {
    if (!input.plotId) continue;
    map.set(input.plotId, (map.get(input.plotId) || 0) + Number(input.totalCost || 0));
  }
  return data.plots
    .map((plot) => ({ plot, total: map.get(plot.id) || 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Total labour exposure per worker: salary net pay + quick labour payments due. */
export function costPerWorker(data: FarmOsData) {
  return data.workers
    .map((worker) => {
      const salary = data.salaryRuns
        .filter((run) => run.workerId === worker.id && run.status !== "cancelled")
        .reduce((sum, run) => sum + Number(run.netPay || 0), 0);
      const quick = data.laborPayments
        .filter((payment) => payment.workerId === worker.id)
        .reduce((sum, payment) => sum + Number(payment.amountDue || 0), 0);
      const paid =
        data.salaryRuns.filter((run) => run.workerId === worker.id).reduce((sum, run) => sum + Number(run.amountPaid || 0), 0) +
        data.laborPayments.filter((payment) => payment.workerId === worker.id).reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
      // Standing monthly feeding/allowance counted across the months the worker
      // has been on the farm (at least one month once they have a start date).
      const months = worker.startDate ? Math.max(1, salaryMonthKeys(worker.startDate, new Date()).length) : Number(worker.monthlyFeedingCost || 0) ? 1 : 0;
      const feeding = Number(worker.monthlyFeedingCost || 0) * months;
      const total = salary + quick + feeding;
      return { worker, total, paid, balance: total - paid, feeding };
    })
    .sort((a, b) => b.total - a.total);
}

/** Logged input cost grouped by input category. */
export function costPerCategory(data: FarmOsData) {
  const map = new Map<string, number>();
  for (const input of data.inputCosts) {
    map.set(input.category, (map.get(input.category) || 0) + Number(input.totalCost || 0));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// ---- Irrigation plan builder (spec section C) ----

export type IrrigationBuildLine = {
  itemName: string;
  category: string;
  scaledQuantity: number;
  unit: string;
  unitCost: number;
  lineCost: number;
  reusable: boolean;
};

/**
 * Build a materials checklist + budget for irrigating a plot of the given acreage,
 * scaling each material from its "required for X acres" baseline.
 */
export function buildIrrigationPlanForAcres(materials: IrrigationMaterial[], acres: number) {
  const targetAcres = Math.max(acres, 0.01);
  const lines: IrrigationBuildLine[] = materials.map((material) => {
    const baseAcres = Math.max(Number(material.requiredForAcres || 1), 0.01);
    const scale = targetAcres / baseAcres;
    const scaledQuantity = Math.max(Math.ceil(Number(material.quantity || 0) * scale), material.reusable ? Number(material.quantity || 0) : 0);
    const lineCost = scaledQuantity * Number(material.unitCost || 0);
    return {
      itemName: material.itemName,
      category: material.category,
      scaledQuantity,
      unit: material.unit,
      unitCost: Number(material.unitCost || 0),
      lineCost,
      reusable: material.reusable
    };
  });
  const total = lines.reduce((sum, line) => sum + line.lineCost, 0);
  const reusable = lines.filter((line) => line.reusable).reduce((sum, line) => sum + line.lineCost, 0);
  const labor = lines
    .filter((line) => line.category === "installation_labor" || line.category === "maintenance" || line.category === "repairs")
    .reduce((sum, line) => sum + line.lineCost, 0);
  return {
    lines,
    total,
    reusable,
    consumable: total - reusable,
    labor,
    maintenanceEstimate: Math.round(total * 0.08),
    costPerAcre: total / targetAcres,
    acres: targetAcres
  };
}

// ---- Clearing method comparison (spec section D) ----

export type ClearingMethodOption = {
  method: string;
  estimatedCost: number;
  estimatedTime: string;
  approach: string;
  safetyNotes: string;
};

/**
 * Rough cost/time comparison of clearing methods for a plot, scaled by acreage.
 * Rates are per-acre baselines the farm can tune later.
 */
export function compareClearingMethods(acres: number): ClearingMethodOption[] {
  const a = Math.max(acres, 0.1);
  return [
    {
      method: "Manual labour",
      estimatedCost: Math.round(a * 70000),
      estimatedTime: `${Math.ceil(a * 4)} worker-days`,
      approach: "Cutlass slashing, raking and residue packing by hand.",
      safetyNotes: "Lowest chemical risk. Provide PPE, water and rest breaks."
    },
    {
      method: "Herbicide (chemical)",
      estimatedCost: Math.round(a * 38000),
      estimatedTime: "1 day spray + 7-10 days wait",
      approach: "Knockdown herbicide, then clear dead growth.",
      safetyNotes: "Use correct dose and PPE. Avoid drift near crops/water. Respect re-entry interval."
    },
    {
      method: "Mechanical (tractor/slasher)",
      estimatedCost: Math.round(a * 55000),
      estimatedTime: "0.5-1 day if machine available",
      approach: "Tractor slashing or ploughing where access allows.",
      safetyNotes: "Fastest for open land. Confirm machine access and operator availability."
    },
    {
      method: "Combined (chemical + manual)",
      estimatedCost: Math.round(a * 86000),
      estimatedTime: `${Math.ceil(a * 3)} worker-days + spray`,
      approach: "Spray heavy regrowth, then hand-finish edges and beds.",
      safetyNotes: "Balanced for stubborn bush. Sequence spray before manual finishing."
    }
  ].sort((x, y) => x.estimatedCost - y.estimatedCost);
}

// ---- Inventory: stock is DERIVED from movements (source of truth) ----

export const INVENTORY_GROUPS: { group: InventoryGroup; label: string }[] = [
  { group: "seed", label: "Seeds" },
  { group: "fertilizer", label: "Fertilizers" },
  { group: "crop_protection", label: "Crop protection" },
  { group: "other", label: "Other consumables" }
];

export function getInventoryItem(data: FarmOsData, itemId?: string) {
  return data.inventoryItems.find((item) => item.id === itemId);
}

/** Current quantity on hand for an item = sum(in) - sum(out). */
export function itemStock(data: FarmOsData, itemId: string) {
  let total = 0;
  for (const movement of data.stockMovements) {
    if (movement.itemId !== itemId) continue;
    const qty = Number(movement.quantity || 0);
    total += movement.direction === "in" ? qty : -qty;
  }
  return total;
}

/** Quantity still reserved by active planting plans (planned minus already drawn). */
export function itemReserved(data: FarmOsData, itemId: string) {
  let reserved = 0;
  for (const plan of data.plantingPlans) {
    if (plan.status === "completed" || plan.status === "cancelled") continue;
    const planned = (plan.plannedInputs || [])
      .filter((line) => line.itemId === itemId)
      .reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    if (planned <= 0) continue;
    const used = data.stockMovements
      .filter((m) => m.direction === "out" && m.plantingPlanId === plan.id && m.itemId === itemId)
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    reserved += Math.max(planned - used, 0);
  }
  return reserved;
}

/** Stock not already reserved by other plans. */
export function itemAvailable(data: FarmOsData, itemId: string) {
  return itemStock(data, itemId) - itemReserved(data, itemId);
}

/** Value of stock on hand at last known unit cost. */
export function itemValue(data: FarmOsData, item: InventoryItem) {
  return itemStock(data, item.id) * Number(item.lastUnitCost || 0);
}

export function inventoryValue(data: FarmOsData) {
  return data.inventoryItems.reduce((sum, item) => sum + itemValue(data, item), 0);
}

/** Total seeds on hand for a seed item (stock units × seeds per unit). */
export function seedsAvailable(data: FarmOsData, item: InventoryItem) {
  const per = Number(item.seedsPerUnit || 0);
  return per > 0 ? itemStock(data, item.id) * per : 0;
}

/** How many stock units a seed count needs (rounded up); falls back to the count itself. */
export function unitsForSeedCount(item: InventoryItem | undefined, seedCount: number) {
  const per = Number(item?.seedsPerUnit || 0);
  if (per > 0) return Math.ceil(Number(seedCount || 0) / per);
  return Number(seedCount || 0);
}

export function isLowStock(data: FarmOsData, item: InventoryItem) {
  const reorder = Number(item.reorderAt || 0);
  return reorder > 0 && itemStock(data, item.id) <= reorder;
}

export type PlanRequirementLine = {
  itemId: string;
  item?: InventoryItem;
  name: string;
  unit: string;
  required: number;
  used: number;
  remaining: number;
  stock: number;
  available: number;
  shortfall: number;
};

/** Per-input required vs available for a single plan. */
export function planRequirements(data: FarmOsData, plan: PlantingPlan): PlanRequirementLine[] {
  return (plan.plannedInputs || []).map((line) => {
    const item = getInventoryItem(data, line.itemId);
    const required = Number(line.quantity || 0);
    const used = data.stockMovements
      .filter((m) => m.direction === "out" && m.plantingPlanId === plan.id && m.itemId === line.itemId)
      .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    const remaining = Math.max(required - used, 0);
    const stock = itemStock(data, line.itemId);
    // available for THIS plan = stock minus what other plans reserve
    const reservedByOthers = Math.max(itemReserved(data, line.itemId) - remaining, 0);
    const available = stock - reservedByOthers;
    return {
      itemId: line.itemId,
      item,
      name: item?.name || "Unknown item",
      unit: item?.unit || "",
      required,
      used,
      remaining,
      stock,
      available,
      shortfall: Math.max(remaining - available, 0)
    };
  });
}

export type ProcurementNeed = {
  item: InventoryItem;
  stock: number;
  reserved: number;
  shortfall: number;
  estCost: number;
};

/** Items where active plans reserve more than is in stock — what to buy. */
export function procurementNeeds(data: FarmOsData): ProcurementNeed[] {
  return data.inventoryItems
    .map((item) => {
      const stock = itemStock(data, item.id);
      const reserved = itemReserved(data, item.id);
      const shortfall = Math.max(reserved - stock, 0);
      return { item, stock, reserved, shortfall, estCost: shortfall * Number(item.lastUnitCost || 0) };
    })
    .filter((need) => need.shortfall > 0)
    .sort((a, b) => b.estCost - a.estCost);
}

/** Cost of a plan's planned inputs derived from current inventory unit costs. */
export function planInputCost(data: FarmOsData, plan: PlantingPlan) {
  return (plan.plannedInputs || []).reduce((sum, line) => {
    const item = getInventoryItem(data, line.itemId);
    return sum + Number(line.quantity || 0) * Number(item?.lastUnitCost || 0);
  }, 0);
}

// ---- Account book: actual cash in vs out ----

export function movementCost(movement: StockMovement) {
  const total = Number(movement.totalCost || 0);
  if (total) return total;
  return Number(movement.unitCost || 0) * Number(movement.quantity || 0);
}

/** Money spent buying stock (purchases only — opening balances are pre-owned). */
export function inventoryPurchaseTotal(data: FarmOsData) {
  return data.stockMovements
    .filter((m) => m.direction === "in" && m.acquisition === "purchase")
    .reduce((sum, m) => sum + movementCost(m), 0);
}

/** Non-stock "other expenses". */
export function expenseTotal(data: FarmOsData) {
  return data.inputCosts.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
}

/** Labour + salary actually paid out. */
export function laborPaidTotal(data: FarmOsData) {
  const labor = data.laborPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const salary = (data.salaryRuns || []).reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
  return labor + salary;
}

export function moneyOut(data: FarmOsData) {
  return inventoryPurchaseTotal(data) + expenseTotal(data) + laborPaidTotal(data);
}

export function moneyIn(data: FarmOsData) {
  return (data.sales || []).reduce((sum, sale) => sum + Number(sale.amountReceived || 0), 0);
}

export function netCashflow(data: FarmOsData) {
  return moneyIn(data) - moneyOut(data);
}

/** Money still owed to the farm from sales. */
export function receivables(data: FarmOsData) {
  return (data.sales || []).reduce(
    (sum, sale) => sum + Math.max(Number(sale.total || 0) - Number(sale.amountReceived || 0), 0),
    0
  );
}

/** Money the farm still owes (labour + salary balances). */
export function payables(data: FarmOsData) {
  const labor = data.laborPayments.reduce((sum, p) => sum + calculateLaborBalance(p), 0);
  const salary = (data.salaryRuns || []).reduce((sum, r) => sum + calculateSalaryBalance(r), 0);
  return Math.max(labor, 0) + Math.max(salary, 0);
}

export function accountBreakdown(data: FarmOsData) {
  return {
    inventoryPurchases: inventoryPurchaseTotal(data),
    labor: laborPaidTotal(data),
    otherExpenses: expenseTotal(data)
  };
}

/** Actual cost vs actual revenue attributed to a single plan. */
export function planActuals(data: FarmOsData, planId: string) {
  const usedCost = data.stockMovements
    .filter((m) => m.direction === "out" && m.plantingPlanId === planId)
    .reduce((sum, m) => {
      const item = getInventoryItem(data, m.itemId);
      return sum + Number(m.quantity || 0) * Number(item?.lastUnitCost || 0);
    }, 0);
  const expense = data.inputCosts
    .filter((i) => i.plantingPlanId === planId)
    .reduce((sum, i) => sum + Number(i.totalCost || 0), 0);
  const cost = usedCost + expense;
  const linkedSales = (data.sales || []).filter((s) => s.plantingPlanId === planId);
  const revenue = linkedSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const received = linkedSales.reduce((sum, s) => sum + Number(s.amountReceived || 0), 0);
  return { cost, revenue, received, profit: revenue - cost };
}

// ---- One-time migration to the inventory model (schemaVersion 2) ----

const STOCK_INPUT_CATEGORIES = new Set([
  "seeds",
  "fertilizer",
  "manure",
  "pesticide",
  "insecticide",
  "herbicide",
  "fungicide"
]);

function groupForInputCategory(category: string): InventoryGroup {
  if (category === "seeds") return "seed";
  if (category === "fertilizer" || category === "manure") return "fertilizer";
  if (["pesticide", "insecticide", "herbicide", "fungicide"].includes(category)) return "crop_protection";
  return "other";
}

/**
 * Ensure new arrays exist and migrate legacy seed/fertilizer/protection/input-cost
 * data into the unified inventory model. Idempotent: runs once (schemaVersion >= 2).
 */
export function normalizeFarmData(input: FarmOsData): FarmOsData {
  // Legacy label cleanup — runs on every load, independent of schema version.
  // Old records saved the combined option "Garden egg (Eggplant)"; rewrite to "Garden egg"
  // (does not touch the separate "Eggplant (Aubergine)" option).
  let source = input;
  try {
    const json = JSON.stringify(input);
    if (json.includes("Garden egg (Eggplant)")) {
      source = JSON.parse(json.split("Garden egg (Eggplant)").join("Garden egg")) as FarmOsData;
    }
  } catch {
    // keep original on any parse issue
  }

  const data: FarmOsData = {
    ...source,
    inventoryItems: source.inventoryItems || [],
    stockMovements: source.stockMovements || [],
    sales: source.sales || [],
    inputCosts: source.inputCosts || [],
    seedRecords: source.seedRecords || [],
    fertilizerRecords: source.fertilizerRecords || [],
    cropProtectionRecords: source.cropProtectionRecords || []
  };
  if ((data.schemaVersion || 0) >= 2) return data;

  const items: InventoryItem[] = [...data.inventoryItems];
  const movements: StockMovement[] = [...data.stockMovements];
  const today = farmToday;

  const pushItem = (partial: Omit<InventoryItem, "id">): InventoryItem => {
    const item: InventoryItem = { id: makeId("inv"), ...partial };
    items.push(item);
    return item;
  };
  const openingMovement = (itemId: string, quantity: number, unitCost?: number, date?: string, supplier?: string) => {
    const qty = Number(quantity || 0);
    const cost = Number(unitCost || 0);
    movements.push({
      id: makeId("mv"),
      itemId,
      date: date || today,
      direction: "in",
      quantity: qty,
      acquisition: "opening_balance",
      unitCost: cost || undefined,
      totalCost: cost ? qty * cost : undefined,
      supplier
    });
  };

  for (const seed of data.seedRecords) {
    const item = pushItem({
      group: "seed",
      name: seed.variety ? `${seed.cropName} (${seed.variety})` : seed.cropName,
      category: seed.cropName,
      unit: seed.unit,
      lastUnitCost: seed.unitCost,
      supplier: seed.supplier,
      cropName: seed.cropName,
      variety: seed.variety,
      germinationRate: seed.expectedGerminationRate,
      notes: seed.notes
    });
    if (Number(seed.quantity || 0) > 0) openingMovement(item.id, seed.quantity, seed.unitCost, seed.purchaseDate, seed.supplier);
  }

  for (const fert of data.fertilizerRecords) {
    const item = pushItem({
      group: "fertilizer",
      name: fert.fertilizerName,
      category: fert.category,
      unit: fert.unit,
      lastUnitCost: fert.unitCost,
      supplier: fert.supplier,
      nutrientFocus: fert.nutrientFocus,
      preferredStage: fert.preferredStage,
      notes: fert.notes
    });
    if (Number(fert.quantityAvailable || 0) > 0) openingMovement(item.id, fert.quantityAvailable || 0, fert.unitCost, today, fert.supplier);
  }

  for (const prot of data.cropProtectionRecords) {
    const item = pushItem({
      group: "crop_protection",
      name: prot.productName,
      category: prot.category,
      unit: prot.unit,
      lastUnitCost: prot.unitCost,
      supplier: prot.supplier,
      target: prot.target,
      notes: prot.notes
    });
    if (Number(prot.quantityAvailable || 0) > 0) openingMovement(item.id, prot.quantityAvailable || 0, prot.unitCost, today, prot.supplier);
  }

  const remainingExpenses: FarmInputCost[] = [];
  for (const cost of data.inputCosts) {
    if (!STOCK_INPUT_CATEGORIES.has(cost.category)) {
      remainingExpenses.push(cost);
      continue;
    }
    const group = groupForInputCategory(cost.category);
    let item = items.find((i) => i.group === group && i.name.toLowerCase() === (cost.itemName || "").toLowerCase());
    if (!item) {
      item = pushItem({
        group,
        name: cost.itemName || labelize(cost.category),
        category: cost.category,
        unit: cost.unit || "unit",
        lastUnitCost: cost.unitCost,
        supplier: cost.supplier
      });
    } else if (cost.unitCost) {
      item.lastUnitCost = cost.unitCost;
    }
    const qty = Number(cost.quantity || 0);
    movements.push({
      id: makeId("mv"),
      itemId: item.id,
      date: cost.date || today,
      direction: "in",
      quantity: qty > 0 ? qty : 0,
      acquisition: "purchase",
      unitCost: cost.unitCost,
      totalCost: Number(cost.totalCost || 0),
      supplier: cost.supplier,
      plotId: cost.plotId,
      plantingPlanId: cost.plantingPlanId,
      notes: cost.purpose || cost.notes
    });
  }

  return {
    ...data,
    inventoryItems: items,
    stockMovements: movements,
    inputCosts: remainingExpenses,
    seedRecords: [],
    fertilizerRecords: [],
    cropProtectionRecords: [],
    schemaVersion: 2
  };
}
