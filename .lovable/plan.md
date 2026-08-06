# Owner Name Changes vs. Successor Holders

## Answers to your two questions

**1. Does the owner record support an effective-dated name change today? No.**

Checked the schema and the ownership code:

- `shareholders` has a single mutable `name` column and no history table anywhere in the database. Editing the name in the Members/Shareholders tab silently overwrites it, with no record that the prior name ever existed and no effective date.
- Worse, ownership math is partly **name-string based**. `share_transactions` stores transfers as free text in `from_shareholder` / `to_shareholder`, and both the client calculation (`useShareCalculations`) and the database function `recalculate_ownership_percentages()` match those strings against `shareholders.name` (lowercased/trimmed). So renaming "Ken & Louise Revocable Trust" to "Louise Revocable Trust" today would **orphan every historical transfer** recorded under the old name — those units stop counting toward the owner, and ownership percentages shift.
- The only alternative available today is exactly the thing you want to avoid: create a new owner record and record a transfer, which fabricates a disposition that never happened and splits the holding history across two records.

So a proper rename path needs to be built, and it must carry an alias/history layer so historical name-matched transactions keep resolving to the same owner record.

**2. Does the app distinguish a legal name change from a change in the legal holder? No — and it should, but only as a routing decision, not as legal judgment.**

There is no concept of trust type (revocable/irrevocable), grantor, successor trustee, or sub-trust anywhere in the model. `owner_kind` is only `individual` vs. `entity`, with an optional representative name/title — that representative field is the closest thing to a trustee, and it is free text.

The recommendation is to keep the legal determination out of the app: the attorney/accountant decides whether the event is a rename or a new holder. What the app should add is an explicit fork at the point of the event, so the user's choice is recorded and routed correctly, and a small amount of trust-specific context so the record book explains what happened.

## What to build

### 1. Owner name history (the rename path)

New `shareholder_name_history` table: owner id, previous name, new name, effective date, reason (grantor death / trust restatement / marriage / entity renaming / correction / other), optional note, created_by, timestamps. Standard RLS scoped through `companies.user_id`, plus grants.

A **"Record name change"** action on each owner in the Members/Shareholders tab opens a dialog with: new legal name, effective date, reason, note, and optional updated trustee/representative name. Saving updates `shareholders.name`, writes the history row, and logs a timeline event. The owner record's id never changes, so certificates, transactions, capital account, and ownership percentage all stay attached.

Plain typo fixes stay possible via the existing edit form, but changing the name there will prompt: "Is this a legal name change (record it with an effective date) or a correction?"

### 2. Make historical name matching alias-aware

This is the part that keeps the rename from breaking reporting:

- Ownership calculations resolve `from_shareholder` / `to_shareholder` against the owner's **current name plus every prior name** in the history table, so transfers recorded under "Ken & Louise Revocable Trust" continue to credit the same owner.
- The same alias resolution is added to `recalculate_ownership_percentages()` so server-side percentages agree with the UI.

### 3. Display and reporting

- Owner detail shows a "Formerly known as" line listing prior names with effective dates.
- The stock/membership ledger and transfer ledger display the name **as recorded at the time of the transaction**, with the current name shown alongside where useful — historical documents stay accurate while the owner stays traceable.
- Record book and annual review snapshots include a name-history block for any owner that has one.
- Existing certificates are not reissued automatically. The dialog offers an optional follow-up: cancel the old certificate and issue a replacement in the new name (a reissue, not a transfer — no change in units).

### 4. The rename vs. successor-holder fork

When a user starts the name-change action, the dialog first asks which situation applies, with plain-language guidance and an explicit note that the determination belongs to the client's attorney or accountant:

- **Same legal holder, new name** — trust restatement, entity renamed, marriage. Proceeds with the rename path above.
- **Different legal holder** — revocable trust became irrevocable at death and is treated as a new taxpayer, or the trust split into survivor's/bypass sub-trusts. Routes to the existing transfer/transaction flow, pre-set to a non-sale transfer type, pre-filled with the outgoing owner and full unit count, and links the new owner record to the predecessor so the chain of title is still one continuous, navigable history even though there are two records.

### 5. Light trust context (optional fields, no legal logic)

On owners with `owner_kind = entity`, add optional fields: holder subtype (trust / estate / LLC / corporation / partnership / other), and for trusts a revocable-vs-irrevocable marker and trustee name. These are descriptive only — nothing in the app infers a legal conclusion from them. They populate certificates and the record book, and give the fork dialog something to reference.

## Technical notes

- Migration: `shareholder_name_history` (create, grants, RLS, policies scoped via `companies.user_id`), optional additive columns on `shareholders` (`holder_subtype`, `trust_revocability`, `trustee_name`, `predecessor_shareholder_id`). All nullable — existing rows unaffected.
- `recalculate_ownership_percentages()` is updated to join name history when matching `from_shareholder` / `to_shareholder`.
- Client: alias-aware matching in `src/hooks/useShareCalculations.ts` (both the hook and `getHoldingsByName`); new `NameChangeDialog` in `src/components/company/`; wiring in `ShareholdersTab.tsx`; history display in the owner card and the record-book / annual-review generators.
- Terminology continues to flow through `src/lib/entity-terminology.ts`, so LLCs read "Member" / "Units" and corporations read "Shareholder" / "Shares" with no separate strings.

## Verification

1. Rename an owner who has both a direct issuance and a name-matched transfer recorded under the old name; confirm holdings and ownership percentage are unchanged before and after, in the UI and via the database function.
2. Confirm the ledger still shows the old name on the pre-rename rows and the new name on post-rename rows.
3. Confirm certificates stay attached and the optional reissue produces a replacement certificate with no change in units.
4. Run the successor-holder path and confirm it creates a second owner record linked to the predecessor with a full, non-sale transfer.
5. Confirm a multi-member entity's percentages still total 100% after a rename.
