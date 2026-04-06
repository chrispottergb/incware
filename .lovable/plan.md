

## Refactor: Transaction-Driven Share Ownership

### Summary

Switch the source of truth for "Shares Held" from active certificates to the transactions ledger. Remove share/unit entry fields from the shareholder form. Stop auto-issuing certificates when recording transactions.

### Changes

**1. `src/hooks/useShareCalculations.ts` — Transaction-based holdings**

- Remove the `activeCertificates` query entirely (lines 77-89)
- Replace certificate-based `totalIssuedShares` (lines 93-95) with transaction-based calculation: sum issuances, subtract reductions. Transfers are neutral for totals.
- Replace certificate-based `shareholderHoldings` (lines 102-111) with per-shareholder net from transactions:
  - Issuances to `shareholder_id` → add
  - Reductions from `shareholder_id` → subtract
  - Transfers: `to_shareholder` name match → add, `from_shareholder` name match → subtract (same logic as existing `getHoldingsByName` but keyed by ID with name fallback for transfers)

**2. `src/components/company/ShareholdersTab.tsx` — Identity-only form**

- Remove from `form` state and `defaultForm`: `num_units`, `price_per_unit`, `capital_account`, `share_class` (lines 47, 84)
- Remove the "Initial Shares/Units" UI section (lines 385-422 — the `{!editId && (...)}` block)
- Remove from `save` mutation: `getNextCertNumber` call (line 91-99), auto-certificate + auto-transaction block (lines 106-108, 125-166). New shareholder insert becomes identity fields only.
- Keep the "Shares Held" display column — it reads from `shareholderHoldings` prop which will now be transaction-driven

**3. `src/components/company/StockLedgerTab.tsx` — No auto-certificate on Record Transaction**

- Remove the auto-certificate creation block in `add` mutation (lines 261-270): the `getNextCertNumber` + `createCertificate` calls for issuance/transfer types
- Set `certId` to null; keep `issued_certificate_number` and `surrendered_certificate_number` as optional manual-entry fields
- The `createCertificate` helper function (lines 222-239) and `getNextCertNumber` (lines 215-221) can be removed since they're no longer called
- Transaction insert remains unchanged — it just won't auto-create certificates

### What Stays Unchanged

- `StockCertificatesTab.tsx` — certificate issuance remains standalone
- `BuySellWorkflow.tsx` and edge functions — untouched
- `TransferLedgerTab` / `UnifiedLedgerTab` — untouched
- Database schema — no changes
- `getHoldingsByName` export — kept for BuySellWorkflow validation
- `recalculate_ownership_percentages` DB function — still called where needed

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useShareCalculations.ts` | Switch from certificate-based to transaction-based holdings |
| `src/components/company/ShareholdersTab.tsx` | Remove share fields from form and auto-cert logic |
| `src/components/company/StockLedgerTab.tsx` | Remove auto-certificate creation from Record Transaction |

