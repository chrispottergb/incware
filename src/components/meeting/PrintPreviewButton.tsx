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
import { savePdfReliably, printPdfInIframe } from "@/lib/pdf-save";

// Use bundled worker via Vite's ?url import for reliable loading
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;


interface Props {
  label?: string;
  generatePDF: () => jsPDF;
  fileName: string;
  autoPreview?: boolean;
}

export default function PrintPreviewButton({ label = "Print", generatePDF, fileName, autoPreview = false }: Props) {
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
      if (!doc) {
        console.warn("[PDF Preview] generatePDF returned null/falsy — aborting.");
        setLoading(false);
        return;
      }
      
      const arrayBuf = doc.output("arraybuffer");
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        console.error("[PDF Preview] arraybuffer is empty or null.");
        toast.error("PDF generation produced an empty document.");
        setLoading(false);
        return;
      }
      
      setPdfData(new Uint8Array(arrayBuf));
      setCurrentPage(1);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("[PDF Preview] Error during PDF generation:", err);
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

    try {
      popup.document.open();
      popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${suggestedName}</title>
    <style>
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f3f4f6; }
      .wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; height: 100vh; padding: 24px; box-sizing: border-box; }
      .main-button { display: inline-flex; align-items: center; gap: 8px; background: #dc2626; color: white; border: none; border-radius: 8px; padding: 14px 28px; font-size: 16px; font-weight: 600; text-decoration: none; cursor: pointer; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3); transition: all 0.2s; }
      .main-button:hover { background: #b91c1c; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4); }
      .main-button svg { width: 20px; height: 20px; }
      .fallback-link { color: #6b7280; font-size: 13px; text-decoration: underline; cursor: pointer; background: none; border: none; padding: 0; }
      .fallback-link:hover { color: #374151; }
      .filename { color: #1f2937; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="filename">${suggestedName}</div>
      <a id="downloadLink" class="main-button" href="#">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF
      </a>
      <button id="fallbackLink" class="fallback-link" type="button">Having trouble? Click here.</button>
    </div>
  </body>
</html>`);
      popup.document.close();

      const downloadLink = popup.document.getElementById("downloadLink") as HTMLAnchorElement | null;
      const fallbackLink = popup.document.getElementById("fallbackLink") as HTMLButtonElement | null;

      if (downloadLink) {
        downloadLink.href = url;
        downloadLink.download = suggestedName;
      }

      if (fallbackLink) {
        fallbackLink.onclick = () => {
          const a = popup.document.createElement("a");
          a.href = url;
          a.download = suggestedName;
          a.style.display = "none";
          popup.document.body.appendChild(a);
          a.click();
          popup.document.body.removeChild(a);
        };
      }

      // Auto-trigger download for the main button after a brief delay
      if (downloadLink && mode === "download") {
        setTimeout(() => downloadLink.click(), 300);
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
      if (!doc) {
        console.warn("[PDF Download] generatePDF returned null/falsy — aborting.");
        return;
      }
      
      const testBlob = doc.output("blob");
      if (!testBlob || testBlob.size === 0) {
        console.error("[PDF Download] Generated PDF blob is empty.");
        toast.error("PDF generation produced an empty document.");
        return;
      }
      
      await savePdfReliably(doc, fileName);
      
    } catch (err: any) {
      console.error("[PDF Download] Error during PDF generation or save:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    }
  };

  const handlePrint = () => {
    try {
      
      const doc = generatePDF();
      if (!doc) {
        console.warn("[PDF Print] generatePDF returned null/falsy — aborting.");
        return;
      }
      
      const blob = doc.output("blob");
      if (!blob || blob.size === 0) {
        console.error("[PDF Print] Generated PDF blob is empty.");
        toast.error("PDF generation produced an empty document.");
        return;
      }
      

      if (isEmbeddedPreview) {
        const opened = openPdfInNewTab(blob);
        if (!opened) {
          downloadBlob(blob, fileName);
          toast.info("Popup blocked. PDF downloaded instead.");
          return;
        }
        toast.info("PDF opened — use Ctrl+P / ⌘+P to print from your PDF viewer.");
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

  // Auto-trigger preview if prop is set
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (autoPreview && !autoTriggered.current) {
      autoTriggered.current = true;
      handlePreview();
    }
  }, [autoPreview]);

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

          {/* Page navigation - moved to bottom */}
          <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30">
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <canvas ref={canvasRef} className="shadow-lg rounded" />
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-border bg-background">
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
        </DialogContent>
      </Dialog>
    </>
  );
}
