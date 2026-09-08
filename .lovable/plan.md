# Engagement Letter Generator (additive)

## Step 0 findings (verified)

1. **Firm-level settings already exist**: `master_firms` holds `firm_name, firm_type, address, address_2, city, state, zip, phone, email, website, contact_name, contact_title` (plus encrypted bank fields). This will be extended, not replaced. Only one new column is needed: `default_fee_terms` (text, nullable).
2. **Companies table** already has every field the letter needs: `name, address, address_2, city, state, zip, contact_full_name, salutation_name`. Nothing missing.
3. **Documents tab pattern**: `DocumentsTab.tsx` does **not** use `document_registry`. It uploads the file to the `company-documents` storage bucket and inserts a row into `company_documents` (with a `category` field), then invalidates the `["company_documents", companyId]` query. The engagement letter will follow that existing pattern (category "administrative"), not `document_registry`, so it appears in the same list the tab already shows.

## What gets built

**1. Letter wording file** — `src/lib/engagement-letter-template.ts`
Holds all prose exactly as supplied, as named sections, plus `VERSION = "v1-2026-09"`. Sections in order: Services We Will Provide, Not a Law Firm, Services We Will Not Provide, Your Responsibilities, Attorney Review Recommended, Fees, Your Records, Confidentiality, Term and Termination, Entire Agreement. The Limitation of Liability section from the draft is omitted as instructed, and the remaining sections renumber so Entire Agreement is 10.

**2. PDF generator** — `src/lib/engagement-letter-pdf.ts`
jsPDF, Arial, 1.15 line height, exported through the existing save path. Layout: firm letterhead, date, client address block, "Re:" line, salutation (salutation name, then contact name, then "Sir or Madam"), the ten numbered sections, firm signature block, and the client acceptance block with By / Name / Title / Date lines. Missing contact or address prints a blank ruled line — never "null" or a dash.

**3. Firm Information card** in Settings
Reads and saves the firm record: name, address, second address line, city, state, ZIP, phone, email, signer name and title, and default fee terms. Entered once for the firm, not per client.

**4. "Generate Engagement Letter" button** on the Documents tab
Opens a small dialog pre-filled with the default services list and default fee terms, both editable for that client. Generates the PDF and saves it into the company's documents list under category "administrative". If the client is missing a contact name or address, an inline warning names the missing fields and links to the Incorporation/Organization tab, but generation is still allowed.

**5. Status field** — migration adding nullable `engagement_letter_on_file` (date) to `companies`. Additive only: no constraints, no defaults, no policy changes. It is set when a signed copy is uploaded back into Documents, not when a draft is generated.

**6. Dashboard column** — pending your answer below.

## One decision needed

The Client Companies table already scrolls sideways at 7 columns with a sticky first column. Adding an 8th makes that worse. Recommendation: drop **Inc. Date** and add **Engagement Letter** (date, or a muted "Not on file" badge), keeping the same width. Alternatives: keep all 7 and accept more scrolling, or skip the dashboard column entirely and show the status only on the company page.

Approving this plan as written means: drop Inc. Date, add Engagement Letter. Tell me otherwise and I'll adjust.

## Technical notes

- Files added: 2. Files modified: `Settings.tsx`, `DocumentsTab.tsx`, `Dashboard.tsx`, generated `types.ts`. One migration adding `companies.engagement_letter_on_file` and `master_firms.default_fee_terms`.
- Not touched: `CreateCompanyWizard.tsx`, any existing PDF generator, `pdf-save.ts`.
