# Opening Ownership Snapshot — C-Blocker Resolutions and Three Reports

Everything below is verified against the live schema and codebase. No code written.

## C-blocker 1 — Numeric precision

Verified actual precisions:

| Column | Type |
|---|---|
| `share_transactions.num_shares` | `numeric(18,4)` NOT NULL DEFAULT 0 |
| `stock_certificates.num_shares` | `numeric(18,4)` NOT NULL DEFAULT 0 |
| `shareholders.num_shares` | `numeric(18,4)` DEFAULT 0 |
| `stock_certificates.ownership_percent_snapshot` | `numeric(7,4)` |
| `shareholders.ownership_percentage` | `numeric` (unconstrained) |

You are right that `(20,6)` was going to truncate on write and fail the three-way check. **`entered_quantity` becomes `numeric(18,4)`, matching exactly.** No rounding rule needed because no rounding occurs — all three legs of the integrity check are the same type. The wizard's quantity input enforces a 4-decimal maximum at entry so the user is stopped at the keyboard rather than silently truncated at the database. My B5 fixture note was the correct number; `(20,6)` was the error.

Percentages remain `numeric(9,6)` per B2. They are a separate column on a separate table and never mix with quantities. Note for Phase 2: `shareholders.ownership_percentage` is unconstrained `numeric`, so copying a `(9,6)` value into it loses nothing.

## C-blocker 2 — Calculator branches on the lock, not the flag

Confirmed exactly as you state. `companies.ownership_snapshot_enabled` gates **only** whether the wizard is offered in the UI. The calculator branches solely on the existence of a locked snapshot for that company and class. Once any snapshot is locked, the flag is irrelevant to computation and the UI renders it disabled with an explanatory tooltip; turning it off hides the wizard entrance and changes no number. I will assert this in the golden-master suite: same fixture, flag on and flag off, no locked snapshot, byte-identical output.

## C-blocker 3 — recalculate_ownership_percentages() and corrected rows

**It does filter.** Every subquery in the function body carries `AND st.status != 'corrected'` — the total-units denominator, the direct-holdings term, the transfer-in term, and the transfer-out term. `share_transactions.status` is `text NOT NULL DEFAULT 'active'`, so there is no NULL-comparison hole. The amendment mechanism in C5 is safe: superseded rows marked `corrected` drop out of both the hook and the function. No pre-existing defect here.

## C-blocker 4 — Uniqueness, label ordering, and the status allowlist

**Uniqueness.** Accepted: `CREATE UNIQUE INDEX ... ON stock_certificates (company_id, certificate_label) WHERE certificate_label IS NOT NULL`.

**Label ordering.** Accepted, and it was a real bug in my answer. Pattern inference orders by the internal `certificate_number` integer, never by string sort.

**The allowlist grep — this is a blocker and `'historical'` does not ship as designed.** I grepped every shareholder-status filter. Most are inclusive allowlists and safe:

- `ShareholdersTab.tsx:685, 757, 789` — `s.status === "active" && !s.is_treasury`
- `ShareholdersTab.tsx:139`, `AnnualMeetingWizard.tsx:207`, `WrittenConsentWizard.tsx:365`, `MeetingsTab.tsx:396, 465` — `.eq("status", "active")` at the query level
- `BatchTransferDialog.tsx:156` — `s.status === "active"`
- `Reports.tsx:424`, `lib/pdf-export.ts:285` — `sh.status === "active"`

**One exclusive blacklist leaks:** `OperatingAgreementGenerator.tsx:540` — `members.filter((m) => m.status !== "inactive" && m.status !== "terminated")`. A `'historical'` holder passes that filter and lands on a multi-member LLC operating agreement's member schedule — a dissolved 2017 trust printed as a current member on a legal document. Per your rule, that site converts to an inclusive `=== "active"` allowlist first, as its own small change with the golden-master green, before `'historical'` exists anywhere. (Separately: nothing writes `'terminated'` today; the only values present in the data are `active` and `inactive`.)

**Status column type.** `shareholders.status` is `text`, nullable, `DEFAULT 'active'`. The only CHECK constraint on the table is `shareholders_owner_kind_check` on `owner_kind`. **There is no CHECK on status**, so adding `'historical'` modifies no existing constraint — but it also means nothing prevents typos today. I recommend adding a CHECK allowlist for status as part of this work; say the word and it goes in, otherwise I leave it alone.

## C-blocker 5 — NOT NULL is not deferrable

You are right; my wording described something Postgres does not support. **Mechanism: `share_transaction_id uuid` is a plain nullable FK column, validated inside the lock transaction.** The lock routine generates the ledger rows, back-fills the links, then asserts every lot in the snapshot has a non-null link before flipping status to `locked` — same transaction, so a failure rolls the whole lock back. A partial unique index enforces one lot per ledger row. No constraint trigger, no deferral.

**Column is named `entered_quantity` from creation.** No `quantity`, no rename.

## D — Unit basis only in Phase 1, and the enumeration

Accepted in full. Phase 1 ships `'units'` only; `companies.quantity_basis text NOT NULL DEFAULT 'units'` and the guard clause in `recalculate_ownership_percentages()` both land now as no-ops; the wizard shows Percentage as a visible disabled option.

**Enumeration: 29 files reference `num_shares`, `totalIssuedShares`, `shareholderHoldings`, or `getHoldingsByName`.**

Ledger and equity UI (10): `StockLedgerTab`, `UnifiedLedgerTab`, `TransferLedgerTab`, `StockCertificatesTab`, `ShareholdersTab`, `BuySellWorkflow`, `BatchTransferDialog`, `EditTransactionModal`, `CorrectionModal`, `EstablishOwnershipDialog`.

Document generators (5): `OperatingAgreementGenerator`, `SMOperatingAgreementGenerator`, `operating-agreement-pdf`, `record-book-pdf`, `BillsOfSaleTab`.

Meetings and consents (4): `AnnualMeetingWizard`, `WrittenConsentWizard`, `MeetingsTab`, `MeetingDetail`.

Core logic and hooks (4): `useShareCalculations`, `transaction-validation`, `lease-classification`, `useLeaseClassification`.

Other (6): `CreateCompanyWizard`, `TimelineTab`, `CompanyDetail`, `Reports`, `ImportAccess`, `lease-classification.test`.

My read: this is not a small Phase 2. Roughly 15 of the 29 render or format a unit count for a human — including five document generators producing legal instruments where a blank or zero unit count is worse than a wrong one. Percentage basis is a project of its own, and the honest scoping is a separate design pass over the document generators specifically.

## E1 — Legacy plaintext PII

Reporting only; nothing touched.

- **`shareholders_legacy_ssn_archive.ssn_ein_plaintext` (text) — 1 row.** This is the intended archive from the earlier SSN encryption migration. Live `shareholders` has no plaintext SSN column at all, and 0 of 96 shareholder rows currently hold an encrypted SSN either.
- **`companies.ein` (text) — 0 rows populated.** Retained as a read-fallback inside `decrypt_company_ein`; encryption writes NULL it out.
- **`company_banks.account_number` / `routing_number`, `master_firms.account_number` / `routing_number` (text) — 0 rows each.** Writes are actively blocked by the `block_plaintext_bank_numbers` trigger.
- **`filing_checklist.ein_number` (text) — 3 rows populated.** This one is not part of the encryption scheme at all: no trigger, no encrypted counterpart, no masking. It is a live plaintext EIN store. I flag it as the actual standing exposure in this report; the archive row is a known artifact by comparison.

The import path touches none of these.

## E2 — Diff as a findings report

Agreed. When I deliver the C3 diff, each difference is marked intentional or defect with a one-line reason, delivered as a findings report before any extraction.

## E3 — Treasury

**Zero.** No company in the database has a shareholder flagged `is_treasury` — 0 treasury holders, 0 with a non-zero position, 0 ledger rows attached to one. The denominator defect is currently free to fix and has never affected a real percentage.

Recommendation: fix it now as its own behavior-preserving-in-practice change — exclude `is_treasury` holders from `totalIssuedShares` and from the `recalculate_ownership_percentages()` denominator, aligning the calculator with what the roster, cap table, meeting attendance, and OA schedules already do. Every existing entity's percentages are unchanged because no entity has treasury units. The reconciliation panel then never needs the disagreement line item. This does require a golden-master fixture update for the treasury case, which is the one place the suite's output legitimately changes — I will call that out explicitly rather than fold it in.

## Revised delivery order

1. ~~C-blockers 1–5~~ — resolved above, pending your approval.
2. ~~D, E1, E3 reports~~ — delivered above.
3. Two small pre-work items surfaced by the blockers: the `OperatingAgreementGenerator:540` allowlist conversion, and the treasury denominator fix.
4. B5 golden-master suite.
5. C3 findings report, then the behavior-preserving extraction PR.
6. Phase 1, unit basis only.

Approve items 3–6, or tell me which of the two pre-work items you want held back.
