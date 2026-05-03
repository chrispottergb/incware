## Goal

Implement the new optimized dark-mode palette globally so every component (sidebar, workspace, cards, tables, tabs, status badges) inherits it from CSS variables — no per-component patches.

## Scope

This is a token-level update. The semantic CSS variables in `src/index.css` are the single source of truth consumed by Tailwind (`tailwind.config.ts`) and by every shadcn component. Updating those tokens propagates the new palette to the entire app.

Some components currently reference hard-coded warm/red/orange Tailwind classes (e.g. `bg-orange-500`, `text-red-500`, `border-red-500`) for "Required" / status indicators. We will sweep those and route them through the new semantic tokens (`required`, `warning`, `success`, `destructive`).

## Changes

### 1. `src/index.css` — `:root` token rewrite

Convert all hex values to HSL and replace the dark-mode tokens:

```text
Backgrounds
  --background        #121417   (primary app bg)
  --workspace         #171A1F   (NEW token — panels / main content)
  --card              #1E2229
  --card-elevated     #252B33   (NEW token — hover/elevated)
  --popover           #1E2229
  --muted             #1A1F26   (table headers, subtle fills)
  --secondary         #1E2229

Borders / inputs
  --border            #2E3642
  --input             #2E3642
  --table-divider     #2A313C   (NEW)
  --table-row-hover   #222833   (NEW)

Brick-red accent (signal only)
  --primary           #C24A3A
  --primary-hover     #D85A48   (NEW)
  --primary-active    #A93E31   (NEW)
  --primary-foreground #E6E8EB
  --accent            #C24A3A
  --ring              #C24A3A
  --destructive       #C24A3A

Typography
  --foreground        #E6E8EB   (primary text)
  --secondary-foreground #AAB2BD
  --muted-foreground  #7A8594
  --disabled-foreground #4B5563  (NEW)
  --table-header-fg   #C9D1D9   (NEW)

Status (warm, muted)
  --required          #E06C4F   (NEW)
  --required-foreground #121417
  --warning           #D9A441
  --warning-foreground #121417
  --success           #3FB950
  --success-foreground #121417

Sidebar
  --sidebar-background        #0F1216
  --sidebar-foreground        #AAB2BD
  --sidebar-accent            #1C222B   (active item bg)
  --sidebar-accent-foreground #E6E8EB
  --sidebar-primary           #C24A3A   (active indicator bar)
  --sidebar-border            #1A1F26
  --sidebar-ring              #C24A3A
```

Also update the scrollbar block to use the new brick-red and remove the hard-coded `hsl(4 63% 40%)` hover (use `--primary-active` instead).

### 2. `tailwind.config.ts`

Extend `theme.colors` with the new tokens so utilities exist:

- `workspace: "hsl(var(--workspace))"`
- `card.elevated: "hsl(var(--card-elevated))"`
- `required: { DEFAULT, foreground }`
- `table: { header, divider, rowHover }`

Keep existing `primary`, `accent`, `success`, `warning`, `destructive` mappings — only the underlying HSL values change in `index.css`.

### 3. Global sweep — replace hard-coded colors

Run `rg` for the following patterns and replace with semantic tokens:

| Found | Replace with |
|---|---|
| `bg-orange-500`, `text-orange-*`, `border-orange-*` (used for "Required") | `bg-required text-required-foreground` |
| `bg-red-500`, `text-red-500`, `border-red-500` | `bg-destructive text-destructive-foreground` |
| `bg-green-500`, `text-green-500` | `bg-success text-success-foreground` |
| `bg-yellow-*` | `bg-warning text-warning-foreground` |
| pure `text-white` on dark surfaces | `text-foreground` |
| `bg-black`, `bg-[#000]` | `bg-background` |

Files most likely affected (based on prior memory of badges / status pills): `MeetingLoans.tsx`, `MeetingFinancials.tsx`, `WIComplianceChecklist.tsx`, `FilingComplianceTab.tsx`, `BanksTab.tsx`, `MeetingsTab.tsx`, `ShareholdersTab.tsx`, `Reports.tsx`. Sweep is global — not limited to these.

### 4. Tables (global)

In `src/components/ui/table.tsx`:

- `TableHeader` row: `bg-[hsl(var(--muted))] text-[hsl(var(--table-header-fg))]`
- `TableRow` hover: `hover:bg-[hsl(var(--table-row-hover))]`
- Divider: `border-[hsl(var(--table-divider))]`
- Slightly increase `TableHead` / `TableCell` horizontal padding (`px-4` → `px-5`) for readability.

This single file change updates every table app-wide, including Loans & Notes Payable.

### 5. Tabs (active underline)

In `src/components/ui/tabs.tsx`, refine the active indicator to a thinner brick-red underline (`border-b-2 border-primary` → `border-b border-primary` with `data-[state=active]:text-foreground`).

### 6. Sidebar active indicator bar

In `src/components/ui/sidebar.tsx` (or `AppLayout`/`AppSidebar` if customized), ensure active `SidebarMenuButton` gets:
- background `bg-sidebar-accent` (#1C222B)
- a 3px left bar `before:bg-sidebar-primary` (#C24A3A)

### 7. Print styles

Leave `@media print` block alone — it intentionally resets to white.

## Validation

After applying, visually verify on these pages: Dashboard, Company Detail (Loans & Notes Payable tab), Annual Meeting Wizard, Sidebar collapsed/expanded, Reports. Check that:
- Sidebar (#0F1216) is visibly darker than canvas (#121417) than workspace (#171A1F) than cards (#1E2229).
- Brick red appears only on accents (buttons, active tab, focus ring, sidebar bar) — never as a large fill.
- "Required" pills are muted red-orange (#E06C4F), not bright orange.
- No pure white text and no pure black backgrounds remain.
