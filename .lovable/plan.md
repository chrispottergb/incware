

## Verification Plan: Share/Interest Buy/Sell Workflow and Transfer Ledger

### What Was Built
- Database migration: 4 new columns + `recalculate_ownership_percentages` function (confirmed deployed)
- `BuySellWorkflow.tsx`: 3-step guided dialog for recording transactions
- `TransferLedgerTab.tsx`: Unified chronological view of all ownership activity
- `CompanyDetail.tsx`: "Buy / Sell" button + Transfer Ledger section added
- `ShareholdersTab.tsx`: Ownership % column for LLCs
- `StockLedgerTab.tsx` and `BillsOfSaleTab.tsx`: Linked record indicators (Link2 icons)

---

### Step-by-Step Testing Checklist

**Test 1: Corporation — Buy/Sell Workflow**
1. Navigate to a Corporation entity (e.g., "Test Corp WI" or "Acme Holdings Corp")
2. Go to the Shareholders & Stock tab
3. Verify the "Buy / Sell Shares" button appears at the top
4. Click it — the 3-step dialog should open at Step 1
5. Fill in: transaction type, seller name, buyer name, share class, number of shares, price per share, date
6. Confirm "Total Consideration" auto-calculates (qty x price)
7. Click "Review" — Step 2 should show a summary with "1 Stock Ledger entry" and "1 Bill of Sale record"
8. Click "Confirm & Save" — should succeed and show Step 3 with green checkmark
9. Click "Skip for Now" to close

**Test 2: Verify Linked Records Created**
1. After Test 1, scroll down to Stock Ledger section — the new transaction should appear with a Link2 icon
2. Scroll to Bills of Sale section — the new bill should appear with a Link2 icon
3. Scroll to Transfer Ledger — both entries should appear with "Ledger" source badge and linked indicator

**Test 3: LLC — Buy/Sell with Ownership Recalculation**
1. Navigate to an LLC entity (e.g., "Badger Brewing LLC" or "Incware")
2. Verify tab says "Members & Interest" (entity-aware terminology)
3. Verify the button says "Buy / Sell Interest" (not "Buy / Sell Shares")
4. Add at least 2 members/shareholders if none exist
5. Use the Buy/Sell workflow to record a membership interest transfer
6. After saving, verify Step 2 summary includes "Updated ownership percentages"
7. Check the Members table — an "Ownership %" column should be visible with calculated values

**Test 4: LLC Ownership % Column**
1. On any LLC entity, go to the Shareholders/Members sub-tab
2. Verify the "Ownership %" column is visible
3. For Corporation entities, verify this column does NOT appear

**Test 5: Transfer Ledger View**
1. On any entity with existing ledger/bill/certificate data, scroll to the Transfer Ledger
2. Verify it shows entries from all 3 sources with correct source badges (Ledger/Bill/Cert)
3. Verify entries are sorted by date descending
4. Verify linked entries show the Link2 icon

**Test 6: Standalone Records Still Work**
1. Go to Stock Ledger — add a transaction directly (not through workflow)
2. Verify it saves without a Link2 icon (no bill linked)
3. Go to Bills of Sale — add a bill directly
4. Verify it saves without a Link2 icon (no ledger linked)
5. Both should appear in the Transfer Ledger as standalone entries

**Test 7: Certificate Prompt Navigation**
1. Run the Buy/Sell workflow again
2. At Step 3 (success), click "Update Certificates"
3. Verify the dialog closes and the page scrolls to the Certificates section

---

### Technical Details

**Database columns added (verified in schema):**
- `shareholders.ownership_percentage` (NUMERIC, nullable)
- `bills_of_sale.transaction_id` (UUID FK to share_transactions)
- `share_transactions.bill_of_sale_id` (UUID FK to bills_of_sale)
- `share_transactions.transferred_certificate_id` (UUID FK to stock_certificates)

**Database function deployed:**
- `recalculate_ownership_percentages(p_company_id UUID)` — sums units from ledger by shareholder, calculates ownership % for each member

**Files created:**
- `src/components/company/BuySellWorkflow.tsx`
- `src/components/company/TransferLedgerTab.tsx`

**Files modified:**
- `src/pages/CompanyDetail.tsx` — added workflow button, TransferLedgerTab, data-section wrapper for certificates
- `src/components/company/ShareholdersTab.tsx` — ownership % column for LLCs
- `src/components/company/StockLedgerTab.tsx` — Link2 indicator for linked transactions
- `src/components/company/BillsOfSaleTab.tsx` — Link2 indicator for linked bills
