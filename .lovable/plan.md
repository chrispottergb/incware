

# Upgrade "Approve Loan from Related Party" Resolution Template

## What changes

Replace the existing "Approve Loan from Related Party" template across all entity types in `src/lib/resolution-types.ts` with the expanded version that includes:

- **WHEREAS recitals** establishing context (capital need, lender offer, approving body review)
- **Structured loan terms** (Interest Rate, Maturity Date, Repayment Terms, optional Collateral)
- **Entity-aware approving body language** (Board of Directors / Members / Managers per entity type)
- **Arm's-length comparison** and conflict of interest compliance language

## File to modify

**`src/lib/resolution-types.ts`** — Update the `template` string for "Approve Loan from Related Party" in each entity type array (Corporation, S-Corp, LLC, SMLLC, LLC-S, Non-Profit, Partnership), substituting the appropriate governing body term in each.

Note: The user's message appears cut off after "comparable to those that could be obtained from an" — I will complete the sentence with standard legal language ("...arm's-length transaction") and include the remaining FURTHER RESOLVED clauses consistent with the pattern (authorized person, conflict disclosure).

No new files, no schema changes, no new resolution types — just a template text upgrade for one existing resolution across all entity arrays.

