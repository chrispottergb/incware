# Financial Summary: "COG/Expenses" Label + COG Ratio Chart Fix

Scope: `src/components/meeting/MeetingFinancials.tsx` (display only — no schema, no field names, no calculation changes).

## 1. Label change

Rename the display label "Expenses" to "COG/Expenses" in:
- The summary table row (the non-COGS branch of the field list).
- The "Annual Financial Comparison" bar chart x-axis category for that bar (currently "COG" or "Expenses" depending on mode) — use "COG/Expenses" for the expenses branch.
- Chart tooltip/legend text follows the same category name automatically.

Underlying keys (`current_expenses`, `previous_expenses`) and Gross Profit math stay untouched.

## 2. COG Ratio chart bug

Confirmed cause: the chart data is built only from `current_cog_ratio` / `previous_cog_ratio`. When the entity has no Cost-of-Goods figure (service-style entry), the summary table computes and stores the value in `current_expense_ratio` instead, so both chart bars fall back to 0 and render "0.00%" — even though the table shows 65.09%.

Fix:
- Build each year's ratio using the same value the summary row displays: use the year's COG ratio when present, otherwise that year's expense ratio (both derived from amount ÷ total sales, matching the existing calculation).
- Treat a year with no ratio as missing (null) rather than 0, so no misleading 0.00% bar or label is drawn.
- When Previous Year has no data, still render the Current Year bar, and show "No previous data available" in place of the previous-year bar/label.
- Card title switches to "Annual COG/Expense Ratio Comparison" when the expense branch is in effect, so the chart heading matches the row it mirrors.

## Verification

Open the meeting's Financials tab with current sales + expenses entered and no previous year, and confirm the ratio chart shows the same percentage as the Expense Ratio row (65.09%) with the previous-year side marked as having no data.
