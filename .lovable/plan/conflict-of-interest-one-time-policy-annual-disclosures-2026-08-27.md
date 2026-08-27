# Conflict of Interest: One-Time Policy + Annual Disclosures

Nonprofits adopt the Conflict of Interest Policy once, but must collect a signed disclosure statement from each director and officer every year. Today the app only generates the policy, so the annual requirement has no home.

## What changes for the user

1. **The Conflict of Interest area splits into two cards.**
   - *Policy (one-time)* — the existing generator, plus a recorded **Adoption Date**. Once a date exists, the card shows "Policy adopted on {date}" and the generate button becomes secondary ("Regenerate / Amend Policy") instead of the primary call to action.
   - *Annual Disclosure Statements* — becomes the primary action for the current year.

2. **Annual disclosure packet.** Pick a year, then select which directors and officers must sign (defaults to all current directors and officers). Generate produces a single multi-page PDF with one signature form per person containing:
   - Organization name, person's name and title, disclosure year
   - The policy's definition of a conflict, in brief
   - Two checkboxes: "I have no conflicts to disclose" / "I have the following interests to disclose" with lined space
   - Signature and date lines
   - Cover page listing everyone included in the packet

3. **Yearly tracking grid.** A table per year of each person, whether their signed form was received (date received), and whether a conflict was disclosed. Manually maintained — a checkbox and a date field per row. Shows a "3 of 7 received" summary for the year.

4. **Annual meeting resolution (nonprofit only).** When disclosures exist for the meeting's year, the annual meeting PDF gains a short resolution noting that annual conflict of interest disclosure statements were distributed to and returned by the directors and officers, and that any disclosed interests were reviewed by the Board.

## Technical notes

- Migration adds `companies.conflict_policy_adopted_date` (date, nullable) and a new `conflict_disclosures` table: `company_id`, `disclosure_year`, `person_name`, `person_title`, `person_source` (director/officer), `received_date`, `conflict_disclosed` (bool), `notes`, timestamps. Standard owner-scoped RLS mirroring `directors`, with GRANTs to `authenticated` and `service_role`.
- New `src/lib/conflict-disclosure-pdf.ts` built on the same jsPDF conventions as `conflict-of-interest-pdf.ts` (Arial/Liberation Sans, 1.15 line height, 1.25" binder margin, steel-blue headers), one `addPage()` per signer.
- New `src/components/company/ConflictDisclosureCard.tsx` for year selection, roster selection, generation, and the tracking grid; `ConflictOfInterestGenerator.tsx` gains the adoption-date field only.
- Preview follows the existing pattern: blob URL opened in a new tab, no inline iframe.
- Annual meeting resolution added in `src/lib/meeting-pdf-export.ts`, gated on nonprofit entity types, placed with the other governance/compliance sections.

Additive and non-destructive: existing policy generation output is unchanged, and no existing PDF section is removed.
