import type { CropProfile, FarmOsData, FarmPlot } from "@/lib/farm-os-types";
import {
  calculateIrrigationSummary,
  calculateLaborBalance,
  calculateRegrowth,
  calculateSalaryBalance,
  daysBetween,
  expectedProfit,
  expectedRevenue,
  farmToday,
  getPlotName,
  getWorkerName,
  formatQty,
  labelize,
  naira,
  netCashflow,
  planCost,
  procurementNeeds,
  receivables,
  salaryMonthKeys,
  salaryMonthOverdue,
  ymLabel
} from "@/lib/farm-os-calculations";

export type InsightCategory = "land" | "irrigation" | "labour" | "crop" | "cost";
export type InsightSeverity = "action" | "watch" | "info";

export type FarmInsight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  detail: string;
};

const NEEDS_WORK_STATUSES = [
  "bushy",
  "needs_clearing",
  "needs_ridging",
  "needs_ploughing",
  "needs_herbicide",
  "needs_manual_labor",
  "needs_manure",
  "waterlogged",
  "too_dry"
];

const severityRank: Record<InsightSeverity, number> = { action: 0, watch: 1, info: 2 };

function plotAcres(plot: FarmPlot) {
  return Number(plot.equivalentAcres || 0);
}

/** Cost to irrigate a single plot using the current materials list cost-per-acre. */
export function irrigationCostForPlot(data: FarmOsData, plot: FarmPlot) {
  const summary = calculateIrrigationSummary(data.irrigationMaterials, 1);
  const acres = Math.max(plotAcres(plot), 0.01);
  return Math.round(summary.costPerAcre * acres);
}

/** Score every plot for how well it suits a given crop. Higher score = better fit. */
export function bestPlotsForCrop(data: FarmOsData, crop: CropProfile | undefined) {
  if (!crop) return [];
  return data.plots
    .map((plot) => {
      const reasons: string[] = [];
      let score = 0;

      if (plot.landStatus === "ready") {
        score += 40;
        reasons.push("Land is ready");
      } else if (plot.landStatus === "recently_cleared" || plot.landStatus === "fallow") {
        score += 25;
        reasons.push(`Land is ${labelize(plot.landStatus).toLowerCase()}`);
      } else if (NEEDS_WORK_STATUSES.includes(plot.landStatus)) {
        score -= 15;
        reasons.push(`Needs work first (${labelize(plot.landStatus).toLowerCase()})`);
      }

      if (crop.irrigationRecommended || crop.waterNeed === "high") {
        if (plot.irrigated) {
          score += 30;
          reasons.push("Already irrigated for a thirsty crop");
        } else {
          score -= 20;
          reasons.push(`Not irrigated, but ${crop.cropName} wants ${crop.waterNeed} water`);
        }
      } else if (plot.rainFedSuitability === "good") {
        score += 15;
        reasons.push("Good rain-fed suitability");
      }

      if (plot.rainFedSuitability === "poor" && !plot.irrigated) {
        score -= 10;
        reasons.push("Poor rain-fed suitability");
      }

      const acres = plotAcres(plot);
      if (acres > 0) {
        score += Math.min(acres * 10, 15);
      }

      return { plot, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

/** Aggregate expected profit / revenue / cost per crop across all planting plans. */
export function profitByCrop(data: FarmOsData) {
  const map = new Map<string, { cropName: string; plans: number; cost: number; revenue: number; profit: number }>();
  for (const plan of data.plantingPlans) {
    const key = plan.cropName || "Unknown";
    const entry = map.get(key) || { cropName: key, plans: 0, cost: 0, revenue: 0, profit: 0 };
    entry.plans += 1;
    entry.cost += planCost(plan);
    entry.revenue += expectedRevenue(plan);
    entry.profit += expectedProfit(plan);
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

/** What each active worker has on their plate (open tasks + outstanding pay). */
export function workerWeekPlan(data: FarmOsData) {
  return data.workers
    .filter((worker) => worker.status === "active")
    .map((worker) => {
      const openTasks = data.tasks.filter(
        (task) => task.assignedWorkerId === worker.id && task.status !== "completed" && task.status !== "cancelled"
      );
      const salaryBalance = data.salaryRuns
        .filter((run) => run.workerId === worker.id)
        .reduce((sum, run) => sum + calculateSalaryBalance(run), 0);
      const laborBalance = data.laborPayments
        .filter((payment) => payment.workerId === worker.id)
        .reduce((sum, payment) => sum + calculateLaborBalance(payment), 0);
      return { worker, openTasks, outstandingPay: salaryBalance + laborBalance };
    });
}

/** Build the full set of prioritised farm insights from current data. */
export function buildFarmInsights(data: FarmOsData): FarmInsight[] {
  const insights: FarmInsight[] = [];

  // ---- Land & clearing ----
  for (const plot of data.plots) {
    if (NEEDS_WORK_STATUSES.includes(plot.landStatus)) {
      insights.push({
        id: `land-${plot.id}`,
        category: "land",
        severity: "action",
        title: `${plot.plotCode} needs land work`,
        detail: `${getPlotName(data, plot.id)} is ${labelize(plot.landStatus).toLowerCase()}. Clear/prepare it before planting.`
      });
    }
    if (plot.dateLastCleared) {
      const regrowth = calculateRegrowth(plot);
      if (regrowth.expectedBushRegrowth === "high" && !NEEDS_WORK_STATUSES.includes(plot.landStatus)) {
        insights.push({
          id: `regrowth-${plot.id}`,
          category: "land",
          severity: "watch",
          title: `${plot.plotCode}: high bush regrowth expected`,
          detail: regrowth.recommendation
        });
      }
    }
  }

  // ---- Irrigation ----
  const nonIrrigated = data.plots.filter((plot) => !plot.irrigated);
  for (const plot of nonIrrigated) {
    const cost = irrigationCostForPlot(data, plot);
    const cropProfile = data.cropProfiles.find((crop) => crop.cropName === plot.currentCrop);
    const thirsty = cropProfile?.waterNeed === "high" || cropProfile?.irrigationRecommended;
    insights.push({
      id: `irrigation-${plot.id}`,
      category: "irrigation",
      severity: thirsty ? "action" : "info",
      title: `Irrigating ${plot.plotCode} would cost ~${naira.format(cost)}`,
      detail: thirsty
        ? `${getPlotName(data, plot.id)} is not irrigated but its crop needs steady water. Budget ~${naira.format(cost)} for ${plotAcres(plot).toFixed(2)} acres.`
        : `${getPlotName(data, plot.id)} (${plotAcres(plot).toFixed(2)} acres) is rain-fed. Setup estimate ~${naira.format(cost)} if you expand irrigation.`
    });
  }

  // ---- Labour ----
  for (const { worker, openTasks, outstandingPay } of workerWeekPlan(data)) {
    if (openTasks.length) {
      insights.push({
        id: `labour-tasks-${worker.id}`,
        category: "labour",
        severity: openTasks.some((task) => task.status === "overdue") ? "action" : "watch",
        title: `${worker.name} has ${openTasks.length} open task(s) this week`,
        detail: openTasks
          .map((task) => `${task.taskTitle} (${labelize(task.status)}, due ${task.dueDate})`)
          .join("; ")
      });
    }
    if (outstandingPay > 0) {
      insights.push({
        id: `labour-pay-${worker.id}`,
        category: "labour",
        severity: "action",
        title: `${worker.name} is owed ${naira.format(outstandingPay)}`,
        detail: `Outstanding salary/labour balance for ${worker.name}. Settle to keep payroll clean.`
      });
    }
  }
  const unassigned = data.tasks.filter(
    (task) => !task.assignedWorkerId && task.status !== "completed" && task.status !== "cancelled"
  );
  if (unassigned.length) {
    insights.push({
      id: "labour-unassigned",
      category: "labour",
      severity: "watch",
      title: `${unassigned.length} open task(s) have no worker assigned`,
      detail: unassigned.map((task) => task.taskTitle).join("; ")
    });
  }

  // ---- Salary payment reminders (monthly) ----
  // A month's salary is due on the 1st of the next month; remind if unpaid >2 days after.
  const reminderNow = new Date();
  for (const worker of data.workers) {
    if (worker.status !== "active" || !Number(worker.salaryOrDailyRate || 0)) continue;
    const overdue = salaryMonthKeys(worker.startDate, reminderNow).filter((key) => salaryMonthOverdue(key, worker.monthsPaid, reminderNow));
    if (overdue.length) {
      insights.push({
        id: `salary-due-${worker.id}`,
        category: "labour",
        severity: "action",
        title: `${worker.name}'s salary is unpaid for ${overdue.length} month(s)`,
        detail: `Overdue: ${overdue.map(ymLabel).join(", ")}. Mark each month paid on the Workers page once settled (${naira.format(Number(worker.salaryOrDailyRate || 0))}/period).`
      });
    }
  }

  // ---- Crop & profit ----
  for (const plan of data.plantingPlans) {
    if (plan.status === "completed" || plan.status === "cancelled") continue;
    const profit = expectedProfit(plan);
    if (profit < 0) {
      insights.push({
        id: `crop-loss-${plan.id}`,
        category: "crop",
        severity: "action",
        title: `${plan.cropName} on ${getPlotName(data, plan.plotId)} forecasts a loss`,
        detail: `Expected loss of ${naira.format(Math.abs(profit))} (cost ${naira.format(planCost(plan))} vs revenue ${naira.format(
          expectedRevenue(plan)
        )}). Review budget or market price.`
      });
    }
    if (plan.warnings.length) {
      insights.push({
        id: `crop-warn-${plan.id}`,
        category: "crop",
        severity: "watch",
        title: `${plan.cropName} plan has ${plan.warnings.length} warning(s)`,
        detail: plan.warnings.join("; ")
      });
    }
  }

  // ---- Cost flags ----
  const categoryTotals = new Map<string, number>();
  for (const input of data.inputCosts) {
    categoryTotals.set(input.category, (categoryTotals.get(input.category) || 0) + Number(input.totalCost || 0));
  }
  const sortedCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalInputs = sortedCategories.reduce((sum, [, value]) => sum + value, 0);
  if (sortedCategories.length && totalInputs > 0) {
    const [topCategory, topValue] = sortedCategories[0];
    const share = Math.round((topValue / totalInputs) * 100);
    if (share >= 40) {
      insights.push({
        id: "cost-top-category",
        category: "cost",
        severity: "watch",
        title: `${labelize(topCategory)} is your biggest cost (${share}% of inputs)`,
        detail: `${naira.format(topValue)} of ${naira.format(totalInputs)} logged input cost is ${labelize(
          topCategory
        ).toLowerCase()}. Worth checking for savings.`
      });
    }
  }
  // ---- Stock shortfalls (plans need more than is in stock) ----
  for (const need of procurementNeeds(data)) {
    insights.push({
      id: `stock-short-${need.item.id}`,
      category: "cost",
      severity: "action",
      title: `Buy ${formatQty(need.shortfall, need.item.unit)} of ${need.item.name}`,
      detail: `Active plans need ${formatQty(need.reserved, need.item.unit)} but only ${formatQty(need.stock, need.item.unit)} is in stock.${need.estCost ? ` Budget about ${naira.format(need.estCost)}.` : ""}`
    });
  }

  // ---- Cash position ----
  const net = netCashflow(data);
  if (net < 0) {
    insights.push({
      id: "cash-negative",
      category: "cost",
      severity: "watch",
      title: `Farm is ${naira.format(Math.abs(net))} in the red so far`,
      detail: `Money spent (stock, labour, expenses) exceeds sales received by ${naira.format(Math.abs(net))}. Watch spending or push sales/collections.`
    });
  }
  const owed = receivables(data);
  if (owed > 0) {
    insights.push({
      id: "cash-receivables",
      category: "cost",
      severity: "watch",
      title: `${naira.format(owed)} owed to you from sales`,
      detail: `Buyers still owe ${naira.format(owed)}. Follow up to collect outstanding sale balances.`
    });
  }

  for (const observation of data.observations) {
    if (Number(observation.expectedCostImpact || 0) >= 20000 && daysBetween(observation.date) <= 14) {
      insights.push({
        id: `cost-observation-${observation.id}`,
        category: "cost",
        severity: "watch",
        title: `${labelize(observation.observationType)} may add ${naira.format(observation.expectedCostImpact || 0)}`,
        detail: `Recent observation on ${getPlotName(data, observation.plotId)} could raise cost and cut yield by ${Math.abs(
          Number(observation.expectedYieldImpact || 0)
        )}%.`
      });
    }
  }

  return insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

/** Plain-language "what changed" feed from the most recent dated records. */
export function recentActivity(data: FarmOsData, withinDays = 14) {
  const items: { date: string; text: string }[] = [];
  for (const observation of data.observations) {
    if (daysBetween(observation.date) <= withinDays) {
      items.push({ date: observation.date, text: `${labelize(observation.observationType)} logged on ${getPlotName(data, observation.plotId)}` });
    }
  }
  for (const run of data.salaryRuns) {
    if (run.paymentDate && daysBetween(run.paymentDate) <= withinDays) {
      items.push({ date: run.paymentDate, text: `Salary run for ${getWorkerName(data, run.workerId)} marked ${labelize(run.status)}` });
    }
  }
  for (const task of data.tasks) {
    if (task.completedAt && daysBetween(task.completedAt) <= withinDays) {
      items.push({ date: task.completedAt, text: `Task completed: ${task.taskTitle}` });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
}

export const advisorToday = farmToday;
