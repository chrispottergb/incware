

# Existing Entity — Establish Current Ownership

## Overview
This is a large, multi-file feature that adds a second path in the New Client wizard for pre-existing entities and implements opening balance guards across the app. The plan covers 2 database migrations, 1 RPC update, and changes to 7 source files.

## Technical Details

### 1. Database Migrations

**Migration 1: Schema changes**
```sql
ALTER TABLE public.companies ADD COLUMN opening_balance_date date DEFAULT NULL;
ALTER TABLE public.share_transactions ADD COLUMN entry_type text DEFAULT NULL;
```

**Migration 2: Update `recalculate_ownership_percentages` RPC**
Add `'opening_balance'` alongside `'initial_issuance'` and `'initial_contribution'` in all three places the RPC references issuance types (total_units calculation, shareholder units subquery, and any CASE statements).

---

### 2. `src/components/CreateCompanyWizard.tsx` — Major rework (~400 lines added)

**New state variables:**
- `flowType: "new" | "existing" | null` (initially null — Step 0)
- `openingBalanceDate: string`
- `confirmOwnership: boolean` (checkbox for review step)

**Extended `InitialShareholder` interface:**
- Add `cert_number: string`, `consideration: string`, `consideration_type: string`

**Step flow changes:**
- `step` type becomes `0 | 1 | 2 | 3 | 4` (was `1 | 2 | 3`)
- Step 0 (new): Two selection cards — "New Entity — Set up from formation" and "Existing Entity — Establish current ownership as of a date". Clicking either sets `flowType` and advances to Step 1.
- Step 1: Company details — unchanged for both flows.
- Step 1.5 (Step 2 for existing): Date picker for `openingBalanceDate` + warning: "All future transactions must be dated on or after this date."
- Step 2 (shareholders) for existing flow: Extended form with cert_number, consideration, consideration_type fields. For Corps, this replaces the directors-only step — existing entity step captures shareholders directly with cert numbers.
- Step 3 (review) for existing flow: Summary table showing all shareholders, holdings, cert numbers, ownership %. Confirmation checkbox required.

**New `handleSaveExisting()` function:**
1. Create company with `opening_balance_date` set
2. For each shareholder:
   - Insert shareholder record
   - Check cert collision: query `stock_certificates` for existing `certificate_number` + `company_id`. Block with per-cert error if found.
   - Insert `stock_certificates` with user-entered cert number
   - Insert `share_transactions` with `transaction_type: "opening_balance"`, `entry_type: "opening_balance"`, both dates = `openingBalanceDate`, notes: "Opening balance established as of [date]"
   - Insert `bills_of_sale` with `equity_type: "Opening Balance"`, `seller_name: "Pre-existing Ownership"`, `buyer_name: shareholder name`
   - Encrypt SSN/EIN if provided
3. Call `recalculate_ownership_percentages` RPC
4. Navigate to company detail

**Existing "New Entity" flow:** Step numbering shifts (0→1→2→3→4 internal mapping) but the actual screens and logic for new entities remain completely unchanged. `handleSave()` is not modified.

---

### 3. `src/components/company/StockLedgerTab.tsx`

**Date guard in `add` mutation (before insert, ~line 246):**
- Query `companies.opening_balance_date` for this company
- If set and `form.transaction_date < opening_balance_date`, throw error: "This entity has an opening balance established as of [date]. Transactions cannot be dated before the opening balance date."

**Add `"opening_balance"` to `BILL_ISSUANCE_TYPES` set** (line ~322)

**Transaction table rendering (~line 783):**
- Check `(t as any).entry_type === "opening_balance"`
- If true, apply italic styling to the row and show type badge as `"Opening Balance (as of [date])"` using the transaction_date

---

### 4. `src/components/company/BuySellWorkflow.tsx`

**Date guard in `handleSave()` (before edge function call, ~line 217):**
- Query `companies.opening_balance_date` 
- If set and `form.transaction_date < opening_balance_date`, block with toast error using the same message

---

### 5. `src/hooks/useShareCalculations.ts`

**Add `"opening_balance"` to `ISSUANCE_TYPES` array** (line ~11). No other changes.

---

### 6. `src/components/company/TransferLedgerTab.tsx`

**Add `"opening_balance"` to `ISSUANCE_TYPES` array** (line ~14)

**Display styling in table rendering (~line 353):**
- Detect `(t as any).entry_type === "opening_balance"` on raw transaction
- Apply italic text + `bg-muted/30` row styling
- Show type as `"Opening Balance (as of [date])"`

**Sorting:** In the `sorted` array construction (~line 162), add secondary sort that prioritizes `entry_type === "opening_balance"` entries before other transactions on the same date.

---

### 7. `src/components/company/UnifiedLedgerTab.tsx`

Same changes as TransferLedgerTab:
- Add `"opening_balance"` to `ISSUANCE_TYPES` (line ~16)
- Apply italic/gray styling for opening balance rows in the table (~line 337)
- Show type as `"Opening Balance (as of [date])"`
- Sort opening balance entries first on same date

---

### 8. `src/components/company/BillsOfSaleTab.tsx`

**`getEquityTransactionLabel` fallback (~line 24):**
- Add check: if `s === "pre-existing ownership"` return `"Opening Balance"`

**Add `"Opening Balance"` to `EQUITY_TYPE_OPTIONS` array** (line ~72)

**Table row styling (~line 278):**
- Detect `(b as any).equity_type === "Opening Balance"` or `b.seller_name === "Pre-existing Ownership"`
- Apply italic text + `bg-muted/30` row class

---

## Files Modified
1. Migration SQL (2 columns + RPC update)
2. `src/components/CreateCompanyWizard.tsx` — Flow type selection, extended shareholder form, new save logic
3. `src/components/company/StockLedgerTab.tsx` — Date guard, opening_balance display styling
4. `src/components/company/BuySellWorkflow.tsx` — Date guard
5. `src/hooks/useShareCalculations.ts` — Add opening_balance to ISSUANCE_TYPES
6. `src/components/company/TransferLedgerTab.tsx` — Display styling + sort
7. `src/components/company/UnifiedLedgerTab.tsx` — Display styling + sort
8. `src/components/company/BillsOfSaleTab.tsx` — Fallback label + display styling

## Not Changed
- Existing "New Entity" wizard flow
- Edge functions (execute-share-transfer, execute-batch-transfer)
- Meeting flows, other PDF generators
- `getTerminology()`, `getHoldingsByName()`
- Any files not listed above

