## Goal

Expand the LLC **Authorized Binders** card in `src/components/company/OrganizationTab.tsx` into a richer § 183.0301 capture form: a Management Structure toggle, structured per-row fields (with authority source), a DFI Statement of Authority checkbox/filing reference, and inline warnings — while preserving the existing dark card styling, auto-save, PDF/print actions, and trash-icon row UX. Corporation behavior (Initial List of Directors) is unchanged.

## Scope

Only the LLC branch of the Authorized Binders card (`isLLCType(company.entity_type) === true`). Directors UI for corporations stays as-is.

## Database (one migration)

New columns on `public.companies` (all nullable, additive — existing rows stay valid):

- `llc_management_structure text` — `"member_managed"` | `"manager_managed"` (default `"member_managed"` for LLC entities going forward; existing rows null, treated as `member_managed` in UI).
- `llc_authorized_binders jsonb` — array of binder objects, replaces today's plain `director_names` array for LLCs. Shape:
  - Member-Managed: `{ name, source_of_authority, restrictions_notes }`
  - Manager-Managed: `{ name, scope_of_authority, source_of_authority }`
- `llc_dfi_statement_filed boolean` (default false)
- `llc_dfi_statement_reference text`
- `llc_dfi_statement_date date`

`director_names` is kept untouched so corporations and historical PDFs/exports continue to work. On first save under the new UI, LLCs migrate any existing `director_names` entries into `llc_authorized_binders` as Member-Managed rows with empty authority fields (one-time, client-side, only when `llc_authorized_binders` is null/empty).

No new tables, no RLS changes needed (existing companies RLS covers these columns).

## UI — `OrganizationTab.tsx` (LLC branch only)

Replace the current name-only grid (lines ~1260–1302) with:

1. **Header row** — keep existing `CardDescription`, `SectionPdfActions` (eye/download/print), and `SaveStatusIndicator` ("Saved just now") exactly where they are.

2. **Management Structure pill toggle** (top of card body)
   - Uppercase label `MANAGEMENT STRUCTURE` using existing `field-label` class.
   - Two-button pill group: `Member-Managed` | `Manager-Managed`, built with existing `Button` (`variant="outline"`/`"default"` for selected) + `cn`. Selection drives row schema.

3. **Binder rows** — list rendered from `llc_authorized_binders` state, using the same dark card row layout, uppercase `field-label` headings, and a trash button per row (matches current styling).
   - **Member-Managed row fields:**
     - `BINDER NAME` — `Input`
     - `SOURCE OF AUTHORITY` — `Select` with options: `Member Default`, `Operating Agreement`, `Statement of Authority`
     - `RESTRICTIONS / NOTES` — `Input`
   - **Manager-Managed row fields:**
     - `MANAGER NAME` — `Input`
     - `SCOPE OF AUTHORITY` — `Input` (placeholder examples: "Full authority", "Contracts under $50,000")
     - `SOURCE OF AUTHORITY` — `Select` with options: `Operating Agreement`, `Statement of Authority`
   - Trash icon button per row (mirrors existing `Trash2` button styling); first row always retained.
   - Switching the toggle keeps name values but clears the other-structure-only fields after a `ConfirmDeleteDialog`-style inline confirm only when those fields have data; otherwise switch silently.

4. **Add button** — keeps current outline `Plus` style. Label is `+ Add Another Binder` when Member-Managed, `+ Add Another Manager` when Manager-Managed.

5. **Manager-managed inline note** — small muted-foreground line under the list when Manager-Managed:
   > *"In a manager-managed LLC, members do not have authority to bind the company unless separately granted."*

6. **DFI Statement of Authority block** (under the rows, both modes)
   - `Checkbox` row: `Statement of Authority filed with Wisconsin DFI`
   - When checked, reveal two side-by-side fields:
     - `FILING REFERENCE` — `Input`
     - `FILING DATE` — `DatePickerField`

7. **Warnings panel** — amber banner section (uses existing warning tokens, e.g. `bg-warning/10 text-warning border-warning/30`) shown above the auto-save row. Displays any of:
   - "No binders have been entered." — when list is empty or all names blank.
   - "Source of authority is required for each manager." — Manager-Managed + any row missing `source_of_authority`.
   - "DFI filing reference is required when the Statement of Authority box is checked." — checkbox on, reference empty.

8. **Footer row** — unchanged layout: `Add Another …` button on the left, `SaveStatusIndicator` on the right.

## State / save flow

- New local state: `managementStructure`, `binders[]`, `dfiFiled`, `dfiReference`, `dfiDate`, all hydrated from `company` on load (with the one-time migration from `director_names` described above).
- Extend the existing `directorsAutoSave` (rename internally to `bindersAutoSave` for LLC, but keep the corp directors save untouched) so the LLC branch persists the new columns. Reuse `useAutoSave` pattern already in the file — same 2s debounce, same blur trigger, same `SaveStatusIndicator`.
- `SectionPdfActions` config for LLC updated to print: Management Structure, each binder with its authority fields, and DFI filing info when present. Corporation PDF path unchanged.

## Out of scope

- Corporation (Initial List of Directors) UI and data — untouched.
- Org meeting / annual meeting / record-book PDF generators — not changed in this pass (they continue to read `director_names`; we can wire them to the new structure in a follow-up if you want).
- LLC member equity, officers, or any other section of the page.

## Files touched

- `supabase/migrations/<new>.sql` — add the 5 columns above to `public.companies`.
- `src/components/company/OrganizationTab.tsx` — LLC branch of the Authorized Binders card only.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.
