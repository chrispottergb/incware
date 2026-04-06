

## Plan: Update MeetingBanking Component

**Single file change:** `src/components/meeting/MeetingBanking.tsx`

### Changes

1. **Rename header** from "Banking" to "Bank Line of Credit"
2. **Remove the Switch toggle** and `locEnabled` state entirely
3. **Show Bank Name, LOC Amount, and Interest Rate fields always** — laid out in one row (Bank Name, LOC Amount, Interest Rate)
4. **Remove the `loc_enabled` field** from all upsert calls — stop writing it to the database
5. **Remove the conditional render** (`{locEnabled && ...}`) — fields are always visible

### Layout

```text
┌─ Bank Line of Credit ─────────────────────────────┐
│ Bank Name          │ LOC Amount    │ Interest Rate  │
│ [____________]     │ [________]    │ [__________]   │
└────────────────────────────────────────────────────┘
```

All three fields in a single `grid-cols-12` row: Bank Name (col-span-5), LOC Amount (col-span-4), Interest Rate (col-span-3).

No database changes, no other files touched.

