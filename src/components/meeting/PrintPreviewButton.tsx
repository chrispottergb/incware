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

      // Use a hidden iframe to print — avoids popup blockers entirely
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.left = "-9999px";
      iframe.style.top = "-9999px";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.src = url;
      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.print();
          } catch {
            // Fallback: open in new tab if print fails
            window.open(url, "_blank");
          }
          // Clean up after a delay
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 5000);
        }, 500);
      };
    } catch (err: any) {
      console.error("PDF print error:", err);
      toast.error("Failed to generate PDF: " + (err?.message || "Unknown error"));
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
                <Button size="sm" onClick={handlePrint}>
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
