

# Atomic Share Transfer — Implementation Plan

## Step 1: Database Migration

Add two nullable FK columns to enable meeting-transaction linkage.

**Migration SQL:**
```sql
ALTER TABLE public.share_transactions
  ADD COLUMN IF NOT EXISTS meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL;

ALTER TABLE public.meeting_resolutions
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.share_transactions(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
```

Both columns are nullable, no defaults, no existing data affected. Will confirm columns are live before proceeding.

---

## Step 2: Edge Function — `execute-share-transfer`

Create `supabase/functions/execute-share-transfer/index.ts` that wraps all 5 record writes in a single Postgres transaction using `SUPABASE_DB_URL` for raw SQL.

**Atomic operations inside BEGIN/COMMIT:**
1. Insert primary `share_transactions` record (with optional `meeting_id`)
2. Insert `bills_of_sale` linked to transaction
3. Update transaction with `bill_of_sale_id` reverse link
4. Upsert buyer in `shareholders` (create if new, Corps only)
5. Cancel seller's active cert → reissue remainder → issue buyer cert
6. Insert cancellation/reissuance ledger entries
7. Update transaction with denormalized cert numbers
8. Mark seller inactive if 0 shares remain
9. For LLCs: call `recalculate_ownership_percentages` RPC
10. For LLCs: update capital account balances
11. Handle treasury flagging for redemptions

**Returns:** `{ transactionId, billId, certActions[], buyerShareholderId }` or error with full rollback.

**Auth:** Validate JWT via `getClaims()`, verify user owns the company.

**Config:** Add `[functions.execute-share-transfer] verify_jwt = false` to `supabase/config.toml`.

**Testing:** Use `supabase--curl_edge_functions` to test with valid payload and a simulated failure payload before touching client code.

---

## Step 3: Refactor `BuySellWorkflow.tsx`

Replace the ~250 lines of sequential client-side writes in `handleSave` (lines 200–473) with a single `supabase.functions.invoke("execute-share-transfer", { body: payload })` call.

**New props added:**
- `meetingId?: string` — passed through to edge function
- `onTransactionComplete?: (txnId: string) => void` — callback for resolution linking

**Post-success (client-side):**
- Generate Bill of Sale PDF using existing `generateBillOfSalePdf()`
- Upload blob to `generated-documents` storage bucket with filename `Bill_of_Sale_[SellerLast]_to_[BuyerLast]_[Date].pdf`
- Insert `company_documents` record with category `"Agreements"`
- If PDF upload fails: log warning, show non-blocking toast — not a transaction failure

**Preserved:** Same UI, same 3-step wizard, same form fields, same validation logic. Only the transport layer changes.

---

## Step 4: Resolution Trigger in `MeetingResolutions.tsx`

**New props:** `companyId`, `companyName`, `availableShares`, `meetingId` (passed from `MeetingDetail.tsx`)

**Trigger behavior:**
- When a resolution with purpose `"Approve Transfer/Sale of Shares"` or `"Approve Transfer of Membership Interest"` is saved, show a "Complete Transaction" button on the resolution card
- Clicking opens `BuySellWorkflow` as an inline dialog with `meetingId` set
- `onTransactionComplete` callback updates the resolution's `transaction_id`
- Resolution cards with a linked transaction show a green `Link2` icon badge with "Transaction Linked"

**MeetingDetail.tsx changes (line 945):**
```tsx
<MeetingResolutions
  meetingId={meeting.id}
  entityType={company?.entity_type || "Corporation"}
  meetingType={meeting.meeting_type}
  companyId={id!}
  companyName={company?.name}
  availableShares={availableShares}
/>
```

Where `availableShares` comes from the existing `useShareCalculations` hook already imported on line 39.

---

## Files Modified

| File | Action |
|------|--------|
| `supabase/migrations/[new].sql` | Add `meeting_id` + `transaction_id` columns |
| `supabase/config.toml` | Add `execute-share-transfer` function config |
| `supabase/functions/execute-share-transfer/index.ts` | New — atomic 5-record write |
| `src/components/company/BuySellWorkflow.tsx` | Replace sequential writes with edge function call |
| `src/components/meeting/MeetingResolutions.tsx` | Add transaction trigger + linked indicator |
| `src/pages/MeetingDetail.tsx` | Pass additional props to MeetingResolutions |

## Gap Resolution

| Gap | Fix |
|-----|-----|
| A — No atomicity | Edge function `BEGIN/COMMIT` block |
| B — No PDF auto-save | Client-side PDF generated + uploaded to storage + `company_documents` |
| C — No meeting reference | `meeting_id` column on `share_transactions` |
| D — No resolution trigger | "Complete Transaction" button on transfer resolution cards |
| E — No transaction link | `transaction_id` column on `meeting_resolutions` |

