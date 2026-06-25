## Goal

In the Meeting **Officers** table, when the company is an LLC that has **not** elected S-Corp tax status, (1) show a subtle info banner above the table and (2) hide the Salary column (header, input field, table cell, and dual-role auto-persist note salary references stay intact in data — only the UI is hidden).

## Tax status read

LLCs use two signals:
- `company.entity_type === "LLC-S"` → S-Corp elected
- `isLLCType(company.entity_type) && company.s_election_date` → also S-Corp elected

Helper used:
```ts
const isLLC = isLLCType(company.entity_type);
const isSCorpElected = company.entity_type === "LLC-S" || !!company.s_election_date;
const showLLCInfoBanner = isLLC && !isSCorpElected;
```

## Files modified

### 1. `src/pages/MeetingDetail.tsx` (~line 1212)
Pass two new props to `MeetingOfficersTable`:
- `showSalary: boolean` (true unless `showLLCInfoBanner`)
- `showLLCNoSalaryBanner: boolean` (= `showLLCInfoBanner`)

Also remove "Salary" from the PDF export columns at lines 1200–1207 when `showSalary` is false (LLC non-S-Corp): conditionally build the column header + row arrays so PDF stays consistent with the UI.

### 2. `src/components/meeting/MeetingOfficersTable.tsx`
- Extend `Props` with `showSalary?: boolean` (default true) and `showLLCNoSalaryBanner?: boolean` (default false).
- Above the `<Table>` (inside `CardContent`, before the `rows.length === 0` check), render the banner when `showLLCNoSalaryBanner` is true:

```tsx
{showLLCNoSalaryBanner && (
  <Alert className="mb-3 border-blue-500/20 bg-blue-500/5 text-foreground">
    <Info className="h-4 w-4 text-blue-500" />
    <AlertDescription className="text-xs">
      Officers of a standard LLC do not receive a salary. Distributions are managed under the Members section.
    </AlertDescription>
  </Alert>
)}
```
Import `Info` from `lucide-react`. `Alert`/`AlertDescription` are already imported.

- When `showSalary === false`:
  - Hide the **Salary** `<TableHead>` (line 497).
  - Hide the **Salary** `<TableCell>` (lines 534–536).
  - Hide the **Salary** `<Input>` block in the Add/Edit dialog (lines 469–472).
  - Form state, mutation payload (`salary: form.salary ? parseFloat(...) : null`), DB column, compensation note generation, and dual-role auto-persist logic are NOT touched — existing rows with salary values remain in the database untouched.

## Out of scope

- No DB migration, no policy changes.
- No changes to Corporation, S-Corp, Non-Profit, Partnership, or LLC-S behavior — those continue to see Salary and no banner.
- No changes to compensation-status workflow logic.
- No changes elsewhere (Org tab Officers section has no Salary column).

## Risks

- PDF export at `MeetingDetail.tsx` lines 1200–1207 must be conditionally adjusted or it will print a Salary column the user can no longer edit. Plan addresses this.
- Existing LLC (non-S-Corp) rows may already have salary values from prior data entry. We leave the data intact; it simply becomes invisible in the UI. If user later elects S-Corp, prior values reappear.
