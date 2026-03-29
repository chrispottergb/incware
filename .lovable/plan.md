

# Unmask EIN in PDF Exports, Keep Masked on Screen

## Overview
The EIN masking was applied to both on-screen display and PDF export fields. The user wants full EINs visible in generated PDFs but masked on screen to prevent exposure in AI training data.

## What Changes

### 1. IncorporationTab (`src/components/company/IncorporationTab.tsx`)
- **Line 675**: Change `maskEin((form as any).ein)` back to `(form as any).ein || ""` so the PDF export shows the full EIN
- The edit input already shows the full EIN — no change needed there
- Add masking to any **on-screen read-only display** of the EIN (the label text shown in the UI, not the PDF fields)

### 2. OrganizationTab (`src/components/company/OrganizationTab.tsx`)
- **Line 733**: Change `maskEin((filingForm as any).ein)` back to `(filingForm as any).ein || ""` so the PDF export shows the full EIN
- Same approach: mask only the on-screen display label, not the PDF data

### 3. TaxReturnUpload (`src/components/TaxReturnUpload.tsx`)
- **Line 544**: Keep `maskEin` here — this is an on-screen preview card, not a PDF

### Summary
- **PDFs**: Full EIN (unmasked) — 2 lines reverted in IncorporationTab and OrganizationTab
- **Screen displays**: Masked EIN — TaxReturnUpload stays as-is, and any other on-screen read-only labels continue using `maskEin`

## Technical Details
Two single-line changes reverting `maskEin(...)` to the raw value in the `SectionPdfActions` config objects.

