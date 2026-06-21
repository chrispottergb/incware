
# Statutory Close Corporation PDF Customization

All edits live in **`src/lib/meeting-pdf-export.ts`** only. Every change is gated on `isStatutoryClose === true` (where `isStatutoryClose = isShareholder && meeting.sub_type === "Statutory Close Corporation"`). Standard shareholder, LLC, and Annual Meeting of Directors PDFs are untouched.

## Changes

### 1. State-aware statute citation helper
Add a module-level helper:

```ts
const getStatutoryCloseStatute = (state?: string | null): string => {
  const statutes: Record<string, string> = {
    AZ: "Ariz. Rev. Stat. § 10-1801 et seq.",
    CA: "Cal. Corp. Code § 158 et seq.",
    DE: "Del. Code Ann. tit. 8, § 342 et seq.",
    FL: "Fla. Stat. § 607.0902 et seq.",
    IL: "805 Ill. Comp. Stat. 5/2A.05 et seq.",
    MD: "Md. Code Ann., Corps. & Ass'ns § 4-101 et seq.",
    MI: "Mich. Comp. Laws § 450.1489 et seq.",
    MN: "Minn. Stat. § 302A.671 et seq.",
    MO: "Mo. Rev. Stat. § 351.755 et seq.",
    NJ: "N.J. Stat. Ann. § 14A:5-21 et seq.",
    NY: "N.Y. Bus. Corp. Law § 620 et seq.",
    OH: "Ohio Rev. Code Ann. § 1701.591 et seq.",
    PA: "15 Pa. Cons. Stat. § 1571 et seq.",
    SC: "S.C. Code Ann. § 33-17-101 et seq.",
    TX: "Tex. Bus. Orgs. Code § 21.701 et seq.",
    WI: "Wis. Stat. § 180.1801 et seq.",
  };
  return statutes[(state ?? "").toUpperCase()] ?? "applicable state close corporation statutes";
};
```

Used only in the governance notice block (Change 2). Null/undefined/unknown state falls back to the generic string — never throws, never renders blank.

### 2. Waiver of Notice purposes (around line 768)
Inside `addWaiverOfNoticePages`, compute `const isStatutoryClose = isShareholderMeeting && (meeting?.sub_type || "") === "Statutory Close Corporation";`. When true, replace shareholder `purposes[0]`:
- `"elect a new board of directors"` → `"elect officers of the corporation"`

Second purpose unchanged. Standard shareholder waiver untouched.

### 3. Governance Notice block (in `exportMeetingPdf`, just before line 1213 `y = section("Meeting Information")`)
When `isStatutoryClose`, render a bold heading + paragraph (not numbered, so "Meeting Information" stays as Section 1):

```
STATUTORY CLOSE CORPORATION GOVERNANCE NOTICE

[Company Name] is organized as a Statutory Close Corporation pursuant to
${getStatutoryCloseStatute(company?.state)}. This corporation operates without a
board of directors. All governance powers vested by statute in a board of
directors are exercised directly by the shareholders of the corporation. The
actions taken at this meeting are made in that capacity.
```

Page-break check before render; blue-theme color for the heading to match surrounding sections.

### 4. Section 3 — Presentation of Corporate Records (lines 1520–1556)
This block executes for statutory close meetings. Gate the wording:
- Line 1534: when `isStatutoryClose`, replace `"minutes of the board of directors, … by the board of directors since the last annual meeting…"` with `"minutes of the shareholders, covering all purchases, contracts, contributions, compensations, acts, authorizations, decisions, proceedings, elections, and appointments by the shareholders since the last annual meeting"` (date suffix preserved when present).
- Line 1556 ratification: replace `"by the board of directors since the last annual meeting"` with `"by the shareholders since the last annual meeting"`.

### 5. Officers section (lines 1690–1720)
Statutory close shareholder meetings render this section (since `isShareholderOnly = isShareholder && !isStatutoryClose`). When `isStatutoryClose`, swap:
- Line 1703 WHEREAS → `"the shareholders have reviewed"`
- Line 1710 WHEREAS → `"the shareholders have determined"`
- Line 1718 RESOLVED → `"which the shareholders have determined to be reasonable compensation"`

### 6. All remaining "Board of Directors" / "the Board" sites
For each site below, when `isStatutoryClose`, substitute "the shareholders" / "The Shareholders" with correct verb agreement ("have"). Localized ternary swaps only — no structural change:

- Lines 1448, 1450 — Section 1244 WHEREAS clauses
- Line 1563 — Call to Order WHEREAS
- Line 1769 — officer compensation intro
- Line 1884 — distribution: `"The Board of Directors confirmed"` → `"The shareholders confirmed"`
- Line 1917 — financial statements review
- Line 2121 — legal counsel
- Line 2175 — accounting needs
- Line 2278 — banking relationship review
- Line 2317 — borrowing/loans
- Line 2724 — lease terminations
- Line 2754 — lease obligations
- Line 2860 — governing document amendments
- Lines 2915, 2921 — compensation/bonus reviews
- Line 2944 — benefit plan review
- Line 2968 — financing determination
- Line 2983 — authorized signer update
- Line 2997 — employee benefits review
- Line 3140 — agreement ratification ("by the Board of Directors" → "by the shareholders")
- Line 3210 — authorized signers review

### 7. General Authorization WHEREAS (line 3243)
When `isStatutoryClose`: `"WHEREAS, the Board of Directors recognizes"` → `"WHEREAS, the shareholders recognize"`. The Registered Agent Confirmation block at line 3231 uses only a Wis. Stat. § 183.0113 WHEREAS and is left unchanged.

### 8. Implementation pattern
Inside `exportMeetingPdf`, two small helpers keep call sites tidy and preserve byte-identical output when `isStatutoryClose === false`:

```ts
const boardLabel = () =>
  isLLC ? "members" : (isStatutoryClose ? "shareholders" : "Board of Directors");
const boardVerb = (corpSingular: "has" | "have") =>
  isLLC ? "have" : (isStatutoryClose ? "have" : corpSingular);
```

### Not changed
- Document title / "Meeting of Shareholders" / "Minutes of the Annual Meeting of Shareholders" headers
- Standard Annual Meeting of Shareholders rendering
- Annual Meeting of Directors PDF
- LLC member rendering
- Database, tabs, forms, any other file

## Verification
Generate a PDF for a Statutory Close Corp shareholder meeting (WI and a non-WI state, and a company with null state) and confirm: governance notice appears before Section 1 with the correct state-specific citation (or the generic fallback); waiver purposes show "elect officers"; corporate records, officers, financials, banking, agreements, and General Authorization sections read "shareholders". Generate a non–statutory-close shareholder meeting PDF and confirm output is byte-identical to current.
