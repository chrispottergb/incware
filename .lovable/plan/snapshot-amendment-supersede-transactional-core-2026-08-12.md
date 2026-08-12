# Snapshot Amendment / Supersede — Transactional Core

Delivering the transactional core first, as required. The RPC signature and the assertion list are below; the UI is the last step and is trivial once this is correct.

## Verified current state

- `ownership_snapshots` already has `supersedes_id`, `source_document_id`, `notes`, and a `status` check allowing `draft | locked | amended`. No migration is needed for columns.
- `ownership_snapshots_one_locked_per_class` is a partial unique index filtered `WHERE status = 'locked'` — an amendment chain is legal.
- Trigger `block_locked_snapshot_changes` permits exactly one transition out of `locked`: `locked -> amended`. The RPC works with that, not around it.
- `ownership_snapshot_lots.share_transaction_id` is uniquely indexed where not null — new amendment lots must point at new ledger rows.
- The company driving this has certificates in the system generally (100 rows across all companies), so the cancellation step must be conditional per entity, as specified.

## The single RPC

One `SECURITY DEFINER` Postgres function. Everything commits or rolls back as a unit; the React hook makes exactly one call.

```sql
public.amend_ownership_snapshot(
  p_company_id          uuid,
  p_prior_snapshot_id   uuid,
  p_as_of_date          date,
  p_share_class_label   text,
  p_quantity_basis      text,     -- 'units' | 'shares'
  p_entry_tier          text,     -- 'position_lots'
  p_declared_total      numeric(18,4),
  p_amendment_reason    text,     -- REQUIRED, non-empty; stored in notes
  p_source_document_id  uuid,     -- REQUIRED, must exist in document_registry for this company
  p_is_llc              boolean,
  p_par_value           numeric,
  p_lots                jsonb     -- [{ shareholder_id?, new_holder_name?, quantity,
                                  --    certificate_label?, certificate_date?, acquired_date?,
                                  --    acquisition_type, status, needs_review, review_reason?, notes? }]
) RETURNS jsonb  -- { snapshot_id, prior_snapshot_id, corrected_rows, new_ledger_rows, computed_total }
```

Ownership is verified inside the function (`companies.user_id = auth.uid()`), so `SECURITY DEFINER` grants no extra reach.

### Order of work inside the transaction

1. Authorize; lock the prior snapshot row `FOR UPDATE`.
2. Validate inputs: reason non-empty, `source_document_id` resolves to this company, prior snapshot is `locked` and belongs to this company/class, `p_as_of_date >= prior.as_of_date`.
3. Mark every `share_transactions` row referenced by the prior snapshot's lots `status = 'corrected'`.
4. Conditionally cancel prior certificates — **skipped entirely when the entity has no `stock_certificates` rows** (uncertificated clients generate nothing).
5. Insert the new snapshot as `draft` with `supersedes_id = p_prior_snapshot_id`.
6. Upsert holders (create only for `new_holder_name` entries), insert certificates only if the entity is certificated, insert new `opening_balance` ledger rows, insert new lots linked to those rows, insert retired records for surrendered lots.
7. Recompute `shareholders.num_shares`; set `companies.opening_balance_date = p_as_of_date`; call `recalculate_ownership_percentages`.
8. Run every assertion below.
9. Flip prior snapshot to `amended`, new snapshot to `locked`.

## Assertion list (all run before commit; any failure raises and rolls back)

1. **Three-way total match** — `sum(new lots where status='outstanding') = sum(new opening_balance ledger rows) = sum(shareholders.num_shares for non-treasury holders of this class)`, each within ±0.00005.
2. **Declared-total reconciliation** — computed outstanding total equals `p_declared_total` within ±0.00005.
3. **Per-holder match** — for each holder, lot sum equals ledger-row sum equals `shareholders.num_shares`.
4. **Prior rows fully corrected** — every `share_transactions` row referenced by the prior snapshot's lots has `status = 'corrected'`; zero remain `active`.
5. **No stale opening balances** — no `entry_type = 'opening_balance'` row for this company/class outside the new snapshot is still `active`.
6. **Exactly one locked snapshot** — `count(*) where company_id, share_class_key, status='locked'` equals 1 on exit, and it is the new snapshot.
7. **Chain integrity** — new snapshot's `supersedes_id` = prior id; prior status is `amended`; no cycle.
8. **Lot/ledger pairing** — every outstanding lot has a non-null `share_transaction_id` pointing at a row created in this call; no lot reuses an existing ledger row.
9. **Reason and source document present** — `notes` non-empty, `source_document_id` non-null and resolvable.
10. **Authorized cap** — if the company declares authorized units/shares, the new outstanding total does not exceed it.
11. **Certificate step consistency** — if the entity is uncertificated, zero certificate rows were created or cancelled by this call.

## Application-side changes

- **`src/hooks/useOwnershipSnapshot.ts`** — add `amend` mutation: one `supabase.rpc('amend_ownership_snapshot', ...)` call, then the existing cache invalidation set. Also fix the reachable failure in `lock()`: if `lockedSnapshot` exists, throw an explicit error pointing at the amend path instead of surfacing an opaque unique-violation.
- **`src/lib/ownership-snapshot.ts`** — `analyzePreExistingLedger` gains an amendment mode: when amending, ledger rows belonging to the snapshot being superseded are expected and do not block; unrelated non-corrected activity still blocks with the existing message.
- **`src/components/company/ownership-snapshot/OwnershipSnapshotWizard.tsx`** — `LockedView` gets an "Amend snapshot" entry point; the amendment form requires a reason and a linked source document before submit is enabled. The locked snapshot view renders the reason and the linked document adjacent to the quantity change, so the ledger discontinuity explains itself.
- Code comment at the amendment quantity handling: option (A), post-split quantities carried in the amendment, is a **stand-in for a real `stock_split` transaction type queued as its own Phase 2 item**.

## Tests

`src/test/ownership-snapshot-amendment.test.ts` plus additions to the existing acceptance suite:

- Supersede happy path — totals, chain, single locked snapshot.
- Rollback — force a failure after the correction step; assert holdings, snapshot count, and corrected-row count are byte-identical to the pre-amendment state.
- Chained amendments — amend twice; `supersedes_id` chain readable end to end, exactly one locked snapshot, holdings reflect only the newest.
- Post-amendment transactions — ordinary transfers compute against the new baseline; a transaction dated before the new `as_of_date` is rejected with the existing message.
- Guard test — `lock()` with a locked snapshot present raises the explicit amend-path error.
- Golden master unchanged for companies with no snapshot and companies with one unamended locked snapshot.

## Delivery order

1. Migration: the RPC function only (no schema changes).
2. Hook `amend` + `lock()` guard + `analyzePreExistingLedger` amendment mode.
3. Tests, run green.
4. `LockedView` amend UI last.
