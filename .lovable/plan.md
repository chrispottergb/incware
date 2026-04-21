

## Add LLC terminology branching to Corporate Timeline

Apply `isLLCType()` in `src/components/company/TimelineTab.tsx` to swap timeline labels for LLC and Single Member LLC entities.

### Changes — `src/components/company/TimelineTab.tsx`

1. Add `import { isLLCType } from "@/lib/entity-terminology";` and compute `const isLLC = isLLCType(company.entity_type);`.
2. Header (line 388): `{isLLC ? "Company Timeline" : "Corporate Timeline"}`.
3. CardDescription (line 391): swap "corporate records" → "company records" when `isLLC`.
4. Formation event in the `useMemo` (lines 209–210):
   - `title`: `isLLC ? "Company Organized" : "Corporation Incorporated"`
   - `description`: replace `"incorporated"` with `"organized"` when `isLLC`
   - Add `isLLC` to the `useMemo` dependency array.
5. `SectionPdfActions` config (line 397): `title: isLLC ? "Company Timeline" : "Corporate Timeline"`. PDF rows inherit the updated formation title/description automatically.

### Out of scope
No other event types, no DB changes, no styling changes, no edits to `entity-terminology.ts`.

