

## Plan: Fix Prior-Year Financial Pull (3 targeted changes)

### Root cause
`MeetingFinancials.tsx` saves the auto-pulled prior-year values into the new meeting's `meeting_financials` row, then locks them via `hasSavedPreviousData`. They never re-resolve when the source meeting is deleted/canceled — that's the stale-COGS bug.

### Scope
- `src/components/meeting/MeetingFinancials.tsx` — all 3 logic changes.
- `src/components/company/MeetingsTab.tsx` — single cache-invalidation line.

No schema changes, no migrations, no touching wizard cloning logic, no touching current-year inputs.

### Change 1 — Re-resolving prior-meeting source query

In `MeetingFinancials.tsx`:
1. Update the `priorMeetingFinancials` query to **exclude canceled meetings** (`document_status !== 'cancelled'`).
2. Add source meeting `id` + `meeting_date` to the React Query key; set `staleTime: 0` so re-mount refetches.

In `MeetingsTab.tsx`:
3. Inside `deleteMeeting` mutation's `onSuccess` callback, **after the existing invalidations**, add:
   ```ts
   queryClient.invalidateQueries({ queryKey: ["prior_meeting_financials_for_autofill"] });
   ```
   This is required — without it, re-resolution will not trigger after a meeting is deleted.

### Change 2 — Per-field manual override + edited badge

- Remove the `previousYearLocked` gating in `handleFieldChange` so prev-year fields are always editable.
- Derive "overridden" at render: `saved previous_X != null && saved previous_X !== source previous_X`.
- Render an italic "Edited" badge next to any prev-year field whose saved value differs from the resolved source.
- Keep the existing auto-fill `useEffect` guard (`!hasSavedPreviousData`) so first-open still seeds from source; once user edits + autosaves, the override sticks and is never clobbered by re-resolution.
- No new database columns — override status is purely derived.

### Change 3 — "Re-sync from source" per field + bulk

- Add a small `RotateCcw` icon button next to each `previous_*` input, visible only when source value exists AND current form value differs from source. Click sets that single field back to source value and triggers autosave.
- Add a "Re-sync all from source" link in the card header.

### Behavior matrix

| State | Field appearance |
|---|---|
| Auto-pulled from source | Normal input |
| User manually edited | Italic value + "Edited" badge + reset icon |
| Source canceled/deleted, no override | Re-resolves to next valid prior annual meeting |
| Source canceled/deleted, has override | Override preserved (override = source of truth) |

### What is NOT changing
- No new DB columns or migrations.
- `AnnualMeetingWizard` initial autopopulation and `MeetingsTab` clone-insert untouched.
- Current-year inputs, NR items, charts, autosave hook, all other meeting sections unchanged.

