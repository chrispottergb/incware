

# Standardize LLC Transaction Entry

## Changes

### 1. `src/pages/CompanyDetail.tsx` (line 308-310)
Add `<StockLedgerTab>` before `<UnifiedLedgerTab>` in the LLC branch:
```tsx
{isLLCType(company.entity_type) ? (
  <>
    <StockLedgerTab companyId={company.id} entityType={company.entity_type} />
    <UnifiedLedgerTab companyId={company.id} entityType={company.entity_type} authorizedShares={shareCalc.authorizedShares} />
    <div data-section="certificates">
      <StockCertificatesTab companyId={company.id} entityType={company.entity_type} />
    </div>
    <BillsOfSaleTab companyId={company.id} entityType={company.entity_type} />
  </>
)}
```

### 2. `src/components/company/UnifiedLedgerTab.tsx` — Make read-only

**Remove** (lines/blocks):
- `LLC_TRANSACTION_TYPES` constant (lines 44-56)
- `CONSIDERATION_TYPES` constant (lines 58-64)
- `dialog` state (line 99)
- `shareholders` query (lines 101-109)
- `form` state (lines 146-160)
- `assets` state (line 162)
- `getNextCertNumber` function (lines 164-172)
- `createCertificate` function (lines 174-186)
- `ISSUANCE_SET_LOCAL`, `TRANSFER_SET_LOCAL` constants (lines 188-194)
- `add` mutation (lines 196-253)
- `resetForm` function (lines 255-264)
- `isTransfer`, `showAssetGrid`, `assetTotal` computed values (lines 266-268)
- Entire `<Dialog>` block including Record Transaction button (lines 475-593)

**Remove unused imports** after above deletions:
- `useState` (no longer needed — no state left)
- `useMutation` from react-query
- `Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger`
- `Input`, `Label`, `Textarea`, `Select, SelectContent, SelectItem, SelectTrigger, SelectValue`
- `DatePickerField`
- `Plus, Loader2, Trash2`

**Keep intact**:
- All query hooks: `company`, `certificates`, `transactions`
- Entry building logic (lines 270-398)
- `handlePrintCertificate`, `handlePrintBillOfSale`
- Table rendering, PDF actions, permanent record footer
- `ISSUANCE_TYPES`, `REDUCTION_TYPES`, `TRANSFER_TYPES` constants (used by entry builder)
- `ScrollText, Lock, FileText, Award, Link2` icons
- `Badge`, `Button`, `Table` components, `SectionPdfActions`, `getTerminology`
- `toast`, `downloadStockCertificatePdf`, `downloadBillOfSalePdf`

### 3. `StockLedgerTab.tsx` — No changes needed
Already uses `getTerminology()` for LLC terminology and has LLC transaction types in `TRANSACTION_TYPES_BY_ENTITY`. No local cert numbering function to replace — cert numbers are entered manually by users or left blank.

## Not Changed
- Corporation flows, validation logic, database schema, PDF generators

