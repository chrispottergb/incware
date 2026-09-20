# Nonprofit financial reporting

A new Financial Statements area for non-profit organizations, keyed to the federal return they actually file. For-profit companies are untouched: their meeting Financial Comparison card, auto-fill from prior meetings, Edited badge, re-sync, number formatting and Non-Recurring Items all behave exactly as today.

## Confirmed current state

- Non-profits are already identified by the entity type "Non-Profit"; no new classification field is needed.
- `companies` already has `fiscal_year_end`. It does not have a 990 form type field.
- `nonprofit_form990_filings` already exists (year, form version, date filed, status) for filing history — it holds no financial figures, so the new statement data is separate.
- The five-row Financial Comparison card lives inside the meeting (`MeetingFinancials`, table `meeting_financials`) and is for-profit shaped (sales, cost of goods, expenses, net income).
- `meetings` has a `document_status` column, but today only written consents ever set it to draft/final — ordinary meetings never write it. A finalize action for meeting minutes therefore has to be added as part of this work (see item 8).

## What gets built

**1. Form type on the organization.** A new "IRS Form Filed" selector on the non-profit company record: 990, 990-EZ, 990-N, 990-PF, or none. Fiscal year end stays where it is. Never guessed from the name. If no form type is chosen, the financial section asks for one before anything renders.

**2. New "Financial Statements" tab** on non-profit companies only, placed next to Tax Exemption. One record per organization per fiscal year, all money fields optional so a part-finished year still saves. Each record carries: fiscal year (the year the period ends in), period start and end, audited flag, draft/final, return filed date, documented date, board reviewed date, and a per-value source tag (tax return, audited financials, internal, manual) shown as a small badge.

The fiscal year is a whole number chosen from a numeric picker, never typed free-form; it is suggested from the organization's fiscal year end and today's date, and is editable. Only one record per organization per fiscal year is allowed. A display label ("FY2025") defaults from the year and can be overridden for presentation only — nothing is looked up by it.

**3. Four blocks** (row label, Current Year, Prior Year, YoY %), totals bolded and ruled, the 990 line reference on hover:

- Support & Revenue — contributions & grants, program service revenue, membership dues, investment income, special events net, in-kind, other, total.
- Expenses by Function — program services, management & general, fundraising, total.
- Net Assets — beginning, change, end; indented beneath: without and with donor restrictions.
- Oversight Ratios — four small cards: program expense ratio, fundraising efficiency ("$X.XX cost per $1.00 raised"), months of operating reserve, revenue concentration. A card with missing inputs is hidden, never shown as 0% or a dash. No colors, no pass/fail. Formula on hover.

Prior Year comes from the record for the previous fiscal year number, and is blank when there isn't one.

**4. Form-type behavior.** 990: everything. 990-EZ: revenue and net assets only, one Total Expenses line, functional split rows removed entirely, with the note "Form 990-EZ does not report a functional expense allocation." 990-N: no statement at all — only a confirmation block (fiscal year, gross receipts under the threshold, board acknowledgment). 990-PF: "Private foundation reporting (Form 990-PF) is not yet supported."

**5. Reconciliation checks on save.** Warn, never block. Beginning + change = ending; revenue − expenses = change; functional split = total expenses (990 only); revenue detail = total revenue; without + with = ending; assets − liabilities = ending; and this year's beginning = last year's ending, flagged prominently. The cross-year check is skipped silently when there is no prior-year record — that is not a failure. Tolerance $10 or 0.1% of ending net assets, whichever is larger. Failures appear in a dismissible panel showing both sides and the difference; dismissals are stored with the record along with who accepted them.

**6. One chart.** A single horizontal stacked bar of functional expense allocation, current year above prior year, three segments labeled with dollars and percentage. No revenue-vs-expense bars, no ratio bars. Hidden for 990-EZ, 990-N, and whenever the functional split is incomplete.

**7. Statement header** on screen and in export: legal name, "Statement of Activities and Changes in Net Assets", fiscal year ended, source line, Draft/Final, documented date, and board reviewed date or "Pending Review". Fiscal year and documentation date stay separate fields, never merged into a sentence.

When both the return filed date and the board review date are present, the header compares them:

- Review on or before filing: "Reviewed by the governing body prior to filing on [filed date]."
- Review after filing: "Ratified and adopted as filed. Return filed [filed date]; reviewed and adopted by the governing body [review date]." plus an informational (not warning) note: "Board review occurred after the return was filed. This record supports ratification of the return as filed; it does not evidence pre-filing review under Form 990 Part VI."

"Reviewed" is used only for the pre-filing case and "ratified and adopted" only for the post-filing case, on screen, in the PDF and in any generated minutes wording. No review date shows "Pending Review"; no filing date skips the comparison.

**8. In the meeting.** A draft non-profit meeting reads the matching fiscal year's statement live, so edits show immediately. Finalizing the minutes freezes them: the complete figure set and header block are copied into the meeting as an immutable snapshot, and a finalized meeting always renders from that copy — never from the live statement. Un-finalizing clears the snapshot and returns to live reading; finalizing again writes a fresh one. If the statement is later deleted, the finalized meeting still prints correctly, and deleting a statement used by any finalized meeting warns first and never removes the snapshot.

Because ordinary meetings have no finalize action today, this work adds a "Finalize minutes" / "Return to draft" control on the meeting, using the existing document status field.

If the statement is edited after a meeting was finalized, those meetings show: "The FY[year] statement has been amended since this meeting was finalized. These minutes show the figures as reviewed on [meeting date]. A ratification of the amended figures may be required." The same notice appears on the statement, listing each affected finalized meeting with links. Nothing auto-updates and there is no one-click sync — the remedy is a new board action.

**9. Existing figures on non-profit meetings.** Old for-profit-shaped rows on non-profit meetings are left exactly as they are: never migrated, mapped, or deleted. A finalized non-profit meeting that has those figures and no new snapshot keeps showing the original five-row card with a note above it: "This meeting predates nonprofit financial statement reporting. Figures shown are as originally recorded." A draft non-profit meeting shows the new format, or the create prompt when no statement exists for that year.

**10. Export.** PDF first, carrying the full header, the 990 line reference column, the source badge per value, and any dismissed warnings as a footnote. Spreadsheet and CSV are a later pass.

## Entity type changes

Changing a company away from Non-Profit when statements exist warns first: "This company has [n] saved financial statement(s). Changing the entity type will hide the Financial Statements tab. The records will be retained and will reappear if the entity type is changed back." Statements are never deleted or cascaded, and finalized meeting snapshots keep rendering regardless.

## Technical notes

- Migration: add `irs_form_type text` to `companies`; create `nonprofit_financial_statements` (company_id FK cascade, `fiscal_year integer not null`, fiscal_year_label display-only, period_start/end, is_audited, is_draft, return_filed_date, documented_date, board_reviewed_date, the 19 numeric figures, `source_tags jsonb`, `dismissed_warnings jsonb`, timestamps) with `UNIQUE (company_id, fiscal_year)` — no unique constraint on the label — owner-scoped RLS through `companies.user_id`, grants to authenticated and service_role, and an updated_at trigger. No CHECK constraints on the text enums, matching the existing pattern.
- Migration: create `meeting_financial_snapshots` (meeting_id FK cascade, `source_statement_id` FK with ON DELETE SET NULL so statement deletion never removes the snapshot, `source_statement_updated_at`, `snapshot_data jsonb`, `snapshotted_at`), same RLS/grant pattern.
- New `src/lib/nonprofit-financials.ts`: exports `NONPROFIT_ENTITY_TYPES = ["Non-Profit"]` and `isNonprofit(company)` (trimmed, case-insensitive), plus pure field-visibility, ratio, header-wording and reconciliation logic. Every gate — `MeetingFinancials`, `CompanyDetail` tabConfig, the company nav, the tab component — calls `isNonprofit()`; no entity-type string literal for this purpose remains elsewhere. Unit tests in `src/test/` cover the helper (including near-miss values that must return false), prior-year resolution, the continuity skip, ratio suppression and the review/filing wording.
- New `src/components/company/NonprofitFinancialStatementsTab.tsx` and a read-only display component reused by `MeetingFinancials`; the existing for-profit branch of `MeetingFinancials` is left byte-identical.
- New `src/lib/nonprofit-financial-statement-pdf.ts` following the existing PDF standards (Arial, steel-blue headers, binder margin).

## Verification

- A 990 non-profit shows all four blocks, prior-year column filled from the previous year, and the stacked bar.
- 990-EZ hides the functional rows and the chart and shows the note; 990-N shows only the confirmation block; 990-PF shows the unsupported message.
- An unbalanced entry lists every broken check with both sides and still saves; the continuity check is skipped, not failed, with no prior record.
- Two statements cannot be saved for the same organization and fiscal year; prior year resolves correctly for a non-calendar fiscal year.
- Finalizing a non-profit meeting writes a snapshot; editing the statement afterward does not change the finalized figures and surfaces the amendment notice on both the meeting and the statement.
- Un-finalizing clears the snapshot and resumes live reads; deleting a referenced statement warns and the meeting still renders.
- Changing entity type away from Non-Profit warns and retains statements; changing it back restores the tab with data intact.
- Review before filing renders review wording; review after filing renders ratification wording plus the informational note.
- A legacy non-profit meeting with old figures still renders its original card with the note.
- A for-profit meeting renders exactly as before; tests, type check and production build pass.
