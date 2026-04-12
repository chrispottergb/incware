

# Comprehensive QA Scan Report

## 1. Security Findings

### CRITICAL

**S1. Broken Storage Bucket Policies**
The RLS policies for `company-documents`, `filing-documents`, and `ai-compliance-docs` buckets call `extract_company_id_from_path(companies.name)` instead of `extract_company_id_from_path(name)`. This means authenticated users **cannot read, write, or delete files** in these buckets. This was flagged in a prior audit but remains unfixed.

**S2. Leaked Password Protection Disabled**
The Supabase auth configuration still has leaked password protection (HIBP) disabled, despite a prior audit claiming it was enabled. The security scanner confirms it remains off.

**S3. `tax_return_jobs` Table Missing INSERT/UPDATE/DELETE Policies**
Only a service_role ALL policy and a user SELECT policy exist. Authenticated users may be blocked from inserting jobs, and there's no row-level enforcement on writes.

**S4. `user_roles` Table Potential Privilege Escalation**
The table has an admin-only ALL policy and a user SELECT policy, but there's no explicit restrictive INSERT/UPDATE/DELETE policy for non-admin users. While Supabase's default-deny should block this, it should be explicitly verified with a restrictive policy.

### HIGH

**S5. Plaintext SSN/EIN Column Still Present**
The `shareholders.ssn_ein` column still exists with potential historical plaintext data. `ShareholdersTab.tsx` falls back to reading it. `record-book-pdf.ts` reads it directly. The column should be migrated and dropped.

**S6. Edge Functions Wildcard CORS**
All edge functions use `Access-Control-Allow-Origin: *`. Should be restricted to the application domain(s).

**S7. `verify-wdfi-status` and `zip-lookup` JWT Status**
A prior message claimed these were hardened with JWT validation, but the security scanner (from an earlier scan) still flags them. Need to verify the deployed functions actually include auth checks.

### MEDIUM

**S8. Raw Error Messages Exposed**
Multiple edge functions return `error.message` to clients, leaking internal details. Affects: `zip-lookup`, `verify-wdfi-status`, `parse-tax-return`, `poll-tax-return-job`, all generate-* functions.

**S9. Weak Password Policy**
Only 6-character minimum with no complexity requirements. Should enforce 12+ characters or use a strength library like zxcvbn.

---

## 2. XSS / HTML Injection

**X1. Unsanitized `dangerouslySetInnerHTML` in `AnnualReviewLinkGenerator.tsx`**
Line 368 renders `buildEmailPreviewHtml(...)` without DOMPurify sanitization. While the inputs are app-controlled (salutation, company name), a company name containing HTML could trigger XSS. Should wrap in `DOMPurify.sanitize()`.

**X2. `chart.tsx` uses `dangerouslySetInnerHTML` for CSS**
This is safe (generates CSS variables from theme config), but should be documented as intentional.

---

## 3. Console Logging

**L1. Debug console.log statements in production code**
88 `console.log` matches across 3 files:
- `MeetingDetail.tsx` — PDF generation debug logs
- `AnnualMeetingWizard.tsx` — PDF download/preview debug logs
- `PrintPreviewButton.tsx` — PDF preview/download/print debug logs

These are non-sensitive (PDF byte sizes, step markers) but add noise. Consider replacing with a debug-only logger.

**L2. `NotFound.tsx` logs 404 routes via `console.error`**
This is intentional but could reveal route probing in production logs.

---

## 4. Routing & Navigation

**R1. Dead `Index.tsx` page**
`src/pages/Index.tsx` contains a generic "Welcome to Your Blank App" placeholder but is never routed in `App.tsx`. The `/` route renders `Dashboard`. This file is dead code.

**R2. All protected routes properly guarded**
Every sensitive route wraps in `<ProtectedRoute>` which checks `session` and redirects to `/auth`. This is correct.

**R3. `AnnualReviewPublic` is correctly unprotected**
The `/annual-review/:token` route is intentionally public and uses token-based access. The edge function validates the token server-side.

---

## 5. Data Fetching & State

**D1. No pagination on company queries**
`Dashboard.tsx` and `AppLayout.tsx` both fetch all companies with `.select("*").order("name")`. For users with 1000+ companies, this will hit Supabase's default 1000-row limit and silently truncate results.

**D2. AI Compliance Summary queries fetch full result sets**
The `AIComplianceSummary` component fetches all AI systems, incidents, and usage logs just to count them. Should use `.select("id", { count: "exact", head: true })` for efficiency.

**D3. Multiple components query `companies` independently**
Both `Dashboard` and `AppLayout` maintain separate `useQuery` calls for the same `["companies"]` key. TanStack Query deduplicates these, so this is fine functionally, but the Dashboard fetches `*` while AppLayout fetches only `id, name, entity_type, status`. The first to resolve will cache, potentially causing stale partial data.

---

## 6. Error Handling

**E1. Widespread `catch (err: any)` pattern**
285 instances across 27 files use untyped `catch (err: any)` and display `err.message` directly to users. Some of these could leak internal database error messages (e.g., constraint violations, RLS denials).

**E2. No global error boundary**
The app has no React Error Boundary. A rendering crash in any component will white-screen the entire app. Should add an error boundary at the `App` level.

---

## 7. Performance

**P1. Splash screen blocks app for 10.5 seconds**
`SplashScreen` defaults to `DURATION = 10500` (10.5 seconds) and the `App.tsx` passes `duration={8000}`. Users must wait 8 seconds before seeing any content. This is excessive for returning users. Consider showing it only on first visit or reducing to 2-3 seconds.

**P2. No code splitting**
All pages are eagerly imported in `App.tsx`. For a complex app with 15 pages and dozens of components, this increases initial bundle size. Should use `React.lazy()` for route-level code splitting.

**P3. External font loading in SplashScreen**
The splash screen loads Google Fonts (Bebas Neue, Rajdhani) via a `<style>` tag with `@import`. This is render-blocking and could cause FOUT. Should preload or inline critical font subsets.

---

## 8. Accessibility

**A1. No skip-to-content link**
The sidebar layout has no mechanism for keyboard users to skip past the navigation to main content.

**A2. Color-only status indicators**
Dashboard status badges (Current, Delinquent, Admin. Dissolved) rely primarily on color to convey meaning. Should add icons or patterns for colorblind users.

**A3. Missing ARIA labels on icon-only buttons**
The mobile menu toggle button in `AppLayout` uses only an icon (`Menu`/`X`) with no `aria-label`.

---

## 9. TypeScript / Code Quality

**T1. Unsafe type casting with `as any`**
`Settings.tsx` line 39: `.from("shortcode_expansions" as any)` — suggests the table may not be in the generated types. This bypasses type safety.

**T2. `err: any` pattern throughout**
Should use `unknown` and type-narrow for safer error handling.

---

## 10. CSP Policy

**C1. `unsafe-inline` and `unsafe-eval` in CSP**
The CSP in `index.html` includes `'unsafe-inline' 'unsafe-eval'` for scripts. This significantly weakens the CSP. `unsafe-eval` is likely needed for Vite dev mode but should be removed in production builds. `unsafe-inline` could be replaced with nonces.

---

## Summary: Priority Remediation List

| Priority | Issue | Effort |
|----------|-------|--------|
| CRITICAL | S1. Fix storage bucket policies (companies.name → name) | Low |
| CRITICAL | S2. Enable HIBP password protection | Low |
| CRITICAL | S3. Add INSERT/DELETE policies to tax_return_jobs | Low |
| HIGH | S4. Add restrictive policy to user_roles | Low |
| HIGH | S5. Migrate & drop plaintext ssn_ein column | Medium |
| HIGH | X1. Sanitize dangerouslySetInnerHTML in AnnualReviewLinkGenerator | Low |
| HIGH | E2. Add React Error Boundary | Low |
| MEDIUM | S6. Restrict CORS to app domain | Medium |
| MEDIUM | S8. Genericize edge function error messages | Low |
| MEDIUM | D1. Add pagination for company queries | Medium |
| MEDIUM | P1. Reduce splash screen duration | Low |
| MEDIUM | P2. Add route-level code splitting | Medium |
| LOW | S9. Strengthen password policy | Low |
| LOW | L1. Remove debug console.log statements | Low |
| LOW | R1. Delete dead Index.tsx | Low |
| LOW | A1-A3. Accessibility improvements | Medium |

