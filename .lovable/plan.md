# Opening Ownership Snapshot — Phase 0 Response (Step 3 of your deliverable order)

Answers to C1–C6 and B1–B4, plus one correction to an item you approved in section A. No code written.

## Correction to A — the app_settings feature flag will not work as approved

You asked me to confirm app_settings RLS scopes the flag per workspace. It does not, and it cannot. The table is a global key/value store: three columns (`key`, `value`, `updated_at`), a SELECT policy of `USING (true)` for all authenticated users, and admin-only writes via `has_role()`. There is no `user_id` or `company_id` column. Flipping a flag there flips it for every tenant simultaneously — exactly the failure you were checking for.

The real tenant boundary in this app is `companies.user_id`. Recommendation: put the flag on the entity as `companies.ownership_snapshot_enabled boolean NOT NULL DEFAULT false`. Every read path already loads the company row, the flag rides existing RLS, and per-entity opt-in matches the two-regimes design in A. A global `app_settings` kill switch can sit on top as an AND condition if you want one lever to disable the feature everywhere.

## C1 — Dual source of truth for quantity

**Recommendation: (a), the ledger row is authoritative.** The lot row is metadata and provenance only — certificate label, acquisition type, transferor description, consideration, review flags — and it holds no independent quantity after commit. Rationale: option (b) means a numeric column that every existing read path ignores, which is precisely how the two caches you already have drifted.

Mechanics: during wizard entry the lot carries a draft quantity (it must — nothing is in the ledger yet). At commit the ledger row is generated, `share_transaction_id` is set NOT NULL via a deferred constraint, and the draft quantity column is renamed in intent to `entered_quantity` and treated as immutable audit evidence of what was typed, never read by any calculator. Divergence between `entered_quantity` and the linked ledger row is then a detectable audit signal rather than a competing truth.

**Three-way lock-time integrity check**, run inside the lock transaction and blocking on failure: for each holder in the snapshot, `sum(linked opening_balance rows)` must equal `sum(lots.entered_quantity)` must equal `shareholders.num_shares`. The third leg is the valuable one — it is the first thing in this codebase that will catch the `num_shares` cache having drifted from the ledger, and the lock is the right moment to catch it. Failure reports the specific holder and the three values; it does not auto-repair.

## C2 — recalculate_ownership_percentages() and percentage-basis entities

Confirmed unaddressed and confirmed a real hazard: the function sums `num_shares` from `share_transactions` and divides by the company total. If a percentage entity wrote `50` into `num_shares` to mean 50%, the function would compute 50/100 = 50% and look correct — the percentages-of-percentages trap you named — right up until a second class or a treasury row makes the denominator something other than 100.

**Decision: percentage-basis entities are excluded from the function entirely.** Their `ownership_percentage` is written directly from the snapshot lots at commit, and `num_shares` stays `0` on both the ledger row and the shareholder row for those entities. Nothing writes a unit count that does not represent a unit count.

Implementation: add `companies.quantity_basis text NOT NULL DEFAULT 'units'`. Add a gate at the top of `recalculate_ownership_percentages()` that returns immediately when the company's basis is `'percentage'`. This is the one modification to an existing database object I am requesting; it is a guard clause with no effect on any current entity, since every existing row will be `'units'`. The percentage values themselves live on the lots as `numeric(9,6)` per B2 and are copied to `shareholders.ownership_percentage` on lock.

Consequence to accept explicitly: `useShareCalculations` returns `totalIssuedShares = 0` and all-zero holdings for percentage entities. Any UI that renders unit counts must read the basis and render percentages instead. I will enumerate those call sites during Phase 1 rather than guess at them now.

## C3 — Five duplicated classification lists

Exception accepted, and I agree it is the top structural risk. Standalone behavior-preserving PR, merged before Phase 1: extract `ISSUANCE_TYPES` / `REDUCTION_TYPES` / `TRANSFER_TYPES` into `src/lib/transaction-types.ts` and import them in `useShareCalculations.ts`, `UnifiedLedgerTab.tsx`, `TransferLedgerTab.tsx`, `StockCertificatesTab.tsx`, and `SMOperatingAgreementGenerator.tsx`. Nothing else in that PR.

Caveat you should know before approving the extraction: the five copies are **not currently identical**. `lease-classification.ts` uses `Set`s named `ISSUE_TYPES` / `REDEEM_TYPES` with different membership, and I have not yet diffed all five sets member by member. So a literal extraction is behavior-*changing* for whichever call sites have narrower lists. I will diff all five first and report the differences to you; where they differ, the default is to preserve each call site's current membership by passing an explicit subset, not to silently widen it to the union. Widening any list is a separate decision you make per site, not something the refactor sneaks in.

On your one-line question: `lease-classification.ts` uses share-transaction types to determine related-party status by checking whether a lease counterparty holds equity — so it needs holdings math, and the type lists were copy-pasted to get it. The lists are copy-paste; the use is legitimate.

## C4 — Treasury

`shareholders.is_treasury` is `boolean NOT NULL DEFAULT false` and is filtered out of roster, cap-table display, meeting attendance, operating-agreement schedules, and certificate issuance — but **it is not filtered anywhere in `useShareCalculations`**, so treasury units currently sit in `totalIssuedShares` and in the `recalculate_ownership_percentages()` denominator. That is pre-existing behavior; I am not changing it outside the snapshot flow, since doing so would move every existing entity's percentages.

For the snapshot: the importer recognizes a treasury return from (1) an explicit destination holder flagged `is_treasury`, (2) holder-name matching against "treasury" / "the company" / the entity's own name, or (3) a retirement-style acquisition type with no successor holder. Any of the three routes the lot to the treasury holder, creates it flagged if absent, and marks it `needs_review` so a human confirms rather than the parser deciding. **Confirmed: treasury holdings are excluded from the reconciliation-gate denominator** — outstanding equals issued minus treasury, and the gate reconciles against outstanding. The gate will therefore disagree with `useShareCalculations` for any entity holding treasury units; that disagreement is surfaced in the reconciliation panel as a named line item, not hidden.

## C5 — Amendments

Confirmed, and no parallel mechanism. Amending a locked snapshot sets the superseded snapshot's generated `opening_balance` rows to `status = 'corrected'`, which the calculator already skips, and the amended snapshot generates fresh rows. `supersedes_id` chains the headers. The corrected rows remain in `UnifiedLedgerTab` and `TransferLedgerTab` as visible history — those views render `corrected` rows with strikethrough today, so this needs no display work. One dependency: the `entered_quantity` NOT NULL link in C1 must be per-snapshot, not per-transaction-globally, so a superseded lot keeps pointing at its now-corrected row.

## C6 — Encrypted PII

Confirmed on all three counts. `shareholders.ssn_ein_encrypted` is `bytea`, written only through the `encrypt_shareholder_ssn` security-definer function and read only through `decrypt_ssn_ein` behind an ownership check. The importer's holder-matching select will name its columns explicitly (`id, name, is_treasury, status`) and will never include the encrypted column or the legacy plaintext one, so the ciphertext never enters memory. No SSN/EIN field appears in the import column-mapping options, the preview grid, validation messages, or the review report. Import errors reference row number and holder name only. Nothing in the import path logs a row object wholesale.

## B1 — Normalized class key

Accepted as corrected. `share_class_key` stored normalized (trim, lowercase, collapse whitespace), unique partial index on `(company_id, share_class_key) WHERE status = 'locked'`. Input constrained to the `classOptions` list from `entity-terminology.ts`, free text only via an explicit "Other" path that still normalizes. Note that existing `share_class` values in `stock_certificates` and `share_transactions` are unconstrained free text and stay that way — the normalization applies to snapshots only.

## B2 — Percentage tolerance

Accepted as corrected, three bands exactly as specified. Exact 100.000000 locks silently; within ±0.01% requires a typed `reconciliation_note` (text, NOT NULL when the deviation band is entered, no checkbox); beyond ±0.01% blocks with no override path in the UI or the API. Percentages stored `numeric(9,6)`.

## B3 — Historical holders

**`stock_certificates.shareholder_id` is nullable today.** `company_id` and `certificate_number` are NOT NULL; the holder FK is not.

**Recommendation: create historical `shareholders` rows, do not use the nullable FK.** A free-text holder name on the certificate would be invisible to `owner-aliases.ts`, so a dissolved 2017 predecessor trust could never be linked to its successor by name history — which is the exact scenario the alias system was built for. Instead the importer creates the holder with `status = 'historical'` (a new status value alongside the existing `active`), which the cap table, roster, meeting attendance, and percentage math already exclude by their `status === "active"` checks, and which lets `predecessor_shareholder_id` chain a dissolved trust to its successor. Nothing is silently dropped: an unmatched retired holder becomes a historical shareholder row flagged `needs_review` on its lot.

## B4 — certificate_label and the suggester

**`stock_certificates.certificate_number` is `integer NOT NULL`** — so an alphanumeric-only company must write something into it. It writes a monotonic internal sequence, per-company, used only for ordering and uniqueness, never displayed anywhere once `certificate_label` is present. I will enforce that: every display site resolves through a single `formatCertificateNumber(row)` helper that returns `certificate_label ?? certificate_number`, and the integer is not rendered directly anywhere.

`getNextCertificateNumber` keeps its current signature and behavior for integer-only companies — `MAX + 1`, returned as a suggestion the user can overwrite. Label-aware companies get a sibling that infers the pattern from the highest existing label (prefix plus zero-padded numeric tail) and falls back to the integer suggestion when no pattern is inferable. Both remain suggestions; neither blocks a manual entry.

## B5 — Golden-master regression suite, built first

Agreed and sequenced first. Fixture set covering: multiple share classes; `status = 'corrected'` rows; future-dated `effective_date` rows; transfers by free-text name resolved through the alias index, including a renamed trust; treasury holdings; fractional quantities at `numeric(18,4)` precision; an entity with existing `opening_balance` rows; and an entity with none. Snapshot the full output of `useShareCalculations` and `getHoldingsByName` across all of it and assert byte-identical results after every subsequent commit, including the C3 extraction.

I can produce that fixture set — the type lists, the alias resolution, and the precision rules are all readable from the existing code, and the fixtures are pure data passed to pure functions. Not a blocker.

## Delivery order

1. B5 golden-master suite.
2. C3 diff report of the five lists, returned to you, then the behavior-preserving extraction PR.
3. Phase 1, only after you approve the above and the corrections here.

Approve, or tell me where this is wrong.
