# Nonprofit financial reporting

A new Financial Statements area for non-profit organizations, keyed to the federal return they actually file. For-profit companies are untouched: their meeting Financial Comparison card, auto-fill from prior meetings, Edited badge, re-sync, number formatting and Non-Recurring Items all behave exactly as today.

## Confirmed current state

- Non-profits are already identified by the entity type "Non-Profit"; no new classification field is needed.
- `companies` already has `fiscal_year_end`. It does not have a 990 form type field.
- `nonprofit_form990_filings` already exists (year, form version, date filed, status) for filing history — it holds no financial figures, so the new statement data is separate.
- The five-row Financial Comparison card lives inside the meeting (`MeetingFinancials`, table `meeting_financials`) and is for-profit shaped (sales, cost of goods, expenses, net income).
- Non-profit companies already get their own tabs (Tax Exemption, Bylaws, Conflict of Interest) driven by entity type.

## What gets built

**1. Form type on the organization.** A new "IRS Form Filed" selector on the non-profit company record: 990, 990-EZ, 990-N, 990-PF, or none. Fiscal year end stays where it is. Never guessed from the name. If no form type is chosen, the financial section asks for one before anything renders.

**2. New "Financial Statements" tab** on non-profit companies only, placed next to Tax Exemption. One record per fiscal year, all money fields optional so a part-finished year still saves. Each record carries: period start and end, audited flag, draft/final, return filed date, documented date, board reviewed date, and a per-value source tag (tax return, audited financials, internal, manual) shown as a small badge.

**3. Four blocks** (row label, Current Year, Prior Year, YoY %), totals bolded and ruled, the 990 line reference on hover:

- Support & Revenue — contributions & grants, program service revenue, membership dues, investment income, special events net, in-kind, other, total.
- Expenses by Function — program services, management & general, fundraising, total.
- Net Assets — beginning, change, end; indented beneath: without and with donor restrictions.
- Oversight Ratios — four small cards: program expense ratio, fundraising efficiency ("$X.XX cost per $1.00 raised"), months of operating reserve, revenue concentration. A card with missing inputs is hidden, never shown as 0% or a dash. No colors, no pass/fail. Formula on hover.

Prior Year is pulled automatically from the previous fiscal year's saved record, and is blank when none exists.

**4. Form-type behavior.** 990: everything. 990-EZ: revenue and net assets only, one Total Expenses line, functional split rows removed entirely, with the note "Form 990-EZ does not report a functional expense allocation." 990-N: no statement at all — only a confirmation block (fiscal year, gross receipts under the threshold, board acknowledgment). 990-PF: "Private foundation reporting (Form 990-PF) is not yet supported."

**5. Reconciliation checks on save.** Warn, never block. Beginning + change = ending; revenue − expenses = change; functional split = total expenses (990 only); revenue detail = total revenue; without + with = ending; assets − liabilities = ending; and this year's beginning = last year's ending, flagged prominently. Tolerance $10 or 0.1% of ending net assets, whichever is larger. Failures appear in a dismissible panel showing both sides and the difference; dismissals are stored with the record along with who accepted them.

**6. One chart.** A single horizontal stacked bar of functional expense allocation, current year above prior year, three segments labeled with dollars and percentage. No revenue-vs-expense bars, no ratio bars. Hidden for 990-EZ, 990-N, and whenever the functional split is incomplete.

**7. Statement header** on screen and in export: legal name, "Statement of Activities and Changes in Net Assets", fiscal year ended, source line, Draft/Final, documented date, and board reviewed date or "Pending Review". Fiscal year and documentation date stay separate fields, never merged into a sentence.

**8. In the meeting.** For a non-profit, the meeting shows the matching fiscal year's statement read-only (header, blocks, ratios, chart) in place of the five-row comparison card, with a link to the tab to edit. If no record exists for that year, a short prompt to create one.

**9. Export.** PDF first, carrying the full header, the 990 line reference column, the source badge per value, and any dismissed warnings as a footnote. Spreadsheet and CSV are a later pass.

## Technical notes

- Migration: add `irs_form_type text` to `companies`; create `nonprofit_financial_statements` (company_id FK cascade, fiscal_year_label, period_start/end, is_audited, is_draft, return_filed_date, documented_date, board_reviewed_date, the 19 numeric figures, `source_tags jsonb`, `dismissed_warnings jsonb`, timestamps) with unique (company_id, fiscal_year_label), owner-scoped RLS through `companies.user_id`, grants to authenticated and service_role, and an updated_at trigger. No CHECK constraints on the text enums, matching the existing pattern.
- New `src/lib/nonprofit-financials.ts` for pure field-visibility, ratio and reconciliation logic, unit tested in `src/test/`.
- New `src/components/company/NonprofitFinancialStatementsTab.tsx` and a read-only display component reused by `MeetingFinancials` when `entity_type === "Non-Profit"`; the existing for-profit branch of `MeetingFinancials` is left byte-identical.
- New `src/lib/nonprofit-financial-statement-pdf.ts` following the existing PDF standards (Arial, steel-blue headers, binder margin).
- Tab registered in `CompanyDetail` `tabConfig` and the company nav, gated on Non-Profit.

## Verification

- A 990 non-profit shows all four blocks, prior-year column filled from the previous year, and the stacked bar.
- 990-EZ hides the functional rows and the chart and shows the note; 990-N shows only the confirmation block; 990-PF shows the unsupported message.
- A deliberately unbalanced entry lists every broken check with both sides and still saves.
- Cross-year continuity mismatch is flagged.
- A for-profit meeting renders exactly as before.
- Tests, type check and production build pass.
