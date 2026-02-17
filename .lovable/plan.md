

## Change Background Color to Dark Gray

Currently the main background color is set to `0 0% 7%` (near-black). This will be updated to a dark gray value.

### Change

**File:** `src/index.css`, line 10

- **Before:** `--background: 0 0% 7%;` (near black)
- **After:** `--background: 0 0% 15%;` (dark gray)

This single change will update the background across the entire app since all components reference the `--background` CSS variable. No other files need to be modified.

### Technical Detail
The value `0 0% 15%` is an HSL color (neutral gray at 15% lightness), which gives a noticeably lighter dark gray while still keeping the dark-mode aesthetic consistent with the Squarespace-inspired palette.

