import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Eye, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

interface Props {
  label?: string;
  generatePDF: () => jsPDF;
  fileName: string;
}

export default function PrintPreviewButton({ label = "Print", generatePDF, fileName }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  const handlePreview = () => {
    setLoading(true);
    try {
      const doc = generatePDF();
      if (!doc) { setLoading(false); return; }
      const arrayBuf = doc.output("arraybuffer");
      setPdfData(new Uint8Array(arrayBuf));
      setCurrentPage(1);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("PDF preview error:", err);
      toast.error("Failed to generate PDF preview: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const isEmbeddedPreview = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const downloadBlob = (blob: Blob, suggestedName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const openPdfUtilityTab = (
    blob: Blob,
    suggestedName: string,
    mode: "download" | "print"
  ) => {
    const popup = window.open("", "_blank");
    if (!popup) return false;

    const url = URL.createObjectURL(blob);
    let revoked = false;
    const revokeUrl = () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    };

    const registerCleanup = () => {
      popup.addEventListener("beforeunload", revokeUrl, { once: true });
      setTimeout(revokeUrl, 5 * 60 * 1000);
    };

    if (mode === "download") {
      try {
        registerCleanup();
        popup.location.replace(url);
        return true;
      } catch (error) {
        console.error("PDF viewer tab error:", error);
        revokeUrl();
        popup.close();
        return false;
      }
    }

    try {
      popup.document.open();
      popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${suggestedName}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
      .wrap { display: flex; flex-direction: column; gap: 12px; height: 100vh; padding: 16px; box-sizing: border-box; }
      .actions { display: flex; gap: 8px; }
      button, a { border: 1px solid; border-radius: 8px; padding: 8px 12px; text-decoration: none; background: none; color: inherit; font: inherit; cursor: pointer; }
      iframe { width: 100%; flex: 1; border: 1px solid; border-radius: 10px; }
      .hint { margin: 0; font-size: 13px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <strong>${suggestedName}</strong>
      <div class="actions">
        <a id="openViewerLink" href="#">Open PDF in Viewer</a>
        <button id="printButton" type="button">Print PDF</button>
      </div>
      <p class="hint">If download is blocked here, open the PDF viewer and use its built-in Save action.</p>
      <iframe id="pdfFrame"></iframe>
    </div>
  </body>
</html>`);
      popup.document.close();

      const frame = popup.document.getElementById("pdfFrame") as HTMLIFrameElement | null;
      const openViewerLink = popup.document.getElementById("openViewerLink") as HTMLAnchorElement | null;
      const printButton = popup.document.getElementById("printButton") as HTMLButtonElement | null;

      if (frame) frame.src = url;
      if (openViewerLink) {
        openViewerLink.onclick = (event) => {
          event.preventDefault();
          popup.location.replace(url);
        };
      }

      if (printButton) {
        printButton.onclick = () => {
          try {
            frame?.contentWindow?.focus();
            frame?.contentWindow?.print();
          } catch {
            popup.print();
          }
        };

        setTimeout(() => printButton.click(), 350);
      }

      registerCleanup();
      return true;
    } catch (error) {
      console.error("PDF helper tab error:", error);
      revokeUrl();
      popup.close();
      return false;
    }
  };

  const openPdfInNewTab = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const popup = window.open(url, "_blank", "noopener,noreferrer");

    if (!popup) {
      URL.revokeObjectURL(url);
      return false;
    }

    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  };

  const handleDownload = async () => {
    try {
      const doc = generatePDF();
      if (!doc) return;

      const arrayBuffer = doc.output("arraybuffer");
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });

      if (isEmbeddedPreview) {
        const opened = openPdfUtilityTab(blob, fileName, "download");
        if (!opened) {
          toast.error("Popup blocked. Allow popups to download this PDF.");
          return;
        }
        toast.info("PDF helper opened in a new tab. Click Download PDF there.");
        return;
      }

      const savePicker = (window as any).showSaveFilePicker as
        | undefined
        | ((options: any) => Promise<any>);

      if (savePicker && window.isSecureContext) {
        try {
          const fileHandle = await savePicker({
            suggestedName: fileName,
            types: [
              {
                description: "PDF Document",
                accept: { "application/pdf": [".pdf"] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(arrayBuffer);
          await writable.close();
          toast.success("PDF saved.");
          return;
        } catch (pickerErr: any) {
          if (pickerErr?.name === "AbortError") return;
          console.warn("File picker failed, using browser download", pickerErr);
        }
      }

      downloadBlob(blob, fileName);
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    }
  };

  const handlePrint = () => {
    try {
      const doc = generatePDF();
      if (!doc) return;

      const blob = doc.output("blob");

      if (isEmbeddedPreview) {
        const opened = openPdfUtilityTab(blob, fileName, "print");
        if (!opened) {
          toast.error("Popup blocked. Allow popups to print this PDF.");
          return;
        }
        toast.info("PDF helper opened in a new tab for printing.");
        return;
      }

      const opened = openPdfInNewTab(blob);
      if (!opened) {
        downloadBlob(blob, fileName);
        toast.info("Popup blocked. PDF downloaded instead.");
        return;
      }

      toast.info("PDF opened — use Ctrl+P / ⌘+P to print from your PDF viewer.");
    } catch (err: any) {
      console.error("PDF print error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfData(null);
    pdfDocRef.current = null;
    setPageCount(0);
  };

  // Load PDF document when data changes
  useEffect(() => {
    if (!pdfData) return;
    let cancelled = false;
    const loadDoc = async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPageCount(doc.numPages);
      } catch (err) {
        console.error("PDF.js load error:", err);
      }
    };
    loadDoc();
    return () => { cancelled = true; };
  }, [pdfData]);

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current || pageCount === 0) return;
    let cancelled = false;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;

        const container = containerRef.current!;
        const containerWidth = container.clientWidth - 32; // 16px padding each side
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width * 2; // retina
        canvas.height = viewport.height * 2;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.scale(2, 2);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("PDF render error:", err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    };
    renderPage();
    return () => { cancelled = true; };
  }, [currentPage, pageCount]);

  return (
    <>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={handlePreview} disabled={loading}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
          Preview
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PDF
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          {label}
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={handleClosePreview}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-base">Document Preview</DialogTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download PDF
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 px-6 py-2 border-b border-border">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {pageCount}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30">
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <canvas ref={canvasRef} className="shadow-lg rounded" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
