# Phase 0 Close-Out — B1 Count, B2 Coverage, E1 Findings

Counts are in. Nothing is blocked. This is the last inspection artifact.

## B1 — shareholder status NULL count

**Zero NULLs.** All 96 rows carry a value:

| status | rows |
|---|---|
| `active` | 93 |
| `inactive` | 3 |

No third value, no NULL, no `terminated`. The `OperatingAgreementGenerator.tsx:540` conversion from `status !== "inactive" && status !== "terminated"` to `status === "active"` is therefore exactly behavior-preserving on current data: the same 93 rows pass before and after. **No backfill needed.** Sequence collapses to: convert the call site, then add the CHECK.

The CHECK will be `status IN ('active','inactive','historical')` — `'historical'` included from the start so it does not require a second constraint change when B3's importer needs it. Validation against existing rows passes; both present values are in the allowlist.

Your pattern note is taken and correct on both counts. `reconciliation_note` is a **conditional CHECK constraint** on the snapshot row, not a column NOT NULL — written as a table-level `CHECK` that requires a non-empty note when the deviation band is non-zero, and I will write it that way rather than describing it in NOT NULL terms.

## B2 — Treasury coverage extends past the calculator

Accepted. Since no treasury row has ever existed in production, the importer creating the first one is genuinely untested territory across every consumer, not just the math. Alongside the denominator fix I will add a treasury-holding fixture entity to the document-generator test set — `OperatingAgreementGenerator`, `SMOperatingAgreementGenerator`, `operating-agreement-pdf`, `record-book-pdf`, and `BillsOfSaleTab` — asserting the treasury holder appears on no member schedule, roster, signature block, or instrument, and that percentages on those documents are computed against outstanding rather than issued. The golden-master fixture change from the denominator fix is called out separately in that commit, not folded in.

Phase 2 scope amended per your note: `lease-classification.ts` and `useLeaseClassification.ts` join the percentage-basis work explicitly. A percentage entity returning zero holdings would make related-party detection report no related parties — a confidently wrong compliance answer, which is worse than an empty field.

## E1 — Findings, reported not fixed

**`shareholders_legacy_ssn_archive` — 1 row, orphaned.** The row holds an 11-character plaintext value (SSN format, `NNN-NN-NNNN`) keyed to `shareholder_id = 49b5a04a-…`, and **that shareholder no longer exists** — the parent row was deleted after the archive was written. So the value cannot be re-associated with any person in the system, cannot be re-encrypted into a live record, and 0 of 96 current shareholders hold an encrypted SSN, meaning there is nothing this archive could roll back to. It serves no remaining purpose and is a plaintext SSN with no owner. **My recommendation matches your default: purge the row and drop the table.** Nothing deleted; awaiting your go.

**`filing_checklist.ein_number` — 3 rows, all duplicates of encrypted company data.** All three parse as valid EINs, and for all three the parent company **already holds an encrypted EIN** (`companies.ein_encrypted` present, `companies.ein` empty). So this is redundant plaintext, not a second source of record. **The fix is to read from the encrypted source and drop the column, not to add a second encryption path** — exactly as you framed it. Affected: Friebel Real Estate LLC, Lydia Jean Photography LLC, Wisconsin Blizzard Basketball Inc. The filing checklist UI would switch to the existing `decrypt-company-ein` path already used elsewhere. Scheduled after Phase 1.

**`companies.ein`, `company_banks.*`, `master_firms.*`** — 0 populated rows, writes blocked by `block_plaintext_bank_numbers`, retained as read-fallbacks. No action.

## Approved delivery order — now executing

1. `OperatingAgreementGenerator.tsx:540` allowlist conversion (no backfill required), then the `status` CHECK with `'historical'` included.
2. Treasury denominator fix — exclude `is_treasury` from `totalIssuedShares` and from the `recalculate_ownership_percentages()` denominator — with the golden-master fixture change called out and B2 document-generator coverage added.
3. B5 golden-master suite.
4. C3 findings report (each difference marked intentional or defect), then the behavior-preserving extraction PR.
5. Phase 1 — unit basis only, wizard constrained to `'units'`, percentage a visible disabled option.

E1 items reported only, scheduled after Phase 1. Phase 0 is closed; approve and I start building.
