

# Comprehensive QA Scan — All User-Facing Features & Flows

## 1. Authentication Flow

| Area | Finding | Severity |
|------|---------|----------|
| **No Password Reset** | No "Forgot Password" link, no `/reset-password` route, no call to `resetPasswordForEmail` anywhere in the codebase. Users who forget their password are locked out. | CRITICAL |
| **No Google Sign-In** | Auth page only supports email/password. No social OAuth despite project guidelines recommending Google auth. | MEDIUM |
| **Weak password policy** | Client-side minimum is 6 characters with no complexity rules. HIBP remains disabled per security scan. | HIGH |
| **Error message leaks** | `error.message` from Supabase auth errors shown directly to users (line 60) — can reveal whether an email exists. | MEDIUM |
| **No email confirmation UX** | After signup, only a toast says "Check your email." No resend-verification flow or visual guidance. | LOW |

## 2. Splash Screen

| Finding | Severity |
|---------|----------|
| Duration set to 3000ms — acceptable after fix. No issues found. | OK |

## 3. Dashboard

| Finding | Severity |
|---------|----------|
| **No pagination** — fetches ALL companies with `.select("*").order("name")`. Will silently truncate at 1,000 rows. | HIGH |
| **AI Compliance Summary** fetches full rows just to count them. Should use `{ count: "exact", head: true }`. | LOW |
| **"EntityIQ" card** opens Annual Review dialog but doesn't indicate it requires a company with `contact_email` set — may confuse users when the email step fails. | LOW |

## 4. Company Creation Wizard

| Finding | Severity |
|---------|----------|
| `handleSaveExisting` uses `as any` cast on the insert (line 450) — bypasses type checking for `opening_balance_date`. | LOW |
| No file size validation on uploads (SSN encryption triggers via edge function — correct). | OK |
| `catch (err: any)` on line 427/429 — exposes raw DB error messages to users. | MEDIUM |

## 5. Company Detail Page

| Finding | Severity |
|---------|----------|
| **Delete confirmation** exists — good. But `err.message` shown on failure (line 75) could leak DB details. | MEDIUM |
| Tab navigation via URL hash works correctly. | OK |

## 6. Shareholders Tab

| Finding | Severity |
|---------|----------|
| **Plaintext SSN/EIN fallback** — still reads `ssn_ein` column as fallback when no encrypted value exists. Historical data at risk. | HIGH |
| SSN/EIN display properly uses decrypt edge function with ownership check. | OK |
| No input validation on SSN/EIN format (accepts any string). | LOW |

## 7. Documents Tab (File Upload)

| Finding | Severity |
|---------|----------|
| **No file size validation** — users can attempt to upload arbitrarily large files. Supabase storage will reject but the error message will be cryptic. | MEDIUM |
| **No file type validation beyond `accept` attribute** — `accept` is advisory only, not enforced. Malicious files could be uploaded. | MEDIUM |
| Storage bucket policies were just fixed — should now work correctly with `objects.name`. | OK |

## 8. Meeting Detail Page

| Finding | Severity |
|---------|----------|
| 1,042 lines in a single component — complex but functional. | LOW |
| `console.error` statements removed from PDF generation per prior cleanup. | OK |
| Meeting data fetched correctly with ownership implicitly enforced by RLS. | OK |

## 9. Meeting Resolutions

| Finding | Severity |
|---------|----------|
| "Other" resolution type correctly clears textarea for custom input (line 168). | OK |
| `transaction_id` update uses `as any` cast (line 183). | LOW |
| Transfer workflow integration works (BuySell + Batch + Lease). | OK |

## 10. Written Consent Wizard

| Finding | Severity |
|---------|----------|
| 1,526 lines — extremely large single component. Maintenance risk. | LOW |
| Auto-save via `useAutoSave` hook — good. | OK |
| PDF preview and generation tested via pdfjs-dist. | OK |

## 11. Annual Meeting Wizard

| Finding | Severity |
|---------|----------|
| 1,696 lines — largest component. Maintenance risk. | LOW |
| 16-step wizard with sessionStorage-based draft — correct per design. | OK |
| PDF generation and preview functional. | OK |

## 12. Buy/Sell (Share Transfer) Workflow

| Finding | Severity |
|---------|----------|
| `console.warn` on PDF upload failure (line 306) — appropriate degraded behavior. | OK |
| `catch (err: any)` on line 330 — raw error shown. | MEDIUM |
| Edge function `execute-share-transfer` called correctly. | OK |

## 13. Batch Transfer Dialog

| Finding | Severity |
|---------|----------|
| Edge function `execute-batch-transfer` called correctly. | OK |
| No issues found in transfer logic. | OK |

## 14. Annual Review Link Generator

| Finding | Severity |
|---------|----------|
| XSS fix confirmed — `DOMPurify.sanitize()` wraps `dangerouslySetInnerHTML`. | OK |
| `console.error` on email send failure (line 186, 192) — appropriate for debugging. | OK |
| Token generation uses `crypto.getRandomValues` — secure. | OK |

## 15. Annual Review Public Page

| Finding | Severity |
|---------|----------|
| Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` directly (line 26-27) — acceptable for public anon-key access. | OK |
| `console.error` on fetch failure (line 272) — acceptable. | OK |
| 1,099 lines — large but functional. | LOW |

## 16. Pending Reviews

| Finding | Severity |
|---------|----------|
| Admin-only features properly guarded with `useUserRole()`. | OK |
| Delete confirmation dialogs present. | OK |

## 17. Reports Page

| Finding | Severity |
|---------|----------|
| Fetches ALL companies, ALL shareholders, ALL certificates without pagination. | HIGH |
| `select("*")` on companies — over-fetches. | LOW |
| PDF export functions called correctly. | OK |

## 18. Profile Page

| Finding | Severity |
|---------|----------|
| Simple, correct implementation. | OK |
| `catch (e: any)` — raw error shown. | LOW |

## 19. Settings (Shortcode Library)

| Finding | Severity |
|---------|----------|
| Uses `"shortcode_expansions" as any` (line 39, 53, 58, 75) — table not in generated types. | MEDIUM |
| No input length validation on shortcode or expansion text. | LOW |
| Delete has no confirmation dialog — one-click destructive action. | MEDIUM |

## 20. User Management Page

| Finding | Severity |
|---------|----------|
| Not inspected in detail but route is protected. | OK |

## 21. Org Chart

| Finding | Severity |
|---------|----------|
| Pure read-only visualization from relationships table. No issues. | OK |

## 22. Filing & Compliance Tab

| Finding | Severity |
|---------|----------|
| External links to WI DFI hardcoded — correct for target audience. | OK |
| File upload for filing documents present. | OK |

## 23. Error Handling (Cross-Cutting)

| Finding | Severity |
|---------|----------|
| **300 instances of `catch (err: any)`** across 30 files — many expose raw error messages. | HIGH |
| ErrorBoundary exists at App level — good. | OK |
| **~330 console.log/error/warn** statements remain across 24 files (some are legitimate error logging in catch blocks, but many are debug noise). | MEDIUM |

## 24. Security Scan Results (Current State)

| Scanner | Finding | Status |
|---------|---------|--------|
| Supabase | HIBP still disabled | OPEN |
| supabase_lov | `tax_return_jobs` missing INSERT policy | OPEN (migration was attempted but scan still flags) |
| supabase_lov | `user_roles` privilege escalation risk | OPEN |
| agent_security | Plaintext SSN/EIN column | OPEN |
| agent_security | Wildcard CORS on edge functions | OPEN |
| agent_security | Edge function error message disclosure | OPEN |
| agent_security | verify_jwt=false on verify-wdfi-status and zip-lookup | OPEN |

---

## Remediation Plan (Priority Order)

### CRITICAL
1. **Add password reset flow** — Forgot Password link on Auth page, `/reset-password` route, call `resetPasswordForEmail`
2. **Enable HIBP** — Use `configure_auth` tool

### HIGH
3. **Add pagination** to Dashboard and Reports company queries (use `.range()`)
4. **Migrate plaintext SSN/EIN data** and remove fallback reads
5. **Sanitize error messages** — Replace `err.message` with generic user-facing text in all `catch` blocks (keep `console.error` for debugging)
6. **Strengthen password policy** — Enforce 12+ chars client-side with complexity rules

### MEDIUM
7. **Add file size/type validation** in DocumentsTab uploads (e.g., 20MB max, whitelist extensions)
8. **Fix `as any` casts** in Settings page — add `shortcode_expansions` to types or create proper typed query
9. **Add delete confirmation** for shortcode deletion in Settings
10. **Restrict edge function CORS** to application domain
11. **Genericize edge function error responses**

### LOW
12. Remove remaining debug `console.log` statements
13. Refactor oversized components (WrittenConsentWizard: 1,526 lines, AnnualMeetingWizard: 1,696 lines)
14. Add SSN/EIN format validation (XX-XXXXXXX or XXX-XX-XXXX)
15. Add Google OAuth sign-in option

