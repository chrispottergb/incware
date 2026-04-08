

# Add equity_type Column and Type Mapping

## Overview
Add a persisted `equity_type` column to `bills_of_sale`, implement a type mapping helper, add a Type dropdown to the edit form, and update edge functions to include `equity_type` in inserts.

## Changes

### 1. Database Migration
Add nullable `equity_type text` column to `bills_of_sale`.

### 2. `src/components/company/StockLedgerTab.tsx`
- Add `mapTxTypeToEquityType(txType, isLLC, consideration)` helper function above the component
- Mapping table:
  - `initial_issuance` → "Original Issue"
  - `authorized_issuance`, `consideration_issuance` → "Consideration for Shares"  
  - `initial_contribution`, `additional_contribution`, `membership_issuance` → "Capital Contribution"
  - `subscription_issuance` → "Subscription Purchase"
  - `transfer`, `interest_transfer`, `interest_assignment`, `share_exchange` with consideration > 0 → "Transfer (Sale)", else "Transfer (Gift)"
  - `redemption`, `reacquisition` → "Redemption"
  - `cancellation` → "Reclassification"
  - Default → null
- In the `bills_of_sale` insert (line ~325), add `equity_type: mapTxTypeToEquityType(txType, isLLCType(entityType), consideration)` to the payload

### 3. `src/components/company/BillsOfSaleTab.tsx`
- Add `equity_type: ""` to `emptyForm`
- In `openEdit`, populate `equity_type` from record, falling back to `getEquityTransactionLabel(b.seller_name, t.isLLC)` for legacy rows
- In `save` mutation payload, include `equity_type: form.equity_type || null`
- In Type column display (line 253), use `(b as any).equity_type || getEquityTransactionLabel(b.seller_name, t.isLLC)`
- In PDF rows (line 149), use same fallback
- Add Type dropdown as first field in the form (above Seller/Buyer) with 9 options: Original Issue, Consideration for Shares, Capital Contribution, Subscription Purchase, Transfer (Sale), Transfer (Gift), Redemption, Conversion, Reclassification

### 4. `supabase/functions/execute-share-transfer/index.ts`
- Add `mapTxTypeToEquityType` helper (same logic)
- In the `bills_of_sale` INSERT (line ~224), add `equity_type` column and value from the mapper

### 5. `supabase/functions/execute-batch-transfer/index.ts`
- Add same `mapTxTypeToEquityType` helper
- In the `bills_of_sale` INSERT (line ~246), add `equity_type` column and value

## Files Modified
1. Migration SQL
2. `src/components/company/StockLedgerTab.tsx`
3. `src/components/company/BillsOfSaleTab.tsx`
4. `supabase/functions/execute-share-transfer/index.ts`
5. `supabase/functions/execute-batch-transfer/index.ts`

## Not Changed
- Transaction table, ledger data, running balance calculations
- `getEquityTransactionLabel()` function (kept as fallback)
- Meeting logic, PDF generators, Corporation flows

