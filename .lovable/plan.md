# Redesign Benefits Section — App UI + PDF

Replace the nested sub-table pattern with a card layout in both the in-app Benefits component and the generated meeting PDF.

## 1. In-app UI — `src/components/meeting/MeetingBenefits.tsx`

Replace the entire `<Table>` block (lines ~518–578) inside `<CardContent>` with a vertical stack of benefit cards. Keep all data loading, mutations, dialog, and the "+ Add" header button unchanged.

For each benefit row, render a bordered card using existing semantic tokens (`border-border`, `bg-card`, `bg-muted/30`, `text-muted-foreground`) so dark theme is preserved:

- **Header bar** (`flex items-center justify-between`, subtle bottom border, `bg-muted/30` padding):
  - Left: benefit type name as title (`font-medium text-sm`)
  - Right: active year `Badge` (variant `secondary`) showing `Active · {plan_year}` when `plan_year` exists; otherwise omit the badge
- **Field grid** (`grid grid-cols-2 md:grid-cols-3 gap-3 p-3`):
  - Provider — fallback "Not assigned"
  - Agent / Admin — fallback "Not assigned"
  - Insurance Agency — fallback "Not assigned"
  - Plan Year — fallback "Not specified"
  - Contribution — formatted currency when `isRetirementType(row.benefit_type)` and a value exists; otherwise "Not specified"
  - Each field: small `text-xs text-muted-foreground` label above, `text-sm` value below
- **Full-width footer row** (`border-t border-border px-3 py-2`):
  - Label "Eligibility / Comments" + value, fallback "No comments"
- **Action icons** (top-right of header, next to the badge): existing Pencil (edit) and Trash2 (delete) ghost icon buttons, same handlers (`openEdit(row)`, `deleteRow.mutate(row.id)`)

Empty state (no rows) stays as-is.

## 2. PDF export — `src/lib/meeting-pdf-export.ts` (lines ~2980–3039)

Replace the two `autoTable` calls inside the `data.benefits.forEach(...)` loop with a single card-style block per benefit (still using `autoTable` so pagination/`lastAutoTable.finalY` behavior is preserved):

- **Shaded header row** (one `autoTable` with `theme: "grid"`, existing `tableHeadStyles` steel-blue fill):
  - Columns: Benefit Type (bold) | Provider | Agent / Admin | Insurance Agency
  - Body row contains the values, with `"—"` only when the field is empty
- **Detail row** (second `autoTable` immediately below, light header style matching current secondary header — white fill, blue text, `[191,219,254]` borders):
  - Columns: Plan Year | Contribution | Eligibility / Comments
  - Values use `"—"` only when empty; contribution uses `fmt()` when present, else `"—"`
  - `columnStyles`: Plan Year ~25mm, Contribution ~35mm, Eligibility/Comments `auto`
- Wrap both tables with the same outer border color (`[191,219,254]`, `lineWidth: 0.2`) so the pair visually reads as one bordered card
- Preserve current spacing between benefits: `y = lastAutoTable.finalY + (index < last ? 5 : 10)`

WHEREAS/RESOLVED intro paragraph above the benefits list stays unchanged.

## Out of scope

- Add/Edit dialog form (unchanged)
- NonProfitDirectorBenefits component (unchanged)
- Data model, mutations, query keys (unchanged)
- Other PDF sections
