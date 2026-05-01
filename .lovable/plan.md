## Goal

In the Add/Edit Benefit dialog (Annual Meeting → Benefits/Insurance tab), replace the single "Benefit Type" combobox with a two-step picker:

1. **Category dropdown** (single-select)
2. **Multi-select checkbox list** of benefits within that category, each with a hover tooltip

Selected benefits show in a summary chip area below. Saving creates one `meeting_benefits` row per selected benefit so the existing table rendering, edit flow, and PDF output continue to work unchanged.

## Files to change

- `src/components/meeting/MeetingBenefits.tsx` — only file touched.

## Implementation

### 1. Benefit catalog

Add a typed catalog at the top of the file:

```ts
const BENEFIT_CATALOG: Record<string, { label: string; tooltip: string }[]> = {
  "Health Coverage": [
    { label: "Health Insurance (Medical)", tooltip: "Core medical coverage for doctor visits, hospital care, and treatment" },
    { label: "Dental Insurance", tooltip: "Covers routine dental care like cleanings and fillings" },
    { label: "Vision Insurance", tooltip: "Covers eye exams, glasses, and contacts" },
    { label: "Prescription Drug Coverage", tooltip: "Helps pay for medications" },
    { label: "Other", tooltip: "Any additional health coverage" },
  ],
  "Life & Disability": [ /* …per spec… */ ],
  "Retirement": [ /* …per spec… */ ],
  "Time Off & Leave": [ /* …per spec… */ ],
  "Additional Benefits": [ /* …per spec… */ ],
  "Owner/Executive Only": [ /* …per spec… */ ],
};
```

All categories and items copied verbatim from the spec (including the "— description" tooltip text, which becomes the tooltip body).

### 2. Replace `BenefitTypeCombobox` usage in the dialog

In the Add Benefit dialog body, replace the current single `BenefitTypeCombobox` field with:

- **Category** — `<Select>` (shadcn) listing the 6 categories. Selecting a new category clears any currently selected benefit checkboxes.
- **Benefits** — once a category is chosen, render a checkbox grid (2 columns on desktop, 1 column narrower) of items from `BENEFIT_CATALOG[category]`. Each row:
  - `<Checkbox>` + `<Label>` + small `Info` icon wrapped in `<Tooltip>` (using existing `@/components/ui/tooltip` with a `<TooltipProvider>` wrapper at the dialog root).
  - Hover/focus on the row or icon shows a 1-sentence tooltip from the catalog.
- **"Other" handling** — when "Other" is checked in any category, show a small inline text input "Describe other benefit" so the saved row carries a meaningful name like `Health Coverage — Other: Wellness rebate`.
- **Selected summary** — below the checkbox list, render a wrap of `Badge` chips showing each selected benefit (with an X to remove). Empty state: muted "No benefits selected yet".

State additions inside the component:
```ts
const [category, setCategory] = useState<string>("");
const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
const [otherText, setOtherText] = useState<string>("");
```

`closeDialog` and the edit-open path reset these along with `form`.

### 3. Submit behavior

- **Add mode** (no `editingId`): for each entry in `selectedBenefits`, insert one `meeting_benefits` row. The benefit name stored in `benefit_type` is the catalog label, except `"Other"` which becomes `${category} — Other: ${otherText.trim()}` (or just `${category} — Other` if blank). All other form fields (Provider, Agent, Insurance Agency, Plan Year, etc.) are applied to every inserted row. Use `Promise.all` of inserts; show one success toast `"Added N benefit(s)"`.
- **Edit mode**: keep current single-row update behavior. Pre-populate by detecting the row's `benefit_type` against the catalog to set `category` + `selectedBenefits = [matchedLabel]` (fallback: leave category blank and treat the type as a freeform "Other" entry). Saving in edit mode uses the first selected benefit only (existing single-row update path).

Submit button disabled until `category` is set AND `selectedBenefits.length > 0` AND (if "Other" is selected, `otherText.trim()` is non-empty).

### 4. UI / design

- White background dialog already in place; new fields use existing rounded `Input`/`Select`/`Checkbox` styles.
- Checkbox list lives inside a soft-bordered `rounded-md border bg-muted/20 p-3` container with a `ScrollArea` capped at `max-h-64`.
- Selected summary uses `Badge variant="secondary"` chips with a small X button.
- Layout: Category and Benefits sections each `col-span-2` in the existing 2-col grid. Desktop-first; the existing dialog already constrains to `max-w-lg` with vertical scroll, so no new responsive work needed.
- Wrap the dialog body in `<TooltipProvider delayDuration={150}>`.

### 5. Backwards compatibility

- Database schema unchanged; we still write `benefit_type`, `benefit_description`, etc. to `meeting_benefits`.
- Existing rows continue to display in the table and PDF as before. The `customTypes` merge logic (used to preserve unrecognized historical values) is removed since the combobox is gone — historical values still render fine in the read-only table; they just appear as "Other" in the edit dialog if their label isn't in the catalog.
- `isRetirementType` logic stays and continues to drive the conditional Contribution Amount field, evaluated against the first selected benefit (or the category being "Retirement").

## Out of scope

- No changes to `meeting_benefits` schema, PDF export, or the Benefits table rendering.
- No changes to other tabs.
