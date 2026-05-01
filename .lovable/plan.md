# Lease Agreement Module — Dynamic Classification & Conditional Generation

Extend the existing Leases system to auto-classify lease relationships (Standard / Related-Party / Self-Rental / Intercompany) based on real ownership data, inject conditional disclosure clauses into a single PDF template, and support manual override with audit trail.

## 1. Database Changes

**Extend `company_assets`** (lease rows only) with:
- `landlord_party_kind` text — `'individual' | 'company' | 'external'`
- `landlord_company_id` uuid (nullable, FK → companies)
- `landlord_shareholder_id` uuid (nullable, FK → shareholders)
- `tenant_party_kind` text — same enum (defaults `'company'` = current company)
- `tenant_company_id` uuid (nullable, FK → companies)
- `tenant_shareholder_id` uuid (nullable, FK → shareholders)
- `lease_classification` text — `'standard' | 'related_party' | 'self_rental' | 'intercompany'`
- `classification_overridden` boolean default false
- `classification_reason` text (human-readable explanation)
- `rent_frequency` text default `'monthly'`
- `generated_lease_text` text (snapshot of finalized lease body)
- `finalized_at` timestamptz

**New table `lease_clauses`** — editable conditional/custom clauses per lease:
- `id`, `lease_id` (FK → company_assets), `clause_type` (`'standard'|'disclosure'|'tax'|'custom'`), `clause_title`, `clause_text`, `sort_order`, `is_auto_generated`, `created_at`
- RLS via parent company ownership

**New table `lease_classification_audit`** — override log:
- `id`, `lease_id`, `old_classification`, `new_classification`, `reason`, `changed_by` (uuid), `changed_at`
- RLS via parent company ownership

**New `app_settings` row**: `related_party_threshold_pct` default `25`.

## 2. Classification Engine (`src/lib/lease-classification.ts`)

Pure TypeScript, fully unit-testable. Inputs: landlord party, tenant party, share-transaction snapshot, `company_relationships`, threshold. Outputs `{ classification, reason }`.

Rules evaluated in order:
1. **Self-Rental** — one party is `individual` (shareholder), the other is a `company` where that shareholder holds ≥ threshold computed ownership as of today.
2. **Intercompany** — both parties are `company`, AND either (a) linked in `company_relationships`, or (b) share a common controlling owner (≥ threshold in both).
3. **Related-Party** — any ownership overlap ≥ threshold not matching above (e.g., common trust/contact).
4. **Standard** — fallback (includes any `external` party).

Reason string explains the calculation, e.g. *"John Smith owns 100% of Acme LLC per share ledger as of 2026-05-01."*

## 3. Single PDF Template with Conditional Injection

Modify `src/lib/lease-agreement-pdf.ts`:
- Accept `classification` + `clauses[]` in `LeaseData`.
- Keep all 16 base sections unchanged.
- After Section 8 (Insurance), inject a new **"DISCLOSURE"** section only when classification ≠ `standard`, using the exact wording from your spec (Related-Party, Self-Rental, Intercompany).
- Append any `custom` clauses from `lease_clauses` before Signatures.
- On finalize, the rendered text body is captured and saved to `generated_lease_text` for version control.

## 4. UI Changes (`LeasesTab.tsx` + new components)

**New `EntityPartyPicker` component** replaces free-text Landlord Name:
- Tabs: *This Company* / *Related Company* / *Individual (Shareholder)* / *External Party*
- Related Company → dropdown of `companies` owned by current user
- Individual → dropdown of `shareholders` from the current company
- External → free text (forces Standard classification)

**Add Lease dialog** updates:
- Landlord picker (above) + Tenant picker (defaults to current company, editable)
- Live "Detected Classification" banner with badge color + "Why?" popover showing the reason string
- "Override classification" dropdown (writes to audit table on change)
- Rent Frequency select (Monthly/Annual/Other)
- "Preview" → existing flow with clauses applied
- "Generate & Finalize" → snapshots `generated_lease_text`, sets `finalized_at`

**New `LeaseClausesEditor`** (collapsible section in dialog):
- Lists auto-generated disclosure clauses (read-only badge) + editable custom clauses
- Add/remove/reorder custom clauses before finalizing

## 5. Files Touched

**New**
- `src/lib/lease-classification.ts` + `src/test/lease-classification.test.ts`
- `src/components/company/leases/EntityPartyPicker.tsx`
- `src/components/company/leases/LeaseClausesEditor.tsx`
- `src/components/company/leases/ClassificationBanner.tsx`
- `src/hooks/useLeaseClassification.ts` (TanStack Query — pulls share_transactions + relationships)

**Modified**
- `src/components/company/LeasesTab.tsx` — wire pickers, banner, editor, finalize flow
- `src/lib/lease-agreement-pdf.ts` — accept classification + clauses, inject disclosure section
- One migration: schema extension + 2 new tables + RLS + app_settings seed

## 6. Out of Scope (this round)

- Importing third-party landlords into a global directory (already covered by existing AddressBook autocomplete)
- Versioning multiple finalized PDFs per lease (current scope: one finalized snapshot; can be extended later)
- Cross-user shareholder lookups (RLS keeps it scoped to current owner's data)

## 7. Acceptance Criteria

- Selecting a shareholder as landlord + current LLC as tenant where that shareholder owns 100% → banner shows **Self-Rental** with reason string; PDF includes the IRS-rules disclosure paragraph.
- Selecting two sibling LLCs under common ownership → **Intercompany**; intercompany documentation clause added.
- External landlord → **Standard**; no disclosure paragraph.
- Manual override writes a row to `lease_classification_audit` and sets `classification_overridden = true`.
- Finalizing a lease persists `generated_lease_text` and disables further auto-regeneration unless explicitly re-finalized.