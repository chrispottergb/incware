# Prompt 1 — Remove the write-only "Next Annual Meeting" field from the UI

Non-destructive UI cleanup. The `meetings.next_annual_mtg` column stays in the database; no rows are modified or deleted.

## What we know

- `rg -n "next_annual_mtg" src/ supabase/functions/` currently returns hits only in:
  - `src/integrations/supabase/types.ts` (generated Row/Insert/Update types)
  - `src/components/meeting/MeetingInfoCard.tsx`
  - `src/components/company/MeetingsTab.tsx`
- No PDF generator, dashboard, report, timeline, or edge function reads this column.
- The nonprofit "Next Annual Meeting" mechanism is separate: it lives in `meetings.nonprofit_governance.nextMeetingDate` and must remain untouched.

## Changes

### 1. `src/components/meeting/MeetingInfoCard.tsx`

- Remove the "Next Annual Meeting" `DatePickerField` from Row 2 of the Meeting Information card (the last field after Chairperson, Secretary, Others Present, and Prior Meeting Date).
- Update the Row 2 code comment so it no longer lists "Next Annual Meeting".
- Leave Prior Meeting Date, Chairperson, Secretary, Others Present, and all save handlers unchanged.
- Let the remaining Row 2 fields reflow naturally.

### 2. `src/components/company/MeetingsTab.tsx`

- Remove the "Next Annual Meeting" `DatePickerField` from the 2-column grid it shares with "Prior Meeting Date". Prior Meeting Date remains and should occupy the row cleanly.
- Remove `next_annual_mtg: ""` from `defaultForm()`.
- Remove `next_annual_mtg: form.next_annual_mtg || null` from the `meetings` insert payload.
- Remove the `next_annual_mtg: ""` reset lines from both `prefillFromLastAnnual` and `prefillFromLastStatutoryClose`.

## Explicitly out of scope

- Do NOT drop the `meetings.next_annual_mtg` column.
- Do NOT modify `src/integrations/supabase/types.ts`.
- Do NOT change `src/lib/meeting-pdf-export.ts`, `src/lib/annual-meeting-pdf.ts`, or `src/lib/record-book-pdf.ts`.
- Do NOT change `src/lib/nonprofit-annual-meeting-pdf.ts`, `NonProfitGovernanceStep.tsx`, or the `meetings.nonprofit_governance` JSONB column.

## Verification

1. Re-run `rg -n "next_annual_mtg" src/ supabase/functions/` — only `src/integrations/supabase/types.ts` should remain.
2. Open an existing Annual Meeting: Meeting Info tab renders without the field and without a layout gap; other fields still save.
3. Open a Written Consent: unchanged (field was already hidden there).
4. Create a new meeting from the New Meeting dialog: saves successfully with no console error about a missing key.
5. Generate a corporate annual meeting PDF and a nonprofit annual meeting PDF: content is byte-for-byte unchanged from before this change.

## Note on Prompt 2

Prompt 2 will be sent only after Prompt 1 is verified working. It is not part of this plan.