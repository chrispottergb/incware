## Fix: Print buttons don't open print preview

### Root cause

The Print action calls `savePdfReliably`, which uses `window.open(blobUrl, "_blank")`. Inside the Lovable preview iframe this is blocked by the popup blocker, so it falls through to a plain download — exactly the "Popup blocked — PDF downloaded instead" toast you saw. No print dialog ever appears. `autoPrint()` only fires inside a real PDF viewer, so the downloaded file won't auto-print either.

### Fix

Render the PDF in a hidden same-origin iframe inside the current page and call `print()` on it. Same-origin blob iframes work inside the Lovable preview, so the native print dialog opens reliably with no popup.

### Changes

1. **`src/lib/pdf-save.ts`** — add new helper `printPdfInIframe(doc)`:
   - Build blob from `doc.output("blob")`.
   - Append a hidden `<iframe>` with `src = URL.createObjectURL(blob)`.
   - On `iframe.onload`, call `contentWindow.focus()` then `contentWindow.print()`.
   - Cleanup on `afterprint` with safety timeout. Returns `false` on error so caller can fall back.

2. **`src/lib/section-pdf.ts`** — `printSectionPdf` calls `printPdfInIframe`; on failure, falls back to existing `savePdfReliably` (download).

3. **`src/components/meeting/PrintPreviewButton.tsx`** — `handlePrint` uses `printPdfInIframe` with the same fallback. Download button stays on `savePdfReliably`.

4. **Save your new preference** to user memory: "Always verify changes are complete and functional before reporting them as done."

### Verification (per your new rule)

After edits I will use the browser tool to:
1. Click Print on a Section PDF (Stock Ledger / Shareholders) and confirm the native browser print dialog opens.
2. Click Print on a meeting PDF via `PrintPreviewButton` and confirm the same.
3. Confirm Download and Preview buttons still work unchanged.

Only after those checks pass will I report the fix as done.

### Out of scope

- No PDF content/layout changes.
- No changes to the Preview overlay or Download flow.
