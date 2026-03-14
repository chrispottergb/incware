
# Add Ownership % Column to Membership Certificates Tab

## What Changes
Add an **Ownership %** column to the Membership Certificates table (StockCertificatesTab) that appears only for LLC entities. Each certificate row will show what percentage of total outstanding units that certificate represents.

## How It Works
- Calculate total issued units by summing `num_shares` across all **active** certificates
- For each certificate row: `ownership % = (certificate units / total active units) * 100`
- Only displayed for LLC and Single Member LLC entity types
- Cancelled certificates show "--" since they no longer represent ownership

## Technical Details

**File: `src/components/company/StockCertificatesTab.tsx`**

1. Compute `totalActiveUnits` from the fetched certificates (sum of `num_shares` where status is "active")
2. Add a new `Ownership %` TableHead column (conditionally rendered when `t.isLLC`)
3. Add a corresponding TableCell for each row showing `(cert.num_shares / totalActiveUnits * 100).toFixed(2)%` for active certs, or "--" for cancelled ones
4. Include the column in the PDF export headers and rows array
