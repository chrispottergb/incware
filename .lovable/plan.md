

# Remove Title & Bar Number from Attorney Form, Add Scope of Engagement

## Changes to `src/components/company/CounselTab.tsx` (AttorneySection)

### 1. Form state (line ~167)
Remove `title` and `bar_number` from `contactForm` initial state. Add/keep `specialty` (which maps to "Scope of Engagement").

### 2. Form dialog (lines ~446-451)
- Remove the Title field and Bar Number field
- Replace with a full-width "Scope of Engagement" combobox (same `ScopeOfEngagementCombobox` pattern used in the Accountant section, but with legal services list)
- Legal services list: Corporate Law, Real Estate, Litigation, Estate Planning & Trusts, Tax Law, Employment & Labor Law, Intellectual Property, Mergers & Acquisitions, Bankruptcy & Restructuring, Securities & Capital Markets, Immigration, Environmental Law, Healthcare Law, Government Relations, Contract Drafting & Review, Regulatory Compliance, Business Formation, Commercial Transactions

### 3. Table headers & cells (lines ~339, 344-346, 379-381)
- Remove "Title" and "Bar #" columns
- Add "Scope of Engagement" column showing `a.specialty`

### 4. Select dropdown display (line ~329)
- Remove `a.title` from the attorney select display, show specialty instead

### 5. Master directory sync (line ~245)
- Remove `title` and `bar_number` from the `upsertMasterContact` call

### 6. Edit/open helpers (lines ~260-261)
- Remove `title` and `bar_number` from form reset objects

### 7. Create a `LegalScopeCombobox` component
Reuse the same pattern as `ScopeOfEngagementCombobox` but with legal-specific services. Can be a sibling component in the same file.

