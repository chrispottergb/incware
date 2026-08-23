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

- Remove the "Next Annual Meeting" `DatePickerField` from Row 2 of the Meeting Information card — the single `w-[145px]` block containing `value={meeting.next_annual_mtg ?? ""}` and its `onChange` handler.
- Update the Row 2 code comment so it no longer lists "Next Annual Meeting".
- Leave Prior Meeting Date, Chairperson, Secretary, Others Present, and all save handlers unchanged. `handleDateChange` stays — it is still used by `meeting_date` and `prior_mtg_date`.
- Let the remaining Row 2 fields reflow naturally in the flex row.
- Do not touch the `textFields` or `companyFields` arrays.

### 2. `src/components/company/MeetingsTab.tsx`

- Remove the "Next Annual Meeting" `DatePickerField` from the two-column grid it shares with "Prior Meeting Date".
- That grid now has a single occupant, and Prior Meeting Date is itself conditionally hidden for organizational meetings — so handle both cases: no orphaned empty grid cell, and no empty grid container rendering when neither field shows.
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
2. Open an existing Annual Meeting: Meeting Info tab renders without the field and without a layout gap; every other field still saves.
3. Open a Written Consent: unchanged (the field was already hidden there).
4. Create a new meeting from the New Meeting dialog, both as an Annual Meeting and as an Organizational Meeting: each saves with no console error and no empty or broken grid.
5. Generate a corporate annual meeting PDF and a nonprofit annual meeting PDF: the rendered content is unchanged — same sections, same numbering, same text. Do not compare file bytes; jsPDF embeds a creation timestamp, so byte comparison always differs.

## Note on Prompt 2

Prompt 2 will be sent only after Prompt 1 is verified working. It is not part of this plan.