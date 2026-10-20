# Iteration 3 — Clean Editable Farm Data Flow

## What changed

This iteration removes the forced demo-data feel and makes Dinotinto Farm OS behave more like a real farm setup system.

The app now starts from a clean record set instead of loading pepper, workers, plots or materials that the user did not enter. The user can add their own records, delete records they do not want, and build calculations from real farm data.

## Main changes included

- Removed the old **Reset demo data** action from the top right.
- Changed the default Farm OS data to empty arrays.
- Added a dashboard **Clear all records and start fresh** action for when the user wants a completely clean setup.
- Added delete controls across the main records:
  - plots
  - irrigation materials
  - irrigation plans
  - land clearing plans
  - crops
  - planting plans
  - seed records
  - input costs
  - tasks
  - workers
  - salary runs
  - attendance records
  - salary adjustments
  - market prices
  - yield forecasts
  - observations
- Added explanatory text at the top of each main page so a complete novice knows what the page is for.
- Improved the irrigation workflow so the user can:
  - add materials from scratch
  - choose from prepared irrigation material templates
  - enter quantity, unit, unit cost, supplier and reusable/consumable status
  - delete unwanted material rows
  - select the exact material rows required for a particular plot or acre
  - let the app calculate the irrigation cost from selected rows, or override the amount manually
- Updated plot and crop selectors so empty states are clearer when no plot/crop has been added yet.

## Why this matters

The system should not calculate from sample data. It should calculate from the farm owner's actual records.

For example, if the user wants to irrigate Acre C, the correct flow is now:

1. Add Acre C in Farm Map.
2. Add the actual irrigation materials needed.
3. Select only those materials in the Irrigation Plan Builder.
4. Create the irrigation plan for Acre C.
5. The cost now comes from the user's own selected rows.

## Important note about existing deployed data

The app now starts clean for fresh users and fresh local storage. If an already deployed database contains old sample records, the Dashboard **Clear all records and start fresh** action should be used once after deployment. After that, the clean state will sync back to the database.

Codex should also check whether the deployed database was previously seeded with sample data. If it was, do not reseed demo records after this iteration unless the user specifically asks for demo data.
