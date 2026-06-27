# Plan: Entity Shareholders with Representative (revised)

Add support for entity-type shareholders with a named representative. Individual shareholders render and behave exactly as today.

## Files to modify

### 1. Database migration (new)
Adds three columns to both `public.shareholders` and `public.meeting_shareholders`. Existing rows default to `owner_kind = 'individual'`.

### 2. Company Shareholders/Members tab
- `src/components/company/ShareholdersTab.tsx` — Add/Edit dialog: `owner_kind` dropdown (Individual / Entity) and conditional Representative Name / Title inputs; persist via existing insert/update mutations; render a small "Entity" badge next to entity names in the table.

### 3. Meeting shareholders snapshot + UI
- `src/components/meeting/MeetingSubTable.tsx` (column schema ~63–77, add-row flow ~161, 264–275, 467–483): capture/edit `owner_kind`, `representative_name`, `representative_title`; display entity rows as `"<Entity> — rep. <Name>, <Title>"` in the name cell.
- `src/components/meeting/MeetingAttendanceSelector.tsx` (line 117 branch): copy the three fields from the source `shareholders` row into the new `meeting_shareholders` row when adding from the roster.
- `src/pages/MeetingDetail.tsx` (~301–356): extend the existing address backfill effect to also backfill the three new snapshot fields when null.

### 4. PDF export — `src/lib/meeting-pdf-export.ts`
- Add a local helper `formatShareholderDisplay(s, mode)` (see Technical details for corrected logic).
- Update every output site identified in the audit, gated on `s.owner_kind === 'entity' && s.representative_name`:
  - **298, 322** — attendance push: inline string.
  - **783** — signature-name collection: push the representative name.
  - **1004 / 1014, 1370 / 1382, 1911 / 1923** — shareholders table rows: two-line name cell `"<Entity>\nrep. by <Rep>[, <Title>]"`.
  - **1412–1433** — attendance reconciliation: display-formatted string; reconciliation key stays the raw entity name.
  - **1974** — distribution RESOLVED clause: `"…distribute the sum of $X to <Entity>, represented by <Rep>…"`.
  - **3485–3492** — signature collection (Written Consent): see Technical details for the corrected approach.

### 5. Out of scope
- `src/lib/entity-terminology.ts`, all non-shareholder PDF sections, and all RLS policies — untouched.

## Technical details

### Fix #1 — `formatShareholderDisplay` inline mode (corrected)

```ts
function formatShareholderDisplay(
  s: { shareholder_name?: string; name?: string; owner_kind?: string;
       representative_name?: string; representative_title?: string },
  mode: "inline" | "twoLine" | "signer"
): string {
  const base = s.shareholder_name || s.name || "";
  if (s.owner_kind !== "entity" || !s.representative_name) return base;
  const title = (s.representative_title || "").trim();
  if (mode === "signer")  return s.representative_name;
  if (mode === "twoLine") return title
    ? `${base}\nrep. by ${s.representative_name}, ${title}`
    : `${base}\nrep. by ${s.representative_name}`;
  // inline
  return title
    ? `${base}, represented by ${s.representative_name}, its ${title}`
    : `${base}, represented by ${s.representative_name}`;
}
```

"its <Title>" is now only appended when `representative_title` is a non-empty trimmed string.

### Fix #2 — Signature block shape (lines 3485–3492)

Current shape pushed into `wcSigners` (a `SignerRow[]`):

```ts
wcAddUnique({
  name: s.shareholder_name,
  shares: Number(s.common_shares ?? 0) || 0,
  ownership: Number(s.preferred_shares ?? 0) || 0,
});
```

And the renderer at line 3520 builds the visible label as:

```ts
let label = `${s.name}, ${signerRoleLabel}`;
```

`SignerRow` currently only has `name`, `shares`, and `ownership`. There is **no** `title` or `entityFor` field, and the renderer always appends a single `signerRoleLabel` (e.g. "Shareholder" / "Member"). So my earlier proposal to push `{ name, title, entityFor }` was wrong — those properties would be dropped and "entityFor" would not appear anywhere.

Two viable options:

**Option A (recommended — no type changes):** Encode the entity context directly into the `name` string we push, so it flows through the existing renderer unchanged.

```ts
const isEntity = s.owner_kind === "entity" && s.representative_name;
const signerName = isEntity
  ? `${s.representative_name}, as ${s.representative_title?.trim() || "Authorized Representative"} of ${s.shareholder_name}`
  : s.shareholder_name;

wcAddUnique({
  name: signerName,
  shares: Number(s.common_shares ?? 0) || 0,
  ownership: Number(s.preferred_shares ?? 0) || 0,
});
```

Resulting label (line 3520) becomes, e.g.:
`"Jane Doe, as President of Acme Holdings LLC, Shareholder  —  Shares Held: 1,000"`

The deduplication key at line 3475 (`name.toLowerCase()`) still works because the entity-qualified string is unique per (entity, representative) pair.

**Option B (heavier — extend the type):** Add optional `title?: string` and `entityName?: string` to `SignerRow`, then modify the renderer at line 3520 to assemble a two-line block (signer name on the signature line, "as <title> of <entity>" on a sub-line). This is cleaner visually but touches the signature renderer for every meeting type, not just entity rows.

I recommend **Option A** because it satisfies the constraint "no changes to any other meeting type's PDF" — the renderer is untouched and individuals continue to render byte-for-byte identically.

### Migration SQL

```sql
ALTER TABLE public.shareholders
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'individual'
    CHECK (owner_kind IN ('individual', 'entity')),
  ADD COLUMN representative_name  text,
  ADD COLUMN representative_title text;

ALTER TABLE public.meeting_shareholders
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'individual'
    CHECK (owner_kind IN ('individual', 'entity')),
  ADD COLUMN representative_name  text,
  ADD COLUMN representative_title text;
```

No RLS / GRANT changes (columns only). Existing rows get `owner_kind = 'individual'` via the DEFAULT.

### Verification

1. Create one entity shareholder with a representative + one individual.
2. Add both to a meeting roster; confirm the snapshot rows carry the three new fields.
3. Generate the meeting PDF — verify attendance line, shareholders table (two-line cell), distribution clause, and signature block (entity gets "Jane Doe, as President of Acme Holdings LLC, Shareholder").
4. Generate a PDF for a meeting with only individuals and diff against a prior export — expect zero changes.