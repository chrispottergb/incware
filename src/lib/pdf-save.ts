import jsPDF from "jspdf";
import { toast } from "sonner";

const isEmbeddedPreview = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function openPdfViewerTab(dataUri: string, filename: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  const safeDataUri = JSON.stringify(dataUri);
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
    </style>
  </head>
  <body>
    <div class="wrap">
      <a id="downloadBtn" class="main-button" href="#"><span aria-hidden="true">⬇️</span><span>Download PDF</span></a>
      <button id="fallbackLink" class="fallback-link" type="button">Having trouble? Click here.</button>
    </div>
    <script>
      const dataUri = ${safeDataUri};
      const filename = ${safeFilename};
      const downloadBtn = document.getElementById('downloadBtn');
      const fallbackLink = document.getElementById('fallbackLink');

      async function triggerDownload() {
        const a = document.createElement('a');
        a.href = dataUri;
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
            const response = await fetch(dataUri);
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
  // Open a top-level utility tab with a Save button and fallback link.
  if (isEmbeddedPreview) {
    const opened = openPdfViewerTab(dataUri, filename);
    if (!opened) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }
    toast.info("PDF opened in a new tab. Click Download PDF in that tab.");
    return;
  }

  // Fallback: data-URI download (no blob URL).
  try {
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
    toast.success("PDF download started.");
    return;
  } catch (err) {
    console.warn("Data-URI download failed, opening viewer tab:", err);
  }

  const opened = openPdfViewerTab(dataUri, filename);
  if (opened) {
    toast.info("PDF opened in a new tab. Click Download PDF in that tab.");
  } else {
    toast.error("Unable to save PDF. Please allow popups and try again.");
  }
}
