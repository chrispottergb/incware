## Add Lease form restructure — implementation plan

Confirmed approach: additive migration, no address backfill, tri-state leasehold status, both lease entry points updated together.

---

### 1. Database migration (additive, non-breaking)

Add to `public.company_assets`:

- `address_street`, `address_city`, `address_state`, `address_zip` — text, nullable
- `landlord_address_street`, `landlord_address_city`, `landlord_address_state`, `landlord_address_zip` — text, nullable
- `tenant_address_street`, `tenant_address_city`, `tenant_address_state`, `tenant_address_zip` — text, nullable
- `tenant_address_same_as_property` — boolean, nullable (null = unspecified for legacy rows)
- `leasehold_improvements_status` — text, nullable, CHECK IN (`'yes'`, `'no'`) — null = "Not yet answered"

Keep existing columns (`address`, `landlord_address`, `tenant_address`, `leasehold_improvement_amount`, `leasehold_improvement_description`) untouched and continue writing them on save as the joined string / raw values so every downstream reader keeps working with zero changes.

No backfill. Old rows: split columns stay null, status stays null.

### 2. Shared helpers (new file `src/lib/lease-address.ts`)

- `joinAddress({street, city, state, zip}) → "Street, City, State ZIP"` — used to keep the legacy single-string column populated on save.
- `splitAddressFallback(single, split)` — for edit-mode: if split fields are all null but legacy string exists, put the whole string in `street` and leave city/state/zip blank (matches the "shows as full string until re-saved" behavior we agreed on).
- `LEASEHOLD_STATUS` type: `'yes' | 'no' | null`.

### 3. `src/components/company/LeasesTab.tsx` (primary form)

- Restructure form state with the new split fields, `tenant_address_same_as_property`, and `leasehold_improvements_status`.
- Wrap the form in three grouped sections: **Property** (description + property address split), **Parties** (landlord name/address split, tenant same-as checkbox, conditional tenant address split), **Lease terms** (lease type, start/end dates, monthly payment, security deposit).
- **Tenant checkbox behavior:** default checked when `tenant_address_same_as_property` is `true` OR (legacy row) when `tenant_address` is null/equal to property; when checked, hide the tenant address block and null out the split fields on save.
- **Leasehold section:**
  - Radio/toggle: "Is your company paying for improvements to this space?" → Yes / No.
  - Auto-expanded (defaults to visible, not answered) when `lease_structure === 'triple_net'`.
  - Otherwise collapsed behind an inline "add improvements reporting" link.
  - Yes → reveal Amount + Description (both required, form validation blocks save).
  - No → hide Amount/Description, still writes `leasehold_improvements_status = 'no'`, sets amount/description to null.
  - Un-set (legacy rows) → status stays null.
- **On save:** write both split fields AND joined-string legacy columns; write both `leasehold_improvements_status` AND the raw amount/description columns.
- **On edit hydrate:** use `splitAddressFallback` for each of the three addresses; leasehold section shows current status (or "Not yet answered" hint if null).
- ZIP fields wired to `useZipLookup` for auto city/state fill.

### 4. `src/components/meeting/LeaseTransactionDialog.tsx` (meeting-flow entry point)

Same restructure as LeasesTab: three groups, split addresses, tenant-same checkbox, tri-state leasehold. Writes the same dual-column payload so both entry points stay consistent.

### 5. Annual Meeting PDF — `src/lib/meeting-pdf-export.ts`

Leasehold improvements section (currently line ~2982 filters by `amount || description`) needs a tri-state rewrite:

- Header row per lease shows one of: **Yes** (with Amount + Description columns), **No** ("No improvements reported for this period"), or **Not yet answered** (italic muted line: "Not yet answered — pending review").
- Include all leases in the table, not just those with amounts — so the reviewer sees "No" and "Not yet answered" rows explicitly.
- Do NOT infer from null amount/description alone; branch strictly on `leasehold_improvements_status`.

Address columns in the lease table (lines 2951, 2953, 2997) continue reading the legacy joined string — no change needed there since we're still populating it.

### 6. Hosted Annual Review

- `supabase/functions/annual-review/index.ts` — include `leasehold_improvements_status` in the payload sent to the hosted snapshot (alongside existing amount + description).
- `src/pages/AnnualReviewPublic.tsx` (blank template line 150 and edit UI ~658-664) — add the Yes/No/Unanswered control; when reviewer changes it, save it back on the lease row. Address fields stay single-string in the review UI (they display the legacy joined string; no split UI here — this is a review, not a full re-edit).

### 7. Flagged: `src/lib/lease-agreement-pdf.ts` (the actual lease document)

This is the generated legal lease. Behavior in this pass:

- **Addresses:** consumes `data.landlordAddress`, `data.propertyAddress`, `data.tenantAddress` which `LeasesTab.tsx` (line ~349) builds from the lease row. We'll pass the joined string (from split fields when present, legacy string when not) so the printed lease looks identical to today. **No format change to the rendered document.**
- **Leasehold clause** (line 203–206): currently prints only when amount or description is set. We'll switch the condition to `leasehold_improvements_status === 'yes'` (falling back to the legacy check for un-migrated rows so old leases still print correctly). "No" and "Not yet answered" produce no clause — matches current behavior.
- **No visual/format changes to the lease document.** Only the trigger condition tightens for new rows.

### 8. Flagged: `src/components/company/leases/GenerateLeaseModal.tsx` (Part 2 lease generator)

- Consumes `landlord_address` as one string via its `LeasePart2Form`. Since we're keeping the legacy column populated, this modal keeps working unchanged. Its "Landlord Address (for lease document)" free-text field continues to edit the joined string.
- **No changes in this pass.** If we later want split-field editing here too, that's a follow-up. Flagging so you can confirm you're OK leaving this modal single-string for now.

### 9. Not touched

- `src/components/company/leases/EntityPartyPicker.tsx`, `ExpenseMatrix.tsx`, `ClassificationBanner.tsx`, `MarketRentField.tsx`, `LeaseClausesEditor.tsx` — no data-shape changes.
- Lease classification logic (`useLeaseClassification`, `lease-classification.ts`) — untouched.

---

### Migration output for review

```sql
ALTER TABLE public.company_assets
  ADD COLUMN address_street text,
  ADD COLUMN address_city text,
  ADD COLUMN address_state text,
  ADD COLUMN address_zip text,
  ADD COLUMN landlord_address_street text,
  ADD COLUMN landlord_address_city text,
  ADD COLUMN landlord_address_state text,
  ADD COLUMN landlord_address_zip text,
  ADD COLUMN tenant_address_street text,
  ADD COLUMN tenant_address_city text,
  ADD COLUMN tenant_address_state text,
  ADD COLUMN tenant_address_zip text,
  ADD COLUMN tenant_address_same_as_property boolean,
  ADD COLUMN leasehold_improvements_status text
    CHECK (leasehold_improvements_status IN ('yes','no'));
```

RLS unchanged (column adds inherit the existing table policies).

---

### Verification checklist (post-implementation)

1. Create a new lease in LeasesTab with all split address fields → confirm both split columns and legacy joined string are written.
2. Create a lease via the meeting flow → same check.
3. Open an existing pre-migration lease in edit mode → Street shows the full legacy address, City/State/ZIP blank, leasehold section shows "Not yet answered".
4. Generate the actual lease PDF (`lease-agreement-pdf.ts`) for both a new and legacy lease → visually identical to before.
5. Generate an Annual Meeting PDF that includes leases → tri-state leasehold rows render correctly (Yes with amount, No, Not yet answered).
6. Open the hosted annual review page → leasehold status control shows correct tri-state and saves.

Ready to build on approval.