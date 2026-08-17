# Separate the "no board of directors" election from close corporation status

Wisconsin treats these as two distinct elections in the articles. Today EntityIQ stores only the close corporation flag and infers board elimination from it. This adds a separate, explicit election. Additive only — no document output changes in this step.

## 1. Database (additive migration)

Add to `companies`:
- `board_eliminated` boolean NOT NULL DEFAULT false
- `board_elimination_article` text NULL
- `board_elimination_date` date NULL

Backfill `board_eliminated = true` where `statutory_close_corporation = true`, so every existing document keeps rendering exactly as it does now.

Add constraint `board_eliminated_requires_close_corp`: `CHECK (NOT board_eliminated OR statutory_close_corporation)`.

`statutory_close_corporation` is untouched and keeps its own meaning (transfer restrictions s. 180.1805, certificate legend s. 180.1809, relaxed annual meeting rule s. 180.1827).

## 2. Company edit form (Incorporation tab, Corporate Elections group)

Directly beneath the existing Statutory Close Corporation checkbox, add an indented nested group within the same `equityCard.show1244` gate, disabled and greyed out unless the parent box is checked:

- Checkbox: "Corporation has elected NOT to have a board of directors", with helper text citing Wis. Stat. s. 180.1821 — a separate election requiring a statement in the articles approved unanimously by all shareholders; check only if the articles actually contain it.
- Text input "Articles reference" (placeholder e.g. "Article VII") -> `board_elimination_article`
- Date input "Election date" -> `board_elimination_date`

The parent checkbox uses a single dedicated handler, `setCloseCorp(checked)`, that updates all four related fields in one `setState` and then calls `triggerSave()` once:
```ts
const setCloseCorp = (checked: boolean) => {
  setForm(prev => ({
    ...prev,
    statutory_close_corporation: checked,
    ...(checked ? {} : {
      board_eliminated: false,
      board_elimination_article: "",
      board_elimination_date: "",
    }),
  }));
  setTimeout(() => incAutoSave.triggerSave(), 50);
};
```
This avoids sequential debounced saves that would violate the new CHECK constraint when the parent flag is removed.

Add `board_eliminated`, `board_elimination_article`, and `board_elimination_date` to both form-state initializers (the initial `useState` block and the `useEffect` reset on `[company.id]`), and include them in the single save mutation `.update({...})` payload (~line 580), sending empty strings as `null` for the text and date fields.

Update the parent helper text to: "Elected under Wis. Stat. s. 180.1803. Limited to 50 or fewer shareholders. This does not by itself eliminate the board of directors."

## 3. Verification banner (company detail page)

When `statutory_close_corporation` and `board_eliminated` are both true but `board_elimination_article` is null, show a non-dismissible amber notice asking the user to confirm the articles contain the s. 180.1821 statement and record the article reference, and warning that if they do not, the box should be unchecked because the corporation has a board whose annual election must appear in the minutes.

The banner clears only when the user records the article reference or unchecks the board-elimination election. No localStorage, no extra column.

## Technical notes

- Migration only adds columns/constraint; no drops or renames.
- UI work is confined to `src/components/company/IncorporationTab.tsx` (form state, autosave payload) and `src/pages/CompanyDetail.tsx` (banner, styled like the existing amber authorized-units alert).
- No file under `src/lib/*-pdf*.ts` is touched; PDF generators continue to read `statutory_close_corporation`. Switching them to `board_eliminated` is a later step.
