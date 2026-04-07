

## Transaction Correction and Admin Override System

### Database Migration

Add 4 columns to `share_transactions`:

```sql
ALTER TABLE share_transactions
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN corrected_by_id uuid REFERENCES share_transactions(id) ON DELETE SET NULL,
  ADD COLUMN corrects_id uuid REFERENCES share_transactions(id) ON DELETE SET NULL,
  ADD COLUMN correction_memo text;
```

### New Files

| File | Purpose |
|------|---------|
| `src/components/company/CorrectionModal.tsx` | Dialog receiving original transaction prop. Shows read-only summary, mandatory memo textarea, submit creates reversing entry (swapped parties, `transaction_type: "correction"`, `corrects_id` → original), updates original's `status` → `corrected` and `corrected_by_id` → new row. Also inserts an "Amended Resolution" into `document_registry`. Invalidates `share_transactions`, `stock_certificates`, `shareholders` query keys. |
| `src/components/company/AdminDeleteButton.tsx` | Renders only for `isAdmin`. Checks `created_at` < 24h and no references via `corrects_id`/`transferred_certificate_id`. Met → confirm dialog + hard delete. Not met → alert explaining why, directing to Correct flow. |
| `src/components/company/EntityDeleteGuard.tsx` | Queries `share_transactions`, `stock_certificates`, `document_registry` counts for the company. If records exist, replaces the current 2-step delete with a name-confirmation input + red warning showing record counts. Delete button disabled until typed name matches exactly. If no records, falls through to simple confirm. |

### Modified Files

**`src/components/company/StockLedgerTab.tsx`**
- Import `RotateCcw` icon, `CorrectionModal`, `AdminDeleteButton`, `useUserRole`
- Add `CorrectionModal` state (`correctionTarget`)
- In the table row render (lines 610-650):
  - Corrected rows: strikethrough text + "Corrected" badge with tooltip "See entry #X"
  - Correction rows: "Correction" badge with "Corrects #X"
  - Actions column: add `RotateCcw` button on `status === 'active'` rows → opens CorrectionModal
  - Admin users: add `AdminDeleteButton` on each row
- Running balance calculation (lines 586-607): skip entries where `status === 'corrected'`

**`src/components/company/TransferLedgerTab.tsx`**
- Import `Badge`, `Tooltip` components (already imported), `useUserRole`
- In `sorted.forEach` loop (line 162): skip balance accumulation when `t.status === 'corrected'`
- Entry rendering (lines 303-334):
  - Corrected rows: `line-through opacity-50` styling + "Corrected" badge
  - Correction rows: "Correction" badge referencing original entry #
- Add `status` field to `LedgerEntry` interface for conditional rendering

**`src/pages/CompanyDetail.tsx`**
- Replace the two `AlertDialog` delete steps (lines 242-283) with `EntityDeleteGuard` component
- Pass `companyId`, `companyName`, `onDelete` (existing `handleDelete`), `onCancel`

### Correction Flow Detail

1. User clicks RotateCcw on an active transaction
2. CorrectionModal opens showing: date, type, shareholder, shares, consideration (read-only)
3. User enters mandatory correction memo
4. On submit:
   - INSERT new `share_transactions` with reversed parties, today's date, `transaction_type: 'correction'`, `corrects_id: original.id`, `correction_memo`
   - UPDATE original: `status: 'corrected'`, `corrected_by_id: newRow.id`
   - INSERT `document_registry` row: type "Amended Resolution", category "Resolution", title "Amended Resolution — Correction of Entry #X"
   - Invalidate queries

### Balance Recalculation Logic

Both ledgers skip `status === 'corrected'` rows from balance accumulation. Correction entries (which reverse the original's effect) are included, so the net impact is zero — balances remain accurate.

### Admin Delete Window

- Only visible to admin role users
- `created_at` must be within 24 hours of current time
- No other `share_transactions` row may reference it via `corrects_id` or `transferred_certificate_id`
- Outside window: tooltip/alert explains "This transaction is older than 24 hours. Use the Correct flow instead."

### Entity Delete Guard

- Counts records across 3 tables for the company
- If any exist: shows red warning with counts, requires typing exact company name
- If none: simple 2-click confirm (current behavior preserved)

