## Problem found

`src/lib/resolution-types.ts` defines resolution lists per entity type, but only four keys survive: `Corporation`, `LLC-S`, `Non-Profit`, `Partnership`. The `Corporation` array (lines 99–203) actually contains **four concatenated blocks** — a C-corp block, an S-corp-flavored block (IRC § 1366/1362 citations), and two LLC blocks (Wis. Stat. § 183) — because the key lines that separated them were lost. Result: 43 entries with 29 labels repeated 2–4 times.

Because there is no `LLC` or `Single Member LLC` key, those entity types fall back to `Corporation` and see the whole duplicated mega-list in the Add Resolution dropdown.

## Changes (all in `src/lib/resolution-types.ts` unless noted)

1. **Restore the missing entity keys** by splitting the `Corporation` array back into four:
   - `Corporation` — current lines 100–129 (C-corp, Wis. Stat. § 180)
   - `"S Corporation"` — lines 130–156 (IRC § 1366/1362 variants)
   - `"Single Member LLC"` — lines 157–176 (LLC block without member-admission/manager items)
   - `LLC` — lines 177–202 (full LLC block with Admit New Member, Elect/Re-elect Managers)
   
   No template text is changed; entries are only regrouped. Each list then contains each label once.

2. **Defensive dedupe** — `MeetingResolutions.tsx` already dedupes by label; add the same dedupe to the resolution options in `src/components/WrittenConsentWizard.tsx` (line 362) so any future stray duplicate can't reappear.

3. **Rename and rewrite the retirement resolution** in every list that has it (Corporation, S Corporation, LLC, Single Member LLC, LLC-S, Non-Profit, Partnership as applicable):
   - Label: `Approve 401(k) Profit Sharing Contribution` → **`Approve Employer Contribution to Retirement Plan`**
   - Template replaced with the supplied WHEREAS / NOW THEREFORE BE IT RESOLVED / two RESOLVED FURTHER paragraphs, verbatim, with the bracketed placeholders kept as-is.
   - Statute reference stays `IRC § 401(k); IRC § 404(a)`.
   - `CATEGORY_MAP`: remove the old label entry and add the new label under **Benefits** (it currently sits under Operations; a retirement-plan contribution belongs with Benefits). Say the word if you'd rather keep it in Operations.

## Notes on existing data

Resolutions already saved to meetings store their title as text, so previously created "Approve 401(k) Profit Sharing Contribution" entries keep their old title and text — nothing breaks and no migration is needed. Only newly added resolutions use the new name and wording.

## Verification

Load a meeting for an LLC entity and one for a Corporation, open Add Resolution, and confirm each type appears exactly once and the new "Approve Employer Contribution to Retirement Plan" inserts the new wording.
