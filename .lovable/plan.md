# Navigation and Dashboard Cleanup

Non-destructive. Routes stay registered; only navigation surface and Dashboard table presentation change.

## Changed files
- `src/components/AppLayout.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Dashboard.tsx`

No other file is touched. `/org-chart`, `/promissory-note`, `/import-access` remain registered in `src/App.tsx`.

## 1. Sidebar (AppLayout.tsx)
New MAIN list (7 items):
Dashboard, Pending Reviews, Reports, Org Chart, Strategy (admin only), Resources (collapsible), Settings (collapsible).

- Remove the "Import Access DB" and "Promissory Note" entries from the `mainNav` array only. Both pages stay reachable by URL.
- Move the COMPANIES collapsible block (with its divider, search box, company list, Add Company) so it renders directly below the Dashboard link and above Pending Reviews. Query, search filtering, list cap, and click behavior are copied verbatim — no logic changes.
- INACTIVE CLIENTS block stays immediately after COMPANIES, unchanged.
- Drop now-unused icon imports only if nothing else uses them.

## 2. Settings page — Data card
Insert a new card directly after `AddressBookCard`, matching existing card styling (Card / CardHeader / CardTitle with icon / CardDescription / CardContent):

- Heading: "Data"
- Row: "Import Access Database" with description "One-time import of an existing Microsoft Access records database" and a button that navigates to `/import-access`.

`ImportAccess.tsx` is not modified.

## 3. Dashboard — Client Companies table
a. Remove the "Fiscal Year End" column: the header cell (~line 435-440) and the body cell at ~line 495. Display-only; the field stays in forms, CompanyDetail, and the database.

b. Sticky Company Name column:
- Change the table wrapper from `overflow-hidden rounded-lg` to `overflow-x-auto rounded-lg` so horizontal scrolling exists.
- Header cell: `sticky left-0 z-20` with a solid background matching the header row (`bg-muted`), since transparent backgrounds let scrolling cells show through.
- Body cells: `sticky left-0 z-10` with a solid row background that also matches the hover state, using the row's group hover so the sticky cell does not visually detach.
- Verify with a browser check at full horizontal scroll that the column holds and the background stays opaque.

c. Filter chips: build the chip array dynamically — always include "All (n)"; include Overdue, Due soon, and No schedule set only when their count is greater than zero. If the currently active chip's count drops to zero, reset `annualFilter` to `all` so the table never shows an empty filtered view with no way back.

## Verification
- Sidebar shows 7 MAIN items with COMPANIES directly under Dashboard.
- Typing `/import-access` and `/promissory-note` still loads those pages.
- Settings shows the Data card linking to the Access import.
- Company Name remains visible when the table is scrolled fully right.
- Fiscal Year End absent from the Dashboard table only.
- No zero-count chip renders except All.
