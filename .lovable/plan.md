

## Pre-populate WDFI Search with Company Name

### What Changes
When clicking the "Open WI DFI" external link button, the URL will include the company name as a search query parameter so the WDFI search results page loads pre-populated with the company's name.

### Technical Details

**File:** `src/components/company/IncorporationTab.tsx`

1. Update the WI entry in `STATE_SOS_INFO` to use the search URL format:
   - From: `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx`
   - To: `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q={company_name}`

2. Modify the `window.open` call for the WI "Open WI DFI" button to dynamically append `?type=Simple&q=` with the URL-encoded company name (`form.name`) to the base URL.

This is the same URL format already used by the `verify-wdfi-status` edge function, so it will produce the same search results the user sees when auto-verifying.

