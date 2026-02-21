
## Add "Single Member LLC" to Entity Type Selection

### Overview

Add "Single Member LLC" as a new option in the entity type dropdown. Since a Single Member LLC follows the same Wisconsin LLC statutes (Ch. 183), it will inherit all LLC behavior throughout the app -- same terminology ("Members", "Units", "Operating Agreement"), same officer titles, same resolution types, and same compliance checklist logic.

### Changes

#### 1. Add to Entity Type Arrays (2 files)
- `src/pages/Dashboard.tsx` line 43 -- add "Single Member LLC" to `ENTITY_TYPES` array
- `src/components/company/IncorporationTab.tsx` line 58 -- add "Single Member LLC" to `ENTITY_TYPES` array

#### 2. Update Entity Terminology (1 file)
- `src/lib/entity-terminology.ts` -- update `getTerminology()` so that `entity_type === "Single Member LLC"` returns the same LLC terminology (already handles this via the `isLLC` check, just need to expand the condition to `entityType === "LLC" || entityType === "Single Member LLC"`)

#### 3. Update All LLC Conditional Checks (~6 files)
Every place that checks `entity_type === "LLC"` needs to also match `"Single Member LLC"`. Files affected:
- `src/pages/CompanyDetail.tsx` -- tab visibility (Operating Agreement, etc.)
- `src/components/company/OrganizationTab.tsx` -- officer labels and statutes
- `src/components/company/OperatingAgreementGenerator.tsx` -- LLC guard check
- `src/components/company/BylawsGenerator.tsx` -- LLC exclusion check
- `src/components/company/WIComplianceChecklist.tsx` -- LLC compliance logic
- `src/components/AppLayout.tsx` -- sidebar badge abbreviation

#### 4. Update Officer Title Options (1 file)
- `src/components/company/OrganizationTab.tsx` -- add a `"Single Member LLC"` key to `OFFICER_TITLE_OPTIONS` (same values as LLC)

#### 5. Update Resolution Types (1 file)
- `src/components/meeting/MeetingResolutions.tsx` -- add `"Single Member LLC"` key to `RESOLUTION_TYPES` (same values as LLC) or adjust lookup logic to fall back to LLC

### Approach
To keep it DRY, I will create a small helper function `isLLCType(entityType)` that returns `true` for both `"LLC"` and `"Single Member LLC"`, then use it across all files instead of updating every individual comparison.
