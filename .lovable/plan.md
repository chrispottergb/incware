

## Enable S-Corp Tax Election for LLCs

### Problem
The current `IncorporationTab.tsx` hides the S-Election Date field for LLCs (`showSElection: false` on line 76). However, LLCs can elect to be taxed as an S-Corporation by filing IRS Form 2553, so this field must be available.

### Change (single edit in `src/components/company/IncorporationTab.tsx`)

**Line 76**: Change `showSElection: false` to `showSElection: true` inside the LLC case of `getEquityCardConfig()`.

This will:
- Show the "S-Election Date" date picker on the Incorporation tab when the entity type is LLC
- Display it in the read-only summary card as well (already handled by the existing conditional at line 385)
- Continue to save/load the value via the existing `s_election_date` database field

No other files need to change. The PDF export already supports S-Corp election for LLCs (from the earlier terminology fix).
