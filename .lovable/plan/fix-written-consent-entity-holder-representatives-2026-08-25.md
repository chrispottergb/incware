# Fix written-consent entity-holder representatives

Non-destructive, two-file data-path correction. No schema/default changes and no PDF-renderer changes.

## Changed files

1. `src/components/WrittenConsentWizard.tsx`
2. `src/pages/MeetingDetail.tsx`

This is the complete changed-file list; it will be reported before edits are applied.

## Implementation

### `WrittenConsentWizard.tsx`

Carry the existing holder metadata through every written-consent transformation:

- In each signer mapping sourced from `shareholders` (corporate shareholder consent, single-member LLC, member-managed LLC, and partnership fallback), add camel-case signer fields sourced from `owner_kind`, `representative_name`, and `representative_title`.
- Leave director/manager/nonprofit signer mappings without representative values, preserving their current behavior.
- In `buildConsentPdfData()`, replace the hardcoded null representative fields in `signatureRows` with the signer's actual values. Also carry holder metadata into the in-memory shareholder rows so preview data and saved data have matching shapes.
- In the `meeting_shareholders` insert, copy `owner_kind`, `representative_name`, and `representative_title` from the authoritative shareholder row already resolved as `sh`.
- In the `meeting_signatures` upsert, replace the hardcoded null representative fields with the signer's actual values.
- Keep names, roles, ownership calculations, signature dates, sort order, save behavior, and the generated PDF renderer unchanged.

### `MeetingDetail.tsx`

Widen the existing recovery predicate so entity metadata is restored when either:

- the meeting snapshot has no `owner_kind`, or
- it says `individual` while the matching current shareholder row authoritatively says `entity`.

When that mismatch is detected, reuse the existing update path to copy `owner_kind`, `representative_name`, and `representative_title`. True individual holders remain untouched.

## Verification

- Add or run a targeted fixture-based regression check proving an entity holder reaches preview and persisted payloads with its representative name/title and renders through the existing written-consent PDF path as:
  ```text
  The Stiegler Company, Inc., represented by [name], its [title]
  Member
  Date signed: ______
  ```
- Verify a fixture containing only individual signers produces unchanged signer/shareholder payloads and byte-identical PDF bytes before versus after where deterministic; otherwise compare normalized PDF text and drawing structure while confirming the individual rendering branch is untouched.
- Exercise the `MeetingDetail` recovery condition for the erroneous `individual` snapshot versus authoritative `entity` source case, and confirm a genuine individual does not trigger recovery.
- Run targeted tests/type validation, check the preview flow, and inspect the latest build result.

## Data note

The current Stiegler shareholder row is classified as `entity`, but its live `representative_name` and `representative_title` are empty. Per the selected approach, live data will not be modified; Stiegler-format acceptance will be verified with a temporary fixture carrying representative values.

## Explicitly untouched

- Database schema and column defaults
- `src/lib/meeting-pdf-export.ts`
- `src/lib/annual-meeting-pdf.ts`
- Holder-display helper promotion work
- Any live shareholder or meeting data
