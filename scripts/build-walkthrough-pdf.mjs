// Zero-dependency PDF generator for the Farm OS planting walkthrough.
// Produces a small, multi-page PDF using the built-in Helvetica fonts.
// Run: node scripts/build-walkthrough-pdf.mjs
import { writeFileSync } from "node:fs";

// ---- Page + font metrics ----
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const MAX_W = PAGE_W - MARGIN * 2;

// Approx Helvetica char widths (per 1000 units) — good enough for wrapping.
const W = { def: 556 };
const WIDTHS = {
  " ": 278, "!": 278, '"': 355, "#": 556, $: 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
  "@": 1015, "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  "{": 334, "|": 260, "}": 334, "~": 584
};
function charWidth(ch, size, bold) {
  const code = ch.charCodeAt(0);
  let w;
  if (ch >= "A" && ch <= "Z") w = bold ? 700 : 667;
  else if (ch >= "a" && ch <= "z") w = bold ? 600 : 540;
  else w = WIDTHS[ch] ?? W.def;
  return (w / 1000) * size;
}
function textWidth(str, size, bold) {
  let w = 0;
  for (const ch of str) w += charWidth(ch, size, bold);
  return w;
}
function wrap(text, size, bold, maxW = MAX_W, indent = 0) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  const avail = maxW - indent;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (textWidth(trial, size, bold) > avail && line) {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Replace characters Helvetica's WinAnsi can't show with ASCII look-alikes.
function ascii(s) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/→|➜/g, ">")
    .replace(/•/g, "-")
    .replace(/₦/g, "NGN ")
    .replace(/[^\x20-\x7E]/g, "");
}

// ---- Document model: a flat list of blocks; the engine paginates them. ----
const blocks = [];
const H1 = (t) => blocks.push({ type: "h1", text: t });
const H2 = (t) => blocks.push({ type: "h2", text: t });
const P = (t) => blocks.push({ type: "p", text: t });
const BULLET = (t) => blocks.push({ type: "bullet", text: t });
const STEP = (n, t) => blocks.push({ type: "step", n, text: t });
const SPACER = (h = 8) => blocks.push({ type: "spacer", h });
const RULE = () => blocks.push({ type: "rule" });

// ===================== CONTENT =====================
H1("Dinotinto Farm OS");
H2("How to plan a planting from scratch - a walkthrough");
P("This guide walks you through one full crop cycle in the app: from an empty plot to a recorded sale. Follow it in order the first time, then use it as a checklist. Everything you enter flows into one shared record, so the Dashboard and Advisor always reflect what you actually did.");
SPACER();
RULE();

H2("Before you start: how the pieces connect");
P("The app has one source of truth and everything links back to it:");
BULLET("Plots are your land. Each plot has a status (ready, planted, fallow, needs clearing...).");
BULLET("Inventory is everything you own - seeds, fertilizer, crop protection. Its quantity is the stock you add minus the stock you use. Items never disappear; a used-up item simply shows 0 and an 'out of stock' tag so you can restock the same item and keep its cost and history.");
BULLET("A Planting Plan ties a crop to a plot, reserves the inputs it will draw from inventory, and projects cost, yield and profit.");
BULLET("Tasks are dated jobs (nursery, planting, spraying, harvest). They can be assigned to Workers.");
BULLET("Workers do tasks and are paid through Salary / labour. The Advisor flags unpaid balances and open tasks.");
BULLET("The Dashboard and Advisor read all of the above. Plan a crop and the plot turns 'planted'; record a sale and the cash position updates.");
SPACER();
RULE();

H2("Reserved vs used: the one thing to understand about stock");
P("When you create a plan and pick the seeds/fertilizer it will use, the app RESERVES that quantity - it earmarks it but does not remove it yet. Stock is only DEDUCTED when you record actual usage (Inventory > Use stock, tied to the plan). This is deliberate: a plan is intent; the deduction is what really happened. If plans reserve more than you hold, the Advisor tells you exactly what to buy.");
SPACER();
RULE();

H1("The walkthrough");

STEP(1, "Set up the plot");
P("Go to Plots > Add plot. Enter a real size such as 300 x 100 ft. Set whether it is irrigated and its current land status. If it is bushy or needs clearing, the Advisor will flag it before you can plant.");
P("Expect to see: the new plot listed with its acreage and a status tag.");

STEP(2, "Stock your inventory");
P("Go to Inventory > Add new item. Add the seed for your crop (set seeds-per-unit, or enter grams and let AI estimate the seed count), plus the fertilizers and crop-protection products you expect to use. Enter opening quantities for what you already have.");
P("Expect to see: each item with its quantity on hand and unit cost; stock value totalled at the top.");

STEP(3, "Create the crop profile");
P("Go to Crop catalog > and pick or create your crop (e.g. tomato, cucumber, pepper, plantain). The profile holds whether it needs a nursery, days to harvest, water need, common pests and fertilizer stages. The planner and the crop-stage guidance both use this.");
P("Expect to see: your crop available to select in the planner.");

STEP(4, "Plan the planting");
P("Go to Planting planner > Create crop plan. Select the crop, then the plot. Enter your nursery or planting date and the seed count. Pick the seeds, fertilizer and crop protection this plan will draw from inventory, with quantities. Set the expected market price.");
P("The app auto-fills transplant and harvest dates from the crop profile, computes expected cost, yield and profit, and shows warnings (e.g. thirsty crop on a non-irrigated plot, or not enough stock).");
P("Expect to see: a new plan card; the PLOT is now marked 'planted' with the crop on it; the Dashboard 'planted' count and profit forecast update.");

STEP(5, "Buy anything short");
P("If your plans reserve more than you hold, open the Advisor or the top of the Inventory page. It lists exactly what to buy and an estimated cost. Add that stock (Inventory > Add) and the shortfall clears.");
P("Expect to see: shortfall warnings disappear once stock covers the plan.");

STEP(6, "Turn the plan into dated tasks and assign workers");
P("From the plan (or Tasks), create the jobs: nursery work, land prep, planting/transplanting, weeding, fertilizer, spraying, harvest. Give each a due date and assign a worker. The AI crop plan can generate a whole dated schedule at once.");
P("Expect to see: tasks appear in Upcoming tasks on the Dashboard with due dates; each assigned worker's load shows in the Advisor.");

STEP(7, "Mark the plan active when it goes in the ground");
P("On the plan card press 'Mark Active' when you actually plant. This keeps the plot status accurate. (Creating the plan already marks the plot planted; Mark Active confirms it is really growing.)");
P("Expect to see: the plan tagged Active; the plot detail shows a 'Currently growing' banner with the harvest window.");

STEP(8, "Work the cycle - watch the Crop watch panel");
P("The Dashboard 'Crop watch' panel tells you, for each crop in the ground, its growth stage, what you should be seeing now, and the next action - based on the crop type and today's date. For example, two weeks into a tomato nursery it will say seedlings should be showing true leaves and to watch for damping-off; later it will prompt top-dressing, then pest scouting at flowering, then harvest.");
P("As things happen, record stock usage (Inventory > Use stock), log observations (pests, weather, poor germination) and complete tasks. Each of these feeds the Advisor and your real cost/profit.");
P("Expect to see: stage guidance advance over time; observations adjust the plan's expected profit; completed tasks drop off the upcoming list.");

STEP(9, "Harvest and sell");
P("When the Crop watch panel says the harvest window is open, harvest in batches. Check Market prices, then record each sale under Accounts (buyer, quantity, price, amount received). Unpaid balances show as money owed to you.");
P("Expect to see: 'Money in' and 'Net so far' update on the Dashboard; receivables flagged until buyers pay.");

STEP(10, "Close the plan");
P("Press 'Harvest Done' on the plan. The plot rotates to fallow, the crop moves to 'previous crop', and the plot is free for the next cycle. Completed plans stop reserving stock and drop out of the active forecasts.");
P("Expect to see: the plot back to fallow/ready; the cycle's real cost vs revenue preserved in Accounts.");

SPACER();
RULE();
H2("Quick mental model");
P("Plot + Inventory -> Plan (reserves stock) -> Tasks (assigned to workers) -> Active (plot planted) -> Crop watch guides you stage by stage -> Use stock + log observations as you go -> Harvest -> Sale (cash in) -> Harvest Done (plot freed). The Dashboard and Advisor summarise all of it at every step.");

// ===================== LAYOUT ENGINE =====================
const pages = [];
let ops = [];
let y = PAGE_H - MARGIN;

function newPage() {
  if (ops.length) pages.push(ops);
  ops = [];
  y = PAGE_H - MARGIN;
}
function ensure(space) {
  if (y - space < MARGIN) newPage();
}
function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function draw(line, size, bold, x, color) {
  const font = bold ? "F2" : "F1";
  const c = color || [0.08, 0.13, 0.24];
  ops.push(`q ${c[0]} ${c[1]} ${c[2]} rg BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${esc(ascii(line))}) Tj ET Q`);
}
function rule() {
  ensure(16);
  y -= 6;
  ops.push(`q 0.85 0.88 0.81 RG 0.8 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${y.toFixed(2)} l S Q`);
  y -= 12;
}

for (const b of blocks) {
  if (b.type === "spacer") { y -= b.h; continue; }
  if (b.type === "rule") { rule(); continue; }

  if (b.type === "h1") {
    ensure(34);
    for (const ln of wrap(b.text, 22, true)) { draw(ln, 22, true, MARGIN, [0.06, 0.55, 0.44]); y -= 28; }
    y -= 4;
  } else if (b.type === "h2") {
    ensure(24);
    for (const ln of wrap(b.text, 14, true)) { draw(ln, 14, true, MARGIN, [0.08, 0.13, 0.24]); y -= 20; }
    y -= 2;
  } else if (b.type === "p") {
    const size = 10.5;
    const lines = wrap(b.text, size, false);
    for (const ln of lines) { ensure(15); draw(ln, size, false, MARGIN, [0.29, 0.35, 0.46]); y -= 15; }
    y -= 4;
  } else if (b.type === "bullet") {
    const size = 10.5;
    const lines = wrap(b.text, size, false, MAX_W, 16);
    lines.forEach((ln, i) => {
      ensure(15);
      if (i === 0) draw("-", size, true, MARGIN, [0.06, 0.55, 0.44]);
      draw(ln, size, false, MARGIN + 16, [0.29, 0.35, 0.46]);
      y -= 15;
    });
    y -= 2;
  } else if (b.type === "step") {
    ensure(22);
    draw(`${b.n}.`, 13, true, MARGIN, [0.06, 0.55, 0.44]);
    for (const ln of wrap(b.text, 13, true, MAX_W, 22)) { draw(ln, 13, true, MARGIN + 22, [0.08, 0.13, 0.24]); y -= 18; }
    y -= 2;
  }
}
newPage();

// ===================== PDF ASSEMBLY =====================
const objects = [];
function add(s) { objects.push(s); return objects.length; }

const pageObjNums = [];
const contentObjNums = [];
// Reserve: 1 Catalog, 2 Pages, then per page: content + page obj, then 2 fonts.
const catalogNum = 1;
const pagesNum = 2;
let next = 3;
for (let i = 0; i < pages.length; i++) {
  contentObjNums.push(next++);
  pageObjNums.push(next++);
}
const f1Num = next++;
const f2Num = next++;

const objText = {};
objText[catalogNum] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`;
objText[pagesNum] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`;
pages.forEach((pageOps, i) => {
  const stream = pageOps.join("\n");
  objText[contentObjNums[i]] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  objText[pageObjNums[i]] = `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1Num} 0 R /F2 ${f2Num} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>`;
});
objText[f1Num] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
objText[f2Num] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;

const total = f2Num;
let out = "%PDF-1.4\n";
const offsets = [];
for (let n = 1; n <= total; n++) {
  offsets[n] = Buffer.byteLength(out, "latin1");
  out += `${n} 0 obj\n${objText[n]}\nendobj\n`;
}
const xrefStart = Buffer.byteLength(out, "latin1");
out += `xref\n0 ${total + 1}\n`;
out += "0000000000 65535 f \n";
for (let n = 1; n <= total; n++) {
  out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
}
out += `trailer\n<< /Size ${total + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

const target = new URL("../public/Farm-OS-Planting-Walkthrough.pdf", import.meta.url);
writeFileSync(target, Buffer.from(out, "latin1"));
console.log(`Wrote ${target.pathname} (${pages.length} page(s))`);
