

# Fix: Promissory Note "Save as PDF" — Upload to Storage

## Problem
The "Save as PDF" button in both `MeetingLoans.tsx` and `WrittenConsentWizard.tsx` only triggers a local browser download via a temporary blob URL. It does NOT upload the PDF to Supabase Storage or update the database record. So the "On File" indicator never appears, and there's nothing to download later.

## Root Cause
`handleSavePdf` (MeetingLoans line 315) and `handleSaveNotePdf` (WrittenConsentWizard line 152) create a blob, trigger `a.click()` for download, then revoke the URL. No storage upload or DB update occurs.

## Fix

### 1. MeetingLoans.tsx — `handleSavePdf` (line 315)
Replace the local-only download with a flow that:
1. Creates the PDF blob from `currentPdfBytes`
2. Uploads to `generated-documents` bucket at path `{userId}/promissory-notes/{loanRowId}/{filename}.pdf`
3. Updates the `meeting_loans` row with `promissory_note_file_url` and `promissory_note_file_name`
4. Invalidates the query cache so the "On File" badge appears
5. Also triggers a local download so the user gets the file immediately
6. Shows error toast if upload fails

This requires tracking which loan row the note wizard was opened for (the `editingNoteRowId` or equivalent — need to check if this is already tracked).

### 2. WrittenConsentWizard.tsx — `handleSaveNotePdf` (line 152)
Same pattern: upload the PDF blob to storage, save the record, then also trigger a local download. The exact storage path and DB table will depend on how written consents store their documents.

### 3. Error Handling
- Wrap upload in try/catch
- Show `toast.error` on failure with the error message
- Only show success toast and close dialog after both upload and DB update succeed

## Technical Details
- Uses existing `supabase.storage.from("generated-documents").upload()` pattern (already used in `handleUploadNote`)
- Uses existing `supabase.from("meeting_loans").update()` pattern
- No new tables or migrations needed
- The `generated-documents` bucket is already private with appropriate RLS

