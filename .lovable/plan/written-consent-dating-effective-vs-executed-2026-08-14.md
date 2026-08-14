# Written Consent Dating — Effective vs. Executed

Separate *when the action took effect* from *when each person actually signed*. Purely additive: `meetings.meeting_date` keeps its current meaning (effective date), and any consent that exists today prints exactly the same document as before.

## What changes for the user

**Wizard**
- The date field is relabeled "Effective date — the date the decision was actually made", with helper text explaining that signature dates are entered separately.
- The Signers step gains an optional "Date signed" input per signer (placeholder "leave blank until signed"), starting empty. A small "All signed on the same day →" link reveals one date input that fills every blank signer date. Nothing is ever auto-filled from the effective date.
- Non-profits can now complete a written consent. Today the signer list returns empty for `Non-Profit`, which blocks the Signers step. Non-profits are treated as board consents (signers from directors, role label Director), matching what the PDF layer already assumes.
- Signer resolution is verified for Corporation, S-Corp, LLC, LLC-S, Single Member LLC, Non-Profit, and Partnership using the existing `isLLCType()` / entity-terminology helpers — no second set of entity-type string checks.

**Printed consent**
- Only changes when the consent has signature rows. Consents without them render byte-identical to today, including the current `DATED:` line.
- With signature rows: a two-cell header (EFFECTIVE DATE / EXECUTED, the EXECUTED cell omitted while unsigned), an opening paragraph carrying "effective as of {date} (the 'Effective Date')", and an execution clause replacing `DATED:`:
  "IN WITNESS WHEREOF, the undersigned have executed this Consent on the respective dates set forth below, effective as of the Effective Date first written above. This Consent may be executed in counterparts, each of which shall be deemed an original."
- Each signature block gains a "Date signed: ____" line, printed when set and left blank when not. Existing "represented by" treatment for entity holders is preserved.

**Consent detail page**
- Header shows both Effective and Executed, with Executed reading "awaiting signatures" when unset.
- A compact signature list lets a user record dates inline as signatures come back, without reopening the wizard.

## Technical notes

**Migration (additive only)**
- `ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS executed_date date NULL;` — derived, never user-entered, never backfilled.
- New `public.meeting_signatures`: `meeting_id` (FK → meetings, ON DELETE CASCADE), `signer_name`, `signer_role`, `signer_title`, `representative_name`, `representative_title`, `signed_on date NULL` (no default), `sort_order`, timestamps; index on `meeting_id`. RLS policies and GRANTs mirror `public.meeting_resolutions` exactly; same `update_updated_at_column` trigger as sibling tables.
- Trigger on `meeting_signatures` (INSERT/UPDATE/DELETE) recomputes the parent: `executed_date = MAX(signed_on)` when every row for the meeting has a non-null `signed_on`, otherwise `NULL`.

**`src/components/WrittenConsentWizard.tsx`**
- Keep the existing `meeting_date` binding untouched; label/helper text only.
- Keep writing `meeting_directors` / `meeting_shareholders` exactly as today. Additionally write one `meeting_signatures` row per signer with role derived from the existing `consentBody` logic. On edit, upsert by `(meeting_id, sort_order)` instead of delete-and-recreate so entered dates survive.
- Extend the signers memo (~line 432) so `Non-Profit` resolves to `consentBody = 'board'` with directors as signers; audit Partnership and the remaining entity types for a non-empty signer path.

**`src/lib/meeting-pdf-export.ts`** (consent block ~3558–3653)
- Load `meeting_signatures` into the consent data set. Branch: no rows → current code path verbatim; rows present → new header cells, effective-date clause, execution clause, per-signer date rules. Same two-column layout and `checkPageBreak` handling.
- Apply the same block in `src/lib/nonprofit-annual-meeting-pdf.ts` only if consents actually route through it.

**`src/pages/MeetingDetail.tsx`** — `isWrittenConsent` branch (~line 928): dual-date header plus the inline-editable signature list.

**Explicitly not done:** no rename or repurpose of `meeting_date`; no migration of the consent JSON in `meeting_other.notes`; no change to `meeting_directors` / `meeting_shareholders` writes; no backfill of `signed_on` or `executed_date`; `executed_date` never appears in an editable form.

## Verification

1. Existing consent, opened and printed without editing → identical PDF.
2. New consent with blank signature dates → blank date rules, no EXECUTED cell.
3. Signature dates Oct 28 and Nov 2 → `executed_date = 2025-11-02`, both dates print.
4. Clearing one signature date → `executed_date` returns to NULL.
5. End-to-end consent creation for Corporation, S-Corp, LLC, Single Member LLC, Non-Profit, Partnership.
6. Editing a consent preserves previously entered signature dates.
