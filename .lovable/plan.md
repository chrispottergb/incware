

# Orphaned Backend — No UI Surface

## Findings

| Backend Asset | Type | UI Surface | Status |
|---|---|---|---|
| **`business_sales`** table | DB table (buyer, seller, sale_type, price, financing, status) | Zero references in any component | **ORPHANED** — fully provisioned table with no CRUD UI anywhere |
| **`meeting_vehicle_sales`** table | DB table (year_make_model, buyer, sale_price, VIN, reason) | Zero references in any component | **ORPHANED** — vehicle purchases and leases have UI in `MeetingVehicles.tsx`, but vehicle *sales* do not |
| **`encrypt-legacy-ssn`** edge function | Edge function (bulk migrates plaintext SSN→encrypted) | Zero frontend callers | **ORPHANED** — admin utility with no trigger button or admin page |
| **`tax_return_jobs`** table | DB table (status, result, file_path) | Only referenced *indirectly* via edge functions `parse-tax-return` and `poll-tax-return-job` | **PARTIAL** — `TaxReturnUpload.tsx` calls the edge functions but never queries the table directly; no job history or status UI |

### Not orphaned (confirmed wired)
- `decrypt_ssn_ein`, `encrypt_ssn_ein`, `encrypt_shareholder_ssn`, `extract_company_id_from_path`, `recalculate_ownership_percentages`, `migrate_legacy_ssn`, `has_role` — these are DB functions/views, not tables needing UI
- `master_contacts`, `master_firms` — used in `useMasterDirectory.ts`
- `registered_agent_history` — used in `OrganizationTab.tsx`
- `document_registry` — used in 7 generator components
- `user_invitations` — used in `UserManagement.tsx`

---

## Remediation Plan

### 1. Add Vehicle Sales sub-tab to MeetingVehicles (HIGH)
**File:** `src/components/meeting/MeetingVehicles.tsx`

The component already has "Owned Vehicles" and "Leased Vehicles" sections. Add a third section for "Vehicle Sales" with the same CRUD pattern, querying `meeting_vehicle_sales`. This mirrors the existing purchase/lease pattern exactly.

### 2. Add Business Sales tab to Company Detail (MEDIUM)
**File:** New `src/components/company/BusinessSalesTab.tsx`

Create a CRUD component for the `business_sales` table (buyer, seller, sale type, price, date, status, notes). Wire it as a new tab in `CompanyDetail.tsx`. This table tracks asset/business sales with financing terms and statute references — it's a complete schema with no UI.

### 3. Add "Migrate Legacy SSNs" button to admin UI (LOW)
**File:** `src/pages/UserManagement.tsx` or a new admin utilities section

Add a button that calls the `encrypt-legacy-ssn` edge function. This is an admin-only one-time migration utility. Could also be a standalone admin page.

### 4. Add Tax Return Job History (LOW)
**File:** `src/components/TaxReturnUpload.tsx`

Add a small table below the upload area showing `tax_return_jobs` status (pending/complete/failed) so users can see processing history and retry failed jobs.

---

### Technical details
- Vehicle sales follows the identical pattern in `MeetingVehicles.tsx` — same `useQuery`/`useMutation` with `meeting_vehicle_sales` table
- Business sales table has: `buyer_name`, `seller_name`, `sale_type`, `consideration_type`, `total_price`, `financing_terms`, `sale_date`, `status`, `notes`, `property_description`, `statute_reference`
- No database migrations needed — all tables exist
- `encrypt-legacy-ssn` requires `SSN_ENCRYPTION_KEY` secret and admin auth

