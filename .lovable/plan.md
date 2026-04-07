

## Fix: One Row Per Transfer in Stock Transfer Ledger

### Problem
The `execute-share-transfer` edge function inserts 2-3 `share_transactions` rows per transfer: the primary transfer, a `cancellation` entry, and optionally a `reissuance` entry. The Transfer Ledger renders each as a separate row, creating duplicates.

### Solution

**1. Filter cert lifecycle entries in `TransferLedgerTab.tsx`**

Skip `cancellation` and `reissuance` transaction types entirely — they are certificate lifecycle events, not ownership events. The transfer row already shows cert issued/cancelled columns. Remove the two early-return blocks (lines 151-178 for cancellation, lines 181-216 for reissuance) and instead filter them out before processing:

```
const sorted = [...transactions]
  .filter(t => t.transaction_type !== "cancellation" && t.transaction_type !== "reissuance")
  .sort(...)
```

Also remove `"Cancellation"` and `"cancellation"` from `REDUCTION_TYPES` since standalone cancellations should not appear as ledger rows. Keep `"Redemption"` and `"redemption"`.

Enrich the transfer row's cert columns by looking up the cancelled cert via `transferred_certificate_id` on sibling cancellation transactions (same date, same seller) and the issued cert via sibling reissuance transactions.

**2. Fix cert lookup for transfer rows**

Update `findCertIssued` and `findCertCancelled` to also match by looking at the full transaction set for companion cancellation/reissuance entries that share the same date and seller name, pulling cert numbers from those sibling transactions.

**3. Balance Held correction**

With cancellation/reissuance rows removed, the existing balance tracking logic for transfers already works correctly — transfers subtract from seller and add to buyer without double-counting.

**4. Buyer field in `BuySellWorkflow.tsx`**

For corporations (non-LLC), replace the free-text `Input` + optional `Select` with the same pattern used for the Seller field: a text input that clears `buyer_id` on manual edit, plus a shareholder dropdown that auto-populates `buyer_name`. The existing logic at line 182 (`buyerIsNew`) already handles creating new shareholders — no change needed there.

**5. PDF report**

The PDF uses the same `entries` array, so filtering cancellation/reissuance from the data automatically fixes the PDF output too.

### Files Modified

| File | Change |
|------|--------|
| `src/components/company/TransferLedgerTab.tsx` | Filter out cancellation/reissuance rows; improve cert column lookups |
| `src/components/company/BuySellWorkflow.tsx` | Make Buyer field a text input + shareholder dropdown (matching Seller pattern) |

### What Stays Unchanged
- Edge function (`execute-share-transfer`) — cert lifecycle entries remain in the database for audit purposes
- All other tabs and workflows
- Database schema

