

# Implementation Plan: Unified Transaction Validation & Data Flow

## Step 1: Create `src/lib/transaction-validation.ts`

New file with four pure exported functions:

- **`validateIssuanceLimit(numShares, availableShares, term)`** — checks `numShares <= availableShares` when availableShares is not null. Returns `{ valid, message? }`.
- **`validateSellerHoldings(sellerName, numShares, transactions, shareholders, term)`** — uses imported `getHoldingsByName` to compute seller's current holdings and checks `numShares <= holdings`. Returns `{ valid, message? }`.
- **`validateLLCTotalInterest(numUnits, totalUnits)`** — checks `numUnits + totalUnits <= 100`. Returns `{ valid, message? }`.
- **`getNextCertificateNumber(companyId)`** — queries `stock_certificates` for `MAX(certificate_number)` via Supabase, returns `max + 1` or `1`.

Imports: `supabase` client, `getHoldingsByName` from `useShareCalculations`, `EntityTerminology` type.

## Step 2: Modify `CreateCompanyWizard.tsx`

### 2a. Imports
Add imports for `getNextCertificateNumber`, `validateIssuanceLimit` from the new module, `getTerminology`, `isLLCType`.

### 2b. LLC detection
Add `const isLLC = isLLCType(newType)` alongside existing `isCorp`. Get `const term = getTerminology(newType)`.

### 2c. Step navigation (line 431)
Change from `isCorp ? 2 : 3` to `(isCorp || isLLC) ? 2 : 3`. Update step label (line 346) to show "Initial Directors" for corps, "Initial Members" for LLCs, "Skip" otherwise.

### 2d. Step 2 rendering (line 438–537)
Add a conditional: if `step === 2 && isLLC`, render the existing shareholder form (name, address, units, class) using `term` labels. Reuse `shareholders` state, `addShareholder`, `editShareholder`, `removeShareholder`. The existing corp director form stays for `step === 2 && isCorp`.

### 2e. Validation in `addShareholder` (line 162–170)
Import and call `validateIssuanceLimit` for corps. For LLCs, keep existing flow (no authorized pool cap).

### 2f. `handleSave` changes (lines 230–328)
- Replace `let certNumber = 0` (line 247) with `let certNumber = await getNextCertificateNumber(companyId) - 1` so the `certNumber++` pattern yields the correct next number.
- Add `effective_date: new Date().toISOString().split("T")[0]` to `share_transactions` insert (line 287).
- After the shareholder loop (line 302), add: `await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId })`.
- Add LLC member save block: when `isLLC && shareholders.length > 0`, iterate shareholders, insert into `shareholders` table, create membership certificates via `getNextCertificateNumber`, insert `share_transactions` with `membership_issuance` type and `effective_date`, then call `recalculate_ownership_percentages`.

### 2g. Step 3 Review & Back button (line 580)
Change `isCorp ? 2 : 1` to `(isCorp || isLLC) ? 2 : 1`. Add LLC member review display similar to directors review.

## Step 3: Modify `StockLedgerTab.tsx`

### 3a. Imports (top of file)
Add `validateIssuanceLimit`, `validateSellerHoldings` from `transaction-validation.ts`. Add `isLLCType`.

### 3b. Validation in `add` mutation (line 232)
Before the insert call:
- If `ISSUANCE_SET.has(txType)`: compute available shares from `company.authorized_shares` minus current issued total from transactions, call `validateIssuanceLimit`. If invalid, throw with message.
- If `TRANSFER_SET_LOCAL.has(txType)` and `form.from_shareholder`: call `validateSellerHoldings` with form data, transactions, shareholders. If invalid, throw with message.

### 3c. Ownership recalc in `onSuccess` (line 280)
Add after existing invalidations:
```typescript
if (isLLCType(entityType)) {
  supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
}
```

## Step 4: Modify `ShareholdersTab.tsx`

### Line 137
Remove: `queryClient.invalidateQueries({ queryKey: ["share-transactions", companyId] });`
Keep line 138: `queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });`

## Step 5: MeetingResolutions verification
`BuySellWorkflow.tsx` line 259 already invalidates `["share_transactions", companyId]` with underscore. No changes needed.

## Files Changed
1. `src/lib/transaction-validation.ts` — NEW
2. `src/components/CreateCompanyWizard.tsx` — cert numbering, effective_date, LLC Step 2, RPC call
3. `src/components/company/StockLedgerTab.tsx` — validation + LLC recalc
4. `src/components/company/ShareholdersTab.tsx` — remove hyphen query key

