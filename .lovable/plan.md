

# Complete Access-to-EntityIQ Data Mapping & Backend Expansion

## Overview
This plan maps every table from the IncWare Access database to the EntityIQ app, creates missing backend tables, adds missing columns to existing tables, and expands the import wizard to handle all data types. This prepares the app for a full Access data migration.

## Part 1: Database Schema Changes

### 1A. New Table: `agreements`
Stores contract/agreement records linked to meetings.

```sql
CREATE TABLE agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agreement_type text NOT NULL,
  agreement_date date,
  agreement_with text,
  agreement_purpose text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: via meeting -> company -> user chain
```

### 1B. New Table: `meeting_loans`
Stores individual loan records per meeting (replaces the text-only loans field on counsel).

```sql
CREATE TABLE meeting_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  loan_type text,
  loan_rate numeric,
  loan_amount numeric,
  loan_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: via meeting -> company -> user chain
```

### 1C. Add columns to `meeting_officers`
```sql
ALTER TABLE meeting_officers
  ADD COLUMN IF NOT EXISTS salary numeric,
  ADD COLUMN IF NOT EXISTS bonus numeric;
```

### 1D. Add columns to `company_assets`
```sql
ALTER TABLE company_assets
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS purchase_amount numeric,
  ADD COLUMN IF NOT EXISTS lease_date date,
  ADD COLUMN IF NOT EXISTS lease_amount numeric;
```

### 1E. RLS Policies
All new tables get policies following the existing meeting -> company -> user chain pattern used by `meeting_amendments`, `meeting_benefits`, etc.

---

## Part 2: New UI Components

### 2A. `src/components/meeting/MeetingLoans.tsx`
- CRUD component following the `MeetingBenefits` pattern
- Dialog form with fields: Loan Type, Rate (%), Amount ($), Date, Notes
- Table display with all columns
- Added as a new sub-tab "Loans" on the Meeting Detail page

### 2B. `src/components/meeting/MeetingAgreements.tsx`
- CRUD component following the same pattern
- Dialog form: Agreement Type (dropdown), Date, With (party name), Purpose
- Table display
- Added as a new sub-tab "Agreements" on the Meeting Detail page

---

## Part 3: Update Existing Components

### 3A. `src/pages/MeetingDetail.tsx`
- Add "Loans" and "Agreements" tabs to the sub-tabs list
- Import and render `MeetingLoans` and `MeetingAgreements` components
- Add data queries for the new tables
- Include new data in the full minutes PDF export
- Add Print buttons for the new sections

### 3B. `src/components/meeting/MeetingSubTable.tsx` (Officers tab)
- Update the Officers tab usage in MeetingDetail to include salary and bonus columns in the MeetingSubTable definition

### 3C. `src/components/company/CompanyAssetsSection.tsx`
- Add VIN field to the Vehicle form
- Add Purchase Date/Amount fields to the Vehicle and Equipment forms
- Add Lease Date/Amount fields to the Equipment form
- Update table display columns to show new fields

---

## Part 4: Expand Import Wizard (`src/pages/ImportAccess.tsx`)

### 4A. Expand `TARGET_FIELDS` to include all entity types

Add these new import target groups to the mapping wizard:

| Group | Target Fields |
|---|---|
| **Meetings** | meeting.date, meeting.type, meeting.sub_type, meeting.tax_year, meeting.location, meeting.chairperson, meeting.secretary |
| **Meeting Shareholders** | mtg_shareholder.name, mtg_shareholder.common_shares, mtg_shareholder.preferred_shares, mtg_shareholder.distribution |
| **Meeting Directors** | mtg_director.name |
| **Meeting Officers** | mtg_officer.title, mtg_officer.name, mtg_officer.salary, mtg_officer.bonus |
| **Benefits** | benefit.type, benefit.provider, benefit.agent, benefit.agency, benefit.transaction_type, benefit.plan_year, benefit.effective_date, benefit.contribution, benefit.eligibility |
| **Amendments** | amendment.type, amendment.text, amendment.date |
| **Resolutions** | resolution.purpose, resolution.text |
| **Loans** | loan.type, loan.rate, loan.amount, loan.date |
| **Agreements** | agreement.type, agreement.date, agreement.with, agreement.purpose |
| **Auth Signers** | auth_signer.name, auth_signer.title |
| **Banks** | bank.name, bank.address, bank.city, bank.state, bank.zip, bank.account_number, bank.routing_number, bank.account_type |
| **Attorney Firms** | atty_firm.name, atty_firm.address, atty_firm.city, atty_firm.state, atty_firm.zip, atty_firm.phone, atty_firm.email |
| **Attorneys** | attorney.name, attorney.bar_number, attorney.specialty, attorney.phone, attorney.email |
| **Accountant Firms** | acct_firm.name, acct_firm.address, acct_firm.city, acct_firm.state, acct_firm.zip, acct_firm.phone, acct_firm.email |
| **Accountants** | accountant.name, accountant.cpa_number, accountant.specialty, accountant.phone, accountant.email |
| **Vehicles** | vehicle.year, vehicle.make, vehicle.model, vehicle.vin, vehicle.cost, vehicle.ownership_type, vehicle.purchase_date, vehicle.purchase_amount |
| **Equipment** | equipment.year, equipment.make, equipment.model, equipment.manufacturer, equipment.running_hours, equipment.ownership_type, equipment.purchase_date, equipment.lease_date |
| **Leases** | lease.description, lease.value, lease.address |
| **Property** | property.address, property.finance_company, property.escrow, property.mortgage, property.taxes |
| **Stock Certificates** | certificate.number, certificate.share_class, certificate.num_shares, certificate.issue_date, certificate.status |
| **Share Transactions** | transaction.type, transaction.date, transaction.from, transaction.to, transaction.shares, transaction.share_class, transaction.price_per_share |
| **Bills of Sale** | bill.seller, bill.buyer, bill.date, bill.shares, bill.share_class, bill.price_per_share, bill.total_price |
| **Timeline** | timeline.date, timeline.event |

### 4B. Update auto-mapping keywords

Add Access-specific column name patterns to the `keywords` map:
- `companyname` -> `company.name`
- `meetingid` -> (linking key)
- `shareholderid` -> (linking key)
- `benefittypeid` -> `benefit.type`
- `officertypeid` -> `mtg_officer.title`
- `loanrate` -> `loan.rate`
- `loanamount` -> `loan.amount`
- `vin` -> `vehicle.vin`
- `attyFirm` -> `atty_firm.name`
- `acctFirm` -> `acct_firm.name`
- etc. (comprehensive keyword list based on the Access column names shown in the diagrams)

### 4C. Update `handleImport` function

The import logic currently only handles 4 entity types (company, shareholders, directors, officers). It needs to be expanded to:

1. Create the company record first (existing)
2. Then for each meeting-linked table, look for a MeetingID linking column in the Access data
3. Create meeting records, then insert child records (benefits, amendments, resolutions, loans, agreements, meeting officers, meeting directors, meeting shareholders, auth signers)
4. For company-level tables (banks, attorneys, accountants, assets), insert with the new company_id
5. For stock data (certificates, transactions, bills of sale), insert with company_id and optionally link to shareholders by name matching
6. Handle the Type_ lookup tables by resolving IDs to their text values before inserting (e.g., BenefitTypeID -> look up in Type_Benefit to get BenefitType text)

### 4D. Add lookup table resolution

Access uses numeric IDs (e.g., `BenefitTypeID = 3`) that map to Type_ tables (e.g., `Type_Benefit` where `BenefitTypeID = 3` means "Health Insurance"). The import wizard will:
- Detect Type_ tables automatically
- Build lookup maps (ID -> text value)
- Resolve foreign key IDs to their text equivalents during import

---

## Part 5: PDF Export Updates

### `src/lib/meeting-pdf-export.ts`
- Add loans and agreements data to the full minutes PDF export
- Add salary/bonus to the officers section

---

## Complete Access Table Mapping Reference

```text
ACCESS TABLE              -> ENTITYIQ TABLE              -> IMPORT TARGET GROUP
Tbl_Clients               -> companies                   -> Company Info
Tbl_Meetings              -> meetings                    -> Meetings
Tbl_Shareholders          -> shareholders                -> Shareholders
Tbl_InitialShares         -> stock_certificates          -> Stock Certificates
Tbl_Directors             -> meeting_directors / directors-> Directors / Mtg Directors
Tbl_InitialDirectors      -> directors                   -> Directors
Tbl_Officers              -> meeting_officers             -> Meeting Officers
Tbl_Benefits              -> meeting_benefits             -> Benefits
Tbl_Transactions          -> share_transactions           -> Share Transactions
Tbl_Amendments            -> meeting_amendments           -> Amendments
Tbl_Resolutions           -> meeting_resolutions          -> Resolutions
Tbl_AuthSignatures        -> meeting_authorized_signers   -> Auth Signers
Tbl_Bank                  -> company_banks                -> Banks
Tbl_AttyFirm              -> attorney_firms               -> Attorney Firms
Tbl_Atty                  -> attorneys                    -> Attorneys
Tbl_AcctFirm              -> accountant_firms             -> Accountant Firms
Tbl_Acct                  -> accountants                  -> Accountants
Tbl_Vehicles              -> company_assets (vehicle)     -> Vehicles
Tbl_Equipment             -> company_assets (equipment)   -> Equipment
Tbl_Leases                -> company_assets (lease)       -> Leases
Tbl_Property              -> company_assets (property)    -> Property
Tbl_Assets                -> meeting_assets               -> Meeting Assets
Tbl_Agreements            -> agreements (NEW)             -> Agreements
Tbl_Loans                 -> meeting_loans (NEW)          -> Loans
Tbl_Timeline              -> (auto-generated timeline)    -> Timeline
Tbl_Shareholder_Mtg       -> meeting_shareholders         -> Meeting Shareholders
X_MeetingxShareholder     -> meeting_shareholders         -> Meeting Shareholders
Tbl_Parties               -> (text fields on transactions)-> (no separate table needed)
Tbl_Users                 -> profiles                     -> (system-managed)
Tbl_Zipcodes / Tbl_States -> (reference only)             -> (not imported)
Type_* tables             -> (used for ID-to-text lookup)  -> (resolved during import)
```

## Files Changed Summary

| File | Action |
|---|---|
| Migration SQL | New tables: `agreements`, `meeting_loans`. Alter: `meeting_officers`, `company_assets` |
| `src/components/meeting/MeetingLoans.tsx` | NEW -- CRUD for loans |
| `src/components/meeting/MeetingAgreements.tsx` | NEW -- CRUD for agreements |
| `src/pages/MeetingDetail.tsx` | ADD tabs, queries, and PDF export for loans + agreements; add salary/bonus to officers |
| `src/components/company/CompanyAssetsSection.tsx` | ADD VIN, purchase/lease date/amount fields to forms and tables |
| `src/pages/ImportAccess.tsx` | MAJOR expansion: all target field groups, auto-mapping keywords, expanded handleImport, lookup table resolution |
| `src/lib/meeting-pdf-export.ts` | ADD loans/agreements/salary+bonus to PDF exports |

