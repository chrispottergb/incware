Scope

Modify exactly one file: `src/pages/MeetingDetail.tsx`.

Change exactly three existing `isShareholderMeeting` conditions to `isShareholderMeeting && !isStatutoryCloseShareholderMeeting`:

1. Line 1094 — the PDF column header array for the Print Preview button.
2. Lines 1104–1107 — the PDF body row data that includes Distribution Amount and Additional Capital Contribution.
3. Lines 1124–1127 — the UI `MeetingSubTable` columns definition.

Behavior

- Annual Meeting of Directors: continues to show the "Distribution" and "Add'l Capital" columns unchanged.
- Standard Annual Meeting of Shareholders: continues to hide those columns unchanged.
- Statutory Close Corporation shareholder meeting (sub_type === "Statutory Close Corporation"): now shows the two columns, matching the Directors meeting behavior.

Out of Scope

- No changes to `src/lib/meeting-pdf-export.ts` or any other file.
- No changes to column labels, data types, formatting, or underlying database fields.
- No changes to the `MeetingSubTable` component itself.