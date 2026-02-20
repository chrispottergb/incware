

## Fix "Initial List of Directors" -- Clean Up Duplicates and Improve the Section

### Problem Identified

After investigating, the "Initial List of Directors" section is correctly querying only this company's directors (not other companies). However, the Access DB import process created **1,008 director rows** for only **134 unique names** -- massive duplication. This is why the section appears to be pulling "every director ever entered across all meetings." The import likely inserted a director row for every meeting-director combination instead of deduplicating.

### Changes

#### 1. Clean Up Existing Duplicate Data

Run a database migration that removes duplicate director entries, keeping only one row per unique name per company. This will reduce the 1,008 rows down to 134 unique directors for this company.

#### 2. Add Duplicate Prevention

Add a unique constraint or application-level check so the same director name cannot be added twice to the same company, preventing this from happening again.

#### 3. Fix the Import Process

Review the Access DB import code (`src/pages/ImportAccess.tsx`) to ensure it deduplicates directors during import -- only inserting a director if one with the same name doesn't already exist for that company.

### Technical Details

**Database migration:**
- DELETE duplicate rows from `directors`, keeping the earliest `created_at` entry per (company_id, name) pair
- Add a unique index on `(company_id, lower(name))` to prevent future duplicates

**Files to modify:**
- `src/pages/ImportAccess.tsx` -- Add deduplication logic during import so directors aren't inserted multiple times
- `src/components/company/OrganizationTab.tsx` -- Add a check before inserting a new director to warn if one with the same name already exists for this company

