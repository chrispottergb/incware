## Goal

Whenever the user clicks any **Print** button in the app (forms, certificates, ledgers, meetings, agreements, etc.), the browser's native **print preview** should appear instead of just downloading the PDF.

## Approach

All 40+ Print/Save call sites already funnel through one helper: `savePdfReliably(doc, filename)` in `src/lib/pdf-save.ts`. Changing that single function gives uniform print-preview behaviour everywhere with **zero changes** at call sites.

## Change

In `src/lib/pdf-save.ts`, replace `savePdfReliably` with this flow:

1. Call `doc.autoPrint()` — jsPDF embeds a `/OpenAction` so the browser's PDF viewer auto-opens the print dialog when the file loads.
2. `window.open(blobUrl, "_blank")` to show the browser's built-in PDF preview UI (Chrome, Edge, Safari, Firefox all support this). With `autoPrint` set, the print dialog appears automatically inside that preview.
3. Fallback A — popup blocked: trigger a direct download (with a toast telling the user to open the file to print).
4. Fallback B — download blocked: keep the existing helper tab (`openPdfViewerTab`) as a last resort.

The existing `openPdfViewerTab` helper and its modal stay in place as the final fallback. No call sites change.

## Files

- `src/lib/pdf-save.ts` — rewrite the body of `savePdfReliably` (keep signature and helper tab fallback).

## Notes

- jsPDF's `autoPrint()` is supported in jsPDF v2+ which this project uses.
- The Lovable preview iframe blocks `window.open` to `about:blank` but allows blob URLs in a new tab on a real user-gesture click. If the popup is blocked the user falls cleanly to the download path with a toast.
- No DB or schema changes.
