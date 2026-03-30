

# Redesign Section 9 — Annual Balance Reporting

## Overview

Replace the current two-field side-by-side layout (single "To" amount + single "From" amount + comment textarea) with two stacked tables supporting multiple rows per table. Each table represents a direction of loan (TO or FROM shareholders/members/related parties) with per-row columns: Name/Party, Relationship, Beginning Balance, Advances, Repayments, Ending Balance.

## Database Change

**New table: `meeting_balance_entries`**

```sql
CREATE TABLE public.meeting_balance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE NOT NULL,
  direction text NOT NULL CHECK (direction IN ('to', 'from')),
  party_name text NOT NULL DEFAULT '',
  relationship text DEFAULT '',
  beginning_balance numeric DEFAULT 0,
  advances numeric DEFAULT 0,
  repayments numeric DEFAULT 0,
  ending_balance numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_balance_entries ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can CRUD (matching existing meeting_loans pattern)
CREATE POLICY "Authenticated users can manage balance entries"
  ON public.meeting_balance_entries FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

The existing `balance_to_shareholder`, `balance_from_shareholder`, and `loan_balance_comment` columns on the `meetings` table remain untouched (backward compatibility) but will no longer be used by the UI.

## UI Changes — `src/components/meeting/MeetingLoans.tsx`

**Replace lines 750–776** (the Annual Balance Reporting card) with:

- **Two stacked cards** inside the same Annual Balance Reporting section:
  1. **"Loans TO Shareholders / Members / Related Parties"** — a table with columns: Name/Party, Relationship, Beginning Balance, Advances, Repayments, Ending Balance, and a delete button column. An "+ Add Row" button below.
  2. **"Loans FROM Shareholders / Members / Related Parties"** — identical structure.

- Each row is auto-saved on blur via `useAutoSave` (same pattern as existing balance fields).
- Remove the standalone `standaloneBalanceTo`, `standaloneBalanceFrom`, `standaloneBalanceComment` state variables and the comment textarea.
- Query `meeting_balance_entries` filtered by `meeting_id` and `direction`.
- New rows inserted with `direction: 'to'` or `'from'`.

## Props Change — `MeetingDetail.tsx`

- Remove the `meetingBalanceTo`, `meetingBalanceFrom`, `meetingBalanceComment`, and `onSaveBalance` props from the `<MeetingLoans>` call (lines 899–913). The component will now self-manage balance data via direct queries to `meeting_balance_entries`.

## PDF Change — `src/lib/meeting-pdf-export.ts`

**Replace lines 2087–2103** (the single two-column balance table) with:

- Fetch `meeting_balance_entries` for the meeting (passed via the existing `data` parameter or queried inline).
- Render two autoTable blocks stacked vertically:
  1. Heading: "Loans TO Shareholders / Members / Related Parties"  
     Columns: Name/Party | Relationship | Beg. Balance | Advances | Repayments | End. Balance
  2. Heading: "Loans FROM Shareholders / Members / Related Parties"  
     Same columns.
- Skip each table if no rows exist for that direction.

## Files Modified

| File | Change |
|------|--------|
| **Migration** | Create `meeting_balance_entries` table with RLS |
| `src/components/meeting/MeetingLoans.tsx` | Replace balance card with two editable tables; remove old balance state/props |
| `src/pages/MeetingDetail.tsx` | Remove balance-related props from `<MeetingLoans>` |
| `src/lib/meeting-pdf-export.ts` | Render two separate balance tables in PDF from new data |

## What stays unchanged

- All other sections, tabs, loan entry dialog, promissory note wizard, and save behavior remain identical.

