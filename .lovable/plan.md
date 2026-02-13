
# Business Sales Module

## Overview
Add a new "Business Sales" section to the main navigation sidebar and create a dedicated page for tracking the sale of businesses under Wisconsin law. This module will record full sale transactions — including seller financing, property/asset leveraging, merchandise/vehicle exchanges, and other consideration types recognized under Wisconsin commercial law (Wis. Stat. Ch. 402 - Uniform Commercial Code, Ch. 409 - Secured Transactions, Ch. 706 - Conveyances of Real Property, and Ch. 180/183 for corporate/LLC asset sales).

## What You'll Get
- A new **"Business Sales"** link in the left sidebar under Main (alongside Dashboard and Reports)
- A new **Business Sales page** with a table of all sale transactions across your companies
- An **"Add Sale"** dialog with fields covering Wisconsin-recognized transaction types:
  - **Sale type dropdown** (dynamically filtered by entity type):
    - **Corporations/S-Corps**: Asset Sale (Wis. Stat. 180.1202), Stock Sale, Merger/Consolidation (180.1101), Bulk Transfer (Ch. 406)
    - **LLCs**: Membership Interest Sale (183.0706), Asset Sale, Assignment of Interest (183.0503)
    - **All entities**: Seller Financing (Ch. 409 Secured Transaction), Real Property Conveyance (Ch. 706), Exchange of Merchandise/Inventory (Ch. 402 UCC), Vehicle/Equipment Exchange (Ch. 342), Goodwill & Intangibles Sale, Installment Sale, Earn-Out Agreement
  - Buyer/seller info, sale date, total price, consideration type, financing terms, and notes
- Each sale is linked to a specific company

## Technical Details

### 1. New Database Table: `business_sales`
Create via migration with columns:
- `id` (uuid, PK)
- `company_id` (uuid, NOT NULL) — references the company being sold
- `sale_type` (text, NOT NULL) — the Wisconsin transaction category
- `statute_reference` (text) — e.g. "Wis. Stat. 180.1202"
- `buyer_name` (text, NOT NULL)
- `seller_name` (text, NOT NULL)
- `sale_date` (date, NOT NULL, default CURRENT_DATE)
- `total_price` (numeric)
- `consideration_type` (text, default 'cash') — cash, seller financing, property exchange, merchandise, vehicle, mixed
- `financing_terms` (text) — for seller financing details
- `property_description` (text) — for property/asset leverage details
- `notes` (text)
- `status` (text, default 'pending') — pending, completed, cancelled
- `created_at`, `updated_at` (timestamptz)

RLS policies scoped through `companies.user_id = auth.uid()` (same pattern as other tables).

### 2. New Page: `src/pages/BusinessSales.tsx`
- Fetches all `business_sales` joined with company name
- Displays a filterable table (by company, sale type, status)
- "Add Sale" dialog with company selector and entity-type-aware sale type dropdown
- Edit and delete capabilities

### 3. Navigation Update: `src/components/AppLayout.tsx`
- Add "Business Sales" to `mainNav` array with a `Handshake` icon (from lucide-react)

### 4. Routing Update: `src/App.tsx`
- Add route `/business-sales` wrapped in `ProtectedRoute` and `AppLayout`

### 5. Files Changed/Created
- **New**: `src/pages/BusinessSales.tsx`
- **Edit**: `src/components/AppLayout.tsx` (add nav item)
- **Edit**: `src/App.tsx` (add route)
- **Migration**: Create `business_sales` table with RLS
