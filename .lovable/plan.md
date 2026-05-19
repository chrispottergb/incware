# Separate Written Consents (Board, Shareholders, Members)

## Goal
Replace today's single combined "Written Consent" template (header reads `OF THE BOARD OF DIRECTORS / MEMBERS OF`) with three distinct templates chosen by the user, each with its own title, intro paragraph, and signature block. Strip any meeting-only fields/language from all three.

## 1. Wizard: add a "Consent Body" selector

File: `src/components/WrittenConsentWizard.tsx`

- Add state `consentBody: "board" | "shareholders" | "members"`.
- Default by entity type:
  - LLC / SMLLC → `members`
  - Corporation / S-Corp / LLC-S → `board` (with option to switch to `shareholders`)
- Render a small segmented control on Step 1 (Entity) labeled "Whose consent is this?" Options shown per entity type:
  - LLC family: **Members** only (locked).
  - Corp family: **Board of Directors**, **Shareholders**.
- Persist `consentBody` inside the existing `written-consent-meta` JSON the wizard already writes to `meeting_other` (alongside `consentType`, `ownershipThreshold`, `signers`). No DB migration needed.
- On load of an existing draft, hydrate `consentBody` from that JSON; fall back to the entity-type default.
- Signer roster source already follows entity type; additionally, when `consentBody === "shareholders"`, source from `shareholders` (with share counts); when `members`, from members/holdings (with units / ownership %); when `board`, from directors (printed name only).

## 2. PDF: three header + intro variants

File: `src/lib/meeting-pdf-export.ts` (function `addMeetingTypeHeader`, lines ~96-154, and the `isWrittenConsent` branches below).

Replace the current combined header with body-aware output:

```text
WRITTEN CONSENT OF THE {BOARD OF DIRECTORS | SHAREHOLDERS | MEMBERS}
OF {COMPANY NAME}

{Principal office address — single line, only here}

Date: {Effective Date}
```

Rules enforced:
- Company name appears **only** in the title block (remove the existing duplicate company line above the date).
- Drop the secondary "IN LIEU OF A MEETING" line.
- Principal office address renders once, immediately under the title block (pulled from `meeting.company_*_at_meeting` snapshot, falling back to `company`).
- No "Prior Meeting Date" or "Next Annual Meeting" fields anywhere in the consent path.

Intro paragraphs (replace the current generic `directors/members` text):

- **Board**: "The undersigned, being all members of the Board of Directors of {Company Name}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the corporation's bylaws."
- **Shareholders**: "The undersigned, being all shareholders holding the required voting power of {Company Name}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the corporation's governing documents."
- **Members**: "The undersigned, being all Members of {Company Name}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the operating agreement."

Optional Recitals section: if the wizard captured `recitals` text (new optional textarea on Step 3), render a `RECITALS` block before Resolutions; otherwise omit silently.

## 3. PDF: signature blocks per variant

In the consent signature renderer:

- **Board** → columns: `Director Name` | `Signature` | `Date`.
- **Shareholders** → columns: `Shareholder Name` | `Shares Held` | `Signature` | `Date`.
- **Members** → columns: `Member Name` | `Units / Ownership %` | `Signature` | `Date`.

Share/unit values come from the signer rows the wizard already collects.

## 4. Audit consent flow for meeting-only language

Sweep `meeting-pdf-export.ts` for any block executed when `isWrittenConsent === true` that still references "meeting location", "meeting time", "attendees", "prior meeting", or "next annual meeting" and gate them off. The existing code already skips most of these; confirm none leak through for the three new bodies. Also make sure the meeting form (`MeetingInfoCard.tsx`) hides those fields when `meeting_type === "Written Consent"` (it largely does; verify and patch any leftovers).

## 5. Plumbing

- Pass `consentBody` from the wizard into `exportMeetingMinutesPDF` (extend `meetingData` or the options arg) so the PDF function can branch on it. Persist alongside the meta JSON so re-opens and re-exports are stable.
- `MeetingDetail.tsx` preview path must read `consentBody` from `meeting_other` JSON and forward it to the same PDF function so previews match what the wizard renders.

## Out of scope
- No DB schema changes (uses existing `meeting_other` JSON for the new field).
- No changes to non-consent meeting templates.
- No new resolution catalog entries.

## Technical notes
- Keep `meeting.meeting_type` as `"Written Consent"` to preserve existing filters and saved drafts; the three variants are differentiated by the new `consentBody` discriminator only.
- `isLLCType(company.entity_type)` already exists in `src/lib/entity-terminology.ts` — reuse for default selection and for locking the LLC case to `members`.
