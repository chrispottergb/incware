

## Add 5th Dashboard Card: "Import Tax Return"

### What Changes

The dashboard currently has 4 navigation cards in a row: New Client, Existing Client, Annual Update, Quick Search. A 5th card -- "Import Tax Return" -- will be inserted between "New Client" and "Existing Client" (position 2 of 5). Clicking it will open the Tax Return Upload flow.

### Image

A new placeholder image (`card-import-tax-return.jpg`) is needed. Since we don't have a real image yet, I'll use a high-quality placeholder from an external source (a tax/document-themed stock image) or generate a gradient placeholder. To keep things moving, I'll create a simple SVG or use an existing placeholder and you can swap the image later.

### Layout Adjustment

The current grid is `grid-cols-2 lg:grid-cols-4`. With 5 cards, I'll update to `grid-cols-2 lg:grid-cols-5` so all five display in a single row on desktop. On mobile they'll wrap naturally in 2 columns (with the 5th card full-width on the last row via a span utility, or simply left-aligned).

### Technical Details

1. **New image asset**: Add `src/assets/card-import-tax-return.jpg` -- will use a document/upload themed placeholder image fetched from Unsplash or a generated SVG fallback.

2. **Dashboard.tsx changes**:
   - Import the new image and a `TaxReturnUpload` state trigger
   - Add a `taxReturnOpen` state boolean
   - Insert the 5th card object at index 1 (between New Client and Existing Client) with:
     - Title: "Import Tax Return"
     - Description: "Upload & auto-populate"
     - Icon: `Upload`
     - onClick: opens the TaxReturnUpload dialog
   - Update grid from `lg:grid-cols-4` to `lg:grid-cols-5`
   - Render a standalone `TaxReturnUpload` component controlled by the new state

3. **Files modified**: `src/pages/Dashboard.tsx` only (plus the new image asset)

