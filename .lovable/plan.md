## What I found

I read the live record for this company and the current code:

- DB row for company `46430db4…`: `eligibility_result = 'Pass'`, `eligibility_run_date = 2026-05-21`, `eligibility_answers = NULL`.
- The `eligibility_answers jsonb` column exists. The `nonprofit_tax_exemption` table has a `UNIQUE (company_id)` constraint, so the upsert with `onConflict: "company_id"` works.
- `Form1023EZScreener` already builds `nextAnswers` and calls `onComplete("Pass" | "Fail", date, nextAnswers)`.
- `TaxExemptionTab.save({ eligibility_result, eligibility_run_date, eligibility_answers: answers })` already writes all three fields together.

The persisted row is a **legacy Pass from before the answer-saving code shipped** (run on 2026-05-21, before today's changes). That's why every row in the View modal correctly shows "—": no answers were ever stored for that historical run. New runs from the current build should save all 34 answers — but the UI gives no signal that the displayed result is a legacy result with no audit trail, so it looks broken.

## Fix plan

1. **Add a console-logged confirmation on save** in `TaxExemptionTab.save` for the screener payload only, so future regressions are obvious in the network/console tab. (Cheap diagnostic, no UX impact.)

2. **Surface the legacy "no answers stored" state in the View Screener Results modal** (`Form1023EZResultsView.tsx`):
   - If `eligibility_result` exists but `eligibility_answers` is null or empty, render an amber notice at the top of the modal: *"This result was recorded before per-question answers were saved. Re-run the screener to capture a full audit trail."*
   - Keep the existing per-question table (all "—") and the Re-run Screener button.

3. **Same notice on the Tax Exemption tab itself**, inline next to the screener buttons, so the user sees it without opening the modal — only shown when `eligibility_result` is set and `eligibility_answers` is null/empty.

4. **No schema changes.** The column and unique constraint are already in place.

5. **Verify end-to-end after the edit**:
   - Open the screener on the current company, answer all 34 "No", confirm Pass.
   - Re-query the row and confirm `eligibility_answers` is a populated JSON object with 34 keys.
   - Open the View Screener Results modal and confirm every row shows "Yes"/"No" (not "—").
   - Trigger a Fail path (answer "Yes" on Q1) and confirm `eligibility_answers` contains `{"1":"Yes"}` and the modal shows that single answer plus "—" for the rest.

## Technical notes

- Files touched: `src/components/company/Form1023EZResultsView.tsx`, `src/components/company/TaxExemptionTab.tsx`. No new files, no migration.
- The amber notice uses existing `border-amber-300 bg-amber-50 text-amber-900` styling already used elsewhere in this tab.
- Detection rule for "no answers stored": `!answers || Object.keys(answers).length === 0`.
