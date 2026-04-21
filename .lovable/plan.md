

## Move "Download IRS Fax Cover Sheet" link to Filing & Compliance Checklist

Relocate the existing helper link from the Organizational Info S-election area into the IRS Form 2553 row of the Filing & Compliance Checklist. Behavior, styling, and PDF generator stay exactly as they are today.

### Changes

**1. `src/components/company/OrganizationTab.tsx`**
- Remove the `<button>` (lines ~1093–1108) that triggers `generateIRSFaxCoverSheet` from under the "Is this LLC electing S Corporation tax status?" checkbox.
- Remove the now-unused `generateIRSFaxCoverSheet` import if no other reference remains in the file.

**2. `src/components/company/FilingComplianceTab.tsx`**
- Import `generateIRSFaxCoverSheet` from `@/lib/irs-fax-cover-pdf`.
- Accept the company record (or relevant fields: `name`, `ein`, `contact_full_name`, `contact_phone`, `contact_email`) as a prop so the PDF can be pre-filled. Update the parent (`CompanyDetail.tsx` or wherever `FilingComplianceTab` is rendered) to pass these.
- Inside the checklist row's Row 2 (`pl-7` flex), when `item.item_name` matches IRS Form 2553 (case-insensitive `.includes("2553")`), render the same small muted link/button next to the existing "File Online" action:

  ```tsx
  {item.item_name.toLowerCase().includes("2553") && (
    <button
      type="button"
      onClick={() => generateIRSFaxCoverSheet({
        companyName: company?.name,
        ein: company?.ein || undefined,
        contactName: company?.contact_full_name || undefined,
        contactPhone: company?.contact_phone || undefined,
        contactEmail: company?.contact_email || undefined,
      })}
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
    >
      <span>📄</span>
      <span className="underline">Download IRS Fax Cover Sheet (Form 2553)</span>
    </button>
  )}
  ```

### Out of scope
- No changes to the PDF generator (`src/lib/irs-fax-cover-pdf.ts`).
- No changes to the duplicate link already present in `IncorporationTab.tsx` (untouched per "do not change anything except the placement").
- No database or styling changes elsewhere.

