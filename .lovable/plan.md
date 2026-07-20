
# Certificate Generation via PDF Template Overlay

Add a template-driven certificate pipeline that overlays record data onto static PDF backgrounds using `pdf-lib`. Keeps the existing jsPDF generator as a fallback when no template is present.

## Non-Profit handling (resolved)

Verified in the database: all 3 `Non-Profit` companies have zero rows in `stock_certificates`, `share_transactions`, and `shareholders`. Wisconsin non-profit corporations (Wis. Stat. Ch. 181) do not issue stock, and this app's non-profit workflow uses `directors` / `nonprofit_initial_directors` — not the equity model. Rather than guess a mapping, non-profits are excluded from certificate generation:

- `resolveCertificateKind(entity_type)` returns `"llc"`, `"corporation"`, or `null`.
- Non-Profit → `null`. The "Download Certificate" button does not render on non-profit companies.
- If a non-profit ever legitimately needs membership certificates in the future, we add a `nonprofit` template + field map (two-line addition — that's what the plugin architecture is for) rather than piggybacking on the LLC or Corporation template.

## Scope

- Two static template PDFs bundled in `public/certificate-templates/` (`llc.pdf`, `corporation.pdf`).
- One overlay engine + one field-map file, keyed by kind (`llc` / `corporation`).
- A "Download Certificate" button on each shareholder/member row in `ShareholdersTab.tsx`, only when `resolveCertificateKind(company.entity_type)` is non-null.
- No DB schema changes — every field already exists (`companies.entity_type`, `companies.authorized_shares`, `stock_certificates.par_value`, `share_transactions` for units, `shareholders.ownership_percentage`).

## Files

**New**
- `public/certificate-templates/llc.pdf` — placeholder blank landscape PDF (792×612).
- `public/certificate-templates/corporation.pdf` — placeholder blank landscape PDF.
- `src/lib/certificate-templates.ts` — `CERTIFICATE_TEMPLATES` const:
  ```ts
  {
    llc:         { pdfUrl, fields: { memberName, units, ownershipPct, issueDate, certNumber } },
    corporation: { pdfUrl, fields: { shareholderName, shares, ownershipPct, issueDate, certNumber, authorizedShares, parValue } }
  }
  ```
  Each field: `{ x, y, size, align }` in pdf-lib coordinates (bottom-left, points). Initial values are best-guess centered positions; tuned once real artwork lands.
- `src/lib/certificate-pdf-overlay.ts` — `generateCertificateFromTemplate(kind, data)`: `fetch(pdfUrl)` → `PDFDocument.load` → resolve field map → `page.drawText` per field → return `Uint8Array`. Throws `TemplateNotAvailableError` on 404 so the caller can fall back.

**Modified**
- `src/components/company/ShareholdersTab.tsx` — add a small "Download Certificate" icon button per row (rendered only when `resolveCertificateKind(company.entity_type) !== null`). Handler:
  1. Resolve `kind` from `company.entity_type`.
  2. Assemble data from shareholder row + latest active `stock_certificates` row (for cert number) + company (for authorized shares / par value on corp).
  3. Try `generateCertificateFromTemplate`; on `TemplateNotAvailableError`, fall back to existing `downloadStockCertificatePdf` from `stock-certificate-pdf.ts`.
  4. Download as `Cert_{padded_number}_{SanitizedName}.pdf`.
- `package.json` — add `pdf-lib`.

**Untouched**
- `src/lib/stock-certificate-pdf.ts` — kept as fallback.
- All DB schema, RLS, migrations.

## Entity-type mapping (`resolveCertificateKind`)

| entity_type value                             | kind             |
| --------------------------------------------- | ---------------- |
| `LLC`, `Single Member LLC`, `LLC-S`           | `llc`            |
| `Corporation`, `S Corporation`                | `corporation`    |
| `Non-Profit` (and anything unrecognized)      | `null` (no cert) |

## Testing

- No `Tom Thumb` / `Terry Thumb` records exist yet (verified). After you seed them on an LLC company, click Download Certificate and confirm PDF downloads with the expected filename and overlaid values. Position tuning happens after real artwork is dropped in.
- Verify non-profits show no certificate button.
- Verify fallback works by temporarily renaming `llc.pdf`.

## Out of scope

- Real certificate artwork (drop into `public/certificate-templates/` later; I'll tune coordinates).
- Admin upload UI for templates.
- Non-profit membership certificates (add later if the workflow calls for it).
- Storing rendered PDFs in Supabase Storage.
- Statute citations on the certificate itself.
