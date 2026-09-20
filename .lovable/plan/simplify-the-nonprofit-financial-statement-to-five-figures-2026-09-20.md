# Simplify the nonprofit financial statement to five figures

Remove the Form 990 detail ("Tier 2") from the nonprofit financial statement screen, the on-screen preview, and the PDF. Nothing is removed from the database — any detail already saved stays stored, untouched, and would reappear if the detail section is ever brought back.

## What changes on screen

The entry form keeps its header (Fiscal Year, Display Label, Return Filed, Final, Period with irregular-period override, read-only Board Reviewed, Source) and then shows only:

```text
Total Revenue             [entered]
Total Expenses            [entered]
Change in Net Assets      = revenue - expenses
Net Assets, Beginning     [entered]
Net Assets, End of Year   = beginning + change
```

- Total Revenue and Total Expenses are always directly typeable; the populate-and-lock behaviour goes away.
- The "Add detail from Form 990" collapsible section is removed entirely (revenue detail, expenses by function, restriction split, total assets, total liabilities).

## What changes in the document

- Title becomes "Annual Financial Review" (it is no longer a full statement of activities).
- Header block stays exactly as it is now.
- One table only: the five figures with Current Year, Prior Year, YoY %.
- No table or block prints when every current-year value in it is empty. A statement with nothing entered prints the header plus a short empty-state line instead of a table of dashes.

## Ratios, chart, warnings

- Remove Program Expense Ratio, Fundraising Efficiency, and Revenue Concentration.
- Keep Months of Operating Reserve, recomputed as ending net assets / (total expenses / 12) and relabelled "Months of Operating Reserve (total net assets basis)".
- Remove the functional expense bar chart.
- Keep only the cross-year continuity check (this year's beginning net assets vs last year's ending), shown prominently, silently skipped when there is no prior year, and still dismissible with dismissals stored.

## Form types

990 and 990-EZ now render identically; the 990-EZ "no functional expense allocation" note is removed. 990-N (confirmation block) and 990-PF (unsupported message) are unchanged. The IRS form field stays.

## Existing records

Statements already holding detail figures keep them in the database, invisible. No clearing, no migration, no "hidden data" badge.

## Technical notes

- No migration. All Tier 2 columns in `nonprofit_financial_statements` remain.
- `src/lib/nonprofit-financials.ts`: keep `REVENUE_FIELDS`, `FUNCTIONAL_EXPENSE_FIELDS`, `NET_ASSET_FIELDS`, the 990 line references, and the Tier 2 reconciliation checks exported and unit-tested, each marked `// Retained for Tier 2 (Form 990 detail) reintroduction. Not currently called from the UI.` Add a board-review field list, trim `runReconciliation` callers to check G only, and adjust `computeRatios` to the single reserve ratio. Simplify `getFormVisibility` so 990 and 990-EZ match.
- `NonprofitFinancialStatementsTab.tsx`: drop `TIER2_KEYS`, `tier2Open`, the detail JSX and the lock logic; save payload continues to write all money keys so stored detail is preserved untouched.
- `NonprofitStatementView.tsx`: single table, no chart, ratio row only when a card exists.
- `nonprofit-financial-statement-pdf.ts`: retitle, single table, skip empty tables, empty-state line.
- Tests in `src/test/nonprofit-financials.test.ts` extended for the new visibility, ratio, reconciliation and empty-statement behaviour; retained Tier 2 functions stay covered. Verify with typecheck, test run, build, and a live check on the company page.
