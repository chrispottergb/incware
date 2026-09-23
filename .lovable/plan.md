# Revise Annual Meeting Officers Section (Nonprofit)

## What changes
For nonprofit corporations, the Officers section of the annual meeting minutes PDF is rewritten as:

```text
OFFICERS
RESOLVED, that the following individuals are hereby elected to serve as officers of
[Company Name], to hold the respective offices set forth below until their successors
are duly elected and qualified, or until their earlier resignation or removal:

  Office | Name            (table, from existing Title + Name)

FURTHER RESOLVED, that each officer shall perform the duties and exercise the authority
of the respective office as provided in the Articles of Incorporation, Bylaws, and
applicable resolutions of the Board of Directors.

-- only if any officer has Salary or Bonus entered --
OFFICER COMPENSATION
RESOLVED, that the Board of Directors hereby approves the compensation, if any, to be
paid to the officers for services to the Corporation as set forth below:

  Officer | Position | Salary | Bonus   (only officers with an entered amount;
                                         Bonus/Salary column dropped if no one has it)

FURTHER RESOLVED, that the Board of Directors has determined that the compensation
approved above is reasonable compensation for the services to be provided to the Corporation.
```

Removed for nonprofits:
- The WHEREAS "reviewed officer positions and compensation ... aligned with IRS nonprofit compensation guidelines" paragraph.
- The "re-elected / best interests" WHEREAS.
- The trailing "The Board reviewed all officer positions and compensation..." paragraph and the "unpaid due to limited duties" note.
- Any IRS-guideline or rebuttable-presumption wording.

Display rules: blank Salary/Bonus shows nothing (no dash, no $0.00); an actually entered $0 is shown; existing currency formatting is reused. No director/officer linkage is required or shown — officers who are not directors print normally.

Also: the nonprofit default compensation-justification text suggested on the meeting Officers screen will drop the "aligned with IRS nonprofit compensation guidelines" sentence so it cannot leak into documents.

## Not changed
For-profit, S-Corp, and LLC officer sections; directors, attendance, quorum, other resolutions, signatures, dates; officer data and database (no schema change); the separate nonprofit annual-meeting template's election bullets.

## Technical details
- `src/lib/meeting-pdf-export.ts` (Officers block ~L2003-2106): add an `isNonprofitMeeting` branch rendering the new text with the existing `section()`, `addWhereasResolved()` (RESOLVED indent unchanged), and `autoTable` with `pageBreak/rowPageBreak: "avoid"` and 1.25" margins. Compensation presence = any officer with `salary != null` or `bonus != null` (non-empty). Existing non-nonprofit branch left byte-identical.
- `src/components/meeting/MeetingOfficersTable.tsx` L78/L88: remove the IRS sentence from nonprofit default justifications.
- Verify: typecheck, build, and generate two sample nonprofit PDFs (unpaid officers; one paid officer + non-director officer) and visually inspect.
