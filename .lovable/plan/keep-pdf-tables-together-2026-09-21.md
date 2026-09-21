# Keep PDF tables together

## Goal
Standardize every generated PDF table so rows are never split across pages and each table starts on a fresh page when the complete table fits there but not in the remaining space.

## Implementation
- Inventory all `jspdf-autotable` calls and custom drawn tables.
- Add consistent row-level no-split settings to every generated table.
- Add whole-table preflight page breaks where table height can be determined safely; tables taller than one page will paginate between complete rows.
- Preserve existing PDF content, fonts, margins, and styling.

## Verification
- Run TypeScript checks and relevant document tests.
- Generate representative PDFs and visually inspect page boundaries for clipped or split rows.
