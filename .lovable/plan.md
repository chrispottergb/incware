Section 5 (meeting-type gating) is the only remaining piece — sections 1-4 (conditional fields, structured-vs-rendered data rule, 21-section PDF template, PDF output) are already wired through `NonProfitGovernanceStep`, `AnnualMeetingWizard`, and `nonprofit-annual-meeting-pdf.ts` from the prior pass.

## Scope (files)

- `src/components/company/MeetingsTab.tsx` — add a nonprofit meeting-type list; hide "Shareholder Meeting" and expose "Annual Meeting of Members" only when `entity_type === "Non-Profit"`.
- `src/components/AnnualMeetingWizard.tsx` — accept the members variant, thread a `meetingScope: "directors" | "members"` flag into the nonprofit PDF data, and persist `meeting_type` accordingly.
- `src/lib/nonprofit-annual-meeting-pdf.ts` — branch title, opening paragraph, quorum/attendance language, and elections wording on `meetingScope`.
- `src/pages/MeetingDetail.tsx` — recognize the new `meeting_type` value for routing/labels (read-only check; only touched if the string isn't already handled).

No DB schema changes. `meeting_type` remains a free string column.

## Behavior

1. Meeting-type dropdown source list is chosen by entity type:
   - Non-Profit → `["Annual Meeting", "Annual Meeting of Members", "Organizational Meeting", "Special Meeting of Board of Directors", "Written Consent"]`. `"Shareholder Meeting"` is removed from the option list entirely (not disabled).
   - LLC → unchanged (`LLC_MEETING_TYPES`).
   - C-Corp / S-Corp → unchanged (`CORP_MEETING_TYPES`).
   The display-label mapping in the `<SelectItem>` render already rewrites `"Annual Meeting"` → `"Annual Meeting of Directors"` for non-LLC entities; that stays and now naturally reads correctly for nonprofits too.

2. Selecting either `"Annual Meeting"` or `"Annual Meeting of Members"` on a Non-Profit opens the existing `AnnualMeetingWizard`. The wizard passes a `meetingScope` derived from `meeting_type` into `generateNonProfitAnnualMeetingPDF`.

3. `nonprofit-annual-meeting-pdf.ts` uses `meetingScope`:
   - `"directors"` (default) → current wording ("Annual Meeting", "directors present", board self-elects).
   - `"members"` → title becomes "Annual Meeting of Members"; opening paragraph refers to the membership; quorum/attendance section lists members present and confirms member quorum; elections paragraph states that directors were "elected by the members" rather than by the board. All other governance sections (fund accounting, compensation review, COI, 990, professionals, banking) render identically — those don't change based on who's meeting.

4. Guard: the entity-type branch that already routes to the nonprofit PDF is unchanged; the gating change ensures a Non-Profit user can never select "Shareholder Meeting" and slip past the nonprofit branch.

## Non-goals

- No new database columns, no member roster model, no member-voting workflow beyond wording.
- No changes to C-Corp / S-Corp / LLC meeting-type lists or minutes templates.
- No new PDF renderer — reuse `generateNonProfitAnnualMeetingPDF` with a scope flag.

## Open question

Should "Annual Meeting of Members" collect a distinct members-present roster (separate from the directors-present list already captured), or is it acceptable in this pass to reuse the existing attendee list and just relabel it "Members Present" in the PDF? Current plan: reuse the attendee list with relabeled wording.
