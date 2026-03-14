import jsPDF from "jspdf";

/**
 * Reliably save a jsPDF document, bypassing antivirus blob-URL blocking.
 *
 * Strategy order:
 * 1. File System Access API (showSaveFilePicker) – writes directly to disk,
 *    no blob URL for Norton to intercept.
 * 2. Anchor-download with Blob – classic approach.
 * 3. Open in new tab as data-URI fallback (last resort).
 */
export async function savePdfReliably(doc: jsPDF, filename: string): Promise<void> {
  const blob = doc.output("blob");

  // 1. Try File System Access API (Chrome/Edge 86+)
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
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: any) {
      // User cancelled the dialog — fall through to anchor download
      if (err?.name === "AbortError") return;
      console.warn("File System Access API failed, falling back:", err);
    }
  }

  // 2. Anchor-download with revoke delay
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // Small delay before cleanup so the browser can start the download
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);
    return;
  } catch (err) {
    console.warn("Anchor download failed, falling back to data URI:", err);
  }

  // 3. Last resort: open as data URI in a new tab
  const dataUri = doc.output("datauristring");
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(
      `<html><head><title>${filename}</title></head><body style="margin:0">` +
      `<iframe src="${dataUri}" style="width:100%;height:100%;border:none"></iframe>` +
      `</body></html>`
    );
    win.document.close();
  }
}
