## Context — important

There is **no Jotform prefill code** in this project to fix. The Annual Review page (`/annual-review/:token`) loads a snapshot from edge function `annual-review`, renders an editable native React form, and embeds a **blank** Jotform iframe (form `261175646963063`) that intentionally receives no query‑string and no `postMessage` (this is a locked architectural rule in `mem://features/annual-review-hosted-snapshot`). So "fix Jotform field name alignment / prefill URL parameters" is not applicable.

The real underlying bug — fields the operator expects to see are missing from the snapshot — is genuine, and that's what this plan fixes.

## Diagnosis (where data is dropped today)

`supabase/functions/annual-review/index.ts`:

1. **Leases — only the first one is returned.**
   ```ts
   const leaseAsset = allAssets.find((a) => a.asset_type === "lease");
   // payload.lease = single object | null
   ```
   Multiple `company_assets` rows of type `lease` are silently dropped.

2. **Banking — only the first bank is returned.**
   `banking.bank = banksRes.data[0]`. Additional bank accounts are dropped. Signers are returned as a flat array not associated to a specific bank.

3. **Officers — pulled only from the most recent meeting.**
   If the latest meeting has no `meeting_officers` rows (a routine case for some meeting types), officers come back empty. Benefits already have a "walk back through prior meetings" fallback; officers don't.

4. **Officer fields — no email / phone / start date.** The schema has them but the mapper only emits `title, name, salary, bonus`.

5. **Benefit fields — no employer/employee contribution split, no dedicated 401(k) provider / plan administrator labels.** Mapper emits a generic `provider` / `agent_administrator` / `retirement_contribution` but the React UI labels them generically too.

`src/pages/AnnualReviewPublic.tsx`:
- Renders a single `lease` object (no array support).
- Renders a single `bank` object.
- Officer card has no email/phone/start-date inputs.
- Benefit card has no employer/employee contribution inputs.

`client.locations[]`, `client.vehicles[]`, `client.equipment[]`, `client.bankAccounts[]` from your task description **do not exist as separate collections** in this schema. Vehicles + equipment live inside `company_assets` (already returned as `assets[]`). There is no `locations` table. So the only valid expansion in those areas is multi-bank.

## Changes

### 1. Edge function `supabase/functions/annual-review/index.ts`

- Replace `lease` (object) with `leases` (array). Map every `company_assets` row where `asset_type = 'lease'`, preserving order. Each entry: `property_address`, `landlord_name`, `landlord_address`, `monthly_payment`, `lease_start_date`, `lease_end_date`, `leasehold_improvements`, `leasehold_improvement_amount`, `home_office` (from `is_home_office` if present, else `false`).
- Replace `banking.bank` (object) with `banking.banks` (array of all `company_banks` rows). Keep `banking.signers` as today; add `bank_id` on each signer when the column exists so signers can be grouped per bank in the UI.
- Add an officer fallback loop mirroring the benefits one: if the latest meeting has no `meeting_officers`, walk back through `latestMeetings.slice(1)` until a meeting with officers is found.
- Extend the officer mapper to emit `email`, `phone`, `start_date` (whichever columns exist on `meeting_officers`).
- Extend the benefit mapper to emit `employer_contribution`, `employee_contribution`, `plan_administrator` (mapped from existing columns where they exist; otherwise pass through `null`).
- Keep all existing fields, response shape additive — `lease` stays as a deprecated alias equal to `leases[0] || null` so any older consumer keeps working for one release.

### 2. Page `src/pages/AnnualReviewPublic.tsx`

- Change `Snapshot.lease: any` → `leases: any[]`. Seed `edits.leases` from `snap.leases` (fallback to `[snap.lease]` if only the legacy field is present).
- Replace the single-lease section with a repeating "Lease #N" block (same layout as the Officers/Benefits cards) with Add / Remove buttons. Add a `Home Office` checkbox per lease.
- Replace `edits.bank` (object) + `Banking` section with `edits.banks` (array). Repeating "Bank #N" cards, each with its own LOC/Account fields. Authorized signers stay one shared list (keeping existing UI) but display the `bank_id` association where set.
- Add to the Officer card: `Email`, `Phone`, `Start Date` inputs.
- Add to the Benefit card: `Employer Contribution ($)`, `Employee Contribution ($)`, `Plan Administrator` inputs (the existing `Provider` and `Insurance Agency` rows already cover 401(k) provider / insurance provider).
- `blankLease`, `blankBank`, updated `blankOfficer`, updated `blankBenefit` factories.

### 3. Submission payload

`annual_review_submissions.new_entries` already stores arbitrary JSON. The new shape (`leases: [...]`, `banks: [...]`, expanded officer/benefit fields) is automatically captured by the existing `setEdits` flow — no DB migration required.

### 4. What is NOT touched

- The Jotform iframe embed and the no-prefill rule (`mem://features/annual-review-hosted-snapshot`).
- The edge-function audit logging, token validation, EIN/account masking.
- Any unrelated company / shareholder / director logic.
- The `Download Snapshot` PDF flow (it will pick up the new repeating sections automatically through `snapshotRef`).

## Validation

After implementation, load a token for a company that has 2+ lease assets, 2+ company_banks, and a latest meeting whose `meeting_officers` is empty but a prior meeting has them. Expected:

- All leases visible and editable.
- All banks visible, each with its own LOC/account fields.
- Officers populated from the fallback meeting, with email/phone/start-date editable.
- Benefits show employer/employee contribution and plan administrator fields.
- Submitting writes the full multi-entry shape into `annual_review_submissions.new_entries`.
- Edge function logs still emit the single audit JSON line per load.

## Memory update on approval

Update `mem://features/annual-review-hosted-snapshot` to record: snapshot now returns `leases[]` and `banking.banks[]` (legacy `lease` retained as alias for one release); Jotform prefill remains forbidden.
