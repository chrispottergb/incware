## Goal

Replace the free-text "Assign Person" dialog in **AI Compliance → Oversight** with a structured form that picks from existing officers/directors (or adds an ad-hoc contact), captures an oversight role, effective date and notes, and links the assignment back to the source record.

## Database changes (one migration)

1. **New table `public.ai_oversight_contacts`** for ad-hoc people who aren't officers/directors:
   - `company_id` (uuid, FK → companies), `full_name`, `title`, `email` (nullable)
   - Standard `id`, `created_at`, `updated_at`
   - GRANTs + RLS scoped to the owning company (mirrors existing AI-compliance tables)

2. **Extend `public.ai_oversight_persons`** (additive, nullable — keeps existing rows valid):
   - `oversight_role text` — one of `Primary AI Oversight Officer`, `Secondary AI Oversight Officer`, `Delegated Reviewer`
   - `effective_date date`
   - `notes text`
   - `source_type text` — `officer` | `director` | `contact`
   - `source_id uuid` — id of the officer row, director row, or `ai_oversight_contacts` row
   - `contact_id uuid` FK → `ai_oversight_contacts(id)` (nullable, used when `source_type = 'contact'`)

   Existing `person_name` / `title` / `assigned_date` stay (snapshotted at assignment time so historical records survive renames/deletes). `assigned_date` keeps working; new UI writes to both `assigned_date` and `effective_date`.

## UI changes — `src/components/company/ai-compliance/AIOversightPersons.tsx`

Rebuild the dialog body:

1. **AI System** — unchanged dropdown.
2. **Select Person** — single dropdown populated from two queries:
   - `officers` row for the company → expanded into up to 4 entries (President / Vice President / Secretary / Treasurer) where the name is non-empty, formatted `"<Name> — <Title>"`.
   - `directors` rows → `"<Name> — Director"`.
   - `ai_oversight_contacts` rows for the company → `"<Name> — <Title>"`.
   - Final item: **`+ Add Someone Else`**.
   - Each option's value encodes `source_type:source_id` so the save handler knows where it came from.
3. **Add Someone Else inline form** (revealed when that option is chosen): Full Name (required), Title/Role (required), Email (optional). On save, insert into `ai_oversight_contacts` first, then use the returned id as the assignment's `source_id`/`contact_id`.
4. **Oversight Role** — dropdown with the three fixed options.
5. **Effective Date** — `DatePickerField` with helper text "Date this oversight assignment takes effect".
6. **Notes** — optional `Textarea`.
7. Remove the old free-text Name / Competence / Authority / Status inputs from this dialog (existing data still renders on the cards via the unchanged DB columns).

Save flow:
- If "Add Someone Else" path: insert contact → get id → insert assignment with `source_type='contact'`, `contact_id`, `source_id = contact.id`, and snapshot `person_name`/`title` from the form.
- Otherwise: insert assignment with selected `source_type`/`source_id`, snapshot `person_name`/`title` from the chosen officer/director/contact, `oversight_role`, `effective_date`, `notes`.

Card list:
- Show `person_name`, snapshot `title`, an **Oversight Role** badge, the AI system name, effective date, and notes when present. Keep the existing delete button.

Styling stays on the current dark-theme tokens (`Card`, `Badge`, `Input`, `Select`, `Textarea`, `DatePickerField`) — no new colors.

## Out of scope

- LLC members/managers are not part of this request (user specified officers/directors only).
- No edits to existing assignments — assignments remain create + delete (matches current behavior).
- No schema changes to `officers` / `directors`.
