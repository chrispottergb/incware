

# Expand Meeting Benefits Form

## Problem
The current `meeting_benefits` table only stores a single `benefit_description` column. The legacy Access application has a detailed benefits form with fields for benefit type, provider, agent, insurance agency, transaction details, plan year, effective date, contribution amount, and eligibility comments.

## Database Changes

Add new columns to the `meeting_benefits` table:

| Column | Type | Notes |
|---|---|---|
| benefit_type | text | e.g., "401(k) Profit Sharing Plan", "Health Insurance", "Dental", etc. |
| provider | text | Insurance/plan provider name |
| agent_administrator | text | Agent or administrator name |
| insurance_agency | text | Insurance agency name |
| transaction_type | text | Type of transaction |
| plan_year | integer | Plan year (e.g., 2024) |
| new_plan_effective_date | date | When new plan takes effect |
| retirement_contribution | numeric | Contribution amount |
| eligibility_comments | text | Eligibility criteria and comments |

The existing `benefit_description` column will be kept for backward compatibility but the new fields will be the primary data entry method.

## UI Changes

### File: `src/pages/MeetingDetail.tsx`

Replace the simple single-column `MeetingSubTable` for Benefits with a dedicated `MeetingBenefits` component that renders a richer form matching the legacy layout.

### New File: `src/components/meeting/MeetingBenefits.tsx`

Create a dedicated component with:
- A table listing existing benefits showing: Benefit Type, Provider, Agent/Administrator, Insurance Agency
- Expandable rows or an inline detail area showing: Transaction type, Plan Year, New Plan Effective Date, Retirement Contribution, Eligibility/Comments
- Add/Edit/Delete functionality using the same patterns as `MeetingAmendments` or `MeetingResolutions`
- Benefit Type as a dropdown with common options: 401(k), Profit Sharing Plan, Health Insurance, Dental Insurance, Vision Insurance, Life Insurance, Disability Insurance, Other
- Print support via the existing `PrintPreviewButton` pattern

### PDF Export Update

Update the benefits section PDF export in `MeetingDetail.tsx` to include the new fields in the printed output.

## Technical Details

### Migration SQL

```sql
ALTER TABLE meeting_benefits
  ADD COLUMN IF NOT EXISTS benefit_type text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS agent_administrator text,
  ADD COLUMN IF NOT EXISTS insurance_agency text,
  ADD COLUMN IF NOT EXISTS transaction_type text,
  ADD COLUMN IF NOT EXISTS plan_year integer,
  ADD COLUMN IF NOT EXISTS new_plan_effective_date date,
  ADD COLUMN IF NOT EXISTS retirement_contribution numeric,
  ADD COLUMN IF NOT EXISTS eligibility_comments text;
```

No new RLS policies needed -- existing `meeting_benefits` policies already cover all operations via the meeting -> company -> user chain.

### Component Pattern

The new `MeetingBenefits` component will follow the same pattern as `MeetingAmendments`:
- Dialog-based add/edit form
- Inline delete with confirmation
- `useQuery` for fetching, `useMutation` for CRUD
- React Query cache invalidation on mutations

### Files Modified
1. **Migration** -- add columns to `meeting_benefits`
2. **New**: `src/components/meeting/MeetingBenefits.tsx` -- dedicated benefits CRUD component
3. **Edit**: `src/pages/MeetingDetail.tsx` -- swap `MeetingSubTable` for the new `MeetingBenefits` component, update PDF export columns

