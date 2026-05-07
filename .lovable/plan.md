## Problem (verified)

Queried `share_transactions` for Heritage Holdings:
- May 5: Andy — 600 units (initial_contribution)
- May 7: Christopher — 400 units (initial_contribution)

The Unified Membership Ledger's **Own. %** column computes ownership using a *running* denominator at the moment each row is processed:
- Row 1 (Andy, May 5): denom = 600 → **100%**
- Row 2 (Christopher, May 7): denom = 1,000 → **40%**

The Members UI correctly shows **60% / 40%** because it uses the final cumulative total.

My earlier patch only equalized rows that share the same date — these don't, so it had no effect.

## Fix

In `src/components/company/UnifiedLedgerTab.tsx`, replace the second-pass running-denominator logic with a final-balance computation:

1. Walk all `sorted` transactions once to compute `finalHolder[name]` and `finalTotal` (issuances add, redemptions/cancellations subtract, transfers move between holders).
2. For every entry row, set `e.ownershipPct = (finalHolder[holderKey] / finalTotal) * 100`.

This makes every row in the Own. % column reflect each member's **current** ownership of the entity — consistent with the Members tab (Andy 60%, Christopher 40%). The SH Bal. column (per-row running balance) is unchanged.

## Files changed

- `src/components/company/UnifiedLedgerTab.tsx` — replace lines 260–290 with the final-balance loop.
