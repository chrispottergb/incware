## Goal

Rework the "Approve Charitable Contributions" entry in the Add Resolution form: fewer/optional fields, a default tax treatment, two distinct generated texts, and an approving body derived from the meeting and entity type already stored (no new field).

## Verified current state

- Panel: `src/components/meeting/CharitableContributionFields.tsx` (Tax Year, Amount, Organization Name, Tax Treatment), mounted by `MeetingResolutions.tsx:413` and `WrittenConsentWizard.tsx:1267`.
- Templates: `src/lib/resolution-types.ts`, five entity variants with `[TaxYear] / [Amount] / [OrganizationName]`.
- `.template` is read only at `MeetingResolutions.tsx:224,252` and `WrittenConsentWizard.tsx:475,481,496` — no PDF export, preview pane, or picker tooltip consumes it.
- `MeetingResolutions` accepts a `meetingType` prop, but `MeetingDetail.tsx:986` and the Written Consent embed (`WrittenConsentWizard.tsx:1331`) don't pass it; only `MeetingDetail.tsx:1353` does.
- Existing approving-body convention lives at `meeting-pdf-export.ts:784`: shareholder meeting → "Shareholders"; else LLC → "Members"; else → "Board of Directors".
- Stored meeting types: `Shareholder Meeting`, `Annual Meeting`, `Organizational Meeting`, `Special Meeting of Board of Directors`, `Written Consent`; LLC swaps in `Special Meeting of Members`; nonprofit adds `Annual Meeting of Members`. `"Board Meeting"` exists only as a compliance-checklist label, never as a `meeting_type`.
- Disclaimer at `MeetingResolutions.tsx:431` is untouched.

## Changes

**1. Approving-body helper (new, in `CharitableContributionFields.tsx`)**

`resolveApprovingBody(entityType, meetingType)` → `{ label, plural, entityNoun }`, reusing the `meeting-pdf-export.ts:784` rule so wording stays consistent app-wide:

| Condition | Label | Verbs |
|---|---|---|
| meeting type contains "shareholder" | Shareholders | plural |
| Single Member LLC | Managing Member | singular ("confirms, approves, and ratifies") |
| any other LLC variant | Members | plural |
| everything else (corp/nonprofit annual, organizational, board meetings) | Board of Directors | plural |

Written Consent / no meeting type → falls through the same chain on entity type alone: corp → Shareholders, LLC → Members, Single Member LLC → Managing Member. `WrittenConsentWizard` already has `isLLC` / `isSMLLC` (lines 86-88) and will pass its entity type in, so it never defaults to the corp answer.

Entity noun: "corporation" for Corporation / S Corporation / Non-Profit, "company" for LLC variants.

**2. Fields**

- Keep Tax Year (required) and Amount (required).
- Rename "Organization Name" → "Recipient(s)", **optional**, empty by default, helper text: "Leave blank for a general approval, or list recipient name(s) comma-separated (e.g., 'Red Cross, United Way')."
- Remove the default-string validation rule; `validateCharitable` checks only Tax Year and Amount.
- Tax Treatment radios default to `deductible`; option 2 subtext becomes "The contribution was recorded as an expense but not deducted, including contributions to unqualified organizations."

**3. Text generation**

`composeCharitableText` builds text from the tax treatment + resolved approving body instead of the per-entity static template:

- **Deductible** — WHEREAS … made charitable contributions in the total amount of $X to *recipients, or "a qualified charitable organization(s)" when blank*; RESOLVED, that the {approving body} hereby confirm(s), approve(s), and ratif(y/ies) the charitable contributions as expenditures made in the best interests of the {corporation/company}.
- **Not deductible** — the longer §170(c) business-expense wording; blank recipients fall back to "one or more recipients as determined by the officers/managers of the entity"; the Schedule M-1 "Tax Treatment Note" paragraph is appended.

Output goes into the existing textarea and stays fully editable.

**4. Wiring**

- `MeetingResolutions.tsx`: resolve the approving body from its `entityType` + `meetingType` props and pass it into compose; recompose on field/treatment change and on first selecting the resolution type (including seeding the default deductible text).
- `MeetingDetail.tsx:986`: pass `meetingType={meeting.meeting_type}`.
- `WrittenConsentWizard.tsx`: same derivation for its own charitable panel, and pass `meetingType="Written Consent"` to the embedded `MeetingResolutions`.
- `resolution-types.ts`: keep the five entries (labels/statutes drive the picker and categorization), update their stored text to the new deductible wording as a static fallback, and refresh the doc comment to note the live text is composed dynamically.

## Open item

Nonprofit "Annual Meeting of Members" resolves to **Board of Directors** under the reused rule. Say so if you'd rather it read "Members".

## Notes

- Saved resolutions are plain text in `meeting_resolutions.resolution_text` — unaffected, no migration.
- Editing an existing resolution keeps today's plain-textarea behavior (panel is new-resolution only).
