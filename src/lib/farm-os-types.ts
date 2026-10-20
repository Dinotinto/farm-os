export type SizeUnit = "feet" | "meters";
export type IrrigationStatus = "none" | "planned" | "partial" | "active" | "needs_repair" | "not_required";
export type LandStatus =
  | "ready"
  | "bushy"
  | "planted"
  | "fallow"
  | "waterlogged"
  | "needs_clearing"
  | "recently_cleared"
  | "needs_herbicide"
  | "needs_manual_labor"
  | "needs_ploughing"
  | "needs_ridging"
  | "needs_manure"
  | "too_dry"
  | "under_cultivation";
export type RainFedSuitability = "good" | "moderate" | "poor" | "unknown";

export type FarmPlot = {
  id: string;
  plotName: string;
  plotCode: string;
  measuredSize: string;
  measurementFormat: "rectangular" | "irregular" | "manual";
  length?: number;
  width?: number;
  sizeUnit: SizeUnit;
  calculatedArea?: number;
  equivalentAcres?: number;
  irrigated: boolean;
  irrigationStatus: IrrigationStatus;
  landStatus: LandStatus;
  currentCrop?: string;
  previousCrop?: string;
  soilNotes?: string;
  rainFedSuitability: RainFedSuitability;
  accessNotes?: string;
  dateLastCleared?: string;
  dateLastPlanted?: string;
  dateLastInspected?: string;
  notes?: string;
};

export type IrrigationCategory =
  | "water_source"
  | "pump"
  | "pipes"
  | "main_lines"
  | "sub_main_lines"
  | "drip_lines"
  | "sprinklers"
  | "connectors"
  | "valves"
  | "filters"
  | "water_tank"
  | "borehole_well_setup"
  | "solar_inverter_electric_power"
  | "fuel_setup"
  | "hoses"
  | "pressure_regulators"
  | "end_caps"
  | "tapes_fittings"
  | "storage"
  | "transport"
  | "installation_labor"
  | "maintenance"
  | "repairs"
  | "miscellaneous";

export type IrrigationMaterial = {
  id: string;
  itemName: string;
  category: IrrigationCategory;
  specification?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  supplier?: string;
  requiredForAcres?: number;
  reusable: boolean;
  lifespan?: string;
  notes?: string;
};

export type IrrigationPlan = {
  id: string;
  plotId: string;
  irrigationMethod: "drip" | "sprinkler" | "rain_gun" | "manual" | "furrow" | "mixed";
  waterSource?: string;
  materialsNeeded: string[];
  laborNeeded?: string;
  estimatedSetupTime?: string;
  expectedCost?: number;
  expectedMaintenanceCost?: number;
  expectedBenefit?: string;
  status: "draft" | "planned" | "in_progress" | "completed" | "cancelled";
  notes?: string;
};

export type LandClearingPlan = {
  id: string;
  plotId: string;
  currentCondition: LandStatus;
  recommendedMethod:
    | "manual_labor"
    | "herbicide"
    | "mechanical_clearing"
    | "slashing"
    | "burning_if_allowed_safe"
    | "ploughing"
    | "ridging"
    | "combined_method";
  laborRequired?: string;
  chemicalRequired?: string;
  equipmentRequired?: string;
  estimatedCost?: number;
  estimatedTime?: string;
  safetyNotes?: string;
  datePlanned?: string;
  dateCompleted?: string;
  status: "draft" | "planned" | "in_progress" | "completed" | "cancelled";
  notes?: string;
};

export type PlotRegrowthAssessment = {
  id: string;
  plotId: string;
  season: "rainy" | "dry" | "unknown";
  lastClearedDate?: string;
  rainIntensityAssumption: "low" | "medium" | "high";
  plotCondition?: string;
  expectedBushRegrowth: "low" | "medium" | "high";
  recommendedInspectionDate?: string;
  recommendedClearingDate?: string;
  recommendation?: string;
};

export type CropProfile = {
  id: string;
  cropName: string;
  plantingMethod: "nursery" | "direct" | "suckers" | "mixed";
  nurseryRequired: boolean;
  nurseryDurationDays?: number;
  directPlantingAllowed: boolean;
  waterNeed: "low" | "medium" | "high";
  irrigationRecommended: boolean;
  expectedDurationToHarvestDays?: number;
  harvestWindow?: string;
  expectedYieldPerAcre?: number;
  expectedYieldPerPlant?: number;
  marketUnit: "kg" | "ton" | "crate" | "bag" | "basket" | "piece" | "bunch";
  commonFertilizerStages: string[];
  commonPestRisks: string[];
  commonCareTasks: string[];
  notes?: string;
};

export type PlanInputLine = {
  itemId: string;
  quantity: number;
  stage?: string;
};

export type PlantingPlan = {
  id: string;
  cropProfileId: string;
  plotId: string;
  cropName: string;
  variety?: string;
  plannedPlantingDate?: string;
  plannedNurseryDate?: string;
  expectedTransplantDate?: string;
  expectedHarvestStartDate?: string;
  expectedHarvestEndDate?: string;
  seedCost?: number;
  fertilizerBudget?: number;
  laborBudget?: number;
  irrigationBudget?: number;
  transportBudget?: number;
  otherBudget?: number;
  seedCount?: number;
  expectedYieldPerAcre?: number;
  expectedYieldPerPlant?: number;
  expectedTotalYield?: number;
  expectedMarketPrice?: number;
  expectedMarketUnit?: "kg" | "ton" | "crate" | "bag" | "basket" | "piece" | "bunch";
  selectedFertilizerIds?: string[];
  selectedFertilizerCost?: number;
  // Inputs this plan intends to draw from inventory (reservation). Stock is only
  // deducted when usage is recorded as an "out" StockMovement tied to this plan.
  plannedInputs?: PlanInputLine[];
  expectedRevenue?: number;
  expectedProfit?: number;
  warnings: string[];
  status: "draft" | "approved" | "active" | "completed" | "cancelled";
  notes?: string;
};

// ---- Unified inventory (source of truth) ----
// Stock items are grouped, and the quantity on hand is DERIVED from StockMovement
// rows (never stored statically). Legacy SeedRecord/FertilizerRecord/
// CropProtectionRecord below are kept only so old data can be migrated once.

export type InventoryGroup = "seed" | "fertilizer" | "crop_protection" | "other";

export type InventoryItem = {
  id: string;
  group: InventoryGroup;
  name: string;
  // Sub-category: fertilizer -> NPK/urea/...; crop_protection -> insecticide/fungicide/...;
  // seed -> crop name; other -> free text.
  category: string;
  unit: string;
  reorderAt?: number;
  lastUnitCost?: number;
  supplier?: string;
  // group-specific optional metadata
  cropName?: string;
  variety?: string;
  germinationRate?: number;
  // Seeds: how many seeds are in one stock unit (e.g. 1 pack = 1000 seeds, or
  // seeds per gram). Lets the planner convert a seed count into units to deplete.
  seedsPerUnit?: number;
  nutrientFocus?: string;
  preferredStage?: string;
  target?: string;
  notes?: string;
};

export type StockInAcquisition = "purchase" | "gift" | "own_production" | "opening_balance" | "other";
export type StockOutUsage = "planting_plan" | "treatment" | "land_prep" | "wastage" | "other";

export type StockMovement = {
  id: string;
  itemId: string;
  date: string;
  direction: "in" | "out";
  quantity: number; // always positive
  // IN
  acquisition?: StockInAcquisition;
  unitCost?: number;
  totalCost?: number;
  supplier?: string;
  // OUT
  usage?: StockOutUsage;
  plotId?: string;
  plantingPlanId?: string;
  destination?: string;
  notes?: string;
  // Optional compressed receipt/photo as a data URL (audit trail).
  photoDataUrl?: string;
};

export type SaleRecord = {
  id: string;
  date: string;
  cropName: string;
  plantingPlanId?: string;
  plotId?: string;
  buyer?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  amountReceived: number;
  paymentStatus: "paid" | "part" | "unpaid";
  notes?: string;
};

export type SeedRecord = {
  id: string;
  cropName: string;
  cropProfileId?: string;
  variety?: string;
  supplier?: string;
  quantity: number;
  unit: string;
  unitCost: number;
  expectedGerminationRate?: number;
  purchaseDate?: string;
  batchNumber?: string;
  notes?: string;
};

export type FertilizerRecord = {
  id: string;
  fertilizerName: string;
  category: "NPK" | "urea" | "organic" | "foliar" | "calcium" | "potassium" | "other";
  nutrientFocus?: string;
  quantityAvailable?: number;
  unit: "bag" | "kg" | "litre" | "bottle" | "sachet" | "ton" | "other";
  unitCost: number;
  supplier?: string;
  preferredStage?: string;
  notes?: string;
};

export type CropProtectionRecord = {
  id: string;
  productName: string;
  category: "insecticide" | "fungicide" | "herbicide" | "nematicide" | "miticide" | "other";
  target?: string;
  unit: "litre" | "bottle" | "sachet" | "kg" | "ml" | "bag" | "other";
  unitCost: number;
  quantityAvailable?: number;
  supplier?: string;
  notes?: string;
};

// "Other expenses" ledger: non-stock costs only (labor, irrigation, transport,
// packaging, equipment_rental, fuel, miscellaneous). Stock purchases (seeds,
// fertilizer, chemicals) now flow through InventoryItem + StockMovement instead.
// The wider category union is retained so legacy rows can be migrated.
export type FarmInputCost = {
  id: string;
  cropCycleId?: string;
  plantingPlanId?: string;
  plotId?: string;
  category:
    | "seeds"
    | "fertilizer"
    | "manure"
    | "pesticide"
    | "insecticide"
    | "herbicide"
    | "fungicide"
    | "labor"
    | "irrigation"
    | "transport"
    | "packaging"
    | "equipment_rental"
    | "fuel"
    | "miscellaneous";
  itemName: string;
  date: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  totalCost: number;
  supplier?: string;
  purpose?: string;
  stage?: string;
  notes?: string;
};

export type FarmWorker = {
  id: string;
  name: string;
  phoneNumber?: string;
  role?: string;
  employmentType: "daily_worker" | "weekly_worker" | "monthly_worker" | "contractor";
  salaryOrDailyRate?: number;
  // Standing monthly feeding/allowance cost the farm pays for this worker.
  monthlyFeedingCost?: number;
  startDate?: string;
  status: "active" | "inactive" | "suspended" | "left";
  skills: string[];
  notes?: string;
  // Months (YYYY-MM) whose salary has been paid. Used by the monthly pay grid + reminders.
  monthsPaid?: string[];
};

export type LaborPayment = {
  id: string;
  workerId: string;
  payPeriod?: string;
  amountDue: number;
  amountPaid: number;
  paymentDate?: string;
  paymentMethod?: "cash" | "bank_transfer" | "mobile_money" | "other";
  notes?: string;
};

export type FarmTask = {
  id: string;
  taskTitle: string;
  taskType:
    | "clearing"
    | "nursery_work"
    | "planting"
    | "transplanting"
    | "watering"
    | "fertilizer"
    | "spraying"
    | "weeding"
    | "harvesting"
    | "packing"
    | "transport"
    | "irrigation_repair"
    | "inspection"
    | "market_survey"
    | "other";
  cropName?: string;
  plantingPlanId?: string;
  plotId?: string;
  assignedWorkerId?: string;
  dueDate: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  completedAt?: string;
};

export type WeeklyWorkPlan = {
  id: string;
  workerId: string;
  weekStartDate: string;
  weekEndDate: string;
  assignedTaskIds: string[];
  plotId?: string;
  cropName?: string;
  status: "planned" | "in_progress" | "completed" | "missed";
  hoursWorked?: number;
  daysWorked?: number;
  expectedPay?: number;
  actualPay?: number;
  notes?: string;
};

export type MarketPriceRecord = {
  id: string;
  cropName: string;
  market?: string;
  unit: "kg" | "ton" | "crate" | "bag" | "basket" | "piece" | "bunch";
  price: number;
  dateChecked: string;
  source?: string;
  confidence: "low" | "medium" | "high";
  notes?: string;
};

export type YieldForecast = {
  id: string;
  plantingPlanId?: string;
  plotId: string;
  cropName: string;
  expectedYieldPerAcre?: number;
  expectedTotalYield?: number;
  expectedLossPercentage?: number;
  expectedMarketableYield?: number;
  marketPrice?: number;
  marketUnit?: "kg" | "ton" | "crate" | "bag" | "basket" | "piece" | "bunch";
  marketPriceSource?: string;
  expectedRevenue?: number;
  bestCaseRevenue?: number;
  worstCaseRevenue?: number;
  expectedProfit?: number;
  notes?: string;
};

export type FarmObservation = {
  id: string;
  observationType:
    | "pest_attack"
    | "disease"
    | "poor_germination"
    | "heavy_rainfall"
    | "dry_spell"
    | "flooding"
    | "fertilizer_delay"
    | "labor_delay"
    | "market_price_change"
    | "theft_loss"
    | "plant_stress"
    | "other";
  cropName?: string;
  plantingPlanId?: string;
  plotId?: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedArea?: string;
  expectedYieldImpact?: number;
  expectedCostImpact?: number;
  notes?: string;
  date: string;
  // Optional compressed photo of the pest/disease/issue as a data URL.
  photoDataUrl?: string;
};


export type WorkerAttendanceRecord = {
  id: string;
  workerId: string;
  date: string;
  plotId?: string;
  taskId?: string;
  status: "present" | "half_day" | "absent" | "sick" | "approved_leave";
  daysWorked?: number;
  hoursWorked?: number;
  workSummary?: string;
  notes?: string;
};

export type SalaryAdjustment = {
  id: string;
  workerId: string;
  date: string;
  adjustmentType: "bonus" | "deduction" | "advance" | "loan_repayment" | "transport" | "feeding" | "other";
  amount: number;
  reason?: string;
  status: "pending" | "approved" | "applied" | "cancelled";
  notes?: string;
};

export type SalaryRun = {
  id: string;
  workerId: string;
  periodStart: string;
  periodEnd: string;
  payBasis: "daily" | "weekly" | "monthly" | "contract";
  baseRate: number;
  unitsWorked: number;
  grossPay: number;
  bonuses: number;
  deductions: number;
  advancesRecovered: number;
  netPay: number;
  amountPaid: number;
  balance: number;
  status: "draft" | "approved" | "part_paid" | "paid" | "cancelled";
  paymentDate?: string;
  paymentMethod?: "cash" | "bank_transfer" | "mobile_money" | "other";
  notes?: string;
};

export type FarmOsData = {
  plots: FarmPlot[];
  irrigationMaterials: IrrigationMaterial[];
  irrigationPlans: IrrigationPlan[];
  clearingPlans: LandClearingPlan[];
  regrowthAssessments: PlotRegrowthAssessment[];
  cropProfiles: CropProfile[];
  plantingPlans: PlantingPlan[];
  // Unified inventory (source of truth)
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  sales: SaleRecord[];
  inputCosts: FarmInputCost[]; // now "other expenses" (non-stock)
  // Legacy stock lists — migrated into inventoryItems then emptied (kept as []).
  seedRecords: SeedRecord[];
  fertilizerRecords: FertilizerRecord[];
  cropProtectionRecords: CropProtectionRecord[];
  schemaVersion?: number;
  workers: FarmWorker[];
  laborPayments: LaborPayment[];
  attendanceRecords: WorkerAttendanceRecord[];
  salaryAdjustments: SalaryAdjustment[];
  salaryRuns: SalaryRun[];
  tasks: FarmTask[];
  weeklyPlans: WeeklyWorkPlan[];
  marketPrices: MarketPriceRecord[];
  yieldForecasts: YieldForecast[];
  observations: FarmObservation[];
};

export type FarmOsTab =
  | "dashboard"
  | "advisor"
  | "ask-ai"
  | "farm-map"
  | "irrigation"
  | "land-clearing"
  | "crop-catalog"
  | "planting-planner"
  | "inputs"
  | "accounts"
  | "tasks"
  | "workers"
  | "salary"
  | "market"
  | "forecasts"
  | "observations"
  | "calendar"
  | "messages"
  | "reports";
