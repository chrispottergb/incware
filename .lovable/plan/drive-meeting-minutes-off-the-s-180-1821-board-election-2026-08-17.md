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

## 2. Repoint use sites, and drop the sub_type escape hatch

`isBoardEliminated` (shareholders acting in place of a board) replaces the old flag at: waiver `isShareholderMeeting` (~881), `isStatutoryCloseWaiver` and the waiver purposes list (~924-931), `isStatutoryClose` (~1308), `boardLabel()`/`boardVerb()` (~1316-1318), annual minutes title (~1358), `bodyLabel` (~1451), attendee collection (~1592), Section 1244 WHEREAS clauses (~1662-1664), ratification recitals (~1748-1750, ~1772), Nomination and Election of Directors gate (~1822), Directors Present gate (~1890), officer election resolution (~1934), distribution resolution (~2148), standing authority WHEREAS (~3551).

`isCloseCorp` (status only) is used for the Statutory Close Corporation Governance Notice (~1391).

The `|| (isShareholder && meeting.sub_type === "Statutory Close Corporation")` clause is removed from both line 924 and line 1308. Governance follows the entity's articles, not a per-meeting selection. The sub_type value stays in the dropdown and in the "Type" line at ~1636 as a descriptive label only. The two meetings using that sub_type belong to a company already flagged `board_eliminated`, so output is unchanged.

## 3. Governance notice, two variants

The notice now renders whenever `isCloseCorp` is true.

- Status only (has a board): cites s. 180.1803, notes the s. 180.1805 transfer restrictions, and states the corporation has a board of directors.
- Board eliminated: cites s. 180.1803 plus the s. 180.1821 election by `[ARTICLE]` of the Articles, and states the shareholders exercise all corporate powers and carry the duties otherwise imposed on a board.

`[ARTICLE]` renders `board_elimination_article` when present, otherwise the phrase "the Articles of Incorporation". Both current companies fall into the fallback wording until an article reference is recorded.

## 4. Written consents of a board-eliminated corporation are shareholder consents

There are two independent `consent_body` resolution blocks and both get the same patch:

- `bodyTitle` at ~217-227 (document heading)
- `signerRoleLabel` at ~3693-3703 (signature line)

In each, after `consentBody` is resolved, a value of `"board"` is remapped to `"shareholders"` when `isBoardEliminated` is true, before `bodyTitle` / `signerRoleLabel` are computed. Under s. 180.1821(1)(e) director approval requirements are satisfied by shareholder approval, so such a consent is a shareholder consent — heading "SHAREHOLDERS", signer title "Shareholder". No "Designated Director" label is printed; the s. 180.1821(1)(d) mechanism is for outward-facing documents and is out of scope.

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
- Regression: with `board_eliminated = false` every branch above resolves exactly as `statutory_close_corporation = false` does today, so non-close-corp output is unchanged. For the two close corporations the visible delta is (a) the expanded governance notice paragraph and (b) written consents switching from board headings and "Director" signature titles to shareholder headings and "Shareholder" titles.
- No migration, no schema change, no changes to `annual-meeting-pdf.ts`, `nonprofit-annual-meeting-pdf.ts`, or `org-meeting-pdf.ts`.
