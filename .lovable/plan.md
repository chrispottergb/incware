# Drive meeting minutes off the s. 180.1821 board election

Verified in the database: exactly two corporations carry statutory close corporation status — The Stiegler Company, Inc. and Let Me Be Frank Productions, Inc. Both were backfilled with `board_eliminated = true` and neither has an article reference recorded yet. Every other company has `board_eliminated = false`, so their output is unaffected by this change.

Scope: `src/lib/meeting-pdf-export.ts` plus one read-only helper line in the meeting form. No other PDF builder is touched.

## 1. Split the predicate

Both copies of `companyIsCloseCorp` (one in `addWaiverOfNoticePages` ~line 880, one in the main generator ~line 1307) become two constants:

```ts
// s. 180.1803 — statutory close corporation status
const isCloseCorp = !isLLC && !!(company as any)?.statutory_close_corporation;
// s. 180.1821 — separate election not to have a board of directors
const isBoardEliminated = isCloseCorp && !!(company as any)?.board_eliminated;
```

Comments claiming a close corporation has no board are removed and replaced with a note that board elimination is a separate election.

## 2. Repoint use sites

`isBoardEliminated` (shareholders acting in place of a board) replaces the old flag at: waiver `isShareholderMeeting` (~881), `isStatutoryCloseWaiver` and the waiver purposes list (~924-931), `isStatutoryClose` (~1308), `boardLabel()`/`boardVerb()` (~1316-1318), annual minutes title (~1358), `bodyLabel` (~1451), attendee collection (~1592), Section 1244 WHEREAS clauses (~1662-1664), ratification recitals (~1748-1750, ~1772), Nomination and Election of Directors gate (~1822), Directors Present gate (~1890), officer election resolution (~1934), distribution resolution (~2148), standing authority WHEREAS (~3551).

`isCloseCorp` (status only) is used for the Statutory Close Corporation Governance Notice (~1391).

`isStatutoryClose` stays as the internal name for the board-eliminated condition where it also folds in the meeting `sub_type`, so the sub_type-driven behavior for one-off shareholder meetings is preserved.

## 3. Governance notice, two variants

The notice now renders whenever `isCloseCorp` is true.

- Status only (has a board): cites s. 180.1803, notes the s. 180.1805 transfer restrictions, and states the corporation has a board of directors.
- Board eliminated: cites s. 180.1803 plus the s. 180.1821 election by `[ARTICLE]` of the Articles, and states the shareholders exercise all corporate powers and carry the duties otherwise imposed on a board.

`[ARTICLE]` renders `board_elimination_article` when present, otherwise the phrase "the Articles of Incorporation". Both current companies fall into the fallback wording until an article reference is recorded.

## 4. Designated Directors signature block

Where the signature block prints "Director" as the signer title (~line 3703, written-consent path with `consent_body = board`), print "Designated Director" when `isBoardEliminated` is true, per s. 180.1821(1)(d).

## 5. Resolved title preview in the meeting form

Under the meeting type selector in `src/components/company/MeetingsTab.tsx`, add read-only helper text computed from the same predicate:

```text
Will print as: MINUTES OF THE ANNUAL MEETING OF SHAREHOLDERS
(no board of directors — Article VII, s. 180.1821)
```

and, when the corporation has a board:

```text
Will print as: MINUTES OF THE ANNUAL MEETING
```

The parenthetical omits the article reference when none is recorded.

## Technical notes

- Title/predicate logic is factored into a small exported helper in `meeting-pdf-export.ts` so the form and the PDF cannot drift.
- Regression: with `board_eliminated = false` every branch above resolves exactly as `statutory_close_corporation = false` does today, so non-close-corp output is unchanged. For the two close corporations, `board_eliminated = true` keeps the current shareholder-meeting output; the only visible delta is the expanded governance notice paragraph.
- No migration, no schema change, no changes to `annual-meeting-pdf.ts`, `nonprofit-annual-meeting-pdf.ts`, or `org-meeting-pdf.ts`.
