## Goal

Rebuild the Counsel tab as **Firms and Counsel**: two mirrored categories (Attorneys, Accountants), each rendering firm cards with nested people, plus standalone solo-practitioner cards. Existing firm extras (address, phone, website, master-directory autocomplete, engagement scope) stay in the firm dialog.

## No database changes needed

The current schema already supports everything:
- `attorneys` / `accountants` have a nullable `firm_id`, plus `title`, `bar_number` / `cpa_number`, `email`.
- Solo practitioner = `firm_id IS NULL`. Existing unaffiliated rows render as solo cards — no migration, no backfill.

## List view

Per category, a header row: category name + **Add firm** and **Add solo practitioner**.

```text
Attorneys                        [ Add firm ] [ Add solo practitioner ]
┌────────────────────────────────────────────────┐
│ 🏢  Smith & Associates                  ✎  🗑  │
│     Law firm · Milwaukee, WI                    │
│   ┌ (JS) Jane Smith — Partner            ✎ 🗑  │
│   │ Bar #12345 · jane@smith.com                 │
│   └ (RD) Rob Doe — Associate             ✎ 🗑  │
│   + Add attorney to this firm                   │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ (AL) Anna Lee                           ✎  🗑  │
│      Solo practitioner · no firm affiliation    │
│      Bar #99887 · anna@lee.law                  │
└────────────────────────────────────────────────┘
```

- Nested people: left border + indent. Solo cards: same card weight, no indent.
- Firm icon = building; person = initials avatar circle.
- Empty category → one card with muted text **"None appointed"**.
- Sorting: firm cards and solo cards are interleaved and sorted alphabetically together (firm name for firms, person name for solos). People nested in a firm sort alphabetically by name.

## Add/Edit person form

One dialog reused for both categories, with a two-tab toggle:

- **Firm affiliated**: Firm (dropdown of that category's firms + "Add new firm…"), Full name*, Role at firm, License number (labelled *Bar number* / *CPA number*, optional), Email*.
- **Solo practitioner**: Full name*, License number (optional), Email*.
- Switching tabs while Firm/Role are filled prompts a confirmation before clearing them.
- Save disabled only while name or email is empty. License never required.
- Opened from a firm's "Add … to this firm": Firm tab preselected, firm prefilled.
- "Add new firm…" opens FirmDialog stacked over PersonDialog. On save: close FirmDialog, return focus to PersonDialog, auto-select the new firm. On cancel: return to PersonDialog with the dropdown unchanged (no firm selected).

## Firm dialog

Kept as-is (name with master-directory autocomplete, address / address 2 / city / state / zip with ZIP lookup, phone, website); header reads "Law firm" / "Accounting firm".

Firm type is fixed at creation from the category it was added under and is not editable afterward. A firm cannot serve both categories — the same real-world firm used for legal and accounting is two separate records.

## Style

Neutral card backgrounds, thin borders, no heavy shadows or gradients; semantic tokens only. Deletes use the standard `ConfirmDeleteDialog`. Deleting a firm that has people asks how to handle them — **detach to solo** (pre-selected default, non-destructive) vs. delete them.

## Technical notes

- Rewrite `src/components/company/CounselTab.tsx` into:
  - `src/components/company/counsel/CounselSection.tsx` — generic category renderer, config-driven (table names, column names, labels).
  - `src/components/company/counsel/PersonDialog.tsx` — tabbed add/edit form.
  - `src/components/company/counsel/FirmDialog.tsx` — extracted, behaviour unchanged.
  - `src/components/company/counsel/FirmCard.tsx`, `PersonRow.tsx`, and an initials-avatar helper.
- Keep existing TanStack Query keys and master-directory / address-book sync hooks so PDFs, record book, and annual review keep reading the same data.
- Verify in the preview against a company with firm-linked and solo attorneys/accountants plus one empty category, confirming all three card states render, and that deleting a firm with people offers the detach/delete choice.
