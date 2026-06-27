# Bank Account / Routing Number Encryption

Mirror the SSN/EIN pattern already used by the app: pgcrypto encryption at rest, SECURITY DEFINER functions that enforce ownership, edge functions that broker writes/reads, and UI that shows masked values (`••••1234`) by default with an optional reveal.

Scope: `public.company_banks` and `public.master_firms` — 39 + 18 existing rows of plaintext to migrate.

## 1. Database migration

```text
company_banks
  + account_number_encrypted   bytea
  + routing_number_encrypted   bytea
  + account_number_last4       text   (server-derived, safe to read)
  + routing_number_last4       text

master_firms
  + account_number_encrypted   bytea
  + routing_number_encrypted   bytea
  + account_number_last4       text
  + routing_number_last4       text
```

- Add SECURITY DEFINER SQL functions (search_path locked, EXECUTE granted only to `authenticated` + `service_role`):
  - `encrypt_company_bank(p_bank_id uuid, p_account text, p_routing text, p_key text)` — verifies caller owns the parent company; writes encrypted columns + last4; clears plaintext.
  - `decrypt_company_bank(p_bank_id uuid, p_key text)` returns `(account text, routing text)` — verifies ownership.
  - `encrypt_master_firm_bank(p_firm_id uuid, …)` / `decrypt_master_firm_bank(p_firm_id uuid, p_key text)` — verifies `user_id = auth.uid()`.
- Backfill function `migrate_legacy_bank_numbers(p_key text)` (service_role only) that loops both tables, encrypts existing plaintext, populates last4, then nulls plaintext columns.
- Trigger that blocks direct writes to plaintext `account_number` / `routing_number` from PostgREST in the future (`BEFORE INSERT OR UPDATE`: raise if non-null on either table).
- Do NOT drop plaintext columns yet — keep them nullable for one release for rollback safety; the trigger prevents new plaintext writes.

## 2. Edge functions (mirror `encrypt-company-ein` / `decrypt-ssn`)

- `encrypt-company-bank` — POST `{ bank_id, account_number, routing_number }` → calls `encrypt_company_bank` RPC.
- `decrypt-company-bank` — POST `{ bank_id }` → returns `{ account_number, routing_number }`.
- `encrypt-master-firm-bank` — POST `{ firm_id, account_number, routing_number }`.
- `decrypt-master-firm-bank` — POST `{ firm_id }`.
- All four: `verify_jwt = false` in `supabase/config.toml`, validate via `getClaims()` in code (existing pattern).

## 3. Backfill

Run `migrate_legacy_bank_numbers` once via a tiny admin-only edge function (`migrate-legacy-bank-numbers`, admin role check, like `migrate-legacy-company-ein`). User triggers it from a button on the Settings page, or I can call it once on their behalf after the migration ships.

## 4. UI changes

`src/components/company/BanksTab.tsx`:
- Save flow: after `company_banks` insert/update succeeds, call `encrypt-company-bank` edge function with the plaintext, and do NOT write account_number/routing_number plaintext to the row (send empty strings). The encrypt function fills encrypted + last4.
- List row: replace `b.account_number.slice(-4)` with `b.account_number_last4`. Routing number badge becomes `b.routing_number_last4 ? '••••' + last4 : ''` — never show full routing number in the list.
- Edit dialog account/routing inputs: render as masked placeholders (`••••${last4}`) until user clicks "Reveal" (eye icon). Reveal triggers `decrypt-company-bank` and populates the input for editing. Re-saving re-encrypts.
- Mirror the same pattern in `useMasterDirectory.upsertMasterFirm` for bank-type firms: call `encrypt-master-firm-bank` after upsert, omit plaintext from the row insert.
- `AnnualReviewPublic.tsx` line 527 already uses `account_number_last4` — works as soon as the column exists.

## 5. Cleanup (separate later migration, not in this PR)

Once the user confirms everything works in production for ~1 release, drop the plaintext `account_number` / `routing_number` columns from both tables.

## What I will NOT do without approval
- Drop plaintext columns (kept nullable for rollback).
- Touch the `ImportAccess.tsx` flow beyond what's needed; that page maps imported field names and doesn't actually write to the DB until the user runs the import — happy to follow up.
- Add rate limiting (no primitive exists per platform guidance).

Reply "go" to implement.
