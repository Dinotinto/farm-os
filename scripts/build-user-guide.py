from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, ListFlowable, ListItem, KeepTogether
)

GREEN = colors.HexColor("#193b28")
ACCENT = colors.HexColor("#0f8b6f")
GOLD = colors.HexColor("#d99a28")
NAVY = colors.HexColor("#14213d")
SLATE = colors.HexColor("#4b5a76")
MUTE = colors.HexColor("#667085")
PANEL = colors.HexColor("#f1fbf7")
LINE = colors.HexColor("#d8dece")

OUT = r"D:\Dinotinto-Farm-OS\docs\farm-os-user-guide.pdf"

styles = getSampleStyleSheet()

def S(name, **kw):
    return ParagraphStyle(name, parent=styles["Normal"], **kw)

body = S("body", fontName="Helvetica", fontSize=10, leading=15, textColor=NAVY, spaceAfter=6)
small = S("small", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTE)
h1 = S("h1", fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=GREEN, spaceBefore=14, spaceAfter=4)
h2 = S("h2", fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=ACCENT, spaceBefore=8, spaceAfter=2)
eyebrow = S("eyebrow", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=ACCENT, spaceAfter=2)
title = S("title", fontName="Helvetica-Bold", fontSize=26, leading=29, textColor=GREEN)
subtitle = S("subtitle", fontName="Helvetica", fontSize=12, leading=16, textColor=SLATE)
cellh = S("cellh", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white)
cellname = S("cellname", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=NAVY)
cell = S("cell", fontName="Helvetica", fontSize=9, leading=12, textColor=SLATE)
listb = S("listb", fontName="Helvetica", fontSize=10, leading=14, textColor=NAVY)

def header_footer(canvas, doc):
    canvas.saveState()
    # top brand bar
    canvas.setFillColor(GREEN)
    canvas.rect(0, A4[1] - 6*mm, A4[0], 6*mm, stroke=0, fill=1)
    canvas.setFillColor(GOLD)
    canvas.rect(0, A4[1] - 6*mm, 40*mm, 6*mm, stroke=0, fill=1)
    # footer
    canvas.setFillColor(MUTE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(18*mm, 12*mm, "Dinotinto Farm OS — User Guide")
    canvas.drawRightString(A4[0] - 18*mm, 12*mm, "Page %d" % doc.page)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18*mm, 15*mm, A4[0] - 18*mm, 15*mm)
    canvas.restoreState()

def panel(flowables, pad=8):
    t = Table([[flowables]], colWidths=[doc_width])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#cdeee2")),
        ("LEFTPADDING", (0, 0), (-1, -1), pad + 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), pad + 2),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
    ]))
    return t

def bullets(items, style=listb):
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=10, value="•") for t in items],
        bulletType="bullet", bulletColor=ACCENT, leftIndent=12, spaceBefore=1, spaceAfter=6,
    )

def screen_table(rows):
    data = [[Paragraph("Screen", cellh), Paragraph("What you do there", cellh)]]
    for name, desc in rows:
        data.append([Paragraph(name, cellname), Paragraph(desc, cell)])
    t = Table(data, colWidths=[34*mm, doc_width - 34*mm])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f8f4")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    t.setStyle(TableStyle(style))
    return t

doc = BaseDocTemplate(
    OUT, pagesize=A4,
    leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=20*mm,
    title="Dinotinto Farm OS — User Guide", author="Dinotinto",
)
doc_width = doc.width
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])

story = []

# ---- Title block ----
story.append(Spacer(1, 6))
story.append(Paragraph("FARM OPERATING SYSTEM", eyebrow))
story.append(Paragraph("Dinotinto Farm OS", title))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "A plain-English guide to running your land, irrigation, labour, crops, costs and profit "
    "from one screen. About a 7-minute read.", subtitle))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=1, color=GOLD))
story.append(Spacer(1, 6))

# ---- What it is ----
story.append(Paragraph("What this system is for", h1))
story.append(Paragraph(
    "Farm OS is your farm command centre. Instead of keeping plot sizes, irrigation costs, worker "
    "payments and crop budgets in scattered notebooks, you record them once here and the system does "
    "the maths, spots problems, and tells you what to do next. It works on a phone or computer, and "
    "your records are saved automatically.", body))

# ---- Getting around ----
story.append(Paragraph("Finding your way around", h1))
story.append(Paragraph(
    "Use the menu on the left (or the menu button on a phone) to move between screens. The bar at the "
    "top has three things to know:", body))
story.append(bullets([
    "<b>The bell</b> shows alerts that need attention. A red number means there are urgent items. "
    "Tap it to read them and to turn on phone/desktop push alerts.",
    "<b>Reset demo data</b> clears everything back to the sample farm — useful while learning, but it "
    "wipes your entries, so use it carefully.",
    "<b>Notices</b> appear under the top bar to confirm each thing you save.",
]))

# ---- Weekly workflow ----
story.append(Paragraph("The simple weekly rhythm", h1))
story.append(Paragraph("If you only remember one thing, remember this order:", body))
story.append(panel([
    Paragraph(
        "<b>1. Check the Dashboard</b> for the big picture &nbsp;→&nbsp; "
        "<b>2. Open Farm Advisor</b> to see what needs action &nbsp;→&nbsp; "
        "<b>3. Assign Tasks</b> to workers &nbsp;→&nbsp; "
        "<b>4. Log work, attendance and payments</b> in Salary &amp; Payroll &nbsp;→&nbsp; "
        "<b>5. Record costs and observations</b> as they happen &nbsp;→&nbsp; "
        "<b>6. Review Reports</b> at week's end.", body),
]))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Everything else is detail you fill in once and update occasionally (plots, irrigation materials, "
    "crop catalogue, planting plans).", small))

# ---- Two smart helpers ----
story.append(Paragraph("Two helpers that do the thinking", h1))
story.append(Paragraph("Farm Advisor", h2))
story.append(Paragraph(
    "Reads everything you've entered and gives you a prioritised to-do list: which plot needs clearing, "
    "what it would cost to irrigate a plot, which crop plan is heading for a loss, who is owed money, and "
    "where your biggest costs are. It also recommends the best plot for any crop you pick.", body))
story.append(Paragraph("Ask AI", h2))
story.append(Paragraph(
    "Type a question in normal language — “Which plot needs clearing?”, “How much will irrigation cost for "
    "Acre B?”, “What should each worker do this week?”, “What is our expected profit?” — and get an answer "
    "straight from your live records. Tap a suggested question to try it. It runs privately on your device.", body))

# ---- Screen by screen (page 2) ----
story.append(Paragraph("Every screen, briefly", h1))
story.append(Paragraph(
    "You don't need all of these at once. Set up the top few once, then live mostly in Dashboard, "
    "Advisor, Tasks, Salary and Reports.", body))
story.append(Spacer(1, 4))
story.append(screen_table([
    ("Dashboard", "Your at-a-glance numbers — mapped acres, irrigated land, open tasks, unpaid labour, payroll balance, expected profit — plus the most urgent alerts."),
    ("Farm Advisor", "Smart recommendations and the best-plot-for-a-crop picker. Start here each week."),
    ("Ask AI", "Ask questions in plain language and get answers from your data."),
    ("Farm Map", "Your plots/acres. Add a plot with its real measurements; the system works out the area and equivalent acres, irrigation status and land readiness."),
    ("Irrigation", "List your irrigation materials and costs. The plan builder scales that list to any plot's size and gives you a materials checklist and total budget."),
    ("Land Clearing", "Compare clearing methods (manual, chemical, mechanical, combined) by cost and time for a plot, then record a clearing plan."),
    ("Crop Catalog", "Reference profiles for your crops — water needs, nursery time, expected yield, common pests and care tasks. Add your own crops too."),
    ("Planting Planner", "Plan a crop on a plot. It checks readiness and warns you (bushy land, no irrigation, missing seed cost or market price) and forecasts profit."),
    ("Inputs & Costs", "Record seeds and every input cost — fertiliser, manure, chemicals, labour, transport, fuel — against a plot or plan."),
    ("Tasks", "Create jobs (clearing, planting, spraying, harvesting…), assign them to workers, set due dates and priority, and mark them done."),
    ("Workers", "Add and edit workers — role, pay rate, status (active, suspended, left) — and log quick labour payments."),
    ("Salary & Payroll", "Log attendance/days worked, add bonuses, deductions and advances, then run salary and track what's paid vs. owed."),
    ("Market Prices", "Record current selling prices per crop so profit forecasts stay realistic."),
    ("Yield Forecast", "Expected yield, marketable yield and best/worst-case revenue per crop cycle."),
    ("Observations", "Log events during a cycle (pests, disease, heavy rain, delays). These feed back into cost and yield expectations."),
    ("Reports", "Printable summaries: land status, irrigation coverage, profit forecast, labour, attendance, cost per plot / per worker / per category, market prices and tasks."),
]))

# ---- Notifications ----
story.append(Paragraph("Alerts and push notifications", h1))
story.append(Paragraph(
    "The bell collects anything urgent — a plot that needs clearing before planting, a worker who is owed "
    "money, a crop plan running at a loss. Open the bell and tap <b>Enable push alerts</b> once to also get "
    "pop-up notifications on that device for the most urgent items, even while you're on another screen. "
    "Tap an alert to mark it read, or use “Mark all read”.", body))

# ---- Where data lives ----
story.append(Paragraph("Where your records are kept", h1))
story.append(Paragraph(
    "Your work saves automatically as you go. Records are stored on your device and, when the database is "
    "switched on, synced to the cloud so the same data shows up across devices. If you're ever offline, the "
    "app keeps working and catches up later — you won't lose what you entered.", body))

# ---- Tips ----
story.append(Paragraph("Five tips to get value fast", h1))
story.append(bullets([
    "Enter your real plot measurements first — almost every cost and forecast builds on accurate acreage.",
    "Keep market prices current; profit forecasts are only as good as the price you put in.",
    "Log costs and attendance the day they happen — it takes seconds and keeps reports honest.",
    "Let the Advisor set your weekly priorities instead of guessing what's urgent.",
    "Check Reports every week to catch rising costs and unpaid balances early.",
]))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=0.6, color=LINE))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "That's the whole system at a high level. Open the Dashboard, glance at the Advisor, and you're running.",
    small))

doc.build(story)
print("WROTE", OUT)
