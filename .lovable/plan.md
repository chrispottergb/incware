## Diagnosis

### Bug (a): `landlord_address` not saving on new lease

In `LeasesTab.tsx`, **the simplified Part 1 form has no input for `landlord_address`** (only a single "Landlord" name field, lines 419-421). The save payload (line 147) does include `landlord_address: form.landlord_address || null`, but `form.landlord_address` is always `""` because the user has no way to enter it in Part 1. It can only be edited in Part 2 of the modal — and only when `landlordParty.kind !== "external"` (line 147 of `GenerateLeaseModal.tsx`), or via the `EntityPartyPicker`'s `externalAddress` prop. The default landlord party is `{ kind: "external" }`, so the address field is hidden unless the picker exposes it.

### Bug (b): `lease_date` and `lease_term` blank in Generate Lease modal

These two fields **were intentionally removed from Part 1** per the refactor spec (lease_date, lease_term moved to Part 2). They live only in `emptyForm` defaults as `""`. When the user opens Part 1, fills it out, then clicks "Generate Lease Document", `saveLease` runs and persists the row — but `form.lease_date` and `form.lease_term` are still `""`. The modal opens bound to `form.lease_date` / `form.lease_term`, which are empty strings. There is **no auto-derivation** from `lease_start_date` (which IS in Part 1) and no fallback. So they appear blank even though the user provided a start date.

### Bug (c): Preview Lease renders blank

`onPreview` (line 531-535) is bound to `editId`. After a brand-new lease is saved via "Generate Lease Document", `goingToPart2Ref` is true, so `onSuccess` does `if (savedId) setEditId(savedId); return;` (line 218) — `editId` IS set. So the preview button is enabled. The fetch then re-reads the row from `company_assets` and calls `generateAgreement(data, "preview")`.

But `generateAgreement` builds its `data` object using **`companyName` and `companyAddress` props from the parent** for `tenantName` / `tenantAddress` (lines 320-321), and uses `lease.landlord_address`, `lease.lease_date`, `lease.lease_term` from DB. Since landlord_address never saved (bug a) and lease_date/lease_term were never entered (bug b), most fields fall back to `_______________` — but the PDF should still render with placeholders, not blank.

The actual blank-iframe cause is likely that **`previewLeaseAgreement` opens its overlay iframe BEFORE `generateLeaseAgreementPdf` finishes synchronously emitting the blob** — but more importantly, the function calls `registerArialFont(doc)` (line 69 of `lease-agreement-pdf.ts`), which is asynchronous in some implementations. If `registerArialFont` returns a Promise but isn't awaited, jsPDF may render with a missing font, producing a blank page in some browsers (Chrome with WOFF font registration race).

A second contributing factor: the preview overlay is appended to `document.body` **inside the existing open Dialog** (`genModalOpen=true` keeps a Radix Dialog with focus trap mounted). Radix's focus trap can intercept iframe load events and/or the `<iframe>` may be hidden behind the dialog's z-index since the overlay is `z-index: 99999` but Radix portals can sit at higher stacking contexts in some configs. More commonly, the iframe loads but the Dialog's `pointer-events: none` body lock prevents interaction so it appears blank.

Need to verify `registerArialFont` is sync vs async — that's the most likely root cause.

## Plan

### 1. Fix landlord_address save (Bug a)

Add a "Landlord Address" input to Part 1, placed directly under the Landlord name field (in the same `grid grid-cols-2` row, restructured to its own row). Bind to `form.landlord_address`. The existing save payload already handles it.

### 2. Auto-populate lease_date and lease_term in Part 2 (Bug b)

When the user clicks "Generate Lease Document", before opening the modal, derive sensible defaults if Part 2 fields are empty:
- `lease_date`: default to `form.lease_start_date` if `form.lease_date` is empty
- `lease_term`: compute from `lease_start_date` + `lease_end_date` (e.g., "12 months", "3 years 2 months") if blank

Apply these defaults to `form` state via `setForm` BEFORE `saveLease.mutateAsync()` so the DB row is also populated. Add a helper `computeLeaseTerm(start, end)` in `LeasesTab.tsx`.

### 3. Fix blank Preview Lease (Bug c)

Two-part fix:
- **Make `previewLeaseAgreement` properly handle async font registration**: inspect `src/lib/arial-font.ts` to see if `registerArialFont` is async. If so, make `generateLeaseAgreementPdf` async and `await` it. Update `previewLeaseAgreement` and `downloadLeaseAgreement` to be async.
- **Render preview outside the Radix Dialog**: append the overlay to `document.body` works, but to avoid Radix focus-trap interference, briefly close the modal (`onOpenChange(false)`) before opening the preview, or render the iframe in a Radix Portal-safe way. Simpler: in `LeasesTab`'s `onPreview`, call `setGenModalOpen(false)` first, then `await generateAgreement(data, "preview")`.

### 4. Verification

- File to inspect first: `src/lib/arial-font.ts` to confirm sync/async behavior of `registerArialFont`.

## Technical notes

**Files to edit:**
- `src/components/company/LeasesTab.tsx` — add landlord_address field to Part 1; auto-fill lease_date/lease_term before opening modal; close modal before preview.
- `src/lib/lease-agreement-pdf.ts` — make pdf generation async if font registration is async; ensure iframe receives a fully-rendered blob.
- (Possibly) `src/components/company/leases/GenerateLeaseModal.tsx` — no change needed; bindings already correct.

**Key snippets:**

```tsx
// Part 1: add landlord address input
<div className="field-group">
  <Label className="field-label">Landlord Address</Label>
  <Input className="h-8 text-sm" value={form.landlord_address}
    onChange={(e) => setForm((p) => ({ ...p, landlord_address: e.target.value }))}
    placeholder="Street, City, State ZIP" />
</div>
```

```tsx
// Before opening Part 2, derive defaults
const computeTerm = (s: string, e: string) => {
  if (!s || !e) return "";
  const start = new Date(s + "T00:00:00");
  const end = new Date(e + "T00:00:00");
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months <= 0) return "";
  if (months % 12 === 0) return `${months / 12} year${months/12 > 1 ? "s" : ""}`;
  return `${months} months`;
};

// In Generate Lease Document onClick, before mutateAsync:
setForm((p) => ({
  ...p,
  lease_date: p.lease_date || p.lease_start_date,
  lease_term: p.lease_term || computeTerm(p.lease_start_date, p.lease_end_date),
}));
```

```tsx
// Preview: close modal first to avoid focus-trap interference
onPreview={async () => {
  if (!editId) return;
  const { data } = await supabase.from("company_assets").select("*").eq("id", editId).maybeSingle();
  if (!data) return;
  setGenModalOpen(false);
  setTimeout(() => generateAgreement(data, "preview"), 100);
}}
```
