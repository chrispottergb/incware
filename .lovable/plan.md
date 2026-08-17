# Ratification of Actions Taken During the Year

Additive feature: capture the informal decisions a company made during the year, review them in one dialog on the way to printing the annual minutes, and print them as a dated, itemized ratification section.

## What the user will see

1. On an Annual Meeting, clicking Preview / PDF / Print Full Minutes first opens a dialog: "What happened this year?"
2. The dialog lists what the app already knows happened in the period (assets, leases, loans, agreements, bank signers, benefit plans), each with a plain-English sentence, date, amount, and source badge — all checked by default.
3. Related-party items (e.g. a lease from an owner) sit in their own group, flagged, with a toggle to clear the flag.
4. The user can add items by hand (date optional, one sentence, amount, category, related-party checkbox).
5. Items already covered by a written consent appear in a collapsed "Already documented" panel and can never be ratified again.
6. Continue saves the choices and proceeds to the original print/preview action. Reopening later shows the saved choices, not a fresh guess.
7. The minutes gain a new section, "Ratification of Actions Taken During the Year", with a dated table, a relate-back resolution, an "Interested Transactions" sub-section when applicable, and a Schedule A page when the list exceeds ten rows. With nothing selected it prints one sentence saying no actions were presented.

## Data model

Two new tables, RLS and GRANTs mirroring `meeting_resolutions`, plus the standard `update_updated_at_column` trigger.

- `interim_actions` — company-scoped: `company_id`, nullable `action_date`, `description`, `category`, `amount`, `is_related_party`, `source_table`, `source_id`, timestamps. Index on `company_id`; partial unique index on `(company_id, source_table, source_id)` so a source record can never be swept twice.
- `meeting_ratifications` — join: `meeting_id`, `interim_action_id`, `disposition` ('ratified' | 'excluded'), `sort_order`, timestamps, unique `(meeting_id, interim_action_id)`. Unchecking persists as `excluded` rather than deleting, so skipped items stay skipped.

Neither table is added to `cloneSubTables` in `src/components/company/MeetingsTab.tsx` (verified: the clone list is `meeting_officers`, `meeting_directors`, `meeting_shareholders`, `meeting_counsel`, `meeting_authorized_signers`, `meeting_benefits`, `meeting_loans`, `agreements`, `meeting_other`). `meeting_other` is not reused for this data.

## Candidate discovery — `src/lib/interim-actions.ts` (new, pure TS)

Given a company and a date range, produce descriptors `{ sourceTable, sourceId, actionDate, description, amount, category, isRelatedParty }` from only the tables that carry a real event date:

| Source | Date column | Category |
| --- | --- | --- |
| `asset_transactions` | `date` | Asset (purchase / vehicle_sale / lease / lease_termination wording) |
| `company_assets` where `asset_type = 'lease'` | `lease_date` → `lease_start_date` | Lease |
| `meeting_loans` | `loan_date` → `start_date` | Loan |
| `agreements` | `agreement_date` | Agreement |
| `bank_authorized_signers` | `effective_date` | Banking |
| `meeting_benefits` | `new_plan_effective_date` | Other |

No `created_at` is ever used as an action date. Tables without an event date (`meeting_amendments`, `meeting_officers`, `meeting_shareholders`, `meeting_counsel`, `company_banks`, `meeting_authorized_signers`, `meeting_resolutions`, `meeting_directors`, `meeting_other`) are not auto-suggested; those items are typed in by hand.

Related-party suggestion: on a lease candidate, normalized case-insensitive match of landlord name or address against shareholder/member names and addresses or the company's own address. Always editable.

Suppression: candidates already materialized into `interim_actions`, and source records already covered by a `Written Consent` meeting (shown in the "Already documented" group with the consent date).

## Sweep dialog — `src/components/meeting/RatificationSweep.tsx` (new)

No meeting sub-tab is added, removed, or reordered; `allSubTabs` in `src/pages/MeetingDetail.tsx` stays at its current 15 entries. The dialog is wired in front of the existing `PrintPreviewButton` actions on Annual Meetings only, and calls through to the original handler on Continue.

Sections: header with counts; editable period defaulting to (prior_mtg_date + 1 day) → meeting_date, falling back to Jan 1 of `tax_year`; "Found in your records"; "Needs separate treatment" (related party); "Added by you"; "+ Add an action"; collapsed "Already documented"; footer note that unchecking everything is a valid answer. Plain wording on screen — the word "ratification" stays in the printed document.

## Printed output

`src/lib/meeting-pdf-export.ts` — new section inserted after "Other Notes" and before "Registered Agent Confirmation", using the existing `section()` closure, `addWhereasResolved`, `addSubHeading`, the existing indent constants, and the Capital Assets table style. Entity wording comes from `src/lib/entity-terminology.ts`. Date | Action | Amount table sorted ascending with undated items ("During the year") last; more than ten rows becomes a Schedule A reference plus a Schedule A page after the signature block. Related-party items print only in the "Interested Transactions" sub-section. Empty state prints the single explanatory sentence.

Two other edits in the same file:
- Remove the blanket WHEREAS/RESOLVED ratification pair from the Annual Meeting branch of "Call to Order & Approval of Prior Meeting Minutes" (around lines 1817-1823). The Shareholder-meeting blanket ratification and the prior-minutes approval resolution are untouched.
- Add one FURTHER RESOLVED to "General Authorization" granting prospective ordinary-course authority; the existing RESOLVED is unchanged.

`src/lib/annual-meeting-pdf.ts` — same section between Section 13 "Special Resolutions" and Section 14 "Registered Agent Confirmation", using that file's `whereasPara` / `resolvedPara` and `indent = 36`, member wording.

`src/lib/nonprofit-annual-meeting-pdf.ts` — narrative section after "Other Business" using only `para()` and `bullets()`: lead paragraph naming the period, "{date} — {description}" bullets, closing sentence that the Board reviewed and ratified each action as of the date taken. Board wording only.

Not added to Written Consents, Special, or Organizational meetings.

## Verification

Manual pass in the preview against a real annual meeting: empty state, in-period vs out-of-period records, unchecking persistence across reopen and across a newly created meeting, written-consent exclusion, related-party routing, 10 vs 11 row Schedule A behavior, and correct wording for Corporation, S-Corp, LLC, Single Member LLC, and Non-Profit. Plus §15 showing both resolutions, shareholder meetings keeping the blanket ratification, and typecheck + existing test suite green.

## To report, not fix

Confirm and report the asymmetry in `addWhereasResolved()` (line 760): the blue-theme branch has a "that " guard while the non-blue branch's `fullResolved = resolvedPrefix + resolvedBody` has none. No change in this pass.
