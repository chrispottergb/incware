# Fix annual-meeting due anchoring across year boundaries

## Problem

The next due date is currently anchored to `lastAnnualMeetingDate.getFullYear() + 1`. When the bylaw month sits next to the year boundary (e.g. 1st Tuesday in January), a meeting held a few days early lands in the prior calendar year and the function reports the occurrence it already satisfied as overdue.

## Change

In `getAnnualMeetingStatus()` (src/hooks/useAnnualMeetingsDue.ts), replace the `year + 1` line with occurrence matching:

1. Resolve the scheduled occurrence for the last meeting's year minus 1, that year, and that year plus 1, skipping any the resolver returns null for.
2. Pick the candidate with the smallest absolute whole-day difference from the last meeting date — that is the satisfied occurrence. On an exact tie, prefer the earlier candidate.
3. `dueDate = resolveScheduledDate(..., satisfiedYear + 1)`.
4. If no candidate resolves, keep the existing unscheduled fallback.

Downstream logic (days-until comparison, OVERDUE / DUE_SOON / SCHEDULED) and the NOT_REQUIRED, UNSCHEDULED and NEVER_HELD branches are untouched. Doc comment updated to describe the matching rule.

## Tests

Add to src/test/annual-meeting-status.test.ts, today fixed at 2026-08-25:

Schedule 3rd Tuesday in March (regression):
- last 2026-03-10 -> 2027-03-16 SCHEDULED
- last 2026-03-17 -> 2027-03-16 SCHEDULED
- last 2026-04-02 -> 2027-03-16 SCHEDULED
- last 2025-03-11 -> 2026-03-17 OVERDUE
- last 2024-03-19 -> 2025-03-18 OVERDUE

Schedule 1st Tuesday in January (new):
- last 2025-12-30 -> 2027-01-05 SCHEDULED
- last 2026-01-06 -> 2027-01-05 SCHEDULED
- last 2025-01-07 -> 2026-01-06 OVERDUE

Schedule 2nd Tuesday in December (new):
- last 2026-01-05 -> 2026-12-08 OVERDUE

All eight existing tests stay as-is and must keep passing. Verification: run the test file and report the changed-file list.

## Files

- src/hooks/useAnnualMeetingsDue.ts
- src/test/annual-meeting-status.test.ts
