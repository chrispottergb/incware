## Problem

`previewLeaseAgreement` opens a new browser tab and navigates it to the PDF data URI. Inside the Lovable preview iframe (and on many browsers/configs) this triggers a download instead of a visible preview, so the user only sees a download prompt or a blank page.

The meeting minutes section uses a different, working pattern (`previewSectionPdf` in `src/lib/section-pdf.ts`): it renders the PDF to canvases via `pdf.js` inside an in-page modal overlay — no new tab, no download.

## Fix

Make the lease agreement preview use the same in-page pdf.js overlay pattern.

### 1. `src/lib/lease-agreement-pdf.ts`
Rewrite `previewLeaseAgreement` to mirror `previewSectionPdf`:
- Generate the PDF, get `arraybuffer` output.
- Build a fixed full-screen overlay `div` with a centered white container, a small toolbar with a "✕ Close" button, and a scrollable area.
- Use `pdfjsLib.getDocument({ data })` to render each page to a `<canvas>` (scale 2) and append to the scroll area.
- Close on overlay backdrop click or close button click.
- Drop the `targetWindow` parameter and the data-URI / `window.open` fallback path entirely.
- Add the `pdfjs-dist` import the same way `section-pdf.ts` does (reuse the existing worker setup — confirm by reading the top of `section-pdf.ts`).

### 2. `src/components/company/LeasesTab.tsx`
- Remove the `window.open("", "_blank")` calls in the two preview call sites (lines ~593–596 and ~656) and the `previewWindow` parameter passed into `generateAgreement`.
- Update `generateAgreement`'s signature to drop the `previewWindow` argument; just call `previewLeaseAgreement(data)`.

## Result

Clicking "Preview" on a lease (in both the Add Lease dialog and the lease list row) opens the same modal canvas preview used for meeting minutes — no download, no new tab, no blank page.