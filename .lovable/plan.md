## Goal
Extract the "State Charitable Registration" section from `TaxExemptionTab.tsx` into a new reusable component `StateCharitableRegistrationCard` with the redesigned layout, plus add a new `pin` field.

## New component
**File:** `src/components/company/StateCharitableRegistrationCard.tsx`

Props:
```ts
{
  values: {
    state_registration_required, registration_number, pin,
    registration_date, expiration_date, annual_renewal_due_date,
    registration_status, registration_certificate_path
  };
  onChange: (patch) => void;      // debounced save from parent
  onUploadFile: (file: File) => Promise<void>;
  onViewFile: (path: string) => void;
}
```

Layout (matches spec):
- **Card container** with header row: title + subtitle on the left, "WDFI Charitable Org Login" outline button (ExternalLink icon) on the right.
- **Row 1** — 3 cols (`grid md:grid-cols-3 gap-4`): State Registration Required (Select, default "Yes"), Credential Number (`e.g. 18871-800`), PIN# (Input with eye-toggle show/hide, `e.g. 4821`).
- **Row 2** — 3 cols: Registration Date, Expiration Date, Annual Renewal Due Date. Each `DatePickerField` gets a small clear (X) button when populated. Annual Renewal Due Date auto-suggests July 31 of the current (or next, if past) year when empty and focused.
- **Row 3** — standalone `max-w-[280px]`: Registration Status Select (Active / Expired / Pending / Not Required) with a colored pill next to the label (green/red/yellow/gray).
- **Row 4** — full width: file input styled as "Choose File" + filename text + right-aligned "View" button (FileText icon), hidden until a file exists. Below: muted line with uploaded filename.

## Styling approach
The spec calls out specific dark hex values (`#1a1f2e`, `#232838`, etc). To keep this consistent with the project design system (semantic tokens, dark-mode ready — a Core memory rule), I'll map those to existing tokens:
- card bg → `bg-card` / border `border-border`
- input bg → default `Input` component (already themed)
- label color → `text-muted-foreground`
- 40px input height / rounded-lg / gap-4 / p-4 / space-y-6 applied via Tailwind utilities.

If you want the literal hex values instead of tokens (breaks light mode), say so and I'll hardcode them.

## Schema change
Add `pin text` column to `nonprofit_tax_exemption` via migration. Update the `Exemption` type + `EMPTY` in `TaxExemptionTab.tsx`.

## Parent wiring
In `TaxExemptionTab.tsx`, replace the current Section 3 (lines ~566–674) with `<StateCharitableRegistrationCard values={form} onChange={save} onUploadFile={f => handleUpload("registration_certificate_path", f)} onViewFile={downloadFile} />`. Add "Not Required" to the status options list.

## Out of scope
Federal Tax Exemption and Annual Federal Filing sections untouched. No changes to PDF generators.