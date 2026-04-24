# UI Layout Adjustments — `src/components/company/IncorporationTab.tsx`

Two small, layout-only changes. No labels (other than the Scheduled Annual Meeting wording cleanup), no bindings, no validation, and no logic are modified.

---

## 1. Incorporation Info — "Scheduled Annual Meeting" row

**File:** `src/components/company/IncorporationTab.tsx` (around lines 805–808)

**Current state**
A single field spans `col-span-3` with label `Sched. Annual Mtg Date`:
```tsx
<div className="field-group col-span-6 sm:col-span-3">
  <Label className="field-label">Sched. Annual Mtg Date</Label>
  <Input ... value={form.scheduled_annual_meeting} ... />
</div>
```
This sits on the same grid row as Status (`col-span-2`), Incorporation Date (`col-span-3`), Fiscal Year End (`col-span-3`) inside a `grid-cols-12` container.

**Change**
Split this single cell into the same two-column "label-left / field-right" pattern used by the other rows in the row (Status / Incorporation Date / Fiscal Year End each occupy a single labeled cell already, so to honor the user's request that the row be a clear two-column layout — label "Scheduled Annual Meeting" on the left and a separate "Date" column on the right — render two adjacent grid cells that together still take the same space (`col-span-3`):

```tsx
<div className="field-group col-span-6 sm:col-span-2">
  <Label className="field-label">Scheduled Annual Meeting</Label>
  <div className="h-7 flex items-center text-xs text-muted-foreground">
    {/* static label cell, no input */}
  </div>
</div>
<div className="field-group col-span-6 sm:col-span-3">
  <Label className="field-label">Date</Label>
  <Input
    className="h-7 text-sm"
    value={form.scheduled_annual_meeting}
    onChange={(e) => update("scheduled_annual_meeting", e.target.value)}
    placeholder="1st Monday in April"
  />
</div>
```

Result: the row reads `Scheduled Annual Meeting` (left column) | `Date: <input>` (right column), aligned to the same grid lines as the Status / Incorporation Date / Fiscal Year End row above it. Field bindings (`form.scheduled_annual_meeting`, `update(...)`) are unchanged.

---

## 2. Organizer(s) — ZIP wider, Address 2 narrower

**File:** `src/components/company/IncorporationTab.tsx` (around lines 943–973)

**Current spans inside the `grid-cols-12` row:**
- Organizer Name: `col-span-3`
- Address: `col-span-3`
- Address 2: `col-span-2`  ← reduce
- City: `col-span-2`
- State: `col-span-1`
- Zip: `col-span-1`        ← increase

**Change** (keeps the row total at 12 columns):
- Address 2: `col-span-2` → `col-span-1`
- Zip: `col-span-1` → `col-span-2`

All other field widths, labels, validation, ZIP lookup, and data bindings are untouched.

---

## Out of scope
- No changes to PDF generators, terminology, validation, or any business logic.
- No styling tokens introduced; uses existing `field-group` / `field-label` / `h-7 text-sm` conventions.
