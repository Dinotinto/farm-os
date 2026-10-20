import type { FarmOsData } from "@/lib/farm-os-types";

// Iteration 3 starts as a clean working system, not a demo database.
// Users can build their own farm records from scratch. Prepared templates now live in the UI
// as selectable helpers, not as forced records.
export const defaultFarmOsData: FarmOsData = {
  plots: [],
  irrigationMaterials: [],
  irrigationPlans: [],
  clearingPlans: [],
  regrowthAssessments: [],
  cropProfiles: [],
  plantingPlans: [],
  inventoryItems: [],
  stockMovements: [],
  sales: [],
  inputCosts: [],
  seedRecords: [],
  fertilizerRecords: [],
  cropProtectionRecords: [],
  tasks: [],
  workers: [],
  laborPayments: [],
  attendanceRecords: [],
  salaryAdjustments: [],
  salaryRuns: [],
  weeklyPlans: [],
  marketPrices: [],
  yieldForecasts: [],
  observations: []
};
