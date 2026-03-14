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
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid #ddd;
        font-size: 13px;
      }
      .actions { display: flex; gap: 8px; }
      button, a {
        border: 1px solid #bbb;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 12px;
        background: #fff;
        color: #111;
        text-decoration: none;
        cursor: pointer;
      }
      iframe { width: 100%; height: calc(100vh - 52px); border: 0; }
    </style>
  </head>
  <body>
    <div class="bar">
      <span>PDF opened successfully.</span>
      <div class="actions">
        <button id="saveBtn" type="button">Save PDF</button>
        <a id="downloadLink" href="#">Download fallback</a>
      </div>
    </div>
    <iframe id="pdfFrame"></iframe>
    <script>
      const dataUri = ${safeDataUri};
      const filename = ${safeFilename};
      const frame = document.getElementById('pdfFrame');
      const downloadLink = document.getElementById('downloadLink');
      const saveBtn = document.getElementById('saveBtn');

      if (frame) frame.src = dataUri;
      if (downloadLink) {
        downloadLink.href = dataUri;
        downloadLink.download = filename;
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
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

            if (downloadLink) {
              downloadLink.click();
            }
          } catch (err) {
            if (err && err.name === 'AbortError') return;
            if (downloadLink) {
              downloadLink.click();
            }
          }
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

  // In embedded preview environments, direct downloads are often blocked by client extensions.
  // Open a top-level viewer tab instead so users can save via the native PDF toolbar.
  if (isEmbeddedPreview) {
    const opened = openPdfViewerTab(dataUri, filename);
    if (!opened) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }
    toast.info("PDF opened in a new tab. Click the PDF toolbar save icon.");
    return;
  }

  // Top-level context: try File System Access API first.
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
      console.warn("showSaveFilePicker failed, falling back to data URI download:", err);
    }
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
    toast.info("PDF opened in a new tab. Click the PDF toolbar save icon.");
  } else {
    toast.error("Unable to save PDF. Please allow popups and try again.");
  }
}
