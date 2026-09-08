# Record Audit Trail — backend only, additive

An append-only history of every change to the five record types that carry legal weight: companies, shareholders, share transactions, stock certificates, and meetings. No screens, no changes to existing tables or app code.

## Step 0 — Discovery findings

**1. Sensitive columns to redact from the audit payload**

| Table | Column | Why |
| --- | --- | --- |
| companies | `ein` | legacy plaintext EIN |
| companies | `ein_encrypted` | encrypted EIN (bytea) |
| shareholders | `ssn_ein_encrypted` | encrypted SSN/EIN (bytea) |

No bank account/routing columns exist on these five tables (plaintext bank columns were dropped in an earlier security pass; the remaining encrypted bank fields live on `company_banks` and `master_firms`, which are not in scope). `share_transactions`, `stock_certificates` and `meetings` carry no sensitive columns. These keys are removed entirely from both `old_values` and `new_values` — no masked or partial values.

**2. Service-role writes — confirmed gap.** Both `execute-share-transfer` and `execute-batch-transfer` read `SUPABASE_SERVICE_ROLE_KEY` and write `share_transactions` with a service-role client, so `auth.uid()` inside the trigger will be NULL and share transfers would be logged with no actor.

Proposed fix (reported only, not implemented in this pass): each function sets a request-local claim before its writes, e.g. `select set_config('app.actor_id', <caller uuid>, true)` on the same connection, and the trigger resolves the actor as `coalesce(auth.uid(), nullif(current_setting('app.actor_id', true),'')::uuid)`. The trigger in this pass will already include that `coalesce`, so no further database change is needed once the functions are updated. Until then, transfers executed through those functions log `changed_by = null`.

**3. Recalculation noise.** `recalculate_ownership_percentages(company_id)` rewrites `shareholders.ownership_percentage` for every holder of a company. Across 58 companies the average is 2 holders and the maximum 13, so a typical call touches 2–13 rows and fires that many UPDATE triggers. The Step 2 suppression rule (skip UPDATEs whose only changed field is `ownership_percentage`) removes all of them, because the function writes no other column. Combined with the no-op rule (Postgres still fires the trigger when the recalculated value is unchanged), the log stays clean.

**4. Bulk paths.** Multi-row inserts come from the New Client wizard (`CreateCompanyWizard`: 1 company plus directors/officers/shareholders — roughly 1–15 audited rows per run, only company and shareholder rows being audited) and `cloneSubTables` in `MeetingsTab` (clones a prior meeting's sub-tables — only the single new `meetings` row is audited; the sub-tables are out of scope). Worst realistic case is well under 20 audit rows per run.

## Step 1 — Audit table

Migration creates `public.record_audit` with: `id`, `table_name`, `record_id`, `company_id`, `operation`, `changed_by`, `changed_at`, `changed_fields text[]`, `old_values jsonb`, `new_values jsonb`. Indexes on `(table_name, record_id, changed_at desc)` and `(company_id, changed_at desc)`.

Append-only, enforced in the database:
- RLS enabled; `GRANT SELECT` to `authenticated` only, plus `GRANT ALL` to `service_role`.
- One SELECT policy: rows whose `company_id` belongs to a company where `companies.user_id = auth.uid()` (the existing ownership pattern).
- No insert/update/delete policy for users, and an explicit `REVOKE INSERT, UPDATE, DELETE ON public.record_audit FROM authenticated, anon`. Only the SECURITY DEFINER trigger writes.

## Step 2 — Trigger function

One generic `public.log_record_audit()`, `SECURITY DEFINER`, `SET search_path = public`, using `TG_TABLE_NAME`, `TG_OP`, `to_jsonb(OLD)`, `to_jsonb(NEW)`:
- Strip the redaction keys from both payloads before anything else.
- Return early when `OLD IS NOT DISTINCT FROM NEW`.
- `changed_fields` = keys whose values actually differ, computed after redaction; return early if empty.
- Suppression: skip the UPDATE when `changed_fields` is exactly `{ownership_percentage}`.
- `company_id` = `NEW.id` for `companies`, otherwise `NEW.company_id` falling back to `OLD.company_id` on DELETE.
- `changed_by` = `coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)`.
- The insert is wrapped in an exception block that swallows any error, so an audit failure can never block the underlying write.

## Step 3 — Attach triggers

`AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW` on exactly: `companies`, `shareholders`, `share_transactions`, `stock_certificates`, `meetings`. No other table.

## Step 4 — Verification (results reported after the migration)

Against a scratch company owned by a real user, prove and report row counts for: a name change logs one row with correct `changed_fields`; a no-op update logs nothing; an ownership-percentage-only update logs nothing; `ein`/`ein_encrypted`/`ssn_ein_encrypted` never appear in any payload; an authenticated user cannot update or delete a `record_audit` row; a user cannot read rows for a company they do not own; and the existing New Client flow still creates a company successfully. All scratch data is removed afterwards. Zero frontend files modified.
