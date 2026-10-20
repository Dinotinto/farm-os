# Farm OS Iteration 4 — Step-by-Step Guide for a Complete Novice

This guide explains how to use the app from scratch.

## Before you start

The app works best when you enter your real records instead of relying on test data.

Start with only four things:

1. Your plot/acre size
2. Your irrigation materials and prices
3. Your crop list
4. Your workers/tasks/costs

Do not start from reports. Reports only become useful after you enter records.

---

# Step 1 — Set up your plot or acre

Go to:

```text
Farm Map
```

Use this page to create each plot or acre.

For a Nigerian farm acre, you can select:

```text
300 × 100 ft
```

or

```text
200 × 150 ft
```

Both equal:

```text
30,000 square feet
```

That is about:

```text
0.69 of a conventional acre
```

Fill in:

```text
Plot name
Plot code
Length
Width
Land status
Irrigation status
Current crop, if any
Previous crop, if any
Rain-fed suitability
Soil notes
Access notes
```

Example:

```text
Plot name: Vegetable Block A
Plot code: Acre A
Length: 300
Width: 100
Size unit: Feet
Irrigated: No
Land status: Bushy
Current crop: None
```

Then click:

```text
Add plot
```

The app calculates the area automatically.

---

# Step 2 — Add irrigation materials

Go to:

```text
Irrigation
```

Use this page to enter the real things needed to irrigate a plot.

Examples:

```text
Well
Pump
Water tank
Main line pipe
Sub-main pipe
Drip lines
Hoses
Connectors
Valves
Filters
Transport
Installation labour
Maintenance
```

You do not have to type everything from scratch. Use the prepared list to select an item, then change the price and details.

Example:

```text
Item: Submersible pump
Quantity: 1
Unit: unit
Unit cost: ₦95,000
Reusable: Yes
Supplier: Agro-dealer
```

Click:

```text
Add material
```

Repeat for all materials.

Delete any wrong material row using the delete button.

---

# Step 3 — Create irrigation plan for one plot

Still on:

```text
Irrigation
```

Find:

```text
Create irrigation plan for one plot
```

Select:

```text
Plot
Irrigation method
Water source
Setup time
```

Then tick the exact material rows you want to use for that plot.

If you leave expected cost blank, the app calculates it from the selected materials.

Example:

```text
Plot: Acre A
Method: Drip
Water source: Well + tank + pump
Selected materials: Pump, water tank, drip lines, connectors, hose, labour
```

Click:

```text
Create plan
```

---

# Step 4 — Add your crop catalog

Go to:

```text
Crop Catalog
```

Use this page to create the list of crops you actually grow.

You can select from prepared crop templates:

```text
Cucumber
Tomato
Bell pepper
Scotch bonnet pepper
Garden egg
Sweet corn
Plantain
```

Choose a template, then edit the fields.

For example, cucumber can be:

```text
African Giant
Darina
Greengo
Marketmore
```

The crop profile stores:

```text
Nursery duration
Days to harvest/maturity
Water need
Expected yield per acre
Market unit
Pest risks
Fertiliser stages
Care tasks
```

When you save a crop here, it becomes selectable on other pages.

---

# Step 5 — Add market prices

Go to:

```text
Market Prices
```

Enter prices you checked yourself.

Example:

```text
Crop: Cucumber
Market: Ibadan wholesale
Unit: kg
Price: 500
Date checked: today's date
Source: Buyer call
Confidence: Medium
```

You can use units like:

```text
kg
ton
crate
bag
basket
piece
bunch
```

The planting planner can use these price records to estimate revenue.

---

# Step 6 — Create planting plan

Go to:

```text
Planting Planner
```

Choose:

```text
Crop
Plot
Variety
Nursery date or planting date
```

If you leave transplant and harvest dates blank, the app calculates them from the crop profile.

Example:

```text
Crop: Cucumber
Plot: Acre A
Variety: African Giant
Planting date: 2026-07-01
```

If cucumber has 45 days to harvest, the app will calculate the expected harvest window.

Then enter:

```text
Seed cost
Fertiliser budget
Labour budget
Irrigation budget
Transport budget
Expected yield per acre
Market price
Market price unit
```

Click:

```text
Create planting plan
```

The app calculates:

```text
Expected yield
Expected revenue
Expected profit
Warnings
```

---

# Step 7 — Add workers

Go to:

```text
Workers
```

Add each worker.

Example:

```text
Name: Tunde
Role: Farm labourer
Employment type: Daily worker
Rate: ₦5,000
Phone: 080...
Skills: clearing, watering, spraying
```

You can edit or delete workers later.

---

# Step 8 — Assign tasks

Go to:

```text
Tasks
```

Create jobs such as:

```text
Clearing
Watering
Spraying
Fertiliser
Planting
Transplanting
Harvesting
Transport
Inspection
```

Assign the task to a worker and plot.

Example:

```text
Task: Clear Acre A
Type: Clearing
Plot: Acre A
Worker: Tunde
Due date: Friday
Priority: High
```

---

# Step 9 — Record salary and attendance

Go to:

```text
Salary & Payroll
```

Use this page to record:

```text
Attendance
Days worked
Salary adjustments
Advances
Deductions
Salary runs
Amount paid
Balance owed
```

This helps you know what each worker has earned and what remains unpaid.

---

# Step 10 — Use the AI assistant

Go to:

```text
Ask AI
```

You can type or use the microphone.

Try questions like:

```text
I want to set up a new 300 by 100 acre
How much will irrigation cost for Acre A?
What do I need before planting cucumber?
Best way to fight whiteflies
Which plot needs clearing?
Which costs are too high?
Show my payroll issues
```

If the app is missing data, the AI should tell you exactly what to add and show a button to open the correct page.

For example, if you ask irrigation cost before adding a plot, it should tell you:

```text
Set up a plot first
```

and show a button:

```text
Go to Farm Map
```

---

# Simple daily use

Each day, use the app like this:

1. Check Dashboard.
2. Ask AI: “What should I do today?”
3. Add or update tasks.
4. Record costs after buying anything.
5. Record observations such as pest attack, rain, disease or losses.
6. Update salary/attendance.
7. Check reports.

---

# Important rule

The app can only calculate properly when the data has been entered properly.

If a calculation looks wrong, check:

```text
Plot size
Irrigation material prices
Crop yield per acre
Market price unit
Input costs
Worker salary records
```
