

# Fix Cert # Display and Capital Account for LLCs

## Problem 1: Cert # Not Displaying in Transactions Table

**Root cause**: When a certificate is issued separately via `StockCertificatesTab`, the insert does not link back to the matching transaction. The `certificate_id` on `share_transactions` stays null, and `issued_certificate_number` is also null. The Cert # renderer in `StockLedgerTab` only checks `issued_certificate_number` — no fallback.

### Changes

**File: `src/components/company/StockCertificatesTab.tsx`** (lines 101-130)
- Change the insert path to return the new cert's ID via `.select("id").single()`
- After insert, query `share_transactions` for the most recent unlinked transaction matching `shareholder_id`, `share_class`, and `certificate_id IS NULL`, then update that transaction's `certificate_id` to the new cert ID
- Add `queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] })` to `onSuccess`

**File: `src/components/company/StockLedgerTab.tsx`** (lines 759-771)
- Modify the Cert # cell renderer to add fallback lookups after checking `issued_certificate_number`:
  1. If `certificate_id` exists on the transaction, find matching cert in `certificates` array by ID and display its `certificate_number`
  2. If neither, look up `certificates` for a match on `shareholder_id` + `share_class` + `num_shares`
  3. If still none, display "—"

## Problem 2: Capital Account Not Populating

**Root cause**: The `StockLedgerTab.add` mutation inserts into `share_transactions` but never updates `capital_account_balance` on `shareholders`. The display in `ShareholdersTab` reads `capital_account_balance` from the DB column.

### Changes (compute-from-transactions approach only)

**File: `src/components/company/ShareholdersTab.tsx`**
- Add `total_consideration, shareholder_id` to the transactions query select (line 105) — currently missing
- Add a `useMemo` that computes capital account per member by summing `total_consideration` for contribution/issuance types and subtracting for redemption/withdrawal types (using the same `REDUCTION_BALANCE_TYPES` set already defined)
- Replace the capital account cell renderer (lines 492-497) to use the computed value instead of `s.capital_account_balance`

**File: `src/components/company/StockLedgerTab.tsx`**
- No changes needed — the `add` mutation does not update `capital_account_balance` already (confirmed at lines 306-322). The `recalculate_ownership_percentages` RPC call stays as-is since it's for ownership %, not capital accounts.

## Technical Details

**Contribution types** (add to capital): `initial_issuance`, `authorized_issuance`, `subscription_issuance`, `consideration_issuance`, `initial_contribution`, `additional_contribution`, `membership_issuance`, `preemptive_rights`, `share_dividend`, `fractional_shares`, `reissuance`, `treasury_reissue`

**Reduction types** (subtract from capital): `redemption`, `reacquisition`, `cancellation`, `treasury_acquisition`, `withdrawal_distribution`, `dissociation_buyout`

**Transfer types**: No net capital change for transfers — they move interest between members, not add/remove capital.

## Files Changed

1. `src/components/company/StockCertificatesTab.tsx` — Link new certs to unlinked transactions
2. `src/components/company/StockLedgerTab.tsx` — Cert # fallback display logic
3. `src/components/company/ShareholdersTab.tsx` — Compute capital account from transactions

## Not Changed

Corporation flows, edge functions, meeting logic, PDF generators, database schema

