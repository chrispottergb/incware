

## Diagnosis

The "Upload failed. Please try again." toast in `DocumentsTab.tsx` is a **generic catch-all** (line 178: `} catch {`) that swallows the real Supabase error, so the actual cause is hidden from both you and us.

**Verified facts:**
- Storage bucket `company-documents` exists, no size/MIME restrictions configured.
- RLS policies pass — you (`demoguys1@yahoo.com`) are the owner of company `American Antiques & Jewlery, Inc.` AND have admin role.
- File `American Antiques AMD 2025.pdf` is well under the 20 MB client-side limit.
- Auth session is valid (other requests in network log succeed).

**Most likely cause — the storage object key:**
The upload path is built as:
```
{companyId}/{uploadCategory}/{Date.now()}-{file.name}
  → e.g. "e2577e07.../Meeting Minutes & Resolutions/1776364126078-American Antiques AMD 2025.pdf"
```
This contains spaces and an ampersand (`&`) in the folder segment plus spaces in the filename. Supabase Storage's S3 backend frequently rejects keys with `&`, spaces, commas, and other reserved characters — returning a 400 that gets swallowed by the empty catch.

## Fix Plan

**1. Sanitize the storage key** in `src/components/company/DocumentsTab.tsx` `handleUpload`:
- Replace category folder with a slug (e.g. `meeting-minutes-resolutions`) — strip `&`, spaces, punctuation.
- Sanitize filename: replace spaces and special chars with `_`, keep the extension.
- Keep the original `file.name` in the `company_documents.file_name` DB column (so the UI still displays the friendly name).

**2. Surface real errors** instead of swallowing them:
- Change `} catch {` to `} catch (err: any) {` and include `err.message` in the toast (e.g. `Upload failed: ${err.message}`).
- Also `console.error(err)` for debugging.

**3. Add the same sanitation** to the storage `remove()` call in `deleteDoc` is unnecessary — it uses the stored `file_path` directly, which will already be sanitized going forward. Existing uploaded files keep working.

## Files to change

- `src/components/company/DocumentsTab.tsx` — add `sanitizeForStorage(s)` helper, use it for both category folder and filename in `handleUpload`, and improve error messaging.

No database, RLS, or bucket changes required.

