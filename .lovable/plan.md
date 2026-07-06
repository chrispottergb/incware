# Drafting Style toggle: Membership Units vs. Percentage Only

Per-entity choice of how ownership is described in generated SM Operating Agreements. Underlying ledger, certificates, Members table, Authorized Units, and CapTableStatusBar are unaffected — only the printed clause text changes.

## Step 0 — Migration

Add nullable column and backfill once:

```sql
ALTER TABLE public.companies ADD COLUMN oa_drafting_style text
  CHECK (oa_drafting_style IN ('units','percentage_only'));

UPDATE public.companies c
   SET oa_drafting_style = 'units'
 WHERE oa_drafting_style IS NULL
   AND EXISTS (SELECT 1 FROM public.share_transactions st WHERE st.company_id = c.id);
-- Rows without transactions and all future rows stay NULL → treated as 'percentage_only'.
```

Generator code treats `null` as `'percentage_only'`. No forced regeneration of existing PDFs.

## Step 1 — UI toggle (`SMOperatingAgreementGenerator.tsx`)

Add a shadcn `Select` next to the `AIProviderSelect`, label **"Ownership Structure"**, options: `Percentage Only` (value `percentage_only`), `Membership Units` (value `units`). Bound to `company.oa_drafting_style`, defaulting the displayed value to `percentage_only` when stored value is `null`. On change, immediately `update` the company row (same pattern used for other sticky per-entity settings) and refetch, so the choice persists per entity.

Helper text: *"Choose how ownership is described in the generated agreement. This does not affect your unit ledger or certificates — only the document wording."*

## Step 2 — Data plumbing

Extend `SMOperatingAgreementData` in both PDF files:

```ts
draftingStyle: 'units' | 'percentage_only';
```

In `handleGenerate` and `handleAiGenerate`, resolve `draftingStyle = company.oa_drafting_style ?? 'percentage_only'` and pass it through. For the AI-assisted path, also include drafting style in the prompt context so the LLM refines the correct clause variant.

## Step 3 — Clause branching, standard SM (`smllc-operating-agreement-pdf.ts`)

**Section 2.1** branches on `draftingStyle`:

- `units` — existing dynamic clause, unchanged (including the zero-issued placeholder fallback).
- `percentage_only` — new clause:
  > *"The Member owns {ownership_percentage}% of the membership interest in the Company. Ownership is recorded and tracked as a percentage interest."*
  Uses `ownershipPct` already computed (fallback to `100` for sole member, consistent with earlier fix).

**Section 2.2** (Initial Capital Contribution) — unchanged; already unit-free, and its own missing-data fallback continues to apply in both modes.

**Section 2.3** (Capital Contributions) — verified unit-free, unchanged.

## Step 4 — Clause branching, S-Corp SM (`smllc-scorp-operating-agreement-pdf.ts`)

**Section 2.1** — same branch as Step 3.

**Section 2.2 / 2.3** — unchanged (both already agnostic).

**Section 2.4 (Single Class of Membership Interest)** — branch:

- `units` — existing clause, unchanged.
- `percentage_only`:
  > *"The Member's entire membership interest, expressed as a percentage ownership rather than through membership units, constitutes a single class of membership interest within the meaning of IRC §1361(b)(1)(D). The Company shall not create, issue, or authorize any interest, security, agreement, or arrangement that would result in the Company being treated as having more than one class of stock for purposes of Subchapter S of the Internal Revenue Code."*

**Section 2.5 (Distributions Pro Rata)** — inspected: existing wording is already structure-agnostic (*"in proportion to each member's ownership percentage of the Company's membership interest"*). Leave as-is in both modes. No branch needed.

Article 5 and Article 6 cross-references to §§ 2.4 / 2.5 remain valid — only interior text changes.

## Step 5 — Guard adjustment

Existing "Generate disabled when `issued_units === 0`" guard on the Generate Standard / AI-Assisted buttons currently applies universally. Change to:

```ts
disabled = draftingStyle === 'units' && issuedUnits === 0
```

Tooltip only shown when disabled (unchanged copy). In `percentage_only` mode the document doesn't depend on issued units, so generation is not blocked — the Section 2.2 defensive fallback still handles missing initial-contribution data independently.

## Files touched

- `supabase/migrations/*` — add `oa_drafting_style` column + one-time backfill.
- `src/components/company/SMOperatingAgreementGenerator.tsx` — Select control, sticky save, pass `draftingStyle` into both handlers, adjust guard.
- `src/lib/smllc-operating-agreement-pdf.ts` — extend interface, branch 2.1.
- `src/lib/smllc-scorp-operating-agreement-pdf.ts` — extend interface, branch 2.1 and 2.4.

## Out of scope

- Members / Transactions / Certificates / Authorized Units UI and validation — untouched.
- `CapTableStatusBar`, backfill banner, transaction-validation copy — untouched.
- Multi-member OA generators — untouched.
- No retroactive regeneration of previously downloaded PDFs.

## Verification after build

1. New SMLLC, no `share_transactions` → toggle shows "Percentage Only"; both Generate buttons enabled; 2.1 prints percentage clause; 2.2 prints the "no initial capital contribution recorded" fallback.
2. Existing SMLLC with transactions → backfilled to `units`; generated output byte-identical to pre-change (spot-check 2.1, 2.4, 2.5).
3. Toggle percentage_only → units on same entity and regenerate → 2.1 (and S-corp 2.4) swap to unit-based wording; no leftover placeholders; cross-references in Articles 5/6 still resolve.
4. `tsgo` clean.
