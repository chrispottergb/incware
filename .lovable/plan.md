## Update Annual Review empty-state copy

The Annual Review page already separates the historical snapshot (rendered earlier on the page) from the user's new entries (stored in the `edits` state arrays — `edits.assets`, `edits.loans`, `edits.contributions`). The empty-state messages in the new-entry sections currently read "on file", which sounds like they're describing the historical record. Update them to reflect that these are this year's new additions.

### Changes — `src/pages/AnnualReviewPublic.tsx`

Three text-only edits (logic already correctly references the new-entry arrays):

- Line 701: `No vehicles or equipment on file.` → `No new vehicles or equipment added this year.`
- Line 730: `No loans on file.` → `No new loans added this year.`
- Line 750: `No agreements on file.` → `No new agreements or contributions added this year.`

### Not changed

- Snapshot data, snapshot UI, and historical record rendering
- Database schema
- Jotform integration
- Any conditional logic (the existing `edits.assets.length === 0` checks already target new entries, not the snapshot)