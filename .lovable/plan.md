## Goal

Add an "Import Operating Agreement" function to the Operating Agreement UI so users can upload an existing executed OA (PDF or DOCX) and have it stored alongside generated versions in the version history.

## Where

Two components currently render the Operating Agreement UI:

- `src/components/company/OperatingAgreementGenerator.tsx` — multi-member LLC
- `src/components/company/SMOperatingAgreementGenerator.tsx` — Single-Member LLC

The fix goes in both so all LLC variants get the import option.

## Behavior

1. Add a new **Import Existing** button in the "Generation Buttons" row, next to *Generate Standard* / *AI-Assisted Draft*.
2. Clicking the button opens a hidden file input (`accept=".pdf,.doc,.docx"`).
3. On file selection:
   - Validate type (PDF/DOC/DOCX) and size (<= 20 MB); toast on rejection.
   - Upload to the existing `generated-documents` Supabase storage bucket under `{userId}/{safeCompanyName}_Operating_Agreement_imported_{timestamp}.{ext}` (same naming convention as `saveVersion`).
   - Create a 1-year signed URL.
   - Insert a row into `document_registry` with:
     - `document_type: "Operating Agreement"`
     - `document_category: "corporate"`
     - `status: "final"`
     - `title: "Operating Agreement (Imported) — {filename} — {date}"`
     - `statute_reference: "Wis. Stat. Ch. 183"`
   - Invalidate the `["doc-versions", companyId, "Operating Agreement"]` query so the new row shows immediately in **Version History**.
   - Toast success.
4. While uploading, show a spinner on the button and disable it alongside the other generation buttons.
5. Imported entries appear in Version History with the existing rendering (the title makes the imported nature clear). No schema changes required.

## Technical details

- Reuse the same `supabase.storage.from("generated-documents").upload(...)` and `createSignedUrl` flow that `saveVersion` already uses.
- Add a new state `isImporting: boolean` and a `fileInputRef = useRef<HTMLInputElement>(null)`.
- Use `Upload` icon from `lucide-react` for the button.
- Use `file.type` plus extension fallback for content type (`application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`).
- Reset the file input value after handling so re-importing the same file fires `onChange` again.

No DB migration. No edge function. No new dependencies.

## Files to modify

- `src/components/company/OperatingAgreementGenerator.tsx` — add state, hidden input, handler, Import button.
- `src/components/company/SMOperatingAgreementGenerator.tsx` — same additions.
