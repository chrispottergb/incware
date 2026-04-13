

# Inconsistent Styling Audit — Findings & Fix Plan

## Issues Found

### 1. Page Heading Size Split (HIGH — 5 files)
Two competing patterns exist:
- **Design system standard** (per branding): `font-display text-xl font-bold tracking-tight` — used in Dashboard, Reports, PendingReviews, CompanyDetail, ImportAccess
- **Non-standard**: `text-2xl font-bold text-foreground` — used in Settings, Profile, UserManagement, ResourcesAdmin, ErrorBoundary

**Fix**: Normalize all 5 non-standard files to `font-display text-xl font-bold tracking-tight`.

### 2. Page Subtitle Size Split (4 files)
- Standard: `text-xs text-muted-foreground mt-0.5`
- Non-standard: `text-sm text-muted-foreground` (Settings, Profile, UserManagement, ResourcesAdmin)

**Fix**: Normalize to `text-xs`.

### 3. Hardcoded Light-Mode Badge Colors on Dark Theme (HIGH — 5 files)
`bg-amber-50`, `bg-blue-50`, `bg-red-50`, `bg-green-50`, `bg-yellow-50` render as near-white backgrounds on the dark theme. These appear in:
- `PendingReviews.tsx` (6 instances)
- `BuySellWorkflow.tsx` (2 instances)
- `StockLedgerTab.tsx` (2 instances)
- `MeetingOfficersTable.tsx` (3 instances — alert + row highlight + info box)
- `MeetingInfoCard.tsx` (1 instance)

**Fix**: Replace with dark-compatible opacity variants: `bg-amber-500/10 text-amber-500`, `bg-blue-500/10 text-blue-400`, `bg-red-500/10 text-red-400`, `bg-green-500/10 text-green-400`. This matches the pattern already used correctly in `FilingComplianceTab.tsx`.

### 4. Hardcoded Colors Outside Design System Tokens (3 files)
- `text-yellow-600` in Dashboard → should be `text-warning`
- `text-green-500` / `text-green-600` in AnnualReviewPublic, ResetPassword → should be `text-success`

**Fix**: Replace with semantic tokens.

### 5. Page Wrapper Padding Inconsistency (2 files)
- Standard: `mx-auto max-w-5xl space-y-6 p-4 md:p-8`
- `ResourcesAdmin.tsx`: `space-y-6` only (no padding, no max-width)
- `NotFound.tsx`: oversized text (`text-4xl`, `text-xl`)

**Fix**: Add standard wrapper to ResourcesAdmin, downsize NotFound heading.

---

## Implementation

### Files to modify (12 total)

**Heading + subtitle normalization (5 files):**
- `Settings.tsx` — h1 `text-2xl` → `text-xl`, subtitle `text-sm` → `text-xs`
- `Profile.tsx` — same
- `UserManagement.tsx` — same
- `ResourcesAdmin.tsx` — same + add wrapper padding
- `ErrorBoundary.tsx` — `text-2xl` → `text-xl`

**Badge dark-mode fix (5 files):**
- `PendingReviews.tsx` — all `bg-*-50 text-*-600/700/800` → `bg-*-500/10 text-*-400/500`
- `BuySellWorkflow.tsx` — yellow/green badges
- `StockLedgerTab.tsx` — yellow/green badges
- `MeetingOfficersTable.tsx` — amber alert, blue highlight, slate badges
- `MeetingInfoCard.tsx` — amber alert

**Semantic color tokens (3 files):**
- `Dashboard.tsx` — `text-yellow-600` → `text-warning`
- `AnnualReviewPublic.tsx` — `text-green-500` → `text-success`
- `ResetPassword.tsx` — `text-green-600` → `text-success`

**Misc:**
- `NotFound.tsx` — `text-4xl` → `text-2xl`, `text-xl` → `text-base`

No database changes. No new files.

