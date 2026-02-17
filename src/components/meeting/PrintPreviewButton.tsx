import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, Eye, Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface Props {
  label?: string;
  generatePDF: () => jsPDF;
  fileName: string;
}

export default function PrintPreviewButton({ label = "Print", generatePDF, fileName }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = () => {
    setLoading(true);
    try {
      const doc = generatePDF();
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("PDF preview error:", err);
      toast.error("Failed to generate PDF preview: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      const doc = generatePDF();
      doc.save(fileName);
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    }
  };

  const handlePrint = () => {
    try {
      const doc = generatePDF();
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      // Most reliable cross-browser: open blob URL directly in same window via anchor
      // This avoids popup blockers entirely
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      // Use download as fallback — browsers that block the new tab will download instead
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.info("PDF opened — use Ctrl+P / ⌘+P to print from your PDF viewer.");

      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      console.error("PDF print error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
    }
  };

  const handlePrintFromPreview = () => {
    const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="PDF Preview"]');
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        handlePrint();
      }
    } else {
      handlePrint();
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

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
                <Button size="sm" onClick={handlePrintFromPreview}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
