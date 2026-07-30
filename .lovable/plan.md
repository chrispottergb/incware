## Verification: LLC-S approving body — **Case (a): LLC-S is always multi-member**

Evidence gathered:

- Single-member LLCs that elect S-corp treatment are modeled as entity type **`Single Member LLC` plus an `s_election_date`**, not as `LLC-S`: `src/components/company/SMOperatingAgreementGenerator.tsx:198` computes `isScorpElected = !!company.s_election_date` and switches to the dedicated single-member S-corp document generator `src/lib/smllc-scorp-operating-agreement-pdf.ts`.
- `src/components/company/OrganizationTab.tsx` treats `LLC-S` as its own type where the S election is *implied* ("not LLC-S where it's implied"), and shows the checkbox-based S-election only for `LLC` / `Single Member LLC`.
- No code anywhere forks `LLC-S` on member count; `isLLCType()` in `src/lib/entity-terminology.ts` has no single-member branch for it. `src/components/CreateCompanyWizard.tsx:33` offers only `Corporation, LLC, Single Member LLC, Non-Profit, Partnership`, and its auto-detect (line 197) maps 1 member → `Single Member LLC`, else `LLC` — `LLC-S` is never auto-assigned.
- Database check: 0 companies currently use `LLC-S` (29 Corporation, 16 LLC, 4 Single Member LLC, 4 Non-Profit).

**Conclusion:** no single-member LLC-S variant is needed. The LLC-S template keeps plural "Members" wording, and a clarifying comment is added in `resolution-types.ts`:

```ts
// LLC-S entity type assumes multi-member; single-member LLCs electing S-corp status
// use the "Single Member LLC" entity type with an s_election_date instead.
```

## A. Placeholder token audit — result

- **`[Organization Name]` (spaced)** — 6 occurrences, all in `src/lib/resolution-types.ts`: the 5 charitable templates (lines 126, 155, 177, 205, 232) plus the Non-Profit "Approve AI Governance Policy" consent caption (line 256), which refers to the nonprofit itself, not a charity payee — out of scope, unchanged.
- **`[OrganizationName]` (no space)** — 0 existing occurrences.
- **Parsing logic** — the only bracket-token substitution in the app is `src/components/meeting/MeetingResolutions.tsx:226-230`, which replaces `[YEAR]` only. `[Amount]`, `[TaxYear]`, `[Officer Name]`, `[Organization Name]` are literal text users edit; no PDF generator, edge function, or other component parses them.

**Conclusion:** the rename is scoped to the 5 charitable templates and touches no shared parsing logic.

## B. Final template text — all five entity variants

**Corporation** (`Wis. Stat. § 180.0302`)
```text
WHEREAS, during the tax year ending [TaxYear], the corporation made charitable contributions in the total amount of $[Amount] to [OrganizationName];

RESOLVED, that the Shareholders hereby confirm, approve, and ratify the charitable contributions as expenditures made in the best interests of the corporation.
```

**S Corporation** (`Wis. Stat. § 180.0302; IRC § 1362`)
```text
WHEREAS, during the tax year ending [TaxYear], the corporation made charitable contributions in the total amount of $[Amount] to [OrganizationName];

RESOLVED, that the Shareholders hereby confirm, approve, and ratify the charitable contributions as expenditures made in the best interests of the corporation.
```

**LLC** (`Wis. Stat. § 183.0301`)
```text
WHEREAS, during the tax year ending [TaxYear], the company made charitable contributions in the total amount of $[Amount] to [OrganizationName];

RESOLVED, that the Members hereby confirm, approve, and ratify the charitable contributions as expenditures made in the best interests of the company.
```

**Single Member LLC** (`Wis. Stat. § 183.0301`) — singular approving body and verbs
```text
WHEREAS, during the tax year ending [TaxYear], the company made charitable contributions in the total amount of $[Amount] to [OrganizationName];

RESOLVED, that the Managing Member hereby confirms, approves, and ratifies the charitable contributions as expenditures made in the best interests of the company.
```

**LLC-S** (`Wis. Stat. § 183.0301; IRC § 1362`) — multi-member, plural Members retained per the verification above
```text
WHEREAS, during the tax year ending [TaxYear], the company made charitable contributions in the total amount of $[Amount] to [OrganizationName];

RESOLVED, that the Members hereby confirm, approve, and ratify the charitable contributions as expenditures made in the best interests of the company.
```

Conditional micro-note appended (all variants) when **Not deductible / book expense only** is selected:
```text
Tax Treatment Note: The contributions were recorded as expenses for financial reporting purposes. They were not deducted on the federal income tax return and were reflected on Schedule M-1 as expenses recorded on books but not deducted on the return.
```

All five blocks are reproduced in a comment above the charitable entries in `resolution-types.ts`.

## Implementation

**1. `src/lib/resolution-types.ts`** — replace the five charitable templates with the text above; labels and statutes unchanged; add the reference comment block and the LLC-S assumption note.

**2. New `src/components/meeting/CharitableContributionFields.tsx`** — shared panel shown only when the selected purpose is "Approve Charitable Contributions" and only for new resolutions (editing keeps plain free-text):

- **Tax Year** — text input, required, defaults to the meeting date's year.
- **Amount** — currency input, required.
- **Organization Name** — text input prefilled with the literal default `a qualified charitable organization(s)`, always editable, comma-separated list allowed.
- **Tax Treatment** — required radio group:
  - *Deductible charitable contribution* — "The organization was a qualified charity and the corporation claimed the deduction."
  - *Not deductible / book expense only* — "The contribution was recorded as an expense but not deducted (includes contributions to unqualified organizations)."

Every field change recomposes the resolution textarea from the entity's template and adds/removes the Tax Treatment Note; the textarea stays editable. Validation runs at submit against current values — no auto-clearing on radio change:
- missing Tax Year, Amount, or Tax Treatment → inline error, submit blocked;
- Deductible selected **and** Organization Name exactly equals the default string → inline error "Please enter the name of the qualified charitable organization(s)."

**3. `src/components/meeting/MeetingResolutions.tsx`** and **4. `src/components/WrittenConsentWizard.tsx`** — mount the shared panel and gate their submit handlers on its validation so both entry points behave identically.

Only the composed text is saved to `meeting_resolutions.resolution_text`. No migration; PDF generators untouched; existing saved resolutions keep their text.

## Verification

Add the resolution from a corporate meeting and from the Written Consent wizard: confirm submit is blocked with no tax treatment, blocked on Deductible + untouched default organization, the note appears only for the non-deductible option, and the saved text renders correctly in the meeting PDF.
