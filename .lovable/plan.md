

# AI-Generated Digital Corporate Record Book

## Overview
Build a one-click "Generate Corporate Record Book" feature that uses AI (Lovable AI Gateway) to compile all of a company's data into a beautifully formatted, comprehensive digital corporate record book PDF. The record book will be structured for official use and shareable with the IRS, state departments of revenue, and the Wisconsin DFI.

## What It Does
- Pulls all company data (incorporation, officers, directors, shareholders/members, meetings, stock/membership certificates, financials, compliance, AI compliance, timeline) into a single, professionally formatted PDF document
- Uses AI to generate a polished executive summary, narrative descriptions, and compliance commentary
- Includes a Table of Contents, section dividers, and official formatting suitable for government submission
- Stores the generated PDF in the existing `generated-documents` storage bucket
- Provides a shareable link for one-click sharing with IRS, state departments, or other parties

## Architecture

### 1. New Edge Function: `generate-record-book`
- Accepts a `company_id` parameter
- Fetches ALL company-related data from the database (companies, officers, directors, shareholders, stock certificates, share transactions, meetings + all sub-tables, bills of sale, business sales, AI systems, timeline events, document registry)
- Calls Lovable AI (google/gemini-3-flash-preview) to generate:
  - An executive summary of the company's corporate standing
  - A compliance narrative based on Wisconsin statutes (Ch. 180 for Corps, Ch. 183 for LLCs)
  - Section introductions and any flagged concerns
- Returns the structured AI content as JSON to the frontend

### 2. New PDF Generator: `src/lib/record-book-pdf.ts`
- Builds a multi-section PDF using jsPDF + jspdf-autotable (existing dependencies)
- Sections include:
  1. **Cover Page** -- Company name, entity type, state, EIN placeholder, generation date, "CORPORATE RECORD BOOK" title
  2. **Table of Contents** -- Auto-generated with page numbers
  3. **Executive Summary** -- AI-generated narrative of the company's status
  4. **Articles of Incorporation / Organization** -- Key incorporation data
  5. **Officers & Directors / Managers & Members** -- Dynamic based on entity type
  6. **Shareholders / Members Registry** -- Full list with addresses, shares/units
  7. **Stock Certificates / Membership Interest Certificates** -- All certificates with status
  8. **Stock Ledger / Interest Ledger** -- Full transaction history
  9. **Meeting Minutes** -- All meetings with resolutions, financials, attendees
  10. **Bills of Sale / Interest Transfers** -- All sales records
  11. **Business Sales** -- Asset/stock sales history
  12. **Compliance Checklist** -- Wisconsin statute compliance status (reuses existing logic)
  13. **AI Compliance (EU AI Act)** -- If applicable, AI systems registry and oversight
  14. **Corporate Timeline** -- Chronological event history
  15. **Appendix: Document Registry** -- List of all filed documents

### 3. New UI Component: `src/components/company/RecordBookGenerator.tsx`
- Button on the CompanyDetail page (new "Record Book" tab or prominent button in header)
- Shows a progress indicator while generating
- Previews the PDF in-browser and offers download
- "Share" button that generates a time-limited shareable URL from the storage bucket

### 4. Shareable Link Feature
- Uploads the generated PDF to the `generated-documents` Supabase storage bucket
- Creates a signed URL (e.g., 30-day expiry) for sharing
- Copy-to-clipboard functionality for easy sharing with IRS/state departments
- Records the generation in the `document_registry` table for audit trail

## Technical Details

### Edge Function (`supabase/functions/generate-record-book/index.ts`)
- Authenticates the request using the user's JWT
- Uses `SUPABASE_SERVICE_ROLE_KEY` to fetch all company data
- Calls Lovable AI Gateway with a structured prompt asking for executive summary and compliance narrative
- Handles 429/402 rate limit errors gracefully
- Returns JSON with AI-generated text sections

### PDF Structure (using existing jsPDF patterns)
- Reuses `addDFIHeader` / `addDFIFooter` styling from `meeting-pdf-export.ts`
- Professional formatting: Wisconsin DFI-style headers, section dividers, page numbers
- Entity-type-aware labels (Shareholders vs Members, Shares vs Units, etc.)
- Color-coded compliance status indicators

### Database Changes
- No new tables needed; uses existing `document_registry` to log generated record books
- The PDF file is stored in the existing `generated-documents` bucket (not in the database)

### CompanyDetail Integration
- Add a "Record Book" tab or a prominent "Generate Record Book" button in the company header
- New route not needed; stays within the existing CompanyDetail page

### Config Updates
- Update `supabase/config.toml` to register the new edge function with `verify_jwt = true`

### Files to Create
- `supabase/functions/generate-record-book/index.ts` -- Edge function for AI content generation
- `src/lib/record-book-pdf.ts` -- PDF generation logic
- `src/components/company/RecordBookGenerator.tsx` -- UI component

### Files to Modify
- `src/pages/CompanyDetail.tsx` -- Add Record Book tab/button
- `supabase/config.toml` -- Register edge function

