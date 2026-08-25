# Client Companies table: overflow fix, chip cleanup, newly-formed status

Non-destructive. No schema changes, no new columns, no component extraction.

## Changed files

- `src/pages/Dashboard.tsx` — remove Fiscal Year End column, sticky first column, conditional chips
- `src/hooks/useAnnualMeetingsDue.ts` — add `NEWLY_FORMED` branch to `getAnnualMeetingStatus`
- `src/test/annual-meeting-status.test.ts` — three new unit tests

Protected files (`src/lib/meeting-pdf-export.ts`, `src/lib/annual-meeting-pdf.ts`,
`src/lib/nonprofit-annual-meeting-pdf.ts`, Supabase auto-generated files) untouched.

## 1. Horizontal overflow

a. Drop the "Fiscal Year End" `TableHead` and the matching `TableCell`
(`company.fiscal_year_end`) from the Dashboard table only. The field stays in the
database, in the company detail page and in every form.

b. Company Name becomes sticky:

- Header cell and body cell get `sticky left-0 z-20` (header) / `z-10` (body).
- Solid backgrounds so scrolled cells never show through: header uses the same
  `bg-muted` tone as the header row; body cells get `bg-card` plus a
  `group-hover:bg-muted/50` companion so the sticky cell tracks the row's hover
  state instead of staying pale.
- A right-hand hairline (`border-r`) marks the frozen edge.
- The table wrapper changes from `overflow-hidden` to `overflow-x-auto` so
  sticky positioning has a scroll container to stick within; `rounded-lg` is kept.

## 2. Zero-count filter chips

The chip array is filtered before render: "All (n)" always renders; Overdue,
Due soon and No schedule set render only when their count is greater than zero.

An effect watches `chipCounts`: if the active chip's count reaches zero,
`annualFilter` resets to `"all"`, so no filter can be stuck on an invisible chip.

## 3. NEWLY_FORMED status

Field used: `companies.incorporation_date` — the same column the Dashboard's
"Inc. Date" column renders. Populated for LLCs as well as corporations
(4/4 Single Member LLC, 15/22 LLC, 26/30 Corporation, 3/4 Non-Profit); rows with a
null date simply fall through to the existing `NEVER_HELD` behaviour.

New branch order inside `getAnnualMeetingStatus`:

1. `NOT_REQUIRED` (statutory close corp) — unchanged
2. `UNSCHEDULED` (any schedule column null) — unchanged, still wins over newly formed
3. **`NEWLY_FORMED`** — no annual meeting on record AND `incorporation_date` within
   365 days of today. `dueDate` = next scheduled occurrence after today,
   label `First meeting {MMM d, yyyy}`, tone `neutral`
4. `NEVER_HELD` — unchanged for entities older than 365 days
5. Overdue / due soon / scheduled — unchanged

`ScheduleCompany` gains an optional `incorporation_date?: string | null`.
The status union and the tone map already cover `neutral`, so the chip renders grey.

Live check: Friebel Real Estate, LLC (organized 2026-06-30, 3rd/May schedule) is the
Single Member LLC that must render the neutral "First meeting" chip.

New tests in `src/test/annual-meeting-status.test.ts`:

- newly formed with a schedule → `NEWLY_FORMED`, neutral, label starts "First meeting"
- newly formed without a schedule → `UNSCHEDULED`
- 366 days old with no annual meeting → `NEVER_HELD`

## Acceptance

- Company Name stays visible at full horizontal scroll
- Fiscal Year End gone from the Dashboard table only
- No chip renders with a count of zero except All
- Friebel Real Estate, LLC shows a neutral "First meeting" chip
