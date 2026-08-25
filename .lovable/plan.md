# Annual Meeting status moves into the Client Companies table

Retire the standalone "Annual Meetings Due" card and surface the same due-status
information as a column plus filter chips on the existing Client Companies table.
No schema changes, no new columns, no extraction of the inline table.

## Changed files

- `src/hooks/useAnnualMeetingsDue.ts` — keep helpers, add `getAnnualMeetingStatus()`, remove the now-unused `useAnnualMeetingsDue()` query export
- `src/pages/Dashboard.tsx` — reorder sections, extend the companies query, add column + filter chips, drop the card import
- `src/test/annual-meeting-status.test.ts` — new unit tests
- `src/components/dashboard/AnnualMeetingsDueCard.tsx` — deleted

Protected files (`src/lib/meeting-pdf-export.ts`, `src/lib/annual-meeting-pdf.ts`,
`src/lib/nonprofit-annual-meeting-pdf.ts`, Supabase auto-generated files) are untouched.

## 1. Dashboard order

New render order in `src/pages/Dashboard.tsx`:

```text
Welcome action cards (5 tiles)   unchanged
hidden dialogs                   unchanged
Client Companies header + Add Company
Filters row (search / type / status / new chips)
Client Companies table
AI Compliance Summary            moved to bottom
```

`<AnnualMeetingsDueCard />` is removed from the page and the component file is deleted
along with its import. It was the **only** consumer of `useAnnualMeetingsDue()` — a
codebase-wide search finds no other reference. So the hook is not kept alive: the file
`src/hooks/useAnnualMeetingsDue.ts` is retained for its pure helpers
(`resolveScheduledDate`, `addOneYear`, `wholeDaysBetween`, `bucketFor`, and the new
`getAnnualMeetingStatus`), while the `useAnnualMeetingsDue()` export and its
`["annual-meetings-due"]` React Query key are removed. No orphaned query fires.

## 2. Single source of truth for "due"

In `src/hooks/useAnnualMeetingsDue.ts`, add and export:

```ts
getAnnualMeetingStatus(company, lastAnnualMeetingDate, today)
  -> { status, dueDate: Date | null, label, tone }
```

Precedence:

1. `NOT_REQUIRED` — `statutory_close_corporation = true`. Label "Not required (close corp)",
   tone muted. Per Wis. Stat. s. 180.1827 a statutory close corporation need not hold an
   annual meeting unless a shareholder demands one in writing at least 30 days prior.
   Never renders as overdue.
2. `UNSCHEDULED` — any of `scheduled_meeting_ordinal`, `scheduled_meeting_day_of_week`,
   `scheduled_meeting_month` is null. Label "No schedule set", tone neutral.
3. `NEVER_HELD` — scheduled but no Annual Meeting on record. `dueDate` = next occurrence
   after today. Label "No annual meeting on record".
4. Otherwise `dueDate` = next scheduled occurrence strictly after the last Annual Meeting date:
   - `OVERDUE` when `dueDate < today` → "Overdue {n}d", red
   - `DUE_SOON` when `dueDate <= today + 60d` → "Due {MMM d}", amber
   - `SCHEDULED` otherwise → "{MMM d, yyyy}", neutral

The function reuses the existing `resolveScheduledDate`, `addOneYear` and
`wholeDaysBetween` helpers — no new date math. `useAnnualMeetingsDue()` is refactored to
call it per company so the hook and the table column can never disagree; its exported row
shape is kept so nothing else breaks.

Unit tests (`src/test/annual-meeting-status.test.ts`) cover: overdue, due soon, scheduled,
unscheduled, never held, close-corp exemption, and a month that has no 5th weekday.

## 3. Data

The existing `useQuery(["companies"])` gains one additional parallel query against
`meetings` (`meeting_type ILIKE 'Annual Meeting%'`, non-null `meeting_date`), reduced
client-side to a max date per `company_id`. Two queries total, none per row. Companies
with no annual meeting still appear. Pagination `range(0, 499)` unchanged.

## 4. New column

"Annual Meeting" is appended after Status (before the chevron cell) and renders the status
chip using the tone from `getAnnualMeetingStatus`. The six existing columns are unchanged.
The "No schedule set" chip is clickable and navigates to `/company/{id}#incorporation`
(the scheduled-meeting setting), stopping row-click propagation.

## 5. Filter chips

Added inside the existing filters row — no second row:

```text
All (60) · Overdue (n) · Due soon (n) · No schedule set (n)
```

Counts are live and computed after the existing search / type / status filters, so the
chips compose with them. Default is All. When Overdue or Due soon is active, rows are
ordered by `dueDate` ascending; otherwise the current name ordering is kept. No sortable
column headers are added anywhere.

## Acceptance

- Client Companies renders above AI Compliance Summary
- `AnnualMeetingsDueCard.tsx` deleted with no orphan imports
- No migration in the diff
- All 60 companies visible under "All"
- Neither statutory close corporation shows a red chip
