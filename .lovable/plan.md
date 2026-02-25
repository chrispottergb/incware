

## Share and Membership Interest Buy/Sell Workflow with Transfer Ledger

### Overview
Build a guided **Buy/Sell Workflow** that, when a user records a share or membership interest transaction, creates all related records (ledger entry + bill of sale) in one step — and then prompts the user to update certificates. For LLCs, ownership percentages will auto-recalculate after transfers.

### Guiding Principle: Data Integrity First
- Every step will be built incrementally with validation
- Foreign key relationships will use `ON DELETE SET NULL` to preserve historical audit trails
- Existing data in `share_transactions`, `bills_of_sale`, and `stock_certificates` remains untouched
- No data migrations that alter existing records — only additive schema changes
- The workflow creates linked records transactionally so partial failures don't leave orphaned data

---

### Phase 1: Database Schema Changes

**1a. Add `ownership_percentage` column to `shareholders` table**
- New column: `ownership_percentage NUMERIC DEFAULT NULL` — stores each member/shareholder's current ownership %
- This enables auto-recalculation for LLCs and optional tracking for corporations

**1b. Add linking columns to `bills_of_sale`**
- New column: `transaction_id UUID REFERENCES share_transactions(id) ON DELETE SET NULL` — links a bill of sale to its corresponding ledger entry
- This creates the bidirectional link between the two records

**1c. Add linking column to `share_transactions`**
- New column: `bill_of_sale_id UUID REFERENCES bills_of_sale(id) ON DELETE SET NULL` — reverse link

**1d. Add `transferred_certificate_id` to `share_transactions`**
- New column: `transferred_certificate_id UUID REFERENCES stock_certificates(id) ON DELETE SET NULL` — optional link to the certificate involved in the transfer

---

### Phase 2: Buy/Sell Workflow Component

**New file: `src/components/company/BuySellWorkflow.tsx`**

A dialog-based multi-step workflow accessible from the Shareholders & Stock tab:

**Step 1 — Transaction Details:**
- Transaction type (filtered to buy/sell/transfer types from the existing `TRANSACTION_TYPES_BY_ENTITY` map)
- Seller (dropdown from shareholders list + free-text for external parties)
- Buyer (dropdown from shareholders list + free-text for external parties)
- Share class / Interest type (entity-aware using `getTerminology`)
- Number of shares/units
- Price per share/unit
- Total consideration (auto-calculates from qty x price)
- Consideration type (cash, property, services, promissory note, other)
- Transaction date

**Step 2 — Review and Confirm:**
- Summary of what will be created:
  - 1 Stock Ledger / Interest Ledger entry
  - 1 Bill of Sale record
  - Updated ownership percentages (for LLCs)
- User confirms to proceed

**Step 3 — Certificate Prompt (after save):**
- Success confirmation with linked record IDs
- Prompt: "Would you like to cancel the seller's certificate and issue a new one to the buyer?"
- Two buttons: "Update Certificates Now" (navigates to certificates section) or "Skip for Now"

**Save Logic:**
1. Insert into `share_transactions` with all details
2. Insert into `bills_of_sale` with matching details + `transaction_id` link
3. Update `share_transactions` with `bill_of_sale_id` reverse link
4. For LLCs: recalculate `ownership_percentage` on the `shareholders` table for all members of this company based on cumulative ledger entries

---

### Phase 3: LLC Ownership Percentage Auto-Recalculation

**New database function: `recalculate_ownership_percentages(p_company_id UUID)`**
- Sums all units per shareholder from `share_transactions` (accounting for issuances, transfers in/out, redemptions)
- Calculates each member's percentage of the total
- Updates `shareholders.ownership_percentage` for all members of the company
- Called after every buy/sell workflow save for LLC entities

**Display in ShareholdersTab:**
- Add a new "Ownership %" column to the shareholders table (only visible for LLC entities)
- Show the percentage with 2 decimal places

---

### Phase 4: Integration into CompanyDetail

**Update `src/pages/CompanyDetail.tsx` (shareholders tab content):**
- Add the `BuySellWorkflow` button prominently at the top of the shareholders tab section
- Keep existing individual tabs (Shareholders, Certificates, Stock Ledger, Bills of Sale) below for direct access and editing

**Update existing tabs:**
- `StockLedgerTab`: Show linked bill of sale indicator (small link icon) when `bill_of_sale_id` is present
- `BillsOfSaleTab`: Show linked ledger entry indicator when `transaction_id` is present
- Both tabs remain fully functional for standalone entries (not all transactions go through the workflow)

---

### Phase 5: Transfer Ledger View

**New file: `src/components/company/TransferLedgerTab.tsx`**

A unified chronological read-only view that merges:
- All `share_transactions` records
- All `bills_of_sale` records (flagged as linked or standalone)
- Certificate issuances and cancellations from `stock_certificates`

Columns: Date | Type | From | To | Class | Units | Price | Total | Linked Records (icons)

This gives users a single-pane-of-glass view of all ownership activity.

---

### Files to Create
1. `src/components/company/BuySellWorkflow.tsx` — the guided workflow dialog
2. `src/components/company/TransferLedgerTab.tsx` — unified ledger view

### Files to Modify
3. `src/pages/CompanyDetail.tsx` — add workflow button + transfer ledger to shareholders tab
4. `src/components/company/ShareholdersTab.tsx` — add ownership % column for LLCs
5. `src/components/company/StockLedgerTab.tsx` — add linked record indicator
6. `src/components/company/BillsOfSaleTab.tsx` — add linked record indicator
7. `src/lib/entity-terminology.ts` — add any new terminology entries needed

### Database Changes (1 migration)
- `ALTER TABLE shareholders ADD COLUMN ownership_percentage NUMERIC DEFAULT NULL;`
- `ALTER TABLE bills_of_sale ADD COLUMN transaction_id UUID REFERENCES share_transactions(id) ON DELETE SET NULL;`
- `ALTER TABLE share_transactions ADD COLUMN bill_of_sale_id UUID REFERENCES bills_of_sale(id) ON DELETE SET NULL;`
- `ALTER TABLE share_transactions ADD COLUMN transferred_certificate_id UUID REFERENCES stock_certificates(id) ON DELETE SET NULL;`
- Create `recalculate_ownership_percentages` database function
- RLS policies already cover all tables via the existing company ownership chain — no new policies needed

