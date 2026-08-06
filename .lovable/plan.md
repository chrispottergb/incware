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

## Data audit already run — results

The unmatched-name check across all existing companies is done. Every `from_shareholder` / `to_shareholder` value was compared (case- and whitespace-insensitive) against the owner names on the same company.

- **Most unmatched values are harmless sentinels, not owners**: `Pre-existing Ownership`, `Original Issue`, `Company`. These sit on issuance-type rows (`opening_balance`, `initial_issuance`, `membership_issuance`) where the field records a source, not a person, and issuance rows credit the owner through `shareholder_id` rather than the name string. No holdings are affected.
- **Restricting the check to transfer-type rows — the only rows where name matching actually drives holdings — surfaces exactly one real problem**: **Incorporation Resources Company**, where two transfer rows are recorded against `Christoher R. Potter` (misspelling of Christopher). One transfer out of 2 units and one transfer in of 50 units are currently resolving to no owner, so that owner's holdings and the entity's ownership percentages are wrong today.
- No other client entity has an orphaned transfer name.

So the exposure is real but narrow. The fix for it falls out of this feature: once the alias layer exists, the misspelling is recorded as a prior-name/alias entry (reason: correction) and both rows resolve again — no transaction editing required, and the ledger keeps showing what was originally recorded. A one-time re-check will run after implementation to confirm zero unresolved transfer names remain.

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
- **Certificates when reissue is declined.** Existing certificates are never rewritten automatically. A certificate is a legal instrument that was issued in a particular name, so its stored and printed name stays the pre-rename name indefinitely — it does not resolve through the alias layer the way the ledger does. What changes is the surrounding context: certificate lists and certificate-based reports show the certificate's issued name with the owner's current name annotated next to it ("issued to Ken & Louise Revocable Trust — now Louise Revocable Trust"), and the certificate stays attached to the same owner record so holdings and totals are unaffected. The generated certificate PDF itself is untouched. The dialog offers the optional reissue — cancel the old certificate and issue a replacement in the new name, same unit count, no transfer — for clients who want the paper to match.

### 4. The rename vs. successor-holder fork

This is a general owner-identity feature, not a trust feature. Marriage and divorce name changes for individual owners are expected to be the most common use, with trust restatements and successor trustees behind them.

The dialog is written in neutral language that fits an individual, a trust, or a business entity. The fork question reads: **"Is this the same owner under a new name, or a different legal owner taking over the interest?"**

- **Same owner, new legal name** — pre-selected as the default. Examples shown adapt to the owner: for an individual owner (`owner_kind = individual`) the guidance cites marriage, divorce, or a court-ordered name change; for an entity owner it cites trust restatement or a renamed company. Reason options are likewise filtered so an individual is never shown "trust restatement" and an entity is never shown "marriage." Proceeds with the rename path above.
- **Different legal owner** — for the minority case: a revocable trust becoming irrevocable and treated as a new taxpayer, a split into survivor's/bypass sub-trusts, or an interest passing to an estate or heir. Routes to the existing transfer flow, pre-set to a non-sale transfer type, pre-filled with the outgoing owner and full unit count, and links the new owner record to the predecessor so the chain of title stays navigable.

Both branches carry the same note: the app records the determination, it does not make it — whether an event is a rename or a change of holder is the client's attorney's or accountant's call.

### 5. Light holder context (optional fields, no legal logic)

On owners with `owner_kind = entity`, add optional fields: holder subtype (trust / estate / LLC / corporation / partnership / other), and for trusts a revocable-vs-irrevocable marker and trustee name. Individual owners see none of this. These are descriptive only — nothing in the app infers a legal conclusion from them. They populate certificates and the record book, and give the fork dialog its examples.


## Technical notes

- Migration: `shareholder_name_history` (create, grants, RLS, policies scoped via `companies.user_id`), optional additive columns on `shareholders` (`holder_subtype`, `trust_revocability`, `trustee_name`, `predecessor_shareholder_id`). All nullable — existing rows unaffected.
- `recalculate_ownership_percentages()` is updated to join name history when matching `from_shareholder` / `to_shareholder`.
- Client: alias-aware matching in `src/hooks/useShareCalculations.ts` (both the hook and `getHoldingsByName`); new `NameChangeDialog` in `src/components/company/`; wiring in `ShareholdersTab.tsx`; history display in the owner card and the record-book / annual-review generators.
- Terminology continues to flow through `src/lib/entity-terminology.ts`, so LLCs read "Member" / "Units" and corporations read "Shareholder" / "Shares" with no separate strings.

## Verification

1. Rename an owner who has both a direct issuance and a name-matched transfer recorded under the old name; confirm holdings and ownership percentage are unchanged before and after, in the UI and via the database function.
2. Confirm the ledger still shows the old name on the pre-rename rows and the new name on post-rename rows.
3. Confirm certificates stay attached, keep their issued name, show the current-name annotation, and that the optional reissue produces a replacement certificate with no change in units.
4. Run the rename flow on an **individual** owner (marriage name change) and confirm the dialog language, reason options, and result are correct with no trust/entity wording.
5. Run the successor-holder path and confirm it creates a second owner record linked to the predecessor with a full, non-sale transfer.
6. Confirm a multi-member entity's percentages still total 100% after a rename.
7. Re-run the unmatched-name audit query after fixing the `Christoher R. Potter` alias and confirm zero unresolved transfer-type names remain across all companies.

