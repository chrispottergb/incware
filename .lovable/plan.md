## Goal

When `company.entity_type === "Non-Profit"`, the Annual Meeting wizard captures nonprofit-specific structured data and the generated PDF uses a 21-section nonprofit template that never interpolates raw dollar figures. C-Corp, S-Corp, and LLC flows are untouched, and the fund-accounting group is nonprofit-exclusive.

## Scope (files)

- `src/components/meeting/NonProfitGovernanceStep.tsx` — expand into a multi-section step capturing all new fields.
- `src/components/AnnualMeetingWizard.tsx` — thread new nonprofit state through the existing session-draft, gate all rendering on `isNonProfit`, pass to PDF; keep non-NP path unchanged.
- `src/lib/annual-meeting-pdf.ts` — add optional `nonProfit` block on `AnnualMeetingData`; when `entityType === "Non-Profit"` and `nonProfit` is present, render the 21-section nonprofit body instead of the standard body.
- No DB schema changes — data lives in the wizard's existing `sessionStorage` draft. (Persistence to the meeting record is called out as an open question below.)

## Form additions (Non-Profit only)

All new UI is rendered inside the existing "Non-Profit Governance" step, grouped as cards. Nothing below is visible for any other entity type — the fund-accounting group in particular stays completely absent from C-Corp / S-Corp / LLC flows.

1. **Notice of Meeting** — radio: `given_per_bylaws` | `waived_in_writing`.
2. **Fund Accounting** (nonprofit-exclusive, FASB net-asset + UPMIFA concepts) — five list fields, each with a "None" checkbox that collapses the list:
   - Funds established during the year
   - Donor-restricted funds received during the year
   - Endowment funds established/modified during the year
   - Restrictions satisfied/released during the year
   - Board-designated funds established/modified/terminated during the year
3. **Treasurer's Report** — `fiscalYearCurrent`, `fiscalYearPrior`, `summary` (textarea).
4. **Budget Approval** — `fiscalYear`, `approved` (yes/no).
5. **Compensation Review** (structured, never printed) — repeater rows: `name`, `title`, `amount`, `comparabilityNotes`; plus board flags `reasonableApproved`, `interestedAbstained`.
6. **Conflict of Interest** — disclosures list (or None); `policyReaffirmed` (yes/no). Rolls up with existing COI toggle.
7. **Form 990 Review** — `reviewedPriorToFiling` (yes/no), `fiscalYear`.
8. **Outside Professionals** — `attorneyName`, `accountantName`, `engagementChanged` (yes/no), `changeDetails` list.
9. **Banking / Signing Authority** — `bankNames` list, `currentSigners` list (name + title), `priorAuthorizationsRevoked` (yes/no).
10. **Next Meeting** — `date`, `location`.
11. **Elections** — extend officer editor: add `Chairperson` role and a toggle `chairpersonCombinedWithPresident` so both can be recorded distinctly or combined per org structure.

Existing mission-statement, public-inspection, and program-service fields on `NonProfitGovernanceData` are retained and roll into template sections 6 / 11 / 12 as appropriate.

## PDF template (Non-Profit only)

Add `generateNonProfitAnnualMeetingBody(doc, data)` used only when `data.entityType === "Non-Profit"` and `data.nonProfit` is set. Renders in this exact order:

1. Title + corporation name
2. Date / location (or remote communication)
3. Call to order, chairperson, time, directors present, quorum
4. Notice given/waived (per toggle)
5. Prior minutes approved
6. Activities & operations reviewed; program/finance/compliance reports
7. Fund review paragraph (general language)
8. Fund actions — bulleted lists from Fund Accounting group; each empty list renders "None"
9. Treasurer's report — general language, only fiscal years merged, **no dollar figures**
10. Budget approval — general language, only fiscal year merged
11. Compensation review — fixed general paragraph (verbatim wording from spec), **no names or amounts**
12. Conflict of interest — disclosures (or "None") + policy reaffirmation
13. Form 990 review — fiscal year only
14. Outside professionals — attorney, accountant, continued engagement or change
15. Election of directors and officers — Directors list; Officers list including Chairperson/President as separate or combined per toggle
16. Banking / signing authority — bank name, current signers, revocation statement when applicable
17. Next annual meeting date/location
18. Other business
19. Adjournment time
20. Certification line with approval date
21. Secretary signature line

Compensation amounts and any other financials remain in structured state for future reporting/990 prep and are never interpolated into text.

## Non-goals

- No changes to C-Corp / S-Corp / LLC minutes template or forms.
- No new DB tables or exhibit/attachment mechanism.
- Word/DOCX output — not supported by the current annual-meeting pipeline; PDF only, matching existing behavior.

## Open question

Persist the new nonprofit fields to the meeting record (for later 990 prep / reporting), or leave them in the session draft only? Current plan is session-draft only. Say the word and I'll add a follow-up migration + write path in a second pass.
