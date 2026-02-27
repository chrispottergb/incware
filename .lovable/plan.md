

# Upgrade Shareholder Management to Full Transactional Ledger

## Overview
Extend the existing share transaction system with additional fields from the original IncWare design, add a `transaction_assets` table for non-cash consideration tracking, add treasury identification to shareholders, build an enhanced transaction form with an asset grid, and add document generation buttons.

## Important: What Already Exists
The system already has much of this infrastructure in place:
- `share_transactions` table with transaction types, from/to shareholder fields, certificate linking
- `stock_certificates` table with full lifecycle management
- `bills_of_sale` table linked to transactions
- `BuySellWorkflow` component handling transfers, issuances, redemptions with cancel-and-reissue logic
- Balance calculations derived from active certificates (already a calculated sum, not static)
- PDF generation utilities (jsPDF/jspdf-autotable)

The work focuses on **extending** these systems rather than replacing them.

---

## 1. Database Schema Changes

### Add columns to `share_transactions`
- `par_value` (numeric, nullable) -- par value at time of transaction
- `issued_certificate_number` (integer, nullable) -- the cert number issued in this transaction
- `surrendered_certificate_number` (integer, nullable) -- the cert number surrendered/cancelled

These columns store denormalized certificate numbers directly on the transaction for easy display and reporting, complementing the existing `certificate_id` and `transferred_certificate_id` FK columns.

### Add `is_treasury` to `shareholders`
- `is_treasury` (boolean, default false) -- flags the treasury/company record

### Create `transaction_assets` table
- `id` (uuid, PK, default gen_random_uuid())
- `transaction_id` (uuid, FK to share_transactions.id, ON DELETE CASCADE)
- `company_id` (uuid, FK to companies.id) -- for RLS
- `description` (text, not null)
- `value` (numeric, not null, default 0)
- `created_at` (timestamptz, default now())

RLS policies scoped to the company owner, matching existing patterns.

---

## 2. UI Changes

### Enhanced Transaction Form (StockLedgerTab.tsx)
Upgrade the existing "Record Transaction" dialog to match the original IncWare "Shareholder/Member Transaction Details" screen:

- Add a **source selector**: "Issued from Company" vs "Transferred from Shareholder" -- this controls whether the transaction is an issuance or transfer type
- Add **Par Value** field
- Add **Issued Certificate #** and **Surrendered Certificate #** display fields (auto-populated from the workflow, also manually enterable for legacy data)
- Add **Asset Grid** section: when consideration type is "property" or "other", show a dynamic table where the user can add rows with Description and Value columns, with a running total that should match the total consideration
- Keep existing fields: transaction type, date, shareholder, share class, number of shares, price per share, total consideration, consideration type, notes

### Treasury Logic
- When a transaction type is "redemption", "reacquisition", or "treasury_acquisition":
  - Auto-set the recipient as "Treasury" 
  - On save, find or create a shareholder record with `is_treasury = true` and the company name
  - Link the returned shares to that treasury shareholder
- The BuySellWorkflow already handles redemptions this way (sets buyer to "Treasury"); this extends it to also flag the shareholder record

### Document Buttons on Transaction Records
Add two buttons to each transaction row in the Transactions table:
- **Print Bill of Sale**: Generates a PDF using the linked `bill_of_sale_id` data, leveraging the existing PDF utilities
- **Print Certificate**: Generates a stock certificate PDF using the `certificate_id` or `issued_certificate_number` data from that transaction

These buttons only appear when the relevant linked record exists.

### Shareholder Holdings Display
The system already calculates holdings from active certificates. No changes needed here -- this requirement is already satisfied.

---

## 3. Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| Migration SQL | Create | Add columns to `share_transactions`, `shareholders`; create `transaction_assets` table with RLS |
| `src/components/company/StockLedgerTab.tsx` | Modify | Add par_value, cert number fields, asset grid, source selector, and document print buttons to the form and table |
| `src/components/company/BuySellWorkflow.tsx` | Modify | Populate new `par_value`, `issued_certificate_number`, `surrendered_certificate_number` fields when creating transactions |
| `src/lib/stock-certificate-pdf.ts` | Create | New PDF generator for individual stock certificates |
| `src/lib/bill-of-sale-pdf.ts` | Create | PDF generator for bill of sale from transaction data (if not already covered by existing PDF utilities) |

---

## 4. Implementation Order

1. Run database migration (schema changes + RLS)
2. Update `BuySellWorkflow.tsx` to populate new fields on save
3. Enhance `StockLedgerTab.tsx` with the upgraded form, asset grid, and print buttons  
4. Create PDF generation utilities for certificates and bills of sale
5. Add treasury shareholder auto-creation logic

