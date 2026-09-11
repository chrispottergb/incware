# Retention of Earnings and Distributions resolution

Additive only: two new tables, one new resolution type, an inline entry panel, and new PDF text. No existing rows are modified, nothing is backfilled, and meetings without this resolution print exactly as they do today.

## Pre-change findings

**a. How resolutions are stored.** One row per resolution in `meeting_resolutions`: `id`, `meeting_id` (FK to `meetings`), `purpose` (the resolution label), `resolution_text`, optional `lease_id` and `transaction_id`, `created_at`. Not an array or JSON field. Structured detail for a resolution therefore lives in its own side table today (the pattern used by leases, transfers, and charitable contributions).

**b. Annual meeting prefill.** `src/components/AnnualMeetingWizard.tsx` reads the prior annual meeting (`priorMeeting`) and pulls forward `meeting_financials`, `meeting_benefits`, `meeting_loans`, and `meeting_officers`, plus header fields (time, location, chairperson, secretary). On save it inserts into `meeting_officers`, `meeting_shareholders`, `meeting_counsel`, `meeting_financials`, `meeting_non_recurring_items`, `meeting_authorized_signers`, `meeting_loans`, `meeting_benefits`, `meeting_resolutions`, `meeting_vehicle_purchases`, `meeting_vehicle_leases`, `meeting_vehicle_sales`, `meeting_assets`.

**c. Distribution clause (`meeting-pdf-export.ts` ~2124/2170).** It prints only when at least one row in the meeting's shareholder list has `distribution_amount > 0`. Yes — `distribution_amount` is stored per meeting, on `meeting_shareholders`. The S wording is added when the time-aware helper says the company was S for that meeting, or the entity type is `LLC-S`.

**d. Meetings with no tax year.** Annual Meeting 8 of 96; Written Consent 6 of 18; Organizational Meeting 1 of 13; Shareholder Meeting 0 of 46; Special Meeting of Board of Directors 0 of 2; Annual Meeting of Members 0 of 1.

**e. Personal service corporation.** No such field exists. `companies` has only `business_purpose` and `naics_code`. The §531 warning will therefore state both credit amounts as written in the request, without trying to decide which applies.

## What gets built

**1. Schema.** `retained_earnings_resolutions` and `retained_earnings_reasons` exactly as specified, with `UNIQUE (company_id, fiscal_year)`, cascade delete from resolution to reasons, RLS matching the existing meeting sub-table pattern (owner-scoped through the company), and the required grants.

**2. Resolution type.** Add `"Retention of Earnings and Distributions"` to the Corporation, LLC, Single Member LLC, and Partnership base lists in `src/lib/resolution-types.ts`, categorized under Financial/Capital Transactions. It inherits into the derived S Corporation and LLC-S lists. Not added to Non-Profit. The stored value never changes; the display label resolves at render from entity type and time-aware S/C status:

- Corporation, C that year → "Retention of Earnings"
- Corporation, S that year → "Distributions and Retention of Earnings"
- LLC / LLC-S / Partnership → "Distributions to Members"
- Single Member LLC → "Distributions to Member"

**3. Entry panel.** A new component shown inline when this resolution is selected in `MeetingResolutions.tsx` and `WrittenConsentWizard.tsx`: fiscal year defaulted from the meeting's tax year and required (no tax year blocks saving with "Set the meeting's tax year before recording a retention resolution."); the three decision options; retained earnings as reported, reported by, and as-of date, labelled as reported by the accountant; repeatable reason rows with the seven Reg. §1.537-2(b) categories, required description, estimated cost, target date; prior-year follow-up listing the previous year's reasons read-only with a required status on each, saved as new rows carrying `carried_from_reason_id` and never copied into editable text; and a read-only total of the meeting's per-holder distribution amounts.

Advisory warnings, never blocking: the §531 accumulated-earnings notice for a C year at $200,000 or more; the §1361 disproportionate-distribution notice when any holder's share of the distribution total deviates from their ownership percentage by more than 0.5% in an S year; and the tax-distribution reminder for a multi-member LLC choosing to retain all.

**4. PDF.** In `meeting-pdf-export.ts`, when the resolution is present, print a WHEREAS reciting the fiscal year, reported retained earnings, and each reason with cost and target date; a follow-up paragraph for prior-year reasons and their statuses; and a RESOLVED matching the decision, worded from the time-aware classification. It prints before the existing distribution clause and does not repeat any distribution amounts.

**5. Prefill.** Both new tables are excluded from the annual meeting prefill; new meetings start with no retention resolution.

## Verification

- Non-Profit does not offer the resolution type.
- An S-elected corporation shows "Distributions and Retention of Earnings"; the same company's pre-election year shows "Retention of Earnings".
- A meeting with no tax year blocks the panel with the stated message.
- Prior-year reasons appear read-only, require a status, and are not copied into new editable rows.
- A meeting with both distributions and this resolution prints each set of figures once.
- A meeting without the resolution produces byte-identical output to today.
- Full test suite and production build, plus a list of every file changed.
