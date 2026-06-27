# Security Audit — entityIQ

Sensitive data in scope: SSN/EIN (encrypted), bank account/routing numbers (plaintext), shareholder PII, financial statements, tax returns, signed agreements. Scan returned **42 findings** (3 critical/high, 39 hardening warnings).

## Critical (fix first)

### 1. Plaintext bank account & routing numbers
- **Where:** `company_banks.account_number`, `company_banks.routing_number`, `master_firms.account_number`, `master_firms.routing_number`.
- **Risk:** RLS scopes by owner, but a single compromised JWT or stolen DB backup exposes all bank credentials in cleartext.
- **Fix:** Apply the same pgcrypto pattern already used for SSN/EIN. Add `account_number_encrypted bytea`, `routing_number_encrypted bytea`, route writes/reads through SECURITY DEFINER functions + edge functions (`encrypt-bank-account`, `decrypt-bank-account`), backfill from plaintext, then drop the plaintext columns. Mask in UI (last 4 only) except on explicit reveal.

### 2. Privilege-escalation risk on `user_roles`
- **Where:** `public.user_roles` INSERT policy set.
- **Risk:** If a non-admin INSERT path exists, a signed-in user could grant themselves `admin`.
- **Fix:** Add explicit restrictive policies: `INSERT/UPDATE/DELETE` allowed only when `has_role(auth.uid(),'admin')`; ensure no permissive policy applies to `authenticated`. Add a trigger that blocks self-promotion (`NEW.user_id = auth.uid()` → reject unless caller is admin AND target ≠ self for first admin bootstrap).

### 3. Public storage bucket allows listing
- **Where:** `resource-images` bucket has broad SELECT on `storage.objects`.
- **Risk:** Anonymous users can enumerate every uploaded file. Confirm no sensitive uploads ever land here.
- **Fix:** Restrict SELECT policy to specific path prefix or signed URLs; or make the bucket private and serve via signed URLs. Audit existing contents.

## High

### 4. SECURITY DEFINER functions executable by anon/authenticated (36 findings)
- **Risk:** Functions like `decrypt_ssn_ein`, `decrypt_company_ein`, `encrypt_*`, `migrate_legacy_*`, `recalculate_ownership_percentages`, queue helpers, etc. are EXECUTE-grantable to `anon`/`authenticated`. Most check `auth.uid()` internally, but the attack surface should be minimized.
- **Fix (batch migration):**
  - `REVOKE EXECUTE ... FROM anon, authenticated, public` on every SECURITY DEFINER function in `public`.
  - `GRANT EXECUTE` only to the role that needs it (`service_role` for edge-function-only helpers; `authenticated` only for the few that are intentionally user-callable like `decrypt_ssn_ein`, `decrypt_company_ein`, `encrypt_company_ein`, `encrypt_shareholder_ssn`, `has_role`).
  - `migrate_legacy_*`, queue helpers (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`, `decrypt_company_ein_service`, `decrypt_companies_ein_batch`, `log_competitor_pricing_change`) → `service_role` only.

### 5. Function `search_path` mutable (4 findings)
- **Risk:** Function hijack via search_path manipulation when extensions/schemas overlap.
- **Fix:** Add `SET search_path = public, extensions` (or `''`) to every SECURITY DEFINER function missing it. Most existing functions already do this — the 4 flagged need updating.

### 6. RLS enabled, no policy (1 finding)
- Identify the table (likely `shareholders_legacy_ssn_archive`) and either drop it if no longer needed, or add an admin-only SELECT policy + `service_role` GRANT.

## Medium (auth / app hardening)

### 7. Auth configuration
- Enable **HIBP leaked-password check** (`configure_auth password_hibp_enabled=true`).
- Confirm MFA is offered for admin accounts (TOTP via Supabase Auth).
- Idle timeout already 2h with warning — good. Keep `persistSession: true` but ensure tokens are not logged.

### 8. Edge function authorization
- Functions with `verify_jwt = false` (`encrypt-ssn`, `decrypt-ssn`, `execute-share-transfer`, `generate-*`, `parse-tax-return`, `poll-tax-return-job`, `verify-wdfi-status`) all validate JWT in code via `getClaims()` — verify each path returns 401 before any DB work. Add Zod input validation where missing (file uploads, IDs).
- Rate-limit `decrypt-ssn` and `decrypt-company-ein` per user (e.g., 30/min) to slow bulk extraction.
- Add audit logging table (`sensitive_access_log`) capturing `user_id, action, target_id, ip, ua, at` for every SSN/EIN/bank decrypt call.

### 9. PII handling in UI / PDF exports
- Confirm SSN/EIN remain masked on screen and only unmasked in generated PDFs that the owner explicitly downloads.
- Strip console.log of any decrypted values (search `console.log` near decrypt calls).

### 10. Frontend hardening
- Add a strict **Content-Security-Policy** meta tag (script-src 'self', connect-src self + supabase URL, no `unsafe-inline` where possible).
- Set `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimal.
- Confirm no third-party scripts run before auth.

### 11. Operational
- Document backup/restore + key-rotation runbook for `SSN_ENCRYPTION_KEY` (re-encrypt path).
- Schedule quarterly re-run of `security--run_security_scan` and `supabase--linter`.
- Define data-retention policy for `tax-returns` and `competitor-pricing-screenshots` buckets.

## Implementation order (proposed migrations)

1. **Migration A — user_roles lockdown** (Critical #2): restrictive policies + trigger.
2. **Migration B — REVOKE/GRANT sweep** on all SECURITY DEFINER functions (#4) and add missing `search_path` (#5).
3. **Migration C — Storage bucket policy fix** for `resource-images` (#3).
4. **Migration D + edge functions — bank account encryption** (#1): add encrypted columns, edge functions, backfill, swap UI, drop plaintext.
5. **Migration E — sensitive_access_log table + decrypt-function instrumentation** (#8).
6. **Auth config** — enable HIBP, document MFA enrollment (#7).
7. **Frontend CSP / headers + console.log audit** (#9, #10).

Each migration is reversible and ships independently. No data loss; bank-number swap uses dual-write before dropping plaintext.

## What I will NOT do without your approval
- Drop any existing column (only after backfill verified).
- Change behavior of existing edge functions beyond auth/rate-limit hardening.
- Touch the `auth`, `storage`, `vault` schemas directly.

Reply with which items you want me to implement, or "all critical+high" to start with steps 1–3.
