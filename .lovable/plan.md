# Non-Profit Governance Tab — Implementation Plan

Scope: Only the `shareholders` tab when `entity_type = "Non-Profit"`. All other entity types unchanged.

## Note on the "Seal field at the top"
The Seal field currently lives in the **Incorporation Info** tab (`IncorporationTab.tsx`), not in the Governance tab. The Governance tab today renders the standard Shareholders/Workflow content for Non-Profit. I will leave Incorporation's Seal field as-is and build the new Governance content below it within the Governance tab. If you instead want Seal mirrored into the Governance tab header, say so and I'll add a read-only copy.

## Section 1 — Initial Directors (editable)

New component `NonProfitGovernanceTab.tsx` rendered in place of the current shareholders content when `entity_type === "Non-Profit"`.

Header: **Initial Directors** — subtitle: *Directors proposed prior to the Organizational Meeting.*

Editable table, one row per director:
- Full Name (text)
- Address (text)
- City (text)
- State (US-state dropdown, reuse existing list used elsewhere in app)
- Zip (text, triggers existing `useZipLookup` to auto-fill city/state per project convention)
- Email (text)
- Phone (text, uses existing phone format helper)
- Term Length (dropdown: 1 year, 2 years, 3 years)
- Term Start Date (date input, MM/DD/YYYY, using existing `DatePickerField`)

Controls: **Add Director** button at bottom; trash/remove icon per row using existing `ConfirmDeleteDialog` per project convention. Auto-save via existing `useAutoSave` (2s debounce).

## Section 2 — Board of Directors (read-only, post-Org-Meeting)

Divider above. Header: **Board of Directors** — subtitle: *Elected at the Organizational Meeting. Populated after the Organizational Meeting is completed.*

Behavior:
- If no completed Organizational Meeting exists for the company → show empty read-only table with an inline notice: "Will populate after the Organizational Meeting is completed."
- If a completed Organizational Meeting exists → render rows derived from that meeting's roster + officer assignments.

Columns (read-only): Full Name, Address, City, State, Zip, Email, Phone, Officer Role (Chair / Vice Chair / Secretary / Treasurer / Director), Term Start Date, Term End Date, Status (Active / Resigned / Term Expired).

No editing in this section in this iteration — display only. (Editing flow can be added later if needed.)

## Database

New table `nonprofit_initial_directors`:
- company_id (uuid, FK to companies, cascade delete)
- full_name, address, city, state, zip, email, phone (text)
- term_length (text — '1 year' | '2 years' | '3 years')
- term_start_date (date)
- sort_order (int, for stable ordering)
- standard id/created_at/updated_at

RLS: same pattern as other company-scoped tables — only the owning user of the parent `companies` row can select/insert/update/delete. No changes to auth or other tables.

For Section 2, no new table needed in this iteration — derived read-only from the existing Organizational Meeting record. (Detection of "completed Organizational Meeting": existing `meetings` row of the org-meeting type with completion flag. I'll wire this lookup and render empty if absent.)

## Files

- New: `src/components/company/NonProfitGovernanceTab.tsx`
- Edit: `src/pages/CompanyDetail.tsx` — inside `<TabsContent value="shareholders">`, branch on `entity_type === "Non-Profit"` to render `<NonProfitGovernanceTab companyId={company.id} />` instead of the standard workflow cards / `ShareholdersTab` / ledger stack. For-profit path unchanged.
- New migration: create `nonprofit_initial_directors` + RLS policies.

## Out of scope (per request)
- No edits to any other tab or to for-profit Governance rendering.
- No changes to Organizational Meeting wizard wiring beyond reading the completion status. Wiring the meeting → board sync (writing elected officers back into a board table) is deferred unless you want it now.