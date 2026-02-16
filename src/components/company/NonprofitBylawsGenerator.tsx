import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Download, Eye, Loader2, Sparkles, Printer, Copy, Check, Share2,
} from "lucide-react";
import { generateNonprofitBylawsPDF, type NonprofitBylawsData } from "@/lib/nonprofit-bylaws-pdf";

interface Props {
  companyId: string;
  companyName: string;
  company: any;
}

export default function NonprofitBylawsGenerator({ companyId, companyName, company }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["officers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officers").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const buildPdf = (aiDraftSections: Record<string, string> | null = null) => {
    const data: NonprofitBylawsData = { company, directors, officers, aiDraftSections };
    const doc = generateNonprofitBylawsPDF(data);
    setPdfDoc(doc);
    const blob = doc.output("blob");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
    return doc;
  };

  const handleClientGenerate = () => {
    setIsGenerating(true);
    try {
      buildPdf(null);
      toast.success("Non-Profit Bylaws generated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiGenerate = async () => {
    setIsAiGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-nonprofit-bylaws`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ company_id: companyId }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) { toast.error("Rate limit exceeded. Please try again shortly."); return; }
        if (response.status === 402) { toast.error("AI credits exhausted."); return; }
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const data = await response.json();
      buildPdf(data.aiDraftSections);
      toast.success("AI-drafted Non-Profit Bylaws generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfDoc) {
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      pdfDoc.save(`${safeName}_Nonprofit_Bylaws.pdf`);
    }
  };

  const handlePreview = () => {
    if (previewUrl) {
      const win = window.open("", "_blank");
      if (win) win.location.href = previewUrl;
    }
  };

  const handlePrint = () => {
    if (pdfDoc) {
      const win = window.open("", "_blank");
      const blob = pdfDoc.output("blob");
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
        win.addEventListener("load", () => win.print());
      }
    }
  };

  const handleShare = async () => {
    if (!pdfDoc) return;
    try {
      const blob = pdfDoc.output("blob");
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const fileName = `${safeName}_Nonprofit_Bylaws_${Date.now()}.pdf`;

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
        title: `Non-Profit Bylaws — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Nonprofit Bylaws",
        status: "final",
        file_name: fileName,
        file_url: signedData.signedUrl,
        statute_reference: "Wis. Stat. Ch. 181",
      });

      toast.success("Shareable link created! Valid for 30 days.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    }
  };

  if (company.entity_type !== "Non-Profit") return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="border-l-4 border-l-success">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-success" />
              <CardTitle className="text-base font-display">Non-Profit Bylaws</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Wis. Stat. Ch. 181
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generate comprehensive bylaws for your non-profit corporation under the Wisconsin Nonstock Corporation Law. Includes membership, board governance, conflict of interest provisions, dissolution clause, and IRS 501(c)(3) compliance language.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleClientGenerate} disabled={isGenerating || isAiGenerating} variant="outline">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Standard
            </Button>
            <Button onClick={handleAiGenerate} disabled={isGenerating || isAiGenerating}>
              {isAiGenerating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Drafting with AI…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> AI-Assisted Draft</>
              )}
            </Button>
          </div>

          {pdfDoc && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
              <Button variant="secondary" size="sm" onClick={handleShare}>
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
            </div>
          )}
        </CardContent>
      </Card>

      {previewUrl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Eye className="h-4 w-4" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <iframe src={previewUrl} className="w-full h-[600px] rounded border border-border" title="Non-Profit Bylaws Preview" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
