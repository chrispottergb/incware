# Opening Ownership Snapshot — Phase 0 Inspection Report

No code was changed. Below is what the app actually does today, where the proposed design conflicts with it, and what I recommend.

## 1. What exists today

**Canonical holder record: `shareholders`** (scoped by `company_id`). It already carries far more than a name: `owner_kind`, `holder_subtype`, `trust_revocability`, `trustee_name`, `representative_name`, `representative_title`, `predecessor_shareholder_id`, `ownership_percentage`, `num_shares`, `capital_account_balance`, `is_treasury`, encrypted SSN/EIN. A companion `shareholder_name_history` table plus `src/lib/owner-aliases.ts` resolve historical names to the current owner. **No new holder table is needed or wanted.** `predecessor_holder_id` from your spec already exists as `predecessor_shareholder_id`; only `capacity_description` is missing.

**Ownership is calculated from the transactions table, everywhere.** The source of truth is `share_transactions`. The primary calculator is `src/hooks/useShareCalculations.ts` (`useShareCalculations`, `getHoldingsByName`), which classifies rows into issuance / reduction / transfer type lists, skips `status = 'corrected'`, skips future `effective_date`, and resolves free-text transfer names through the alias index. The same type lists are **duplicated** in `UnifiedLedgerTab.tsx`, `TransferLedgerTab.tsx`, `StockCertificatesTab.tsx`, `SMOperatingAgreementGenerator.tsx`, and `lib/lease-classification.ts`. Two denormalized caches exist downstream: `shareholders.num_shares` (written by the onboarding flows) and `shareholders.ownership_percentage` (written by the `recalculate_ownership_percentages()` database function, which also reads `share_transactions`). There is no ownership view.

**Opening balances already exist in the ledger, typed.** `share_transactions.entry_type = 'opening_balance'` is written by both onboarding paths, rendered italic/greyed in the ledgers, and sorted first. `companies.opening_balance_date` is the back-dating lock, enforced in `StockLedgerTab.tsx` and `BuySellWorkflow.tsx`.

**Existing "Existing Entity" flow, end to end.** Two entry points: `CreateCompanyWizard.tsx` (`flowType = "existing"`, step 0 choice) for brand-new records, and `EstablishOwnershipDialog.tsx` for companies already in the system. Both: set `opening_balance_date`, insert/reuse `shareholders`, insert one `stock_certificates` row per position (cancelled ones are history only, no ledger row), insert one paired `opening_balance` transaction per active certificate, sync `shareholders.num_shares`, then call `recalculate_ownership_percentages()`. There is no reconciliation gate, no lock, no import, and no amendment trail.

**LLC vs corporation.** Purely a terminology layer (`src/lib/entity-terminology.ts`) over the same unit-count schema. **The app assumes a countable quantity for every holder** — `num_shares` drives the certificates, the ledger, the cap table, and the percentage recalculation. Percentage-only ownership is not supported anywhere.

**Certificate numbers** are stored as `integer`: `stock_certificates.certificate_number`, `share_transactions.issued_certificate_number` / `surrendered_certificate_number`. Next-number suggestion is `MAX + 1` (`getNextCertificateNumber` in `transaction-validation.ts`). Alphanumeric formats are impossible today.

**RLS pattern** is uniform: four per-command policies per table using `EXISTS (SELECT 1 FROM companies WHERE companies.id = <t>.company_id AND companies.user_id = auth.uid())`.

**No feature-flag infrastructure exists.** There is a key/value `app_settings` table used for a couple of one-off settings.

## 2. Where the proposed design is wrong for this codebase

- **A fully separate snapshot-position table would be the wrong call.** Every ownership path reads `share_transactions`; a parallel table means touching all of them plus the database recalculation function. Recommendation: **keep positions as `entry_type = 'opening_balance'` ledger rows (already distinctly typed, already excluded from ordinary editing) and add a snapshot *header* table** that owns the as-of date, basis, tier, declared/computed totals, lock state, and amendment chain. Non-negotiables you listed are all satisfiable this way.
- **`security_class_id` has no counterpart.** Share class is a free-text column (`share_class`) with options from the terminology helper. Creating a security-class table is a large, out-of-scope refactor. Recommendation: key the snapshot on `(company_id, share_class)` text instead.
- **`certificate_number` cannot become text.** Changing the column type is destructive and banned by your own scope rule. Recommendation: add a nullable `certificate_label text` alongside the integer, treat it as the display value when present.
- **`retired_ownership_records` duplicates existing behavior.** Cancelled `stock_certificates` rows already are the display-only archive and already contribute nothing to math. Recommendation: reuse them; do not add the table.
- **"Do not change existing ownership calculation logic" cannot hold for `percentage` basis.** A percentage entity has no units to sum, so the calculator must gain a percentage branch. It will be gated so that unflagged / unit-based entities take the identical code path they take today.
- **Down migrations aren't supported** on this platform's migration runner. I can ship a documented rollback SQL block per migration instead of an executable `down`.
- **`entity_id` / `holder_id`** map to `company_id` / `shareholder_id` — I'll follow the codebase names.

## 3. Proposed additions (nothing modified, nothing dropped)

New tables: `ownership_snapshots` (company_id, share_class text, as_of_date, quantity_basis, entry_tier, declared_total, computed_total, variance, highest/suggested certificate label, status, supersedes_id, locked_at/by, source_document_id, notes; unique partial index on one locked row per company+class) and `ownership_snapshot_lots` (snapshot_id, shareholder_id, quantity numeric(20,6), certificate_label, certificate_date, acquired_date, acquisition_type, transferor_description, consideration_paid, status, needs_review, review_reason, notes, plus a nullable link to the generated `share_transactions` row). New nullable columns: `shareholders.capacity_description`, `stock_certificates.certificate_label`, `share_transactions.issued_certificate_label`.

New files: `src/lib/ownership-snapshot.ts` (types, basis rules, reconciliation), `src/lib/ownership-import.ts` (paste/CSV/XLSX parse, header pre-mapping, outstanding-vs-retired derivation, forward-fill with `needs_review`, holder matching against existing `shareholders`), `src/hooks/useOwnershipSnapshot.ts`, `src/components/company/ownership-snapshot/` (wizard: as-of date → class & basis → holders → positions → reconcile → review → lock; importer with column mapping and grouped preview; unverified badge + upgrade path), `src/lib/feature-flags.ts`, and tests including the no-snapshot regression test.

Files touched (additively): `useShareCalculations.ts` (snapshot-aware branch behind the flag), `EstablishOwnershipDialog.tsx` and `CreateCompanyWizard.tsx` (new detail-level step, flag-gated), `ShareholdersTab.tsx` / `StockLedgerTab.tsx` (badge, pre-snapshot date rejection message), `transaction-validation.ts` (label-aware suggestion).

## 4. Assumptions needing your approval

1. Opening positions stay as typed `opening_balance` ledger rows; the new tables are the header + lot metadata and the reconciliation/lock record. **Recommended.**
2. Snapshots key on `(company_id, share_class)` text — no security-class table.
3. Cancelled `stock_certificates` serve as the retired archive; `retired_ownership_records` is not created.
4. `certificate_label` (text) is added alongside the existing integer column rather than converting it.
5. Percentage-basis entities skip certificate and unit logic entirely and reconcile to 100% within a tolerance I'll surface in the UI — say what tolerance you want (default: ±0.01%).
6. The feature flag lives in `app_settings` (per-workspace, togglable without a deploy) rather than a build constant.
7. Rollback ships as documented SQL, not an executable down migration.
8. Existing entities already onboarded through the current dialog get **no** snapshot row and behave exactly as today until someone runs the new wizard.

Confirm or correct these and I'll proceed to Phase 1.
