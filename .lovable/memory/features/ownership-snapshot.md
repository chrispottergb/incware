---
name: Opening Ownership Snapshot
description: Phase 1 snapshot wizard for onboarding existing entities — tables, lock semantics, reconciliation rules, feature flag
type: feature
---
# Opening Ownership Snapshot (Phase 1 — unit/share basis only)

`share_transactions` rows with `entry_type = 'opening_balance'` remain the ONLY source of truth for
ownership. A snapshot is the audited *entry event* that produced those rows — never a second source.

## Tables
- `ownership_snapshots` — header: as_of_date, quantity_basis (units/shares; percentage & capital_account
  schema-ready but blocked by a Phase-1 CHECK), entry_tier, declared_total, status (draft/locked/amended),
  supersedes_id, suggested_next_certificate_number.
- `ownership_snapshot_lots` — one row per certificate as typed, linked to its generated ledger row via
  `share_transaction_id`. `entered_quantity` is numeric(18,4), matching `share_transactions.num_shares`.
- `retired_ownership_records` — surrendered certificates, display-only, excluded from all math.
- `companies.ownership_snapshot_enabled` — per-entity feature flag, default false. The default
  onboarding path (Establish Current Ownership -> legacy EstablishOwnershipDialog) is never changed.
  The wizard is reached only from `SnapshotWorkflowCard` on the Ownership tab, which renders solely
  when the flag is true. There is no in-app opt-in switch; the flag is flipped by migration.

## Rules
- Locked snapshots are immutable — enforced by DB trigger `block_locked_snapshot_changes`; only
  locked → amended is permitted. Lots of a locked snapshot cannot be edited or deleted.
- One locked snapshot per (company, share_class_key) via partial unique index.
- Lock order: holders → certificates → ledger rows → lots → retired records → flip to locked.
- Reconciliation: entered outstanding total must equal the client's declared total within ±0.00005.
  Surrendered lots never count. Exceeding authorized units blocks the lock.
- Missing certificate numbers/dates never block: the lot is flagged `needs_review` with a reason.
- Certificate numbers stay integer-authoritative; alphanumeric legacy labels are kept in
  `certificate_label` and only converted when unambiguous.

Pure logic lives in `src/lib/ownership-snapshot.ts` (tested in `src/test/ownership-snapshot.test.ts`).
