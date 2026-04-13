

# Missing Loading, Empty, and Error States

## Summary

Audit of all components using `useQuery` reveals a consistent pattern: **no component in the entire codebase handles query errors**. Additionally, 13 components with data queries have **no loading state**. Empty states are handled well in most components.

## Findings

### A. Zero Error State Handling (CRITICAL — App-Wide)
**Not a single component** destructures `isError` or `error` from `useQuery`. If a database query fails (network issue, RLS denial, timeout), the user sees either:
- An empty list with no explanation (if `data` defaults to `[]`)
- A blank screen (if `data` defaults to `undefined`)

Mutations have `onError` toast handlers ✓ — but **read queries silently fail**.

**Fix:** Add a reusable `QueryErrorBanner` component, then wire `isError`/`error` into every data-fetching component.

### B. Components Missing Loading States (13 files)

| Component | Queries without loading indicator |
|---|---|
| `CompanyAssetsSection.tsx` | `company_assets` |
| `RelationshipsTab.tsx` | `company_relationships` (×2), `companies` |
| `TimelineTab.tsx` | 7 queries (meetings, certificates, transactions, etc.) |
| `CounselTab.tsx` — `AttorneySection` | `attorney_firms`, `attorneys` |
| `CounselTab.tsx` — `AccountantSection` | `accountant_firms`, `accountants` |
| `ConflictOfInterestGenerator.tsx` | `directors`, `officers` |
| `NonprofitBylawsGenerator.tsx` | `directors`, `officers` |
| `BylawsGenerator.tsx` | `directors`, `officers` |
| `SMOperatingAgreementGenerator.tsx` | `shareholders`, `doc-versions` |
| `OperatingAgreementGenerator.tsx` | `shareholders`, `doc-versions` |
| `RecordBookGenerator.tsx` | multiple queries |
| `IncorporationTab.tsx` — organizers/directors sections | `organizers`, `directors` |
| `Reports.tsx` — company selector | `companies` (loads silently) |

### C. Components With Good States (no changes needed)
Dashboard, OrgChart, MeetingsTab, DocumentsTab, ShareholdersTab, StockCertificatesTab, StockLedgerTab, BillsOfSaleTab, BusinessSalesTab, TransferLedgerTab, UnifiedLedgerTab, all AI compliance sub-tabs, FilingComplianceTab, Settings, Profile, PendingReviews — all have loading spinners and empty states.

---

## Implementation Plan

### Step 1: Create `QueryErrorBanner` component
**New file:** `src/components/ui/query-error-banner.tsx`

A small inline alert showing "Failed to load [section]. Try refreshing." with a retry button that calls `refetch()`. Uses the existing `Alert` component with `variant="destructive"`.

### Step 2: Add error states to high-traffic pages (8 files)
Add `isError, error, refetch` destructuring and render `QueryErrorBanner` when `isError` is true:
- `src/pages/Dashboard.tsx`
- `src/pages/CompanyDetail.tsx`
- `src/pages/OrgChart.tsx`
- `src/pages/Reports.tsx`
- `src/pages/PendingReviews.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Profile.tsx`
- `src/pages/MeetingDetail.tsx`

### Step 3: Add error states to company tab components (10 files)
- `CompanyAssetsSection.tsx`
- `RelationshipsTab.tsx`
- `TimelineTab.tsx`
- `CounselTab.tsx` (both sections)
- `BanksTab.tsx`
- `LeasesTab.tsx`
- `DocumentsTab.tsx`
- `MeetingsTab.tsx`
- `ShareholdersTab.tsx`
- `BusinessSalesTab.tsx`

### Step 4: Add loading states to the 13 components listed in Section B
Add `isLoading` destructuring and a spinner/skeleton before the content renders. Pattern: a centered `Loader2` spinner matching the existing app convention.

### Step 5: Add error states to generator components (5 files)
- `BylawsGenerator.tsx`
- `NonprofitBylawsGenerator.tsx`
- `ConflictOfInterestGenerator.tsx`
- `SMOperatingAgreementGenerator.tsx`
- `OperatingAgreementGenerator.tsx`

---

### Scope
- 1 new file (`query-error-banner.tsx`)
- ~25 files updated with error/loading states
- No database changes
- No changes to mutations (already have toast error handling)

