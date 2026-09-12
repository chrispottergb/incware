# Real Property tab

A new company-scoped tab recording real estate a company owns: acquisition, authority, encumbrance, and eventual disposition on one row per property. Everything is additive — no changes to `asset_transactions`, the Assets & Lease Transactions tab, or any PDF builder.

## Pre-change findings (verified)

- `asset_transactions` RLS shape: one `FOR ALL` policy, `EXISTS (SELECT 1 FROM companies c WHERE c.id = asset_transactions.entity_id AND c.user_id = auth.uid())`. The new table copies this shape with `company_id`.
- Company tabs live in two places that must both be updated: `tabConfig` in `src/pages/CompanyDetail.tsx` (line ~143) and `companyNav` in `src/components/AppLayout.tsx` (line ~151), with separate LLC and non-LLC lists in each.
- The ratification sweep builds candidates in `buildCandidates` (`src/lib/interim-actions.ts`) from rows fed by `src/components/meeting/RatificationSweep.tsx` (queries at ~line 113, `SourceRows` assembly at ~line 155).
- `AssetLeaseTransactionLog.tsx` supplies the list-row styling, filter chips, "+ Add entry" placement, dialog, and `ConfirmDeleteDialog` patterns the new tab clones.
- The address book re-seed loop is real: `useAddressBook.upsert` will resurrect hidden/renamed entries. The new tab must read suggestions only.

## What gets built

**1. Migration — `public.real_property`.** Columns: `company_id` (FK companies, cascade), `property_label`, `street_address`, `city`, `state`, `zip`, `county`, `parcel_id`, `legal_description`, `acquisition_date`, `purchase_price` (numeric), `seller_name`, `titled_in_name_of`, `deed_type`, `recorded_date`, `recording_document_number`, `is_financed` (bool, default false), `lender_name`, `linked_loan_id` (FK meeting_loans, null on delete), `property_use`, `authorized_by_meeting_id` (FK meetings, null on delete), `notes`, `status` (default 'Held'), `disposition_date`, `sale_price` (numeric), `buyer_name`, `disposition_doc_number`, `title_held_by_seller` (**boolean not null default false** — a checkbox, never text), plus `created_at`/`updated_at` with the existing `update_updated_at_column` trigger.

- `deed_type`, `property_use`, and `status` are **plain `text` columns — no CHECK constraints, no enum types**. The allowed values (Warranty / Special Warranty / Quit Claim / Trustee's / Personal Representative's / Land Contract / Other, etc.) are enforced only by the Select options in the UI.
- GRANTs to `authenticated` and `service_role`, RLS enabled, one `FOR ALL` policy copying the `asset_transactions` shape (`EXISTS ... companies.user_id = auth.uid()`).

**2. New tab UI — `src/components/company/RealPropertyTab.tsx`.** Clones the Assets & Lease Transactions look: filter chips (All / Held / Sold / Transferred), "+ Add entry" top-right, list rows showing label, status chip, acquisition date, and purchase price. Add/Edit dialog with the full field set: `titled_in_name_of` defaults to the company name but stays editable; `property_label` defaults to the street address; lender fields hidden unless `is_financed`; disposition fields appear only when status is not Held; "Leased to a related party" shows a nudge to check the Leases tab. Delete uses `ConfirmDeleteDialog`.

- **Land contract handling.** The "Title held by seller (land contract)" checkbox is **always visible** — never conditionally hidden, so the value is never stranded by a later `deed_type` edit. Selecting deed type "Land Contract" auto-checks it, and it stays fully editable so a contract since paid off can be unchecked by hand. While it is checked, the grantee field is relabelled **"Vendee (equitable title)"**; otherwise it reads "Titled in name of".


- Seller and buyer name fields use `NameAutocomplete` for **read-only suggestions**. The save handler does **not** call `useAddressBook.upsert` — no write-back to the address book from this tab.

**3. Tab wiring.** Add "Real Property" to `tabConfig` in `CompanyDetail.tsx` and to both `companyNav` lists in `AppLayout.tsx`, placed next to Leases.

**4. Out of scope — deferred to prompt 2.** The ratification sweep (`interim-actions.ts`, `RatificationSweep.tsx`) is not touched in this pass; the table lands first. Also out: PDF/minutes output, the nudge on the Assets tab, data migration (the old building row was already removed by hand), and any change to `asset_transactions` or `cloneSubTables`.

## Verification

- Migration applies with grants + RLS; linter shows no new findings for `real_property`.
- `deed_type`/`property_use`/`status` confirmed constraint-free (query `pg_constraint`); `title_held_by_seller` confirmed `boolean not null default false`.
- Save a property in the preview, edit it, mark it Sold (disposition fields appear), delete it; confirm list and chips update.
- Set deed type to Land Contract and confirm the checkbox auto-checks, the grantee label becomes "Vendee (equitable title)", the box can be unchecked by hand, and changing deed type away does not hide or clear it.
- Confirm saving with a seller name does not create or modify any `user_address_book` row.
- `bunx tsc --noEmit`, full Vitest suite, production build.

