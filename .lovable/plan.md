# Redesign Landlord/Tenant Selection

Replace the cramped 4-tab picker with a clean two-step flow that progressively reveals the entity field after a party type is chosen.

## New Layout

Stack Landlord and Tenant vertically (no longer side-by-side). Each section shows:

```text
┌─ LANDLORD ──────────────────────────────────┐
│  Party Type                                 │
│  ○ This Company   ○ Related Company         │
│  ○ Individual     ○ External Entity         │
│  (helper text under each)                   │
│                                             │
│  Selected Entity                  ← appears │
│  [searchable selector or input]    only     │
│                                   after     │
│                                   step 1    │
└─────────────────────────────────────────────┘
```

## Step 1 — Party Type (Radio Cards)

Replace `Tabs` with a 2x2 grid of radio cards. Each card:
- Bold title (e.g. "This Company")
- Small helper line ("Automatically uses your primary entity")
- Selected state uses primary color border + tinted background
- Large click target

## Step 2 — Entity Selection (progressive disclosure)

Renders nothing until Step 1 is chosen, then:

| Party Type | Renders |
|---|---|
| This Company | Read-only chip showing the current company name |
| Related Company | Search-as-you-type combobox of other companies |
| Individual | Search-as-you-type combobox of shareholders/members + free-text fallback |
| External Entity | Name input + optional address input |

Use the existing shadcn `Command` + `Popover` pattern for the searchable selectors so long lists scale without scroll-clutter.

## Files to change

1. **`src/components/company/leases/EntityPartyPicker.tsx`** — full rewrite:
   - Remove `Tabs`/`TabsList`/`TabsContent`
   - Add `RadioCard` internal component (or inline divs styled as cards)
   - Add `SearchableEntityCombobox` using `Command` + `Popover`
   - Keep the same `Props` interface so `LeasesTab.tsx` doesn't change
   - Helper text per option as listed in the request

2. **`src/components/company/LeasesTab.tsx`** — one small change:
   - Change `<div className="grid grid-cols-2 gap-3">` wrapping the two `EntityPartyPicker`s to `<div className="space-y-4">` so Landlord/Tenant stack vertically.

## Technical Notes

- Project is desktop-only (≥1280px) per project memory — skipping the "mobile responsive" requirement; keep large desktop click targets only.
- `RadioCard` is a simple internal component (no new shadcn primitive needed): a `<button type="button">` with conditional border/background classes. Uses semantic tokens (`border-primary`, `bg-primary/5`, `border-border`) — no hardcoded colors.
- Searchable combobox uses existing `@/components/ui/command` + `@/components/ui/popover`.
- Queries (`my_companies_for_picker`, `shareholders_for_picker`) stay identical.
- "This Company" auto-fills `{ kind: "company", companyId: currentCompanyId, name: <currentName> }` immediately so classification can run.

No DB or API changes.
