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

Directly beneath the existing Statutory Close Corporation checkbox, add an indented nested group, disabled and greyed out unless the parent box is checked:

- Checkbox: "Corporation has elected NOT to have a board of directors", with helper text citing Wis. Stat. s. 180.1821 — a separate election requiring a statement in the articles approved unanimously by all shareholders; check only if the articles actually contain it.
- Text input "Articles reference" (placeholder e.g. "Article VII") -> `board_elimination_article`
- Date input "Election date" -> `board_elimination_date`

Unchecking the parent clears all three child fields (set false / null) and saves.

Update the parent helper text to: "Elected under Wis. Stat. s. 180.1803. Limited to 50 or fewer shareholders. This does not by itself eliminate the board of directors."

## 3. Verification banner (company detail page)

When `statutory_close_corporation` and `board_eliminated` are both true but `board_elimination_article` is null, show a dismissible amber notice asking the user to confirm the articles contain the s. 180.1821 statement and record the article reference, and warning that if they do not, the box should be unchecked because the corporation has a board whose annual election must appear in the minutes.

Dismissal is per-browser (local storage, keyed by company id) so no extra column is needed; the notice returns if the article reference is still missing on another device.

## Technical notes

- Migration only adds columns/constraint; no drops or renames.
- UI work is confined to `src/components/company/IncorporationTab.tsx` (form state, autosave payload) and `src/pages/CompanyDetail.tsx` (banner, styled like the existing amber authorized-units alert).
- No file under `src/lib/*-pdf*.ts` is touched; PDF generators continue to read `statutory_close_corporation`. Switching them to `board_eliminated` is a later step.
