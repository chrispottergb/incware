

# Logic QA — Findings

## Bugs Found

### 1. `parseInt` Truncates Par Value Decimals (HIGH — Data Loss)
**File:** `src/components/company/StockCertificatesTab.tsx` line 113

```typescript
par_value: form.par_value ? parseInt(form.par_value) : null
```

`parseInt("0.01")` returns `0`. Par values like $0.001, $0.01, $0.10 are all stored as `0` or `null`. The `StockLedgerTab` correctly uses `parseFloat` for the same field. This silently corrupts certificate par value data.

**Fix:** Change `parseInt(form.par_value)` → `parseFloat(form.par_value)`.

---

### 2. Issuance Validation Ignores Redemptions (MEDIUM — Overly Strict)
**File:** `src/components/company/StockLedgerTab.tsx` lines 267-273

The available-shares check before an issuance only sums issuances:
```typescript
const currentIssued = transactions
  .filter(t => t.status !== "corrected")
  .reduce((sum, t) => {
    if (ISSUANCE_SET.has(t.transaction_type)) return sum + (t.num_shares || 0);
    return sum;
  }, 0);
const available = company.authorized_shares - currentIssued;
```

This never subtracts redeemed/cancelled shares, so if a company has 1000 authorized shares, issues 800, redeems 200, it shows 200 available but the validation thinks 0 are available. The correct calculation exists in `useShareCalculations.ts` (which subtracts `REDUCTION_TYPES`).

**Fix:** Subtract redemptions from `currentIssued`, matching the logic in `useShareCalculations`.

---

### 3. Fire-and-Forget RPC Without `await` (LOW — Silent Failure)
**File:** `src/components/company/StockLedgerTab.tsx` line 384

```typescript
supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
```

This call is not awaited and has no error handling. If it fails, LLC ownership percentages silently become stale. Compare to `CreateCompanyWizard.tsx` which correctly uses `await supabase.rpc(...)`.

**Fix:** Add `await` and wrap in try/catch, or at minimum `.then(null, console.error)`.

---

### 4. `FilingComplianceTab` useEffect Has No Error Handling (LOW)
**File:** `src/components/company/FilingComplianceTab.tsx` lines 142-166

The `run()` async function inside `useEffect` performs database inserts and deletes but never catches errors. A failed insert/delete silently breaks the checklist seeding.

**Fix:** Add `.catch(err => toast.error(...))` to the `run()` call.

---

## Items Reviewed and Found Sound

- **`useAutoSave` race condition:** Retry timer is correctly cleared on success (lines 79-82). The `finally` block resetting `savingRef` after catch's timeout setup is technically harmless since the timeout callback re-checks independently.
- **`useSessionIdleTimeout`:** Throttle + interval pattern is correct. Cleanup is thorough.
- **`useShareCalculations`:** Transfer logic correctly matches by name normalization. Holdings floor at 0.
- **Auth flow:** `onAuthStateChange` + `getSession` ordering is correct per Supabase docs.
- **Query `enabled` guards:** All queries properly gate on `!!id` or `!!user?.id`.
- **Date comparisons:** String ISO date comparisons (`YYYY-MM-DD`) work correctly for chronological ordering.
- **`toISOString().split("T")[0]`:** Used extensively — correct for UTC dates, though timezone edge cases exist at midnight. This is an accepted pattern throughout the codebase.

---

## Implementation

### Scope: 3 files, 4 fixes

**`StockCertificatesTab.tsx`** — Change `parseInt(form.par_value)` to `parseFloat(form.par_value)` (1 line).

**`StockLedgerTab.tsx`** — Two fixes:
1. Subtract redemptions in the issuance validation (lines 267-273): add a reduction for `REDUCTION_SET` types in the same reduce.
2. Add `await` to the `supabase.rpc` call on line 384.

**`FilingComplianceTab.tsx`** — Add error handling to the seeding `run()` call (line 165): `run().catch(err => console.error("Checklist seed error:", err))`.

No database changes.

