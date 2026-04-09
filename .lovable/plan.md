

## Fix: Rename "Preferred" column to "Ownership %" in Annual Meeting shareholders table

### Problem
In `src/pages/MeetingDetail.tsx`, the shareholders table inside the Annual Meeting view labels the column "Preferred" for corporations. However, the data mapped to this column (`preferred_shares`) is actually the ownership percentage (confirmed at line 120: `preferred_shares: ownershipPct.toFixed(2)`). The label is wrong; the data is correct.

### Changes — single file: `src/pages/MeetingDetail.tsx`

1. **Line 781** — Column definition: Change label from `"Preferred"` to `"Ownership %"`
   ```
   // Before
   label: term.isLLC ? "Interest %" : "Preferred"
   // After
   label: term.isLLC ? "Interest %" : "Ownership %"
   ```

2. **Line 754** — PDF export header array: Change `"Preferred"` to `"Ownership %"`
   ```
   // Before
   term.isLLC ? "Interest %" : "Preferred"
   // After
   term.isLLC ? "Interest %" : "Ownership %"
   ```

No other files need changes. The Shareholders & Stock tab, other meeting types, data mappings, and PDF generators remain untouched.

