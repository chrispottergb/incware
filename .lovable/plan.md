## Goal
Add a "Statutory Close Corporation" sub-type to the Annual Meeting of Shareholders meeting type. When selected, the meeting detail view and PDF render the full Annual Meeting of Directors tab/section set. All other meeting types remain untouched.

## Files to modify (review before any code is written)

1. **`src/components/company/MeetingsTab.tsx`**
   - Add `"Statutory Close Corporation"` as the first entry in `SUB_TYPES["Shareholder Meeting"]` (line ~70). All existing entries kept as-is.
   - In `handleDialogOpen` and `handleMeetingTypeChange`: leave the existing `"Annual Meeting"` prefill branch alone. Add a separate, isolated branch that triggers prefill only when `meeting_type === "Shareholder Meeting" && sub_type === "Statutory Close Corporation"`, sourced from a new helper `prefillFromLastStatutoryClose()` that queries `meetings` where `meeting_type='Shareholder Meeting' AND sub_type='Statutory Close Corporation'`. This requires firing prefill on sub-type change too (only for that one value).
   - No changes to any other meeting type's prefill, fields, or save logic.

2. **`src/pages/MeetingDetail.tsx`**
   - Add a single derived flag near the existing flags (line ~87):
     ```ts
     const isStatutoryCloseShareholderMeeting =
       isShareholderMeeting && meeting?.sub_type === "Statutory Close Corporation";
     ```
   - In the `subTabs` computation (line ~891), change ONLY the shareholder branch:
     ```ts
     const subTabs = (
       isShareholderMeeting && !isStatutoryCloseShareholderMeeting
         ? allSubTabs.filter(t => shareholderTabs.has(t.value))
         : allSubTabs
     ).filter(t => !(isNonProfit && t.value === "shareholders"));
     ```
     This makes statutory-close shareholder meetings fall through to the full `allSubTabs` list (identical to what Annual Meeting of Directors uses). All existing `TabsContent` blocks already render via `allSubTabs` and reuse the same components — no per-tab content changes needed.
   - For the query-enable flags currently gated to `isAnnualMeeting` or `isOrganizational || isShareholderMeeting || isAnnualMeeting` (lines ~186–226), extend them by OR-ing in `isStatutoryCloseShareholderMeeting` so the new tabs actually have data (officers, counsel, banking, leases, vehicles, amendments, benefits, loans, agreements, financials). Each addition is a single isolated `|| isStatutoryCloseShareholderMeeting` clause; no other condition is altered.

3. **`src/lib/meeting-pdf-export.ts`**
   - In the section-gating logic that currently uses `isShareholder` (derived from `meeting_type`), add an isolated parallel flag:
     ```ts
     const isStatutoryClose =
       isShareholder && (meeting.sub_type || "") === "Statutory Close Corporation";
     ```
   - For every section currently skipped because `isShareholder` is true but included when it's a directors' annual meeting (banking resolutions, registered agent confirmation, general authorization, tax filing acknowledgment, charitable contributions, officers/counsel/leases/benefits/loans/amendments sections, etc.), change the gate from `if (isShareholder) skip` style to `if (isShareholder && !isStatutoryClose) skip`. Standard shareholder PDF output unchanged.
   - No changes to title/header labels — a statutory-close shareholder meeting still prints as "Meeting of Shareholders".

## Out of scope / explicitly NOT touched
- No database migration. The existing `meetings.sub_type` text column stores the value; no RLS changes.
- No new components. All tab content reuses the existing components rendered by `allSubTabs` in `MeetingDetail.tsx`.
- Annual Meeting of Directors (`meeting_type === "Annual Meeting"`) logic, queries, tabs, and PDF — untouched.
- LLC meeting types, Written Consent, Organizational Meeting, Special Meetings — untouched.
- Non-profit shareholders-tab suppression — preserved.
- `MeetingsTab.tsx` list rendering, `TimelineTab.tsx`, `record-book-pdf.ts`, `WrittenConsentWizard.tsx` — no changes (they already display `sub_type` generically).

## Verification after build
- Create a new Annual Meeting of Shareholders without sub-type → tabs remain: Meeting Info | Shareholders/Members | Directors | Resolutions | Other.
- Create one with sub-type = Statutory Close Corporation → full 15-tab set renders; queries populate; PDF includes the extra sections.
- Existing shareholder and directors' annual meetings open and print unchanged.
