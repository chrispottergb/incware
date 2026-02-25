

## Corporate Share Tracking: Authorized vs. Individual Holdings

### Problem Statement
Currently, when shares are issued or transferred, there is no distinction between shares drawn from the corporation's authorized pool vs. shares moving between individual shareholders. The system needs to enforce two separate pools:

1. **Company Authorized Pool** -- e.g., 9,000 authorized shares. Initial issuances draw from this pool, reducing the number of shares available to issue.
2. **Individual Shareholder Holdings** -- each shareholder holds a specific number of shares. Transfers between shareholders move shares from one person to another without affecting the authorized pool.

Additionally, when a transfer occurs, the seller's certificate should be cancelled (or reduced) and a new certificate issued to the buyer reflecting the correct share counts.

---

### What Changes

**1. Display "Available Shares" on the Shareholders & Stock tab**
- Calculate: `Available = authorized_shares - total issued shares` (from the stock ledger)
- Show this prominently at the top of the section alongside "Authorized Shares" from the company profile
- Example display: `Authorized: 9,000 | Issued: 6,000 | Available to Issue: 3,000`

**2. Add per-shareholder "Shares Held" calculation**
- In the Shareholders table, add a computed "Shares Held" column (for Corporations)
- Calculated from the stock ledger: sum of issuances to that shareholder, minus transfers out, plus transfers in, minus redemptions
- This is separate from the company-level authorized pool

**3. Enforce validation in the Buy/Sell Workflow**
- For **Initial Issuance** type transactions: validate that `num_shares <= available authorized shares`; if not, show an error
- For **Transfer** type transactions: validate that `num_shares <= seller's current holdings`; if not, show an error ("Seller only holds X shares")
- Transfers do NOT reduce the company's authorized/available pool

**4. Auto-create certificates on transfer completion (Step 3 enhancement)**
- After a transfer is saved, automatically:
  - Cancel the seller's existing certificate (or create a new one with reduced share count)
  - Issue a new certificate to the buyer for the transferred shares
- Show a summary of what happened in Step 3 instead of just prompting

**5. Running balance improvements in Stock Ledger**
- The "Running Balance" column already exists -- ensure it correctly distinguishes:
  - Company-level: total shares outstanding (all shareholders combined)
  - The per-shareholder balance is tracked in the Shareholders table via the new "Shares Held" column

---

### Technical Details

**No database schema changes needed.** All data already exists:
- `companies.authorized_shares` stores the total authorized
- `share_transactions` records all issuances, transfers, redemptions
- `stock_certificates` tracks certificates
- `shareholders` table already has `ownership_percentage` (for LLCs)

**Files to modify:**

1. **`src/pages/CompanyDetail.tsx`**
   - Add a summary bar above the shareholders sub-tabs showing Authorized / Issued / Available counts
   - Pass `authorizedShares` and computed `issuedShares` to child components

2. **`src/components/company/ShareholdersTab.tsx`**
   - Add a "Shares Held" column for Corporation/S-Corp entities (computed from ledger data)
   - Query `share_transactions` grouped by shareholder to calculate net holdings

3. **`src/components/company/BuySellWorkflow.tsx`**
   - Add "Initial Issuance" as a transaction type option (currently only has transfer/redemption types)
   - Add validation: issuance checks available pool; transfer checks seller's holdings
   - Show validation errors inline
   - After save on transfers: auto-cancel seller cert + auto-issue buyer cert

4. **`src/components/company/StockLedgerTab.tsx`**
   - Update running balance logic to show both per-shareholder and company-level totals
   - Add an "Available Shares" indicator in the header

5. **`src/components/company/StockCertificatesTab.tsx`**
   - No structural changes, but certificates created by the workflow will be linked via `transferred_certificate_id`

**Validation logic (in BuySellWorkflow):**

```text
IF transaction_type is "initial_issuance":
  available = company.authorized_shares - SUM(issued shares from ledger)
  IF num_shares > available:
    ERROR "Only {available} shares remain available to issue"

IF transaction_type is "transfer":
  seller_holdings = SUM(seller's net shares from ledger)
  IF num_shares > seller_holdings:
    ERROR "Seller only holds {seller_holdings} shares"
```

**Per-shareholder holdings calculation:**

```text
For each shareholder:
  + shares from issuances where shareholder_id = this shareholder
  + shares from transfers IN where to_shareholder matches name
  - shares from transfers OUT where from_shareholder matches name
  - shares from redemptions where shareholder_id = this shareholder
  = net shares held
```

