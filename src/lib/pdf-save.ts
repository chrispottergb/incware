import jsPDF from "jspdf";
import { toast } from "sonner";

/**
 * Reliably save a jsPDF document, bypassing antivirus / extension
 * blob-URL blocking (Norton, uBlock, etc.) that causes
 * "Check internet connection" or ERR_BLOCKED_BY_CLIENT.
 *
 * Strategy order:
 * 1. File System Access API (showSaveFilePicker) – writes directly to disk.
 *    Not available inside sandboxed iframes (Lovable preview), so often skipped.
 * 2. Data-URI anchor download – no blob URL for Norton to intercept.
 *    Works up to ~100 MB in modern Chrome with the download attribute.
 * 3. Open data-URI in a new tab so the user can save manually.
 */
export async function savePdfReliably(doc: jsPDF, filename: string): Promise<void> {
  // 1. Try File System Access API (Chrome/Edge 86+, top-level contexts)
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
      if (err?.name === "AbortError") return; // user cancelled
      console.warn("File System Access API unavailable, using data-URI fallback:", err);
    }
  }

  // 2. Data-URI anchor download (bypasses blob-URL blocking entirely)
  try {
    const base64 = doc.output("datauristring"); // "data:application/pdf;filename=…;base64,…"
    const a = document.createElement("a");
    a.href = base64;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 500);
    toast.success("PDF download started.");
    return;
  } catch (err) {
    console.warn("Data-URI download failed, opening in new tab:", err);
  }

  // 3. Last resort: open in a new tab so the user can Ctrl+S / right-click save
  try {
    const base64 = doc.output("datauristring");
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(
        `<!doctype html><html><head><title>${filename}</title></head>` +
        `<body style="margin:0"><iframe src="${base64}" style="width:100%;height:100vh;border:none"></iframe></body></html>`
      );
      win.document.close();
      toast.info("PDF opened in a new tab — use Ctrl+S to save.");
    } else {
      toast.error("Popup blocked. Please allow popups for this site and try again.");
    }
  } catch (err) {
    console.error("All PDF save methods failed:", err);
    toast.error("Unable to save PDF. Please disable ad-blockers or Norton Download Intelligence and try again.");
  }
}
