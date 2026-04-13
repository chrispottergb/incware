

# Layout & Rendering Audit — Findings

After reviewing all major components, layouts, CSS, and recently-changed files, the codebase is in good shape. Here are the issues found:

## Issues Found

### 1. `backdrop-blur-xl` on Auth & Reset Password pages (LOW — performance)
**Files:** `src/pages/Auth.tsx` (line 139), `src/pages/ResetPassword.tsx` (line 104)

Both pages use `backdrop-blur-xl` on the form container. While these pages don't have animated content underneath, `backdrop-blur-xl` is the most expensive blur tier and is unnecessary here since the background is static. Replace with `bg-background/95` to achieve the same visual effect with zero compositing cost.

### 2. No actual broken layouts, overflow issues, or misaligned elements found

The following areas were verified clean:
- **Dialog sizing**: Base `DialogContent` enforces `min-w-[600px]` desktop-first constraint. All 17 files using `max-w-lg` still render at 600px due to min-width.
- **Tab wrapping**: CompanyDetail uses `flex-wrap` on TabsList — renders correctly with 13-14 tabs.
- **Table overflow**: All table containers use `overflow-hidden overflow-x-auto` pattern consistently.
- **TaxReturnUpload job history**: Fragment wrapper intact, icons (Clock, XCircle, CheckCircle2, Loader2) are already imported on line 27-29.
- **BusinessSalesTab**: Properly wired with Dialog CRUD, all imports present.
- **MeetingVehicles vehicle sales**: Section correctly appended after lease terminations, proper closing structure.
- **UserManagement admin utilities**: Correctly guarded behind `isAdmin` check, `Lock` and `Loader2` icons imported.
- **`text-success` class**: Properly defined in tailwind.config.ts as `hsl(var(--success))` with CSS variable `--success: 152 44% 38%` — works correctly across all 23 files using it.
- **AppLayout header**: `backdrop-blur-sm` is not over scrolling content (header is in normal flow, not sticky/fixed), so no performance concern.
- **AIComplianceTab**: Clean tabbed layout, all 5 sub-components accept `companyId` correctly.
- **z-index layering**: No conflicts found between overlays (z-30 mobile, z-50 dialogs, z-9999 splash).

## Recommendation

### Fix: Remove unnecessary `backdrop-blur-xl`
Replace the expensive blur on Auth and ResetPassword with a solid semi-transparent background:

**`src/pages/Auth.tsx` line 139:**
Change `bg-background/80 ... backdrop-blur-xl` → `bg-background/95`

**`src/pages/ResetPassword.tsx` line 104:**
Change `bg-background/80 ... backdrop-blur-xl` → `bg-background/95`

This is a minor optimization — no functional bugs exist. The app's layouts render correctly at the 1442px viewport.

