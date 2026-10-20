# Iteration 2 — Worker Editing, Salary/Payroll, Novice Guide and Roadmap

## What this iteration improves

This iteration turns the labour side of Dinotinto Farm OS from a basic worker/payment register into a more complete worker management and salary system.

New additions:

- Edit existing workers directly from the Workers screen.
- Update worker phone number, role, employment type, salary/rate, status, skills and notes.
- New Salary & Payroll screen.
- Attendance/day-work register.
- Salary adjustment records for bonus, deduction, advance, loan repayment, transport, feeding and other changes.
- Salary run calculator.
- Salary run status tracking: draft, approved, part paid, paid, cancelled.
- Salary balance calculation.
- Salary run automatically creates a simple labour payment record too, so old labour reports still stay useful.
- Salary and attendance reports added to the Reports area.
- Dashboard now shows salary payroll balance and attendance days.
- Default sample payroll data added for UAT.

This is still a UAT/local-storage version unless Codex connects it to Prisma/Postgres. The UI and calculation layer are ready for that next step.

---

# Beginner Guide — How to Use Dinotinto Farm OS Step by Step

## Step 1 — Open the app

Open the deployed UAT app in your browser. On desktop, use the left menu. On phone, use the bottom menu and the menu button at the top.

The app is organised like a farm office:

- Dashboard = quick summary
- Farm Map = your land/plots/acres
- Irrigation = irrigation materials and setup cost
- Land Clearing = clearing plans and bush readiness
- Crop Catalog = crops you grow
- Planting Planner = crop plan and expected profit
- Inputs & Costs = seed, fertiliser, chemical, transport and other costs
- Tasks = work to be done
- Workers = worker register
- Salary & Payroll = attendance, advances, salary calculation and balances
- Market Prices = crop prices
- Yield Forecast = expected production and revenue
- Observations = pests, disease, rain, theft, delays etc.
- Reports = summary tables

---

## Step 2 — Add your land first

Go to **Farm Map**.

Add each plot or acre separately.

Example:

- Plot name: Vegetable Block A
- Plot code: Acre A
- Length: 300
- Width: 100
- Size unit: feet
- Irrigated: yes/no
- Land status: ready, bushy, needs clearing, waterlogged etc.
- Current crop: cucumber, pepper, plantain etc.

The system calculates:

- Area
- Equivalent acres

This matters because not every acre/plot is exactly the same size.

---

## Step 3 — Mark land readiness

Still on **Farm Map**, update each plot status.

Use statuses like:

- Ready
- Bushy
- Needs clearing
- Needs ridging
- Needs manure
- Waterlogged
- Under cultivation

Then go to **Land Clearing** and create a clearing plan.

Example:

- Plot: Acre B
- Condition: bushy
- Method: combined method
- Labour required: 4 workers
- Estimated cost: ₦86,000
- Planned date: 2026-06-20

This helps you know what must happen before planting.

---

## Step 4 — Add irrigation materials

Go to **Irrigation**.

Add things like:

- Pump
- Pipes
- Drip lines
- Hoses
- Connectors
- Valves
- Water tank
- Installation labour
- Maintenance

For each item, enter:

- Quantity
- Unit cost
- Whether it is reusable
- How many acres it can serve

The system calculates:

- Total irrigation cost
- Reusable equipment cost
- Consumable cost
- Labour/maintenance cost
- Cost per acre

---

## Step 5 — Create an irrigation plan

Still on **Irrigation**, create a plan like:

> Add drip irrigation to Acre B.

Enter:

- Plot
- Irrigation method
- Water source
- Materials needed
- Labour needed
- Expected setup time
- Expected cost
- Expected benefit

Use this before buying materials so you can compare costs properly.

---

## Step 6 — Check the crop catalog

Go to **Crop Catalog**.

The app already includes:

- Pepper
- Garden egg
- Sweet corn
- Plantain
- Cucumber

Each crop has:

- Planting method
- Nursery duration
- Water need
- Irrigation recommendation
- Expected harvest timing
- Expected yield per acre
- Pest risks
- Care tasks

You can add more crops later.

---

## Step 7 — Create a planting plan

Go to **Planting Planner**.

Choose:

- Crop
- Plot
- Variety
- Nursery date
- Planting/transplant date
- Expected harvest dates
- Seed cost
- Fertiliser budget
- Labour budget
- Irrigation budget
- Transport budget
- Expected yield
- Expected market price

The app warns you if something is risky, for example:

- Plot is bushy
- Plot is not irrigated
- Crop has high water need
- Fertiliser plan missing
- Market price missing

This is where farm planning becomes financial planning.

---

## Step 8 — Add seed and input costs

Go to **Inputs & Costs**.

Add seed purchases:

- Crop
- Variety
- Supplier
- Quantity
- Unit cost
- Germination rate

Add input costs:

- Fertiliser
- Manure
- Pesticide
- Insecticide
- Herbicide
- Labour
- Irrigation
- Transport
- Packaging
- Fuel

Always link costs to a plot or planting plan where possible. That is what makes profit reports meaningful.

---

## Step 9 — Add workers

Go to **Workers**.

Add every worker, contractor or farm assistant.

Enter:

- Name
- Phone number
- Role
- Employment type
- Salary/rate
- Start date
- Skills
- Notes

Examples:

- Daily worker: ₦12,000 per day
- Weekly worker: ₦18,000 per day or agreed weekly rate
- Contractor: agreed contract amount
- Monthly worker: monthly salary

---

## Step 10 — Edit workers when details change

On the **Workers** page, each worker card now has **Edit worker**.

Use this when:

- Phone number changes
- Daily rate changes
- Worker becomes inactive
- Worker gets a new role
- You want to add skills or notes

This avoids creating duplicate workers.

---

## Step 11 — Assign tasks

Go to **Tasks**.

Create farm tasks like:

- Clear Acre B
- Spray cucumber
- Weed pepper plot
- Transplant tomato seedlings
- Inspect for pests
- Repair irrigation
- Harvest cucumber
- Transport produce

Assign each task to a worker.

This helps you know:

- Who should do what
- When it is due
- What is overdue
- Which worker is carrying too much work

---

## Step 12 — Use Salary & Payroll

Go to **Salary & Payroll**.

Use it in this order:

### 12.1 Log attendance

Record who worked, when, and for how long.

Example:

- Worker: Tunde
- Date: 2026-06-17
- Status: half day
- Days worked: 0.5
- Plot: Acre B
- Task: Clear Acre B
- Work summary: started slashing

### 12.2 Add adjustment or advance

Use this for:

- Bonus
- Deduction
- Salary advance
- Transport
- Feeding support
- Loan repayment

Example:

- Worker: Tunde
- Type: transport
- Amount: ₦2,000
- Status: approved

### 12.3 Create salary run

This calculates salary.

For daily workers:

- Base rate = daily rate
- Units worked = number of days

Example:

- Base rate: ₦12,000
- Units worked: 5
- Bonus: ₦2,000
- Deduction: ₦0
- Advance recovered: ₦0
- Amount paid now: ₦40,000

The system calculates:

- Gross pay
- Net pay
- Paid amount
- Balance
- Status

If the worker is fully paid, mark the salary run as paid.

---

## Step 13 — Add market prices

Go to **Market Prices**.

Add crop price checks:

- Crop
- Market
- Unit
- Price
- Date checked
- Source
- Confidence

This feeds expected revenue and profit thinking.

---

## Step 14 — Add observations during the crop cycle

Go to **Observations**.

Record events like:

- Pest attack
- Disease
- Poor germination
- Heavy rainfall
- Dry spell
- Flooding
- Fertiliser delay
- Labour delay
- Market price change
- Theft/loss
- Plant stress

Add expected yield impact and cost impact.

Example:

- Pest attack on cucumber
- Yield impact: -10%
- Cost impact: ₦35,000

This helps explain why expected profit changed.

---

## Step 15 — Use Reports

Go to **Reports**.

Reports include:

- Land status report
- Plot readiness report
- Crop profit forecast
- Labour cost report
- Salary runs report
- Attendance report
- Input cost report
- Market price report
- Upcoming/overdue tasks report

Use reports weekly to decide:

- Which plot needs work
- Which worker is unpaid
- Which crop is making money
- Which input is costing too much
- Whether irrigation is worth it

---

# Roadmap

## Phase 1 — Current Foundation

Already covered in this iteration:

- Land/plot registry
- Irrigation costing
- Land clearing/readiness
- Crop catalog
- Planting planner
- Inputs and costs
- Task assignment
- Worker register
- Worker editing
- Salary and payroll
- Attendance
- Advances/deductions
- Market prices
- Yield forecasts
- Observations
- Reports

## Phase 2 — Database Wiring

Next Codex step:

- Move localStorage records into Prisma/Postgres.
- Create proper database tables for workers, salary runs, attendance and adjustments.
- Add create/read/update/delete API routes.
- Keep localStorage only as fallback or remove it.
- Add user login/roles if needed.

## Phase 3 — Farm Operations Polish

After DB wiring:

- Worker detail page
- Plot detail page
- Crop cycle detail page
- Better filters/search
- Export reports to CSV/PDF
- Upload receipts/photos
- Task reminders
- Calendar view
- Mobile field-entry improvements

## Phase 4 — AI Assistant

Only after real data is stored properly:

- Ask “Which plot is best for pepper?”
- Ask “What should workers do this week?”
- Ask “Which costs are too high?”
- Ask “What changed since last week?”
- Ask “Should we irrigate Acre C?”

The AI should use the farm’s actual records, not guess.

---

# Codex Implementation Notes

1. Inspect the project first.
2. Keep the existing UI style.
3. Preserve the localStorage UAT mode unless you are wiring the DB.
4. Do not remove the old labour payment flow; it is still useful for quick cash payments.
5. Connect the new salary data to Prisma/Postgres when ready.
6. Add proper CRUD APIs for worker editing, attendance, salary adjustments and salary runs.
7. Run lint/build before deploying.
8. Test on mobile as well as desktop.
