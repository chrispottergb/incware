

## Fix: Share Transfer Fails to Update New Shareholder

### Root Cause

When a transfer is recorded in `BuySellWorkflow.tsx`, the workflow does **not** auto-create a new shareholder record if the buyer doesn't already exist in the `shareholders` table. This causes two failures:

1. **No shareholder record created** -- The buyer's name is stored as text in `to_shareholder`, but no row is inserted into the `shareholders` table for them.
2. **No certificate issued to buyer** -- At line 239, `buyerSh` resolves to `null` because the name lookup fails against the shareholders list, so the certificate insert is silently skipped.
3. **Holdings calculation shows 0** -- `useShareCalculations` tries to match the buyer by name against `shareholders`, but since no record exists, the transfer-in shares are never attributed.

### Fix (1 file change)

**File: `src/components/company/BuySellWorkflow.tsx`**

In the `handleSave` function, after inserting the transaction and bill of sale (around line 193), add logic to auto-create the buyer as a new shareholder if they don't already exist:

```text
Before certificate logic (line ~200):

1. Check if buyer name matches any existing shareholder (case-insensitive)
2. If NO match found:
   a. INSERT into shareholders (company_id, name, status='active')
   b. Store the new shareholder's ID as buyerSh for certificate creation
3. Re-fetch/update the local shareholders list so subsequent
   certificate logic uses the correct shareholder_id
```

Similarly, for the seller side -- if the seller is typed manually and doesn't match an existing shareholder, the same auto-create should apply (though this is less common since sellers typically already exist).

After creating the new shareholder, **update the transaction record** to link `shareholder_id` to the newly created buyer:

```text
UPDATE share_transactions SET shareholder_id = new_buyer_id WHERE id = txn.id
```

This ensures:
- The `shareholderHoldings` calculation in `useShareCalculations.ts` correctly attributes shares via `shareholder_id`
- Certificates are issued to the correct shareholder
- The Transfer Ledger shows proper linked records

### What This Does NOT Change
- No database schema changes needed
- No changes to `useShareCalculations.ts` (it already handles both ID-based and name-based matching)
- No changes to `ShareholdersTab.tsx`
- Existing standalone ledger/bill entries remain unaffected

### Technical Summary

| Step | Action |
|------|--------|
| 1 | After saving transaction + bill, check if buyer exists in `shareholders` |
| 2 | If not, INSERT new shareholder with `name` and `status='active'` |
| 3 | Update `share_transactions.shareholder_id` to point to the new/existing buyer |
| 4 | Use the resolved buyer shareholder record for certificate issuance |
| 5 | Invalidate `shareholders` query cache so the UI reflects the new member |

