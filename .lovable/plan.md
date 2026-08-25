# Annual meeting due date — nearest-occurrence matching

## Status: already implemented

`getAnnualMeetingStatus()` in `src/hooks/useAnnualMeetingsDue.ts` no longer anchors to
`lastAnnualMeetingDate.getFullYear() + 1`. It already:

1. Resolves the scheduled occurrence for year-1, year, and year+1 (skipping nulls).
2. Picks the candidate with the smallest whole-day distance from the last meeting, earlier candidate winning ties.
3. Uses `resolveScheduledDate(..., satisfiedYear + 1)` as the due date, with the existing null fallback.
4. Leaves the OVERDUE / DUE_SOON / SCHEDULED branches and the NOT_REQUIRED / UNSCHEDULED / NEVER_HELD
   branches untouched. The superseded "held before the bylaw date" logic is gone; its test still passes.

`src/test/annual-meeting-status.test.ts` already contains the boundary matrix (March, January, December)
plus the pre-existing tests. All 17 tests pass.

## One discrepancy in the requested matrix

Requested: 2nd Tuesday in December, last meeting 2026-01-05 -> due 2026-12-08, **OVERDUE**.

The due date is correct (the Jan 2026 meeting matched the Dec 9 2025 occurrence, so Dec 8 2026 is next).
But with today = 2026-08-25 that date is 105 days in the future, so the status branch returns
**SCHEDULED**, not OVERDUE. Returning OVERDUE for a future date would require changing the
downstream branches, which this request explicitly keeps unchanged. The test asserts SCHEDULED.

## Proposed action

No code change. Confirm the December expectation should stay SCHEDULED, or say which downstream
rule you want altered and I will plan that separately.
