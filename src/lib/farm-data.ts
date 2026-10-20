export type CropCycle = {
  id: string;
  crop: string;
  variety: string;
  stage: string;
  nurseryDate: string;
  transplantDate: string;
  plot: string;
  plants: number;
  inputCost: number;
  projectedRevenue: number;
  notes: string;
};

export type FarmTask = {
  id: string;
  title: string;
  crop: string;
  due: string;
  type: string;
  status: "Open" | "Planned" | "Done";
};

export type InventoryItem = {
  id: string;
  item: string;
  category: string;
  stock: number;
  unit: string;
  reorderAt: number;
  value: number;
};

export type Plot = {
  id: string;
  name: string;
  crop: string;
  size: string;
  health: string;
  score: number;
};

export type FarmLog = {
  id: string;
  date: string;
  activity: string;
  subject: string;
  amount: number;
  notes: string;
};

export const cropCycles: CropCycle[] = [
  {
    id: "cc-001",
    crop: "Tomatoes",
    variety: "Roma VF",
    stage: "Nursery",
    nurseryDate: "2026-06-02",
    transplantDate: "2026-07-02",
    plot: "Nursery House A",
    plants: 1850,
    inputCost: 232000,
    projectedRevenue: 780000,
    notes: "Harden seedlings one week before transplanting."
  },
  {
    id: "cc-002",
    crop: "Pepper",
    variety: "Cayenne",
    stage: "Nursery",
    nurseryDate: "2026-05-20",
    transplantDate: "2026-07-08",
    plot: "Nursery House B",
    plants: 1200,
    inputCost: 176000,
    projectedRevenue: 620000,
    notes: "Prepare ridges and manure before field transfer."
  },
  {
    id: "cc-003",
    crop: "Cucumber",
    variety: "Marketmore",
    stage: "Flowering",
    nurseryDate: "Direct seeded",
    transplantDate: "2026-05-28",
    plot: "Field 2",
    plants: 920,
    inputCost: 318000,
    projectedRevenue: 910000,
    notes: "Scout beetles twice weekly while flowering."
  },
  {
    id: "cc-004",
    crop: "Garden egg",
    variety: "Long purple",
    stage: "Transplanted",
    nurseryDate: "2026-04-28",
    transplantDate: "2026-06-11",
    plot: "Field 1",
    plants: 760,
    inputCost: 151000,
    projectedRevenue: 470000,
    notes: "First top dressing due after establishment."
  },
  {
    id: "cc-005",
    crop: "Plantain",
    variety: "Agbagba",
    stage: "Establishment",
    nurseryDate: "Suckers bought",
    transplantDate: "2026-04-15",
    plot: "Perennial Block",
    plants: 310,
    inputCost: 540000,
    projectedRevenue: 1450000,
    notes: "Track profit over a longer cycle than vegetables."
  }
];

export const farmTasks: FarmTask[] = [
  { id: "t-001", title: "Harden tomato seedlings", crop: "Tomatoes", due: "2026-06-24", type: "Nursery", status: "Open" },
  { id: "t-002", title: "Inspect cucumber for beetles", crop: "Cucumber", due: "2026-06-18", type: "Pest scouting", status: "Open" },
  { id: "t-003", title: "Apply NPK to garden egg", crop: "Garden egg", due: "2026-06-20", type: "Fertilizer", status: "Open" },
  { id: "t-004", title: "Prepare pepper field ridges", crop: "Pepper", due: "2026-06-29", type: "Field prep", status: "Planned" }
];

export const inventoryItems: InventoryItem[] = [
  { id: "i-001", item: "NPK 15-15-15", category: "Fertilizer", stock: 14, unit: "bags", reorderAt: 6, value: 490000 },
  { id: "i-002", item: "Tomato seed", category: "Seed", stock: 3, unit: "packs", reorderAt: 2, value: 78000 },
  { id: "i-003", item: "Organic manure", category: "Soil input", stock: 22, unit: "bags", reorderAt: 8, value: 154000 },
  { id: "i-004", item: "Harvest crates", category: "Packaging", stock: 64, unit: "crates", reorderAt: 20, value: 256000 }
];

export const plots: Plot[] = [
  { id: "p-001", name: "Field 1", crop: "Garden egg", size: "0.45 ha", health: "Good", score: 78 },
  { id: "p-002", name: "Field 2", crop: "Cucumber", size: "0.35 ha", health: "Watch pests", score: 66 },
  { id: "p-003", name: "Perennial Block", crop: "Plantain", size: "0.8 ha", health: "Stable", score: 82 }
];

export const farmLogs: FarmLog[] = [
  { id: "l-001", date: "2026-06-17", activity: "Inspection", subject: "Cucumber - Field 2", amount: 0, notes: "Flowering well. Watch pest pressure." },
  { id: "l-002", date: "2026-06-16", activity: "Purchase", subject: "NPK 15-15-15", amount: 210000, notes: "6 bags bought for vegetable blocks." },
  { id: "l-003", date: "2026-06-14", activity: "Labor", subject: "Garden egg - Field 1", amount: 45000, notes: "Weeding and gap filling." }
];

export const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
});

export function daysUntil(dateValue: string) {
  const today = new Date("2026-06-17T00:00:00");
  const date = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}
