## Plan: Add "CORPORATE ELECTIONS" group with Statutory Close Corporation election

### 1. Database migration
Add a new boolean column on `companies`:
- `statutory_close_corporation` (boolean, default `false`, nullable)

No RLS changes (table already has policies). Types regenerated after migration approval.

### 2. UI change — `src/components/company/IncorporationTab.tsx`
In the dynamic Equity / Governance card (the "Shares & Elections" panel for Corporation/S-Corp), restructure the area currently holding the Section 1244 and S Corporation checkboxes (lines ~1420–1490, after the closing `</div>` of the grid at 1418):

a. Insert a new section header above the existing Section 1244 block, gated by `equityCard.show1244 || equityCard.showSElection`:
```
<div className="mt-4 mb-2 field-label">Corporate Elections</div>
```
The `field-label` utility (`text-xs font-medium text-muted-foreground uppercase tracking-wider`, defined in `src/index.css`) already matches the styling of the existing "Authorized Shares" / "Seal" field labels.

b. Add new "Statutory Close Corporation" checkbox row as the FIRST item in the group, only when `equityCard.show1244` (Corporation/S-Corp). Use the same dark card style as the Section 1244 row but with a subtle blue border:
```
<div className="mt-2 flex items-start gap-2.5 rounded-md border bg-muted/30 px-3 py-2.5"
     style={{ borderColor: "#3B5BDB" }}>
  <Checkbox id="statutory_close_corp"
            checked={form.statutory_close_corporation}
            onCheckedChange={(v) => updateAndSave("statutory_close_corporation", !!v)} />
  <div className="flex-1">
    <Label htmlFor="statutory_close_corp" className="cursor-pointer text-sm font-medium">
      Statutory Close Corporation
    </Label>
    <p className="text-[11px] text-muted-foreground">
      This corporation elects to operate without a board of directors under close corporation
      statutes. Shareholders exercise all governance powers directly.
    </p>
  </div>
</div>
```

c. Leave the existing Section 1244 block (1420–1433) and S Corporation block (1435–end of section) exactly as-is, but they now sit visually under the new "Corporate Elections" label.

### 3. Form state wiring
- Add `statutory_close_corporation: company.statutory_close_corporation ?? false` to the initial `form` state object in this component (alongside `election_1244`).
- The existing `updateAndSave` helper persists changes via the standard Supabase update path.

### 4. Out of scope
- No changes to PDF export, no changes to any other panel, no changes to layout, spacing, or styling of existing rows.
- No changes to Preferred Shares row, Seal, or the grid above.
