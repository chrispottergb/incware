# Three Template Fixes (pre-Ratification)

Surgical, non-destructive. No schema, query, section-numbering, or heading changes.

## Fix 1 — "that that" in every RESOLVED clause

`src/lib/meeting-pdf-export.ts`, `addWhereasResolved()` (blue-theme branch, line 734) unconditionally prepends `"that "` after stripping `NOW, THEREFORE, BE IT` and `RESOLVED,`. Since ~20 call sites pass `NOW, THEREFORE, BE IT RESOLVED, that …`, the remaining body already starts with `that`, producing `RESOLVED, that that …`. Confirmed: the sibling helper `addResolutionBlock()` (line ~604) already guards with `bodyLower.startsWith("that ")`.

- Apply the same guard at line 734: trim + lowercase the body, prepend `"that "` only when it does not already start with it.
- Call sites are left untouched.
- Update (do not delete) the comment at lines 2498–2499, which currently warns that the helper auto-injects `that`.

`src/lib/annual-meeting-pdf.ts` (LLC builder), Section 13 line 649: `resolvedPara(\`that ${r.resolved}\`)` has the same hazard for user-typed resolutions. Add a tiny local guard so a stored resolution beginning with `that` is not double-prefixed. Other `resolvedPara` calls in that file use fixed literals and are left alone.

## Fix 2 — Registered agent statute

`src/lib/meeting-pdf-export.ts` lines 3465–3474 hardcode `Wis. Stat. § 183.0113` (LLC chapter, wrong section) with no entity-type branching, and print it even when the state of incorporation is not Wisconsin.

- Add `getRegisteredAgentStatute(entityType, state)` near `getStatutoryCloseStatute` (line ~22): returns `null` for non-Wisconsin states; `§ 181.0501` for non-profit; `§ 183.0115` for LLC / limited liability; `§ 180.0501` otherwise.
- Rebuild the WHEREAS recital to use the entity word (`limited liability company` / `corporation`) and omit the citation entirely when the helper returns `null`.
- `src/lib/annual-meeting-pdf.ts` line 656 (LLC-only path): `183.0113` → `183.0115`.
- `src/components/AnnualMeetingWizard.tsx` lines ~1649 and ~1661 (preview): same change so preview matches PDF.
- Out of scope, untouched: `meeting-pdf-export.ts:1993` (§ 183.0407, correctly gated on `isLLC`), `org-meeting-pdf.ts:213`, `OrgMeetingWizard.tsx:305` (see Amendment B — citation text stays, a guard goes in instead).

## Amendment A — WIComplianceChecklist LLC registered-agent item (text only)

`src/components/company/WIComplianceChecklist.tsx`, `llc_registered_agent` item (lines 374–378). Entity-type gated, so no corporation sees it, but the citation is wrong and the description cites § 183.0115 for resignation while § 183.0115 is the maintenance provision.

- `statute: "§ 183.0113"` → `"§ 183.0115"`.
- Rewrite the description: keep the maintenance sentence and the § 183.0114 statement-of-change reference; drop the resignation sentence rather than guess a section number.
- Displayed text only — no logic, gating, or other checklist items.

## Amendment B — OrgMeetingWizard guard (not a citation fix)

`src/components/OrgMeetingWizard.tsx` picks the generator with `isSmllc ? generateSmllcOrgMeetingPDF : generateOrgMeetingPDF` — a single-member-LLC vs. everything-else branch. `org-meeting-pdf.ts` is an LLC-only template (`${data.companyName}, LLC`, Articles of Organization, Ch. 183 cites), so a Corporation, S-Corp, or Non-Profit would receive LLC minutes.

- Add a guard at the top of `OrgMeetingWizard`: when `isLLCType(company?.entity_type)` is false, render a short blocking message ("Organizational meeting minutes are currently available for LLCs only. Corporation and non-profit templates are coming soon.") instead of the wizard steps, so neither generator is reachable.
- The § 183.0113 text in `OrgMeetingWizard.tsx` and `org-meeting-pdf.ts` is deliberately left as-is this pass. Making `org-meeting-pdf.ts` entity-aware is a new template, out of scope.

Reachability, confirmed: `OrgMeetingWizard` is imported by `src/components/company/MeetingsTab.tsx:51` and rendered in a Dialog at line 891 bound to `orgWizardOpen` (line 120) — but there is no `setOrgWizardOpen(true)` anywhere in the repo, so the dialog can never open. It is dead code today. The guard still goes in.

## Amendment C — report only, no change

`WIComplianceChecklist.tsx:33` derives `const isCorp = !isLLC;`, so Non-Profit and Partnership entities fall into the corporation branch (line 573) and are shown the Ch. 180 business-corporation checklist — stock certificates § 180.0625, shareholder inspection § 180.1602, and a "Ch. 180 Business Corporations" header. Wisconsin non-profits are nonstock corporations under Ch. 181. Confirmed, left unchanged, to be scoped separately.

## Fix 3 — Section 1 opening sentence

`src/lib/meeting-pdf-export.ts` line ~1393 builds:
`The ${meetingLabel} of the ${stateOfInc} ${entityLabel} was held on …`
— which prints the abbreviation (`WI`) and omits the company name.

Target:
```text
The Annual Meeting of the Board of Directors of ABC Electric, Inc., a Wisconsin corporation, was held on Monday, April 13, 2026, at 10:30 AM, at 314 N. Any Ave., Anytown, Wisconsin.
```

- Company name: reuse the existing `companyName` (already `meeting.company_name_at_meeting || company.name`).
- Add a `US_STATE_NAMES` abbreviation→name lookup in this file; pass through unchanged values that are already full names or unrecognized. Apply it to both the "a {State} {entity}" phrase and the trailing location state.
- Body word from entity type: `Board of Directors` / `Members` / `Shareholders`; entity word `corporation` / `limited liability company` / `nonstock corporation`. Derived from the existing `isLLC` / `isNonprofit` / `isShareholder` flags and `entity-terminology.ts` — no new entity-type string comparisons.
- Shareholder-meeting intro (the branch above) is unchanged.

## Explicitly not touched

`addResolutionBlock()`, `src/lib/nonprofit-annual-meeting-pdf.ts`, any DB object, section numbering/ordering/headings, and unrelated nearby code (anything noticed gets reported, not changed).

## Verification

Drive the preview with Playwright and inspect generated PDF text for: corporation (no `that that`, `§ 180.0501`), LLC through both builders (`§ 183.0115`), non-profit (`§ 181.0501`), a Delaware entity (recital with no citation), Section 1 naming the company with the state spelled out for all three entity types, exactly one `that` per resolution including manually typed ones, and unchanged section numbers. Run typecheck and the existing test suite.
