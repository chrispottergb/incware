## Change

In `src/pages/MeetingDetail.tsx`, update the `subTabs` computation (lines 894–897) to add an isolated branch for `isStatutoryCloseShareholderMeeting` that filters out the `"directors"` tab.

### Edit

Replace:
```ts
const subTabs = (isShareholderMeeting && !isStatutoryCloseShareholderMeeting
  ? allSubTabs.filter(t => shareholderTabs.has(t.value))
  : allSubTabs
).filter(t => !(isNonProfit && t.value === "shareholders"));
```

With:
```ts
const subTabs = (
  isShareholderMeeting && !isStatutoryCloseShareholderMeeting
    ? allSubTabs.filter(t => shareholderTabs.has(t.value))
    : isStatutoryCloseShareholderMeeting
    ? allSubTabs.filter(t => t.value !== "directors")
    : allSubTabs
).filter(t => !(isNonProfit && t.value === "shareholders"));
```

### Scope

- Only the `subTabs` ternary is modified.
- No changes to Directors tab content, standard Shareholder meetings, Annual Meeting of Directors, query enable-flags, or any other file.

### Verification

- Statutory Close Corp shareholder meeting → full tab set minus Directors.
- Standard Annual Meeting of Shareholders → Info / Shareholders / Directors / Resolutions / Other (unchanged).
- Annual Meeting of Directors → unchanged.
