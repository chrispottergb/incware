# Entity-member signature blocks in the LLC Annual Meeting PDF

Fix: in the LLC annual meeting document, an entity member (a trust, LLC, or corporation that owns units) currently signs as just "Member: ABC Holdings, LLC" with an empty Title line — no natural person is identified. The meeting minutes builder already handles this correctly; the annual meeting builder does not. This brings the two into agreement by sharing one formatting helper.

No schema changes, no new columns, no change to how holders are entered.

## Changed files

1. `src/lib/holder-display.ts` — NEW. Home of the promoted `formatShareholderDisplay` helper.
2. `src/lib/meeting-pdf-export.ts` — remove the local helper definition, import it from the new module. Nothing else in this file changes.
3. `src/lib/annual-meeting-pdf.ts` — widen the `memberSignatures` type, render the entity By-line block, and route the members table and attendee list through the helper.
4. `src/components/AnnualMeetingWizard.tsx` — carry `owner_kind` / `representative_name` / `representative_title` from the holder records into the member, attendee, and signature lists it hands to the builder.

Out of scope and untouched: `nonprofit-annual-meeting-pdf.ts`, `org-meeting-pdf.ts` and its caller in `MeetingDetail.tsx` (its `memberSignatures` is a different SMLLC organizational-meeting shape), the `officers` table, `ShareholdersTab.tsx`.

## 1. Promote the helper

Move `formatShareholderDisplay` from `src/lib/meeting-pdf-export.ts` (lines 117-146, including its comment block) into `src/lib/holder-display.ts` as an exported function. Character-for-character identical body, same parameter shape, same three modes (`inline`, `twoLine`, `signer`), same fallbacks. `meeting-pdf-export.ts` gains one import line and loses the definition — no call site changes, no output change.

After the move there is exactly one definition in the codebase.

## 2. Entity signature blocks in `annual-meeting-pdf.ts`

Widen the type at line 86:

```ts
memberSignatures: {
  name: string;
  ownerKind?: string;
  representativeName?: string;
  representativeTitle?: string;
}[];
```

All three new fields optional, so existing callers and any saved wizard drafts keep compiling and keep rendering exactly as today.

In the Signatures section (~lines 771-790), branch per signer:

- Individual (or no `ownerKind`): unchanged — the current signature line, `Member: {name}`, `Date:`, `Title:` lines, identical geometry.
- Entity with a representative:
  ```text
  {ENTITY NAME}, Member
  By: ____________________________
      {representativeName}, {representativeTitle}
  Date: ________________
  ```
  When `representativeTitle` is empty, the second line reads `{representativeName}, Authorized Representative`.
- Entity with no representative: same block, with the `By:` rule and the name/title line left blank — an unsigned line awaiting signature, never omitted.

The entity name and representative caption come from the promoted helper's `twoLine` mode, split on its newline, rather than new formatting logic.

## 3. Members table and attendee list

- Members table (~lines 325-331): the Name cell renders through the helper's `inline` mode, so an entity member reads `ABC Holdings, LLC, represented by Jane Doe, its Trustee`. Individuals unchanged.
- Attendee list (~lines 287-295): same `inline` treatment.

Both require the corresponding row types to carry the same three optional fields.

## 4. Wizard wiring

In `src/components/AnnualMeetingWizard.tsx`, the member list is built from the company's holder records (both in `buildDefaultData` and in the effect that refreshes members from the database). Add `ownerKind`, `representativeName`, `representativeTitle` to each member row from `owner_kind`, `representative_name`, `representative_title`. Propagate them through `addAttendee` into `attendeeList`, and through the `memberSignatures` mapping at line 590. The manual add/remove signature rows in the wizard UI stay name-only and render as individuals.

## Verification

- Generate the annual meeting PDF and the meeting minutes PDF for a company whose holders are all individuals, before and after, and diff the rendered output — must be identical.
- Generate for an LLC with an entity member plus representative and confirm the two-line `By:` block, the inline form in the members table, and the inline form in the attendee list.
- Confirm a single `formatShareholderDisplay` definition remains, and that a TypeScript check passes.
