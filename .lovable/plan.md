

# QA Scan Results — Post-Remediation

## Status of Previously Identified Issues

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| S1 | Broken storage bucket policies | **STILL BROKEN** | Migration ran but PostgreSQL resolved unqualified `name` to `companies.name` (innermost scope). Must use explicit alias. |
| S2 | HIBP password protection | **FIXED** | Enabled via auth config |
| S3 | tax_return_jobs missing policies | **FIXED** | INSERT/UPDATE/DELETE added |
| S4 | user_roles privilege escalation | Not addressed (low risk — default-deny) |
| S5 | Plaintext ssn_ein column | Not addressed (needs data migration coordination) |
| X1 | XSS in AnnualReviewLinkGenerator | **FIXED** | DOMPurify.sanitize() added |
| E2 | No error boundary | **FIXED** | ErrorBoundary wrapping app |
| P1 | Splash screen 10.5s | **FIXED** | Reduced to 3s |
| P2 | No code splitting | **FIXED** | React.lazy on all 14 routes |
| L1 | Debug console.logs | **FIXED** | 0 matches remaining |
| R1 | Dead Index.tsx | **FIXED** | Deleted |
| A1 | No skip-to-content | **FIXED** | Added |
| A3 | Missing aria-label on mobile toggle | **FIXED** | Added |

## Critical Fix Required

**S1 — Storage bucket policies are still broken.** The migration used `extract_company_id_from_path(name)` inside an `EXISTS (SELECT 1 FROM companies WHERE ...)` subquery. PostgreSQL resolved `name` to `companies.name` (the table in scope), not `storage.objects.name`. The function receives the company display name instead of the file path, returns NULL, and the policy always denies access.

### Fix approach
Use a **lateral subquery** or qualify the column with the outer table. Since `storage.objects` is the policy target, we can reference it explicitly. The corrected SQL pattern:

```sql
CREATE POLICY "company_docs_select_own" ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-documents'
  AND EXISTS (
    SELECT 1 FROM companies
    WHERE companies.user_id = auth.uid()
      AND companies.id = extract_company_id_from_path(objects.name)
  )
);
```

Using `objects.name` (the table alias for `storage.objects` in policy context) ensures the storage file path is passed to the function, not the company name.

### Implementation
- Drop all 16 broken policies (4 buckets x 4 operations)
- Recreate with `objects.name` instead of bare `name`
- Verify with a read query that the new policies reference the correct column

### No other new issues found
- App.tsx structure is correct (ErrorBoundary, Suspense, lazy routes)
- No console.log statements remain in src/
- Splash duration is 3000ms
- Skip-to-content and aria-labels are in place

