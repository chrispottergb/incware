

# Missing Confirmation Dialogs for Destructive Actions

## Findings

Components that **already have** confirmation dialogs (no changes needed):
- `CompanyDetail.tsx` — entity deletion via `EntityDeleteGuard`
- `MeetingsTab.tsx` — multi-step delete with transaction awareness
- `DocumentsTab.tsx` — `AlertDialog` before file deletion
- `Settings.tsx` — shortcode deletion confirmation
- `PendingReviews.tsx` — review link deletion confirmation
- `AdminDeleteButton.tsx` — transaction deletion confirmation
- `StockCertificatesTab.tsx` — cancel certificate confirmation (but delete has none)

Components with **direct-fire delete mutations** (no confirmation — 26 delete buttons across 22 files):

### HIGH priority (persistent business data — 12 components)

| Component | What's deleted without confirmation |
|---|---|
| `ShareholdersTab.tsx` | Shareholder record |
| `StockCertificatesTab.tsx` | Certificate record (the red trash button) |
| `BillsOfSaleTab.tsx` | Bill of sale record |
| `BusinessSalesTab.tsx` | Business sale record |
| `LeasesTab.tsx` | Lease record |
| `BanksTab.tsx` | Bank account record |
| `CompanyAssetsSection.tsx` | Company asset |
| `RelationshipsTab.tsx` | Entity relationship |
| `TimelineTab.tsx` | Custom timeline event |
| `CounselTab.tsx` | Attorney/accountant firms + contacts (4 buttons) |
| `IncorporationTab.tsx` | Organizer and director records |
| `OrganizationTab.tsx` | Organizer record |

### MEDIUM priority (meeting sub-records — 8 components, 10 buttons)

| Component | What's deleted |
|---|---|
| `MeetingResolutions.tsx` | Resolution |
| `MeetingOfficersTable.tsx` | Officer row |
| `MeetingBenefits.tsx` | Benefit row |
| `MeetingLoans.tsx` | Loan row |
| `MeetingVehicles.tsx` | Vehicle purchase, lease, termination, sale (4 buttons) |
| `MeetingAgreements.tsx` | Agreement row |
| `MeetingAmendments.tsx` | Amendment row |
| `MeetingAuthorizedSigners.tsx` | Authorized signer |

### LOW priority (AI compliance — 5 components)

`AIOversightPersons`, `AISystemsRegistry`, `AIRiskIncidents`, `AIUsageLog`, `AIComplianceDocs` — all delete without confirmation.

---

## Implementation Plan

### Step 1: Create shared `ConfirmDeleteDialog` component
**New file:** `src/components/ui/confirm-delete-dialog.tsx`

A pre-styled `AlertDialog` accepting `open`, `onOpenChange`, `onConfirm`, `title?`, `description?` props. Destructive action styling matching existing patterns.

### Step 2: Wire into all 22 files (26 delete buttons)

Each file gets:
1. `const [deleteId, setDeleteId] = useState<string | null>(null)`
2. Change `onClick={() => del.mutate(id)}` → `onClick={() => setDeleteId(id)}`
3. Add `<ConfirmDeleteDialog open={!!deleteId} onOpenChange={...} onConfirm={() => del.mutate(deleteId!)} />`

### Scope
- 1 new file
- 22 files updated
- No database changes

### Technical details
- `MeetingSubTable.tsx` is a generic component used across multiple meeting sections — adding confirmation here covers its usage everywhere
- `CounselTab.tsx` has 4 separate delete mutations (firm + contact × attorney + accountant) — each gets its own `deleteId` state
- `MeetingVehicles.tsx` has 4 delete mutations — same pattern, 4 states or a single `{type, id}` state

