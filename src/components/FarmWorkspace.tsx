"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Bell,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  CheckCheck,
  ClipboardList,
  Coins,
  Droplets,
  FileText,
  Gauge,
  Home,
  Leaf,
  Map,
  Menu,
  Mic,
  MicOff,
  Package,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Sprout,
  Wand2,
  Tractor,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
  LogOut,
  CalendarClock,
  Camera,
  MessageSquare
} from "lucide-react";
import { defaultFarmOsData } from "@/lib/farm-os-defaults";
import type {
  CropProfile,
  FarmInputCost,
  FarmObservation,
  FarmOsData,
  FarmOsTab,
  FarmPlot,
  FarmTask,
  FarmWorker,
  InventoryItem,
  IrrigationMaterial,
  PlanInputLine,
  SalaryAdjustment,
  SalaryRun,
  SaleRecord,
  StockMovement,
  WorkerAttendanceRecord,
  LandClearingPlan,
  MarketPriceRecord,
  PlantingPlan
} from "@/lib/farm-os-types";
import { FERTILIZER_CATALOG, PROTECTION_CATALOG, PROTECTION_GROUPS } from "@/lib/farm-os-catalogs";
import {
  buildIrrigationPlanForAcres,
  calculateIrrigationSummary,
  calculateLaborBalance,
  calculatePlotArea,
  calculateSalaryBalance,
  calculateSalaryNetPay,
  calculateRegrowth,
  compareClearingMethods,
  costPerCategory,
  costPerPlot,
  costPerWorker,
  expectedProfit,
  expectedRevenue,
  getPlotName,
  getWorkerName,
  labelize,
  makeId,
  naira,
  numberFormat,
  formatQty,
  pluralizeUnit,
  NIGERIAN_CROP_OPTIONS,
  observationImpact,
  planCost,
  profitMargin,
  salaryMonthKeys,
  salaryMonthOverdue,
  totalInputsForPlan,
  warningsForPlan,
  ymKey,
  ymLabel,
  INVENTORY_GROUPS,
  getInventoryItem,
  itemStock,
  itemReserved,
  itemAvailable,
  itemValue,
  inventoryValue,
  isLowStock,
  seedsAvailable,
  unitsForSeedCount,
  planRequirements,
  procurementNeeds,
  planInputCost,
  moneyIn,
  moneyOut,
  netCashflow,
  receivables,
  payables,
  accountBreakdown,
  planActuals,
  inventoryPurchaseTotal,
  normalizeFarmData
} from "@/lib/farm-os-calculations";
import {
  bestPlotsForCrop,
  buildFarmInsights,
  irrigationCostForPlot,
  profitByCrop,
  recentActivity,
  workerWeekPlan,
  type FarmInsight,
  type InsightCategory
} from "@/lib/farm-os-advisor";
import { cropStageGuidance, type CropStageInfo } from "@/lib/farm-os-stages";
import { answerFarmQuestion, suggestedQuestions, type AgentAnswer } from "@/lib/farm-os-agent";
import { useFarmNotifications, type FarmNotification } from "@/lib/farm-os-notifications";
import { LogoutButton } from "./LogoutButton";
import { useMessages, MessagesView } from "./Messages";

type FarmSpeechRecognitionEvent = Event & { results?: ArrayLike<ArrayLike<{ transcript?: string }>> };
type FarmSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: FarmSpeechRecognitionEvent) => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => FarmSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type IconType = typeof Home;

type NavItem = {
  id: FarmOsTab;
  label: string;
  icon: IconType;
};

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "advisor", label: "Farm Advisor", icon: Sparkles },
  { id: "ask-ai", label: "Ask AI", icon: Bot },
  { id: "farm-map", label: "Farm Map", icon: Map },
  { id: "irrigation", label: "Irrigation", icon: Droplets },
  { id: "land-clearing", label: "Land Clearing", icon: Tractor },
  { id: "crop-catalog", label: "Crop Catalog", icon: Leaf },
  { id: "planting-planner", label: "Planting Planner", icon: Sprout },
  { id: "inputs", label: "Inventory", icon: Package },
  { id: "accounts", label: "Sales & Accounts", icon: Coins },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "workers", label: "Workers", icon: Users },
  { id: "salary", label: "Salary & Payroll", icon: WalletCards },
  { id: "market", label: "Market Prices", icon: Gauge },
  { id: "forecasts", label: "Yield Forecast", icon: BarChart3 },
  { id: "observations", label: "Observations", icon: AlertTriangle },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "reports", label: "Reports", icon: FileText }
];

// Role-based access. Owner/manager run the whole farm; marketer is sales-focused
// and does not see payroll/operations; the (future) worker role sees only their
// tasks, calendar and the assistant — no financials. Adjust here as roles evolve.
const MARKETER_TABS: FarmOsTab[] = ["dashboard", "advisor", "ask-ai", "farm-map", "crop-catalog", "planting-planner", "market", "accounts", "forecasts", "observations", "calendar", "messages", "reports"];
const WORKER_TABS: FarmOsTab[] = ["dashboard", "tasks", "calendar", "messages", "ask-ai"];
function allowedTabsFor(role?: string): "all" | FarmOsTab[] {
  switch ((role || "").toLowerCase()) {
    case "marketer": return MARKETER_TABS;
    case "worker": return WORKER_TABS;
    default: return "all"; // owner, manager, or no role set
  }
}

const storageKey = "dinotinto-farm-os-iteration-v4-guided-ai-mobile";
const tabStorageKey = "dinotinto-farm-os-active-tab";

function cloneDefaults(): FarmOsData {
  return JSON.parse(JSON.stringify(defaultFarmOsData)) as FarmOsData;
}

function readSavedData(): FarmOsData {
  if (typeof window === "undefined") return cloneDefaults();
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return cloneDefaults();
    const parsed = JSON.parse(stored) as Partial<FarmOsData>;
    const defaults = cloneDefaults();
    return normalizeFarmData({ ...defaults, ...parsed });
  } catch {
    return cloneDefaults();
  }
}

function numberValue(formData: FormData, key: string) {
  const raw = String(formData.get(key) || "").replaceAll(",", "").trim();
  if (!raw) return undefined;
  return Number(raw);
}

function stringValue(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) || fallback).trim();
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function DashboardCard({ icon: Icon, label, value, hint, tone = "green" }: { icon: IconType; label: string; value: string | number; hint: string; tone?: "green" | "gold" | "danger" | "navy" | "warning" }) {
  const toneClass = tone === "danger" ? "text-[#b42318]" : tone === "gold" || tone === "warning" ? "text-[#d99a28]" : tone === "navy" ? "text-[#14213d]" : "text-[#0f8b6f]";
  return (
    <article className="dt-panel p-3 sm:p-4">
      <Icon className={toneClass} size={20} />
      <p className="mt-2 text-xs font-black text-[#4b5a76] sm:mt-3 sm:text-sm">{label}</p>
      <strong className="mt-0.5 block text-xl font-black text-[#14213d] sm:mt-1 sm:text-2xl">{value}</strong>
      <small className="mt-0.5 block text-xs leading-4 text-[#667085] sm:mt-1 sm:text-[0.8rem] sm:leading-5">{hint}</small>
    </article>
  );
}

// A record card that shows a compact summary row and expands its full detail on
// tap — so info-heavy lists (plans, tasks, workers) don't read as an endless
// scroll of big cards. Collapsed by default on mobile, open on desktop.
function ExpandableCard({ summary, badges, children, defaultOpen }: { summary: React.ReactNode; badges?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <article className="dt-panel p-3 sm:p-4">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)} type="button" aria-expanded={open}>
        <div className="min-w-0 flex-1">{summary}</div>
        {badges ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">{badges}</div> : null}
        <ChevronDown className={`shrink-0 text-[#667085] transition-transform ${open ? "rotate-180" : ""}`} size={18} />
      </button>
      {open ? <div className="mt-3 border-t border-[#edf1e7] pt-3">{children}</div> : null}
    </article>
  );
}

// A prominent "+ Add X" button that reveals a form below it (collapsed by
// default), so info tabs open to their records instead of a big form.
function AddSection({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="grid gap-3">
      <button
        className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black shadow-sm transition-colors ${open ? "border border-[#d8dece] bg-white text-[#4b5a76]" : "bg-[#0f8b6f] text-white"}`}
        onClick={onToggle}
        type="button"
      >
        {open ? <X size={16} /> : <Plus size={16} />} {open ? "Close" : label}
      </button>
      {open ? children : null}
    </div>
  );
}

// True on phone-width screens (below the lg breakpoint, where the bottom nav
// shows). Collapsing/pagination is a MOBILE-ONLY concern — on desktop everything
// renders open. Defaults to false so SSR + first client render match (desktop),
// then flips on mobile after mount.
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

// A whole panel that collapses to just its header row ON MOBILE, so info-heavy
// screens (Dashboard, Advisor, Inventory groups...) don't read as a wall of open
// cards. On desktop it always renders open (no chevron).
function CollapsibleSection({ eyebrow, title, badge, defaultOpen = false, children }: { eyebrow?: string; title: string; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(defaultOpen);
  const showContent = !isMobile || open;
  return (
    <section className="dt-panel p-4 sm:p-5">
      <button className="flex w-full items-center justify-between gap-3 text-left lg:cursor-default" onClick={() => isMobile && setOpen((o) => !o)} type="button" aria-expanded={showContent}>
        <div className="min-w-0">
          {eyebrow ? <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{eyebrow}</p> : null}
          <h2 className="text-lg font-black text-[#14213d]">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className={`text-[#667085] transition-transform lg:hidden ${open ? "rotate-180" : ""}`} size={18} />
        </div>
      </button>
      {showContent ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

// Caps a long list to `initial` rows with a "Show all (N)" toggle ON MOBILE; on
// desktop the full list always renders.
function ShowMoreList<T>({ items, initial = 5, noun = "items", render }: { items: T[]; initial?: number; noun?: string; render: (item: T, index: number) => React.ReactNode }) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const shown = !isMobile || expanded ? items : items.slice(0, initial);
  return (
    <>
      {shown.map(render)}
      {isMobile && items.length > initial ? (
        <button className="mt-1 w-full rounded-lg border border-[#d8dece] bg-white px-4 py-2.5 text-sm font-black text-[#0f8b6f]" onClick={() => setExpanded((e) => !e)} type="button">
          {expanded ? "Show less" : `Show all ${items.length} ${noun}`}
        </button>
      ) : null}
    </>
  );
}

function SectionHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
      <div>
        <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{eyebrow}</p>
        <h2 className="mt-0.5 text-lg font-black text-[#14213d] sm:mt-1 sm:text-2xl">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Pill({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "danger" | "warning" | "navy" }) {
  const className = tone === "danger" ? "dt-pill dt-pill-danger" : tone === "warning" ? "dt-pill dt-pill-warning" : tone === "navy" ? "dt-pill bg-[#e5e9f2] text-[#14213d]" : "dt-pill";
  return <span className={className}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-[#4b5a76]">
      {label}
      {children}
    </label>
  );
}

const inputClass = "min-h-11 w-full min-w-0 rounded-lg border border-[#d8dece] bg-white px-3 text-[#14213d] shadow-sm";
const textareaClass = "min-h-24 w-full min-w-0 rounded-lg border border-[#d8dece] bg-white p-3 text-[#14213d] shadow-sm";

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-[#d8dece] bg-[#fbfaf5] p-4 text-sm font-bold text-[#667085]">{text}</p>;
}

// Help/explainer for a page. Rendered at the BOTTOM (order-last) so each page
// opens straight to its own content; the "how this page works" note sits as a
// quiet footer for anyone who wants it.
function PageIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="order-last mt-2 rounded-2xl border border-[#e6e9df] bg-[#fbfcf9] p-5">
      <p className="text-xs font-black uppercase tracking-wide text-[#9aa39a]">How this page works</p>
      <h2 className="mt-1 text-base font-black text-[#4b5a76]">{title}</h2>
      <div className="mt-2 max-w-4xl text-sm font-bold leading-6 text-[#667085]">{children}</div>
    </section>
  );
}

function DeleteButton({ label = "Delete", onDelete }: { label?: string; onDelete: () => void }) {
  return (
    <button
      className="rounded-lg border border-[#fecdca] bg-[#fff4f2] px-3 py-2 text-xs font-black text-[#b42318]"
      onClick={() => {
        if (window.confirm("Delete this record? This cannot be undone from this screen.")) onDelete();
      }}
      type="button"
    >
      {label}
    </button>
  );
}


const NIGERIAN_FARM_ACRE_SQFT = 30000;
const STANDARD_ACRE_SQFT = 43560;

const plotSizeTemplates = [
  { label: "Nigerian farm acre / 300 × 100 ft", length: 300, width: 100, unit: "feet", hint: "30,000 sq ft ≈ 0.69 conventional acre" },
  { label: "Nigerian farm acre / 200 × 150 ft", length: 200, width: 150, unit: "feet", hint: "30,000 sq ft ≈ 0.69 conventional acre" },
  { label: "Half Nigerian farm acre / 150 × 100 ft", length: 150, width: 100, unit: "feet", hint: "15,000 sq ft ≈ 0.34 conventional acre" },
  { label: "Quarter Nigerian farm acre / 100 × 75 ft", length: 100, width: 75, unit: "feet", hint: "7,500 sq ft ≈ 0.17 conventional acre" },
  { label: "Custom measurement", length: 0, width: 0, unit: "feet", hint: "Enter the real length and width yourself" }
];

const cropProfileTemplates: Array<Partial<CropProfile> & { id: string; varietyExamples: string[] }> = [
  {
    id: "cucumber-african-giant",
    cropName: "Cucumber",
    varietyExamples: ["African Giant", "Darina", "Greengo", "Marketmore"],
    plantingMethod: "nursery",
    nurseryRequired: true,
    nurseryDurationDays: 14,
    directPlantingAllowed: true,
    waterNeed: "high",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 45,
    harvestWindow: "45-60 days after planting/transplanting",
    expectedYieldPerAcre: 6000,
    expectedYieldPerPlant: 1.2,
    marketUnit: "kg",
    commonFertilizerStages: ["Nursery starter", "NPK at establishment", "Calcium nitrate", "Potassium during fruiting"],
    commonPestRisks: ["Whiteflies", "Mites", "Downy mildew", "Fruit fly"],
    commonCareTasks: ["Watering", "Staking/trellis", "Weeding", "Spraying", "Harvest every 2-3 days"],
    notes: "Heavy water need. Drip or regular watering is strongly recommended in dry periods."
  },
  {
    id: "tomato-cobra",
    cropName: "Tomato",
    varietyExamples: ["Cobra F1", "Roma VF", "UC82B", "Platinum"],
    plantingMethod: "nursery",
    nurseryRequired: true,
    nurseryDurationDays: 28,
    directPlantingAllowed: false,
    waterNeed: "medium",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 80,
    harvestWindow: "70-90 days depending on variety and weather",
    expectedYieldPerAcre: 10000,
    expectedYieldPerPlant: 2,
    marketUnit: "kg",
    commonFertilizerStages: ["Nursery starter", "Basal manure", "NPK after transplant", "Calcium nitrate", "Potassium at fruiting"],
    commonPestRisks: ["Tuta absoluta", "Whiteflies", "Bacterial wilt", "Blight"],
    commonCareTasks: ["Nursery care", "Transplanting", "Staking", "Pruning", "Pest scouting", "Harvesting"],
    notes: "Nursery quality and disease prevention are critical."
  },
  {
    id: "bell-pepper",
    cropName: "Bell pepper",
    varietyExamples: ["California Wonder", "Yolo Wonder", "F1 hybrids"],
    plantingMethod: "nursery",
    nurseryRequired: true,
    nurseryDurationDays: 42,
    directPlantingAllowed: false,
    waterNeed: "medium",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 90,
    harvestWindow: "80-100 days depending on variety",
    expectedYieldPerAcre: 6000,
    expectedYieldPerPlant: 1.2,
    marketUnit: "kg",
    commonFertilizerStages: ["Nursery starter", "NPK after transplant", "Calcium nitrate", "Potassium at flowering/fruiting"],
    commonPestRisks: ["Whiteflies", "Aphids", "Thrips", "Fruit rot"],
    commonCareTasks: ["Nursery care", "Watering", "Weeding", "Spraying", "Harvesting"],
    notes: "Keep water consistent to reduce flower drop and fruit stress."
  },
  {
    id: "scotch-bonnet",
    cropName: "Scotch bonnet pepper",
    varietyExamples: ["Ata rodo", "Habanero", "F1 Scotch bonnet"],
    plantingMethod: "nursery",
    nurseryRequired: true,
    nurseryDurationDays: 42,
    directPlantingAllowed: false,
    waterNeed: "medium",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 95,
    harvestWindow: "90-120 days; continues producing after first harvest",
    expectedYieldPerAcre: 4500,
    expectedYieldPerPlant: 0.8,
    marketUnit: "kg",
    commonFertilizerStages: ["Nursery starter", "NPK after transplant", "Calcium nitrate", "Potassium during fruiting"],
    commonPestRisks: ["Whiteflies", "Aphids", "Thrips", "Mites", "Viral disease"],
    commonCareTasks: ["Nursery care", "Transplanting", "Watering", "Weeding", "Pest scouting", "Harvesting"],
    notes: "Longer cycle than cucumber; watch virus vectors like whiteflies and aphids."
  },
  {
    id: "garden-egg",
    cropName: "Garden egg",
    varietyExamples: ["Bello white", "White garden egg", "Green garden egg"],
    plantingMethod: "nursery",
    nurseryRequired: true,
    nurseryDurationDays: 42,
    directPlantingAllowed: false,
    waterNeed: "medium",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 85,
    harvestWindow: "80-100 days; harvest continues in flushes",
    expectedYieldPerAcre: 8000,
    expectedYieldPerPlant: 1.5,
    marketUnit: "kg",
    commonFertilizerStages: ["Nursery starter", "Basal manure", "NPK after transplant", "Calcium nitrate", "Potassium during fruiting"],
    commonPestRisks: ["Mites", "Whiteflies", "Fruit borers", "Leaf spot"],
    commonCareTasks: ["Nursery care", "Transplanting", "Watering", "Weeding", "Spraying", "Harvesting"],
    notes: "Transplant after strong seedlings are ready; avoid moisture stress at flowering."
  },
  {
    id: "sweet-corn",
    cropName: "Sweet corn",
    varietyExamples: ["Sweet corn hybrid", "Oba Super", "Local sweet corn"],
    plantingMethod: "direct",
    nurseryRequired: false,
    nurseryDurationDays: 0,
    directPlantingAllowed: true,
    waterNeed: "medium",
    irrigationRecommended: false,
    expectedDurationToHarvestDays: 75,
    harvestWindow: "70-85 days depending on variety",
    expectedYieldPerAcre: 2500,
    expectedYieldPerPlant: 0.25,
    marketUnit: "kg",
    commonFertilizerStages: ["Basal fertiliser", "Side dressing", "Nitrogen before tasselling"],
    commonPestRisks: ["Fall armyworm", "Stem borer", "Bird damage"],
    commonCareTasks: ["Planting", "Thinning", "Weeding", "Fertiliser", "Pest scouting", "Harvesting"],
    notes: "Direct plant; moisture is important at germination and cob filling."
  },
  {
    id: "plantain",
    cropName: "Plantain",
    varietyExamples: ["PITA", "Agbagba", "False horn", "Suckers"],
    plantingMethod: "suckers",
    nurseryRequired: false,
    nurseryDurationDays: 0,
    directPlantingAllowed: true,
    waterNeed: "high",
    irrigationRecommended: true,
    expectedDurationToHarvestDays: 365,
    harvestWindow: "10-15 months depending on sucker quality, water and fertility",
    expectedYieldPerAcre: 2500,
    expectedYieldPerPlant: 1,
    marketUnit: "bunch",
    commonFertilizerStages: ["Manure at planting", "NPK after establishment", "Mulching", "Potassium support"],
    commonPestRisks: ["Nematodes", "Weevils", "Leaf spot", "Water stress"],
    commonCareTasks: ["Hole preparation", "Planting suckers", "Mulching", "Desuckering", "Weeding", "Propping", "Harvesting"],
    notes: "Long-term crop; judge profit across months, not weeks."
  }
];

const waterSourceOptions = ["Well", "Borehole", "Water tank", "Stream/river", "Pond", "Rainwater harvesting", "Municipal supply", "Tanker delivery", "Other"];
const commonSupplierOptions = ["Agro-dealer", "Market supplier", "Farm supplier", "Online supplier", "Local welder/fabricator", "Installer", "Other"];
const marketUnits = ["kg", "ton", "crate", "bag", "basket", "piece", "bunch"];

function cropTemplateName(template: Partial<CropProfile> & { id: string; varietyExamples: string[] }) {
  return `${template.cropName}${template.varietyExamples?.[0] ? ` — e.g. ${template.varietyExamples[0]}` : ""}`;
}

function addDays(dateValue: string | undefined, days: number | undefined) {
  if (!dateValue || !days) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function latestMarketPriceForCrop(data: FarmOsData, cropName: string) {
  const lower = cropName.toLowerCase();
  return data.marketPrices
    .filter((price) => price.cropName.toLowerCase() === lower)
    .sort((a, b) => b.dateChecked.localeCompare(a.dateChecked))[0];
}

function cropNames(data: FarmOsData) {
  return Array.from(new Set([...cropProfileTemplates.map((template) => template.cropName || ""), ...data.cropProfiles.map((crop) => crop.cropName)].filter(Boolean)));
}

// Crops already in the app (templates + saved profiles + seeds in stock) plus the
// common Nigerian crops/vegetables list, for seed/crop dropdowns.
function allCropOptions(data: FarmOsData) {
  const fromSeeds = data.inventoryItems.filter((item) => item.group === "seed").map((item) => item.cropName || item.category || item.name);
  return Array.from(new Set([...cropNames(data), ...fromSeeds, ...NIGERIAN_CROP_OPTIONS].filter(Boolean)));
}

// Cost of a set of planned input lines using current inventory unit costs.
function planLinesCost(data: FarmOsData, lines: PlanInputLine[]) {
  return lines.reduce((sum, line) => {
    const item = getInventoryItem(data, line.itemId);
    return sum + Number(line.quantity || 0) * Number(item?.lastUnitCost || 0);
  }, 0);
}

type DeletableCollectionKey =
  | "plots"
  | "irrigationMaterials"
  | "irrigationPlans"
  | "clearingPlans"
  | "cropProfiles"
  | "plantingPlans"
  | "inventoryItems"
  | "stockMovements"
  | "sales"
  | "inputCosts"
  | "tasks"
  | "workers"
  | "laborPayments"
  | "attendanceRecords"
  | "salaryAdjustments"
  | "salaryRuns"
  | "marketPrices"
  | "yieldForecasts"
  | "observations";

type DeleteRecordFn = (collection: DeletableCollectionKey, id: string, message: string) => void;

const irrigationMaterialTemplates: Array<Partial<IrrigationMaterial> & { id: string }> = [
  { id: "custom", itemName: "", category: "miscellaneous", unit: "unit", quantity: 1, unitCost: 0, reusable: false, requiredForAcres: 1, specification: "" },
  { id: "pump-submersible", itemName: "Submersible pump", category: "pump", unit: "unit", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "e.g. 0.5 hp / 1 hp pump" },
  { id: "water-tank", itemName: "Water tank", category: "water_tank", unit: "tank", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "e.g. 2,500 L / 5,000 L" },
  { id: "main-line", itemName: "Main line pipe", category: "main_lines", unit: "length", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Pipe size and length" },
  { id: "sub-main-line", itemName: "Sub-main line pipe", category: "sub_main_lines", unit: "length", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Distribution line" },
  { id: "drip-line", itemName: "Drip lines", category: "drip_lines", unit: "roll", quantity: 1, unitCost: 0, reusable: false, requiredForAcres: 1, specification: "Roll length / spacing" },
  { id: "rain-gun", itemName: "Rain gun sprinkler", category: "sprinklers", unit: "unit", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Rain gun head and stand" },
  { id: "connectors", itemName: "Connectors and valves", category: "connectors", unit: "set", quantity: 1, unitCost: 0, reusable: false, requiredForAcres: 1, specification: "Elbows, tees, valves, clips" },
  { id: "filter", itemName: "Water filter", category: "filters", unit: "unit", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Screen/disc filter" },
  { id: "hose", itemName: "Delivery hose", category: "hoses", unit: "roll", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Hose length and diameter" },
  { id: "solar-power", itemName: "Solar / inverter power setup", category: "solar_inverter_electric_power", unit: "set", quantity: 1, unitCost: 0, reusable: true, requiredForAcres: 1, specification: "Panels, inverter, battery, controller" },
  { id: "installation-labour", itemName: "Installation labour", category: "installation_labor", unit: "worker-days", quantity: 1, unitCost: 0, reusable: false, requiredForAcres: 1, specification: "Layout, trenching, connection, testing" },
  { id: "transport", itemName: "Transport", category: "transport", unit: "trip", quantity: 1, unitCost: 0, reusable: false, requiredForAcres: 1, specification: "Material movement to farm" }
];

function statusTone(value: string): "green" | "danger" | "warning" | "navy" {
  if (["overdue", "urgent", "critical", "bushy", "needs_clearing", "waterlogged", "unpaid"].includes(value)) return "danger";
  if (["planned", "draft", "partial", "medium", "high", "needs_ridging", "needs_ploughing", "needs_herbicide"].includes(value)) return "warning";
  if (["completed", "active", "ready", "paid", "approved"].includes(value)) return "green";
  return "navy";
}

export type AiOperation = {
  type: "create_task" | "record_observation" | "create_planting_plan" | "add_worker" | "log_attendance" | "update_plot_status" | "edit_plan";
  taskTitle?: string;
  landStatus?: string;
  irrigationStatus?: string;
  // edit_plan fields (partial patch to an existing plan, resolved by plot+crop)
  planStatus?: string;
  plannedPlantingDate?: string;
  expectedTransplantDate?: string;
  expectedHarvestStartDate?: string;
  expectedHarvestEndDate?: string;
  expectedTotalYield?: number;
  appendNote?: string;
  taskType?: string;
  observationType?: string;
  cropName?: string;
  variety?: string;
  plotCode?: string;
  workerName?: string;
  priority?: string;
  severity?: string;
  dueInDays?: number;
  seedCount?: number;
  marketPrice?: number;
  employmentType?: string;
  dailyRate?: number;
  phone?: string;
  attendanceStatus?: string;
  notes?: string;
};

// Compact one-line description of a proposed operation. Fed back into the chat
// history so the AI can refine its own proposal when the user says e.g.
// "yes do it but leave the harvest date".
function describeAiOperation(op: AiOperation): string {
  const where = [op.cropName, op.plotCode ? `on ${op.plotCode}` : ""].filter(Boolean).join(" ").trim();
  switch (op.type) {
    case "create_task": return `create_task "${op.taskTitle || ""}" (${op.taskType || "other"}${op.dueInDays != null ? `, in ${op.dueInDays}d` : ""})${where ? ` ${where}` : ""}`;
    case "record_observation": return `record_observation ${op.observationType || ""}${where ? ` ${where}` : ""}`;
    case "create_planting_plan": return `create_planting_plan${where ? ` ${where}` : ""}`;
    case "add_worker": return `add_worker ${op.workerName || ""}`;
    case "log_attendance": return `log_attendance ${op.workerName || ""} ${op.attendanceStatus || ""}`.trim();
    case "update_plot_status": return `update_plot_status ${op.plotCode || ""} ${[op.landStatus, op.irrigationStatus].filter(Boolean).join("/")}`.trim();
    case "edit_plan": return `edit_plan ${where}: ${[op.planStatus && `status ${op.planStatus}`, op.expectedHarvestStartDate && `harvest ${op.expectedHarvestStartDate}`, op.marketPrice != null && `price ${op.marketPrice}`, op.appendNote && "note"].filter(Boolean).join(", ")}`;
    default: return op.type;
  }
}

// Map a notification to the screen (and plot) it is about, so the bell can navigate.
function notificationTarget(notification: FarmNotification, data: FarmOsData): { tab: FarmOsTab; plotId?: string } {
  const id = notification.id;
  const verifyPlot = (pid: string) => (data.plots.some((plot) => plot.id === pid) ? pid : undefined);
  if (id.startsWith("salary-due") || id.startsWith("labour-pay")) return { tab: "workers" };
  if (id.startsWith("labour-tasks") || id.startsWith("labour-unassigned")) return { tab: "tasks" };
  if (id.startsWith("irrigation-")) return { tab: "irrigation", plotId: verifyPlot(id.replace("irrigation-", "")) };
  if (id.startsWith("regrowth-")) return { tab: "land-clearing", plotId: verifyPlot(id.replace("regrowth-", "")) };
  if (id.startsWith("land-")) return { tab: "land-clearing", plotId: verifyPlot(id.replace("land-", "")) };
  if (id.startsWith("stock-short")) return { tab: "inputs" };
  if (id.startsWith("cash-")) return { tab: "accounts" };
  if (id.startsWith("crop-")) return { tab: "planting-planner" };
  if (id.startsWith("cost-")) return { tab: "reports" };
  const byCategory: Record<FarmNotification["category"], FarmOsTab> = {
    land: "land-clearing",
    irrigation: "irrigation",
    labour: "tasks",
    crop: "planting-planner",
    cost: "reports"
  };
  return { tab: byCategory[notification.category] || "advisor" };
}

const AI_TODAY = "2026-06-17";

function aiDueDate(daysFromNow?: number) {
  const base = new Date(`${AI_TODAY}T00:00:00`);
  base.setDate(base.getDate() + (Number.isFinite(daysFromNow) ? Number(daysFromNow) : 3));
  return base.toISOString().slice(0, 10);
}

export default function FarmWorkspace({ initialTab = "dashboard" as FarmOsTab, adminMode = false, currentUser }: { initialTab?: FarmOsTab; adminMode?: boolean; currentUser?: { displayName: string; role: string; email: string } }) {
  const [data, setData] = useState<FarmOsData>(() => cloneDefaults());
  const [tab, setTab] = useState<FarmOsTab>(initialTab);
  const [focusPlotId, setFocusPlotId] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");

  const notify = useFarmNotifications(data);
  const messaging = useMessages(currentUser?.email);

  // Which tabs this user's role may open (owner/manager = all).
  const allowedTabs = useMemo(() => {
    const allow = allowedTabsFor(currentUser?.role);
    return allow === "all" ? null : new Set<FarmOsTab>(allow);
  }, [currentUser?.role]);
  const canSee = (id: FarmOsTab) => !allowedTabs || allowedTabs.has(id);
  const visibleNav = useMemo(() => navItems.filter((item) => canSee(item.id)), [allowedTabs]); // eslint-disable-line react-hooks/exhaustive-deps

  // If the role can't see the current tab (e.g. restored from storage), fall back.
  useEffect(() => {
    if (allowedTabs && !allowedTabs.has(tab)) setTab("dashboard");
  }, [allowedTabs, tab]);

  // Restore the last-open tab so a refresh keeps you where you were.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTab = window.localStorage.getItem(tabStorageKey) as FarmOsTab | null;
    if (savedTab && navItems.some((item) => item.id === savedTab) && canSee(savedTab)) setTab(savedTab);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(tabStorageKey, tab);
  }, [tab]);

  // Transient notices auto-dismiss so nothing sticks on screen.
  useEffect(() => {
    if (!notice || typeof window === "undefined") return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Load: local cache first for instant paint, then the database if available.
  useEffect(() => {
    let cancelled = false;
    setData(readSavedData());
    (async () => {
      try {
        const res = await fetch("/api/farm-state");
        if (res.status === 401) {
          // Session expired: sign in again rather than silently stop syncing.
          window.location.assign(adminMode ? "/admin/login" : "/login");
          return;
        }
        if (res.ok) {
          const json = (await res.json()) as { persisted?: boolean; data?: Partial<FarmOsData> };
          if (!cancelled && json?.persisted && json.data) {
            setData(normalizeFarmData({ ...cloneDefaults(), ...json.data }));
          }
        }
      } catch {
        // Offline or DB not configured: keep the local copy.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminMode]);

  // Save: always to local storage; debounce-sync to the database once hydrated.
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, JSON.stringify(data));
    if (!hydrated || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      fetch("/api/farm-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then((res) => {
          // Session expired: local storage still holds the records; sign in again to resume syncing.
          if (res.status === 401) window.location.assign(adminMode ? "/admin/login" : "/login");
        })
        .catch(() => {
          // Ignore: local storage already holds the records.
        });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [data, hydrated, adminMode]);

  const totals = useMemo(() => {
    const totalAcres = data.plots.reduce((sum, plot) => sum + Number(plot.equivalentAcres || 0), 0);
    const irrigatedAcres = data.plots.filter((plot) => plot.irrigated).reduce((sum, plot) => sum + Number(plot.equivalentAcres || 0), 0);
    const readyPlots = data.plots.filter((plot) => plot.landStatus === "ready").length;
    const bushyPlots = data.plots.filter((plot) => plot.landStatus === "bushy" || plot.landStatus === "needs_clearing").length;
    const todayIso = new Date().toISOString().slice(0, 10);
    const overdueTasks = data.tasks.filter((task) => task.status !== "completed" && task.dueDate < todayIso).length;
    const pendingTasks = data.tasks.filter((task) => task.status === "pending" || task.status === "in_progress").length;
    const expectedRevenueTotal = data.plantingPlans.reduce((sum, plan) => sum + expectedRevenue(plan), 0);
    const expectedProfitTotal = data.plantingPlans.reduce((sum, plan) => sum + expectedProfit(plan), 0);
    const inputTotal = data.inputCosts.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
    const unpaidLabor = data.laborPayments.reduce((sum, payment) => sum + calculateLaborBalance(payment), 0);
    const salaryRuns = data.salaryRuns || [];
    const attendanceRecords = data.attendanceRecords || [];
    const salaryGross = salaryRuns.reduce((sum, salary) => sum + Number(salary.grossPay || 0), 0);
    const salaryNet = salaryRuns.reduce((sum, salary) => sum + Number(salary.netPay || 0), 0);
    const salaryPaid = salaryRuns.reduce((sum, salary) => sum + Number(salary.amountPaid || 0), 0);
    const salaryBalance = salaryRuns.reduce((sum, salary) => sum + calculateSalaryBalance(salary), 0);
    const attendanceDays = attendanceRecords.reduce((sum, attendance) => sum + Number(attendance.daysWorked || 0), 0);
    const irrigationSummary = calculateIrrigationSummary(data.irrigationMaterials, Math.max(totalAcres, 1));
    return {
      totalAcres,
      irrigatedAcres,
      readyPlots,
      bushyPlots,
      overdueTasks,
      pendingTasks,
      expectedRevenueTotal,
      expectedProfitTotal,
      inputTotal,
      unpaidLabor,
      salaryGross,
      salaryNet,
      salaryPaid,
      salaryBalance,
      attendanceDays,
      irrigationSummary
    };
  }, [data]);

  function updateData(updater: (current: FarmOsData) => FarmOsData, message: string) {
    setData((current) => updater(current));
    setNotice(message);
  }

  // Open another tab focused on a specific plot (used by the Plot Detail hub).
  function openPlotInTab(nextTab: FarmOsTab, plotId: string) {
    setFocusPlotId(plotId);
    setTab(nextTab);
    setMenuOpen(false);
  }

  const deleteRecord: DeleteRecordFn = (collection, id, message) => {
    updateData((current) => {
      const rows = current[collection] as Array<{ id: string }>;
      return { ...current, [collection]: rows.filter((row) => row.id !== id) } as FarmOsData;
    }, message);
  };

  function clearAllFarmRecords() {
    if (typeof window === "undefined") return;
    if (!window.confirm("Clear ALL farm records (plots, crops, workers, plans, costs)? This cannot be undone.")) return;
    const typed = window.prompt('This permanently deletes everything. Type DELETE to confirm.');
    if ((typed || "").trim().toUpperCase() !== "DELETE") {
      setNotice("Clear-all cancelled — nothing was deleted.");
      return;
    }
    updateData(() => cloneDefaults(), "All farm records cleared. You can now enter your own plots, crops, workers, materials and plans from scratch.");
  }

  function addPlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const length = numberValue(formData, "length") || 0;
    const width = numberValue(formData, "width") || 0;
    const sizeUnit = stringValue(formData, "sizeUnit", "feet") as FarmPlot["sizeUnit"];
    const area = calculatePlotArea({ length, width, sizeUnit });
    const plot: FarmPlot = {
      id: makeId("plot"),
      plotName: stringValue(formData, "plotName"),
      plotCode: stringValue(formData, "plotCode"),
      measuredSize: `${length} x ${width}`,
      measurementFormat: "rectangular",
      length,
      width,
      sizeUnit,
      calculatedArea: area.calculatedArea,
      equivalentAcres: area.equivalentAcres,
      irrigated: stringValue(formData, "irrigated", "no") === "yes",
      irrigationStatus: stringValue(formData, "irrigationStatus", "none") as FarmPlot["irrigationStatus"],
      landStatus: stringValue(formData, "landStatus", "ready") as FarmPlot["landStatus"],
      currentCrop: stringValue(formData, "currentCrop", "None"),
      previousCrop: stringValue(formData, "previousCrop", "None"),
      soilNotes: stringValue(formData, "soilNotes"),
      rainFedSuitability: stringValue(formData, "rainFedSuitability", "unknown") as FarmPlot["rainFedSuitability"],
      accessNotes: stringValue(formData, "accessNotes"),
      dateLastCleared: stringValue(formData, "dateLastCleared"),
      dateLastInspected: stringValue(formData, "dateLastInspected"),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, plots: [plot, ...current.plots] }), `${plot.plotCode || plot.plotName} added to Farm Map.`);
    event.currentTarget.reset();
  }

  function updatePlotStatus(plotId: string, patch: Partial<FarmPlot>) {
    updateData(
      (current) => ({ ...current, plots: current.plots.map((plot) => (plot.id === plotId ? { ...plot, ...patch } : plot)) }),
      "Plot status updated."
    );
  }

  function addIrrigationMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const material: IrrigationMaterial = {
      id: makeId("irr"),
      itemName: stringValue(formData, "itemName"),
      category: stringValue(formData, "category", "miscellaneous") as IrrigationMaterial["category"],
      specification: stringValue(formData, "specification"),
      quantity: numberValue(formData, "quantity") || 0,
      unit: stringValue(formData, "unit", "unit"),
      unitCost: numberValue(formData, "unitCost") || 0,
      supplier: stringValue(formData, "supplier"),
      requiredForAcres: numberValue(formData, "requiredForAcres") || 1,
      reusable: stringValue(formData, "reusable", "yes") === "yes",
      lifespan: stringValue(formData, "lifespan"),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, irrigationMaterials: [material, ...current.irrigationMaterials] }), `${material.itemName} added to irrigation materials.`);
    event.currentTarget.reset();
  }

  function addIrrigationPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedPlot = data.plots.find((plot) => plot.id === stringValue(formData, "plotId"));
    const selectedMaterialIds = formData.getAll("materialIds").map((item) => String(item));
    const selectedMaterials = data.irrigationMaterials.filter((item) => selectedMaterialIds.includes(item.id));
    const summary = calculateIrrigationSummary(selectedMaterials, Number(selectedPlot?.equivalentAcres || 1));
    const plan = {
      id: makeId("irrigation-plan"),
      plotId: stringValue(formData, "plotId"),
      irrigationMethod: stringValue(formData, "irrigationMethod", "drip") as "drip" | "sprinkler" | "rain_gun" | "manual" | "furrow" | "mixed",
      waterSource: stringValue(formData, "waterSource"),
      materialsNeeded: selectedMaterialIds,
      laborNeeded: stringValue(formData, "laborNeeded"),
      estimatedSetupTime: stringValue(formData, "estimatedSetupTime"),
      expectedCost: numberValue(formData, "expectedCost") || Math.round(summary.selectedPlotCost),
      expectedMaintenanceCost: numberValue(formData, "expectedMaintenanceCost") || summary.maintenanceEstimate,
      expectedBenefit: stringValue(formData, "expectedBenefit"),
      status: "planned" as const,
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, irrigationPlans: [plan, ...current.irrigationPlans] }), `Irrigation plan created for ${getPlotName(data, plan.plotId)}.`);
    event.currentTarget.reset();
  }

  function addClearingPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const plan: LandClearingPlan = {
      id: makeId("clearing"),
      plotId: stringValue(formData, "plotId"),
      currentCondition: stringValue(formData, "currentCondition", "needs_clearing") as LandClearingPlan["currentCondition"],
      recommendedMethod: stringValue(formData, "recommendedMethod", "combined_method") as LandClearingPlan["recommendedMethod"],
      laborRequired: stringValue(formData, "laborRequired"),
      chemicalRequired: stringValue(formData, "chemicalRequired"),
      equipmentRequired: stringValue(formData, "equipmentRequired"),
      estimatedCost: numberValue(formData, "estimatedCost"),
      estimatedTime: stringValue(formData, "estimatedTime"),
      safetyNotes: stringValue(formData, "safetyNotes"),
      datePlanned: stringValue(formData, "datePlanned"),
      status: "planned",
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, clearingPlans: [plan, ...current.clearingPlans] }), "Land clearing plan added.");
    event.currentTarget.reset();
  }

  function addCropProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const profile: CropProfile = {
      id: makeId("crop"),
      cropName: stringValue(formData, "cropName"),
      plantingMethod: stringValue(formData, "plantingMethod", "nursery") as CropProfile["plantingMethod"],
      nurseryRequired: stringValue(formData, "nurseryRequired", "yes") === "yes",
      nurseryDurationDays: numberValue(formData, "nurseryDurationDays"),
      directPlantingAllowed: stringValue(formData, "directPlantingAllowed", "no") === "yes",
      waterNeed: stringValue(formData, "waterNeed", "medium") as CropProfile["waterNeed"],
      irrigationRecommended: stringValue(formData, "irrigationRecommended", "yes") === "yes",
      expectedDurationToHarvestDays: numberValue(formData, "expectedDurationToHarvestDays"),
      harvestWindow: stringValue(formData, "harvestWindow"),
      expectedYieldPerAcre: numberValue(formData, "expectedYieldPerAcre"),
      expectedYieldPerPlant: numberValue(formData, "expectedYieldPerPlant"),
      marketUnit: stringValue(formData, "marketUnit", "kg") as CropProfile["marketUnit"],
      commonFertilizerStages: splitList(stringValue(formData, "commonFertilizerStages")),
      commonPestRisks: splitList(stringValue(formData, "commonPestRisks")),
      commonCareTasks: splitList(stringValue(formData, "commonCareTasks")),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, cropProfiles: [profile, ...current.cropProfiles] }), `${profile.cropName} added to crop catalog.`);
    event.currentTarget.reset();
  }

  function addPlantingPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const cropProfileId = stringValue(formData, "cropProfileId");
    const plotId = stringValue(formData, "plotId");
    const crop = data.cropProfiles.find((item) => item.id === cropProfileId);
    const plot = data.plots.find((item) => item.id === plotId);
    // Planned inputs come from the grouped inventory picker (parallel hidden inputs).
    const plannedItemIds = formData.getAll("plannedItemId").map(String);
    const plannedQtys = formData.getAll("plannedQty").map((v) => Number(v) || 0);
    const plannedInputs: PlanInputLine[] = plannedItemIds
      .map((itemId, index) => ({ itemId, quantity: plannedQtys[index] || 0 }))
      .filter((line) => line.itemId && line.quantity > 0);
    const seedLines = plannedInputs.filter((line) => getInventoryItem(data, line.itemId)?.group === "seed");
    const fertilizerLines = plannedInputs.filter((line) => getInventoryItem(data, line.itemId)?.group === "fertilizer");
    const seedCost = planLinesCost(data, seedLines) || numberValue(formData, "seedCost") || 0;
    const selectedFertilizerCost = planLinesCost(data, fertilizerLines);
    const manualFertilizerBudget = numberValue(formData, "fertilizerBudget") || 0;
    const fertilizerBudget = selectedFertilizerCost || manualFertilizerBudget;
    const selectedFertilizerIds = fertilizerLines.map((line) => line.itemId);
    const laborBudget = numberValue(formData, "laborBudget") || 0;
    const irrigationBudget = numberValue(formData, "irrigationBudget") || 0;
    const transportBudget = numberValue(formData, "transportBudget") || 0;
    const otherBudget = numberValue(formData, "otherBudget") || 0;
    const seedCount = numberValue(formData, "seedCount") || 0;
    const expectedYieldPerPlant = numberValue(formData, "expectedYieldPerPlant") || crop?.expectedYieldPerPlant || 0;
    const expectedYieldPerAcre = numberValue(formData, "expectedYieldPerAcre") || crop?.expectedYieldPerAcre || 0;
    const expectedTotalYield = seedCount && expectedYieldPerPlant
      ? Math.round(seedCount * expectedYieldPerPlant)
      : Math.round(expectedYieldPerAcre * Number(plot?.equivalentAcres || 1));
    const cropName = crop?.cropName || stringValue(formData, "cropName", "New crop");
    const latestPrice = latestMarketPriceForCrop(data, cropName);
    const expectedMarketPrice = numberValue(formData, "expectedMarketPrice") || latestPrice?.price || 0;
    const expectedMarketUnit = (stringValue(formData, "expectedMarketUnit") || latestPrice?.unit || crop?.marketUnit || "kg") as PlantingPlan["expectedMarketUnit"];
    const plannedPlantingDate = stringValue(formData, "plannedPlantingDate");
    const plannedNurseryDate = stringValue(formData, "plannedNurseryDate");
    const expectedTransplantDate = stringValue(formData, "expectedTransplantDate") || (crop?.nurseryRequired ? addDays(plannedNurseryDate || plannedPlantingDate, crop?.nurseryDurationDays) : "");
    const harvestBaseDate = expectedTransplantDate || plannedPlantingDate || plannedNurseryDate;
    const expectedHarvestStartDate = stringValue(formData, "expectedHarvestStartDate") || addDays(harvestBaseDate, crop?.expectedDurationToHarvestDays);
    const expectedHarvestEndDate = stringValue(formData, "expectedHarvestEndDate") || addDays(expectedHarvestStartDate, 14);
    const partial = { seedCost, fertilizerBudget, expectedMarketPrice };
    const warnings = warningsForPlan(plot, crop, partial);
    const plan: PlantingPlan = {
      id: makeId("plant"),
      cropProfileId,
      plotId,
      cropName,
      variety: stringValue(formData, "variety"),
      plannedPlantingDate,
      plannedNurseryDate,
      expectedTransplantDate,
      expectedHarvestStartDate,
      expectedHarvestEndDate,
      seedCost,
      fertilizerBudget,
      laborBudget,
      irrigationBudget,
      transportBudget,
      otherBudget,
      seedCount,
      expectedYieldPerAcre,
      expectedYieldPerPlant,
      expectedTotalYield,
      expectedMarketPrice,
      expectedMarketUnit,
      selectedFertilizerIds,
      selectedFertilizerCost,
      plannedInputs,
      expectedRevenue: expectedTotalYield * expectedMarketPrice,
      expectedProfit: expectedTotalYield * expectedMarketPrice - (seedCost + fertilizerBudget + laborBudget + irrigationBudget + transportBudget + otherBudget),
      warnings,
      status: "draft",
      notes: stringValue(formData, "notes")
    };
    updateData((current) => {
      // Auto-stamp the plot so Farm Map and Dashboard know it's planted.
      const updatedPlots = current.plots.map((p) =>
        p.id === plotId
          ? {
              ...p,
              currentCrop: plan.cropName,
              landStatus: (["ready", "fallow", "recently_cleared"].includes(p.landStatus) ? "planted" : p.landStatus) as FarmPlot["landStatus"],
              dateLastPlanted: plan.plannedPlantingDate || plan.plannedNurseryDate || new Date().toISOString().slice(0, 10)
            }
          : p
      );
      return { ...current, plantingPlans: [plan, ...current.plantingPlans], plots: updatedPlots };
    }, `${plan.cropName} planting plan created — ${getPlotName(data, plotId)} marked as planted.`);
    event.currentTarget.reset();
  }

  // Create a whole schedule of dated tasks from an AI crop plan (assignable later).
  function createScheduleTasks(baseDate: string, items: { title: string; taskType: string; dayOffset: number; notes?: string }[], cropName: string, plotId: string) {
    const tasks: FarmTask[] = items.map((it) => ({
      id: makeId("task"),
      taskTitle: it.title,
      taskType: (it.taskType as FarmTask["taskType"]) || "other",
      cropName,
      plotId,
      assignedWorkerId: "",
      dueDate: addDays(baseDate, it.dayOffset || 0) || baseDate || AI_TODAY,
      priority: "medium",
      status: "pending",
      notes: it.notes || "From AI crop plan."
    }));
    updateData((current) => ({ ...current, tasks: [...tasks, ...current.tasks] }), `${tasks.length} task(s) added from the crop plan. Assign them to workers in Tasks.`);
  }

  function createPlantingPlanRecord(plan: PlantingPlan) {
    updateData((current) => {
      const updatedPlots = current.plots.map((p) =>
        p.id === plan.plotId
          ? {
              ...p,
              currentCrop: plan.cropName,
              landStatus: (["ready", "fallow", "recently_cleared"].includes(p.landStatus) ? "planted" : p.landStatus) as FarmPlot["landStatus"],
              dateLastPlanted: plan.plannedPlantingDate || plan.plannedNurseryDate || new Date().toISOString().slice(0, 10)
            }
          : p
      );
      return { ...current, plantingPlans: [plan, ...current.plantingPlans], plots: updatedPlots };
    }, `${plan.cropName} planting plan saved — plot marked as planted.`);
  }

  function updatePlanStatus(planId: string, newStatus: PlantingPlan["status"]) {
    updateData((current) => {
      const plan = current.plantingPlans.find((p) => p.id === planId);
      if (!plan) return current;
      const updatedPlans = current.plantingPlans.map((p) =>
        p.id === planId ? { ...p, status: newStatus } : p
      );
      // Sync the linked plot based on the new status.
      const today = new Date().toISOString().slice(0, 10);
      const updatedPlots = current.plots.map((p) => {
        if (p.id !== plan.plotId) return p;
        if (newStatus === "active") {
          return { ...p, currentCrop: plan.cropName, landStatus: "planted" as FarmPlot["landStatus"], dateLastPlanted: plan.plannedPlantingDate || today };
        }
        if (newStatus === "completed") {
          return { ...p, previousCrop: plan.cropName, currentCrop: "None", landStatus: "fallow" as FarmPlot["landStatus"] };
        }
        if (newStatus === "cancelled") {
          // Only clear if this was the only active plan for this crop on this plot
          const otherActivePlans = updatedPlans.filter((op) => op.plotId === p.id && op.id !== planId && op.status !== "cancelled" && op.status !== "completed");
          if (!otherActivePlans.length) {
            return { ...p, currentCrop: p.previousCrop || "None", landStatus: "fallow" as FarmPlot["landStatus"] };
          }
        }
        return p;
      });
      return { ...current, plantingPlans: updatedPlans, plots: updatedPlots };
    }, newStatus === "active" ? "Plan marked active — plot updated to planted." : newStatus === "completed" ? "Harvest complete — plot set to fallow." : `Plan status updated to ${newStatus}.`);
  }

  // One-time "robustify" for an existing plan: ask the AI planner to compute
  // species-targeted timing/yield + a variety note, backfill any missing fields,
  // and stamp the plot. Used to bring older plans up to the latest behaviour.
  async function enhancePlanWithAi(planId: string) {
    const plan = data.plantingPlans.find((p) => p.id === planId);
    if (!plan) return;
    const crop = data.cropProfiles.find((c) => c.id === plan.cropProfileId) || data.cropProfiles.find((c) => c.cropName.toLowerCase() === plan.cropName.toLowerCase());
    const plot = data.plots.find((p) => p.id === plan.plotId);
    const startDate = plan.plannedNurseryDate || plan.plannedPlantingDate || new Date().toISOString().slice(0, 10);
    const body = {
      crop: { name: plan.cropName, variety: plan.variety || undefined, nurseryRequired: crop?.nurseryRequired, nurseryDays: crop?.nurseryDurationDays, maturityDays: crop?.expectedDurationToHarvestDays, waterNeed: crop?.waterNeed, marketUnit: crop?.marketUnit, pestRisks: crop?.commonPestRisks, expectedYieldPerAcre: crop?.expectedYieldPerAcre, expectedYieldPerPlant: plan.expectedYieldPerPlant },
      plot: { code: plot?.plotCode, acres: plot?.equivalentAcres, irrigated: plot?.irrigated },
      plantingDate: startDate,
      nurseryDate: crop?.nurseryRequired ? startDate : "",
      seedCount: plan.seedCount || 0,
      marketPrice: plan.expectedMarketPrice || 0,
      marketUnit: plan.expectedMarketUnit || "kg"
    };
    let gen: GeneratedPlan | null = null;
    try {
      const res = await fetch("/api/plant-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      gen = (await res.json()) as GeneratedPlan;
    } catch {
      setNotice("Could not reach the AI planner — check your connection and try again.");
      return;
    }
    updateData((current) => {
      const plans = current.plantingPlans.map((p) => {
        if (p.id !== planId) return p;
        const base = p.plannedNurseryDate || p.plannedPlantingDate || startDate;
        const noteParts = [p.notes, gen?.varietyNote, gen?.summary].map((s) => (s || "").trim()).filter(Boolean);
        const notes = [...new Set(noteParts)].join("\n\n");
        return {
          ...p,
          expectedTransplantDate: p.expectedTransplantDate || (gen ? addDays(base, gen.transplantInDays) : p.expectedTransplantDate),
          expectedHarvestStartDate: p.expectedHarvestStartDate || (gen ? addDays(base, gen.harvestStartInDays) : p.expectedHarvestStartDate),
          expectedHarvestEndDate: p.expectedHarvestEndDate || (gen ? addDays(base, gen.harvestEndInDays) : p.expectedHarvestEndDate),
          expectedTotalYield: p.expectedTotalYield || gen?.expectedYield || p.expectedTotalYield,
          notes
        };
      });
      const plots = current.plots.map((pl) =>
        pl.id === plan.plotId
          ? {
              ...pl,
              currentCrop: pl.currentCrop && pl.currentCrop !== "None" ? pl.currentCrop : plan.cropName,
              landStatus: (["ready", "fallow", "recently_cleared"].includes(pl.landStatus) ? "planted" : pl.landStatus) as FarmPlot["landStatus"],
              dateLastPlanted: pl.dateLastPlanted || startDate
            }
          : pl
      );
      return { ...current, plantingPlans: plans, plots };
    }, `${plan.cropName} plan enhanced — species note added, dates/yield filled and ${getPlotName(data, plan.plotId)} updated.`);
  }

  // ---- Inventory (source of truth) ----

  // Create a new stock item, optionally with an opening balance.
  function addInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const group = stringValue(formData, "group", "other") as InventoryItem["group"];
    const unitCost = numberValue(formData, "unitCost");
    const item: InventoryItem = {
      id: makeId("inv"),
      group,
      name: stringValue(formData, "name"),
      category: stringValue(formData, "category") || labelize(group),
      unit: stringValue(formData, "unit", "unit"),
      reorderAt: numberValue(formData, "reorderAt"),
      lastUnitCost: unitCost,
      supplier: stringValue(formData, "supplier") || undefined,
      cropName: stringValue(formData, "cropName") || undefined,
      variety: stringValue(formData, "variety") || undefined,
      seedsPerUnit: numberValue(formData, "seedsPerUnit"),
      nutrientFocus: stringValue(formData, "nutrientFocus") || undefined,
      preferredStage: stringValue(formData, "preferredStage") || undefined,
      target: stringValue(formData, "target") || undefined,
      notes: stringValue(formData, "notes") || undefined
    };
    const openingQty = numberValue(formData, "openingQty") || 0;
    const acquisition = stringValue(formData, "acquisition", "opening_balance") as StockMovement["acquisition"];
    const movements: StockMovement[] = openingQty > 0
      ? [{
          id: makeId("mv"),
          itemId: item.id,
          date: stringValue(formData, "date") || AI_TODAY,
          direction: "in",
          quantity: openingQty,
          acquisition,
          unitCost: unitCost,
          totalCost: unitCost ? openingQty * unitCost : undefined,
          supplier: item.supplier
        }]
      : [];
    updateData((current) => ({
      ...current,
      inventoryItems: [item, ...current.inventoryItems],
      stockMovements: [...movements, ...current.stockMovements]
    }), `${item.name || "Item"} added to inventory.`);
    event.currentTarget.reset();
  }

  // Add stock to an existing item (bought, gift, own production, etc.).
  function addStockIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const itemId = stringValue(formData, "itemId");
    if (!itemId) return;
    const quantity = numberValue(formData, "quantity") || 0;
    const acquisition = stringValue(formData, "acquisition", "purchase") as StockMovement["acquisition"];
    const unitCost = numberValue(formData, "unitCost");
    const isPurchase = acquisition === "purchase";
    const movement: StockMovement = {
      id: makeId("mv"),
      itemId,
      date: stringValue(formData, "date") || AI_TODAY,
      direction: "in",
      quantity,
      acquisition,
      unitCost: isPurchase ? unitCost : undefined,
      totalCost: isPurchase ? (numberValue(formData, "totalCost") || (unitCost ? quantity * unitCost : 0)) : undefined,
      supplier: stringValue(formData, "supplier") || undefined,
      notes: stringValue(formData, "notes") || undefined,
      photoDataUrl: stringValue(formData, "photoDataUrl") || undefined
    };
    updateData((current) => ({
      ...current,
      stockMovements: [movement, ...current.stockMovements],
      inventoryItems: isPurchase && unitCost
        ? current.inventoryItems.map((i) => (i.id === itemId ? { ...i, lastUnitCost: unitCost } : i))
        : current.inventoryItems
    }), `Stock added to ${getInventoryItem(data, itemId)?.name || "item"}.`);
    event.currentTarget.reset();
  }

  // Record usage / removal of stock (where it went). Cannot go below stock on hand.
  function useStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const itemId = stringValue(formData, "itemId");
    if (!itemId) return;
    const quantity = numberValue(formData, "quantity") || 0;
    const onHand = itemStock(data, itemId);
    if (quantity > onHand) {
      setNotice(`Cannot use ${quantity} — only ${onHand} ${getInventoryItem(data, itemId)?.unit || ""} in stock. Add stock first.`);
      return;
    }
    const movement: StockMovement = {
      id: makeId("mv"),
      itemId,
      date: stringValue(formData, "date") || AI_TODAY,
      direction: "out",
      quantity,
      usage: stringValue(formData, "usage", "other") as StockMovement["usage"],
      plotId: stringValue(formData, "plotId") || undefined,
      plantingPlanId: stringValue(formData, "plantingPlanId") || undefined,
      destination: stringValue(formData, "destination") || undefined,
      notes: stringValue(formData, "notes") || undefined
    };
    updateData((current) => ({ ...current, stockMovements: [movement, ...current.stockMovements] }), `Usage recorded for ${getInventoryItem(data, itemId)?.name || "item"}.`);
    event.currentTarget.reset();
  }

  // Mid-cycle treatment: record a spray/application now -> creates a spraying task + deducts stock.
  function recordTreatment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const itemId = stringValue(formData, "productId");
    const product = getInventoryItem(data, itemId);
    const plotId = stringValue(formData, "plotId");
    const date = stringValue(formData, "date") || AI_TODAY;
    const quantity = numberValue(formData, "quantity") || 0;
    const reason = stringValue(formData, "reason");
    const name = product?.name || "Treatment";
    const category = product?.category;
    const unitCost = Number(product?.lastUnitCost || 0);
    const cost = numberValue(formData, "cost") || quantity * unitCost;
    const taskType: FarmTask["taskType"] = category === "herbicide" ? "weeding" : "spraying";
    const task: FarmTask = {
      id: makeId("task"),
      taskTitle: `Apply ${name}${reason ? ` (${reason})` : ""}`,
      taskType,
      cropName: "",
      plotId,
      assignedWorkerId: stringValue(formData, "assignedWorkerId"),
      dueDate: date,
      priority: "high",
      status: "pending",
      estimatedCost: cost,
      notes: `${category ? labelize(category) + ". " : ""}${product?.target ? "Targets: " + product.target + ". " : ""}Follow label rate, PPE and pre-harvest interval.`
    };
    const movements: StockMovement[] = itemId && quantity > 0
      ? [{
          id: makeId("mv"),
          itemId,
          date,
          direction: "out",
          quantity,
          usage: "treatment",
          plotId: plotId || undefined,
          plantingPlanId: stringValue(formData, "plantingPlanId") || undefined,
          destination: reason || "Crop protection treatment",
          notes: `Applied ${name}`
        }]
      : [];
    updateData((current) => ({ ...current, tasks: [task, ...current.tasks], stockMovements: [...movements, ...current.stockMovements] }), `Treatment recorded: ${name}. A spraying task was created${quantity > 0 ? " and stock deducted" : ""}.`);
    event.currentTarget.reset();
  }

  // Non-stock "other expense" (labour, transport, fuel, packaging, etc.).
  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const quantity = numberValue(formData, "quantity") || 0;
    const unitCost = numberValue(formData, "unitCost") || 0;
    const input: FarmInputCost = {
      id: makeId("expense"),
      plantingPlanId: stringValue(formData, "plantingPlanId") || undefined,
      plotId: stringValue(formData, "plotId") || undefined,
      category: stringValue(formData, "category", "miscellaneous") as FarmInputCost["category"],
      itemName: stringValue(formData, "itemName"),
      date: stringValue(formData, "date") || AI_TODAY,
      quantity,
      unit: stringValue(formData, "unit"),
      unitCost,
      totalCost: numberValue(formData, "totalCost") || quantity * unitCost,
      supplier: stringValue(formData, "supplier"),
      purpose: stringValue(formData, "purpose"),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, inputCosts: [input, ...current.inputCosts] }), `${input.itemName || "Expense"} recorded.`);
    event.currentTarget.reset();
  }

  // Record an actual sale (money in).
  function addSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const quantity = numberValue(formData, "quantity") || 0;
    const unitPrice = numberValue(formData, "unitPrice") || 0;
    const total = quantity * unitPrice;
    const receivedRaw = numberValue(formData, "amountReceived");
    const amountReceived = receivedRaw === undefined ? total : receivedRaw;
    const sale: SaleRecord = {
      id: makeId("sale"),
      date: stringValue(formData, "date") || AI_TODAY,
      cropName: stringValue(formData, "cropName"),
      plantingPlanId: stringValue(formData, "plantingPlanId") || undefined,
      plotId: stringValue(formData, "plotId") || undefined,
      buyer: stringValue(formData, "buyer") || undefined,
      quantity,
      unit: stringValue(formData, "unit", "kg"),
      unitPrice,
      total,
      amountReceived,
      paymentStatus: amountReceived >= total ? "paid" : amountReceived > 0 ? "part" : "unpaid",
      notes: stringValue(formData, "notes") || undefined
    };
    updateData((current) => ({ ...current, sales: [sale, ...current.sales] }), `Sale recorded: ${naira.format(total)}.`);
    event.currentTarget.reset();
  }

  function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const worker: FarmWorker = {
      id: makeId("worker"),
      name: stringValue(formData, "name"),
      phoneNumber: stringValue(formData, "phoneNumber"),
      role: stringValue(formData, "role"),
      employmentType: stringValue(formData, "employmentType", "daily_worker") as FarmWorker["employmentType"],
      salaryOrDailyRate: numberValue(formData, "salaryOrDailyRate"),
      monthlyFeedingCost: numberValue(formData, "monthlyFeedingCost"),
      startDate: stringValue(formData, "startDate"),
      status: "active",
      skills: splitList(stringValue(formData, "skills")),
      notes: stringValue(formData, "notes"),
      monthsPaid: []
    };
    updateData((current) => ({ ...current, workers: [worker, ...current.workers] }), `${worker.name} added to labour force.`);
    event.currentTarget.reset();
  }

  // Toggle a worker's monthly salary as paid/unpaid (YYYY-MM).
  function toggleWorkerMonthPaid(workerId: string, monthKey: string) {
    updateData((current) => ({
      ...current,
      workers: current.workers.map((worker) => {
        if (worker.id !== workerId) return worker;
        const set = new Set(worker.monthsPaid || []);
        if (set.has(monthKey)) set.delete(monthKey);
        else set.add(monthKey);
        return { ...worker, monthsPaid: [...set] };
      })
    }), "Salary payment status updated.");
  }

  function addLaborPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payment = {
      id: makeId("pay"),
      workerId: stringValue(formData, "workerId"),
      payPeriod: stringValue(formData, "payPeriod"),
      amountDue: numberValue(formData, "amountDue") || 0,
      amountPaid: numberValue(formData, "amountPaid") || 0,
      paymentDate: stringValue(formData, "paymentDate"),
      paymentMethod: stringValue(formData, "paymentMethod", "cash") as "cash" | "bank_transfer" | "mobile_money" | "other",
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, laborPayments: [payment, ...current.laborPayments] }), "Labour payment recorded.");
    event.currentTarget.reset();
  }


  function updateWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const workerId = stringValue(formData, "workerId");
    const patch: Partial<FarmWorker> = {
      name: stringValue(formData, "name"),
      phoneNumber: stringValue(formData, "phoneNumber"),
      role: stringValue(formData, "role"),
      employmentType: stringValue(formData, "employmentType", "daily_worker") as FarmWorker["employmentType"],
      salaryOrDailyRate: numberValue(formData, "salaryOrDailyRate"),
      monthlyFeedingCost: numberValue(formData, "monthlyFeedingCost"),
      startDate: stringValue(formData, "startDate"),
      status: stringValue(formData, "status", "active") as FarmWorker["status"],
      skills: splitList(stringValue(formData, "skills")),
      notes: stringValue(formData, "notes")
    };
    updateData(
      (current) => ({ ...current, workers: current.workers.map((worker) => (worker.id === workerId ? { ...worker, ...patch } : worker)) }),
      `${patch.name || "Worker"} updated.`
    );
  }

  function addAttendanceRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const status = stringValue(formData, "status", "present") as WorkerAttendanceRecord["status"];
    const attendance: WorkerAttendanceRecord = {
      id: makeId("att"),
      workerId: stringValue(formData, "workerId"),
      date: stringValue(formData, "date"),
      plotId: stringValue(formData, "plotId"),
      taskId: stringValue(formData, "taskId"),
      status,
      daysWorked: numberValue(formData, "daysWorked") ?? (status === "half_day" ? 0.5 : status === "present" ? 1 : 0),
      hoursWorked: numberValue(formData, "hoursWorked"),
      workSummary: stringValue(formData, "workSummary"),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, attendanceRecords: [attendance, ...(current.attendanceRecords || [])] }), "Attendance / days worked recorded.");
    event.currentTarget.reset();
  }

  function addSalaryAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const adjustment: SalaryAdjustment = {
      id: makeId("adj"),
      workerId: stringValue(formData, "workerId"),
      date: stringValue(formData, "date"),
      adjustmentType: stringValue(formData, "adjustmentType", "other") as SalaryAdjustment["adjustmentType"],
      amount: numberValue(formData, "amount") || 0,
      reason: stringValue(formData, "reason"),
      status: stringValue(formData, "status", "approved") as SalaryAdjustment["status"],
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, salaryAdjustments: [adjustment, ...(current.salaryAdjustments || [])] }), "Salary adjustment / advance recorded.");
    event.currentTarget.reset();
  }

  function addSalaryRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const workerId = stringValue(formData, "workerId");
    const worker = data.workers.find((item) => item.id === workerId);
    const baseRate = numberValue(formData, "baseRate") || Number(worker?.salaryOrDailyRate || 0);
    const unitsWorked = numberValue(formData, "unitsWorked") || 0;
    const bonuses = numberValue(formData, "bonuses") || 0;
    const deductions = numberValue(formData, "deductions") || 0;
    const advancesRecovered = numberValue(formData, "advancesRecovered") || 0;
    const amountPaid = numberValue(formData, "amountPaid") || 0;
    const totals = calculateSalaryNetPay({ baseRate, unitsWorked, bonuses, deductions, advancesRecovered });
    const salaryRun: SalaryRun = {
      id: makeId("salary"),
      workerId,
      periodStart: stringValue(formData, "periodStart"),
      periodEnd: stringValue(formData, "periodEnd"),
      payBasis: stringValue(formData, "payBasis", "daily") as SalaryRun["payBasis"],
      baseRate,
      unitsWorked,
      grossPay: totals.grossPay,
      bonuses,
      deductions,
      advancesRecovered,
      netPay: totals.netPay,
      amountPaid,
      balance: totals.netPay - amountPaid,
      status: amountPaid >= totals.netPay && totals.netPay > 0 ? "paid" : amountPaid > 0 ? "part_paid" : "approved",
      paymentDate: stringValue(formData, "paymentDate"),
      paymentMethod: stringValue(formData, "paymentMethod", "cash") as SalaryRun["paymentMethod"],
      notes: stringValue(formData, "notes")
    };
    const payment = {
      id: makeId("pay"),
      workerId,
      payPeriod: `${salaryRun.periodStart} to ${salaryRun.periodEnd}`,
      amountDue: salaryRun.netPay,
      amountPaid: salaryRun.amountPaid,
      paymentDate: salaryRun.paymentDate,
      paymentMethod: salaryRun.paymentMethod,
      notes: `Generated from salary run. ${salaryRun.notes || ""}`.trim()
    };
    updateData(
      (current) => ({ ...current, salaryRuns: [salaryRun, ...(current.salaryRuns || [])], laborPayments: [payment, ...current.laborPayments] }),
      `Salary run created for ${getWorkerName(data, workerId)}.`
    );
    event.currentTarget.reset();
  }

  function updateSalaryRunStatus(salaryRunId: string, status: SalaryRun["status"]) {
    updateData(
      (current) => ({
        ...current,
        salaryRuns: (current.salaryRuns || []).map((salaryRun) => (salaryRun.id === salaryRunId ? { ...salaryRun, status, balance: calculateSalaryBalance(salaryRun) } : salaryRun))
      }),
      "Salary run status updated."
    );
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const task: FarmTask = {
      id: makeId("task"),
      taskTitle: stringValue(formData, "taskTitle"),
      taskType: stringValue(formData, "taskType", "other") as FarmTask["taskType"],
      cropName: stringValue(formData, "cropName"),
      plotId: stringValue(formData, "plotId"),
      assignedWorkerId: stringValue(formData, "assignedWorkerId"),
      dueDate: stringValue(formData, "dueDate"),
      priority: stringValue(formData, "priority", "medium") as FarmTask["priority"],
      status: "pending",
      estimatedCost: numberValue(formData, "estimatedCost"),
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, tasks: [task, ...current.tasks] }), `${task.taskTitle} assigned.`);
    event.currentTarget.reset();
  }

  function updateTaskStatus(taskId: string, status: FarmTask["status"]) {
    updateData(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, status, completedAt: status === "completed" ? "2026-06-17" : task.completedAt } : task))
      }),
      "Task status updated."
    );
  }

  function addMarketPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const price: MarketPriceRecord = {
      id: makeId("market"),
      cropName: stringValue(formData, "cropName"),
      market: stringValue(formData, "market"),
      unit: stringValue(formData, "unit", "kg") as MarketPriceRecord["unit"],
      price: numberValue(formData, "price") || 0,
      dateChecked: stringValue(formData, "dateChecked"),
      source: stringValue(formData, "source"),
      confidence: stringValue(formData, "confidence", "medium") as MarketPriceRecord["confidence"],
      notes: stringValue(formData, "notes")
    };
    updateData((current) => ({ ...current, marketPrices: [price, ...current.marketPrices] }), `${price.cropName} market price added.`);
    event.currentTarget.reset();
  }

  function addObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const observation: FarmObservation = {
      id: makeId("obs"),
      observationType: stringValue(formData, "observationType", "other") as FarmObservation["observationType"],
      cropName: stringValue(formData, "cropName"),
      plantingPlanId: stringValue(formData, "plantingPlanId"),
      plotId: stringValue(formData, "plotId"),
      severity: stringValue(formData, "severity", "medium") as FarmObservation["severity"],
      affectedArea: stringValue(formData, "affectedArea"),
      expectedYieldImpact: numberValue(formData, "expectedYieldImpact"),
      expectedCostImpact: numberValue(formData, "expectedCostImpact"),
      notes: stringValue(formData, "notes"),
      date: stringValue(formData, "date"),
      photoDataUrl: stringValue(formData, "photoDataUrl") || undefined
    };
    updateData((current) => ({ ...current, observations: [observation, ...current.observations] }), "Observation recorded and available for forecast adjustment.");
    event.currentTarget.reset();
  }

  // Programmatic write access for the AI assistant: turns a Gemini-proposed
  // operation into a real record in the app.
  function resolvePlotId(plotCode?: string) {
    if (!plotCode) return "";
    const q = plotCode.trim().toLowerCase();
    return data.plots.find((plot) => plot.plotCode?.toLowerCase() === q || plot.plotName?.toLowerCase() === q)?.id || "";
  }

  function applyAiOperation(op: AiOperation): string {
    if (op.type === "create_planting_plan") {
      const crop = data.cropProfiles.find((c) => c.cropName.toLowerCase() === (op.cropName || "").trim().toLowerCase());
      const plotId = resolvePlotId(op.plotCode);
      const plotRec = data.plots.find((p) => p.id === plotId);
      if (!crop) return `Couldn't create the plan — add "${op.cropName || "that crop"}" to Crop Catalog first`;
      if (!plotId) return `Couldn't create the plan — no plot matches "${op.plotCode || ""}"`;
      const plannedPlantingDate = aiDueDate(op.dueInDays);
      const plannedNurseryDate = crop.nurseryRequired ? plannedPlantingDate : "";
      const expectedTransplantDate = crop.nurseryRequired ? addDays(plannedNurseryDate || plannedPlantingDate, crop.nurseryDurationDays) : "";
      const harvestBaseDate = expectedTransplantDate || plannedPlantingDate;
      const expectedHarvestStartDate = addDays(harvestBaseDate, crop.expectedDurationToHarvestDays);
      const expectedHarvestEndDate = addDays(expectedHarvestStartDate, 14);
      const seedCount = Number(op.seedCount || 0);
      const expectedYieldPerPlant = crop.expectedYieldPerPlant || 0;
      const expectedYieldPerAcre = crop.expectedYieldPerAcre || 0;
      const expectedTotalYield = seedCount && expectedYieldPerPlant
        ? Math.round(seedCount * expectedYieldPerPlant)
        : Math.round(expectedYieldPerAcre * Number(plotRec?.equivalentAcres || 1));
      const expectedMarketPrice = Number(op.marketPrice || latestMarketPriceForCrop(data, crop.cropName)?.price || 0);
      const expectedMarketUnit = crop.marketUnit;
      const plan: PlantingPlan = {
        id: makeId("plant"),
        cropProfileId: crop.id,
        plotId,
        cropName: crop.cropName,
        variety: op.variety || "",
        plannedPlantingDate,
        plannedNurseryDate,
        expectedTransplantDate,
        expectedHarvestStartDate,
        expectedHarvestEndDate,
        seedCount,
        expectedYieldPerAcre,
        expectedYieldPerPlant,
        expectedTotalYield,
        expectedMarketPrice,
        expectedMarketUnit,
        plannedInputs: [],
        expectedRevenue: expectedTotalYield * expectedMarketPrice,
        expectedProfit: expectedTotalYield * expectedMarketPrice,
        warnings: warningsForPlan(plotRec, crop, { expectedMarketPrice }),
        status: "draft",
        notes: op.notes || "Created by Ask AI."
      };
      createPlantingPlanRecord(plan);
      return `Created ${crop.cropName} planting plan on ${getPlotName(data, plotId)}`;
    }
    if (op.type === "add_worker") {
      const allowed = ["daily_worker", "weekly_worker", "monthly_worker", "contractor"];
      const employmentType = (allowed.includes(op.employmentType || "") ? op.employmentType : "daily_worker") as FarmWorker["employmentType"];
      const worker: FarmWorker = {
        id: makeId("worker"),
        name: op.workerName || "New worker",
        phoneNumber: op.phone || "",
        role: "",
        employmentType,
        salaryOrDailyRate: Number(op.dailyRate || 0),
        startDate: AI_TODAY,
        status: "active",
        skills: [],
        notes: op.notes || "Added by Ask AI.",
        monthsPaid: []
      };
      updateData((current) => ({ ...current, workers: [worker, ...current.workers] }), `Worker added by Ask AI: ${worker.name}`);
      return `Added worker “${worker.name}”`;
    }
    if (op.type === "update_plot_status") {
      const plotId = resolvePlotId(op.plotCode);
      const plot = data.plots.find((p) => p.id === plotId);
      if (!plot) return `Couldn't update a plot — no plot matches "${op.plotCode || ""}"`;
      const landAllowed = LAND_STATUS_VALUES.includes(op.landStatus || "");
      const irrAllowed = ["none", "planned", "partial", "active", "needs_repair", "not_required"].includes(op.irrigationStatus || "");
      const patch: Partial<FarmPlot> = {};
      if (landAllowed) patch.landStatus = op.landStatus as FarmPlot["landStatus"];
      if (irrAllowed) patch.irrigationStatus = op.irrigationStatus as FarmPlot["irrigationStatus"];
      if (!Object.keys(patch).length) return `No valid status change for ${plot.plotCode}`;
      updateData((current) => ({ ...current, plots: current.plots.map((p) => (p.id === plotId ? { ...p, ...patch } : p)) }), `${plot.plotCode} updated by AI: ${[landAllowed ? labelize(op.landStatus!) : null, irrAllowed ? `irrigation ${labelize(op.irrigationStatus!)}` : null].filter(Boolean).join(", ")}.`);
      return `Updated ${plot.plotCode} → ${[landAllowed ? labelize(op.landStatus!) : null, irrAllowed ? labelize(op.irrigationStatus!) : null].filter(Boolean).join(", ")}`;
    }
    if (op.type === "edit_plan") {
      const plotId = resolvePlotId(op.plotCode);
      const cropQ = (op.cropName || "").trim().toLowerCase();
      const plan = data.plantingPlans.find((p) => p.status !== "completed" && p.status !== "cancelled" && (!plotId || p.plotId === plotId) && (!cropQ || p.cropName.toLowerCase() === cropQ));
      if (!plan) return `Couldn't edit a plan — no active plan matches ${[op.cropName, op.plotCode].filter(Boolean).join(" on ") || "that"}`;
      const planStatuses = ["draft", "approved", "active", "completed", "cancelled"];
      const patch: Partial<PlantingPlan> = {};
      if (planStatuses.includes(op.planStatus || "")) patch.status = op.planStatus as PlantingPlan["status"];
      if (op.plannedPlantingDate) patch.plannedPlantingDate = op.plannedPlantingDate;
      if (op.expectedTransplantDate) patch.expectedTransplantDate = op.expectedTransplantDate;
      if (op.expectedHarvestStartDate) patch.expectedHarvestStartDate = op.expectedHarvestStartDate;
      if (op.expectedHarvestEndDate) patch.expectedHarvestEndDate = op.expectedHarvestEndDate;
      if (op.variety) patch.variety = op.variety;
      if (Number.isFinite(op.marketPrice) && Number(op.marketPrice) > 0) patch.expectedMarketPrice = Number(op.marketPrice);
      if (Number.isFinite(op.expectedTotalYield) && Number(op.expectedTotalYield) > 0) patch.expectedTotalYield = Number(op.expectedTotalYield);
      const note = (op.appendNote || op.notes || "").trim();
      if (!Object.keys(patch).length && !note) return `No valid change for the ${plan.cropName} plan`;
      const today = new Date().toISOString().slice(0, 10);
      updateData((current) => {
        const plantingPlans = current.plantingPlans.map((p) => {
          if (p.id !== plan.id) return p;
          const merged: PlantingPlan = { ...p, ...patch };
          if (note) merged.notes = [p.notes, `[${today}] ${note}`].filter(Boolean).join("\n\n");
          merged.expectedRevenue = Number(merged.expectedTotalYield || 0) * Number(merged.expectedMarketPrice || 0);
          merged.expectedProfit = merged.expectedRevenue - planCost(merged);
          return merged;
        });
        // Keep the plot in sync if the plan's status moved.
        const plots = patch.status
          ? current.plots.map((pl) => {
              if (pl.id !== plan.plotId) return pl;
              if (patch.status === "active") return { ...pl, currentCrop: plan.cropName, landStatus: "planted" as FarmPlot["landStatus"] };
              if (patch.status === "completed") return { ...pl, previousCrop: plan.cropName, currentCrop: "None", landStatus: "fallow" as FarmPlot["landStatus"] };
              return pl;
            })
          : current.plots;
        return { ...current, plantingPlans, plots };
      }, `${plan.cropName} plan on ${getPlotName(data, plan.plotId)} updated by AI.`);
      return `Edited the ${plan.cropName} plan on ${getPlotName(data, plan.plotId)}`;
    }
    if (op.type === "log_attendance") {
      const worker = op.workerName ? data.workers.find((w) => w.name?.toLowerCase() === op.workerName!.trim().toLowerCase()) : undefined;
      if (!worker) return `Couldn't log attendance — no worker matches "${op.workerName || ""}"`;
      const allowed = ["present", "half_day", "absent", "sick", "approved_leave"];
      const status = (allowed.includes(op.attendanceStatus || "") ? op.attendanceStatus : "present") as WorkerAttendanceRecord["status"];
      const record: WorkerAttendanceRecord = {
        id: makeId("att"),
        workerId: worker.id,
        date: aiDueDate(op.dueInDays),
        plotId: resolvePlotId(op.plotCode),
        status,
        daysWorked: status === "present" ? 1 : status === "half_day" ? 0.5 : 0,
        notes: op.notes || "Logged by Ask AI."
      };
      updateData((current) => ({ ...current, attendanceRecords: [record, ...current.attendanceRecords] }), `Attendance logged for ${worker.name}: ${labelize(status)}`);
      return `Logged ${labelize(status).toLowerCase()} for ${worker.name}`;
    }
    if (op.type === "record_observation") {
      const observation: FarmObservation = {
        id: makeId("obs"),
        observationType: (op.observationType as FarmObservation["observationType"]) || "other",
        cropName: op.cropName || "",
        plotId: resolvePlotId(op.plotCode),
        severity: (op.severity as FarmObservation["severity"]) || "medium",
        affectedArea: "",
        notes: op.notes || "Recorded by Ask AI.",
        date: AI_TODAY
      };
      updateData((current) => ({ ...current, observations: [observation, ...current.observations] }), "Observation recorded by Ask AI.");
      return `Recorded ${labelize(observation.observationType).toLowerCase()} observation`;
    }
    const worker = op.workerName ? data.workers.find((w) => w.name?.toLowerCase() === op.workerName!.trim().toLowerCase()) : undefined;
    const task: FarmTask = {
      id: makeId("task"),
      taskTitle: op.taskTitle || "AI task",
      taskType: (op.taskType as FarmTask["taskType"]) || "other",
      cropName: op.cropName || "",
      plotId: resolvePlotId(op.plotCode),
      assignedWorkerId: worker?.id || "",
      dueDate: aiDueDate(op.dueInDays),
      priority: (op.priority as FarmTask["priority"]) || "medium",
      status: "pending",
      notes: op.notes || "Created by Ask AI."
    };
    updateData((current) => ({ ...current, tasks: [task, ...current.tasks] }), `Task created by Ask AI: ${task.taskTitle}`);
    return `Created task “${task.taskTitle}”`;
  }

  const desktopNav = (
    <nav className="grid gap-1 text-sm font-black text-white/82">
      {visibleNav.map(({ id, label, icon: Icon }) => (
        <button
          className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-left ${tab === id ? "bg-white text-[#193b28]" : "hover:bg-white/10"}`}
          key={id}
          onClick={() => {
            setTab(id);
            setMenuOpen(false);
          }}
          type="button"
        >
          <Icon size={17} />
          <span className="flex-1">{label}</span>
          {id === "messages" && messaging.unreadCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#b42318] px-1 text-xs font-black text-white">{messaging.unreadCount}</span> : null}
        </button>
      ))}
    </nav>
  );

  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#14213d]">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 flex-col gap-5 overflow-y-auto bg-[#193b28] p-5 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#d99a28] font-black text-[#183420]">DF</div>
          <div>
            <strong className="block text-lg">Dinotinto</strong>
            <span className="text-sm text-white/70">Farm OS Big Iteration</span>
          </div>
        </div>
        {desktopNav}
        <div className="mt-auto flex flex-col gap-3">
          {currentUser ? (
            <div className="rounded-xl border border-white/20 p-4 text-sm">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d99a28] text-xs font-black text-[#183420]">
                  {currentUser.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <strong className="block truncate">{currentUser.displayName}</strong>
                  <span className="block text-xs capitalize text-white/60">{currentUser.role}</span>
                </div>
              </div>
              <LogoutButton />
            </div>
          ) : null}
          <div className="rounded-xl border border-white/20 p-4 text-sm">
            <span className="text-white/70">Dinotinto Farm OS</span>
            <strong className="mt-1 block">Land · irrigation · labour · crop · AI</strong>
            <small className="mt-1 block text-white/70">Records sync to the database when configured, with this browser as offline backup.</small>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-[#d8dece] bg-white/90 px-4 py-3 backdrop-blur sm:px-8 sm:py-4" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center justify-between gap-3">
            {/* Mobile: compact brand bar. Desktop: full descriptive title. */}
            <div className="flex items-center gap-2.5 lg:block">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#193b28] text-sm font-black text-white lg:hidden">DF</span>
              <span className="lg:hidden">
                <span className="block text-base font-black leading-tight text-[#14213d]">Farm OS</span>
                <span className="block text-[0.7rem] font-bold uppercase tracking-wide text-[#0f8b6f]">Dinotinto</span>
              </span>
              <div className="hidden lg:block">
                <p className="text-xs font-black uppercase text-[#0f8b6f]">Farm operating system</p>
                <h1 className="text-2xl font-black sm:text-4xl">Land, irrigation, labour and crop profit command centre</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  aria-label="Notifications"
                  className="relative grid h-11 w-11 place-items-center rounded-lg border border-[#d8dece] bg-white"
                  onClick={() => setNotifOpen((open) => !open)}
                  type="button"
                >
                  {notify.unreadCount ? <BellRing size={20} className="text-[#b42318]" /> : <Bell size={20} />}
                  {notify.unreadCount ? (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#b42318] px-1 text-xs font-black text-white">
                      {notify.unreadCount}
                    </span>
                  ) : null}
                </button>
                {notifOpen ? (
                  <NotificationPanel
                    notify={notify}
                    onClose={() => setNotifOpen(false)}
                    onOpenAdvisor={() => {
                      setTab("advisor");
                      setNotifOpen(false);
                    }}
                    onOpen={(notification) => {
                      notify.markRead(notification.id);
                      const target = notificationTarget(notification, data);
                      if (target.plotId) openPlotInTab(target.tab, target.plotId);
                      else setTab(target.tab);
                      setNotifOpen(false);
                    }}
                  />
                ) : null}
              </div>
              <button className="grid h-11 w-11 place-items-center rounded-lg border border-[#d8dece] bg-white lg:hidden" onClick={() => setMenuOpen((open) => !open)} type="button">
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
          {notice ? <p className="mt-3 line-clamp-2 rounded-lg border border-[#d8dece] bg-[#fbfaf5] px-3 py-2 text-xs font-bold text-[#4b5a76] sm:text-sm">{notice}</p> : null}
        </header>

        <div className="px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-8 sm:pt-5 lg:pb-10">
          {adminMode ? (
            <div className="mb-4 rounded-xl border border-[#d8dece] bg-white p-4 text-sm font-bold text-[#4b5a76]">
              Admin mode: this workspace is intended for Codex to connect to Prisma/Postgres after the big UI + calculation layer lands.
            </div>
          ) : null}
          {tab === "dashboard" ? <DashboardView data={data} totals={totals} setTab={setTab} clearAllFarmRecords={clearAllFarmRecords} /> : null}
          {tab === "advisor" ? <AdvisorView data={data} setTab={setTab} applyAiOperation={applyAiOperation} /> : null}
          {tab === "ask-ai" ? <AskAiView data={data} setTab={setTab} applyAiOperation={applyAiOperation} /> : null}
          {tab === "farm-map" ? <FarmMapView data={data} addPlot={addPlot} updatePlotStatus={updatePlotStatus} deleteRecord={deleteRecord} openPlotInTab={openPlotInTab} /> : null}
          {tab === "irrigation" ? <IrrigationView data={data} addMaterial={addIrrigationMaterial} addPlan={addIrrigationPlan} deleteRecord={deleteRecord} focusPlotId={focusPlotId} /> : null}
          {tab === "land-clearing" ? <LandClearingView data={data} addClearingPlan={addClearingPlan} updatePlotStatus={updatePlotStatus} deleteRecord={deleteRecord} focusPlotId={focusPlotId} /> : null}
          {tab === "crop-catalog" ? <CropCatalogView data={data} addCropProfile={addCropProfile} deleteRecord={deleteRecord} /> : null}
          {tab === "planting-planner" ? <PlantingPlannerView data={data} addPlantingPlan={addPlantingPlan} deleteRecord={deleteRecord} focusPlotId={focusPlotId} createScheduleTasks={createScheduleTasks} createPlantingPlanRecord={createPlantingPlanRecord} updatePlanStatus={updatePlanStatus} enhancePlanWithAi={enhancePlanWithAi} setTab={setTab} /> : null}
          {tab === "inputs" ? <InventoryView data={data} addInventoryItem={addInventoryItem} addStockIn={addStockIn} useStock={useStock} recordTreatment={recordTreatment} deleteRecord={deleteRecord} focusPlotId={focusPlotId} setTab={setTab} /> : null}
          {tab === "accounts" ? <AccountsView data={data} addSale={addSale} addExpense={addExpense} deleteRecord={deleteRecord} focusPlotId={focusPlotId} /> : null}
          {tab === "tasks" ? <TasksView data={data} addTask={addTask} updateTaskStatus={updateTaskStatus} deleteRecord={deleteRecord} focusPlotId={focusPlotId} /> : null}
          {tab === "workers" ? <WorkersView data={data} addWorker={addWorker} updateWorker={updateWorker} addLaborPayment={addLaborPayment} deleteRecord={deleteRecord} toggleWorkerMonthPaid={toggleWorkerMonthPaid} /> : null}
          {tab === "salary" ? <SalaryView data={data} addAttendanceRecord={addAttendanceRecord} addSalaryAdjustment={addSalaryAdjustment} addSalaryRun={addSalaryRun} updateSalaryRunStatus={updateSalaryRunStatus} deleteRecord={deleteRecord} /> : null}
          {tab === "market" ? <MarketView data={data} addMarketPrice={addMarketPrice} deleteRecord={deleteRecord} /> : null}
          {tab === "forecasts" ? <ForecastView data={data} deleteRecord={deleteRecord} /> : null}
          {tab === "observations" ? <ObservationsView data={data} addObservation={addObservation} deleteRecord={deleteRecord} focusPlotId={focusPlotId} /> : null}
          {tab === "calendar" ? <CalendarView data={data} setTab={setTab} /> : null}
          {tab === "messages" ? <MessagesView msg={messaging} /> : null}
          {tab === "reports" ? <ReportsView data={data} totals={totals} /> : null}
        </div>
      </div>

      <nav className="pb-safe fixed bottom-0 left-0 right-0 z-30 grid border-t border-[#d8dece] bg-white/95 backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${(["dashboard", "ask-ai", "farm-map", "tasks", "salary"] as FarmOsTab[]).filter((id) => canSee(id)).length + 1}, minmax(0, 1fr))` }}>
        {(([
          ["dashboard", Home, "Home"],
          ["ask-ai", Bot, "Ask AI"],
          ["farm-map", Map, "Plots"],
          ["tasks", ClipboardList, "Tasks"],
          ["salary", WalletCards, "Salary"]
        ] as [FarmOsTab, IconType, string][]).filter(([id]) => canSee(id))).map(([id, Icon, label]) => {
          const active = tab === id;
          return (
            <button className="flex min-h-16 flex-col items-center justify-center gap-1 pt-1.5" key={id} onClick={() => setTab(id)} type="button">
              <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors ${active ? "bg-[#e7f5ef] text-[#0f8b6f]" : "text-[#4b5a76]"}`}>
                <Icon size={20} />
              </span>
              <span className={`text-[0.65rem] font-black ${active ? "text-[#0f8b6f]" : "text-[#4b5a76]"}`}>{label}</span>
            </button>
          );
        })}
        <button className="relative flex min-h-16 flex-col items-center justify-center gap-1 pt-1.5" onClick={() => setMenuOpen(true)} type="button">
          <span className="grid h-8 w-12 place-items-center rounded-full text-[#4b5a76]"><Menu size={20} /></span>
          <span className="text-[0.65rem] font-black text-[#4b5a76]">More</span>
          {messaging.unreadCount ? <span className="absolute right-3 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#b42318] px-1 text-[0.6rem] font-black text-white">{messaging.unreadCount}</span> : null}
        </button>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-[#0b1f16]/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} type="button" />
          <div className="pb-safe absolute right-0 top-0 flex h-full w-[80%] max-w-xs flex-col gap-4 overflow-y-auto bg-[#193b28] p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d99a28] text-sm font-black text-[#183420]">DF</span>
                <strong className="text-base">Dinotinto Farm OS</strong>
              </div>
              <button aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg bg-white/10" onClick={() => setMenuOpen(false)} type="button"><X size={18} /></button>
            </div>
            {desktopNav}
            {currentUser ? (
              <div className="mt-auto rounded-xl border border-white/20 p-4 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d99a28] text-xs font-black text-[#183420]">
                    {currentUser.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-white">{currentUser.displayName}</strong>
                    <span className="block text-xs capitalize text-white/60">{currentUser.role}</span>
                  </div>
                </div>
                <LogoutButton />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DashboardHeadline({ data, setTab }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void }) {
  const insights = useMemo(() => buildFarmInsights(data), [data]);
  const actionCount = insights.filter((i) => i.severity === "action").length;
  const watchCount = insights.filter((i) => i.severity === "watch").length;
  const acres = data.plots.reduce((sum, p) => sum + Number(p.equivalentAcres || 0), 0);
  const activePlanPlotIds = new Set(data.plantingPlans.filter((p) => p.status !== "completed" && p.status !== "cancelled").map((p) => p.plotId));
  const planted = data.plots.filter((p) => (p.currentCrop && p.currentCrop !== "None") || activePlanPlotIds.has(p.id)).length;
  const net = netCashflow(data);
  const empty = !data.plots.length && !data.cropProfiles.length;

  const headline = empty
    ? "Your farm is empty — follow the steps below to set it up."
    : `${data.plots.length} plot(s) · ${numberFormat.format(acres)} acres · ${planted} planted. Net cash so far: ${naira.format(net)} (${net >= 0 ? "in profit" : "spending more than earned"}).`;

  return (
    <section className="dt-panel p-5">
      <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">Right now</p>
      <p className="mt-1 text-lg font-black leading-7 text-[#14213d]">{headline}</p>
      {!empty ? (
        <p className="mt-1 text-sm font-bold text-[#667085]">
          {actionCount ? `${actionCount} thing(s) need action` : "Nothing urgent"}{watchCount ? ` and ${watchCount} to watch` : ""}. The Advisor turns this into a clear plan.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setTab("advisor")} type="button">
          {empty ? "Open Farm Advisor" : "See what to do next"} →
        </button>
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-4 text-sm font-black text-[#14213d]" onClick={() => setTab("ask-ai")} type="button">
          Ask AI a question
        </button>
      </div>
    </section>
  );
}

function CropStagePanel({ data, setTab }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const guidance = useMemo(() => cropStageGuidance(data, today), [data, today]);
  if (!guidance.length) return null;

  const toneStyle: Record<CropStageInfo["tone"], { bar: string; chip: string; ring: string }> = {
    action: { bar: "bg-[#b42318]", chip: "bg-[#fff4f2] text-[#b42318]", ring: "border-l-[#b42318]" },
    watch: { bar: "bg-[#0f8b6f]", chip: "bg-[#f1fbf7] text-[#0a715b]", ring: "border-l-[#0f8b6f]" },
    info: { bar: "bg-[#98a2b3]", chip: "bg-[#f3f4f6] text-[#4b5a76]", ring: "border-l-[#98a2b3]" }
  };

  const actionCount = guidance.filter((g) => g.tone === "action").length;

  return (
    <CollapsibleSection
      eyebrow="Crop watch"
      title="What each crop needs right now"
      defaultOpen
      badge={actionCount ? <Pill tone="danger">{actionCount} urgent</Pill> : <Pill tone="navy">{guidance.length}</Pill>}
    >
      <p className="text-sm font-bold text-[#667085]">Live read on every crop in the ground — tap a crop for what to watch and the next thing to do. Updated to today’s date.</p>
      <div className="mt-3 grid gap-2">
        <ShowMoreList items={guidance} initial={3} noun="crops" render={(g) => {
          const t = toneStyle[g.tone];
          return (
            <ExpandableCard
              key={g.planId}
              summary={
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{getPlotName(data, g.plotId)}</p>
                  <h3 className="truncate text-base font-black text-[#14213d]">{g.cropName}{g.variety ? ` · ${g.variety}` : ""}</h3>
                  <p className="mt-0.5 truncate text-sm font-bold text-[#4b5a76]">{g.headline}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#edf1e7]">
                    <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${Math.max(g.progressPct, 3)}%` }} />
                  </div>
                </div>
              }
              badges={<span className={`rounded-full px-3 py-1 text-xs font-black ${t.chip}`}>{g.stageLabel}</span>}
            >
              <ul className="grid gap-1 text-sm font-bold leading-6 text-[#4b5a76]">
                {g.observe.map((line, i) => <li key={i}>👀 {line}</li>)}
              </ul>
              <p className="mt-2 rounded-lg bg-[#fbfaf5] p-2.5 text-sm font-black leading-6 text-[#0a715b]">➜ Next: {g.nextAction}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-xs font-black text-[#4b5a76]" onClick={() => setTab("observations")} type="button">Log observation</button>
                <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-xs font-black text-[#4b5a76]" onClick={() => setTab("tasks")} type="button">Add task</button>
                {g.stage === "harvest" || g.stage === "overdue_harvest" ? (
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-xs font-black text-[#4b5a76]" onClick={() => setTab("accounts")} type="button">Record sale</button>
                ) : null}
              </div>
            </ExpandableCard>
          );
        }} />
      </div>
    </CollapsibleSection>
  );
}

function UpcomingTasksPanel({ data, setTab }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const upcoming = data.tasks
    .filter((t) => t.status !== "completed" && t.dueDate >= today && t.dueDate <= in30)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function dayLabel(date: string) {
    if (date === today) return "Today";
    if (date <= in3) return "In 1-3 days";
    if (date <= in7) return "This week";
    return "Coming up";
  }

  function priorityTone(p: string): "danger" | "warning" | "navy" | "green" {
    if (p === "urgent") return "danger";
    if (p === "high") return "warning";
    if (p === "medium") return "navy";
    return "green";
  }

  return (
    <CollapsibleSection
      eyebrow="Your schedule"
      title="Upcoming tasks with dates"
      defaultOpen
      badge={upcoming.length ? <Pill tone="navy">{upcoming.length}</Pill> : undefined}
    >
      <p className="text-sm font-bold leading-6 text-[#667085]">
        Tasks due in the next 30 days — so you can plan ahead even before they become urgent.
      </p>
      {upcoming.length ? (
        <div className="mt-3 grid gap-2">
          <ShowMoreList items={upcoming} initial={5} noun="tasks" render={(task) => (
            <article className="flex items-start justify-between gap-3 rounded-xl border border-[#edf1e7] bg-white p-4" key={task.id}>
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 shrink-0 text-[#0f8b6f]" size={18} />
                <div>
                  <strong className="block text-sm text-[#14213d]">{task.taskTitle}</strong>
                  <span className="mt-0.5 block text-xs font-bold text-[#667085]">
                    {dayLabel(task.dueDate)} · {task.dueDate}
                    {task.cropName ? ` · ${task.cropName}` : ""}
                    {task.assignedWorkerId ? ` · ${data.workers.find((w) => w.id === task.assignedWorkerId)?.name || ""}` : ""}
                  </span>
                </div>
              </div>
              <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
            </article>
          )} />
          <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => setTab("tasks")} type="button">All tasks</button>
        </div>
      ) : (
        <EmptyState text="No tasks due in the next 30 days. Add tasks with due dates in the Tasks screen to see your schedule here." />
      )}
    </CollapsibleSection>
  );
}

function DashboardView({ data, totals, setTab, clearAllFarmRecords }: { data: FarmOsData; totals: ReturnType<typeof useDashboardTotals>; setTab: (tab: FarmOsTab) => void; clearAllFarmRecords: () => void }) {
  const alerts = [
    ...data.plots
      .filter((plot) => ["bushy", "needs_clearing", "needs_ridging", "waterlogged"].includes(plot.landStatus))
      .slice(0, 3)
      .map((plot) => `${plot.plotCode} needs attention: ${labelize(plot.landStatus)} before planting.`),
    ...data.plantingPlans
      .flatMap((plan) => plan.warnings.map((warning) => `${plan.cropName} on ${getPlotName(data, plan.plotId)}: ${warning}.`))
      .slice(0, 3),
    ...data.laborPayments
      .filter((payment) => calculateLaborBalance(payment) > 0)
      .slice(0, 2)
      .map((payment) => `${getWorkerName(data, payment.workerId)} has unpaid labour balance of ${naira.format(calculateLaborBalance(payment))}.`)
  ];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Dashboard — your farm at a glance">
        Your home screen. Each card below is a live total — <b>tap any card to open that screen</b>. <b>Red</b> numbers need attention, <b>green</b> is healthy. New here? Follow the numbered steps, or tap “See what to do next”.
      </PageIntro>

      <DashboardHeadline data={data} setTab={setTab} />

      <CollapsibleSection eyebrow="Recommended workflow" title="Use the app in this order">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["1", "Set up plot", "Create a Nigerian farm acre such as 300 × 100 ft or 200 × 150 ft.", "farm-map"],
            ["2", "Add materials", "Choose pump, tank, well, drip lines, hose, labour and enter your prices.", "irrigation"],
            ["3", "Create crop", "Pick cucumber, pepper, plantain, tomato or type your own crop/variety.", "crop-catalog"],
            ["4", "Plan planting", "Select crop + plot and let dates, yield and warnings calculate.", "planting-planner"],
            ["5", "Ask AI", "Ask what is missing, what to do next, or pest/crop questions.", "ask-ai"]
          ].map(([step, title, detail, target]) => (
            <button className="rounded-2xl border border-[#d8dece] bg-[#fbfaf5] p-4 text-left hover:border-[#0f8b6f]" key={step} onClick={() => setTab(target as FarmOsTab)} type="button">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0f8b6f] text-sm font-black text-white">{step}</span>
              <strong className="mt-3 block text-[#14213d]">{title}</strong>
              <small className="mt-1 block font-bold leading-5 text-[#667085]">{detail}</small>
            </button>
          ))}
        </div>
      </CollapsibleSection>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={Map} label="Total mapped acres" value={numberFormat.format(totals.totalAcres)} hint={`${data.plots.length} plots with editable actual sizes`} />
        <DashboardCard icon={Droplets} label="Irrigated acres" value={numberFormat.format(totals.irrigatedAcres)} hint={`${data.plots.filter((plot) => plot.irrigated).length} plots irrigated or partly irrigated`} tone="gold" />
        <DashboardCard icon={AlertTriangle} label="Plots needing work" value={totals.bushyPlots} hint="Bushy, clearing, ridging or water issue" tone="danger" />
        <DashboardCard icon={Coins} label="Expected profit" value={naira.format(totals.expectedProfitTotal)} hint="Forecast from active planting plans" />
        <DashboardCard icon={BarChart3} label="Net cash so far" value={naira.format(netCashflow(data))} hint="Actual sales received minus money spent" tone={netCashflow(data) >= 0 ? "green" : "danger"} />
        <DashboardCard icon={ClipboardList} label="Open tasks" value={totals.pendingTasks} hint={`${totals.overdueTasks} overdue task(s)`} tone={totals.overdueTasks ? "danger" : "green"} />
        <DashboardCard icon={Users} label="Unpaid labour" value={naira.format(totals.unpaidLabor)} hint="Balance across quick worker payments" tone={totals.unpaidLabor > 0 ? "warning" : "green"} />
        <DashboardCard icon={WalletCards} label="Salary payroll" value={naira.format(totals.salaryBalance)} hint={`${numberFormat.format(totals.attendanceDays)} attendance days logged`} tone={totals.salaryBalance > 0 ? "warning" : "green"} />
        <DashboardCard icon={Package} label="Other expenses" value={naira.format(totals.inputTotal)} hint="Labour, transport, fuel, packaging (non-stock)" />
        <DashboardCard icon={Droplets} label="Irrigation setup" value={naira.format(totals.irrigationSummary.total)} hint="Material list total for expansion costing" />
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <CollapsibleSection
          eyebrow="Action alerts"
          title="What needs attention now"
          defaultOpen
          badge={alerts.length ? <Pill tone="danger">{alerts.length}</Pill> : <Pill tone="green">0</Pill>}
        >
          <div className="grid gap-3">
            {alerts.length ? <ShowMoreList items={alerts} initial={4} noun="alerts" render={(alert) => (
              <article className="flex gap-3 rounded-xl border border-[#fecdca] bg-[#fff4f2] p-4" key={alert}>
                <AlertTriangle className="shrink-0 text-[#b42318]" size={20} />
                <p className="text-sm font-bold leading-6 text-[#7a271a]">{alert}</p>
              </article>
            )} /> : <EmptyState text="No major alerts yet. Add plot readiness, planting plans, tasks and payments to see real warnings." />}
            <button className="rounded-lg bg-[#0f8b6f] px-4 py-2 text-sm font-black text-white" onClick={() => setTab("tasks")} type="button">Open tasks</button>
          </div>
        </CollapsibleSection>

        <CollapsibleSection eyebrow="Irrigation snapshot" title="Expansion costing">
          <div className="grid gap-3 sm:grid-cols-2">
            <DashboardCard icon={Coins} label="Cost per acre" value={naira.format(totals.irrigationSummary.costPerAcre)} hint="From current materials list" tone="gold" />
            <DashboardCard icon={WalletCards} label="Reusable equipment" value={naira.format(totals.irrigationSummary.reusable)} hint="Pump, tank, hose and reusable items" />
            <DashboardCard icon={Package} label="Consumables" value={naira.format(totals.irrigationSummary.consumable)} hint="Drip lines, fittings and similar" />
            <DashboardCard icon={UserRoundCheck} label="Labour/maintenance" value={naira.format(totals.irrigationSummary.labor + totals.irrigationSummary.maintenanceEstimate)} hint="Setup labour plus 8% maintenance estimate" tone="navy" />
          </div>
        </CollapsibleSection>
      </section>

      <CropStagePanel data={data} setTab={setTab} />

      <UpcomingTasksPanel data={data} setTab={setTab} />

      <section className="grid gap-3.5 sm:gap-5 2xl:grid-cols-3">
        <div className="2xl:col-span-2">
        <CollapsibleSection eyebrow="Planting plans" title="Profit forecast by crop" badge={<Pill tone="navy">{data.plantingPlans.length}</Pill>}>
          <div className="max-w-full overflow-x-auto dt-scroll-x">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-[#667085]">
                <tr>
                  <th className="py-3">Crop</th>
                  <th>Plot</th>
                  <th>Cost</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Margin</th>
                  <th>Warnings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1e7]">
                {data.plantingPlans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="py-3 font-black">{plan.cropName}</td>
                    <td>{getPlotName(data, plan.plotId)}</td>
                    <td>{naira.format(planCost(plan))}</td>
                    <td>{naira.format(expectedRevenue(plan))}</td>
                    <td className={expectedProfit(plan) < 0 ? "font-black text-[#b42318]" : "font-black text-[#0f8b6f]"}>{naira.format(expectedProfit(plan))}</td>
                    <td>{numberFormat.format(profitMargin(plan))}%</td>
                    <td><Pill tone={plan.warnings.length ? "warning" : "green"}>{plan.warnings.length}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
        </div>

        <CollapsibleSection eyebrow="Labour" title="Worker workload" badge={<Pill tone="navy">{data.workers.length}</Pill>}>
          <div className="grid gap-3">
            <ShowMoreList items={data.workers} initial={5} noun="workers" render={(worker) => {
              const tasks = data.tasks.filter((task) => task.assignedWorkerId === worker.id && task.status !== "completed");
              return (
                <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={worker.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{worker.name}</strong>
                      <p className="text-sm text-[#667085]">{worker.role || labelize(worker.employmentType)}</p>
                    </div>
                    <Pill tone={tasks.length ? "warning" : "green"}>{tasks.length} task(s)</Pill>
                  </div>
                </article>
              );
            }} />
          </div>
        </CollapsibleSection>
      </section>

      <details className="rounded-xl border border-[#edf1e7] bg-[#fbfaf5] p-3">
        <summary className="cursor-pointer text-xs font-black uppercase tracking-wide text-[#667085]">Danger zone</summary>
        <p className="mt-2 text-sm font-bold leading-6 text-[#4b5a76]">Permanently delete every record (plots, crops, workers, plans, costs). This cannot be undone.</p>
        <button className="mt-2 rounded-lg border border-[#fecdca] bg-[#fff4f2] px-4 py-2 text-sm font-black text-[#b42318]" onClick={clearAllFarmRecords} type="button">
          Clear all records and start fresh
        </button>
      </details>
    </div>
  );
}

const CATEGORY_META: Record<InsightCategory, { label: string; icon: IconType }> = {
  land: { label: "Land & clearing", icon: Tractor },
  irrigation: { label: "Irrigation", icon: Droplets },
  labour: { label: "Labour", icon: Users },
  crop: { label: "Crop & profit", icon: Sprout },
  cost: { label: "Cost flags", icon: Coins }
};

function insightTone(severity: FarmInsight["severity"]): "green" | "danger" | "warning" | "navy" {
  if (severity === "action") return "danger";
  if (severity === "watch") return "warning";
  return "navy";
}

function WhatsNextBriefing({ data, setTab }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void }) {
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState("");
  const [actions, setActions] = useState<{ label: string; tab: FarmOsTab }[]>([]);
  const [engine, setEngine] = useState<"gemini" | "rules" | "">("");

  async function ask() {
    if (pending) return;
    setPending(true);
    const todayDate = new Date().toISOString().slice(0, 10);
    const question =
      `Today is ${todayDate}. Act as my farm manager. Look at my whole farm right now and give me a clear action plan. First, list any tasks due TODAY or in the next 7 days with their exact due dates so I can prepare in advance. Then list the 4-6 most important things I should do next in priority order — for each: the action, why it matters, the specific date or timeframe, and which app screen to use. Be specific to my actual records (plots, planting plans, inventory/stock, tasks with due dates, workers, payroll, sales, costs). Flag anything overdue first, then upcoming, then what to plan ahead for.`;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, question })
      });
      const result = (await res.json()) as { answer?: string; source?: "gemini" | "rules"; actions?: { label: string; tab: FarmOsTab }[] };
      setAnswer(result.answer || "No suggestion available — add more records and try again.");
      setActions(Array.isArray(result.actions) ? result.actions : []);
      setEngine(result.source || "rules");
    } catch {
      const local = answerFarmQuestion(data, "what should I do next");
      setAnswer(local.answer);
      setActions((local.actions || []).map((a) => ({ label: a.label, tab: a.tab })));
      setEngine("rules");
    } finally {
      setPending(false);
    }
  }

  return (
    <CollapsibleSection eyebrow="AI planning" title="What should I do next?" badge={engine ? <Pill tone={engine === "gemini" ? "green" : "navy"}>{engine === "gemini" ? "Gemini" : "built-in"}</Pill> : undefined}>
      <p className="text-sm font-bold leading-6 text-[#667085]">
        Get a clear, ranked plan for the next few days, written from your live farm records.
      </p>
      <button
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white disabled:opacity-50"
        disabled={pending}
        onClick={ask}
        type="button"
      >
        <Sparkles size={16} /> {pending ? "Thinking…" : answer ? "Refresh plan" : "Ask AI what to do next"}
      </button>
      {answer ? (
        <div className="mt-4 rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4">
          <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-[#14213d]">{answer}</p>
          {actions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action) => (
                <GuidanceAction key={`${action.label}-${action.tab}`} label={action.label} onClick={() => setTab(action.tab)} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

// Upload a farm photo (crop, problem, or produce) and let the AI advisor look at
// it, diagnose, and propose tasks/observations tied to the chosen plot.
function PhotoAdvisor({ data, applyAiOperation, setTab }: { data: FarmOsData; applyAiOperation: (op: AiOperation) => string; setTab: (tab: FarmOsTab) => void }) {
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [plotId, setPlotId] = useState("");
  const [planId, setPlanId] = useState("");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ analysis: string; severity?: string; operations: AiOperation[] } | null>(null);
  const [applied, setApplied] = useState<Record<number, string>>({});

  async function pick(file: File) {
    setBusy(true);
    setResult(null);
    setError("");
    try { setImg(await compressImage(file, 1100, 0.6)); } catch { setError("Could not read that image."); } finally { setBusy(false); }
  }

  async function analyze() {
    if (!img || pending) return;
    setPending(true);
    setError("");
    setResult(null);
    setApplied({});
    const plot = data.plots.find((p) => p.id === plotId);
    const plan = data.plantingPlans.find((p) => p.id === planId);
    const body = {
      imageDataUrl: img,
      context: {
        plotCode: plot?.plotCode,
        plotName: plot?.plotName,
        crop: plan?.cropName || plot?.currentCrop || undefined,
        planSummary: plan?.notes || undefined,
        question: question.trim() || undefined
      }
    };
    try {
      const res = await fetch("/api/analyze-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok?: boolean; analysis?: string; severity?: string; operations?: AiOperation[]; error?: string };
      if (j.ok && j.analysis) setResult({ analysis: j.analysis, severity: j.severity, operations: j.operations || [] });
      else setError(j.error || "Could not analyze the photo. Try again.");
    } catch {
      setError("Could not reach the analyzer — check your connection.");
    } finally {
      setPending(false);
    }
  }

  const sevTone = result?.severity === "critical" || result?.severity === "high" ? "danger" : result?.severity === "medium" ? "warning" : "green";
  const selectedPlotCode = data.plots.find((p) => p.id === plotId)?.plotCode;
  // Every finding must be tied to the chosen plot — force the plot code on so
  // the task/observation lands on the right plot even if the model omitted it.
  const withPlot = (op: AiOperation): AiOperation => ({ ...op, plotCode: op.plotCode || selectedPlotCode });
  function applyAll() {
    if (!result) return;
    const next: Record<number, string> = { ...applied };
    result.operations.forEach((op, i) => { if (!next[i]) next[i] = applyAiOperation(withPlot(op)); });
    setApplied(next);
  }

  return (
    <CollapsibleSection eyebrow="Photo advisor" title="Send a photo, get advice + tasks" badge={<Pill tone="navy"><Camera size={12} className="mr-1 inline" /> AI vision</Pill>}>
      <p className="text-sm font-bold leading-6 text-[#667085]">Take or upload a picture — a sick plant, the whole plot, pests, or your harvested produce. The advisor looks at it, tells you what it sees and what to do, and can add the tasks to the right plot.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Photo">
          {img ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="to analyze" className="h-20 w-20 rounded-lg border border-[#d8dece] object-cover" />
              <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#e0443a] px-3 text-xs font-black text-[#e0443a]" onClick={() => { setImg(""); setResult(null); }} type="button"><X size={14} /> Remove</button>
            </div>
          ) : (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#cdeee2] bg-[#f1fbf7] px-4 text-sm font-black text-[#0a715b]">
              <Camera size={16} /> {busy ? "Processing…" : "Take / choose photo"}
              <input accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); }} type="file" />
            </label>
          )}
        </Field>
        <Field label="Which plot? (so tasks attach there)">
          <select className={inputClass} value={plotId} onChange={(e) => setPlotId(e.target.value)}>
            <option value="">Not sure / general</option>
            {data.plots.map((p) => <option key={p.id} value={p.id}>{p.plotCode} — {p.plotName}</option>)}
          </select>
        </Field>
        <Field label="Link a planting plan (optional)">
          <select className={inputClass} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">None</option>
            {data.plantingPlans.filter((p) => p.status !== "completed" && p.status !== "cancelled").map((p) => <option key={p.id} value={p.id}>{p.cropName} — {getPlotName(data, p.plotId)}</option>)}
          </select>
        </Field>
        <Field label="Anything to ask about it? (optional)">
          <input className={inputClass} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. is this blight? is it ready to harvest?" />
        </Field>
      </div>

      <button className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={!img || pending} onClick={analyze} type="button">
        <Sparkles size={16} /> {pending ? "Analyzing photo…" : "Analyze with AI"}
      </button>
      {error ? <p className="mt-2 text-sm font-black text-[#b42318]">{error}</p> : null}

      {result ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">What the advisor sees</p>
              {result.severity ? <Pill tone={sevTone}>{labelize(result.severity)}</Pill> : null}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6 text-[#4b5a76]">{result.analysis}</p>
          </div>
          {result.operations.length ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Suggested next steps{selectedPlotCode ? ` for ${selectedPlotCode}` : ""}</p>
                <button className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#14213d] px-3 text-xs font-black text-white" onClick={applyAll} type="button"><Plus size={14} /> Apply all</button>
              </div>
              {result.operations.map((op, i) => {
                const done = applied[i];
                const kind = op.type === "record_observation" ? { head: "Log an observation", cta: "Record it", title: `${labelize(op.observationType || "observation")} observation` }
                  : op.type === "update_plot_status" ? { head: "Update the plot", cta: "Update plot", title: `${op.plotCode || "Plot"} → ${[op.landStatus ? labelize(op.landStatus) : null, op.irrigationStatus ? `irrigation ${labelize(op.irrigationStatus)}` : null].filter(Boolean).join(", ")}` }
                  : op.type === "edit_plan" ? { head: "Edit the plan", cta: "Update plan", title: `${op.cropName || "Plan"}${op.plotCode ? ` on ${op.plotCode}` : ""}: ${[op.planStatus ? `status ${labelize(op.planStatus)}` : null, op.expectedHarvestStartDate ? `harvest ${op.expectedHarvestStartDate}` : null, op.appendNote ? "note" : null].filter(Boolean).join(", ") || "update"}` }
                  : { head: "Add a task", cta: "Add to Tasks", title: op.taskTitle || "New task" };
                const meta = [op.plotCode ? `Plot ${op.plotCode}` : null, op.cropName || null, op.type === "create_task" && op.priority ? `${op.priority} priority` : null, op.type === "create_task" && Number.isFinite(op.dueInDays) ? `in ${op.dueInDays}d` : null, op.type === "record_observation" && op.severity ? `${op.severity} severity` : null].filter(Boolean).join(" · ");
                return (
                  <div className="rounded-xl border border-[#edf1e7] bg-white p-3" key={i}>
                    <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{kind.head}</p>
                    <strong className="mt-1 block text-sm text-[#14213d]">{kind.title}</strong>
                    {meta ? <p className="text-xs font-bold text-[#667085]">{meta}</p> : null}
                    {op.notes ? <p className="mt-1 text-sm font-bold leading-6 text-[#4b5a76]">{op.notes}</p> : null}
                    {done ? <p className="mt-2 text-sm font-black text-[#0f8b6f]">✓ {done}</p> : (
                      <button className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f8b6f] px-3 text-xs font-black text-white" onClick={() => setApplied((c) => ({ ...c, [i]: applyAiOperation(withPlot(op)) }))} type="button"><Plus size={14} /> {kind.cta}</button>
                    )}
                  </div>
                );
              })}
              <button className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-black text-[#0f8b6f]" onClick={() => setTab("tasks")} type="button">Open Tasks →</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </CollapsibleSection>
  );
}

function AdvisorView({ data, setTab, applyAiOperation }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void; applyAiOperation: (op: AiOperation) => string }) {
  const insights = useMemo(() => buildFarmInsights(data), [data]);
  const profit = useMemo(() => profitByCrop(data), [data]);
  const plans = useMemo(() => workerWeekPlan(data), [data]);
  const activity = useMemo(() => recentActivity(data), [data]);

  const [cropId, setCropId] = useState(data.cropProfiles[0]?.id || "");
  const selectedCrop = data.cropProfiles.find((crop) => crop.id === cropId);
  const ranked = useMemo(() => bestPlotsForCrop(data, selectedCrop), [data, selectedCrop]);
  const topPlot = ranked[0];

  const actionCount = insights.filter((insight) => insight.severity === "action").length;
  const watchCount = insights.filter((insight) => insight.severity === "watch").length;

  const grouped = (Object.keys(CATEGORY_META) as InsightCategory[])
    .map((category) => ({ category, items: insights.filter((insight) => insight.category === category) }))
    .filter((group) => group.items.length);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Farm Advisor">
        This page reads your own records and turns them into practical suggestions. It can highlight plots that need clearing, irrigation gaps, worker workload, high costs and crop profit risks. Add records on the other pages first so the advice is based on your actual farm.
      </PageIntro>

      <CollapsibleSection
        eyebrow="Farm advisor"
        title="Your prioritised to-do list"
        badge={<Pill tone={actionCount ? "danger" : "green"}>{actionCount} action · {watchCount} watch</Pill>}
      >
        <p className="text-sm font-bold leading-6 text-[#667085]">
          The Advisor reads all your records and tells you what matters most, ranked: <b>Action</b> = do it now (overdue salary, plot needs clearing, plan running at a loss), <b>Watch</b> = keep an eye on it. It also recommends the best plot for a crop, profit by crop, and what each worker should do this week. Tap any item to go and fix it — it turns your data into next steps so you are not guessing.
        </p>
      </CollapsibleSection>

      <WhatsNextBriefing data={data} setTab={setTab} />

      <PhotoAdvisor data={data} applyAiOperation={applyAiOperation} setTab={setTab} />

      <CropStagePanel data={data} setTab={setTab} />

      <UpcomingTasksPanel data={data} setTab={setTab} />

      <section className="grid gap-3.5 sm:gap-5 2xl:grid-cols-[0.95fr_1.05fr]">
        <CollapsibleSection eyebrow="Crop placement" title="Best plot for a crop">
          <div className="grid gap-3">
            <Field label="Choose a crop">
              <select className={inputClass} onChange={(event) => setCropId(event.target.value)} value={cropId}>
                {data.cropProfiles.map((crop) => (
                  <option key={crop.id} value={crop.id}>{crop.cropName}</option>
                ))}
              </select>
            </Field>
            {topPlot ? (
              <article className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">Recommended</p>
                <strong className="mt-1 block text-lg text-[#14213d]">{getPlotName(data, topPlot.plot.id)}</strong>
                <p className="mt-1 text-sm font-bold text-[#4b5a76]">{topPlot.reasons.join(" · ")}</p>
                {!topPlot.plot.irrigated && (selectedCrop?.irrigationRecommended || selectedCrop?.waterNeed === "high") ? (
                  <p className="mt-2 text-sm font-bold text-[#b42318]">
                    Not irrigated — irrigation setup would cost ~{naira.format(irrigationCostForPlot(data, topPlot.plot))}.
                  </p>
                ) : null}
              </article>
            ) : <EmptyState text="Add plots to get a placement recommendation." />}
            {ranked.length > 1 ? (
              <div className="grid gap-2">
                {ranked.slice(1, 4).map((entry) => (
                  <div className="flex items-center justify-between rounded-lg border border-[#edf1e7] bg-white px-3 py-2 text-sm font-bold text-[#4b5a76]" key={entry.plot.id}>
                    <span>{entry.plot.plotCode}</span>
                    <span className="text-[#667085]">{entry.reasons[0]}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </CollapsibleSection>

        <CollapsibleSection eyebrow="Profit" title="Expected profit by crop" badge={<Pill tone="navy">{profit.length}</Pill>}>
          <div className="max-w-full overflow-x-auto dt-scroll-x">
            {profit.length ? (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase text-[#667085]">
                  <tr><th className="py-2">Crop</th><th>Plans</th><th>Cost</th><th>Revenue</th><th>Profit</th></tr>
                </thead>
                <tbody>
                  {profit.map((row) => (
                    <tr key={row.cropName}>
                      <td className="py-3 font-black">{row.cropName}</td>
                      <td>{row.plans}</td>
                      <td>{naira.format(row.cost)}</td>
                      <td>{naira.format(row.revenue)}</td>
                      <td className={row.profit < 0 ? "font-black text-[#b42318]" : "font-black text-[#0f8b6f]"}>{naira.format(row.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState text="Add planting plans to see profit by crop." />}
          </div>
        </CollapsibleSection>
      </section>

      <div className="grid gap-3.5 sm:gap-5">
        <SectionHeader eyebrow="Recommendations" title="Prioritised insights" />
        {grouped.length ? grouped.map((group) => {
          const Icon = CATEGORY_META[group.category].icon;
          const groupAction = group.items.some((insight) => insight.severity === "action");
          return (
            <CollapsibleSection
              key={group.category}
              title={CATEGORY_META[group.category].label}
              defaultOpen={groupAction}
              badge={<><Icon className="text-[#0f8b6f]" size={16} /><Pill tone={groupAction ? "danger" : "navy"}>{group.items.length}</Pill></>}
            >
              <div className="grid gap-3">
                <ShowMoreList items={group.items} initial={4} noun="items" render={(insight) => (
                  <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={insight.id}>
                    <div className="flex items-start justify-between gap-3">
                      <strong className="text-sm text-[#14213d]">{insight.title}</strong>
                      <Pill tone={insightTone(insight.severity)}>{labelize(insight.severity)}</Pill>
                    </div>
                    <p className="mt-1 text-sm font-bold leading-6 text-[#4b5a76]">{insight.detail}</p>
                  </article>
                )} />
              </div>
            </CollapsibleSection>
          );
        }) : <EmptyState text="No advisor findings yet. As you log plots, plans, tasks and costs, recommendations appear here." />}
      </div>

      <section className="grid gap-3.5 sm:gap-5 2xl:grid-cols-[1.05fr_0.95fr]">
        <CollapsibleSection eyebrow="This week" title="What each worker should do" badge={<Pill tone="navy">{plans.length}</Pill>}>
          <div className="grid gap-3">
            {plans.length ? <ShowMoreList items={plans} initial={5} noun="workers" render={({ worker, openTasks, outstandingPay }) => (
              <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={worker.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong>{worker.name}</strong>
                    <p className="text-sm text-[#667085]">{worker.role || labelize(worker.employmentType)}</p>
                  </div>
                  {outstandingPay > 0 ? <Pill tone="warning">owed {naira.format(outstandingPay)}</Pill> : <Pill tone="green">paid up</Pill>}
                </div>
                {openTasks.length ? (
                  <ul className="mt-2 grid gap-1 text-sm font-bold text-[#4b5a76]">
                    {openTasks.map((task) => <li key={task.id}>• {task.taskTitle} <span className="text-[#667085]">({task.dueDate})</span></li>)}
                  </ul>
                ) : <p className="mt-2 text-sm font-bold text-[#0f8b6f]">No open tasks.</p>}
              </article>
            )} /> : <EmptyState text="Add active workers and assign tasks to build week plans." />}
          </div>
        </CollapsibleSection>

        <CollapsibleSection eyebrow="Changes" title="What changed recently" badge={activity.length ? <Pill tone="navy">{activity.length}</Pill> : undefined}>
          <div className="grid gap-2">
            {activity.length ? <ShowMoreList items={activity} initial={6} noun="updates" render={(item, index) => (
              <div className="flex items-center justify-between rounded-lg border border-[#edf1e7] bg-white px-3 py-2 text-sm font-bold text-[#4b5a76]" key={`${item.date}-${index}`}>
                <span>{item.text}</span>
                <span className="shrink-0 text-[#667085]">{item.date}</span>
              </div>
            )} /> : <EmptyState text="No recent dated activity in the last two weeks." />}
          </div>
        </CollapsibleSection>
      </section>
    </div>
  );
}

function NotificationPanel({
  notify,
  onClose,
  onOpenAdvisor,
  onOpen
}: {
  notify: ReturnType<typeof useFarmNotifications>;
  onClose: () => void;
  onOpenAdvisor: () => void;
  onOpen: (notification: FarmNotification) => void;
}) {
  return (
    <>
      <button aria-hidden className="fixed inset-0 z-30 cursor-default" onClick={onClose} type="button" tabIndex={-1} />
      <div className="absolute right-0 z-40 mt-2 w-[20rem] max-w-[88vw] rounded-xl border border-[#d8dece] bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm font-black text-[#14213d]">Notifications</strong>
          <button className="text-xs font-black text-[#0f8b6f]" onClick={notify.markAllRead} type="button">
            <CheckCheck size={14} className="inline" /> Mark all read
          </button>
        </div>
        {notify.pushPermission !== "granted" && notify.pushPermission !== "unsupported" ? (
          <button
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#193b28] px-3 py-2 text-xs font-black text-white"
            onClick={notify.requestPush}
            type="button"
          >
            <BellRing size={14} /> Enable push alerts on this device
          </button>
        ) : null}
        {notify.pushPermission === "granted" ? (
          <p className="mt-2 rounded-lg bg-[#f1fbf7] px-3 py-2 text-xs font-bold text-[#0f8b6f]">Push alerts are on for this device.</p>
        ) : null}
        <div className="mt-3 grid max-h-[18rem] gap-2 overflow-y-auto">
          {notify.notifications.length ? (
            notify.notifications.slice(0, 12).map((notification) => {
              const unread = notify.unread.some((item) => item.id === notification.id);
              return (
                <button
                  className={`rounded-lg border p-3 text-left ${unread ? "border-[#fecdca] bg-[#fff4f2]" : "border-[#edf1e7] bg-white"}`}
                  key={notification.id}
                  onClick={() => onOpen(notification)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm text-[#14213d]">{notification.title}</strong>
                    <Pill tone={notification.severity === "action" ? "danger" : "warning"}>{labelize(notification.severity)}</Pill>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#4b5a76]">{notification.body}</p>
                  <span className="mt-1 inline-block text-xs font-black text-[#0f8b6f]">Open →</span>
                </button>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed border-[#d8dece] bg-[#fbfaf5] p-3 text-xs font-bold text-[#667085]">
              All clear. New action items will appear here.
            </p>
          )}
        </div>
        <button className="mt-3 w-full rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-xs font-black text-[#14213d]" onClick={onOpenAdvisor} type="button">
          Open Farm Advisor
        </button>
      </div>
    </>
  );
}

type ChatAction = { label: string; tab: FarmOsTab };
type ChatTurn = { role: "user" | "assistant"; text: string; bullets?: string[]; actions?: ChatAction[]; operations?: AiOperation[] };

function AskAiView({ data, setTab, applyAiOperation }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void; applyAiOperation: (op: AiOperation) => string }) {
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [engine, setEngine] = useState<"gemini" | "rules" | "unknown">("unknown");
  const [listening, setListening] = useState(false);
  const [appliedOps, setAppliedOps] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputFormRef = useRef<HTMLFormElement | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      role: "assistant",
      text: "Hi! I'm your Farm OS AI assistant. I can guide you from setup to action: create plots, price irrigation, plan planting, check crop maturity dates, review payroll, and answer practical crop questions like whiteflies or disease control.",
      bullets: ["Start by asking: I want to set up a new acre", "Ask: How much will irrigation cost?", "Ask: Best way to fight whiteflies", "Ask: Help me plan cucumber on Acre A"],
      actions: [{ label: "Set up first plot", tab: "farm-map" }, { label: "Open irrigation", tab: "irrigation" }]
    }
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  // On opening the Ask AI tab, scroll straight to the input so the user can type.
  useEffect(() => {
    const id = window.setTimeout(() => inputFormRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 150);
    return () => window.clearTimeout(id);
  }, []);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setInput("");
    // Send the recent conversation so follow-ups ("give me a brand name") keep context.
    const history = turns
      .filter((turn) => turn.text)
      .slice(-6)
      .map((turn) => ({
        role: turn.role,
        // Surface what the assistant proposed so "yes do it but leave X" can re-issue it minus X.
        text: turn.role === "assistant" && turn.operations?.length
          ? `${turn.text}\n[Proposed actions you can refine: ${turn.operations.map(describeAiOperation).join("; ")}]`
          : turn.text
      }));
    setTurns((current) => [...current, { role: "user", text: trimmed }]);
    setPending(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, question: trimmed, history })
      });
      if (!res.ok) throw new Error("agent route error");
      const result = (await res.json()) as { answer: string; bullets?: string[]; source?: "gemini" | "rules"; actions?: ChatAction[]; operations?: AiOperation[] };
      setEngine(result.source || "rules");
      setTurns((current) => [...current, { role: "assistant", text: result.answer, bullets: result.bullets, actions: result.actions, operations: result.operations }]);
    } catch {
      const local: AgentAnswer = answerFarmQuestion(data, trimmed);
      setEngine("rules");
      setTurns((current) => [...current, { role: "assistant", text: local.answer, bullets: local.bullets, actions: local.actions }]);
    } finally {
      setPending(false);
    }
  }

  function startVoiceQuestion() {
    if (typeof window === "undefined" || pending) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTurns((current) => [...current, { role: "assistant", text: "This browser does not support speech-to-text. Try Chrome/Edge on Android, give microphone permission, or type the question instead." }]);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setTurns((current) => [...current, { role: "assistant", text: "I could not hear clearly. Please allow microphone permission and try again, or type the question." }]);
    };
    recognition.onresult = (event: FarmSpeechRecognitionEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (transcript) {
        setInput(transcript);
        void ask(transcript);
      }
    };
    recognition.start();
  }

  const guidedQuestions = suggestedQuestions();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="AI Farm Assistant">
        This is now the main help centre for the Farm OS. Ask what you want to do, and the assistant should either answer directly or send you to the exact page needed. You can click a suggested question, type your own question, or use the microphone to speak. If a plot, crop, material list or market price is missing, the assistant should tell you what to set up first and give you a page button.
      </PageIntro>

      <section className="dt-panel flex h-[calc(100dvh-11rem)] min-h-[480px] flex-col overflow-hidden p-2 sm:p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1.5 pt-1">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">AI assistant</p>
            <h2 className="text-base font-black leading-tight text-[#14213d]">Guided farm chat</h2>
          </div>
          <Pill tone={engine === "gemini" ? "green" : "navy"}>{engine === "gemini" ? "Gemini active" : engine === "rules" ? "built-in" : "ready"}</Pill>
        </div>
        <div className="flex-1 overflow-y-auto rounded-2xl bg-[#fbfaf5] p-3 sm:p-4" aria-live="polite">
          <div className="grid gap-3">
            {turns.map((turn, index) => (
              <div className={turn.role === "user" ? "justify-self-end" : "justify-self-start"} key={index}>
                <div
                  className={`max-w-[min(42rem,92vw)] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    turn.role === "user" ? "bg-[#193b28] font-bold text-white" : "border border-[#edf1e7] bg-white font-bold text-[#4b5a76]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  {turn.bullets?.length ? (
                    <ul className="mt-2 grid gap-1">
                      {turn.bullets.map((bullet, bulletIndex) => (
                        <li className={turn.role === "user" ? "" : "text-[#14213d]"} key={bulletIndex}>• {bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                  {turn.actions?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {turn.actions.map((action) => (
                        <GuidanceAction key={`${action.label}-${action.tab}`} label={action.label} onClick={() => setTab(action.tab)} />
                      ))}
                    </div>
                  ) : null}
                  {turn.operations?.length ? (
                    <div className="mt-3 grid gap-2">
                      {turn.operations.map((op, opIndex) => {
                        const key = `${index}:${opIndex}`;
                        const done = appliedOps[key];
                        const opMeta: Record<AiOperation["type"], { label: string; cta: string; title: string }> = {
                          create_task: { label: "AI will create a task", cta: "Add to Tasks", title: op.taskTitle || "New task" },
                          record_observation: { label: "AI will record an observation", cta: "Record it", title: `${labelize(op.observationType || "observation")} observation` },
                          create_planting_plan: { label: "AI will create a planting plan", cta: "Create plan", title: `${op.cropName || "Crop"}${op.variety ? ` · ${op.variety}` : ""}` },
                          add_worker: { label: "AI will add a worker", cta: "Add worker", title: op.workerName || "New worker" },
                          log_attendance: { label: "AI will log attendance", cta: "Log it", title: `${op.workerName || "Worker"} — ${labelize(op.attendanceStatus || "present")}` },
                          update_plot_status: { label: "AI will update a plot", cta: "Update plot", title: `${op.plotCode || "Plot"} → ${[op.landStatus ? labelize(op.landStatus) : null, op.irrigationStatus ? `irrigation ${labelize(op.irrigationStatus)}` : null].filter(Boolean).join(", ")}` },
                          edit_plan: { label: "AI will edit a plan", cta: "Update plan", title: `${op.cropName || "Plan"}${op.plotCode ? ` on ${op.plotCode}` : ""}: ${[op.planStatus ? `status ${labelize(op.planStatus)}` : null, op.expectedHarvestStartDate ? `harvest ${op.expectedHarvestStartDate}` : null, Number.isFinite(op.marketPrice) ? `price ${naira.format(Number(op.marketPrice))}` : null, op.appendNote ? "note" : null].filter(Boolean).join(", ") || "update"}` }
                        };
                        const info = opMeta[op.type] || opMeta.create_task;
                        const meta = [
                          op.plotCode ? `Plot ${op.plotCode}` : null,
                          op.type !== "create_planting_plan" && op.cropName ? op.cropName : null,
                          op.type === "create_task" && op.priority ? `${op.priority} priority` : null,
                          (op.type === "create_task" || op.type === "create_planting_plan") && Number.isFinite(op.dueInDays) ? `in ${op.dueInDays}d` : null,
                          op.type === "record_observation" && op.severity ? `${op.severity} severity` : null,
                          op.type === "create_planting_plan" && op.seedCount ? `${numberFormat.format(op.seedCount)} seeds` : null,
                          op.type === "create_planting_plan" && op.marketPrice ? `${naira.format(op.marketPrice)}/unit` : null,
                          op.type === "add_worker" && op.dailyRate ? `${naira.format(op.dailyRate)}/period` : null
                        ].filter(Boolean).join(" · ");
                        return (
                          <div className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-3" key={key}>
                            <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{info.label}</p>
                            <strong className="mt-1 block text-sm text-[#14213d]">{info.title}</strong>
                            {meta ? <p className="text-xs font-bold text-[#667085]">{meta}</p> : null}
                            {done ? (
                              <p className="mt-2 text-sm font-black text-[#0f8b6f]">✓ {done}</p>
                            ) : (
                              <button
                                className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#0f8b6f] px-3 text-xs font-black text-white"
                                onClick={() => {
                                  const note = applyAiOperation(op);
                                  setAppliedOps((current) => ({ ...current, [key]: note }));
                                }}
                                type="button"
                              >
                                <Plus size={14} /> {info.cta}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="justify-self-start">
                <div className="max-w-[34rem] rounded-2xl border border-[#edf1e7] bg-white px-4 py-3 text-sm font-bold text-[#667085]">
                  Thinking through your farm records…
                </div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
        </div>
        {turns.length <= 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 dt-scroll-x">
            {guidedQuestions.map((question) => (
              <button className="shrink-0 whitespace-nowrap rounded-full border border-[#d8dece] bg-white px-3 py-2 text-xs font-black text-[#4b5a76] disabled:opacity-50" disabled={pending} key={question} onClick={() => ask(question)} type="button">
                {question}
              </button>
            ))}
          </div>
        ) : null}
        <form
          ref={inputFormRef}
          className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            ask(input);
          }}
        >
          <input
            className={inputClass + " flex-1"}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask, e.g. What do I need before irrigating Acre B?"
            value={input}
          />
          <button className={`min-h-11 rounded-lg border px-4 text-sm font-black ${listening ? "border-[#fecdca] bg-[#fff4f2] text-[#b42318]" : "border-[#d8dece] bg-white text-[#14213d]"}`} disabled={pending} onClick={startVoiceQuestion} type="button">
            {listening ? <><MicOff className="inline" size={17} /> Listening</> : <><Mic className="inline" size={17} /> Speak</>}
          </button>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-5 text-sm font-black text-white disabled:opacity-50" disabled={pending} type="submit" aria-label="Send">
            <Send className="inline" size={18} /> Send
          </button>
        </form>
      </section>
    </div>
  );
}

function useDashboardTotals() {
  return {
    totalAcres: 0,
    irrigatedAcres: 0,
    readyPlots: 0,
    bushyPlots: 0,
    overdueTasks: 0,
    pendingTasks: 0,
    expectedRevenueTotal: 0,
    expectedProfitTotal: 0,
    inputTotal: 0,
    unpaidLabor: 0,
    salaryGross: 0,
    salaryNet: 0,
    salaryPaid: 0,
    salaryBalance: 0,
    attendanceDays: 0,
    irrigationSummary: calculateIrrigationSummary([], 1)
  };
}

const LAND_STATUS_VALUES = ["ready", "bushy", "needs_clearing", "recently_cleared", "needs_herbicide", "needs_manual_labor", "needs_ploughing", "needs_ridging", "needs_manure", "waterlogged", "too_dry", "under_cultivation", "fallow", "planted"];

function FarmMapView({ data, addPlot, updatePlotStatus, deleteRecord, openPlotInTab }: { data: FarmOsData; addPlot: (event: FormEvent<HTMLFormElement>) => void; updatePlotStatus: (plotId: string, patch: Partial<FarmPlot>) => void; deleteRecord: DeleteRecordFn; openPlotInTab: (tab: FarmOsTab, plotId: string) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [sizeTemplateIndex, setSizeTemplateIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const sizeTemplate = plotSizeTemplates[sizeTemplateIndex] || plotSizeTemplates[0];
  const totalAcres = data.plots.reduce((sum, plot) => sum + Number(plot.equivalentAcres || 0), 0);

  const openPlot = openId ? data.plots.find((plot) => plot.id === openId) : undefined;
  if (openPlot) {
    return (
      <PlotDetailView
        data={data}
        plot={openPlot}
        onBack={() => setOpenId(null)}
        onSave={(patch) => updatePlotStatus(openPlot.id, patch)}
        onQuick={(patch) => updatePlotStatus(openPlot.id, patch)}
        onDelete={() => {
          deleteRecord("plots", openPlot.id, `${openPlot.plotCode || openPlot.plotName} deleted.`);
          setOpenId(null);
        }}
        openPlotInTab={openPlotInTab}
      />
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {/* Toolbar: see your plots and add a new one */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Your plots</h2>
          <p className="text-sm font-bold text-[#667085]">{data.plots.length} plot(s) · {numberFormat.format(totalAcres)} acres</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAdd((s) => !s)} type="button">
          {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "Close" : "Add plot"}
        </button>
      </div>

      {showAdd ? (
        <form
          className="dt-panel grid gap-3 p-4"
          onSubmit={(event) => {
            addPlot(event);
            setShowAdd(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2" key={sizeTemplate.label}>
            <Field label="Plot name"><input className={inputClass} name="plotName" placeholder="e.g. Pepper Block" required /></Field>
            <Field label="Plot code"><input className={inputClass} name="plotCode" placeholder="e.g. Acre A" required /></Field>
            <Field label="Size preset">
              <select className={inputClass} onChange={(event) => setSizeTemplateIndex(Number(event.target.value))} value={sizeTemplateIndex}>
                {plotSizeTemplates.map((template, index) => <option key={template.label} value={index}>{template.label}</option>)}
              </select>
            </Field>
            <Field label="Irrigated?"><select className={inputClass} name="irrigated"><option value="no">No</option><option value="yes">Yes</option></select></Field>
            <Field label="Length"><input className={inputClass} defaultValue={sizeTemplate.length || ""} inputMode="decimal" name="length" placeholder="300" required /></Field>
            <Field label="Width"><input className={inputClass} defaultValue={sizeTemplate.width || ""} inputMode="decimal" name="width" placeholder="100" required /></Field>
            <Field label="Unit"><select className={inputClass} defaultValue={sizeTemplate.unit} name="sizeUnit"><option value="feet">Feet</option><option value="meters">Meters</option></select></Field>
            <Field label="Land status"><SelectOptions name="landStatus" values={LAND_STATUS_VALUES} /></Field>
          </div>
          <details className="rounded-lg border border-[#edf1e7] bg-[#fbfaf5] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#4b5a76]">More details (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Current crop"><CropNameInput data={data} name="currentCrop" placeholder="Select or type" /></Field>
              <Field label="Previous crop"><CropNameInput data={data} name="previousCrop" placeholder="Select or type" /></Field>
              <Field label="Rain-fed suitability"><SelectOptions name="rainFedSuitability" values={["good", "moderate", "poor", "unknown"]} /></Field>
              <Field label="Date last cleared"><input className={inputClass} name="dateLastCleared" type="date" /></Field>
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="Soil notes"><textarea className={textareaClass} name="soilNotes" placeholder="Drainage, soil type, manure, pH..." /></Field>
              <Field label="Access notes"><textarea className={textareaClass} name="accessNotes" placeholder="Road, path, water access..." /></Field>
            </div>
          </details>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save plot</button>
        </form>
      ) : null}

      {/* Records first: tap a plot to edit, delete, or quick-update status */}
      <div className="grid gap-3">
        {data.plots.length ? <ShowMoreList items={data.plots} initial={6} noun="plots" render={(plot) => {
          const activePlan = data.plantingPlans.find((p) => p.plotId === plot.id && p.status !== "completed" && p.status !== "cancelled");
          const displayCrop = (plot.currentCrop && plot.currentCrop !== "None") ? plot.currentCrop : activePlan?.cropName;
          return (
          <article className="dt-panel p-4" key={plot.id}>
            <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpenId(plot.id)} type="button">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase text-[#0f8b6f]">{plot.plotCode}</p>
                <h3 className="truncate text-lg font-black text-[#14213d]">{plot.plotName}</h3>
                <p className="mt-0.5 text-sm text-[#667085]">{plot.measuredSize} {plot.sizeUnit} · {numberFormat.format(plot.equivalentAcres || 0)} acres{displayCrop ? ` · ${displayCrop}` : ""}</p>
                <span className="mt-1 inline-block text-xs font-black text-[#0f8b6f]">Tap to open details →</span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Pill tone={statusTone(plot.landStatus)}>{labelize(plot.landStatus)}</Pill>
                <Pill tone={plot.irrigated ? "green" : "warning"}>{plot.irrigated ? "Irrigated" : "Rain-fed"}</Pill>
              </div>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#14213d]" onClick={() => setEditingId(editingId === plot.id ? null : plot.id)} type="button">
                <Pencil size={14} /> {editingId === plot.id ? "Close" : "Edit"}
              </button>
              {!plot.irrigated ? (
                <button className="min-h-9 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#4b5a76]" onClick={() => updatePlotStatus(plot.id, { irrigated: true, irrigationStatus: "active" })} type="button">Mark irrigated</button>
              ) : null}
              {plot.landStatus !== "ready" ? (
                <button className="min-h-9 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#4b5a76]" onClick={() => updatePlotStatus(plot.id, { landStatus: "ready" })} type="button">Mark ready</button>
              ) : null}
              <DeleteButton label="Delete" onDelete={() => deleteRecord("plots", plot.id, `${plot.plotCode || plot.plotName} deleted.`)} />
            </div>
            {editingId === plot.id ? (
              <PlotEditForm data={data} plot={plot} onCancel={() => setEditingId(null)} onSave={(patch) => { updatePlotStatus(plot.id, patch); setEditingId(null); }} />
            ) : null}
          </article>
        );}} /> : <EmptyState text={'No plots yet. Tap “Add plot” to register your first acre or bed.'} />}
      </div>
    </div>
  );
}

function PlotDetailView({
  data,
  plot,
  onBack,
  onSave,
  onQuick,
  onDelete,
  openPlotInTab
}: {
  data: FarmOsData;
  plot: FarmPlot;
  onBack: () => void;
  onSave: (patch: Partial<FarmPlot>) => void;
  onQuick: (patch: Partial<FarmPlot>) => void;
  onDelete: () => void;
  openPlotInTab: (tab: FarmOsTab, plotId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const plans = data.plantingPlans.filter((p) => p.plotId === plot.id);
  const activePlans = plans.filter((p) => p.status !== "completed" && p.status !== "cancelled");
  const latestActivePlan = activePlans[0];
  const tasks = data.tasks.filter((t) => t.plotId === plot.id);
  const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const inputs = data.inputCosts.filter((i) => i.plotId === plot.id);
  const inputTotal = inputs.reduce((sum, i) => sum + Number(i.totalCost || 0), 0);
  const observations = data.observations.filter((o) => o.plotId === plot.id);
  const irrigationPlans = data.irrigationPlans.filter((ip) => ip.plotId === plot.id);
  const clearingPlans = data.clearingPlans.filter((cp) => cp.plotId === plot.id);
  const regrowth = calculateRegrowth(plot);

  const actions: { label: string; tab: FarmOsTab; icon: IconType }[] = [
    { label: "Plan a crop here", tab: "planting-planner", icon: Sprout },
    { label: plot.irrigated ? "Manage irrigation" : "Set up irrigation", tab: "irrigation", icon: Droplets },
    { label: "Plan land clearing", tab: "land-clearing", icon: Tractor },
    { label: "Add a task", tab: "tasks", icon: ClipboardList },
    { label: "Log an observation", tab: "observations", icon: AlertTriangle },
    { label: "Manage inventory", tab: "inputs", icon: Package },
    { label: "Sales & accounts", tab: "accounts", icon: Coins }
  ];

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <button className="inline-flex items-center gap-1 self-start text-sm font-black text-[#0f8b6f]" onClick={onBack} type="button">← All plots</button>

      <section className="dt-panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-[#0f8b6f]">{plot.plotCode}</p>
            <h2 className="text-2xl font-black text-[#14213d]">{plot.plotName}</h2>
            <p className="mt-1 text-sm text-[#667085]">{plot.measuredSize} {plot.sizeUnit} · {numberFormat.format(plot.equivalentAcres || 0)} acres · {numberFormat.format(plot.calculatedArea || 0)} sq {plot.sizeUnit}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Pill tone={statusTone(plot.landStatus)}>{labelize(plot.landStatus)}</Pill>
            <Pill tone={plot.irrigated ? "green" : "warning"}>{plot.irrigated ? "Irrigated" : "Rain-fed"}</Pill>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Irrigation" value={`${plot.irrigated ? "Yes" : "No"} · ${labelize(plot.irrigationStatus)}`} />
          <Info label="Current crop" value={(plot.currentCrop && plot.currentCrop !== "None") ? plot.currentCrop : (latestActivePlan?.cropName ?? "None")} />
          <Info label="Previous crop" value={plot.previousCrop || "None"} />
          <Info label="Rain-fed suitability" value={labelize(plot.rainFedSuitability)} />
          {plot.dateLastCleared ? <Info label="Last cleared" value={plot.dateLastCleared} /> : null}
          {plot.dateLastPlanted ? <Info label="Last planted" value={plot.dateLastPlanted} /> : null}
        </div>
        {plot.soilNotes ? <p className="mt-3 rounded-lg bg-[#fbfaf5] p-3 text-sm font-bold leading-6 text-[#4b5a76]">Soil: {plot.soilNotes}</p> : null}
        <p className="mt-2 rounded-lg bg-[#fbfaf5] p-3 text-sm font-bold leading-6 text-[#4b5a76]">{regrowth.recommendation}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#14213d]" onClick={() => setEditing((e) => !e)} type="button"><Pencil size={14} /> {editing ? "Close edit" : "Edit plot"}</button>
          {plot.landStatus !== "ready" ? <button className="min-h-10 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#4b5a76]" onClick={() => onQuick({ landStatus: "ready" })} type="button">Mark ready</button> : null}
          {!plot.irrigated ? <button className="min-h-10 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#4b5a76]" onClick={() => onQuick({ irrigated: true, irrigationStatus: "active" })} type="button">Mark irrigated</button> : null}
          <DeleteButton label="Delete plot" onDelete={onDelete} />
        </div>
        {editing ? <PlotEditForm data={data} plot={plot} onCancel={() => setEditing(false)} onSave={(patch) => { onSave(patch); setEditing(false); }} /> : null}
      </section>

      {/* Active crop banner */}
      {latestActivePlan ? (
        <section className="dt-panel border-l-4 border-l-[#0f8b6f] p-5">
          <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{latestActivePlan.status === "active" ? "Currently growing" : latestActivePlan.status === "draft" ? "Planned (draft)" : labelize(latestActivePlan.status)}</p>
          <h3 className="mt-1 text-xl font-black text-[#14213d]">{latestActivePlan.cropName}{latestActivePlan.variety ? ` — ${latestActivePlan.variety}` : ""}</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm font-bold text-[#4b5a76]">
            {latestActivePlan.plannedPlantingDate ? <span>Planted: {latestActivePlan.plannedPlantingDate}</span> : null}
            {latestActivePlan.expectedHarvestStartDate ? <span>Harvest from: {latestActivePlan.expectedHarvestStartDate}</span> : null}
            {latestActivePlan.expectedHarvestEndDate ? <span>Harvest to: {latestActivePlan.expectedHarvestEndDate}</span> : null}
          </div>
          {activePlans.length > 1 ? <p className="mt-2 text-xs text-[#667085]">+{activePlans.length - 1} more active plan(s) on this plot.</p> : null}
        </section>
      ) : null}

      {/* What is on this plot */}
      <section className="dt-panel p-5">
        <SectionHeader eyebrow="On this plot" title="Everything linked here" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PlotStat icon={Sprout} label="Planting plans" value={plans.length} hint={activePlans.length ? `${activePlans.length} active · ${plans.map((p) => p.cropName).join(", ")}` : (plans.map((p) => p.cropName).join(", ") || "None yet")} />
          <PlotStat icon={ClipboardList} label="Open tasks" value={openTasks.length} hint={`${tasks.length} total on this plot`} />
          <PlotStat icon={Package} label="Input cost" value={naira.format(inputTotal)} hint={`${inputs.length} input record(s)`} />
          <PlotStat icon={AlertTriangle} label="Observations" value={observations.length} hint={observations[0] ? labelize(observations[0].observationType) : "None logged"} />
          <PlotStat icon={Droplets} label="Irrigation plans" value={irrigationPlans.length} hint={irrigationPlans[0] ? labelize(irrigationPlans[0].status) : "None yet"} />
          <PlotStat icon={Tractor} label="Clearing plans" value={clearingPlans.length} hint={clearingPlans[0] ? labelize(clearingPlans[0].status) : "None yet"} />
        </div>
        {openTasks.length ? (
          <ul className="mt-4 grid gap-1 text-sm font-bold text-[#4b5a76]">
            {openTasks.slice(0, 5).map((task) => <li key={task.id}>• {task.taskTitle} <span className="text-[#667085]">({task.dueDate})</span></li>)}
          </ul>
        ) : null}
      </section>

      {/* Actions that jump to the right tab, focused on this plot */}
      <section className="dt-panel p-5">
        <SectionHeader eyebrow="Do something" title="Act on this plot" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                className="flex min-h-12 items-center gap-3 rounded-xl border border-[#cdeee2] bg-[#f1fbf7] px-4 text-left text-sm font-black text-[#0a715b]"
                key={action.label}
                onClick={() => openPlotInTab(action.tab, plot.id)}
                type="button"
              >
                <ActionIcon size={18} /> {action.label} <span className="ml-auto">→</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs font-bold text-[#667085]">These open the right screen with {plot.plotCode} already selected.</p>
      </section>
    </div>
  );
}

function PlotStat({ icon: Icon, label, value, hint }: { icon: IconType; label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="rounded-xl border border-[#edf1e7] bg-white p-3">
      <div className="flex items-center gap-2 text-[#0f8b6f]"><Icon size={16} /><p className="text-xs font-black uppercase text-[#667085]">{label}</p></div>
      <strong className="mt-1 block text-lg text-[#14213d]">{value}</strong>
      <small className="block leading-4 text-[#667085]">{hint}</small>
    </div>
  );
}

function PlotEditForm({ data, plot, onSave, onCancel }: { data: FarmOsData; plot: FarmPlot; onSave: (patch: Partial<FarmPlot>) => void; onCancel: () => void }) {
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const length = numberValue(formData, "length") || 0;
    const width = numberValue(formData, "width") || 0;
    const sizeUnit = stringValue(formData, "sizeUnit", plot.sizeUnit) as FarmPlot["sizeUnit"];
    const area = calculatePlotArea({ length, width, sizeUnit });
    onSave({
      plotName: stringValue(formData, "plotName", plot.plotName),
      plotCode: stringValue(formData, "plotCode", plot.plotCode),
      length,
      width,
      sizeUnit,
      measuredSize: `${length} x ${width}`,
      calculatedArea: area.calculatedArea,
      equivalentAcres: area.equivalentAcres,
      irrigated: stringValue(formData, "irrigated", plot.irrigated ? "yes" : "no") === "yes",
      irrigationStatus: stringValue(formData, "irrigationStatus", plot.irrigationStatus) as FarmPlot["irrigationStatus"],
      landStatus: stringValue(formData, "landStatus", plot.landStatus) as FarmPlot["landStatus"],
      currentCrop: stringValue(formData, "currentCrop", plot.currentCrop || ""),
      previousCrop: stringValue(formData, "previousCrop", plot.previousCrop || ""),
      rainFedSuitability: stringValue(formData, "rainFedSuitability", plot.rainFedSuitability) as FarmPlot["rainFedSuitability"],
      soilNotes: stringValue(formData, "soilNotes", plot.soilNotes || ""),
      accessNotes: stringValue(formData, "accessNotes", plot.accessNotes || "")
    });
  }
  return (
    <form className="mt-3 grid gap-3 border-t border-[#edf1e7] pt-3" onSubmit={handleSave}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plot name"><input className={inputClass} defaultValue={plot.plotName} name="plotName" required /></Field>
        <Field label="Plot code"><input className={inputClass} defaultValue={plot.plotCode} name="plotCode" required /></Field>
        <Field label="Length"><input className={inputClass} defaultValue={plot.length || ""} inputMode="decimal" name="length" /></Field>
        <Field label="Width"><input className={inputClass} defaultValue={plot.width || ""} inputMode="decimal" name="width" /></Field>
        <Field label="Unit"><select className={inputClass} defaultValue={plot.sizeUnit} name="sizeUnit"><option value="feet">Feet</option><option value="meters">Meters</option></select></Field>
        <Field label="Irrigated?"><select className={inputClass} defaultValue={plot.irrigated ? "yes" : "no"} name="irrigated"><option value="no">No</option><option value="yes">Yes</option></select></Field>
        <Field label="Irrigation status"><SelectOptions name="irrigationStatus" values={["none", "planned", "partial", "active", "needs_repair", "not_required"]} defaultValue={plot.irrigationStatus} /></Field>
        <Field label="Land status"><SelectOptions name="landStatus" values={LAND_STATUS_VALUES} defaultValue={plot.landStatus} /></Field>
        <Field label="Current crop"><CropNameInput data={data} name="currentCrop" defaultValue={plot.currentCrop || ""} /></Field>
        <Field label="Previous crop"><CropNameInput data={data} name="previousCrop" defaultValue={plot.previousCrop || ""} /></Field>
        <Field label="Rain-fed suitability"><SelectOptions name="rainFedSuitability" values={["good", "moderate", "poor", "unknown"]} defaultValue={plot.rainFedSuitability} /></Field>
      </div>
      <Field label="Soil notes"><textarea className={textareaClass} defaultValue={plot.soilNotes || ""} name="soilNotes" /></Field>
      <Field label="Access notes"><textarea className={textareaClass} defaultValue={plot.accessNotes || ""} name="accessNotes" /></Field>
      <div className="flex gap-2">
        <button className="min-h-11 flex-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Save changes</button>
        <button className="min-h-11 rounded-lg border border-[#d8dece] bg-white px-4 text-sm font-black text-[#4b5a76]" onClick={onCancel} type="button">Cancel</button>
      </div>
    </form>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#edf1e7] bg-white p-3">
      <p className="text-xs font-black uppercase text-[#667085]">{label}</p>
      <strong className="mt-1 block text-[#14213d]">{value}</strong>
    </div>
  );
}

function SelectOptions({ name, values, defaultValue }: { name: string; values: string[]; defaultValue?: string }) {
  return (
    <select className={inputClass} defaultValue={defaultValue || values[0]} name={name}>
      {values.map((value) => <option key={value} value={value}>{labelize(value)}</option>)}
    </select>
  );
}

function DataListInput({ name, options, placeholder, required = false, defaultValue = "" }: { name: string; options: string[]; placeholder?: string; required?: boolean; defaultValue?: string }) {
  const listId = `${name}-options`;
  return (
    <>
      <input className={inputClass} defaultValue={defaultValue} list={listId} name={name} placeholder={placeholder} required={required} />
      <datalist id={listId}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </>
  );
}

function CropNameInput({ data, name, placeholder, required = false, defaultValue = "" }: { data: FarmOsData; name: string; placeholder?: string; required?: boolean; defaultValue?: string }) {
  return <DataListInput defaultValue={defaultValue} name={name} options={cropNames(data)} placeholder={placeholder || "Select or type crop"} required={required} />;
}

function GuidanceAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdeee2] bg-[#f1fbf7] px-3 text-sm font-black text-[#0a715b]" onClick={onClick} type="button">
      {label}<ArrowRight size={16} />
    </button>
  );
}

function IrrigationView({ data, addMaterial, addPlan, deleteRecord, focusPlotId }: { data: FarmOsData; addMaterial: (event: FormEvent<HTMLFormElement>) => void; addPlan: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string }) {
  const [templateId, setTemplateId] = useState("custom");
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const selectedTemplate = irrigationMaterialTemplates.find((item) => item.id === templateId) || irrigationMaterialTemplates[0];
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      {/* Lead with the practical question: what does it cost to irrigate a plot? */}
      <IrrigationPlanBuilder data={data} focusPlotId={focusPlotId} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Irrigation materials</h2>
          <p className="text-sm font-bold text-[#667085]">{data.irrigationMaterials.length} item(s) — your price list for the costing above</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAddMaterial((s) => !s)} type="button">
          {showAddMaterial ? <X size={16} /> : <Plus size={16} />} {showAddMaterial ? "Close" : "Add material"}
        </button>
      </div>

      <section className="grid gap-4">
        {showAddMaterial ? (
        <form className="dt-panel grid gap-3 p-4" onSubmit={(event) => { addMaterial(event); setShowAddMaterial(false); }}>
          <Field label="Start from prepared list (or Custom)">
            <select className={inputClass} onChange={(event) => setTemplateId(event.target.value)} value={templateId}>
              {irrigationMaterialTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.itemName || "Custom item"}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2" key={selectedTemplate.id}>
            <Field label="Item name"><input className={inputClass} defaultValue={selectedTemplate.itemName || ""} name="itemName" placeholder="Main line pipe" required /></Field>
            <Field label="Category"><SelectOptions name="category" values={["water_source", "pump", "pipes", "main_lines", "sub_main_lines", "drip_lines", "sprinklers", "connectors", "valves", "filters", "water_tank", "borehole_well_setup", "solar_inverter_electric_power", "fuel_setup", "hoses", "pressure_regulators", "end_caps", "tapes_fittings", "storage", "transport", "installation_labor", "maintenance", "repairs", "miscellaneous"]} defaultValue={selectedTemplate.category || "miscellaneous"} /></Field>
            <Field label="Quantity"><input className={inputClass} defaultValue={Number(selectedTemplate.quantity || 1)} inputMode="decimal" name="quantity" placeholder="1" required /></Field>
            <Field label="Unit"><input className={inputClass} defaultValue={selectedTemplate.unit || "unit"} name="unit" placeholder="roll / unit / worker-days" required /></Field>
            <Field label="Unit cost"><input className={inputClass} defaultValue={Number(selectedTemplate.unitCost || 0)} inputMode="decimal" name="unitCost" placeholder="45000" required /></Field>
            <Field label="Required for acres"><input className={inputClass} defaultValue={Number(selectedTemplate.requiredForAcres || 1)} inputMode="decimal" name="requiredForAcres" placeholder="0.75" /></Field>
            <Field label="Reusable"><select className={inputClass} defaultValue={selectedTemplate.reusable ? "yes" : "no"} name="reusable"><option value="yes">Yes</option><option value="no">No</option></select></Field>
            <Field label="Supplier"><DataListInput name="supplier" options={commonSupplierOptions} placeholder="Supplier / market" /></Field>
            <Field label="Lifespan"><input className={inputClass} name="lifespan" placeholder="2 seasons / 5 years" /></Field>
          </div>
          <Field label="Specification"><input className={inputClass} defaultValue={selectedTemplate.specification || ""} name="specification" placeholder="Pipe diameter, pump size, tank litres..." /></Field>
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="Lifespan, reusable notes, replacement risk..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save material</button>
        </form>
        ) : null}

        <div className="dt-panel p-5">
          <SectionHeader eyebrow="Material list" title="Your irrigation price list" />
          <div className="mt-4 max-w-full overflow-x-auto dt-scroll-x">
            {data.irrigationMaterials.length ? (
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs uppercase text-[#667085]"><tr><th className="py-3">Item</th><th>Category</th><th>Qty</th><th>Unit cost</th><th>Total</th><th>Reusable</th><th>Action</th></tr></thead>
                <tbody className="divide-y divide-[#edf1e7]">
                  {data.irrigationMaterials.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 font-black">{item.itemName}<small className="block font-bold text-[#667085]">{item.specification}</small></td>
                      <td>{labelize(item.category)}</td>
                      <td>{item.quantity} {item.unit}</td>
                      <td>{naira.format(item.unitCost)}</td>
                      <td className="font-black">{naira.format(item.quantity * item.unitCost)}</td>
                      <td><Pill tone={item.reusable ? "green" : "warning"}>{item.reusable ? "Reusable" : "Consumable"}</Pill></td>
                      <td><DeleteButton label="Delete" onDelete={() => deleteRecord("irrigationMaterials", item.id, `${item.itemName} deleted from irrigation materials.`)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState text="No irrigation materials yet. Add your pump, tank, hose, drip lines, fittings, labour and transport costs from scratch." />}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Irrigation plans</h2>
          <p className="text-sm font-bold text-[#667085]">{data.irrigationPlans.length} saved plan(s) per plot</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAddPlan((s) => !s)} type="button">
          {showAddPlan ? <X size={16} /> : <Plus size={16} />} {showAddPlan ? "Close" : "Create plan"}
        </button>
      </div>

      <section className="grid gap-4">
        {showAddPlan ? (
        <form className="dt-panel grid gap-3 p-4" onSubmit={(event) => { addPlan(event); setShowAddPlan(false); }}>
          <p className="text-sm font-bold leading-6 text-[#4b5a76]">Choose the plot, then tick the exact materials for that acre. Leave expected cost blank to auto-calculate from the selected materials.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Irrigation method"><SelectOptions name="irrigationMethod" values={["drip", "sprinkler", "rain_gun", "manual", "furrow", "mixed"]} /></Field>
            <Field label="Water source"><DataListInput name="waterSource" options={waterSourceOptions} placeholder="Well + tank + pump" /></Field>
            <Field label="Setup time"><input className={inputClass} name="estimatedSetupTime" placeholder="2 days" /></Field>
            <Field label="Expected cost"><input className={inputClass} inputMode="decimal" name="expectedCost" placeholder="Auto if blank" /></Field>
            <Field label="Maintenance estimate"><input className={inputClass} inputMode="decimal" name="expectedMaintenanceCost" placeholder="Auto if blank" /></Field>
          </div>
          <div className="grid gap-2 rounded-xl border border-[#d8dece] bg-[#fbfaf5] p-4">
            <p className="text-sm font-black text-[#14213d]">Select materials for this plot</p>
            {data.irrigationMaterials.length ? data.irrigationMaterials.map((material) => (
              <label className="flex items-start gap-3 rounded-lg bg-white p-3 text-sm font-bold text-[#4b5a76]" key={material.id}>
                <input className="mt-1" name="materialIds" type="checkbox" value={material.id} />
                <span>{material.itemName} — {material.quantity} {material.unit} × {naira.format(material.unitCost)} <small className="block text-[#667085]">{labelize(material.category)} · {material.reusable ? "Reusable" : "Consumable"}</small></span>
              </label>
            )) : <EmptyState text="Add irrigation materials first, then come back here to select the rows needed for this acre." />}
          </div>
          <Field label="Labour needed"><input className={inputClass} name="laborNeeded" placeholder="3 worker-days" /></Field>
          <Field label="Expected benefit"><textarea className={textareaClass} name="expectedBenefit" placeholder="Reduce transplant risk, dry season watering, improve yield..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save plan</button>
        </form>
        ) : null}

        <div className="grid gap-3">
          {data.irrigationPlans.length ? <ShowMoreList items={data.irrigationPlans} initial={5} noun="plans" render={(plan) => {
            const planMaterials = data.irrigationMaterials.filter((item) => plan.materialsNeeded.includes(item.id) || plan.materialsNeeded.includes(item.itemName));
            return (
              <article className="dt-panel p-5" key={plan.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div><p className="text-xs font-black uppercase text-[#0f8b6f]">{labelize(plan.irrigationMethod)}</p><h3 className="text-xl font-black">{getPlotName(data, plan.plotId)}</h3></div>
                  <div className="flex flex-wrap gap-2"><Pill tone={statusTone(plan.status)}>{labelize(plan.status)}</Pill><DeleteButton label="Delete plan" onDelete={() => deleteRecord("irrigationPlans", plan.id, `Irrigation plan for ${getPlotName(data, plan.plotId)} deleted.`)} /></div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info label="Expected cost" value={naira.format(Number(plan.expectedCost || 0))} />
                  <Info label="Maintenance" value={naira.format(Number(plan.expectedMaintenanceCost || 0))} />
                  <Info label="Setup time" value={plan.estimatedSetupTime || "Not set"} />
                </div>
                <p className="mt-4 text-sm leading-6 text-[#4b5a76]">{plan.expectedBenefit || "No benefit note yet."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {planMaterials.length ? planMaterials.map((item) => <span key={item.id}><Pill>{item.itemName}</Pill></span>) : plan.materialsNeeded.map((item) => <span key={item}><Pill>{item}</Pill></span>)}
                </div>
              </article>
            );
          }} /> : <EmptyState text="No irrigation plans yet. Create one after adding a plot and the materials needed for that plot." />}
        </div>
      </section>
    </div>
  );
}

function IrrigationPlanBuilder({ data, focusPlotId }: { data: FarmOsData; focusPlotId?: string }) {
  const [plotId, setPlotId] = useState(focusPlotId || data.plots.find((plot) => !plot.irrigated)?.id || data.plots[0]?.id || "");
  const plot = data.plots.find((item) => item.id === plotId);
  const acres = Number(plot?.equivalentAcres || 0);
  const build = buildIrrigationPlanForAcres(data.irrigationMaterials, acres || 1);

  return (
    <section className="dt-panel p-5">
      <SectionHeader eyebrow="Plan builder" title="Cost to irrigate a plot">
        <span className="text-sm font-bold text-[#667085]">Scales the material list to the plot size</span>
      </SectionHeader>
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="grid gap-3">
          <Field label="Choose a plot">
            <select className={inputClass} onChange={(event) => setPlotId(event.target.value)} value={plotId}>
              {data.plots.map((item) => (
                <option key={item.id} value={item.id}>{item.plotCode} — {item.plotName}{item.irrigated ? " (irrigated)" : ""}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Info label="Plot size" value={`${acres.toFixed(2)} acres`} />
            <Info label="Cost per acre" value={naira.format(build.costPerAcre)} />
            <Info label="Reusable" value={naira.format(build.reusable)} />
            <Info label="Consumable" value={naira.format(build.consumable)} />
            <Info label="Labour" value={naira.format(build.labor)} />
            <Info label="Maintenance est." value={naira.format(build.maintenanceEstimate)} />
          </div>
          <div className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4">
            <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">Total setup budget</p>
            <strong className="mt-1 block text-2xl font-black text-[#14213d]">{naira.format(build.total)}</strong>
          </div>
        </div>
        <div className="max-w-full overflow-x-auto dt-scroll-x">
          <p className="text-sm font-black text-[#14213d]">Materials checklist</p>
          <table className="mt-2 w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-[#667085]"><tr><th className="py-2">Item</th><th>Qty</th><th>Unit cost</th><th>Line cost</th></tr></thead>
            <tbody className="divide-y divide-[#edf1e7]">
              {build.lines.map((line) => (
                <tr key={line.itemName}>
                  <td className="py-2 font-bold">{line.itemName} <small className="text-[#667085]">{labelize(line.category)}</small></td>
                  <td>{line.scaledQuantity} {line.unit}</td>
                  <td>{naira.format(line.unitCost)}</td>
                  <td className="font-black">{naira.format(line.lineCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ClearingMethodComparison({ data, focusPlotId }: { data: FarmOsData; focusPlotId?: string }) {
  const needsWork = data.plots.find((plot) =>
    ["bushy", "needs_clearing", "needs_ridging", "needs_ploughing", "needs_manual_labor", "needs_herbicide", "waterlogged"].includes(plot.landStatus)
  );
  const [plotId, setPlotId] = useState(focusPlotId || needsWork?.id || data.plots[0]?.id || "");
  const plot = data.plots.find((item) => item.id === plotId);
  const acres = Number(plot?.equivalentAcres || 0);
  const options = compareClearingMethods(acres || 1);
  const cheapest = options[0];

  return (
    <section className="dt-panel p-5">
      <SectionHeader eyebrow="Clearing planner" title="Compare clearing methods">
        <span className="text-sm font-bold text-[#667085]">Cost/time scaled by plot size</span>
      </SectionHeader>
      <div className="mt-4 grid gap-3 sm:max-w-sm">
        <Field label="Choose a plot">
          <select className={inputClass} onChange={(event) => setPlotId(event.target.value)} value={plotId}>
            {data.plots.map((item) => (
              <option key={item.id} value={item.id}>{item.plotCode} — {labelize(item.landStatus)}</option>
            ))}
          </select>
        </Field>
        <Info label="Plot size" value={`${acres.toFixed(2)} acres`} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        {options.map((option) => (
          <article className={`rounded-xl border p-4 ${option.method === cheapest.method ? "border-[#cdeee2] bg-[#f1fbf7]" : "border-[#edf1e7] bg-white"}`} key={option.method}>
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm text-[#14213d]">{option.method}</strong>
              {option.method === cheapest.method ? <Pill tone="green">Cheapest</Pill> : null}
            </div>
            <strong className="mt-2 block text-xl font-black text-[#14213d]">{naira.format(option.estimatedCost)}</strong>
            <p className="mt-1 text-xs font-bold text-[#667085]">{option.estimatedTime}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-[#4b5a76]">{option.approach}</p>
            <p className="mt-2 text-xs font-bold leading-5 text-[#b42318]">{option.safetyNotes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LandClearingView({ data, addClearingPlan, updatePlotStatus, deleteRecord, focusPlotId }: { data: FarmOsData; addClearingPlan: (event: FormEvent<HTMLFormElement>) => void; updatePlotStatus: (plotId: string, patch: Partial<FarmPlot>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <ClearingMethodComparison data={data} focusPlotId={focusPlotId} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Clearing plans</h2>
          <p className="text-sm font-bold text-[#667085]">{data.clearingPlans.length} plan(s) · {data.plots.filter((p) => p.landStatus === "bushy" || p.landStatus === "needs_clearing").length} plot(s) need work</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAdd((s) => !s)} type="button">
          {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "Close" : "Add plan"}
        </button>
      </div>

      {showAdd ? (
        <form className="dt-panel grid gap-3 p-4" onSubmit={(event) => { addClearingPlan(event); setShowAdd(false); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Current condition"><SelectOptions name="currentCondition" values={["bushy", "needs_clearing", "needs_ridging", "needs_ploughing", "needs_herbicide", "needs_manual_labor", "needs_manure", "waterlogged", "too_dry", "ready"]} defaultValue="needs_clearing" /></Field>
            <Field label="Method"><SelectOptions name="recommendedMethod" values={["manual_labor", "herbicide", "mechanical_clearing", "slashing", "ploughing", "ridging", "combined_method"]} defaultValue="combined_method" /></Field>
            <Field label="Estimated cost (₦)"><input className={inputClass} inputMode="decimal" name="estimatedCost" placeholder="86000" /></Field>
            <Field label="Estimated time"><input className={inputClass} name="estimatedTime" placeholder="2-3 days" /></Field>
            <Field label="Date planned"><input className={inputClass} name="datePlanned" type="date" /></Field>
          </div>
          <details className="rounded-lg border border-[#edf1e7] bg-[#fbfaf5] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#4b5a76]">More details (optional)</summary>
            <div className="mt-3 grid gap-3">
              <Field label="Labour required"><input className={inputClass} name="laborRequired" placeholder="4 labourers for 2 days" /></Field>
              <Field label="Chemical required"><input className={inputClass} name="chemicalRequired" placeholder="Herbicide if needed" /></Field>
              <Field label="Equipment required"><input className={inputClass} name="equipmentRequired" placeholder="Cutlasses, PPE, sprayer" /></Field>
              <Field label="Safety notes"><textarea className={textareaClass} name="safetyNotes" placeholder="Burning only if allowed/safe. PPE for herbicide." /></Field>
            </div>
          </details>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save clearing plan</button>
        </form>
      ) : null}

      <section className="grid gap-3">
        <div className="grid gap-3">
          {data.clearingPlans.length ? <ShowMoreList items={data.clearingPlans} initial={5} noun="plans" render={(plan) => (
            <article className="dt-panel p-5" key={plan.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><p className="text-xs font-black uppercase text-[#0f8b6f]">{getPlotName(data, plan.plotId)}</p><h3 className="text-xl font-black">{labelize(plan.recommendedMethod)}</h3></div>
                <div className="flex flex-wrap gap-2"><Pill tone={statusTone(plan.status)}>{labelize(plan.status)}</Pill><DeleteButton label="Delete plan" onDelete={() => deleteRecord("clearingPlans", plan.id, "Clearing plan deleted.")} /></div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Info label="Cost" value={naira.format(Number(plan.estimatedCost || 0))} />
                <Info label="Time" value={plan.estimatedTime || "Not set"} />
                <Info label="Condition" value={labelize(plan.currentCondition)} />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4b5a76]">{plan.safetyNotes || "No safety note yet."}</p>
            </article>
          )} /> : <EmptyState text="No clearing plans yet. Add one when a plot is bushy, needs ridging, needs herbicide or needs manual labour." />}

          <div className="dt-panel p-5">
            <SectionHeader eyebrow="Regrowth logic" title="Rain / bush regrowth assessment" />
            <div className="mt-4 grid gap-3">
              {data.plots.map((plot) => {
                const regrowth = calculateRegrowth(plot);
                return (
                  <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={plot.id}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div><strong>{plot.plotCode} - {plot.plotName}</strong><p className="text-sm text-[#667085]">Last cleared: {plot.dateLastCleared || "Not set"}</p></div>
                      <Pill tone={statusTone(regrowth.expectedBushRegrowth)}>{regrowth.expectedBushRegrowth} regrowth</Pill>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-6 text-[#4b5a76]">{regrowth.recommendation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => updatePlotStatus(plot.id, { landStatus: "needs_clearing" })} type="button">Flag clearing</button>
                      <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => updatePlotStatus(plot.id, { dateLastInspected: "2026-06-17" })} type="button">Mark inspected today</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CropCatalogView({ data, addCropProfile, deleteRecord }: { data: FarmOsData; addCropProfile: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn }) {
  const [showAdd, setShowAdd] = useState(false);
  const [templateId, setTemplateId] = useState(cropProfileTemplates[0].id);
  const selectedTemplate = cropProfileTemplates.find((template) => template.id === templateId) || cropProfileTemplates[0];
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Your crops</h2>
          <p className="text-sm font-bold text-[#667085]">{data.cropProfiles.length} crop(s) you can plan, plant and price</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAdd((s) => !s)} type="button">
          {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "Close" : "Add crop"}
        </button>
      </div>

      {showAdd ? (
        <form className="dt-panel grid gap-3 p-4" key={selectedTemplate.id} onSubmit={(event) => { addCropProfile(event); setShowAdd(false); }}>
          <Field label="Start from a common crop (you can edit everything)">
            <select className={inputClass} onChange={(event) => setTemplateId(event.target.value)} value={templateId}>
              {cropProfileTemplates.map((template) => <option key={template.id} value={template.id}>{cropTemplateName(template)}</option>)}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Crop name"><input className={inputClass} defaultValue={selectedTemplate.cropName || ""} name="cropName" placeholder="e.g. Tomato" required /></Field>
            <Field label="Water need"><SelectOptions name="waterNeed" values={["low", "medium", "high"]} defaultValue={selectedTemplate.waterNeed || "medium"} /></Field>
            <Field label="Nursery required"><select className={inputClass} defaultValue={selectedTemplate.nurseryRequired ? "yes" : "no"} name="nurseryRequired"><option value="yes">Yes</option><option value="no">No</option></select></Field>
            <Field label="Nursery days"><input className={inputClass} defaultValue={selectedTemplate.nurseryDurationDays || ""} inputMode="numeric" name="nurseryDurationDays" placeholder="42" /></Field>
            <Field label="Days to harvest"><input className={inputClass} defaultValue={selectedTemplate.expectedDurationToHarvestDays || ""} inputMode="numeric" name="expectedDurationToHarvestDays" placeholder="80" /></Field>
            <Field label="Yield per acre"><input className={inputClass} defaultValue={selectedTemplate.expectedYieldPerAcre || ""} inputMode="decimal" name="expectedYieldPerAcre" placeholder="4500" /></Field>
            <Field label="Yield per plant/seed"><input className={inputClass} defaultValue={selectedTemplate.expectedYieldPerPlant || ""} inputMode="decimal" name="expectedYieldPerPlant" placeholder="1.2" /></Field>
          </div>
          <details className="rounded-lg border border-[#edf1e7] bg-[#fbfaf5] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#4b5a76]">More details (optional)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Planting method"><SelectOptions name="plantingMethod" values={["nursery", "direct", "suckers", "mixed"]} defaultValue={selectedTemplate.plantingMethod || "nursery"} /></Field>
              <Field label="Direct planting allowed"><select className={inputClass} defaultValue={selectedTemplate.directPlantingAllowed ? "yes" : "no"} name="directPlantingAllowed"><option value="no">No</option><option value="yes">Yes</option></select></Field>
              <Field label="Irrigation recommended"><select className={inputClass} defaultValue={selectedTemplate.irrigationRecommended ? "yes" : "no"} name="irrigationRecommended"><option value="yes">Yes</option><option value="no">No</option></select></Field>
              <Field label="Market unit"><SelectOptions name="marketUnit" values={marketUnits} defaultValue={selectedTemplate.marketUnit || "kg"} /></Field>
            </div>
            <div className="mt-3 grid gap-3">
              <Field label="Harvest window"><input className={inputClass} defaultValue={selectedTemplate.harvestWindow || ""} name="harvestWindow" placeholder="8-12 weeks after transplant" /></Field>
              <Field label="Variety examples"><input className={inputClass} defaultValue={selectedTemplate.varietyExamples.join(", ")} name="notes" placeholder="African Giant, Cobra F1..." /></Field>
              <Field label="Fertilizer stages"><input className={inputClass} defaultValue={selectedTemplate.commonFertilizerStages?.join(", ") || ""} name="commonFertilizerStages" placeholder="Basal manure, NPK, Potassium feed" /></Field>
              <Field label="Pest risks"><input className={inputClass} defaultValue={selectedTemplate.commonPestRisks?.join(", ") || ""} name="commonPestRisks" placeholder="Aphids, Whitefly, Wilt" /></Field>
              <Field label="Care tasks"><input className={inputClass} defaultValue={selectedTemplate.commonCareTasks?.join(", ") || ""} name="commonCareTasks" placeholder="Watering, Weeding, Spraying" /></Field>
            </div>
          </details>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save crop</button>
        </form>
      ) : null}

      <section className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {data.cropProfiles.length ? <ShowMoreList items={data.cropProfiles} initial={6} noun="crops" render={(crop) => (
            <ExpandableCard
              key={crop.id}
              badges={<Pill tone={crop.waterNeed === "high" ? "warning" : "green"}>{crop.waterNeed} water</Pill>}
              summary={(
                <>
                  <p className="text-xs font-black uppercase text-[#0f8b6f]">{labelize(crop.plantingMethod)}</p>
                  <h3 className="text-base font-black text-[#14213d] sm:text-lg">{crop.cropName}</h3>
                  <p className="mt-0.5 text-xs text-[#667085]">{crop.nurseryRequired ? `${crop.nurseryDurationDays || "?"}d nursery · ` : ""}{crop.harvestWindow || `${crop.expectedDurationToHarvestDays || "?"} days to harvest`}</p>
                </>
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Nursery" value={crop.nurseryRequired ? `${crop.nurseryDurationDays || "?"} days` : "Not required"} />
                <Info label="Harvest/maturity" value={crop.harvestWindow || `${crop.expectedDurationToHarvestDays || "?"} days`} />
                <Info label="Yield / acre" value={`${numberFormat.format(crop.expectedYieldPerAcre || 0)} ${crop.marketUnit}`} />
                <Info label="Yield / plant" value={`${numberFormat.format(crop.expectedYieldPerPlant || 0)} ${crop.marketUnit}`} />
                <Info label="Irrigation" value={crop.irrigationRecommended ? "Recommended" : "Optional"} />
              </div>
              {crop.commonPestRisks.length ? <div className="mt-3 flex flex-wrap gap-2">{crop.commonPestRisks.map((risk) => <Pill tone="warning" key={risk}>{risk}</Pill>)}</div> : null}
              <p className="mt-3 text-sm leading-6 text-[#4b5a76]">{crop.notes || "No notes yet."}</p>
              <div className="mt-3"><DeleteButton label="Delete crop" onDelete={() => deleteRecord("cropProfiles", crop.id, `${crop.cropName} deleted from crop catalog.`)} /></div>
            </ExpandableCard>
          )} /> : <EmptyState text="No crops yet. Add plantain, cucumber, bell pepper, scotch bonnet, garden egg, tomato, sweet corn or any crop you actually want to grow." />}
        </div>
      </section>
    </div>
  );
}

// Grouped picker for the inputs a plan will draw from inventory. Each chosen item
// gets a quantity; the picker shows live stock and (when emitHidden) writes parallel
// hidden inputs (plannedItemId / plannedQty) so an uncontrolled form can read them.
function PlanInputPicker({
  data,
  value,
  onChange,
  setTab,
  emitHidden = false,
  seedCount = 0,
  groups = ["seed", "fertilizer", "crop_protection"]
}: {
  data: FarmOsData;
  value: PlanInputLine[];
  onChange: (lines: PlanInputLine[]) => void;
  setTab?: (tab: FarmOsTab) => void;
  emitHidden?: boolean;
  seedCount?: number;
  groups?: InventoryItem["group"][];
}) {
  const items = data.inventoryItems.filter((item) => groups.includes(item.group));
  const lineFor = (itemId: string) => value.find((line) => line.itemId === itemId);
  // rawQty tracks the string while typing so backspace/clearing doesn't instantly uncheck the item
  const [rawQty, setRawQty] = useState<Record<string, string>>({});

  function setQty(itemId: string, quantity: number) {
    const rest = value.filter((line) => line.itemId !== itemId);
    onChange(quantity > 0 ? [...rest, { itemId, quantity }] : rest);
  }
  function toggle(itemId: string, defaultQty: number) {
    if (lineFor(itemId)) {
      setRawQty((prev) => { const n = { ...prev }; delete n[itemId]; return n; });
      setQty(itemId, 0);
    } else {
      setQty(itemId, defaultQty);
    }
  }

  if (!items.length) {
    return (
      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-[#f7d8a8] bg-[#fff8ec] p-4 text-sm font-bold leading-6 text-[#8a4b00]">
        No stock items yet. Add seeds, fertilizers and crop protection in Inventory first — a plan can only draw from what you actually have.
        {setTab ? <span><GuidanceAction label="Open Inventory" onClick={() => setTab("inputs")} /></span> : null}
      </div>
    );
  }

  const cost = planLinesCost(data, value);

  return (
    <div className="mt-4 rounded-xl border border-[#d8dece] bg-white p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm font-black text-[#14213d]">Inputs to use (drawn from inventory)</p>
        <Pill tone="green">{naira.format(cost)}</Pill>
      </div>
      {INVENTORY_GROUPS.filter((g) => groups.includes(g.group)).map((g) => {
        const groupItems = items.filter((item) => item.group === g.group);
        if (!groupItems.length) return null;
        return (
          <div className="mt-3" key={g.group}>
            <p className="text-xs font-black uppercase tracking-wide text-[#667085]">{g.label}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {groupItems.map((item) => {
                const line = lineFor(item.id);
                const stock = itemStock(data, item.id);
                const available = itemAvailable(data, item.id);
                const isSeed = item.group === "seed";
                const perUnit = Number(item.seedsPerUnit || 0);
                const defaultQty = isSeed && perUnit > 0 && seedCount > 0 ? unitsForSeedCount(item, seedCount) : 1;
                return (
                  <div className="rounded-lg border border-[#edf1e7] bg-[#fbfcf7] p-3 text-sm font-bold text-[#4b5a76]" key={item.id}>
                    <label className="flex cursor-pointer items-start gap-3">
                      <input checked={Boolean(line)} className="mt-1 h-4 w-4 accent-[#0f8b6f]" onChange={() => toggle(item.id, defaultQty)} type="checkbox" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-[#14213d]">{item.name}</span>
                        <span>{[labelize(item.category), `${formatQty(available, item.unit)} avail`, isSeed && perUnit > 0 ? `${numberFormat.format(seedsAvailable(data, item))} seeds` : ""].filter(Boolean).join(" · ")}</span>
                      </span>
                    </label>
                    {line ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black text-[#667085]">Qty to use</span>
                        <input
                          className={`${inputClass} h-9 max-w-[6rem]`}
                          inputMode="decimal"
                          value={item.id in rawQty ? rawQty[item.id] : String(line.quantity)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setRawQty((prev) => ({ ...prev, [item.id]: raw }));
                            const num = parseFloat(raw);
                            if (!isNaN(num) && num > 0) setQty(item.id, num);
                          }}
                          onBlur={() => {
                            setRawQty((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
                          }}
                        />
                        <span className="text-xs font-bold text-[#667085]">{pluralizeUnit(item.unit, line.quantity)}</span>
                        {isSeed && perUnit > 0 ? <span className="text-xs font-bold text-[#0a715b]">≈ {numberFormat.format(line.quantity * perUnit)} seeds</span> : null}
                        {isSeed && perUnit > 0 && seedCount > 0 ? <button className="rounded-md border border-[#cdeee2] bg-[#f1fbf7] px-2 py-1 text-xs font-black text-[#0a715b]" onClick={() => setQty(item.id, unitsForSeedCount(item, seedCount))} type="button">Set for {numberFormat.format(seedCount)} seeds</button> : null}
                        {line.quantity > stock ? <Pill tone="warning">short {numberFormat.format(line.quantity - stock)}</Pill> : null}
                      </div>
                    ) : null}
                    {emitHidden && line ? (
                      <>
                        <input name="plannedItemId" type="hidden" value={item.id} />
                        <input name="plannedQty" type="hidden" value={line.quantity} />
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type GeneratedPlan = {
  summary: string;
  varietyNote?: string;
  transplantInDays: number;
  harvestStartInDays: number;
  harvestEndInDays: number;
  expectedYield: number;
  yieldUnit: string;
  expectedRevenue: number;
  expectedProfit?: number;
  fertilizerPlan: { stage: string; product: string; quantity: string; timing: string }[];
  tasks: { title: string; taskType: string; dayOffset: number; notes?: string }[];
  source: "gemini" | "rules";
};

// Common varieties/species grown in Nigeria, per crop. Used to suggest a
// dropdown in the planner (manual entry is still allowed). Keyed loosely so
// "Bell pepper", "pepper", "tatashe" all resolve.
const CROP_VARIETIES: Record<string, string[]> = {
  cucumber: ["Darina F1", "Marketmore", "Ashley", "Poinsett", "Murano F1", "Tokyo F1", "Nun 5051", "Green Gold F1"],
  tomato: ["UC82B", "Roma VF", "Cobra F1", "Padma F1", "Platinum F1", "Tropimech", "Beske (local)", "Dan Eka"],
  pepper: ["California Wonder", "Yolo Wonder", "Nsukka Yellow", "Tatashe (local)", "Shombo (local)"],
  "scotch bonnet": ["Atarodo (local)", "Habanero", "Scotch Bonnet F1", "Rodo (local)"],
  "garden egg": ["Nsukka Yellow", "Green Long", "White Round (Bello)", "Ngwa Local", "Black Beauty"],
  eggplant: ["Black Beauty", "Green Long", "White Round (Bello)"],
  watermelon: ["Sugar Baby", "Kaolack", "Crimson Sweet", "Charleston Gray", "Koloss F1"],
  "sweet corn": ["Golden Sweet Hybrid", "Oba Super 2", "SUWAN-1", "Local white maize"],
  maize: ["Oba Super 1", "Oba Super 2", "SUWAN-1", "Sammaz 15", "Local white"],
  plantain: ["Agbagba", "False Horn", "PITA 24", "Bira (local)"],
  okra: ["Clemson Spineless", "NHAe47-4", "Lady's Finger", "Kirikou F1", "Indiana F1"],
  onion: ["Red Creole", "Sokoto Red", "Nasarawa White", "Texas Grano"],
  carrot: ["Kuroda", "Nantes", "Touchon", "Bangkok"],
  cassava: ["TMS 30572", "TME 419", "Sweet cassava", "Local bitter cassava"],
  yam: ["White yam (Pona)", "Water yam (Ji-abana)", "Yellow yam", "Aro"],
  "fluted pumpkin": ["Local Ugu (broad leaf)", "Improved Ugu"],
  ugu: ["Local Ugu (broad leaf)", "Improved Ugu"],
  amaranth: ["Green Tete", "Red Amaranth (Arowojeja)", "Soko"],
  tete: ["Green Tete", "Red Amaranth (Arowojeja)"]
};
function varietiesForCrop(cropName?: string): string[] {
  const q = (cropName || "").toLowerCase();
  if (!q) return [];
  for (const [key, list] of Object.entries(CROP_VARIETIES)) {
    if (q.includes(key) || key.includes(q)) return list;
  }
  return [];
}

function CropPlanGenerator({ data, focusPlotId, createScheduleTasks, createPlantingPlanRecord, setTab }: { data: FarmOsData; focusPlotId?: string; createScheduleTasks: (baseDate: string, items: { title: string; taskType: string; dayOffset: number; notes?: string }[], cropName: string, plotId: string) => void; createPlantingPlanRecord: (plan: PlantingPlan) => void; setTab: (tab: FarmOsTab) => void }) {
  const [cropId, setCropId] = useState(data.cropProfiles[0]?.id || "");
  const [variety, setVariety] = useState("");
  const [plotId, setPlotId] = useState(focusPlotId || data.plots[0]?.id || "");
  const [startDate, setStartDate] = useState("");
  const [seedCount, setSeedCount] = useState("");
  const [yieldPerPlant, setYieldPerPlant] = useState("");
  const [plannedInputs, setPlannedInputs] = useState<PlanInputLine[]>([]);
  const [marketPrice, setMarketPrice] = useState("");
  const [marketUnit, setMarketUnit] = useState("kg");
  const [pending, setPending] = useState(false);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [done, setDone] = useState("");

  const crop = data.cropProfiles.find((c) => c.id === cropId);
  const plot = data.plots.find((p) => p.id === plotId);
  const fertilizerLines = plannedInputs.filter((line) => getInventoryItem(data, line.itemId)?.group === "fertilizer");
  const seedLines = plannedInputs.filter((line) => getInventoryItem(data, line.itemId)?.group === "seed");
  const selectedFertilizerCost = planLinesCost(data, fertilizerLines);
  const seedInputCost = planLinesCost(data, seedLines);
  const effectiveYieldPerPlant = Number(yieldPerPlant) || Number(crop?.expectedYieldPerPlant || 0);
  const expectedYieldFromSeeds = Number(seedCount) && effectiveYieldPerPlant ? Math.round(Number(seedCount) * effectiveYieldPerPlant) : 0;

  useEffect(() => {
    setYieldPerPlant(crop?.expectedYieldPerPlant ? String(crop.expectedYieldPerPlant) : "");
    // Auto-pull the latest recorded market price for this crop from Market Prices.
    if (crop) {
      const latest = latestMarketPriceForCrop(data, crop.cropName);
      if (latest) {
        setMarketPrice(String(latest.price));
        setMarketUnit(latest.unit);
      }
    }
  }, [cropId, crop, data]);

  async function generate() {
    if (!crop || !plot || !startDate || pending) return;
    setPending(true);
    setDone("");
    setPlan(null);
    const body = {
      crop: { name: crop.cropName, variety: variety || undefined, nurseryRequired: crop.nurseryRequired, nurseryDays: crop.nurseryDurationDays, maturityDays: crop.expectedDurationToHarvestDays, waterNeed: crop.waterNeed, marketUnit: crop.marketUnit, pestRisks: crop.commonPestRisks, expectedYieldPerAcre: crop.expectedYieldPerAcre, expectedYieldPerPlant: effectiveYieldPerPlant },
      plot: { code: plot.plotCode, acres: plot.equivalentAcres, irrigated: plot.irrigated },
      plantingDate: startDate,
      nurseryDate: crop.nurseryRequired ? startDate : "",
      seedCount: Number(seedCount) || 0,
      expectedYieldFromSeeds,
      fertilizers: fertilizerLines.map((line) => {
        const item = getInventoryItem(data, line.itemId);
        return { name: item?.name, category: item?.category, nutrientFocus: item?.nutrientFocus, quantityAvailable: line.quantity, unit: item?.unit, totalCost: line.quantity * Number(item?.lastUnitCost || 0), preferredStage: item?.preferredStage };
      }),
      fertilizerCost: selectedFertilizerCost,
      protection: plannedInputs
        .filter((line) => getInventoryItem(data, line.itemId)?.group === "crop_protection")
        .map((line) => {
          const item = getInventoryItem(data, line.itemId);
          return { name: item?.name, category: item?.category, target: item?.target };
        }),
      marketPrice: Number(marketPrice) || 0,
      marketUnit
    };
    try {
      const res = await fetch("/api/plant-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setPlan((await res.json()) as GeneratedPlan);
    } catch {
      setDone("Could not generate the plan. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function createTasks() {
    if (!plan || !crop) return;
    createScheduleTasks(startDate, plan.tasks, crop.cropName, plotId);
    setDone(`${plan.tasks.length} task(s) added. Open Tasks to assign them to workers.`);
  }

  function savePlan() {
    if (!plan || !crop || !plot) return;
    const acres = Number(plot.equivalentAcres || 1);
    const rec: PlantingPlan = {
      id: makeId("plant"),
      cropProfileId: cropId,
      plotId,
      cropName: crop.cropName,
      variety: variety || undefined,
      plannedNurseryDate: crop.nurseryRequired ? startDate : "",
      plannedPlantingDate: crop.nurseryRequired ? "" : startDate,
      expectedTransplantDate: addDays(startDate, plan.transplantInDays),
      expectedHarvestStartDate: addDays(startDate, plan.harvestStartInDays),
      expectedHarvestEndDate: addDays(startDate, plan.harvestEndInDays),
      seedCost: seedInputCost,
      fertilizerBudget: selectedFertilizerCost,
      laborBudget: 0,
      irrigationBudget: 0,
      transportBudget: 0,
      otherBudget: 0,
      seedCount: Number(seedCount) || 0,
      expectedYieldPerAcre: acres ? Math.round(plan.expectedYield / acres) : crop.expectedYieldPerAcre,
      expectedYieldPerPlant: effectiveYieldPerPlant,
      expectedTotalYield: plan.expectedYield,
      expectedMarketPrice: Number(marketPrice) || 0,
      expectedMarketUnit: marketUnit as PlantingPlan["expectedMarketUnit"],
      selectedFertilizerIds: fertilizerLines.map((line) => line.itemId),
      selectedFertilizerCost,
      plannedInputs,
      expectedRevenue: plan.expectedRevenue,
      expectedProfit: plan.expectedRevenue - selectedFertilizerCost - seedInputCost,
      warnings: [],
      status: "draft",
      notes: [plan.varietyNote, plan.summary].filter(Boolean).join("\n\n")
    };
    createPlantingPlanRecord(rec);
    setDone("Planting plan saved. See it in the list below.");
  }

  return (
    <section className="dt-panel p-5">
      {!data.cropProfiles.length || !data.plots.length ? (
          <div className="mt-4 grid gap-2">
            <EmptyState text="You need at least one crop in the Crop Catalog and one plot in Farm Map first." />
            <button className="inline-flex min-h-11 w-fit cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white opacity-50" disabled type="button">
              <Sparkles size={16} /> Generate with AI
            </button>
            <div className="flex flex-wrap gap-2">
              {!data.plots.length ? <GuidanceAction label="Add a plot" onClick={() => setTab("farm-map")} /> : null}
              {!data.cropProfiles.length ? <GuidanceAction label="Add a crop" onClick={() => setTab("crop-catalog")} /> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Crop"><select className={inputClass} value={cropId} onChange={(e) => { setCropId(e.target.value); setVariety(""); }}>{data.cropProfiles.map((c) => <option key={c.id} value={c.id}>{c.cropName}</option>)}</select></Field>
            <Field label="Variety / species (Nigeria)">
              <input className={inputClass} list="ai-variety-list" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder={varietiesForCrop(crop?.cropName)[0] ? `e.g. ${varietiesForCrop(crop?.cropName)[0]} — or type your own` : "Pick or type the variety"} />
              <datalist id="ai-variety-list">{varietiesForCrop(crop?.cropName).map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Plot"><select className={inputClass} value={plotId} onChange={(e) => setPlotId(e.target.value)}>{data.plots.map((p) => <option key={p.id} value={p.id}>{p.plotCode} — {p.plotName}</option>)}</select></Field>
            <Field label={crop?.nurseryRequired ? "Nursery start date" : "Planting date"}><input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Seeds / seedlings planted"><input className={inputClass} inputMode="numeric" value={seedCount} onChange={(e) => setSeedCount(e.target.value)} placeholder="e.g. 1800" /></Field>
            <Field label="Expected yield per plant"><input className={inputClass} inputMode="decimal" value={yieldPerPlant} onChange={(e) => setYieldPerPlant(e.target.value)} placeholder="e.g. 1.2" /></Field>
            <Field label="Market price (per unit)"><input className={inputClass} inputMode="decimal" value={marketPrice} onChange={(e) => setMarketPrice(e.target.value)} placeholder="e.g. 850" /></Field>
            <Field label="Price unit"><select className={inputClass} value={marketUnit} onChange={(e) => setMarketUnit(e.target.value)}>{marketUnits.map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
          </div>
          <PlanInputPicker data={data} value={plannedInputs} onChange={setPlannedInputs} setTab={setTab} seedCount={Number(seedCount) || 0} />
          <button className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white disabled:opacity-50" disabled={!startDate || pending} onClick={generate} type="button">
            <Sparkles size={16} /> {pending ? "Generating plan…" : "Generate with AI"}
          </button>
          {!startDate ? <p className="mt-2 text-xs font-bold text-[#667085]">Enter the {crop?.nurseryRequired ? "nursery start" : "planting"} date to generate the plan.</p> : null}

          {plan ? (
            <div className="mt-5 grid gap-4">
              <div className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">Generated plan</p>
                  <Pill tone={plan.source === "gemini" ? "green" : "navy"}>{plan.source === "gemini" ? "Gemini" : "built-in"}</Pill>
                </div>
                <p className="mt-1 text-sm font-bold leading-6 text-[#4b5a76]">{plan.summary}</p>
                {plan.varietyNote ? (
                  <div className="mt-3 rounded-lg border border-[#cdeee2] bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#0a715b]">About {variety || "this variety"}</p>
                    <p className="mt-1 text-sm font-bold leading-6 text-[#4b5a76]">{plan.varietyNote}</p>
                  </div>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Transplant" value={crop?.nurseryRequired ? addDays(startDate, plan.transplantInDays) || "n/a" : "Direct"} />
                <Info label="Harvest from" value={addDays(startDate, plan.harvestStartInDays) || "n/a"} />
                <Info label="Harvest to" value={addDays(startDate, plan.harvestEndInDays) || "n/a"} />
                <Info label="Expected yield" value={`${numberFormat.format(plan.expectedYield)} ${plan.yieldUnit}`} />
                <Info label="Market price" value={marketPrice ? `${naira.format(Number(marketPrice))}/${marketUnit}` : "Not set"} />
                <Info label="Expected revenue" value={naira.format(plan.expectedRevenue)} />
                <Info label="Fertilizer cost" value={naira.format(selectedFertilizerCost)} />
                <Info label="Net after fertilizer" value={naira.format(plan.expectedRevenue - selectedFertilizerCost)} />
              </div>

              <div>
                <p className="text-sm font-black text-[#14213d]">Fertilizer schedule</p>
                <div className="mt-2 grid gap-2">
                  {plan.fertilizerPlan.map((f, i) => (
                    <div className="rounded-lg border border-[#edf1e7] bg-white p-3 text-sm" key={i}>
                      <strong className="text-[#14213d]">{f.stage}: {f.product}</strong>
                      <p className="font-bold text-[#667085]">{[f.quantity, f.timing].filter(Boolean).join(" · ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-black text-[#14213d]">Task schedule ({plan.tasks.length})</p>
                <ul className="mt-2 grid gap-1.5">
                  {plan.tasks.map((t, i) => (
                    <li className="flex items-start justify-between gap-3 rounded-lg border border-[#edf1e7] bg-white p-2.5 text-sm" key={i}>
                      <span className="font-bold text-[#14213d]">{t.title} <span className="font-black text-[#0f8b6f]">({labelize(t.taskType)})</span></span>
                      <span className="shrink-0 text-xs font-bold text-[#667085]">{addDays(startDate, t.dayOffset) || `+${t.dayOffset}d`}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={createTasks} type="button"><ClipboardList size={16} /> Create {plan.tasks.length} tasks</button>
                <button className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[#0f8b6f] bg-white px-4 text-sm font-black text-[#0a715b]" onClick={savePlan} type="button"><Sprout size={16} /> Save planting plan</button>
                <button className="min-h-11 rounded-lg border border-[#d8dece] bg-white px-4 text-sm font-black text-[#4b5a76]" onClick={() => setTab("tasks")} type="button">Open Tasks</button>
              </div>
              {done ? <p className="rounded-lg bg-[#f1fbf7] p-3 text-sm font-black text-[#0f8b6f]">{done}</p> : null}
            </div>
          ) : null}
          {!plan && done ? <p className="mt-3 text-sm font-bold text-[#b42318]">{done}</p> : null}
        </>
      )}
    </section>
  );
}

function PlantingPlannerView({ data, addPlantingPlan, deleteRecord, focusPlotId, createScheduleTasks, createPlantingPlanRecord, updatePlanStatus, enhancePlanWithAi, setTab }:{ data: FarmOsData; addPlantingPlan: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string; createScheduleTasks: (baseDate: string, items: { title: string; taskType: string; dayOffset: number; notes?: string }[], cropName: string, plotId: string) => void; createPlantingPlanRecord: (plan: PlantingPlan) => void; updatePlanStatus: (planId: string, status: PlantingPlan["status"]) => void; enhancePlanWithAi: (planId: string) => Promise<void>; setTab: (tab: FarmOsTab) => void }) {
  const [manualInputs, setManualInputs] = useState<PlanInputLine[]>([]);
  const [manualSeedCount, setManualSeedCount] = useState(0);
  const [enhancingId, setEnhancingId] = useState("");
  const [manualCropId, setManualCropId] = useState("");
  const manualCropName = data.cropProfiles.find((c) => c.id === manualCropId)?.cropName;
  const [showManual, setShowManual] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const needs = procurementNeeds(data);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Planting planner">
        Pick a crop and a plot, enter the date you plant (or start the nursery) and how many seeds/seedlings you put in. The AI planner then lays out the whole crop journey — transplant and harvest dates, a fertilizer schedule, the task calendar to assign to workers, and a yield + revenue forecast.
      </PageIntro>

      <AddSection label="✨ Generate a plan with AI" open={showAi} onToggle={() => setShowAi((s) => !s)}>
        <CropPlanGenerator data={data} focusPlotId={focusPlotId} createScheduleTasks={createScheduleTasks} createPlantingPlanRecord={createPlantingPlanRecord} setTab={setTab} />
      </AddSection>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={Sprout} label="Planting plans" value={data.plantingPlans.length} hint="Planning to active crop cycles" />
        <DashboardCard icon={AlertTriangle} label="Warnings" value={data.plantingPlans.reduce((sum, plan) => sum + plan.warnings.length, 0)} hint="Readiness, water, cost and market gaps" tone="warning" />
        <DashboardCard icon={Coins} label="Forecast revenue" value={naira.format(data.plantingPlans.reduce((sum, plan) => sum + expectedRevenue(plan), 0))} hint="Based on yield and price" />
        <DashboardCard icon={BarChart3} label="Forecast profit" value={naira.format(data.plantingPlans.reduce((sum, plan) => sum + expectedProfit(plan), 0))} hint="Revenue minus planned costs" />
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <AddSection label="Create a plan manually (or use AI above)" open={showManual} onToggle={() => setShowManual((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(event) => { addPlantingPlan(event); setManualInputs([]); setManualSeedCount(0); setShowManual(false); }}>
          <SectionHeader eyebrow="Planting planner" title="Create crop plan manually" />
          <div className="rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-4 text-sm font-bold leading-6 text-[#4b5a76]">
            Flow: select crop → select plot → enter planting/nursery date → pick the seeds, fertilizer and crop protection this plan will draw from inventory (with quantities) → set market price. Seed and fertilizer cost are taken from your inventory unit costs; the budget fields below are only fallbacks for non-stock items.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Crop">
              <select className={inputClass} name="cropProfileId" value={manualCropId} onChange={(e) => setManualCropId(e.target.value)}>
                <option value="">{data.cropProfiles.length ? "Select crop" : "Add a crop first"}</option>
                {data.cropProfiles.map((crop) => <option key={crop.id} value={crop.id}>{crop.cropName}</option>)}
              </select>
            </Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Variety / species (Nigeria)">
              <input className={inputClass} list="manual-variety-list" name="variety" placeholder={varietiesForCrop(manualCropName)[0] ? `e.g. ${varietiesForCrop(manualCropName)[0]} — or type your own` : "Cayenne / African Giant F1"} />
              <datalist id="manual-variety-list">{varietiesForCrop(manualCropName).map((v) => <option key={v} value={v} />)}</datalist>
            </Field>
            <Field label="Nursery date"><input className={inputClass} name="plannedNurseryDate" type="date" /></Field>
            <Field label="Planting/transplant date"><input className={inputClass} name="plannedPlantingDate" type="date" /></Field>
            <Field label="Expected transplant"><input className={inputClass} name="expectedTransplantDate" type="date" /></Field>
            <Field label="Harvest start"><input className={inputClass} name="expectedHarvestStartDate" type="date" /></Field>
            <Field label="Harvest end"><input className={inputClass} name="expectedHarvestEndDate" type="date" /></Field>
            <Field label="Seeds / seedlings planted"><input className={inputClass} inputMode="numeric" name="seedCount" placeholder="13000" onChange={(e) => setManualSeedCount(Number(e.target.value) || 0)} /></Field>
            <Field label="Seed cost"><input className={inputClass} inputMode="decimal" name="seedCost" placeholder="45000" /></Field>
            <Field label="Fertilizer budget"><input className={inputClass} inputMode="decimal" name="fertilizerBudget" placeholder="180000" /></Field>
            <Field label="Labour budget"><input className={inputClass} inputMode="decimal" name="laborBudget" placeholder="260000" /></Field>
            <Field label="Irrigation budget"><input className={inputClass} inputMode="decimal" name="irrigationBudget" placeholder="574000" /></Field>
            <Field label="Transport budget"><input className={inputClass} inputMode="decimal" name="transportBudget" placeholder="90000" /></Field>
            <Field label="Other budget"><input className={inputClass} inputMode="decimal" name="otherBudget" placeholder="50000" /></Field>
            <Field label="Expected yield per acre"><input className={inputClass} inputMode="decimal" name="expectedYieldPerAcre" placeholder="3500" /></Field>
            <Field label="Expected yield per plant"><input className={inputClass} inputMode="decimal" name="expectedYieldPerPlant" placeholder="1.2" /></Field>
            <Field label="Market price"><input className={inputClass} inputMode="decimal" name="expectedMarketPrice" placeholder="850" /></Field>
            <Field label="Market price unit"><SelectOptions name="expectedMarketUnit" values={marketUnits} defaultValue="kg" /></Field>
          </div>
          <PlanInputPicker data={data} value={manualInputs} onChange={setManualInputs} setTab={setTab} emitHidden seedCount={manualSeedCount} />
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="Assumptions, risks, supplier details, planting density..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Create planting plan</button>
        </form>
        </AddSection>

        <div className="grid gap-4">
          {needs.length ? (
            <div className="dt-panel border-l-4 border-l-[#f79009] p-4">
              <p className="text-sm font-black text-[#14213d]">Procurement — stock won&apos;t cover your active plans</p>
              <div className="mt-2 grid gap-1.5">
                {needs.map((need) => (
                  <div className="flex items-center justify-between gap-2 text-sm font-bold text-[#4b5a76]" key={need.item.id}>
                    <span>{need.item.name} <span className="text-[#667085]">(have {formatQty(need.stock, need.item.unit)}, need {formatQty(need.reserved, need.item.unit)})</span></span>
                    <Pill tone="warning">buy {formatQty(need.shortfall, need.item.unit)}{need.estCost ? ` · ${naira.format(need.estCost)}` : ""}</Pill>
                  </div>
                ))}
              </div>
            </div>
          ) : data.plantingPlans.some((plan) => (plan.plannedInputs || []).length) ? (
            <div className="dt-panel border-l-4 border-l-[#0f8b6f] p-4 text-sm font-black text-[#0a715b]">Stock covers all planned inputs — you have enough to plant.</div>
          ) : null}
          {data.plantingPlans.length ? <ShowMoreList items={data.plantingPlans} initial={5} noun="plans" render={(plan) => {
            const extraInputs = totalInputsForPlan(data.inputCosts, plan.id);
            const impact = observationImpact(data.observations, plan.id);
            const adjustedProfit = expectedProfit(plan) - extraInputs + Number(impact.costImpact || 0);
            const requirements = planRequirements(data, plan);
            return (
              <ExpandableCard
                key={plan.id}
                badges={<Pill tone={statusTone(plan.status)}>{labelize(plan.status)}</Pill>}
                summary={(
                  <>
                    <p className="text-xs font-black uppercase text-[#0f8b6f]">{getPlotName(data, plan.plotId)}</p>
                    <h3 className="text-base font-black leading-tight text-[#14213d] sm:text-lg">{plan.cropName}{plan.variety ? ` · ${plan.variety}` : ""}</h3>
                    <p className="mt-0.5 text-xs font-bold text-[#667085]">Profit {naira.format(expectedProfit(plan))}{plan.expectedHarvestStartDate ? ` · harvest ${plan.expectedHarvestStartDate}` : ""}</p>
                  </>
                )}
              >
                <div className="flex flex-wrap gap-2">
                  {plan.status === "draft" && (
                    <button className="inline-flex min-h-8 items-center rounded-lg bg-[#0f8b6f] px-3 text-xs font-black text-white" onClick={() => updatePlanStatus(plan.id, "active")} type="button">▶ Mark Active</button>
                  )}
                  {plan.status === "active" && (
                    <button className="inline-flex min-h-8 items-center rounded-lg bg-[#14213d] px-3 text-xs font-black text-white" onClick={() => updatePlanStatus(plan.id, "completed")} type="button">✓ Harvest Done</button>
                  )}
                  {(plan.status === "draft" || plan.status === "approved") && (
                    <button className="inline-flex min-h-8 items-center rounded-lg border border-[#e0443a] px-3 text-xs font-black text-[#e0443a]" onClick={() => updatePlanStatus(plan.id, "cancelled")} type="button">Cancel</button>
                  )}
                  <button className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#cdeee2] bg-[#f1fbf7] px-3 text-xs font-black text-[#0a715b] disabled:opacity-50" disabled={enhancingId === plan.id} onClick={async () => { setEnhancingId(plan.id); try { await enhancePlanWithAi(plan.id); } finally { setEnhancingId(""); } }} type="button"><Sparkles size={12} /> {enhancingId === plan.id ? "Enhancing…" : "Enhance with AI"}</button>
                  <DeleteButton label="Delete plan" onDelete={() => deleteRecord("plantingPlans", plan.id, `${plan.cropName} planting plan deleted.`)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info label="Plan cost" value={naira.format(planCost(plan))} />
                  <Info label="Expected revenue" value={naira.format(expectedRevenue(plan))} />
                  <Info label="Expected profit" value={naira.format(expectedProfit(plan))} />
                  <Info label="Margin" value={`${numberFormat.format(profitMargin(plan))}%`} />
                  <Info label="Market unit" value={plan.expectedMarketUnit || "kg"} />
                  <Info label="Seeds/plants" value={numberFormat.format(plan.seedCount || 0)} />
                  <Info label="Yield / plant" value={`${numberFormat.format(plan.expectedYieldPerPlant || 0)} ${plan.expectedMarketUnit || "kg"}`} />
                  <Info label="Selected fertilizer" value={naira.format(plan.selectedFertilizerCost || 0)} />
                  <Info label="Transplant" value={plan.expectedTransplantDate || "Not needed/set"} />
                  <Info label="Harvest window" value={`${plan.expectedHarvestStartDate || "?"} to ${plan.expectedHarvestEndDate || "?"}`} />
                  <Info label="Extra logged inputs" value={naira.format(extraInputs)} />
                  <Info label="Adjusted view" value={naira.format(adjustedProfit)} />
                </div>
                {plan.notes ? (
                  <div className="mt-4 rounded-xl border border-[#cdeee2] bg-[#f1fbf7] p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#0a715b]">{plan.variety ? `About ${plan.variety}` : "Plan notes"}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm font-bold leading-6 text-[#4b5a76]">{plan.notes}</p>
                  </div>
                ) : null}
                {requirements.length ? (
                  <div className="mt-4 rounded-xl border border-[#edf1e7] bg-[#fbfcf7] p-3">
                    <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Inputs needed vs available</p>
                    <div className="mt-2 grid gap-1.5">
                      {requirements.map((req) => (
                        <div className="flex items-center justify-between gap-2 text-sm font-bold text-[#4b5a76]" key={req.itemId}>
                          <span>{req.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[#667085]">need {formatQty(req.remaining, req.unit)} / have {formatQty(req.available, req.unit)}</span>
                            {req.shortfall > 0 ? <Pill tone="warning">short {numberFormat.format(req.shortfall)}</Pill> : <Pill tone="green">ok</Pill>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {plan.warnings.length ? <div className="mt-4 flex flex-wrap gap-2">{plan.warnings.map((warning) => <Pill tone="warning" key={warning}>{warning}</Pill>)}</div> : <p className="mt-4"><Pill>No warnings</Pill></p>}
              </ExpandableCard>
            );
          }} /> : <EmptyState text="No planting plans yet. Add at least one plot and one crop profile, then create your first planting plan." />}
        </div>
      </section>
    </div>
  );
}

const GROUP_UNIT_OPTIONS: Record<InventoryItem["group"], string[]> = {
  seed: ["pack", "kg", "gram", "sachet", "tin", "bag", "tray", "seed"],
  fertilizer: ["bag", "kg", "litre", "bottle", "sachet", "ton"],
  crop_protection: ["litre", "bottle", "sachet", "kg", "ml", "bag"],
  other: ["unit", "bag", "kg", "litre", "trip", "piece"]
};

function InventoryView({ data, addInventoryItem, addStockIn, useStock, recordTreatment, deleteRecord, focusPlotId, setTab }: { data: FarmOsData; addInventoryItem: (event: FormEvent<HTMLFormElement>) => void; addStockIn: (event: FormEvent<HTMLFormElement>) => void; useStock: (event: FormEvent<HTMLFormElement>) => void; recordTreatment: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string; setTab: (tab: FarmOsTab) => void }) {
  const [showNew, setShowNew] = useState(false);
  const [newGroup, setNewGroup] = useState<InventoryItem["group"]>("seed");
  const [active, setActive] = useState<{ mode: "in" | "out"; itemId: string } | null>(null);
  const [seedsPerUnit, setSeedsPerUnit] = useState("");
  const [grams, setGrams] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [estimateNote, setEstimateNote] = useState("");
  const [showTreatment, setShowTreatment] = useState(false);
  const newItemFormRef = useRef<HTMLFormElement>(null);

  async function estimateSeeds() {
    if (estimating) return;
    const cropEl = newItemFormRef.current?.elements.namedItem("name") as HTMLInputElement | null;
    const crop = (cropEl?.value || "").trim();
    const gramsNum = Number(grams) || 0;
    if (!crop || gramsNum <= 0) {
      setEstimateNote("Enter the crop name and grams first.");
      return;
    }
    setEstimating(true);
    setEstimateNote("Estimating…");
    try {
      const res = await fetch("/api/seed-estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ crop, grams: gramsNum }) });
      const j = (await res.json()) as { ok?: boolean; seedsPerGram?: number; estimatedSeeds?: number; note?: string; error?: string };
      if (j.ok && j.estimatedSeeds) {
        setSeedsPerUnit(String(j.estimatedSeeds));
        setEstimateNote(`≈ ${j.estimatedSeeds.toLocaleString()} seeds in ${gramsNum} g (${j.seedsPerGram}/g). Set as seeds per unit — adjust if your pack differs.`);
      } else {
        setEstimateNote(j.error || "Could not estimate — enter seeds per unit directly.");
      }
    } catch {
      setEstimateNote("Could not estimate — check your connection or enter seeds per unit directly.");
    } finally {
      setEstimating(false);
    }
  }
  const lowItems = data.inventoryItems.filter((item) => isLowStock(data, item));
  const totalSpend = inventoryPurchaseTotal(data);
  const protectionItems = data.inventoryItems.filter((item) => item.group === "crop_protection");
  const activeItem = active ? getInventoryItem(data, active.itemId) : undefined;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Inventory">
        This is your single source of truth for what is on the farm. Every item shows its current quantity (the sum of stock you add minus stock you use). Add stock when you buy or receive something, and record usage whenever it leaves the store — so plans only draw from what you really have.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={Package} label="Stock items" value={data.inventoryItems.length} hint="Seeds, fertilizer, crop protection, other" />
        <DashboardCard icon={AlertTriangle} label="Low / out of stock" value={lowItems.length} hint="At or below reorder level" tone={lowItems.length ? "warning" : "green"} />
        <DashboardCard icon={Coins} label="Stock value" value={naira.format(inventoryValue(data))} hint="Quantity on hand × last unit cost" />
        <DashboardCard icon={WalletCards} label="Spent on stock" value={naira.format(totalSpend)} hint="All purchase movements" />
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => { setShowNew((s) => !s); setActive(null); }} type="button">
          {showNew ? <X size={16} /> : <Plus size={16} />} {showNew ? "Close" : "Add new item"}
        </button>
      </div>

      {showNew ? (
        <form ref={newItemFormRef} className="dt-panel grid gap-4 p-5" onSubmit={(event) => { addInventoryItem(event); setShowNew(false); setSeedsPerUnit(""); setGrams(""); setEstimateNote(""); }}>
          <SectionHeader eyebrow="New stock item" title="Add an item to inventory" />
          <p className="text-sm font-bold leading-6 text-[#667085]">Create the item once. You can set how much you already have as an opening balance, then add more stock or record usage later.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Group"><select className={inputClass} name="group" value={newGroup} onChange={(e) => setNewGroup(e.target.value as InventoryItem["group"])}>{INVENTORY_GROUPS.map((g) => <option key={g.group} value={g.group}>{g.label}</option>)}</select></Field>
            <Field label="Item name">
              {newGroup === "fertilizer" ? <DataListInput name="name" options={FERTILIZER_CATALOG.map((item) => item.name)} placeholder="NPK 20-20-20 / Calcium Nitrate" />
                : newGroup === "crop_protection" ? <DataListInput name="name" options={PROTECTION_CATALOG.map((item) => item.name)} placeholder="Rocket / Saaf / Force Up" />
                : newGroup === "seed" ? <DataListInput name="name" options={allCropOptions(data)} placeholder="Pick or type a crop" required />
                : <input className={inputClass} name="name" placeholder="Item name" required />}
            </Field>
            <Field label={newGroup === "seed" ? "Crop / type" : newGroup === "fertilizer" ? "Type" : newGroup === "crop_protection" ? "Type" : "Category"}>
              {newGroup === "fertilizer" ? <SelectOptions name="category" values={["NPK", "urea", "organic", "foliar", "calcium", "potassium", "other"]} />
                : newGroup === "crop_protection" ? <SelectOptions name="category" values={["insecticide", "fungicide", "herbicide", "nematicide", "miticide", "other"]} />
                : newGroup === "seed" ? <DataListInput name="category" options={allCropOptions(data)} placeholder="Pick or type a crop" />
                : <input className={inputClass} name="category" placeholder="Category" />}
            </Field>
            <Field label="Unit"><DataListInput name="unit" options={GROUP_UNIT_OPTIONS[newGroup]} placeholder={GROUP_UNIT_OPTIONS[newGroup][0]} required /></Field>
            {newGroup === "seed" ? <Field label="Seeds per unit"><input className={inputClass} inputMode="decimal" name="seedsPerUnit" value={seedsPerUnit} onChange={(e) => setSeedsPerUnit(e.target.value)} placeholder="e.g. 1 pack ≈ 1000 seeds" /></Field> : null}
            {newGroup === "seed" ? <Field label="…or grams per unit (AI estimates seeds)"><div className="flex gap-2"><input className={`${inputClass} flex-1`} inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="e.g. 10 g" /><button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#14213d] px-3 text-sm font-black text-white disabled:opacity-50" disabled={estimating} onClick={estimateSeeds} type="button"><Sparkles size={14} /> {estimating ? "…" : "Estimate"}</button></div></Field> : null}
            <Field label="Last unit cost (₦)"><input className={inputClass} inputMode="decimal" name="unitCost" placeholder="45000" /></Field>
            <Field label="Reorder at"><input className={inputClass} inputMode="decimal" name="reorderAt" placeholder="Low-stock alert level" /></Field>
            <Field label="Opening quantity"><input className={inputClass} inputMode="decimal" name="openingQty" placeholder="How much you already have" /></Field>
            <Field label="Supplier"><DataListInput name="supplier" options={commonSupplierOptions} placeholder="Agro-dealer" /></Field>
            {newGroup === "crop_protection" ? <Field label="Controls / target"><input className={inputClass} name="target" placeholder="Whitefly, blight, weeds..." /></Field> : null}
            {newGroup === "fertilizer" ? <Field label="Preferred stage"><DataListInput name="preferredStage" options={["Nursery", "Basal", "Establishment", "Vegetative", "Flowering", "Fruiting", "Top dressing", "General"]} placeholder="Establishment" /></Field> : null}
          </div>
          {newGroup === "seed" && estimateNote ? <p className="rounded-lg bg-[#f1fbf7] p-2 text-xs font-black leading-5 text-[#0a715b]">{estimateNote}</p> : null}
          {newGroup === "seed" ? <p className="text-xs font-bold leading-5 text-[#667085]">Tip: enter how many seeds are in one unit, or type the grams per unit and let AI estimate (e.g. a pack of garden egg is often ~1000 seeds). The planner uses this to deplete the right number of {GROUP_UNIT_OPTIONS.seed[0]}s when you plant a seed count.</p> : null}
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="Crop fit, label rate, batch details..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Add item</button>
        </form>
      ) : null}

      {active && activeItem ? (
        active.mode === "in" ? (
          <form className="dt-panel grid gap-4 p-5" onSubmit={(event) => { addStockIn(event); setActive(null); }}>
            <SectionHeader eyebrow="Add stock" title={`Add stock — ${activeItem.name}`} />
            <input name="itemId" type="hidden" value={activeItem.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="How did you get it?"><SelectOptions name="acquisition" values={["purchase", "gift", "own_production", "other"]} /></Field>
              <Field label={`Quantity (${activeItem.unit})`}><input className={inputClass} inputMode="decimal" name="quantity" placeholder="2" required /></Field>
              <Field label="Unit cost (₦, if bought)"><input className={inputClass} inputMode="decimal" name="unitCost" defaultValue={activeItem.lastUnitCost || ""} placeholder="35000" /></Field>
              <Field label="Total cost (₦, optional)"><input className={inputClass} inputMode="decimal" name="totalCost" placeholder="Auto if blank" /></Field>
              <Field label="Supplier"><DataListInput name="supplier" options={commonSupplierOptions} placeholder="Supplier / market" /></Field>
              <Field label="Date"><input className={inputClass} name="date" type="date" /></Field>
            </div>
            <Field label="Notes"><input className={inputClass} name="notes" placeholder="Invoice no., batch..." /></Field>
            <PhotoInput name="photoDataUrl" label="Receipt photo (optional)" />
            <p className="text-xs font-bold text-[#667085]">Only purchases count as money out in the account book. Gifts and own production add stock without cost.</p>
            <div className="flex gap-2">
              <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Save — add to stock</button>
              <button className="min-h-11 rounded-lg border border-[#d8dece] bg-white px-4 text-sm font-black text-[#4b5a76]" onClick={() => setActive(null)} type="button">Cancel</button>
            </div>
          </form>
        ) : (
          <form className="dt-panel grid gap-4 p-5" onSubmit={(event) => { useStock(event); setActive(null); }}>
            <SectionHeader eyebrow="Use / remove stock" title={`Use stock — ${activeItem.name}`} />
            <input name="itemId" type="hidden" value={activeItem.id} />
            <p className="text-sm font-bold text-[#667085]">{formatQty(itemStock(data, activeItem.id), activeItem.unit)} in stock.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What was it used for?"><SelectOptions name="usage" values={["planting_plan", "treatment", "land_prep", "wastage", "other"]} /></Field>
              <Field label={`Quantity used (${activeItem.unit})`}><input className={inputClass} inputMode="decimal" name="quantity" placeholder="1" required /></Field>
              <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
              <Field label="Planting plan"><PlantingPlanSelect data={data} name="plantingPlanId" /></Field>
              <Field label="Where / why (note)"><input className={inputClass} name="destination" placeholder="Top dressing on Acre B" /></Field>
              <Field label="Date"><input className={inputClass} name="date" type="date" /></Field>
            </div>
            <div className="flex gap-2">
              <button className="min-h-11 rounded-lg bg-[#14213d] px-4 text-sm font-black text-white" type="submit">Save — deduct from stock</button>
              <button className="min-h-11 rounded-lg border border-[#d8dece] bg-white px-4 text-sm font-black text-[#4b5a76]" onClick={() => setActive(null)} type="button">Cancel</button>
            </div>
          </form>
        )
      ) : null}

      <section className="grid gap-3.5 sm:gap-5">
        {INVENTORY_GROUPS.map((g) => {
          const items = data.inventoryItems.filter((item) => item.group === g.group);
          const lowCount = items.filter((item) => isLowStock(data, item) || itemStock(data, item.id) <= 0).length;
          return (
            <CollapsibleSection
              key={g.group}
              eyebrow="Stock"
              title={g.label}
              defaultOpen={items.length > 0 && items.length <= 6}
              badge={<>{lowCount ? <Pill tone="warning">{lowCount} low</Pill> : null}<Pill tone="navy">{items.length}</Pill></>}
            >
              <div className="grid gap-2">
                {items.length ? <ShowMoreList items={items} initial={6} noun={g.label.toLowerCase()} render={(item) => {
                  const stock = itemStock(data, item.id);
                  const reserved = itemReserved(data, item.id);
                  const low = isLowStock(data, item);
                  const out = stock <= 0;
                  return (
                    <div className={`rounded-xl border p-3 ${out ? "border-[#f0d9d6] bg-[#fffbfa]" : "border-[#edf1e7] bg-white"}`} key={item.id}>
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <strong className="text-[#14213d]">{item.name}</strong>
                            {out ? <Pill tone="warning">out of stock</Pill> : low ? <Pill tone="warning">low</Pill> : null}
                          </div>
                          <p className="text-sm font-bold text-[#667085]">{labelize(item.category)} · {item.lastUnitCost ? `${naira.format(item.lastUnitCost)}/${item.unit}` : "no cost set"}{item.group === "seed" && item.seedsPerUnit ? ` · ${numberFormat.format(item.seedsPerUnit)} seeds/${item.unit}` : ""}{reserved ? ` · ${formatQty(reserved, item.unit)} reserved` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-lg bg-[#f1fbf7] px-3 py-1.5 text-center text-sm font-black text-[#0a715b]">{formatQty(stock, item.unit)}{item.group === "seed" && item.seedsPerUnit ? <span className="block text-xs font-bold text-[#667085]">≈ {numberFormat.format(seedsAvailable(data, item))} seeds</span> : null}</span>
                          <button className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#0f8b6f] px-3 text-sm font-black text-white" onClick={() => { setActive({ mode: "in", itemId: item.id }); setShowNew(false); }} type="button"><Plus size={14} /> Add</button>
                          <button className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#4b5a76]" onClick={() => { setActive({ mode: "out", itemId: item.id }); setShowNew(false); }} type="button">− Use</button>
                          <DeleteButton label="Delete" onDelete={() => deleteRecord("inventoryItems", item.id, `${item.name} removed from inventory.`)} />
                        </div>
                      </div>
                    </div>
                  );
                }} /> : <EmptyState text={`No ${g.label.toLowerCase()} yet. Use “Add new item” to start tracking stock.`} />}
              </div>
            </CollapsibleSection>
          );
        })}
      </section>

      {protectionItems.length ? (
        <AddSection label="Record a spray / treatment" open={showTreatment} onToggle={() => setShowTreatment((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { recordTreatment(e); setShowTreatment(false); }}>
          <SectionHeader eyebrow="Mid-cycle treatment" title="Record a spray / treatment now" />
          <p className="text-sm font-bold leading-6 text-[#667085]">Use this when a pest or disease appears during the cycle. It creates a dated spraying task (assignable to a worker) and deducts the product from stock.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product"><select className={inputClass} name="productId" required><option value="">Select product</option>{protectionItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({labelize(item.category)}) — {formatQty(itemStock(data, item.id), item.unit)}</option>)}</select></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Quantity used"><input className={inputClass} inputMode="decimal" name="quantity" placeholder="1" /></Field>
            <Field label="Reason"><input className={inputClass} name="reason" placeholder="Whitefly outbreak on flowering rows" /></Field>
            <Field label="Assign to"><WorkerSelect data={data} name="assignedWorkerId" /></Field>
            <Field label="Date"><input className={inputClass} name="date" type="date" /></Field>
          </div>
          <button className="min-h-11 rounded-lg bg-[#14213d] px-4 text-sm font-black text-white" type="submit">Record treatment + create task</button>
        </form>
        </AddSection>
      ) : null}

      <CollapsibleSection eyebrow="Ledger" title="Recent stock movements" badge={data.stockMovements.length ? <Pill tone="navy">{data.stockMovements.length}</Pill> : undefined}>
        <div className="grid gap-2">
          {data.stockMovements.length ? <ShowMoreList items={data.stockMovements.slice(0, 50)} initial={8} noun="movements" render={(movement) => {
            const item = getInventoryItem(data, movement.itemId);
            const inbound = movement.direction === "in";
            return (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#edf1e7] bg-white p-3 text-sm font-bold" key={movement.id}>
                <span className="flex min-w-0 items-center gap-2">
                  {movement.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={movement.photoDataUrl} target="_blank" rel="noreferrer"><img src={movement.photoDataUrl} alt="receipt" className="h-9 w-9 shrink-0 rounded border border-[#d8dece] object-cover" /></a>
                  ) : null}
                  <span className="min-w-0">
                    <span className="text-[#14213d]">{item?.name || "Unknown item"}</span>
                    <span className="text-[#667085]"> · {movement.date} · {labelize(inbound ? movement.acquisition || "in" : movement.usage || "out")}{movement.destination ? ` → ${movement.destination}` : ""}</span>
                  </span>
                </span>
                <span className={inbound ? "text-[#0a715b]" : "text-[#b42318]"}>{inbound ? "+" : "−"}{formatQty(Number(movement.quantity || 0), item?.unit || "")}</span>
              </div>
            );
          }} /> : <EmptyState text="No stock movements yet. Add or use stock above to build the ledger." />}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function AccountsView({ data, addSale, addExpense, deleteRecord, focusPlotId }: { data: FarmOsData; addSale: (event: FormEvent<HTMLFormElement>) => void; addExpense: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string }) {
  const [showSale, setShowSale] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const inTotal = moneyIn(data);
  const outTotal = moneyOut(data);
  const net = netCashflow(data);
  const breakdown = accountBreakdown(data);
  const plansWithActuals = data.plantingPlans
    .map((plan) => ({ plan, actuals: planActuals(data, plan.id) }))
    .filter(({ plan, actuals }) => actuals.cost > 0 || actuals.revenue > 0 || (plan.plannedInputs || []).length);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Sales & Accounts">
        Record what you sell here, and see the farm account book: real money in (sales received) versus real money out (stock purchases, labour and other expenses). This tells you whether the farm is making or losing money so far — separate from the forecasts on the planner.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={Coins} label="Money in" value={naira.format(inTotal)} hint="Sales received so far" tone="green" />
        <DashboardCard icon={WalletCards} label="Money out" value={naira.format(outTotal)} hint="Purchases + labour + expenses" />
        <DashboardCard icon={BarChart3} label="Net so far" value={naira.format(net)} hint={net >= 0 ? "Surplus" : "Loss — spending exceeds income"} tone={net >= 0 ? "green" : "danger"} />
        <DashboardCard icon={AlertTriangle} label="Owed to you" value={naira.format(receivables(data))} hint="Unpaid sales balances" tone={receivables(data) ? "warning" : "green"} />
      </section>

      <div className="dt-panel p-5">
        <SectionHeader eyebrow="Account book" title="Where the money went" />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Info label="Stock purchases" value={naira.format(breakdown.inventoryPurchases)} />
          <Info label="Labour & salary paid" value={naira.format(breakdown.labor)} />
          <Info label="Other expenses" value={naira.format(breakdown.otherExpenses)} />
          <Info label="Total sales value" value={naira.format(data.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0))} />
          <Info label="Received" value={naira.format(inTotal)} />
          <Info label="Still owed to farm" value={naira.format(receivables(data))} />
        </div>
      </div>

      <section className="grid gap-3.5 sm:gap-5 2xl:grid-cols-2">
        <AddSection label="Record a sale" open={showSale} onToggle={() => setShowSale((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addSale(e); setShowSale(false); }}>
          <SectionHeader eyebrow="Sales" title="Record a sale" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Crop"><CropNameInput data={data} name="cropName" placeholder="Select/type crop" required /></Field>
            <Field label="Planting plan"><PlantingPlanSelect data={data} name="plantingPlanId" /></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Buyer"><input className={inputClass} name="buyer" placeholder="Market / off-taker" /></Field>
            <Field label="Quantity"><input className={inputClass} inputMode="decimal" name="quantity" placeholder="500" required /></Field>
            <Field label="Unit"><DataListInput name="unit" options={["kg", "ton", "crate", "bag", "basket", "piece", "bunch"]} placeholder="kg" required /></Field>
            <Field label="Unit price (₦)"><input className={inputClass} inputMode="decimal" name="unitPrice" placeholder="850" required /></Field>
            <Field label="Amount received (₦)"><input className={inputClass} inputMode="decimal" name="amountReceived" placeholder="Blank = paid in full" /></Field>
            <Field label="Date"><input className={inputClass} name="date" type="date" /></Field>
          </div>
          <Field label="Notes"><input className={inputClass} name="notes" placeholder="Payment terms, grade, vehicle..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Record sale</button>
        </form>
        </AddSection>

        <AddSection label="Add an expense" open={showExpense} onToggle={() => setShowExpense((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addExpense(e); setShowExpense(false); }}>
          <SectionHeader eyebrow="Other expenses" title="Add a non-stock expense" />
          <p className="text-sm font-bold leading-6 text-[#667085]">Use this for costs that are not inventory items — labour, transport, fuel, packaging, equipment rental, etc. Buying seeds, fertilizer or chemicals goes through Inventory → Add stock instead.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Category"><SelectOptions name="category" values={["labor", "irrigation", "transport", "packaging", "equipment_rental", "fuel", "miscellaneous"]} /></Field>
            <Field label="Item / description"><input className={inputClass} name="itemName" placeholder="Diesel for pump" required /></Field>
            <Field label="Planting plan"><PlantingPlanSelect data={data} name="plantingPlanId" /></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Quantity"><input className={inputClass} inputMode="decimal" name="quantity" placeholder="1" /></Field>
            <Field label="Unit"><DataListInput name="unit" options={["worker-day", "trip", "litre", "unit", "bag"]} placeholder="trip" /></Field>
            <Field label="Unit cost (₦)"><input className={inputClass} inputMode="decimal" name="unitCost" placeholder="10000" /></Field>
            <Field label="Total cost (₦)"><input className={inputClass} inputMode="decimal" name="totalCost" placeholder="Auto if blank" /></Field>
            <Field label="Date"><input className={inputClass} name="date" type="date" /></Field>
            <Field label="Supplier"><DataListInput name="supplier" options={commonSupplierOptions} placeholder="Supplier / vendor" /></Field>
          </div>
          <Field label="Purpose"><input className={inputClass} name="purpose" placeholder="What it was for" /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Add expense</button>
        </form>
        </AddSection>
      </section>

      <section className="grid gap-3.5 sm:gap-5 2xl:grid-cols-2">
        <CollapsibleSection eyebrow="Sales" title="Sales records" defaultOpen badge={<Pill tone="navy">{data.sales.length}</Pill>}>
          <div className="grid gap-3">
            {data.sales.length ? <ShowMoreList items={data.sales} initial={5} noun="sales" render={(sale) => (
              <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={sale.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <strong>{sale.cropName}</strong>
                    <p className="text-sm font-bold text-[#667085]">{sale.date} · {formatQty(sale.quantity, sale.unit)} × {naira.format(sale.unitPrice)} = {naira.format(sale.total)}{sale.buyer ? ` · ${sale.buyer}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={sale.paymentStatus === "paid" ? "green" : sale.paymentStatus === "part" ? "warning" : "danger"}>{labelize(sale.paymentStatus)}</Pill>
                    <DeleteButton label="Delete sale" onDelete={() => deleteRecord("sales", sale.id, `Sale of ${sale.cropName} deleted.`)} />
                  </div>
                </div>
              </article>
            )} /> : <EmptyState text="No sales yet. Record your harvest sales here to track real income." />}
          </div>
        </CollapsibleSection>
        <CollapsibleSection eyebrow="Expenses" title="Other expense records" defaultOpen badge={<Pill tone="navy">{data.inputCosts.length}</Pill>}>
          <div className="grid gap-3">
            {data.inputCosts.length ? <ShowMoreList items={data.inputCosts} initial={5} noun="expenses" render={(input) => (
              <article className="rounded-xl border border-[#edf1e7] bg-white p-4" key={input.id}>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div><strong>{input.itemName}</strong><p className="text-sm font-bold text-[#667085]">{labelize(input.category)} · {getPlotName(data, input.plotId)} · {naira.format(input.totalCost)}</p></div>
                  <DeleteButton label="Delete expense" onDelete={() => deleteRecord("inputCosts", input.id, `${input.itemName} expense deleted.`)} />
                </div>
              </article>
            )} /> : <EmptyState text="No other expenses yet. Add labour, transport, fuel and packaging costs as they happen." />}
          </div>
        </CollapsibleSection>
      </section>

      <div className="dt-panel p-5">
        <SectionHeader eyebrow="Per crop" title="Actual profit vs forecast" />
        {plansWithActuals.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-xs font-black uppercase text-[#667085]"><th className="py-2">Crop / plot</th><th>Actual cost</th><th>Actual revenue</th><th>Actual profit</th><th>Forecast profit</th></tr></thead>
              <tbody>
                {plansWithActuals.map(({ plan, actuals }) => (
                  <tr className="border-t border-[#edf1e7] font-bold" key={plan.id}>
                    <td className="py-2">{plan.cropName} · {getPlotName(data, plan.plotId)}</td>
                    <td>{naira.format(actuals.cost)}</td>
                    <td>{naira.format(actuals.revenue)}</td>
                    <td className={actuals.profit >= 0 ? "text-[#0a715b]" : "text-[#b42318]"}>{naira.format(actuals.profit)}</td>
                    <td className="text-[#667085]">{naira.format(expectedProfit(plan))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState text="No plan actuals yet. Once you draw inputs for a plan and record its sales, real profit per crop shows here next to the forecast." />}
      </div>
    </div>
  );
}

function TasksView({ data, addTask, updateTaskStatus, deleteRecord, focusPlotId }: { data: FarmOsData; addTask: (event: FormEvent<HTMLFormElement>) => void; updateTaskStatus: (taskId: string, status: FarmTask["status"]) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const dueToday = data.tasks.filter((task) => task.dueDate === "2026-06-17" && task.status !== "completed").length;
  const overdue = data.tasks.filter((task) => task.dueDate < "2026-06-17" && task.status !== "completed").length;
  // Open/active tasks first (earliest due first), finished ones last.
  const isDone = (t: FarmTask) => t.status === "completed" || t.status === "cancelled";
  const tasksSorted = [...data.tasks].sort((a, b) => {
    if (isDone(a) !== isDone(b)) return isDone(a) ? 1 : -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Task assignment">
        Create the daily and weekly work list here. Assign clearing, watering, spraying, fertiliser, harvesting, transport or inspection work to a worker, then update the status as the job moves from pending to completed.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={ClipboardList} label="Total tasks" value={data.tasks.length} hint="Assigned farm operations tasks" />
        <DashboardCard icon={CalendarDays} label="Due today" value={dueToday} hint="Needs action today" tone={dueToday ? "warning" : "green"} />
        <DashboardCard icon={AlertTriangle} label="Overdue" value={overdue} hint="Past due and not complete" tone={overdue ? "danger" : "green"} />
        <DashboardCard icon={Users} label="Assigned workers" value={new Set(data.tasks.map((task) => task.assignedWorkerId).filter(Boolean)).size} hint="Workers with active task links" />
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <AddSection label="Assign a task" open={showAdd} onToggle={() => setShowAdd((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addTask(e); setShowAdd(false); }}>
          <SectionHeader eyebrow="Task assignment" title="Assign farm task" />
          <Field label="Task title"><input className={inputClass} name="taskTitle" placeholder="Clear Acre B" required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Task type"><SelectOptions name="taskType" values={["clearing", "nursery_work", "planting", "transplanting", "watering", "fertilizer", "spraying", "weeding", "harvesting", "packing", "transport", "irrigation_repair", "inspection", "market_survey", "other"]} /></Field>
            <Field label="Crop"><CropNameInput data={data} name="cropName" placeholder="Select/type crop" /></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Assigned worker"><WorkerSelect data={data} name="assignedWorkerId" /></Field>
            <Field label="Due date"><input className={inputClass} name="dueDate" type="date" required /></Field>
            <Field label="Priority"><SelectOptions name="priority" values={["low", "medium", "high", "urgent"]} defaultValue="medium" /></Field>
            <Field label="Estimated cost"><input className={inputClass} inputMode="decimal" name="estimatedCost" placeholder="0" /></Field>
          </div>
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="Instructions, safety note, output expected..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Assign task</button>
        </form>
        </AddSection>

        <div className="grid gap-3">
          {data.tasks.length ? <ShowMoreList items={tasksSorted} initial={6} noun="tasks" render={(task) => (
            <ExpandableCard
              key={task.id}
              badges={<><Pill tone={statusTone(task.priority)}>{labelize(task.priority)}</Pill><Pill tone={statusTone(task.status)}>{labelize(task.status)}</Pill></>}
              summary={(
                <>
                  <p className="text-xs font-black uppercase text-[#0f8b6f]">{labelize(task.taskType)} · {task.dueDate}</p>
                  <h3 className="text-base font-black leading-tight text-[#14213d] sm:text-lg">{task.taskTitle}</h3>
                  <p className="mt-0.5 text-xs text-[#667085]">{task.cropName || "General"} · {getPlotName(data, task.plotId)} · {getWorkerName(data, task.assignedWorkerId)}</p>
                </>
              )}
            >
              <p className="text-sm leading-6 text-[#4b5a76]">{task.notes || "No notes."}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => updateTaskStatus(task.id, "pending")} type="button">Pending</button>
                <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => updateTaskStatus(task.id, "in_progress")} type="button">In progress</button>
                <button className="rounded-lg border border-[#d8dece] bg-white px-3 py-2 text-sm font-black" onClick={() => updateTaskStatus(task.id, "completed")} type="button">Complete</button>
                <button className="rounded-lg border border-[#fecdca] bg-[#fff4f2] px-3 py-2 text-sm font-black text-[#b42318]" onClick={() => updateTaskStatus(task.id, "cancelled")} type="button">Cancel</button>
                <DeleteButton label="Delete task" onDelete={() => deleteRecord("tasks", task.id, `${task.taskTitle} deleted.`)} />
              </div>
            </ExpandableCard>
          )} /> : <EmptyState text="No tasks yet. Add work items such as clearing, planting, watering, spraying, harvesting or transport." />}
        </div>
      </section>
    </div>
  );
}

function WorkersView({
  data,
  addWorker,
  updateWorker,
  addLaborPayment,
  deleteRecord,
  toggleWorkerMonthPaid
}: {
  data: FarmOsData;
  addWorker: (event: FormEvent<HTMLFormElement>) => void;
  updateWorker: (event: FormEvent<HTMLFormElement>) => void;
  addLaborPayment: (event: FormEvent<HTMLFormElement>) => void;
  deleteRecord: DeleteRecordFn;
  toggleWorkerMonthPaid: (workerId: string, monthKey: string) => void;
}) {
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const activeWorkers = data.workers.filter((worker) => worker.status === "active");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#14213d]">Your workers</h2>
          <p className="text-sm font-bold text-[#667085]">{activeWorkers.length} active · {data.workers.length} total · tick each month when paid</p>
        </div>
        <button className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" onClick={() => setShowAdd((s) => !s)} type="button">
          {showAdd ? <X size={16} /> : <Plus size={16} />} {showAdd ? "Close" : "Add worker"}
        </button>
      </div>

      {showAdd ? (
        <form
          className="dt-panel grid gap-3 p-4"
          onSubmit={(event) => {
            addWorker(event);
            setShowAdd(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputClass} name="name" placeholder="Worker name" required /></Field>
            <Field label="Phone"><input className={inputClass} name="phoneNumber" placeholder="Phone number" /></Field>
            <Field label="Role"><input className={inputClass} name="role" placeholder="Field lead / Labourer" /></Field>
            <Field label="Pay type"><SelectOptions name="employmentType" values={["monthly_worker", "daily_worker", "weekly_worker", "contractor"]} /></Field>
            <Field label="Salary / rate (₦)"><input className={inputClass} inputMode="decimal" name="salaryOrDailyRate" placeholder="50000" /></Field>
            <Field label="Feeding / allowance (₦/month)"><input className={inputClass} inputMode="decimal" name="monthlyFeedingCost" placeholder="e.g. 15000" /></Field>
            <Field label="Start date"><input className={inputClass} name="startDate" type="date" /></Field>
          </div>
          <details className="rounded-lg border border-[#edf1e7] bg-[#fbfaf5] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#4b5a76]">More details (optional)</summary>
            <div className="mt-3 grid gap-3">
              <Field label="Skills"><input className={inputClass} name="skills" placeholder="Clearing, Spraying, Harvesting" /></Field>
              <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="Reliability, strengths, payment arrangement..." /></Field>
            </div>
          </details>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit"><Plus className="inline" size={16} /> Save worker</button>
        </form>
      ) : null}

      <section className="grid gap-3">
        <div className="grid gap-3">
          {data.workers.length ? <ShowMoreList items={data.workers} initial={6} noun="workers" render={(worker) => {
            const tasks = data.tasks.filter((task) => task.assignedWorkerId === worker.id);
            const payments = data.laborPayments.filter((payment) => payment.workerId === worker.id);
            const salaryRuns = (data.salaryRuns || []).filter((salary) => salary.workerId === worker.id);
            const balance = payments.reduce((sum, payment) => sum + calculateLaborBalance(payment), 0) + salaryRuns.reduce((sum, salary) => sum + calculateSalaryBalance(salary), 0);
            const isEditing = editingWorkerId === worker.id;
            return (
              <ExpandableCard
                key={worker.id}
                badges={<>{balance > 0 ? <Pill tone="warning">owed {naira.format(balance)}</Pill> : null}<Pill tone={statusTone(worker.status)}>{labelize(worker.status)}</Pill></>}
                summary={(
                  <>
                    <h3 className="truncate text-base font-black text-[#14213d] sm:text-lg">{worker.name}</h3>
                    <p className="text-xs text-[#667085] sm:text-sm">{labelize(worker.employmentType)} · {worker.role || "Farm worker"}</p>
                    <p className="text-xs text-[#667085] sm:text-sm">{naira.format(Number(worker.salaryOrDailyRate || 0))}{worker.employmentType === "monthly_worker" ? "/mo" : ""}{Number(worker.monthlyFeedingCost || 0) > 0 ? ` · feeding ${naira.format(Number(worker.monthlyFeedingCost))}/mo` : ""}{tasks.length ? ` · ${tasks.length} task(s)` : ""}</p>
                  </>
                )}
              >
                {Number(worker.salaryOrDailyRate || 0) > 0 ? (
                  <MonthlyPayGrid worker={worker} onToggle={(monthKey) => toggleWorkerMonthPaid(worker.id, monthKey)} />
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-sm font-black text-[#14213d]" onClick={() => setEditingWorkerId(isEditing ? null : worker.id)} type="button">
                    <Pencil size={14} /> {isEditing ? "Close" : "Edit"}
                  </button>
                  <DeleteButton label="Delete" onDelete={() => deleteRecord("workers", worker.id, `${worker.name} deleted from worker register.`)} />
                  {tasks.length ? <span className="inline-flex min-h-9 items-center rounded-lg bg-[#f1fbf7] px-3 text-sm font-black text-[#0a715b]">{tasks.length} task(s)</span> : null}
                </div>

                {isEditing ? (
                  <form className="mt-5 grid gap-4 rounded-xl border border-[#d8dece] bg-[#fbfaf5] p-4" onSubmit={updateWorker}>
                    <input name="workerId" type="hidden" value={worker.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name"><input className={inputClass} defaultValue={worker.name} name="name" required /></Field>
                      <Field label="Phone"><input className={inputClass} defaultValue={worker.phoneNumber || ""} name="phoneNumber" /></Field>
                      <Field label="Role"><input className={inputClass} defaultValue={worker.role || ""} name="role" /></Field>
                      <Field label="Employment type"><SelectOptions name="employmentType" values={["daily_worker", "weekly_worker", "monthly_worker", "contractor"]} defaultValue={worker.employmentType} /></Field>
                      <Field label="Salary / rate"><input className={inputClass} defaultValue={Number(worker.salaryOrDailyRate || 0)} inputMode="decimal" name="salaryOrDailyRate" /></Field>
                      <Field label="Feeding / allowance (₦/month)"><input className={inputClass} defaultValue={Number(worker.monthlyFeedingCost || 0)} inputMode="decimal" name="monthlyFeedingCost" /></Field>
                      <Field label="Start date"><input className={inputClass} defaultValue={worker.startDate || ""} name="startDate" type="date" /></Field>
                      <Field label="Status"><SelectOptions name="status" values={["active", "inactive", "suspended", "left"]} defaultValue={worker.status} /></Field>
                      <Field label="Skills"><input className={inputClass} defaultValue={worker.skills.join(", ")} name="skills" /></Field>
                    </div>
                    <Field label="Notes"><textarea className={textareaClass} defaultValue={worker.notes || ""} name="notes" /></Field>
                    <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Save worker changes</button>
                  </form>
                ) : null}
              </ExpandableCard>
            );
          }} /> : <EmptyState text="No workers yet. Tap “Add worker” to register your first employee or labourer." />}
        </div>

        {data.workers.length ? (
          <details className="dt-panel p-4">
            <summary className="cursor-pointer text-sm font-black text-[#14213d]">Record a one-off payment (advance, bonus, casual labour)</summary>
            <form className="mt-3 grid gap-3" onSubmit={addLaborPayment}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Worker"><WorkerSelect data={data} name="workerId" /></Field>
                <Field label="What for"><input className={inputClass} name="payPeriod" placeholder="e.g. June salary / advance" /></Field>
                <Field label="Amount due"><input className={inputClass} inputMode="decimal" name="amountDue" placeholder="50000" /></Field>
                <Field label="Amount paid"><input className={inputClass} inputMode="decimal" name="amountPaid" placeholder="50000" /></Field>
                <Field label="Date"><input className={inputClass} name="paymentDate" type="date" /></Field>
                <Field label="Method"><SelectOptions name="paymentMethod" values={["cash", "bank_transfer", "mobile_money", "other"]} /></Field>
              </div>
              <button className="min-h-11 rounded-lg bg-[#14213d] px-4 text-sm font-black text-white" type="submit">Record payment</button>
            </form>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function MonthlyPayGrid({ worker, onToggle }: { worker: FarmWorker; onToggle: (monthKey: string) => void }) {
  const now = new Date();
  const months = salaryMonthKeys(worker.startDate, now);
  const paid = new Set(worker.monthsPaid || []);
  const currentKey = ymKey(now);
  return (
    <div className="mt-3 rounded-xl border border-[#edf1e7] bg-[#fbfaf5] p-3">
      <p className="text-xs font-black uppercase tracking-wide text-[#667085]">Monthly salary — tick when paid</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {months.map((key) => {
          const isPaid = paid.has(key);
          const overdue = !isPaid && salaryMonthOverdue(key, worker.monthsPaid, now);
          const isCurrent = key === currentKey;
          const tone = isPaid ? "border-[#0f8b6f] bg-[#0f8b6f] text-white" : overdue ? "border-[#fda29b] bg-[#fff4f2] text-[#b42318]" : "border-[#d8dece] bg-white text-[#4b5a76]";
          return (
            <button
              className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-3 text-xs font-black ${tone}`}
              key={key}
              onClick={() => onToggle(key)}
              title={overdue ? "Overdue — pay due on the 1st of the next month" : isPaid ? "Paid — tap to undo" : "Tap when paid"}
              type="button"
            >
              {isPaid ? <Check size={13} /> : overdue ? <AlertTriangle size={13} /> : null}
              {ymLabel(key)}{isCurrent ? " (now)" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SalaryView({
  data,
  addAttendanceRecord,
  addSalaryAdjustment,
  addSalaryRun,
  updateSalaryRunStatus,
  deleteRecord
}: {
  data: FarmOsData;
  addAttendanceRecord: (event: FormEvent<HTMLFormElement>) => void;
  addSalaryAdjustment: (event: FormEvent<HTMLFormElement>) => void;
  addSalaryRun: (event: FormEvent<HTMLFormElement>) => void;
  updateSalaryRunStatus: (salaryRunId: string, status: SalaryRun["status"]) => void;
  deleteRecord: DeleteRecordFn;
}) {
  const salaryRuns = data.salaryRuns || [];
  const attendanceRecords = data.attendanceRecords || [];
  const adjustments = data.salaryAdjustments || [];
  const grossPay = salaryRuns.reduce((sum, salary) => sum + Number(salary.grossPay || 0), 0);
  const netPay = salaryRuns.reduce((sum, salary) => sum + Number(salary.netPay || 0), 0);
  const paid = salaryRuns.reduce((sum, salary) => sum + Number(salary.amountPaid || 0), 0);
  const balance = salaryRuns.reduce((sum, salary) => sum + calculateSalaryBalance(salary), 0);
  const attendanceDays = attendanceRecords.reduce((sum, record) => sum + Number(record.daysWorked || 0), 0);
  const advances = adjustments.filter((adjustment) => adjustment.adjustmentType === "advance" && adjustment.status !== "cancelled").reduce((sum, adjustment) => sum + Number(adjustment.amount || 0), 0);
  const [showAtt, setShowAtt] = useState(false);
  const [showAdj, setShowAdj] = useState(false);
  const [showRun, setShowRun] = useState(false);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Salary and payroll">
        Use this page to log attendance, add advances or deductions, and generate salary runs. The salary calculation uses the worker rate, days or units worked, bonuses, deductions, amount paid and balance.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={WalletCards} label="Salary net pay" value={naira.format(netPay)} hint="Total net pay from salary runs" />
        <DashboardCard icon={Coins} label="Paid" value={naira.format(paid)} hint="Amount already paid" />
        <DashboardCard icon={AlertTriangle} label="Salary balance" value={naira.format(balance)} hint="Net pay minus amount paid" tone={balance > 0 ? "warning" : "green"} />
        <DashboardCard icon={CalendarDays} label="Attendance days" value={numberFormat.format(attendanceDays)} hint="Days/half-days logged" />
        <DashboardCard icon={Users} label="Payroll workers" value={data.workers.length} hint="Workers available for salary runs" />
        <DashboardCard icon={Activity} label="Adjustments" value={adjustments.length} hint="Bonuses, deductions, advances and transport" />
        <DashboardCard icon={WalletCards} label="Advances" value={naira.format(advances)} hint="Approved advances to recover later" tone={advances ? "warning" : "green"} />
        <DashboardCard icon={Coins} label="Gross pay" value={naira.format(grossPay)} hint="Base rate x units worked" tone="navy" />
      </section>

      <section className="dt-panel p-5">
        <SectionHeader eyebrow="How salary works" title="Novice payroll flow" />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Info label="1. Save worker" value="Workers page" />
          <Info label="2. Log days" value="Attendance form" />
          <Info label="3. Add bonuses/deductions" value="Adjustments" />
          <Info label="4. Generate pay" value="Salary run" />
        </div>
        <p className="mt-4 text-sm leading-6 text-[#4b5a76]">For a daily worker, put their daily rate as the base rate and the number of days worked as units. For a weekly worker, you can either put weekly amount as base rate and units as 1, or daily equivalent and actual days. The system calculates gross pay, net pay, amount paid and balance.</p>
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-3">
        <AddSection label="Log attendance" open={showAtt} onToggle={() => setShowAtt((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addAttendanceRecord(e); setShowAtt(false); }}>
          <SectionHeader eyebrow="Attendance" title="Log days worked" />
          <Field label="Worker"><WorkerSelect data={data} name="workerId" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><input className={inputClass} name="date" type="date" required /></Field>
            <Field label="Status"><SelectOptions name="status" values={["present", "half_day", "absent", "sick", "approved_leave"]} defaultValue="present" /></Field>
            <Field label="Days worked"><input className={inputClass} inputMode="decimal" name="daysWorked" placeholder="1 or 0.5" /></Field>
            <Field label="Hours worked"><input className={inputClass} inputMode="decimal" name="hoursWorked" placeholder="8" /></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" /></Field>
            <Field label="Task"><TaskSelect data={data} name="taskId" /></Field>
          </div>
          <Field label="Work summary"><input className={inputClass} name="workSummary" placeholder="Cleared Acre B / sprayed cucumber" /></Field>
          <Field label="Notes"><textarea className={textareaClass} name="notes" /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Save attendance</button>
        </form>
        </AddSection>

        <AddSection label="Add bonus / deduction / advance" open={showAdj} onToggle={() => setShowAdj((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addSalaryAdjustment(e); setShowAdj(false); }}>
          <SectionHeader eyebrow="Adjustments" title="Bonus, deduction or advance" />
          <Field label="Worker"><WorkerSelect data={data} name="workerId" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><input className={inputClass} name="date" type="date" required /></Field>
            <Field label="Type"><SelectOptions name="adjustmentType" values={["bonus", "deduction", "advance", "loan_repayment", "transport", "feeding", "other"]} /></Field>
            <Field label="Amount"><input className={inputClass} inputMode="decimal" name="amount" placeholder="5000" required /></Field>
            <Field label="Status"><SelectOptions name="status" values={["pending", "approved", "applied", "cancelled"]} defaultValue="approved" /></Field>
          </div>
          <Field label="Reason"><input className={inputClass} name="reason" placeholder="Transport support / salary advance / poor attendance deduction" /></Field>
          <Field label="Notes"><textarea className={textareaClass} name="notes" /></Field>
          <button className="min-h-11 rounded-lg bg-[#14213d] px-4 text-sm font-black text-white" type="submit">Save adjustment</button>
        </form>
        </AddSection>

        <AddSection label="Generate a salary run" open={showRun} onToggle={() => setShowRun((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addSalaryRun(e); setShowRun(false); }}>
          <SectionHeader eyebrow="Salary run" title="Calculate and record pay" />
          <Field label="Worker"><WorkerSelect data={data} name="workerId" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Period start"><input className={inputClass} name="periodStart" type="date" required /></Field>
            <Field label="Period end"><input className={inputClass} name="periodEnd" type="date" required /></Field>
            <Field label="Pay basis"><SelectOptions name="payBasis" values={["daily", "weekly", "monthly", "contract"]} defaultValue="daily" /></Field>
            <Field label="Base rate"><input className={inputClass} inputMode="decimal" name="baseRate" placeholder="12000" /></Field>
            <Field label="Units worked"><input className={inputClass} inputMode="decimal" name="unitsWorked" placeholder="5" required /></Field>
            <Field label="Bonuses"><input className={inputClass} inputMode="decimal" name="bonuses" placeholder="0" /></Field>
            <Field label="Deductions"><input className={inputClass} inputMode="decimal" name="deductions" placeholder="0" /></Field>
            <Field label="Advance recovered"><input className={inputClass} inputMode="decimal" name="advancesRecovered" placeholder="0" /></Field>
            <Field label="Amount paid now"><input className={inputClass} inputMode="decimal" name="amountPaid" placeholder="0" /></Field>
            <Field label="Payment date"><input className={inputClass} name="paymentDate" type="date" /></Field>
            <Field label="Method"><SelectOptions name="paymentMethod" values={["cash", "bank_transfer", "mobile_money", "other"]} /></Field>
          </div>
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="What this payment covers, any balance agreement..." /></Field>
          <button className="min-h-11 rounded-lg bg-[#d99a28] px-4 text-sm font-black text-[#14213d]" type="submit">Create salary run</button>
        </form>
        </AddSection>
      </section>

      <section className="grid gap-5 2xl:grid-cols-2">
        <RecordTable
          title="Salary runs"
          headers={["Worker", "Period", "Basis", "Gross", "Net", "Paid", "Balance", "Status / Action"]}
          rows={salaryRuns.map((salary) => [
            getWorkerName(data, salary.workerId),
            `${salary.periodStart} to ${salary.periodEnd}`,
            labelize(salary.payBasis),
            naira.format(salary.grossPay),
            naira.format(salary.netPay),
            naira.format(salary.amountPaid),
            naira.format(calculateSalaryBalance(salary)),
            <div className="flex flex-wrap gap-2" key={salary.id}>
              <Pill tone={statusTone(salary.status)}>{labelize(salary.status)}</Pill>
              <button className="rounded-lg border border-[#d8dece] px-2 py-1 text-xs font-black" onClick={() => updateSalaryRunStatus(salary.id, "paid")} type="button">Mark paid</button>
              <DeleteButton label="Delete" onDelete={() => deleteRecord("salaryRuns", salary.id, "Salary run deleted.")} />
            </div>
          ])}
        />
        <RecordTable
          title="Attendance register"
          headers={["Worker", "Date", "Status", "Days", "Plot", "Task", "Summary", "Action"]}
          rows={attendanceRecords.map((record) => [getWorkerName(data, record.workerId), record.date, labelize(record.status), record.daysWorked || 0, getPlotName(data, record.plotId), data.tasks.find((task) => task.id === record.taskId)?.taskTitle || "-", record.workSummary || "-", <span key={record.id}><DeleteButton label="Delete" onDelete={() => deleteRecord("attendanceRecords", record.id, "Attendance record deleted.")} /></span>])}
        />
        <RecordTable
          title="Adjustments and advances"
          headers={["Worker", "Date", "Type", "Amount", "Status", "Reason", "Action"]}
          rows={adjustments.map((adjustment) => [getWorkerName(data, adjustment.workerId), adjustment.date, labelize(adjustment.adjustmentType), naira.format(adjustment.amount), labelize(adjustment.status), adjustment.reason || "-", <span key={adjustment.id}><DeleteButton label="Delete" onDelete={() => deleteRecord("salaryAdjustments", adjustment.id, "Salary adjustment deleted.")} /></span>])}
        />
        <RecordTable
          title="Worker salary position"
          headers={["Worker", "Rate", "Attendance days", "Salary net", "Paid", "Balance"]}
          rows={data.workers.map((worker) => {
            const workerRuns = salaryRuns.filter((salary) => salary.workerId === worker.id);
            const workerAttendance = attendanceRecords.filter((record) => record.workerId === worker.id).reduce((sum, record) => sum + Number(record.daysWorked || 0), 0);
            return [
              worker.name,
              naira.format(Number(worker.salaryOrDailyRate || 0)),
              numberFormat.format(workerAttendance),
              naira.format(workerRuns.reduce((sum, salary) => sum + Number(salary.netPay || 0), 0)),
              naira.format(workerRuns.reduce((sum, salary) => sum + Number(salary.amountPaid || 0), 0)),
              naira.format(workerRuns.reduce((sum, salary) => sum + calculateSalaryBalance(salary), 0))
            ];
          })}
        />
      </section>
    </div>
  );
}

function MarketView({ data, addMarketPrice, deleteRecord }: { data: FarmOsData; addMarketPrice: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn }) {
  const [showAdd, setShowAdd] = useState(false);
  const latestByCrop = data.marketPrices.reduce<Record<string, MarketPriceRecord>>((acc, price) => {
    if (!acc[price.cropName] || acc[price.cropName].dateChecked < price.dateChecked) acc[price.cropName] = price;
    return acc;
  }, {});
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Market price tracking">
        Enter the crop prices you personally checked in each market. These prices can guide expected revenue, best-case/worst-case thinking and later AI advice. Delete old or unreliable price checks when they are no longer useful.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={Gauge} label="Price records" value={data.marketPrices.length} hint="Manual market checks" />
        <DashboardCard icon={Search} label="Crops priced" value={Object.keys(latestByCrop).length} hint="Latest price per crop" />
        <DashboardCard icon={Coins} label="Highest price" value={naira.format(Math.max(0, ...data.marketPrices.map((price) => price.price)))} hint="Highest current market unit price" />
        <DashboardCard icon={CalendarDays} label="Latest check" value={data.marketPrices.map((price) => price.dateChecked).sort().at(-1) || "None"} hint="Last market price update" />
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <AddSection label="Add a price check" open={showAdd} onToggle={() => setShowAdd((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addMarketPrice(e); setShowAdd(false); }}>
          <SectionHeader eyebrow="Market price" title="Add price check" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Crop"><CropNameInput data={data} name="cropName" placeholder="Select/type crop" required /></Field>
            <Field label="Market"><input className={inputClass} name="market" placeholder="Ibadan wholesale" /></Field>
            <Field label="Unit"><SelectOptions name="unit" values={marketUnits} /></Field>
            <Field label="Price"><input className={inputClass} inputMode="decimal" name="price" placeholder="850" required /></Field>
            <Field label="Date checked"><input className={inputClass} name="dateChecked" type="date" required /></Field>
            <Field label="Confidence"><SelectOptions name="confidence" values={["low", "medium", "high"]} defaultValue="medium" /></Field>
          </div>
          <Field label="Source"><input className={inputClass} name="source" placeholder="Buyer call / market visit" /></Field>
          <Field label="Notes"><textarea className={textareaClass} name="notes" /></Field>
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Add market price</button>
        </form>
        </AddSection>
        <RecordTable title="Market price records" headers={["Crop", "Market", "Unit", "Price", "Date", "Confidence", "Action"]} rows={data.marketPrices.map((price) => [price.cropName, price.market || "-", price.unit, naira.format(price.price), price.dateChecked, labelize(price.confidence), <span key={price.id}><DeleteButton label="Delete" onDelete={() => deleteRecord("marketPrices", price.id, `${price.cropName} market price deleted.`)} /></span>])} />
      </section>
    </div>
  );
}

function ForecastView({ data, deleteRecord }: { data: FarmOsData; deleteRecord: DeleteRecordFn }) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Yield forecast">
        Review expected yield, expected marketable yield and revenue for each planting plan. Forecasts become more useful after you enter crop plans, market prices, observations and real input costs.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={BarChart3} label="Yield forecasts" value={data.yieldForecasts.length || data.plantingPlans.length} hint="Forecasts plus plans" />
        <DashboardCard icon={Package} label="Expected yield" value={numberFormat.format(data.plantingPlans.reduce((sum, plan) => sum + Number(plan.expectedTotalYield || 0), 0))} hint="Total expected units from plans" />
        <DashboardCard icon={Coins} label="Best case revenue" value={naira.format(data.yieldForecasts.reduce((sum, forecast) => sum + Number(forecast.bestCaseRevenue || 0), 0))} hint="Forecast best-case rows" tone="gold" />
        <DashboardCard icon={AlertTriangle} label="Worst case revenue" value={naira.format(data.yieldForecasts.reduce((sum, forecast) => sum + Number(forecast.worstCaseRevenue || 0), 0))} hint="Forecast worst-case rows" tone="warning" />
      </section>

      <section className="grid gap-4">
        {data.plantingPlans.length ? <ShowMoreList items={data.plantingPlans} initial={5} noun="forecasts" render={(plan) => {
          const forecast = data.yieldForecasts.find((item) => item.plantingPlanId === plan.id);
          const impact = observationImpact(data.observations, plan.id);
          const expectedTotalYield = Number(forecast?.expectedTotalYield || plan.expectedTotalYield || 0);
          const loss = Number(forecast?.expectedLossPercentage || 0);
          const marketableYield = Number(forecast?.expectedMarketableYield || expectedTotalYield * (1 - loss / 100));
          const adjustedYield = Math.max(0, marketableYield * (1 + Number(impact.yieldImpact || 0) / 100));
          const price = Number(forecast?.marketPrice || plan.expectedMarketPrice || 0);
          const revenue = adjustedYield * price;
          const cost = planCost(plan) + Number(impact.costImpact || 0);
          return (
            <article className="dt-panel p-5" key={plan.id}>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div><p className="text-xs font-black uppercase text-[#0f8b6f]">{getPlotName(data, plan.plotId)}</p><h3 className="text-xl font-black">{plan.cropName} forecast</h3></div>
                <Pill tone={revenue - cost < 0 ? "danger" : "green"}>{naira.format(revenue - cost)} expected profit</Pill>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Info label="Expected yield" value={numberFormat.format(expectedTotalYield)} />
                <Info label="Marketable yield" value={numberFormat.format(marketableYield)} />
                <Info label="Observation yield impact" value={`${impact.yieldImpact}%`} />
                <Info label="Adjusted revenue" value={naira.format(revenue)} />
                <Info label="Plan cost" value={naira.format(planCost(plan))} />
                <Info label="Observation cost impact" value={naira.format(impact.costImpact)} />
                <Info label="Best case" value={naira.format(forecast?.bestCaseRevenue || revenue * 1.15)} />
                <Info label="Worst case" value={naira.format(forecast?.worstCaseRevenue || revenue * 0.75)} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm leading-6 text-[#4b5a76]">{forecast?.notes || "Forecast generated from current planting plan. Add observations to adjust yield/cost assumptions."}</p>
                {forecast ? <DeleteButton label="Delete forecast" onDelete={() => deleteRecord("yieldForecasts", forecast.id, "Yield forecast deleted.")} /> : null}
              </div>
            </article>
          );
        }} /> : <EmptyState text="No yield forecast yet. Create a planting plan first, then this page will calculate expected yield, revenue and profit." />}
      </section>
    </div>
  );
}

function ObservationsView({ data, addObservation, deleteRecord, focusPlotId }: { data: FarmOsData; addObservation: (event: FormEvent<HTMLFormElement>) => void; deleteRecord: DeleteRecordFn; focusPlotId?: string }) {
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Observations and adjustments">
        Record what happens on the farm during the crop cycle: pest attack, disease, poor germination, flooding, dry spell, theft, labour delay or market price change. Add yield or cost impact so forecasts can be adjusted.
      </PageIntro>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={AlertTriangle} label="Observations" value={data.observations.length} hint="Pests, disease, delays, rainfall, theft/loss" />
        <DashboardCard icon={Gauge} label="High severity" value={data.observations.filter((obs) => obs.severity === "high" || obs.severity === "critical").length} hint="Needs fast action" tone="danger" />
        <DashboardCard icon={BarChart3} label="Yield impact" value={`${data.observations.reduce((sum, obs) => sum + Number(obs.expectedYieldImpact || 0), 0)}%`} hint="Combined expected percentage impact" tone="warning" />
        <DashboardCard icon={Coins} label="Cost impact" value={naira.format(data.observations.reduce((sum, obs) => sum + Number(obs.expectedCostImpact || 0), 0))} hint="Added cost from observations" />
      </section>

      <section className="grid gap-3.5 sm:gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <AddSection label="Add an observation" open={showAdd} onToggle={() => setShowAdd((s) => !s)}>
        <form className="dt-panel grid gap-4 p-5" onSubmit={(e) => { addObservation(e); setShowAdd(false); }}>
          <SectionHeader eyebrow="Field observations" title="Add observation" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Observation type"><SelectOptions name="observationType" values={["pest_attack", "disease", "poor_germination", "heavy_rainfall", "dry_spell", "flooding", "fertilizer_delay", "labor_delay", "market_price_change", "theft_loss", "plant_stress", "other"]} /></Field>
            <Field label="Planting plan"><PlantingPlanSelect data={data} name="plantingPlanId" /></Field>
            <Field label="Plot"><PlotSelect data={data} name="plotId" defaultPlotId={focusPlotId} /></Field>
            <Field label="Crop"><CropNameInput data={data} name="cropName" placeholder="Select/type crop" /></Field>
            <Field label="Severity"><SelectOptions name="severity" values={["low", "medium", "high", "critical"]} defaultValue="medium" /></Field>
            <Field label="Date"><input className={inputClass} name="date" type="date" required /></Field>
            <Field label="Yield impact %"><input className={inputClass} inputMode="decimal" name="expectedYieldImpact" placeholder="-10" /></Field>
            <Field label="Cost impact"><input className={inputClass} inputMode="decimal" name="expectedCostImpact" placeholder="35000" /></Field>
          </div>
          <Field label="Affected area"><input className={inputClass} name="affectedArea" placeholder="Rows near border / nursery tray 4" /></Field>
          <Field label="Notes"><textarea className={textareaClass} name="notes" placeholder="What happened, likely cause, action needed..." /></Field>
          <PhotoInput name="photoDataUrl" label="Photo of the issue (optional)" />
          <button className="min-h-11 rounded-lg bg-[#0f8b6f] px-4 text-sm font-black text-white" type="submit">Record observation</button>
        </form>
        </AddSection>

        <div className="grid gap-3">
          {data.observations.length ? <ShowMoreList items={data.observations} initial={5} noun="observations" render={(obs) => (
            <ExpandableCard
              key={obs.id}
              badges={<Pill tone={statusTone(obs.severity)}>{labelize(obs.severity)}</Pill>}
              summary={(
                <>
                  <p className="text-xs font-black uppercase text-[#0f8b6f]">{obs.date} · {getPlotName(data, obs.plotId)}</p>
                  <h3 className="text-base font-black leading-tight text-[#14213d] sm:text-lg">{labelize(obs.observationType)} {obs.cropName ? `- ${obs.cropName}` : ""}</h3>
                </>
              )}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Yield impact" value={`${obs.expectedYieldImpact || 0}%`} />
                <Info label="Cost impact" value={naira.format(Number(obs.expectedCostImpact || 0))} />
                <Info label="Affected area" value={obs.affectedArea || "Not set"} />
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4b5a76]">{obs.notes || "No notes."}</p>
              {obs.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={obs.photoDataUrl} target="_blank" rel="noreferrer"><img src={obs.photoDataUrl} alt="observation" className="mt-3 h-28 w-28 rounded-lg border border-[#d8dece] object-cover" /></a>
              ) : null}
              <div className="mt-3"><DeleteButton label="Delete" onDelete={() => deleteRecord("observations", obs.id, "Observation deleted.")} /></div>
            </ExpandableCard>
          )} /> : <EmptyState text="No observations yet. Add pest, disease, weather, labour delay, theft/loss or market change notes as they happen." />}
        </div>
      </section>
    </div>
  );
}

type CalEvent = { kind: "task" | "done" | "planting" | "harvest" | "salary"; label: string; tab: FarmOsTab };
const CAL_TONE: Record<CalEvent["kind"], { dot: string; chip: string }> = {
  task: { dot: "bg-[#2563eb]", chip: "bg-[#eaf0fe] text-[#1e40af]" },
  done: { dot: "bg-[#98a2b3]", chip: "bg-[#f3f4f6] text-[#667085]" },
  planting: { dot: "bg-[#0f8b6f]", chip: "bg-[#f1fbf7] text-[#0a715b]" },
  harvest: { dot: "bg-[#d99a28]", chip: "bg-[#fdf4e3] text-[#8a5a00]" },
  salary: { dot: "bg-[#14213d]", chip: "bg-[#eef0f5] text-[#14213d]" }
};

function CalendarView({ data, setTab }: { data: FarmOsData; setTab: (tab: FarmOsTab) => void }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [view, setView] = useState(() => ({ year: Number(todayIso.slice(0, 4)), month: Number(todayIso.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(todayIso);
  const [open, setOpen] = useState(false);

  const events = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    const push = (date: string | undefined, ev: CalEvent) => {
      if (!date) return;
      (map[date] ||= []).push(ev);
    };
    for (const t of data.tasks) {
      if (t.status === "cancelled") continue;
      push(t.dueDate, { kind: t.status === "completed" ? "done" : "task", label: t.taskTitle, tab: "tasks" });
    }
    for (const p of data.plantingPlans) {
      if (p.status === "completed" || p.status === "cancelled") continue;
      push(p.plannedNurseryDate, { kind: "planting", label: `${p.cropName}: nursery`, tab: "planting-planner" });
      push(p.plannedPlantingDate, { kind: "planting", label: `${p.cropName}: plant`, tab: "planting-planner" });
      push(p.expectedTransplantDate, { kind: "planting", label: `${p.cropName}: transplant`, tab: "planting-planner" });
      push(p.expectedHarvestStartDate, { kind: "harvest", label: `${p.cropName}: harvest`, tab: "planting-planner" });
    }
    for (const s of data.salaryRuns || []) {
      push(s.paymentDate, { kind: "salary", label: `${getWorkerName(data, s.workerId)}: pay`, tab: "salary" });
    }
    return map;
  }, [data]);

  const monthStart = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const leadBlanks = monthStart.getDay(); // 0 = Sunday
  const cells: (string | null)[] = [];
  for (let i = 0; i < leadBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = monthStart.toLocaleDateString("en-NG", { month: "long", year: "numeric" });
  const shift = (delta: number) => setView((v) => {
    const m = v.month + delta;
    return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
  });
  const selectedEvents = events[selected] || [];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Calendar">
        Everything date-based in one view — task due dates, nursery/planting/transplant/harvest milestones from your plans, and salary pay dates. Tap a day to see its events, then jump to the right screen.
      </PageIntro>

      <section className="dt-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <button className="grid h-10 w-10 place-items-center rounded-lg border border-[#d8dece] bg-white text-lg font-black text-[#4b5a76]" onClick={() => shift(-1)} type="button">‹</button>
          <h2 className="text-lg font-black text-[#14213d]">{monthLabel}</h2>
          <button className="grid h-10 w-10 place-items-center rounded-lg border border-[#d8dece] bg-white text-lg font-black text-[#4b5a76]" onClick={() => shift(1)} type="button">›</button>
        </div>
        <button className="mx-auto mt-2 block text-xs font-black text-[#0f8b6f]" onClick={() => { setView({ year: Number(todayIso.slice(0, 4)), month: Number(todayIso.slice(5, 7)) - 1 }); setSelected(todayIso); }} type="button">Jump to today</button>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-black uppercase text-[#667085]">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b${i}`} className="aspect-square" />;
            const evs = events[iso] || [];
            const isToday = iso === todayIso;
            const isSel = iso === selected;
            return (
              <button
                key={iso}
                onClick={() => { setSelected(iso); setOpen(true); }}
                type="button"
                className={`flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border p-1 text-xs ${isSel ? "border-[#0f8b6f] bg-[#f1fbf7]" : isToday ? "border-[#d99a28] bg-[#fdf9ef]" : "border-[#edf1e7] bg-white"}`}
              >
                <span className={`font-black ${isToday ? "text-[#8a5a00]" : "text-[#14213d]"}`}>{Number(iso.slice(8, 10))}</span>
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {evs.slice(0, 4).map((e, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${CAL_TONE[e.kind].dot}`} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-[#667085]">
          {(["task", "planting", "harvest", "salary", "done"] as CalEvent["kind"][]).map((k) => (
            <span className="flex items-center gap-1.5" key={k}><span className={`h-2.5 w-2.5 rounded-full ${CAL_TONE[k].dot}`} />{labelize(k)}</span>
          ))}
        </div>
      </section>

      {/* Day popover — opens right over the calendar so the day's events are
          visible immediately, no scrolling. */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button aria-label="Close" className="absolute inset-0 bg-[#0b1f16]/55 backdrop-blur-sm" onClick={() => setOpen(false)} type="button" />
          <div className="pb-safe relative z-10 w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[#0f8b6f]">{selected === todayIso ? "Today" : "Selected day"}</p>
                <h3 className="text-lg font-black text-[#14213d]">{new Date(`${selected}T00:00:00`).toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
              </div>
              <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#d8dece] bg-white text-[#4b5a76]" onClick={() => setOpen(false)} type="button"><X size={18} /></button>
            </div>
            <div className="mt-4 grid max-h-[55vh] gap-2 overflow-y-auto">
              {selectedEvents.length ? selectedEvents.map((e, i) => {
                const tone = CAL_TONE[e.kind];
                return (
                  <button key={i} onClick={() => { setTab(e.tab); setOpen(false); }} type="button" className="flex items-center justify-between gap-3 rounded-xl border border-[#edf1e7] bg-white p-3 text-left">
                    <span className="flex items-center gap-2 text-sm font-bold text-[#4b5a76]">
                      <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      {e.label}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${tone.chip}`}>{labelize(e.kind)} →</span>
                  </button>
                );
              }) : <EmptyState text="Nothing scheduled on this day." />}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Turn report rows into a CSV file the farmer can download (Excel/Sheets-friendly).
function cellToText(cell: React.ReactNode): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "string" || typeof cell === "number") return String(cell);
  return String(cell);
}
function exportCsv(filename: string, headers: string[], rows: Array<Array<React.ReactNode>>) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map((c) => escape(cellToText(c))).join(","))];
  // Prepend BOM so Excel reads UTF-8 (Naira sign etc.) correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Compress an image file to a small JPEG data URL so it can live inside the farm
// JSON without blowing the local-storage budget. Resizes to fit maxDim and
// re-encodes at the given quality.
function compressImage(file: File, maxDim = 900, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("decode failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Camera/file photo field that compresses on pick and submits a data URL via a
// hidden input (so existing FormData-based handlers pick it up unchanged).
function PhotoInput({ name, label = "Photo (optional)" }: { name: string; label?: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Field label={label}>
      <input type="hidden" name={name} value={url} readOnly />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="attached" className="h-16 w-16 rounded-lg border border-[#d8dece] object-cover" />
          <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#e0443a] px-3 text-xs font-black text-[#e0443a]" onClick={() => setUrl("")} type="button"><X size={14} /> Remove</button>
        </div>
      ) : (
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[#cdeee2] bg-[#f1fbf7] px-4 text-sm font-black text-[#0a715b]">
          <Camera size={16} /> {busy ? "Processing…" : "Take / choose photo"}
          <input
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try { setUrl(await compressImage(f)); } catch { /* ignore bad image */ } finally { setBusy(false); }
            }}
            type="file"
          />
        </label>
      )}
    </Field>
  );
}

function ReportsView({ data, totals }: { data: FarmOsData; totals: ReturnType<typeof useDashboardTotals> }) {
  const landRows = data.plots.map((plot) => [plot.plotCode, plot.plotName, numberFormat.format(plot.equivalentAcres || 0), labelize(plot.landStatus), plot.irrigated ? "Yes" : "No", plot.currentCrop || "None"]);
  const labourRows = data.workers.map((worker) => {
    const payments = data.laborPayments.filter((payment) => payment.workerId === worker.id);
    const tasks = data.tasks.filter((task) => task.assignedWorkerId === worker.id);
    return [worker.name, labelize(worker.employmentType), tasks.length, naira.format(payments.reduce((sum, payment) => sum + Number(payment.amountDue || 0), 0)), naira.format(payments.reduce((sum, payment) => sum + calculateLaborBalance(payment), 0)), labelize(worker.status)];
  });
  const inputByCategory = data.inputCosts.reduce<Record<string, number>>((acc, input) => {
    acc[input.category] = (acc[input.category] || 0) + Number(input.totalCost || 0);
    return acc;
  }, {});
  const inputRows = Object.entries(inputByCategory).map(([category, cost]) => [labelize(category), naira.format(cost)]);
  const readinessRows = data.plots.map((plot) => {
    const regrowth = calculateRegrowth(plot);
    return [plot.plotCode, labelize(plot.landStatus), regrowth.expectedBushRegrowth, regrowth.recommendedInspectionDate || "Not set", regrowth.recommendedClearingDate || "Not set", regrowth.recommendation];
  });
  const profitRows = data.plantingPlans.map((plan) => [plan.cropName, getPlotName(data, plan.plotId), naira.format(planCost(plan)), naira.format(expectedRevenue(plan)), naira.format(expectedProfit(plan)), `${numberFormat.format(profitMargin(plan))}%`, plan.warnings.length]);
  const salaryRows = (data.salaryRuns || []).map((salary) => [getWorkerName(data, salary.workerId), `${salary.periodStart} to ${salary.periodEnd}`, labelize(salary.payBasis), naira.format(salary.netPay), naira.format(salary.amountPaid), naira.format(calculateSalaryBalance(salary)), labelize(salary.status)]);
  const attendanceRows = (data.attendanceRecords || []).map((record) => [getWorkerName(data, record.workerId), record.date, labelize(record.status), record.daysWorked || 0, getPlotName(data, record.plotId), record.workSummary || "-"]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3.5 pb-0 sm:gap-5">
      <PageIntro title="Reports">
        This page pulls everything together into operating reports. It summarises land status, irrigation coverage, crop profit, input costs, labour cost, payroll balance, market prices, upcoming tasks and overdue tasks from the records you entered.
      </PageIntro>

      <div className="flex flex-wrap gap-2 dt-no-print">
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#14213d] px-4 text-sm font-black text-white" onClick={() => window.print()} type="button">
          <FileText size={16} /> Print / Save as PDF
        </button>
        <p className="self-center text-xs font-bold text-[#667085]">Tap a report’s “CSV” button to download it for Excel/Sheets, or print the whole page to PDF.</p>
      </div>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        <DashboardCard icon={FileText} label="Reports ready" value={13} hint="Land, irrigation, profit, labour, cost breakdowns, market and tasks" />
        <DashboardCard icon={Map} label="Ready plots" value={totals.readyPlots} hint="Land status report" />
        <DashboardCard icon={Droplets} label="Coverage" value={`${numberFormat.format((totals.irrigatedAcres / Math.max(totals.totalAcres, 1)) * 100)}%`} hint="Irrigation coverage" />
        <DashboardCard icon={Coins} label="Profit forecast" value={naira.format(totals.expectedProfitTotal)} hint="Crop cycle profit forecast" />
        <DashboardCard icon={WalletCards} label="Salary balance" value={naira.format(totals.salaryBalance)} hint="Salary page payroll balance" tone={totals.salaryBalance > 0 ? "warning" : "green"} />
      </section>

      <section className="grid gap-5">
        <ReportSummary data={data} totals={totals} />
        <RecordTable title="Land status report" headers={["Code", "Plot", "Acres", "Land status", "Irrigated", "Crop"]} rows={landRows} />
        <RecordTable title="Plot readiness report" headers={["Plot", "Status", "Regrowth", "Inspect", "Clear", "Recommendation"]} rows={readinessRows} />
        <RecordTable title="Crop cycle profit forecast" headers={["Crop", "Plot", "Cost", "Revenue", "Profit", "Margin", "Warnings"]} rows={profitRows} />
        <RecordTable title="Labour cost report" headers={["Worker", "Type", "Tasks", "Due", "Balance", "Status"]} rows={labourRows} />
        <RecordTable title="Salary runs report" headers={["Worker", "Period", "Basis", "Net", "Paid", "Balance", "Status"]} rows={salaryRows} />
        <RecordTable title="Attendance report" headers={["Worker", "Date", "Status", "Days", "Plot", "Summary"]} rows={attendanceRows} />
        <RecordTable title="Input cost report" headers={["Category", "Total cost"]} rows={inputRows} />
        <RecordTable title="Cost per plot report" headers={["Plot", "Land status", "Acres", "Logged cost", "Cost / acre"]} rows={costPerPlot(data).map(({ plot, total }) => [`${plot.plotCode} — ${plot.plotName}`, labelize(plot.landStatus), numberFormat.format(Number(plot.equivalentAcres || 0)), naira.format(total), naira.format(total / Math.max(Number(plot.equivalentAcres || 0), 0.01))])} />
        <RecordTable title="Cost per worker report" headers={["Worker", "Total pay", "Paid", "Balance"]} rows={costPerWorker(data).map(({ worker, total, paid, balance }) => [worker.name, naira.format(total), naira.format(paid), naira.format(balance)])} />
        <RecordTable title="Cost per category report" headers={["Category", "Total", "Share"]} rows={(() => { const rows = costPerCategory(data); const sum = rows.reduce((acc, row) => acc + row.total, 0); return rows.map((row) => [labelize(row.category), naira.format(row.total), sum > 0 ? `${Math.round((row.total / sum) * 100)}%` : "0%"]); })()} />
        <RecordTable title="Market price report" headers={["Crop", "Market", "Unit", "Price", "Date", "Confidence"]} rows={data.marketPrices.map((price) => [price.cropName, price.market || "-", price.unit, naira.format(price.price), price.dateChecked, labelize(price.confidence)])} />
        <RecordTable title="Upcoming / overdue tasks report" headers={["Task", "Type", "Plot", "Worker", "Due", "Status", "Priority"]} rows={data.tasks.map((task) => [task.taskTitle, labelize(task.taskType), getPlotName(data, task.plotId), getWorkerName(data, task.assignedWorkerId), task.dueDate, labelize(task.status), labelize(task.priority)])} />
      </section>
    </div>
  );
}

function ReportSummary({ data, totals }: { data: FarmOsData; totals: ReturnType<typeof useDashboardTotals> }) {
  const nonIrrigatedAcres = data.plots.filter((plot) => !plot.irrigated).reduce((sum, plot) => sum + Number(plot.equivalentAcres || 0), 0);
  return (
    <article className="dt-panel p-5">
      <SectionHeader eyebrow="Executive farm report" title="Current operating position" />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Land coverage" value={`${numberFormat.format(totals.totalAcres)} acres mapped`} />
        <Info label="Irrigation expansion estimate" value={naira.format(totals.irrigationSummary.costPerAcre * nonIrrigatedAcres)} />
        <Info label="Labour balance" value={naira.format(totals.unpaidLabor)} />
        <Info label="Salary balance" value={naira.format(totals.salaryBalance)} />
        <Info label="Forecast profit" value={naira.format(totals.expectedProfitTotal)} />
      </div>
      <p className="mt-4 text-sm leading-6 text-[#4b5a76]">
        This report joins land readiness, irrigation coverage, labour balances, planting forecasts, inputs and observations. It is structured so a later AI agent can answer practical farm questions without guessing.
      </p>
    </article>
  );
}

function RecordTable({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="dt-panel p-5">
      <SectionHeader eyebrow="Report" title={title}>
        {rows.length ? (
          <button className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d8dece] bg-white px-3 text-xs font-black text-[#4b5a76] dt-no-print" onClick={() => exportCsv(slugify(title), headers, rows)} type="button">
            <FileText size={14} /> CSV
          </button>
        ) : null}
      </SectionHeader>
      <div className="mt-4 max-w-full overflow-x-auto dt-scroll-x">
        {rows.length ? (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-[#667085]">
              <tr>{headers.map((header) => <th className="py-3 pr-4" key={header}>{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#edf1e7]">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, cellIndex) => <td className="py-3 pr-4 align-top" key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState text="No records yet for this report." />}
      </div>
    </div>
  );
}

function PlotSelect({ data, name, defaultPlotId }: { data: FarmOsData; name: string; defaultPlotId?: string }) {
  return (
    <select className={inputClass} name={name} defaultValue={defaultPlotId || ""} key={defaultPlotId || "none"}>
      <option value="">{data.plots.length ? "Select plot" : "Add a plot first"}</option>
      {data.plots.map((plot) => <option key={plot.id} value={plot.id}>{plot.plotCode} - {plot.plotName}</option>)}
    </select>
  );
}


function TaskSelect({ data, name }: { data: FarmOsData; name: string }) {
  return (
    <select className={inputClass} name={name}>
      <option value="">Not linked</option>
      {data.tasks.map((task) => <option key={task.id} value={task.id}>{task.taskTitle} - {getPlotName(data, task.plotId)}</option>)}
    </select>
  );
}

function WorkerSelect({ data, name }: { data: FarmOsData; name: string }) {
  return (
    <select className={inputClass} name={name}>
      <option value="">Unassigned</option>
      {data.workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} - {worker.role || labelize(worker.employmentType)}</option>)}
    </select>
  );
}


function PlantingPlanSelect({ data, name }: { data: FarmOsData; name: string }) {
  return (
    <select className={inputClass} name={name}>
      <option value="">General / not linked</option>
      {data.plantingPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.cropName} - {getPlotName(data, plan.plotId)}</option>)}
    </select>
  );
}
