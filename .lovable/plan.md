# Time-aware S / C tax classification

Today a company is "S" whenever `s_election_date` is filled in. That means reprinting a 2018 meeting shows today's tax status, and turning an S election off erases the date entirely. This change derives the status **as of the meeting's tax year or date**, and records when an election ended instead of deleting it.

Additive only: one new nullable column, new helper functions, and read-time changes on meeting paths. No existing data is modified or backfilled. Ratification, record audit, and every non-meeting screen are untouched.

## Pre-change findings

### a. Companies with an S election on file (25)

All have fiscal year end December 31. None has an election date in the future.

Flagged rows:

| Company | Type | S election | Formed | Issue |
|---|---|---|---|---|
| Jossart Brothers, Inc. | Corporation | 0199-08-22 | 1996-07-01 | Year 199 — typo, likely 1996-08-22 |
| Northern Electric, Inc. | Corporation | 0199-08-12 | 1992-08-07 | Year 199 — typo |
| Nakashima Sushi, Inc. | Corporation | 1998-10-29 | 2010-11-01 | Election 12 years before formation |
| Let Me Be Frank Productions, Inc. | Corporation | 2005-04-01 | 2005-05-10 | ~5 weeks before formation |
| Packerland Tire & Auto Repair Center, Inc. | Corporation | 2007-03-01 | 2007-03-08 | 7 days before formation |
| Smet AFH, LLC | LLC | 2026-01-01 | 2026-03-03 | 2 months before formation |

These are reported only. This plan does not change them — the two year-0199 rows in particular would make any pre-2000 meeting print as S. Say the word and they get corrected separately.

The other 19 look clean: ABC LLC, American Antiques & Jewlery, Beauty By The Yard, Brice Masonry, Fabisch Builders, Flip Side, Fox Valley Rentals, Friebel Real Estate, Green Bay Pipe & TV, Holl Financial Services, MaB Technologies, Packer City Antiques, Popp's Resort, Schinkten Insurance, Spin Fresh Coin Laundry, Stahl Steel Rule Dies, The Energy Shop, Tri City Home Improvements, Valley Work Support.

### b. Distribution clause (meeting-pdf-export.ts ~2158-2200)

Prints when the meeting has at least one holder with `distribution_amount > 0`. The S flag is `!!company.s_election_date || entity_type === "LLC-S"` and adds two phrases:

- In the WHEREAS: "and consistent with the Company's S Corporation election under Section 1362 of the Internal Revenue Code"
- In each RESOLVED: "and in compliance with the Company's S Corporation tax election"

Without the flag the surrounding paragraph is identical, minus those phrases.

### c. Resolution lists — the stored S lists are stale

The hardcoded "S Corporation" array is missing Approve Amendments to Bylaws, Approve Merger or Consolidation, and Name Directors to Committees; "LLC-S" is missing Adopt Regular Meeting Resolution. All of these still apply to S-taxed entities. So the S lists will be **derived at read time** from the base lists by substitution, rather than kept as separate hand-maintained arrays. The `"S Corporation"` and `"LLC-S"` keys keep working for existing callers, but are backed by the derived lists. Substituted entries keep the S-specific statute and template text already written for them.

S Corporation = Corporation, with "Approve Officer Bonuses" → "Approve Officer Bonuses (Reasonable Compensation)", "Approve Distributions/Dividends" → "Approve Distributions", "Approve Tax Election (S-Corp)" → "Revoke S-Election". Resulting list, in order:

Authorize a Line of Credit; Approve Officer Bonuses (Reasonable Compensation); Approve Annual Officer Compensation; Approve Issuance of Shares; Approve Transfer/Sale of Shares; Adopt Regular Meeting Resolution; Approve Distributions; Elect Officers; Elect Directors; Re-elect Board of Directors; Name Directors to Committees; Approve Employment Agreement; Approve Lease Agreement; Approve Purchase/Sale of Assets; Ratify Prior Actions; Revoke S-Election; Approve Employee Benefit Plan; Approve Amendments to Articles of Incorporation; Approve Amendments to Bylaws; Approve Merger or Consolidation; Approve Dissolution; Approve Loan from Related Party; Approve Loan to Related Party; Approve Related Party Loan Agreement; Approve AI Governance Policy; Universal Resolution; Approve Charitable Contributions; Approve Employer Contribution to Retirement Plan; Approve Employee Bonuses; Other.

LLC-S = LLC, with "Approve Guaranteed Payments" → "Approve Reasonable Compensation", "Approve Tax Classification Election" → "Revoke S-Election". Resulting list, in order:

Authorize a Line of Credit; Approve Member Distributions; Approve Reasonable Compensation; Admit New Member; Approve Transfer of Membership Interest; Elect/Appoint Managers; Re-elect Managers; Approve Employment/Service Agreement; Approve Lease Agreement; Approve Purchase/Sale of Assets; Revoke S-Election; Ratify Prior Actions; Approve Employee Benefit Plan; Adopt Regular Meeting Resolution; Approve Amendments to Operating Agreement; Approve Dissolution; Approve Authorized Binders; Approve Loan from Related Party; Approve Loan to Related Party; Approve Related Party Loan Agreement; Approve AI Governance Policy; Universal Resolution; Approve Charitable Contributions; Approve Employer Contribution to Retirement Plan; Approve Employee Bonuses; Other.


### d. Call sites

`isSElected()` is defined in `src/lib/entity-terminology.ts` and, in practice, S status is read inline everywhere. Meeting-scoped reads to convert: `meeting-pdf-export.ts` (~453, 1101, 1282-1286, 1532, 1565, 1978, 2162), `OrgMeetingWizard.tsx` (107-108), `AnnualMeetingWizard.tsx` (575), `MeetingDetail.tsx` (800, 1390-1391), plus the resolution list lookups in `MeetingResolutions.tsx` (~91) and `WrittenConsentWizard.tsx` (~393).

Left on current status, unchanged: Dashboard badge (476), TimelineTab (236), record-book-pdf, annual-update-pdf, annual-review snapshot + public page, bylaws-pdf, smllc-scorp-operating-agreement-pdf, SMOperatingAgreementGenerator, SCorpOAWarningBanner, IncorporationTab summary card.

## What gets built

1. **Schema** — add `companies.s_revocation_date` (date, nullable, no default, no backfill) with a check that it is null, or set only when an election date exists and falls after it.

2. **Helpers** in `entity-terminology.ts` — `isSElected` stays as-is (current status). Add `isSElectedForTaxYear(company, taxYear)` and `isSElectedOn(company, date)`, both treating `LLC-S` as S, both requiring the election to have started by the date and no revocation to have taken effect before it. Tax-year boundaries come from the company's fiscal year end (default December 31).

3. **UI** — Incorporation tab and Organization tab. Unchecking a saved S election opens a dialog: "Did the S election end, or was it entered in error?" *Ended* asks for the effective date and stores it as the revocation date, keeping the election date. *Entered in error* clears both, as today. When a revocation date exists it is shown as an editable field, and re-checking the election is blocked with: "EntityIQ tracks one S election period. Re-election after revocation is not supported." An invalid revocation date is caught inline before saving, so the rest of the form still saves.

4. **Meeting reads** — the sites in (d) switch to the tax year when the meeting has one, otherwise the meeting date. Resolution lists resolve from entity type plus time-aware status (Corporation + S → "S Corporation"; LLC + S → "LLC-S"; Single Member LLC keeps its own list). Resolutions already saved on a meeting keep displaying and printing even if they are no longer in the selected list.

## Verification

- Election dated 2019-01-01: a tax-year-2018 meeting prints no S language; tax-year 2019 does.
- Company with no election: output byte-identical to today.
- S company, no revocation, current-year meeting: output byte-identical to today.
- Uncheck → "entered in error" behaves as before; "ended" keeps the election date and stores the revocation date.
- An invalid revocation date is blocked in the UI and does not break saving other fields.
- An S-elected corporation's meeting shows the "S Corporation" resolution list.
- Full test suite and production build, plus a list of every file changed.
