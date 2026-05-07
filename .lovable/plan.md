## Problem (verified)

Members table shows Andy 60% / Christopher 40%, but the membership-interest unit certificate PDF prints the wrong %.

Two bugs in the certificate PDF data flow:

1. **Stale snapshot**: `stock_certificates.ownership_percent_snapshot` is captured at issuance via `recalculate_ownership_percentages`. Andy's cert was snapshotted as 100% when he was the only member; adding Christopher never re-snapshotted Andy's cert. The PDF then preferred this stale snapshot (`ownershipPercentSnapshot ?? liveOwnershipPercent`).

2. **Wrong live fallback**: in both `UnifiedLedgerTab.handlePrintCertificate` and `StockLedgerTab.handlePrintCertificate`, the live % is computed as `t.num_shares / totalUnits`, i.e. *this single transaction's units* over the company total — not the holder's aggregate units. For a single-cert holder this happens to be right, but it bypasses the holder concept entirely and any later edits are wrong.

## Fix

In both `UnifiedLedgerTab.tsx` (~line 296) and `StockLedgerTab.tsx` (~line 595) `handlePrintCertificate`:

- Compute `liveOwnershipPercent` as: holder's total active units across all their certificates / company's total active units.
- For LLCs, pass `ownershipPercentSnapshot: null` so the PDF uses the live current ownership (matches Members tab and the freshly-fixed Unified Ledger).
- For corporations, keep the existing snapshot/live fallback unchanged (snapshots are a legal record at issuance for stock certificates).

Optional follow-up (not in this change): backfill / clear stale `ownership_percent_snapshot` for existing LLC certs.

## Files

- `src/components/company/UnifiedLedgerTab.tsx`
- `src/components/company/StockLedgerTab.tsx`
