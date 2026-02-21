

# Automated WDFI Corporate Status Verification

## Overview
Add a "Verify with WDFI" button to the Corporate Status section on the Incorporation tab. When clicked, it scrapes the Wisconsin DFI Corporate Search website using Firecrawl, extracts the entity's status, and auto-populates the Corporate Status and Verification Date fields.

## How It Works
1. User clicks "Verify with WDFI" button next to the Corporate Status fields
2. An edge function uses Firecrawl to scrape `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q={company_name}`
3. The scraped results are parsed (either via Firecrawl's JSON extraction or simple text matching) to find the entity and its status
4. The status is mapped to the app's internal values (current, delinquent, dissolved, suspended) and the fields are auto-filled

## Prerequisites
- Link the existing Firecrawl connector to this project (already available in workspace)

## Implementation Steps

### 1. Connect Firecrawl
Link the existing Firecrawl connection to the project so the `FIRECRAWL_API_KEY` secret becomes available to edge functions.

### 2. Create Edge Function: `verify-wdfi-status`
**File:** `supabase/functions/verify-wdfi-status/index.ts`

- Accepts `company_name` and optionally `entity_id` (the WDFI entity ID if known) in the request body
- Uses Firecrawl to scrape the WDFI search results page
- Parses the scraped markdown/text to find matching entity and extract:
  - Entity status (e.g., "Organized", "Delinquent", "Admin. Dissolved")
  - Entity ID number
  - Date of incorporation
- Maps WDFI statuses to internal statuses:
  - "Organized" / "Registered" --> `current`
  - "Delinquent" --> `delinquent`
  - "Admin. Dissolved" / "Dissolved" --> `dissolved`
  - "Suspended" / "Revoked" --> `suspended`
- Returns the mapped status, verification date (today), and raw WDFI data

### 3. Update `supabase/config.toml`
Register the new `verify-wdfi-status` function with `verify_jwt = false`.

### 4. Update Frontend: `IncorporationTab.tsx`
- Add a "Verify with WDFI" button (with a Shield/RefreshCw icon) inside the Corporate Status Verification card
- On click:
  - Call the `verify-wdfi-status` edge function with the company name
  - Show a loading spinner during the request
  - Auto-fill `corporate_status`, `verification_date`, and show a toast with the result
  - If multiple matches are found, show a small dialog letting the user pick the correct entity
- Handle errors gracefully (Firecrawl unavailable, no results found, etc.)

## Status Mapping Table

```text
WDFI Status              -->  App Status
-----------------------------------------
Organized / Registered   -->  current
Delinquent               -->  delinquent
Admin. Dissolved         -->  dissolved
Voluntarily Dissolved    -->  dissolved
Revoked / Suspended      -->  suspended
```

## Technical Notes
- Firecrawl's `onlyMainContent: true` option will help strip navigation/ads from the WDFI page
- The edge function will use text pattern matching on the scraped markdown rather than AI parsing, keeping it fast and free of AI credit usage
- The verification date is set to today's date automatically
- The company name used for search comes from the existing `form.name` field

