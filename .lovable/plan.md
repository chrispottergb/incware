## Problem
On the Meeting → Financial tab, the Cost of Goods (and other) inputs can lose leading/trailing digits while typing. Root cause: `MeetingFinancials.tsx` re-hydrates the entire form from the database on **every** React Query refetch, including the refetch that auto-save itself triggers. If the user is still typing when the save round-trips, the freshly typed digits are overwritten with the just-persisted (partial) value.

## Fix

Change the sync-from-server logic so it only runs on the **initial load** of a meeting's financials, not on every refetch.

### File: `src/components/meeting/MeetingFinancials.tsx`

1. Replace the render-phase `if (financials !== lastFinancials) { ... setForm(...) }` block with a `useEffect` keyed on `financials?.id` (mirroring the pattern already used for `nonRecurringItems` via `nrInitialized`):
   - Track `financialsLoadedId` in state.
   - When `financials?.id` is present and differs from `financialsLoadedId`, populate `form` from the DB row and store the id.
   - This guarantees a one-time hydrate per meeting/row, so post-save refetches no longer clobber the field being typed.

2. Leave `lastFinancials` removed (no longer needed), keeping the rest of the file unchanged.

3. No changes to auto-save cadence, sanitize logic, save mutation payload, or PDF export — the persisted value will now match what the user actually typed.

## Verification

- Open a meeting → Financial tab.
- Type `133000` into Cost of Goods slowly enough that auto-save (2s) fires mid-typing.
- Confirm the field retains `133,000` and that the saved row in `meeting_financials.current_cog` is `133000`.
- Export Financials PDF and confirm `Cost of Goods` line shows `$133,000.00`.
- Re-test by editing an existing value (e.g. changing `33,101` → `133,101`) to make sure mid-edit refetches no longer revert it.
