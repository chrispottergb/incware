

## Diagnosis

Real error surfaced: **`new row violates row-level security policy`** on the storage upload (the `supabase.storage.from("company-documents").upload(...)` call), not on the DB insert.

**Root cause — mismatch between storage RLS policy and the upload path:**

The `company_docs_insert_own` policy on `storage.objects` checks:
```
companies.id = extract_company_id_from_path(objects.name)
```
And `extract_company_id_from_path()` only returns a UUID if the **first folder segment starts with `company-`** (e.g. `company-{uuid}/...`). Otherwise it returns NULL → policy fails.

But our upload code writes paths like:
```
{companyId}/{category}/{timestamp}-{filename}
e.g. e2577e07-49ad-469e-bddf-8d5cd0930bdd/miscellaneous/1776...-file.pdf
```
No `company-` prefix → extractor returns NULL → RLS denies the insert.

Existing files in the bucket use the bare-UUID format too — they were uploaded BEFORE this stricter policy was attached. This affects 4 buckets with the same pattern: `company-documents`, `filing-documents`, `ai-compliance-docs`, `generated-documents`.

## Fix Plan

The cleanest fix is to **relax the storage RLS policies** to accept the bare-UUID path format the app actually uses (and that all existing data uses). I'll update the `extract_company_id_from_path` function to handle BOTH formats: `company-{uuid}/...` AND `{uuid}/...`. This:

- Fixes uploads immediately for all 4 affected buckets in one shot
- Keeps every existing object accessible (no orphaned files)
- Requires no app code changes, no data migration, no path rewrites

### Migration

Update `public.extract_company_id_from_path(path text)` to:
1. Take `folder := split_part(path, '/', 1)`
2. If `folder` starts with `company-` → strip prefix, cast remainder to uuid (current behavior)
3. **NEW**: Else if `folder` looks like a UUID (length 36, matches UUID regex) → cast directly to uuid
4. Else return NULL

The function stays `IMMUTABLE` and `SECURITY DEFINER`-safe (no behavior change for the legacy prefix case).

### Files / changes

- **DB migration only** — replace `public.extract_company_id_from_path` with the dual-format version. No table, policy, or app changes needed.
- No changes to `src/components/company/DocumentsTab.tsx` (already sanitizes paths and surfaces errors correctly).

### Verification after deploy

- Retry uploading the PDF on the Documents tab — should succeed.
- Confirm existing files still open via the Download button.
- Same fix automatically restores uploads for `filing-documents`, `ai-compliance-docs`, and `generated-documents` if any of those were also broken.

