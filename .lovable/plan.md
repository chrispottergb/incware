# Snapshot Amendment / Supersede Path — Inspection Report

Read-only inspection. Nothing was changed.

## 1. Schema — present and sufficient

`ownership_snapshots`:

| Column | Type | Nullable |
| --- | --- | --- |
| `supersedes_id` | uuid | YES — FK to `ownership_snapshots(id)`, `ON DELETE SET NULL` |
| `status` | text, default `'draft'` | NO |
| `as_of_date` | date | NO |
| `locked_at` | timestamptz | YES |
| `locked_by` | uuid | YES |

`status` is a text column with a CHECK, not an enum:

```sql
CHECK (status = ANY (ARRAY['draft','locked','amended']))
```

`'amended'` is allowed. A second CHECK, `ownership_snapshots_locked_fields`, requires `locked_at` and `declared_total` to be non-null when status is `'locked'`; it does not constrain `'amended'` rows, so a snapshot can be demoted from locked to amended without violating it. The existing DB trigger `block_locked_snapshot_changes` explicitly permits the locked → amended transition and rejects everything else.

Uniqueness limiting locked snapshots:

```sql
CREATE UNIQUE INDEX ownership_snapshots_one_locked_per_class
  ON public.ownership_snapshots (company_id, share_class_key)
  WHERE (status = 'locked');
```

Because of the `WHERE status = 'locked'` clause, this permits any number of `draft` and `amended` snapshots alongside one locked snapshot on the same company and class. It only blocks two simultaneously *locked* ones — so an amendment must demote the old snapshot to `'amended'` before (or in the same transaction as) locking the new one.

`ownership_snapshot_lots.share_transaction_id` is uuid, nullable, FK to `share_transactions(id)` `ON DELETE SET NULL`. Its unique index is **global, not per-snapshot**:

```sql
CREATE UNIQUE INDEX ownership_snapshot_lots_one_per_ledger_row
  ON public.ownership_snapshot_lots (share_transaction_id)
  WHERE (share_transaction_id IS NOT NULL);
```

This is fine for the amendment case as specified: the superseded lot keeps pointing at its own (now `corrected`) ledger row, and each new lot points at a distinct new ledger row. One lot per ledger row still holds. It would only break if the amendment tried to reuse the same ledger rows across two snapshots, which it must not do.

## 2. Backend logic — absent

No code path anywhere in `src/` writes `supersedes_id`, sets a snapshot's status to `'amended'`, or sets superseded `opening_balance` rows to `status = 'corrected'`. A full-tree search for `supersedes_id` and `amended` returns only the type union in `src/lib/ownership-snapshot.ts:23` (`SnapshotStatus = "draft" | "locked" | "amended"`).

`useOwnershipSnapshot.lock()` in `src/hooks/useOwnershipSnapshot.ts` reuses `draftSnapshot?.id` if one exists, otherwise inserts a new snapshot. It never inspects `lockedSnapshot`. If invoked while a locked snapshot exists it would attempt a second locked row and be rejected by `ownership_snapshots_one_locked_per_class` at the DB level — an opaque unique-violation, not a guarded error.

The blocking validation is in `src/lib/ownership-snapshot.ts`, `analyzePreExistingLedger()`. Any ledger row effective on or before the as-of date sets `blocked: true`. Its own comment states the reason:

> "Ledger activity effective ON OR BEFORE the as-of date => **blocked**. Writing the snapshot on top of it would double-count the position, and Phase 1 has no supersede/void path (deferred to Phase 2)."

Since a locked snapshot always leaves `opening_balance` rows on or before its as-of date, this check alone blocks every amendment attempt unless the prior rows are first marked `corrected` (which the function already ignores).

Separately: the app has no stock-split event type. The split itself would have to be represented either as the amendment's new lot quantities, or as issuance rows — no split-specific handling exists.

## 3. Calculator behavior — safe, but not for the reason assumed

`useShareCalculations` does **not** branch on the existence of a locked snapshot. It reads `share_transactions` directly and skips rows with `status === 'corrected'` (two places: lines 100 and 195). It never queries `ownership_snapshots`. So with one amended and one locked snapshot it reads neither — it reads the ledger, and superseded rows drop out purely via the `corrected` filter. No double-counting, and no most-recent/first-found ambiguity to worry about, because no snapshot selection happens at all.

`recalculate_ownership_percentages()` behaves the same way: every branch filters `st.status != 'corrected'`, and it too never references the snapshot tables.

The one place that does select a snapshot is `useOwnershipSnapshot`, which uses `snapshots.find((s) => s.status === "locked")` — an explicit status match, not most-recent. With one amended and one locked snapshot it correctly returns the locked one. Its lots query is keyed to that locked snapshot's id.

Consequence: correctness of the amendment depends entirely on the `corrected` flag being written to the superseded `opening_balance` rows. That is the single load-bearing step.

## 4. UI — not reachable

`SnapshotWorkflowCard` renders whenever `companies.ownership_snapshot_enabled` is true, regardless of snapshot state, so the card stays visible. But `OwnershipSnapshotWizard` switches to `<LockedView>` when `lockedSnapshot` is truthy (line 247) and hides the entire footer including the action button (line 518). Once locked, the wizard is a read-only receipt. There is no amend button, menu item, or route anywhere.

## 5. Verdict — (c) Schema present, logic missing

Schema is complete and needs no migration. Both the amendment logic and its UI entry point are missing.

### Logic needed

1. An `amend()` mutation alongside `lock()`: mark the prior snapshot's generated `opening_balance` rows `status = 'corrected'` (found via `ownership_snapshot_lots.share_transaction_id` for the prior snapshot), zero/recompute affected holder totals, flip the prior snapshot to `'amended'`, then run the existing lock sequence for the new snapshot with `supersedes_id` set to the prior one, and re-run `recalculate_ownership_percentages`. Order matters: correct the old rows first so the new snapshot's own pre-existing-ledger check passes.
2. An amendment-aware variant of the pre-existing-ledger guard so prior rows already being superseded do not block, while genuinely unrelated activity still does.
3. Prior certificates from the superseded snapshot marked cancelled as of the amendment date, so the certificate register matches the ledger.

### Smallest additive change

Files touched:

- `src/lib/ownership-snapshot.ts` — add an `amendment` mode to `analyzePreExistingLedger` (new optional argument; default behavior byte-identical).
- `src/hooks/useOwnershipSnapshot.ts` — add `amend` mutation; extract the shared write sequence from `lock`.
- `src/components/company/ownership-snapshot/OwnershipSnapshotWizard.tsx` — an "Amend snapshot" action in `LockedView` that re-enters the wizard in amendment mode, prefilled from the locked lots, with a new as-of date and a required reason.
- `src/components/company/ownership-snapshot/SnapshotWorkflowCard.tsx` — card copy reflecting amended state.
- `src/test/ownership-snapshot-acceptance.test.ts` — coverage for supersede: prior rows corrected, no double-count, amended chain readable.

No destructive migration is required — every column, constraint, and index the path needs already exists. No change to ownership calculation for companies without a superseding snapshot: the calculators are untouched, and the only new writes are `corrected` flags on rows belonging to a snapshot that is being explicitly superseded.

### Open question before building

A stock split has no event type. Two options for representing it: (A) the amendment carries the post-split lot quantities and the split is documented in the snapshot's reason/notes — no new event type, smallest change; (B) add a `stock_split` transaction type and generate ratio-derived ledger rows — larger, touches the transaction-type taxonomy and every ledger view. Recommend (A) for this client scenario unless split events need to be reportable in their own right.
