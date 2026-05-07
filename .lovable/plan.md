## Problem

The Unified Membership Ledger PDF (and every other section PDF generated via `generateSectionPdf`) prints **"EntityIQ"** as the large header brand, with **"Corporate Records Management"** as a subline. The actual company name is buried in a small grey subtitle next to the statute reference. So the document reads as an EntityIQ-branded page rather than a record of the company.

## Fix

In `src/lib/section-pdf.ts`, change `addHeader` so the **company name** is the primary header line, not the hardcoded `BRAND` constant.

### Specific changes (`src/lib/section-pdf.ts`)

1. Update `generateSectionPdf` to pass `config.companyName` into `addHeader` and stop concatenating it into the grey subtitle.
2. Update `addHeader(doc, title, companyName, statuteRef, landscape)`:
   - Big bold line (18pt, dark): **company name** (fallback to `BRAND` only if empty).
   - Small grey subline (8pt): `BRAND_SUB` ("Corporate Records Management") — keeps the EntityIQ attribution subtle.
   - Title line (14pt bold): the section title (e.g. "Unified Membership Ledger").
   - Subtitle line (9pt grey): just the `statuteRef` (e.g. "Unified ledger — Wis. Stat. Ch. 183 …").
3. Keep the footer `${BRAND} — Confidential` unchanged (small attribution at the bottom).

No callers need to change — every existing `SectionPdfActions` / `downloadSectionPdf` / `printSectionPdf` invocation already passes `companyName`.

## Verification

- Open a company → Unified Membership Ledger → Print/Preview. Confirm the top of the PDF shows the company name large, with the section title and statute reference below it.
- Spot-check one or two other section PDFs (e.g. Stock Ledger, Officers) to confirm the header reads consistently.
