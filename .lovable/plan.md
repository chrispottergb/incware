1. Repair the Annual Review snapshot loader so it can successfully read the latest meeting context without querying nonexistent meeting columns. The current loader requests `attendees` and `meeting_other` directly from `meetings`, which causes the meeting fetch to fail and leaves `officers`, `benefits`, and related meeting-derived sections empty even though the database has records.

2. Keep the existing fallback behavior for officers and benefits, but make it run on valid meeting rows only. After the loader fix, the snapshot should again pull the newest meeting with officer/benefit data for the company tied to the annual review link.

3. Update the Annual Review public page to remove the React ref warning in `EditField`. The current wrapper likely passes a ref into a non-forwardRef function component path; I’ll refactor the field wrapper so the page no longer emits the console warning while preserving the current UI behavior.

4. Adjust the read-only date row styling in the Annual Review page so long date values have enough room and don’t visually compress against the label. This will make the Incorporation Date and S-Election Date rows more resilient for full-length values.

5. Handle the malformed S-election date defensively in the UI. The current value in the database for this company is `0199-08-12`, so the displayed `August 12, 199` is coming from bad source data rather than width alone. I’ll add safe formatting behavior so obviously malformed dates don’t render misleadingly, and I’ll preserve the rest of the Annual Review workflow.

6. Validate the fix end-to-end by checking the annual review payload for the active token and confirming that officers and benefits populate in the page again, while the date rows render cleanly.

Technical details
- Files to update:
  - `supabase/functions/annual-review/index.ts`
  - `src/pages/AnnualReviewPublic.tsx`
- No schema changes.
- No Jotform changes.
- No snapshot UI redesign beyond the minimal date-row sizing/formatting needed.
- No unrelated Annual Review logic changes.