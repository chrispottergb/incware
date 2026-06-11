# Assets & Lease Transactions Module

Replace the meeting page's "Vehicles & Equipment" sub-tab with a new entity-scoped **Asset & Lease Transaction Log** — a clean legal recordkeeping module backed by a single unified table, with existing data migrated in.

## 1. Database

**New table `asset_transactions`** (single table for all four entry types):
- `id`, `entity_id` (references companies, cascade delete), `type` (purchase / lease / vehicle_sale / lease_termination), `description`, `date`, `amount`, `monthly_payment`, `vendor`, `lessor`, `buyer`, `financing`, `term`, `end_date`, `reason`, `resolution`, `created_at`, `updated_at`
- GRANTs for authenticated + service_role, RLS scoped to the company owner (same pattern as other company sub-tables), `updated_at` trigger
- Validation trigger ensuring `type` is one of the four allowed values

**Data migration** — copy existing rows into the new table (joined through meetings to get the company):
- `meeting_vehicle_purchases` → purchase (seller → vendor)
- `meeting_vehicle_leases` → lease (lessor, monthly payment, start/end dates)
- `meeting_vehicle_sales` → vehicle_sale (buyer, sale price)
- `meeting_lease_terminations` → lease_termination (landlord → lessor, reason + notes)

Legacy tables stay in place (the Annual Review snapshot and wizard still reference them) — they just stop being the live source for this tab.

## 2. New component — `AssetLeaseTransactionLog.tsx`

Props: `entityId`. Features:
- **Unified list, newest first** — one card per entry: description, color-coded type pill (Purchase / Lease / Vehicle sale / Lease ended), date, type-specific key fields (vendor & financing, lessor & term, buyer, reason), dollar amount or "$X/mo" right-aligned, resolution number in muted text below the amount
- **Filter bar**: All / Purchases / Leases / Vehicle sales / Lease terminations
- **"Add entry" modal** (min 600px wide per house style) with four tabs, each showing only that type's fields; edit and delete (via the standard ConfirmDeleteDialog) on each card
- Flat, professional styling: subtle borders, no shadows, muted metadata, soft-opacity colored badges, existing currency formatting and date picker components — all via semantic design tokens

## 3. Wire into navigation

In `MeetingDetail.tsx`:
- Rename the sub-tab to **"Assets & Lease Transactions"**
- Render the new component with the meeting's company id (entity-scoped, so it shows the full company log; available on all standard meetings, no longer limited to Annual/Organizational)

## 4. Minutes PDF update

The Annual/LLC minutes PDF currently reads the four legacy per-meeting tables. Update the PDF data assembly to pull from `asset_transactions`:
- Entries dated between the prior meeting date (exclusive) and this meeting's date (inclusive); if no prior meeting, entries in the meeting's calendar year
- Mapped into the existing PDF sections (capital asset additions, leases, dispositions, terminations) so the minutes layout is unchanged

## Out of scope
- The Annual Meeting Wizard's "Vehicles & Equipment" step and the public Annual Review snapshot keep their current behavior (can be aligned in a follow-up)
- No depreciation, VINs, serial numbers, or document uploads — strictly corporate-records fields

## Technical notes
- Two-step build: migration first (table + grants + RLS + data copy), then UI/PDF code after types regenerate
- Dates handled with the project's `T00:00:00` convention; numeric columns handled as strings and cast explicitly
