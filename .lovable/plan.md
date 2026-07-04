## Toolbar reorganization — SMOperatingAgreementGenerator

Scope: edits to `src/components/company/SMOperatingAgreementGenerator.tsx` only. No changes to PDF generators, DB, or `DocumentVersionHistory.tsx` (already supports Current/Superseded badges). Existing dark theme + button sizes preserved.

### 1. Status strip (new, above toolbar)

New row rendered above the buttons with two chips:

- **Template chip** — driven by `isScorpElected` (`!!company?.s_election_date`), same logic as the S-corp banner:
  - `s_election_date IS NOT NULL` → amber "S-Corp Election" badge
  - else → neutral "Standard" badge
- **Draft state chip** — derived from local state:
  - `!pdfDoc` → muted "No draft generated"
  - `pdfDoc && !savedThisSession` → amber "Draft generated — not saved"
  - `pdfDoc && savedThisSession` → success "Saved as current version"

Add a `savedThisSession` boolean state; set `true` at the end of `handleSaveVersion`, reset to `false` whenever a new draft is produced (in `handleGenerate` / `handleAiGenerate`).

### 2. Two-group toolbar with divider

Replace the current two flex rows (Generate row + conditional Action row) with a single toolbar containing two labeled groups separated by a vertical `Separator`:

```text
GENERATE                          │  EXPORT & SAVE
[Generate Standard] [AI-Assisted  │  [Download PDF] [Download Word]
Draft] [Import Existing]          │  [Preview] [Print] [Save Version]
```

- Each group has a small uppercase muted label (`text-[10px] uppercase tracking-wider text-muted-foreground`) above its buttons.
- Vertical `Separator` between groups on desktop; groups stack on narrower widths.
- The Export & Save group is always rendered (no longer conditional on `pdfDoc`) so users can see the actions they'll unlock.

### 3. Color semantics

- All three GENERATE buttons → `variant="outline"` (neutral peers). Remove the filled/accent style + Sparkles emphasis from **AI-Assisted Draft** — keep the Sparkles icon, drop the primary fill.
- Export & Save group: Download PDF, Download Word, Preview, Print → `variant="outline"`.
- **Save Version** is the only `variant="default"` (primary/accent) button in the whole toolbar.

### 4. Disabled export actions until a draft exists

Download PDF, Download Word, Preview, Print get `disabled={!pdfDoc}`. Wrap each in a shadcn `Tooltip` (only shown while disabled) with content "Generate a draft first". Save Version continues to use its own disabled state (needs `pdfDoc`, respects `isSavingVersion`).

### 5. Version History placement

- Remove the current bottom-of-card `DocumentVersionHistory` render and its collapsed footer treatment.
- Render it inside a small persistent panel directly below the toolbar (still inside the same `CardContent`, above the inline preview).
- Wrap it so it defaults to expanded when `versionHistory.length > 1`. `DocumentVersionHistory` already manages its own `Collapsible`; the simplest approach is to add a `defaultOpen` prop to that component and pass `versionHistory.length > 1`. This is a one-line addition to `DocumentVersionHistory.tsx` (new optional prop threaded into `useState`) — no visual change to how it renders rows, badges, or actions.

### Files touched

- `src/components/company/SMOperatingAgreementGenerator.tsx` — status strip, regrouped toolbar, color/variant changes, disabled+tooltip on export buttons, `savedThisSession` state, relocated version history.
- `src/components/company/DocumentVersionHistory.tsx` — add optional `defaultOpen?: boolean` prop feeding the existing `showHistory` `useState` initial value. No other behavior changes.

### Out of scope

- No changes to PDF generation, save/supersede logic, S-corp trigger, import flow, disclaimer dialog, or inline preview card.
- No changes to the S-corp warning banner on `CompanyDetail`.
