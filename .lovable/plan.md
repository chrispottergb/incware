## EntityIQ v2 — Polished Dashboard + Clients (parallel build)

Mounts a brand-new shell at `/v2` and `/v2/clients`. **No existing route, page, Supabase query, PDF generator, or auth flow is modified** — your live app stays exactly as it is. Revert at any time via the History tab.

### Files to create

```text
src/
  styles/v2-theme.css                 # CSS vars (light + dark), scoped to [data-v2-theme]
  hooks/useV2Theme.ts                 # localStorage-backed light/dark toggle
  data/
    v2-clients.ts                     # 34 active + 6 archived seed (spec rows + 30 generated)
    v2-deadlines.ts                   # 5 upcoming-deadlines rows
    v2-activity.ts                    # 4 recent-activity items
    v2-kpis.ts                        # 4 KPI cards w/ sparkline data
  components/v2/
    Sidebar.tsx
    TopBar.tsx
    ThemeToggle.tsx
    KpiCard.tsx
    Sparkline.tsx                     # SVG with stroke-dashoffset draw-in
    DonutRing.tsx                     # 110×110 SVG, animated 0→90% arc
    StackedBar.tsx                    # entity-type composition + legend
    DeadlineRow.tsx
    ActivityList.tsx
    RecentlyViewed.tsx
    CopilotCard.tsx                   # brand→violet gradient
    StatusPill.tsx
    EntityMark.tsx                    # 30×30 brick-red rounded building badge
    QuickActionTile.tsx
    ClientsToolbar.tsx
    ClientsTable.tsx                  # sortable, zebra, hover actions
    ClientDrawer.tsx                  # right Sheet, stub detail
    BulkActionBar.tsx                 # Framer Motion slide-up
    FilterChip.tsx                    # animated count, brand-tint when active
  pages/v2/
    V2Layout.tsx                      # 244px sidebar | topbar + Outlet, theme provider
    DashboardV2.tsx
    ClientsV2.tsx
```

### Files to modify (additive only)

- `src/App.tsx` — add 2 unprotected routes:
  - `/v2` → `V2Layout` → `DashboardV2`
  - `/v2/clients` → `V2Layout` → `ClientsV2`
- `src/main.tsx` — add `import "./styles/v2-theme.css"` (one line)
- `index.html` — add Google Fonts preconnect + Fraunces/Geist/IBM Plex Mono link
- `tailwind.config.ts` — `extend.fontFamily`: add `serif: ['Fraunces', ...]`, `mono: ['IBM Plex Mono', ...]`, swap `sans` to `['Geist', ...]` with Inter fallback. No color tokens removed.

### Design system

- **Tokens** scoped under `[data-v2-theme]` so they don't leak into legacy pages. Both light and dark variants per spec exactly (brand `#C0392B`, paper `#F7F6F3`, etc.).
- **Theme toggle** writes `data-v2-theme="light|dark"` on the V2Layout root + persists to `localStorage("entityiq-v2-theme")`. 200ms variable crossfade.
- **Fonts:** Fraunces (headings), Geist (UI/body), IBM Plex Mono (numerics). Loaded globally; PDFs continue to set Arial explicitly (unaffected).

### Dashboard (`/v2`)

Hero (Fraunces 32px greeting + amber/red inline counts + Export/Run-Review buttons) → 4 KPI cards w/ sparklines → 1.5fr | 1fr row (Upcoming deadlines · Compliance health donut + stacked bar) → 1fr 1fr 1fr (Recent activity · Recently viewed · Copilot gradient card).

### Clients (`/v2/clients`)

H1 + 3 filter chips + `+ Add Company` → 5 quick-action tiles → sticky toolbar fused to table → sortable data table (zebra, hover-revealed inline actions, brick-red entity mark, mono EIN/dates, status pills) → footer (range / pager / rows-per-page) → row-click opens right `Sheet` drawer → checkbox selection brand-tints rows + slides up bottom-center bulk action bar.

### Seed data

Spec's 10 rows verbatim + 30 deterministic additional rows across WI/IL/MN/IA/MI, varied types/FYEs, totaling 34 active + 6 archived with exactly 1 Overdue (Cedar & Stone) and 1 Due Soon flagged for the "2 need attention" chip.

### Interactions

- Sidebar active item: `layoutId` left accent bar (Framer Motion)
- KPI sparklines: 600ms stroke-dashoffset draw-in on mount
- Donut: arc 0→90% over 800ms ease-out
- Tile hover: 150ms `translateY(-2px)` + border color
- Bulk bar: slide up from `y:40`
- Filter chip click: brand-tint fill + animated count
- All transitions on **specific properties** — never `transition: all`

### Accessibility

- WCAG AA both themes; 2px brand-tint focus ring + 2px offset
- Tab order: sidebar → topbar → content; row Enter opens drawer, Space toggles checkbox
- Every interactive element gets a unique kebab-case `data-testid` per spec list

### Out of scope

No backend wiring, no Supabase, no schema changes, no edits to any existing page, no PDF/font changes for printed output. Drawer/bulk actions `console.log` only.

### Reversibility

Click revert on any prior chat message OR use the History tab to roll back the entire change set in one click. Existing app keeps working regardless.

<lov-actions><lov-open-history>View History</lov-open-history></lov-actions>
