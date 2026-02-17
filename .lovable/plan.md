

# Inter-Company Relationships & Org Chart

## Overview
Add a new tab to the Company Detail page and a dedicated page showing ownership hierarchies between entities already in the system. Users will be able to define parent/subsidiary relationships between their companies and visualize them as an org chart.

## Database Changes

### New table: `company_relationships`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Default `gen_random_uuid()` |
| parent_company_id | uuid (FK to companies) | The parent/holding entity |
| child_company_id | uuid (FK to companies) | The subsidiary/owned entity |
| relationship_type | text | e.g. "subsidiary", "division", "affiliate", "joint_venture" |
| ownership_percentage | numeric | Nullable, 0-100 |
| effective_date | date | When the relationship started |
| notes | text | Nullable |
| user_id | uuid | Owner of both companies (for RLS) |
| created_at | timestamptz | Default `now()` |
| updated_at | timestamptz | Default `now()` |

- Unique constraint on `(parent_company_id, child_company_id)` to prevent duplicates
- RLS policy: user can manage relationships where `user_id = auth.uid()`
- Validation trigger to prevent a company from being its own parent

## UI Changes

### 1. New "Relationships" tab on Company Detail
Add a tab between "Banks" and "AI Compliance" called **"Relationships"** that shows:
- A table of parent entities (companies that own this one)
- A table of child entities (companies this one owns)
- An "Add Relationship" dialog to link two existing companies with type, ownership %, effective date, and notes
- Each row links to the related company and has edit/delete actions

### 2. New standalone Org Chart page (`/org-chart`)
A top-level page accessible from the sidebar that renders a visual tree of all the user's entities:
- Pure CSS/HTML tree layout (no extra dependency needed) using nested `<ul>` elements styled as an org chart
- Each node shows company name, entity type badge, and ownership %
- Clicking a node navigates to that company
- Companies with no relationships appear as standalone roots
- Color-coded by entity type

### 3. Sidebar update
Add an "Org Chart" link to the main nav section in `AppLayout.tsx` with a `GitBranch` or `Network` icon.

## Files to Create/Modify

| File | Action |
|---|---|
| Migration SQL | Create `company_relationships` table with RLS |
| `src/components/company/RelationshipsTab.tsx` | New - table + add/edit/delete dialogs |
| `src/pages/OrgChart.tsx` | New - visual tree page |
| `src/pages/CompanyDetail.tsx` | Add "Relationships" tab |
| `src/components/AppLayout.tsx` | Add "Org Chart" to sidebar nav |
| `src/App.tsx` | Add `/org-chart` route |

## Technical Details

### Org Chart Rendering
The tree will be built client-side by:
1. Fetching all `company_relationships` for the user
2. Fetching all `companies` for the user
3. Building an adjacency list and identifying root nodes (companies that have children but no parent, or standalone)
4. Recursively rendering a tree using Tailwind-styled nested lists with connector lines via CSS borders/pseudo-elements

### Relationship Dialog
- Parent company dropdown (searchable select of all user's companies, excluding current)
- Relationship type select: Subsidiary, Division, Affiliate, Joint Venture
- Ownership % input (optional)
- Effective date picker
- Notes textarea
- Cancel and Save buttons (matching existing dialog pattern)

### Mobile Responsive
- Relationship tables follow the same hidden-column pattern used in Counsel/Banks tabs
- Org chart scrolls horizontally on small screens

