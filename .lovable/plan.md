# Authorized Units for LLCs — with verification guards folded in

## Step 0 — Column reuse (decided)

Reuse `companies.authorized_shares` (nullable integer, no stock-only constraints). Already the storage for LLC membership units and partnership units. Only the display label swaps via `getTerminology()` / `isLLCType()`. No new value column.

One schema add: nullable boolean `authorized_units_backfill_dismissed` on `companies` for Step 3 banner dismissal.

## Step 1 — Editable "Authorized Units" input for LLCs (with diff-based dismissal)

`src/components/company/IncorporationTab.tsx` equity card:
- Add an LLC branch gated on `equityCard.showMembershipUnits` rendering an input identical to the corp "Authorized Shares" one, labeled **"Authorized Units"**, bound to `form.authorized_shares`.

**Diff-based auto-dismiss (folded from addendum):**
- In the save handler for this form, capture the previous `authorized_shares` value from the loaded `company` prop (source of truth for "prior state"), and compare against the submitted value.
- Only when `submitted.authorized_shares !== prior.authorized_shares` (real value change, including null→number) also write `authorized_units_backfill_dismissed = true` in the same update.
- Saving any other field on the tab (registered agent, address, seal, S-election, etc.) must leave `authorized_units_backfill_dismissed` untouched — the flag write is inside the diff branch, not the general save path.
- No onChange-time flip; dismissal only occurs on persisted save with an actual value change.

## Step 2 — Shared cap table status bar

New `src/components/company/CapTableStatusBar.tsx` — takes `{ term, authorized, issued }`, renders Authorized / Issued / Available to Issue.

`src/pages/CompanyDetail.tsx` (lines 326–353): replace both inline blocks with this component.
- Corp: unchanged wording.
- LLC: same three-cell bar, using `term.shareUnit` ("Units"). Renders only when `authorized_shares != null`. The existing "Total Units Outstanding / Active Members" bar stays as-is beneath it.

## Step 3 — Backfill migration + dismissible banner

Migration (single migration):
- `ALTER TABLE companies ADD COLUMN authorized_units_backfill_dismissed boolean NOT NULL DEFAULT false;`
- For every LLC / SMLLC / LLC-S row where `authorized_shares IS NULL`, set `authorized_shares` = summed active issued units from `share_transactions` (same arithmetic as `recalculate_ownership_percentages()`). If issued total = 0, leave `authorized_shares` NULL and skip the banner.

Banner (rendered in `CompanyDetail.tsx` near the new status bar):
- Shows when `isLLCType(entity_type) && authorized_shares != null && !authorized_units_backfill_dismissed`.
- Copy: *"Authorized units were set to match currently issued units. Update this in Organizational Info if you'd like room to issue more in the future."*
- Manual "Dismiss" button writes `authorized_units_backfill_dismissed = true`.
- Auto-dismissal path from Step 1 fires only on a real `authorized_shares` value change.

## Step 4 — Ceiling enforcement (verify + copy)

Already generic via `validateIssuanceLimit(numShares, available, term)` in `StockLedgerTab.tsx`.
- Verify the same guard runs in the Establish Current Ownership submit path; add it there if missing.
- Update `src/lib/transaction-validation.ts` error message to use `term.shareUnit` and reference "Organizational Info": *"This would exceed the {authorized} {units} authorized for this entity. Increase authorized units in Organizational Info first, or reduce the amount being issued."*
- No parallel validator, no changes to `useShareCalculations`.

## Step 5 — Operating agreement PDF generators (with zero-issued guard)

`src/lib/smllc-operating-agreement-pdf.ts` and `src/lib/smllc-scorp-operating-agreement-pdf.ts`:

Dynamic clause when `issued_units > 0`:
- `authorized_units` ← `company.authorized_shares` (fallback to `issued_units` if null — Step 5 fallback, unchanged).
- `issued_units` ← summed active issued units.
- `ownership_percentage` ← the sole member's stored `ownership_percentage`.
- Clause: *"The Company is authorized to issue {authorized_units} membership units, all of which constitute a single class of membership interest within the meaning of IRC §1361(b)(1)(D). The Member is hereby issued {issued_units} membership units and owns {ownership_percentage}% of the Company."*

**Zero-issued guard (folded from addendum):**
- **Primary (calling component)** — locate the SM operating agreement generator UI (SMOperatingAgreementGenerator or the equivalent action bar that invokes these PDFs) and disable the Generate Standard / AI-Assisted Draft buttons when `issued_units === 0`, using the same disabled+tooltip pattern already used for export buttons elsewhere in the generator UI. Tooltip: *"Record an initial contribution before generating an operating agreement."*
- **Secondary (inside both PDF files)** — if the generator function is invoked with `issued_units === 0` anyway (programmatic caller, guard bypass), do not interpolate zeros. Substitute placeholder language: *"No membership units have been issued as of the date of this Agreement."* Never emit "issued 0 membership units and owns 0% of the Company."
- This guard is independent of the `authorized_shares` null fallback — the fallback only applies when `issued_units > 0`.

Multi-member OA generators (if a separate file exists): out of scope for the SMLLC files; they stay single-member.

## Files touched

- `supabase/migrations/*` — add column + LLC backfill.
- `src/components/company/IncorporationTab.tsx` — LLC "Authorized Units" input; diff-based flag write in save handler.
- `src/components/company/CapTableStatusBar.tsx` — new shared component.
- `src/pages/CompanyDetail.tsx` — swap inline bars for shared component; render backfill banner + manual dismiss.
- `src/lib/transaction-validation.ts` — error copy via `term.shareUnit` + Organizational Info wording.
- `src/components/company/StockLedgerTab.tsx` — verify (and add if missing) `validateIssuanceLimit` in Establish Current Ownership path.
- `src/lib/smllc-operating-agreement-pdf.ts`, `src/lib/smllc-scorp-operating-agreement-pdf.ts` — dynamic clause + zero-issued defensive substitution.
- Calling generator component — disable Generate actions when `issued_units === 0` with tooltip.

## Verification after build

- Zero-issued SMLLC: Generate buttons disabled with tooltip; direct PDF call substitutes placeholder text; no "0 units / 0%" ever printed.
- Backfilled LLC with visible banner: edit registered-agent (or any other field) on Organizational Info tab and save → banner remains visible, `authorized_units_backfill_dismissed` stays false. Then edit Authorized Units to a new value and save → banner disappears, flag flips to true.
- `tsgo` typecheck clean; ceiling error message reads naturally under both LLC and corp terminology.

## Out of scope

- Corp Authorized/Issued/Available behavior.
- Multi-member OA generator changes beyond the two SMLLC files noted.
- Any automatic bump of `authorized_shares` when issuance is attempted.
