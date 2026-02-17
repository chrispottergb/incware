
## Batch Tax Return Upload

### Overview
Enhance the TaxReturnUpload component to accept multiple files at once. Each file is parsed individually by the AI, and the results are displayed in a scrollable list grouped by tax year. The user reviews all extractions, then saves them all in one action -- creating a single company (or updating an existing one) with meeting/financial records for each year.

### How It Works

1. **Multi-file selection**: The upload area accepts multiple files (via `multiple` attribute and multi-drop). A file queue displays below the drop zone showing each file's name and parse status (pending, processing, done, error).

2. **Sequential AI parsing**: Files are processed one at a time through the existing `parse-tax-return` edge function. A progress bar shows overall completion (e.g., "3 of 5 returns parsed").

3. **Aggregated preview**: After all files are parsed, results are displayed sorted by tax year ascending. Each year gets a collapsible card showing the same extracted data preview (company info, financials, assets, officers). A small "Year-over-Year" summary table at the top shows Revenue, COGS, Net Income across all years with percentage change columns.

4. **Single save action**: One "Save All" button creates or updates the company and inserts a meeting + meeting_financials record for each tax year. Assets, officers, and shareholders are de-duplicated (matched by name) so multi-year imports don't create duplicates.

### Technical Details

**File: `src/components/TaxReturnUpload.tsx`**

- Replace single `extracted` state (`ExtractedData | null`) with `extractedList` state (`ExtractedData[]`)
- Replace single `fileName` with `files` array tracking `{ file: File, name: string, status: 'pending' | 'processing' | 'done' | 'error', data?: ExtractedData }`
- Change `<input>` to `multiple` and update `onDrop` to handle `e.dataTransfer.files` (all files, not just `[0]`)
- Add `handleFiles(files: File[])` that queues all files then processes them sequentially via `handleFile`
- Add a progress indicator: `{completed} of {total} parsed`
- Update the preview section:
  - Show a YoY summary table (year, revenue, COGS, net income, YoY % change) at the top
  - Below it, render collapsible `Accordion` items per year with the existing card grid inside each
- Update `handleSaveToCompany` to loop through all extracted records:
  - Company fields come from the most recent tax year
  - A meeting + meeting_financials row is created per year
  - For the most recent year's meeting, link previous year financials into `previous_*` columns
  - Assets are inserted with de-duplication by description
  - Shareholders/officers are de-duplicated by name
- Button text changes to "Create Company & Save All ({n} years)" or "Save All ({n} years)"

**No backend or database changes needed** -- the existing edge function and tables support this entirely from the frontend.

### Files Modified
- `src/components/TaxReturnUpload.tsx` -- all changes are in this single file
