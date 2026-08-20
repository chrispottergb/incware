# Name/Address Cleanup Screen — Audit Report and Hardening Plan

## STEP 0 — AUDIT (read-only, nothing modified)

### 1. The screen
- **File:** `src/components/settings/AddressBookCard.tsx`
- **Component:** `AddressBookCard` ("Address Book" card)
- **Route:** `/settings` (rendered inside `src/pages/Settings.tsx`)
- Supporting files: `src/hooks/useAddressBook.ts` (data + search + upsert), `src/contexts/AddressBookContext.tsx` (app-wide provider), `src/components/NameAutocomplete.tsx` (the typeahead these values feed).

### 2. Storage
There **is** a real lookup table — the screen is not reading DISTINCT off record tables.

**`public.user_address_book`** (240 rows, all belonging to 1 user):

| column | type | null | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | — |
| full_name | text | no | — |
| address | text | yes | — |
| address_2 | text | yes | — |
| city | text | yes | — |
| state | text | yes | — |
| zip | text | yes | — |
| company_id | uuid | yes | — |
| created_at | timestamptz | no | now() |
| updated_at | timestamptz | no | now() |

**Reads:** `user_address_book` (all columns above) and `companies(name)` via the `company_id` join, for the "Company" column only.

**Writes:** `user_address_book` only — UPDATE of `full_name, address, address_2, city, state, zip, updated_at` on one id; DELETE of one id.

**One-time seed (separate path, `useAddressBook.ts`):** reads `companies.id`, `shareholders(name,address,address_2,city,state,zip,company_id)`, `directors(same)`, `master_contacts(contact_name)` and INSERTs into `user_address_book`. It runs **only when the book is completely empty**, so it does not resurrect deleted rows today.

### 3. The CORRECT / rename action — actual code

```ts
const { data, error } = await supabase
  .from("user_address_book" as any)
  .update({
    full_name: values.full_name.trim(),
    address: values.address.trim() || null,
    address_2: values.address_2.trim() || null,
    city: values.city.trim() || null,
    state: values.state.trim() || null,
    zip: values.zip.trim() || null,
    updated_at: new Date().toISOString(),
  } as any)
  .eq("id", editing.id)
  .select("id");
```

**Answer: (a) — it updates only the lookup row.** There is no cross-table UPDATE anywhere in this screen. A rename does **not** touch `shareholders`, `directors`, `officers`, `organizers`, `master_contacts`, `share_transactions`, or any generated document. Consequence: today a rename silently leaves the old spelling on every saved record, and the old spelling can reappear in the suggestion list the next time that record's name is upserted.

### 4. The DELETE action — actual code

```ts
const { error } = await supabase.from("user_address_book" as any).delete().eq("id", id);
```

**Answer: it hard-DELETEs the lookup row.** It does not set an inactive flag (no such column exists) and it does not null or clear the value on any record table. Saved records are untouched.

### 5. Row counts
- Total rows: **240** (single user).
- Obvious test data by name pattern (test/abc/asdf/xxx/demo/sample): **0**.
- Rows with whitespace/punctuation defects (leading/trailing space, doubled internal space, trailing comma or period): **4**.

### Part A4 confirmation (stated up front, as requested)
Because rename is lookup-only and delete is lookup-only, **nothing in Part A changes a stored value on any record table.** The Part A work adds a confirmation dialog, an insert-only audit log, and a soft-hide flag. No record-table UPDATE is introduced by this change.

---

## PART A — Make destructive actions safe

**A1 — Rename confirmation.** Rename does not perform a cross-record UPDATE, so the scary "this will change N saved records" warning would be false. Instead, before saving a rename we count how many saved records still carry the **old** string (case-insensitive, exact match) across `shareholders.name`, `directors.name`, `officers.name`, `organizers.organizer_name`, `master_contacts.contact_name`, `bank_authorized_signers.signer_name`, and show an accurate dialog:

- N > 0: "N saved record(s) across M compan(ies) still use \"old value\". Renaming here only fixes the suggestion list — those records keep the old spelling, and documents already generated will not match. Continue?"
- N = 0: "No saved records use this value. This only updates the suggestion." — plain, no count theatre.

Cancel is the default-focused button in both cases.

**A2 — Audit table `name_cleanup_log`** (new table, insert-only):
`id, action ('rename'|'hide'|'delete'), target_table, target_column, old_value, new_value, affected_row_count, performed_at, performed_by`.
RLS: user may INSERT and SELECT own rows; **no UPDATE or DELETE policy at all**. Surfaced as a read-only list at the bottom of the Address Book card (newest first, no controls).

**A3 — Delete becomes a soft hide.** Add `is_hidden boolean NOT NULL DEFAULT false` to `user_address_book`. The row's stored values are never cleared.
- Value referenced by N > 0 records: only **Hide** is offered, with an "In use by N records" badge. No hard delete.
- Value referenced by 0 records: **Hide** is the primary action; hard **Delete** stays available as a secondary action for genuinely junk entries.
- Both actions write a `name_cleanup_log` row. A "Show hidden" toggle lets the user unhide.

**A4 — Confirmed above.** No Part A code path writes to any record table.

---

## PART B — Normalize on save

A single pure helper `normalizeEntryText(value)`: trim ends, collapse internal whitespace runs to one space, strip trailing commas and periods. No case changes, no expansion or abbreviation.

Applied at the point of save in:
- `useAddressBook.ts` → `upsert` (the single funnel every "remember this name" call goes through: OrganizationTab, ShareholdersTab, CounselSection, LeasesTab, BillsOfSaleTab, BusinessSalesTab, MeetingVehicles, BatchTransferDialog, LeaseTransactionDialog, CreateCompanyWizard, OrgMeetingWizard, AnnualMeetingWizard).
- `AddressBookCard` edit form (name, address, address_2, city, state, zip).

Existing rows are **not** retroactively normalized.

---

## PART C — Near-match hint at entry

Added to `NameAutocomplete`, computed client-side against the already-loaded entries list (no per-keystroke query). When the typed value is not an exact match and a close match exists, one non-blocking hint renders below the field:

> Similar existing entry: "Robertson Ryan & Associates"  [Use this] [Keep what I typed]

Close-match rules (first hit wins, at most one suggestion): equal after lowercasing and stripping punctuation/whitespace; OR one is a prefix of the other with >= 5 characters; OR Levenshtein distance <= 2 for strings >= 6 characters. Never blocks save, never auto-replaces.

---

## PART D — Hidden values drop out of suggestions

`useAddressBook`'s `search()` and the `entries` it exposes to typeaheads filter `is_hidden = false`. The Settings management list still shows hidden rows (flagged, behind the "Show hidden" toggle) so they can be restored. Values already stored on records render normally everywhere — nothing reads `is_hidden` outside the suggestion path.

---

## Out of scope (not built)
No merge/dedupe wizard, no bulk fuzzy merge, no retroactive normalization, no PDF builder changes, no changes to `meeting_benefits` / ratification / `interim_actions`, no new nav entries.

---

## Technical details

**Migration SQL (additive only — no column dropped or altered):**

```sql
ALTER TABLE public.user_address_book
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE public.name_cleanup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('rename','hide','delete')),
  target_table text NOT NULL,
  target_column text NOT NULL,
  old_value text,
  new_value text,
  affected_row_count integer NOT NULL DEFAULT 0,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid NOT NULL DEFAULT auth.uid()
);
GRANT SELECT, INSERT ON public.name_cleanup_log TO authenticated;
GRANT ALL ON public.name_cleanup_log TO service_role;
ALTER TABLE public.name_cleanup_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own log insert" ON public.name_cleanup_log
  FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());
CREATE POLICY "own log select" ON public.name_cleanup_log
  FOR SELECT TO authenticated USING (performed_by = auth.uid());
-- deliberately no UPDATE or DELETE policy: insert-only
```

**Files touched:** `src/components/settings/AddressBookCard.tsx`, `src/hooks/useAddressBook.ts`, `src/components/NameAutocomplete.tsx`, plus two new files `src/lib/name-normalize.ts` (normalize + Levenshtein/near-match, unit-testable pure TS) and `src/components/settings/NameCleanupLogList.tsx`.

**Acceptance evidence to be produced after build:** reference-count dialog screenshot for N>0 and N=0; before/after `SELECT` on one affected `shareholders` row proving a hide changed nothing; hidden value absent from a typeahead while still rendering on its record; `" Delta Dental "` stored as `Delta Dental`; the "Robertson Ryan" hint shown and ignored, saving exactly as typed.
