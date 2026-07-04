import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen, Download, Share2, Loader2, FileText, Copy, Check, Eye,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  generateRecordBookPDF, downloadRecordBookPDF, getRecordBookBlob,
  type RecordBookData,
} from "@/lib/record-book-pdf";
import AIProviderSelect from "@/components/company/AIProviderSelect";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

interface RecordBookGeneratorProps {
  companyId: string;
  companyName: string;
  entityType: string;
}

export default function RecordBookGenerator({ companyId, companyName, entityType }: RecordBookGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("ai_provider") || "lovable");

  // pdf.js in-app preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress("Fetching company data & generating AI narrative…");
    setPdfDoc(null);
    setShareUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Please log in first", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-record-book`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ company_id: companyId, ai_provider: aiProvider }),
        }
      );

      let data: RecordBookData;

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402 || response.status === 429) {
          toast({ title: response.status === 402 ? "AI credits exhausted" : "AI rate limited", description: "Generating record book with placeholder narratives instead.", variant: "destructive" });
          const fallbackRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-record-book`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ company_id: companyId, ai_provider: "none" }),
            }
          );
          if (!fallbackRes.ok) {
            data = { companyData: { company: { name: companyName, entity_type: "Corporation" } }, aiContent: null } as any;
          } else {
            data = await fallbackRes.json();
          }
        } else {
          throw new Error(err.error || `Failed (${response.status})`);
        }
      } else {
        data = await response.json();
      }

      setProgress("Building PDF…");
      const doc = generateRecordBookPDF(data);
      setPdfDoc(doc);

      toast({ title: "Record book generated successfully!" });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setProgress("");
    }
  };

  const handleDownload = () => {
    if (pdfDoc) downloadRecordBookPDF(pdfDoc, companyName);
  };

  const handlePreview = () => {
    if (!pdfDoc) return;
    try {
      const arrayBuf = pdfDoc.output("arraybuffer");
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        toast({ title: "PDF generation produced an empty document", variant: "destructive" });
        return;
      }
      setPdfData(new Uint8Array(arrayBuf));
      setCurrentPage(1);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("Preview error:", err);
      toast({ title: "Failed to open preview", description: err?.message, variant: "destructive" });
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfData(null);
    pdfDocRef.current = null;
    setPageCount(0);
  };

  useEffect(() => {
    if (!pdfData) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setPageCount(doc.numPages);
      } catch (err) {
        console.error("PDF.js load error:", err);
        toast({ title: "Failed to load preview", variant: "destructive" });
      }
    })();
    return () => { cancelled = true; };
  }, [pdfData]);

  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || !containerRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;
        const container = containerRef.current!;
        const containerWidth = container.clientWidth - 32;
        const unscaled = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaled.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width * 2;
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
    })();
    return () => { cancelled = true; };
  }, [currentPage, pageCount, previewOpen]);

  const handleShare = async () => {
    if (!pdfDoc) return;
    setProgress("Uploading & creating shareable link…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("You must be logged in to share documents.");

      const blob = getRecordBookBlob(pdfDoc);
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${userId}/${safeName}_Record_Book_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("generated-documents")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("generated-documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 30);
      if (signedError) throw signedError;

      setShareUrl(signedData.signedUrl);

      await supabase.from("document_registry").insert({
        company_id: companyId,
        title: `Corporate Record Book — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Record Book",
        status: "final",
        file_name: fileName,
        file_url: signedData.signedUrl,
      });

      toast({ title: "Shareable link created! Valid for 30 days." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setProgress("");
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied to clipboard!" });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">Corporate Record Book</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">AI-Powered</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a comprehensive, beautifully formatted corporate record book with AI-generated executive summary and compliance narrative. One-click shareable with IRS and state departments of revenue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <AIProviderSelect value={aiProvider} onChange={setAiProvider} />

          <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{progress || "Generating…"}</>
            ) : (
              <><FileText className="h-4 w-4" />Generate Record Book</>
            )}
          </Button>

          {pdfDoc && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button variant="secondary" size="sm" onClick={handleShare} disabled={!!progress}>
                <Share2 className="h-3.5 w-3.5" /> Create Share Link
              </Button>
            </div>
          )}

          {shareUrl && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Shareable Link (30-day expiry):</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-background rounded px-2 py-1.5 border border-border truncate">
                  {shareUrl}
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Share this link with the IRS, Wisconsin DOR, or other authorized parties.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={(o) => (o ? setPreviewOpen(true) : handleClosePreview())}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-base">Record Book Preview</DialogTitle>
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </DialogHeader>
          <div ref={containerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30 relative">
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <canvas ref={canvasRef} className="shadow-lg rounded" />
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-border bg-background">
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {pageCount}</span>
              <Button size="sm" variant="ghost" onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))} disabled={currentPage >= pageCount}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
