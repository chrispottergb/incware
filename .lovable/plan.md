## Goal

Add a new plain-English Organizational Meeting Minutes PDF for single-member LLCs. The existing multi-member generator stays as-is; SMLLCs are routed to the new template automatically based on entity type and member count.

## New file: `src/lib/smllc-org-meeting-pdf.ts`

Signature: `export function generateSmllcOrgMeetingPDF(data: OrgMeetingData): jsPDF` — reuses the existing `OrgMeetingData` interface re-exported from `org-meeting-pdf.ts` (no wizard or interface changes).

### Implementation approach

The helpers in `org-meeting-pdf.ts` (`heading`, `para`, `resolvedPara`, `checkPage`, footer logic) are local closures, not exports. Rather than refactoring that file, the new SMLLC generator will **define its own equivalents inline** (same exact styling rules) so the change is fully additive and the multi-member path is untouched. Shared imports:

- `jsPDF` from `jspdf`
- `autoTable` from `jspdf-autotable`
- `registerArialFont` from `@/lib/arial-font`
- `format` from `date-fns`
- `type OrgMeetingData` from `@/lib/org-meeting-pdf`

Styling identical to `org-meeting-pdf.ts`: Arial via `registerArialFont`, 1.15 line height, 90pt left / 54pt right margins, BLUE `#1F4E79` headers with light-blue (`#D6E4F0`) underline rule, page footer with company name + page numbers, `RESOLVED, ` prefix bolded and indented 36pt.

### Input resolution from existing `OrgMeetingData` fields

Mapping uses the **actual** field names in the project:

- `llcName = data.companyName + ", LLC"` (matches existing generator)
- `member = data.members?.[0]` — uses `name`, `address`, `membershipUnits`, `membershipInterestPct`
- `managingMember = data.managers?.[0] ?? { name: member?.name ?? "", title: "Managing Member" }`
- `chairperson = data.chairperson || member?.name`
- `secretary = data.secretary || member?.name`
- `stateOfFormation`, `stateAgency`, `filingDate`, `registeredAgentName`, `registeredAgentAddress`
- `fiscalYearEnd`, `firstFiscalYearEnd`, `accountingMethod`
- `bankName`, `bankCity` — banking section gated by `data.includeBanking`
- `authorizedBinders` — uses `name`, `title`, `scopeOfAuthority` (not `scope`)
- `businessPurpose`, `operatingAgreementAdopted`

Dates formatted with `format(new Date(value + "T12:00:00"), "MMMM d, yyyy")` to match the existing generator's pattern.

### Document sections (exact order)

1. **Title** — `ORGANIZATIONAL MEETING MINUTES` / `OF {llcName}` (centered, blue, bold).
2. **Meeting Overview** — single plain-English paragraph: date/time/location, sole Member present, Chairperson + Secretary, purpose.
3. **Confirmation of Formation** — RESOLVED ratifying the Articles of Organization filing with `{stateAgency}` on `{filingDate}`.
4. **Registered Agent** — RESOLVED confirming `{registeredAgentName}` at `{registeredAgentAddress}`.
5. **Fiscal Year & Accounting Method** — RESOLVED with `{fiscalYearEnd}`, `{firstFiscalYearEnd}`, `{accountingMethod}`.
6. **Management** — RESOLVED appointing `{member.name}` as Managing Member with full authority to manage the Company.
7. **Initial Member & Capital Contribution** — RESOLVED + `autoTable` with columns Name / Address / Units / % (single row from `members[0]`, percentage suffixed with `%`).
8. **Adoption of Operating Agreement** — RESOLVED when `operatingAgreementAdopted` is true; otherwise one sentence noting future adoption. No WHEREAS.
9. **Banking Resolutions** — single section, rendered only when `includeBanking && bankName`; designates `{member.name}` as the authorized signer at `{bankName}, {bankCity}`.
10. **Business Purpose** — RESOLVED with `{businessPurpose}`.
11. **General Authorization** — RESOLVED combining authorization to execute documents **and ratification of prior actions** taken by the Member in connection with formation (ratification merged here per spec).
12. **Authorized Binder** — RESOLVED designating `{member.name}` under Wis. Stat. § 183.0301; if `authorizedBinders` has explicit entries, render a Name / Title / Scope `autoTable` (sourced from `scopeOfAuthority`) instead.
13. **Adjournment** — one sentence.
14. **Signature block** — two signature lines only: **Managing Member** (`{managingMember.name}`) + Date, and **Secretary** (`{secretary}`) + Date. No officers, no board, no member roster signatures.

### Content rules enforced

- "Member" / "Managing Member" only — no "Board," no "officers," no compensation language.
- No WHEREAS clauses anywhere.
- All resolutions use the bold `RESOLVED, ` prefix.
- S-Corp election, multi-member roster, multi-signer banking, and multi-manager tables from the current generator are intentionally omitted.

## Routing change

`src/components/OrgMeetingWizard.tsx` is the sole caller of `generateOrgMeetingPDF`. At the existing PDF generation call site, branch:

```ts
import { generateOrgMeetingPDF } from "@/lib/org-meeting-pdf";
import { generateSmllcOrgMeetingPDF } from "@/lib/smllc-org-meeting-pdf";
import { isLLCType } from "@/lib/entity-terminology";

const isSmllc =
  isLLCType(company.entity_type) && (data.members?.length ?? 0) <= 1;
const doc = isSmllc
  ? generateSmllcOrgMeetingPDF(data)
  : generateOrgMeetingPDF(data);
```

Branch replaces only the single line that currently calls `generateOrgMeetingPDF`. The download/preview pipeline that consumes `doc` is unchanged. No UI/wizard changes.

## Out of scope

- No DB migration, no `OrgMeetingData` interface changes, no new wizard step.
- Multi-member LLC and corporate org meeting paths untouched.
- No changes to operating agreement generators or version history.

## QA

After build, generate one SMLLC org meeting PDF from the wizard, save the file to `/tmp`, render pages to images with `pdftoppm`, and verify: section order matches spec, no clipping/overflow, single banking section, no WHEREAS, signature block shows only Managing Member + Secretary.
