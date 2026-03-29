

# Mask EIN Numbers Across the App

## Overview
Create a utility function to mask EIN values (showing only last 3 digits as `XX-XXXX123`) and apply it to all read-only display contexts while keeping the full EIN editable in form inputs.

## What Changes

### 1. Create EIN masking utility
Add a `maskEin` function to `src/lib/utils.ts`:
- Input: `"12-3456789"` → Output: `"XX-XXXX789"`
- Handles null/empty/short values gracefully

### 2. IncorporationTab (`src/components/company/IncorporationTab.tsx`)
- **PDF export fields** (line ~675): Mask the EIN value passed to `SectionPdfActions`
- **Edit input** (lines 722-735): Keep full EIN visible and editable — no change

### 3. OrganizationTab (`src/components/company/OrganizationTab.tsx`)
- **PDF export fields** (line ~732): Mask the EIN value passed to `SectionPdfActions`
- **Edit input** (lines 784-797): Keep full EIN visible and editable — no change

### 4. TaxReturnUpload (`src/components/TaxReturnUpload.tsx`)
- Line ~543: Mask the EIN in the preview card display

### 5. FilingComplianceTab (`src/components/company/FilingComplianceTab.tsx`)
- Line ~356: Display masked EIN in the read-only filing compliance view (if shown as read-only; keep editable if it's an input)

## Technical Details
- Single `maskEin(ein: string | null | undefined): string` function in `src/lib/utils.ts`
- Returns `"—"` for empty/null, returns as-is if fewer than 3 characters, otherwise replaces all but last 3 chars with `X` while preserving the dash position
- Import and apply in each display-only context listed above

