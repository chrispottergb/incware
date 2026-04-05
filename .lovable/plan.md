

## Batch Share Transfer — Implementation Plan

### Step 1: Edge Function — `execute-batch-transfer`

**File:** `supabase/functions/execute-batch-transfer/index.ts`

Closely modeled on the existing `execute-share-transfer` function. Reuses the same numeric helpers (`toNumeric`, `addNumeric`, `subtractNumeric`), auth pattern (`getUser()`), ownership verification, CORS, and `postgres.js` raw SQL transaction.

**Payload shape:**
```typescript
{
  company_id: string;
  company_name?: string;
  entity_type: string;
  seller_name: string;
  seller_id: string | null;
  share_class: string;
  transaction_date: string;
  meeting_id: string;
  transfers: Array<{
    buyer_name: string;
    buyer_id: string | null;
    num_shares: number;
    price_per_share: number | null;
    total_consideration: number | null;
    consideration_type: string;
    transaction_type: string;
    resolution_id: string;
  }>;
}
```

**Inside a single `sql.begin()`:**
1. Fetch shareholders and certificates once
2. Validate: sum of all `transfers[].num_shares` does not exceed seller's active certificate
3. Cancel seller's active certificate exactly once; insert one cancellation ledger entry
4. For each transfer in the array:
   - Insert `share_transactions` record (with `meeting_id`)
   - Insert `bills_of_sale` record
   - Upsert buyer as shareholder if new (Corps only; LLCs select from existing)
   - Cancel buyer's existing active cert if consolidating; issue new buyer cert with combined total
   - Insert transfer ledger entry
   - Update transaction with denormalized cert numbers
5. If seller remainder > 0, issue one remainder certificate + reissuance ledger entry. If 0, mark seller inactive.
6. For LLCs: call `recalculate_ownership_percentages` once; update capital accounts once
7. Link each `transaction_id` to its `resolution_id` by updating `meeting_resolutions.transaction_id`

**Returns:** `{ results: [{ transactionId, billId, buyerName, resolutionId }], certActions[], sellerRemainder }` or error with full rollback.

---

### Step 2: Component — `BatchTransferDialog.tsx`

**File:** `src/components/meeting/BatchTransferDialog.tsx`

A dialog that receives: `companyId`, `companyName`, `entityType`, `meetingId`, and `resolutionIds` (the unlinked transfer resolution IDs).

**UI layout:**
- Fetches resolutions by ID to display each as a read-only card (purpose + text)
- **Shared seller dropdown** at the top — populated from the company's current shareholders query (same pattern as `BuySellWorkflow`). User selects seller once.
- **Shared fields:** share class selector, transaction date picker
- **Per-resolution row:** Buyer Name field (free text for Corps, dropdown for LLCs), # Shares, Price/Share, Total Consideration, Consideration Type (defaulting to "cash")
- Validates total shares across all rows does not exceed seller's active certificate holdings
- On submit: calls `supabase.functions.invoke("execute-batch-transfer", { body: batchPayload })`
- On success:
  - Invalidates all related query keys
  - For each buyer in returned results, generates an individual Bill of Sale PDF using existing `generateBillOfSalePdf()`
  - Filename: `Bill_of_Sale_[SellerLast]_to_[BuyerLast]_[Date].pdf`
  - Before uploading, queries `company_documents` for existing files with same prefix; if found, appends `_2`, `_3` suffix
  - Uploads each to `generated-documents` bucket, inserts `company_documents` record with category "Agreements"
  - PDF failures are non-blocking (warning toast only)
  - Shows success step with cert actions summary

---

### Step 3: Detection Logic in `MeetingResolutions.tsx`

**Changes:**
- After fetching resolutions, count unlinked transfer resolutions (those matching `TRANSFER_RESOLUTION_PURPOSES` with no `transaction_id`)
- If count >= 2: render an "Execute Batch Transfer" button below the resolution list. Clicking opens `BatchTransferDialog` with the IDs of all unlinked transfer resolutions.
- If count == 1: show only the existing individual "Complete Transaction" button on the resolution card (no batch button)
- If count == 0: no buttons (all linked)

**No text parsing.** The batch dialog handles seller selection via dropdown. Resolution IDs are passed directly.

**New state:** `batchOpen`, `batchResolutionIds`

**New import:** `BatchTransferDialog`

No changes needed to `MeetingDetail.tsx` — all required props (`companyId`, `companyName`, `entityType`, `meetingId`, `availableShares`) are already passed to `MeetingResolutions`.

---

### Files Created/Modified

| File | Action |
|------|--------|
| `supabase/functions/execute-batch-transfer/index.ts` | New |
| `src/components/meeting/BatchTransferDialog.tsx` | New |
| `src/components/meeting/MeetingResolutions.tsx` | Modified — add batch detection + button |

### What Stays Unchanged

- `execute-share-transfer` — untouched
- `BuySellWorkflow.tsx` — untouched
- Database schema — no new columns
- Standalone transaction path — untouched
- `supabase/config.toml` — no changes needed

