

## Whimsical-Professional LLC Membership Unit Certificate (refined)

Add a new certificate layout for LLC entity types (LLC, SMLLC, LLC-S). Corporations keep the existing eagle/brick-red design unchanged.

### Locked decisions
- **Applies to**: LLC entity types only — `isLLCType(entity_type) === true`. Per terminology helper, this covers `LLC`, `Single Member LLC` (SMLLC), `LLC-S`, and any future LLC-derived types.
- **Branding**: Defaults only — navy `#1F4E79` (primary) and steel-blue `#D6E4F0` (secondary). No logo, no DB-stored brand fields.
- **Style**: Geometric art-deco border (thin double border + small filled diamond corner flourishes in the primary color).
- **Ownership %**: Snapshot at issuance, with live fallback for legacy rows.

### Database change

Add one nullable column on `stock_certificates`:
- `ownership_percent_snapshot numeric(7,4)`
- Column comment: `"Ownership % at time of issuance; null = legacy, use live calc."`

No backfill. Legacy LLC certificates without a snapshot fall back to live calculation at render.

### Snapshot capture

When a certificate is issued for an LLC entity (paths in `execute-share-transfer`, `execute-batch-transfer`, `UnifiedLedgerTab`, and `EstablishOwnershipDialog`), compute the holder's post-transaction ownership % using the same logic as `recalculate_ownership_percentages` and write it to `ownership_percent_snapshot`. Corporation issuances ignore this field.

### PDF generator changes — `src/lib/stock-certificate-pdf.ts`

1. Extend `StockCertificateData`:
   - `ownershipPercentSnapshot?: number | null` — saved at issuance.
   - `liveOwnershipPercent?: number | null` — passed in by caller as fallback.
2. Branch at the top of `generateStockCertificatePdf`:
   - If `data.isLLC`, call new `renderLLCWhimsicalCertificate(doc, data)`.
   - Otherwise keep current corporation rendering path (unchanged).
3. Inside `renderLLCWhimsicalCertificate`, resolve the percentage with:
   ```ts
   // Snapshot preferred; legacy certificates fall back to live calculation.
   const ownershipPercent = data.ownershipPercentSnapshot ?? data.liveOwnershipPercent ?? null;
   ```
4. Body line composition:
   - Build state phrase:
     - WI → `"a Wisconsin limited liability company"`
     - Other state → `"a {state} limited liability company"`
     - Missing/null state → `"a limited liability company"` (omit state adjective)
   - Body: `"representing a {ownershipPercent}% ownership interest in {entity}, {statePhrase}."`
   - If `ownershipPercent` is null, omit the "representing a X% ownership interest in" clause and render `"a holder of {units} Membership Units in {entity}, {statePhrase}."`
5. Layout (landscape, Arial, 11pt body, line-height 1.15):
   - **Border**: thin double-line border in navy `#1F4E79` (outer ~1.2pt, inner ~0.4pt, ~4mm gap), small filled diamonds at the four corners.
   - **Header (centered)**: entity legal name 18pt bold; `MEMBERSHIP UNIT CERTIFICATE` 12pt tracked caps; thin secondary-color rule.
   - **Side boxes**: small "CERTIFICATE NO." (left) and "UNITS" (right) near top corners.
   - **Body (centered)**: "This certifies that:" → member name 14pt bold underlined → "is the record holder of" → `{units} Membership Units` 13pt bold → ownership/state line → "Issued on {issueDate}".
   - **Signatures**: left "Authorized Signatory / {Entity}", right "Member Acknowledgment / {Member}".
   - **Footer**: muted gray "Prepared using EntityIQ Corporate Records Management".

### Call-site changes
- `StockCertificatesTab.tsx`, `UnifiedLedgerTab.tsx`, and any other LLC-side caller pass both:
  - `ownershipPercentSnapshot` from the certificate row,
  - `liveOwnershipPercent` from the same live calc already used in the ledger (fallback).
- Issuance flows write `ownership_percent_snapshot` only when `isLLCType(company.entity_type)`.

### Out of scope
- No changes to corporation certificates.
- No brand picker, no logo upload, no schema for brand colors.
- No retroactive snapshot backfill.
- No changes to `recalculate_ownership_percentages` or ledger logic.

