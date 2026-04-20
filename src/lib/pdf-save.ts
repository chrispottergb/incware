import jsPDF from "jspdf";
import { toast } from "sonner";

const isEmbeddedPreview = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function openPdfViewerTab(blobUrl: string, filename: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  const safeBlobUrl = JSON.stringify(blobUrl);
  const safeFilename = JSON.stringify(filename);

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${filename}</title>
    <style>
      :root {
        color-scheme: light;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: system-ui, -apple-system, sans-serif;
        background: #e5e7eb;
        color: #111827;
      }

      .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        text-align: center;
        padding: 28px;
      }

      .main-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-width: 220px;
        padding: 14px 24px;
        border: 0;
        border-radius: 999px;
        background: #1d4ed8;
        color: #ffffff;
        font-size: 18px;
        font-weight: 700;
        text-decoration: none;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(29, 78, 216, 0.28);
        transition: transform 0.2s ease, background 0.2s ease;
      }

      .main-button:hover {
        background: #1e40af;
        transform: translateY(-1px);
      }

      .fallback-link {
        border: 0;
        background: transparent;
        color: #6b7280;
        font-size: 12px;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
      }

      .fallback-link:hover {
        color: #374151;
      }

      .help-button {
        border: 1px solid #d1d5db;
        background: #ffffff;
        color: #374151;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 18px;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .help-button:hover {
        background: #f3f4f6;
      }

      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal-box {
        background: #fff;
        border-radius: 12px;
        padding: 28px 32px;
        max-width: 460px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      }

      .modal-box h2 {
        margin: 0 0 18px;
        font-size: 18px;
        color: #111827;
      }

      .browser-tip {
        margin-bottom: 14px;
        padding: 10px 14px;
        background: #f9fafb;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
      }

      .browser-tip strong {
        display: block;
        margin-bottom: 4px;
        color: #1f2937;
        font-size: 14px;
      }

      .browser-tip p {
        margin: 0;
        font-size: 13px;
        color: #4b5563;
        line-height: 1.5;
      }

      .close-button {
        display: block;
        margin: 18px auto 0;
        padding: 10px 28px;
        border: none;
        border-radius: 8px;
        background: #1d4ed8;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
      }

      .close-button:hover {
        background: #1e40af;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <a id="downloadBtn" class="main-button" href="#"><span aria-hidden="true">⬇️</span><span>Download PDF</span></a>
      <button id="helpBtn" class="help-button" type="button">Need Help?</button>
      <button id="fallbackLink" class="fallback-link" type="button">Having trouble? Click here.</button>

      <div id="helpModal" class="modal-overlay" style="display:none;">
        <div class="modal-box">
          <h2>📄 PDF Not Downloading?</h2>
          <div class="browser-tip">
            <strong>Chrome</strong>
            <p>Go to <em>Settings → Privacy and Security → Site Settings → PDF Documents</em> → Select <strong>"Download PDFs"</strong></p>
          </div>
          <div class="browser-tip">
            <strong>Edge</strong>
            <p>Go to <em>Settings → Cookies and Site Permissions → PDF Documents</em> → Turn off <strong>"Always open PDF files externally"</strong></p>
          </div>
          <div class="browser-tip">
            <strong>Safari (Mac)</strong>
            <p>PDFs will open in the browser. To save, click the <strong>download icon</strong> in the top right of the PDF viewer, or right-click the download link and select <strong>"Save Link As"</strong></p>
          </div>
          <div class="browser-tip">
            <strong>Safari (iPhone/iPad)</strong>
            <p>Tap the download link → Tap the <strong>Share icon</strong> → Select <strong>"Save to Files"</strong> to save the PDF to your device</p>
          </div>
          <div class="browser-tip">
            <strong>Firefox</strong>
            <p>PDFs download automatically by default. Check your Downloads folder.</p>
          </div>
          <button id="closeHelp" class="close-button" type="button">Close</button>
        </div>
      </div>
    </div>
    <script>
      const blobUrl = ${safeBlobUrl};
      const filename = ${safeFilename};
      const downloadBtn = document.getElementById('downloadBtn');
      const fallbackLink = document.getElementById('fallbackLink');

      async function triggerDownload() {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      async function downloadPdf() {
        try {
          if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
              suggestedName: filename,
              types: [{
                description: 'PDF Document',
                accept: { 'application/pdf': ['.pdf'] },
              }],
            });
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return;
          }

          await triggerDownload();
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          await triggerDownload();
        }
      }

      if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
          e.preventDefault();
          downloadPdf();
        });

        setTimeout(() => {
          downloadBtn.click();
        }, 150);
      }

      if (fallbackLink) {
        fallbackLink.addEventListener('click', (e) => {
          e.preventDefault();
          downloadPdf();
        });
      }

      const helpBtn = document.getElementById('helpBtn');
      const helpModal = document.getElementById('helpModal');
      const closeHelp = document.getElementById('closeHelp');

      if (helpBtn && helpModal) {
        helpBtn.addEventListener('click', () => { helpModal.style.display = 'flex'; });
      }
      if (closeHelp && helpModal) {
        closeHelp.addEventListener('click', () => { helpModal.style.display = 'none'; });
      }
      if (helpModal) {
        helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.style.display = 'none'; });
      }
    </script>
  </body>
</html>`);
  win.document.close();
  return true;
}

/**
 * Reliable PDF save flow for restrictive browser + extension environments.
 */
export async function savePdfReliably(doc: jsPDF, filename: string): Promise<void> {
  const dataUri = doc.output("datauristring");

  // Try File System Access API first in every context.
  // This avoids Chrome download blockers because the user chooses the destination file directly.
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "PDF Document",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(doc.output("blob"));
      await writable.close();
      toast.success("PDF saved.");
      return;
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.warn("showSaveFilePicker failed, falling back:", err);
    }
  }

  // In embedded preview environments, direct downloads are often blocked by extensions/policies.
  // Open a top-level utility tab with a prominent Download PDF button and a small fallback link.
  if (isEmbeddedPreview) {
    const opened = openPdfViewerTab(dataUri, filename);
    if (!opened) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }
    toast.info("PDF opened in a new tab. Click Download PDF in that tab.");
    return;
  }

  // Use a dedicated helper tab as the universal fallback for consistent UX.
  const opened = openPdfViewerTab(dataUri, filename);
  if (opened) {
    toast.info("PDF opened in a new tab. Click Download PDF in that tab.");
  } else {
    toast.error("Unable to save PDF. Please allow popups and try again.");
  }
}
