

## Auto-Verify Corporate Status via WDFI Website

### Overview
Add a "Verify with DFI" button to the Incorporation tab's Corporate Status section. When clicked, it will use **Firecrawl** to scrape the Wisconsin DFI corporate records search page, extract the entity's current status, and auto-populate the Corporate Status and Verification Date fields.

### How It Works
1. User clicks "Verify with DFI" on the Incorporation tab
2. The app sends the company name to a new backend function
3. The function searches `apps.dfi.wi.gov/apps/corpsearch/` using Firecrawl's scrape capability
4. The function parses the results to find the matching entity and extract its status
5. The app auto-updates the Corporate Status dropdown and sets Verification Date to today

### Prerequisites
- **Firecrawl connector** must be linked to this project (you have one in your workspace but it's not linked yet -- I'll connect it during implementation)

### Implementation Steps

1. **Link Firecrawl connector** to the project so the API key is available to backend functions

2. **Create a new backend function** (`supabase/functions/verify-corporate-status/index.ts`)
   - Accepts: company name, state of incorporation
   - Uses Firecrawl to scrape the DFI search page with the company name as a query
   - Parses the scraped content (markdown) to find the entity status (e.g., "Organized", "Dissolved", "Admin. Dissolved")
   - Maps DFI statuses to app statuses (Organized -> "current", Admin. Dissolved -> "dissolved", etc.)
   - Returns: `{ status, dfiEntityName, dfiEntityType, verifiedAt }`

3. **Add "Verify with DFI" button** to `src/components/company/IncorporationTab.tsx`
   - Place it in the "Verification of Corporate Status" card, next to the existing fields
   - Shows a loading spinner while fetching
   - On success: auto-fills Corporate Status and Verification Date, then triggers save
   - On failure: shows a toast with guidance (e.g., "Entity not found on DFI -- verify name matches filing")

4. **Only shown for Wisconsin entities** -- the button will only appear when `state_of_incorporation === "WI"` since this is specific to the Wisconsin DFI

### Technical Details

**Backend function** (`verify-corporate-status/index.ts`):
- Uses Firecrawl scrape on URL: `https://apps.dfi.wi.gov/apps/corpsearch/Results.aspx?type=Simple&q={encodedCompanyName}`
- Extracts entity status from the scraped markdown/HTML
- Falls back to returning "not found" if no match

**Frontend changes** (`IncorporationTab.tsx`):
- New "Verify with DFI" button with Shield/RefreshCw icon
- Calls the edge function via `supabase.functions.invoke('verify-corporate-status', ...)`
- Updates form state and auto-saves on successful verification

**Status mapping:**
| DFI Status | App Status |
|---|---|
| Organized / Registered | current |
| Delinquent | delinquent |
| Admin. Dissolved / Dissolved | dissolved |
| Suspended / Revoked | suspended |

