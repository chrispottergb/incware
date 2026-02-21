

## Change SIC Code to NAICS Code with Website Link

### What's changing
- Every reference to "SIC Code" throughout the app will be renamed to "NAICS Code"
- The database column `sic_code` will be renamed to `naics_code`
- A clickable link to the NAICS website (https://www.naics.com) will be added next to the field label

### Files to update

**1. Database migration**
- Rename column `sic_code` to `naics_code` on the `companies` table

**2. `src/components/company/OrganizationTab.tsx`**
- Change label from "SIC Code" to "NAICS Code"
- Change all `sic_code` references in state/form to `naics_code`
- Add a clickable link icon or text link to https://www.naics.com next to the label

**3. `src/components/TaxReturnUpload.tsx`**
- Rename `sic_code` property references to `naics_code` in the type definition and all usage

**4. `src/pages/ImportAccess.tsx`**
- Update label from "SIC Code" to "NAICS Code"
- Update field mapping keys from `sic_code`/`sic` to `naics_code`/`naics`

**5. `supabase/functions/parse-tax-return/index.ts`**
- Update the AI prompt schema and field references from `sic_code` to `naics_code`

### Technical details
- A SQL migration will rename the column: `ALTER TABLE companies RENAME COLUMN sic_code TO naics_code;`
- The NAICS link will use an `ExternalLink` icon from lucide-react, opening in a new tab
- The types file (`src/integrations/supabase/types.ts`) will auto-regenerate after the migration
