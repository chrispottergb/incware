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

  win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${filename}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
      .bar { padding: 10px 14px; border-bottom: 1px solid #ddd; font-size: 13px; }
      iframe { width: 100%; height: calc(100vh - 43px); border: 0; }
    </style>
  </head>
  <body>
    <div class="bar">PDF opened successfully. Use the PDF toolbar's download/save button.</div>
    <iframe src="${dataUri}"></iframe>
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
