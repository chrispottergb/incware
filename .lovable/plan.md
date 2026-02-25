

## Fix: Share Transfer Not Creating New Shareholder or Updating Correctly

### Problems Found in Database

Looking at the actual transfer record, three things went wrong:

1. `from_shareholder` (seller name) is **null** -- the seller's name wasn't saved in the transaction
2. `shareholder_id` points to Kathryn Potter (the original shareholder/seller) instead of the new buyer "Christoher R. Potter"
3. "Christoher R. Potter" was **never created** as a new shareholder record
4. No certificate changes occurred -- Kathryn's cert is still active at 100 shares, no cert issued to Christopher

### Root Cause

In `BuySellWorkflow.tsx`, the auto-create logic has a flaw:

- Line 195: `let buyerShId = form.buyer_id || null` -- if the user happened to select from the buyer dropdown (or it retained a value), this gets set to the **wrong** shareholder ID
- Line 196: The name lookup then fails to match (different names), so `buyerSh` is null
- But `buyerShId` is already set from step 195, so the code at line 214 updates the transaction with the **seller's** ID as the buyer
- The certificate logic at line 266 checks `if (buyerSh)` which is null, so no cert is issued

### Fix (1 file: `src/components/company/BuySellWorkflow.tsx`)

**Change 1: Fix the buyer resolution logic (lines 194-218)**

Replace the current auto-create block so that:
- Always resolve the buyer by **name match first**, ignoring `form.buyer_id` if the name doesn't match
- Only use `form.buyer_id` if the linked shareholder's name actually matches `form.buyer_name`
- If no match, create the new shareholder and use the new ID

```
1. Find existing shareholder by case-insensitive name match on form.buyer_name
2. If found -> use their ID as buyerShId
3. If NOT found -> INSERT new shareholder, use new ID
4. UPDATE share_transactions.shareholder_id = buyerShId
```

**Change 2: Fix missing `from_shareholder` (line 169)**

The `from_shareholder` field stores the seller name. Ensure it's always populated:
- If `form.seller_id` is set but `form.seller_name` is empty, resolve the name from the shareholders list before saving

**Change 3: Fix certificate logic to use resolved buyer**

After the auto-create, store the resolved buyer in a variable that the certificate section can reliably use (currently it references `buyerSh` which may be stale).

**Change 4: Fix existing bad data**

Run a one-time data correction for the existing transfer record to:
- Set `from_shareholder = 'Kathryn Potter'`
- Create "Christoher R. Potter" as a new shareholder
- Update `shareholder_id` to point to the new buyer
- Cancel Kathryn's cert #1, issue new cert #2 (50 shares to Kathryn), cert #3 (50 shares to Christopher)

### Technical Summary

| Issue | Fix |
|-------|-----|
| `from_shareholder` is null | Resolve seller name from `seller_id` if name is empty before insert |
| `shareholder_id` points to wrong person | Always resolve buyer by name match, not by `form.buyer_id` alone |
| New shareholder not created | Fix conditional logic so name mismatch triggers INSERT |
| No certificate updates | Ensure resolved buyer object (not stale ref) is used for cert creation |
| Existing bad data | Correct the existing transfer record and create missing shareholder/certs |

