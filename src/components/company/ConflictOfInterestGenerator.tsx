import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Download, Eye, Loader2, Printer, Copy, Check, Share2, ShieldAlert,
} from "lucide-react";
import { generateConflictOfInterestPDF, type ConflictOfInterestData } from "@/lib/conflict-of-interest-pdf";

interface Props {
  companyId: string;
  companyName: string;
  company: any;
}

export default function ConflictOfInterestGenerator({ companyId, companyName, company }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const data: ConflictOfInterestData = { company, directors, officers };
      const doc = generateConflictOfInterestPDF(data);
      setPdfDoc(doc);
      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Conflict of Interest Policy generated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfDoc) {
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      pdfDoc.save(`${safeName}_Conflict_of_Interest_Policy.pdf`);
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
      const fileName = `${safeName}_COI_Policy_${Date.now()}.pdf`;

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
        title: `Conflict of Interest Policy — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Conflict of Interest Policy",
        status: "final",
        file_name: fileName,
        file_url: signedData.signedUrl,
        statute_reference: "IRS Form 1023 / Wis. Stat. § 181.0831",
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
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <CardTitle className="text-base font-display">Conflict of Interest Policy</CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              IRS 501(c)(3) Required
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generate the IRS-required Conflict of Interest Policy for your 501(c)(3) tax-exempt organization. Includes the full policy text, procedures for addressing conflicts, and an annual disclosure statement form per IRS Form 1023 Schedule requirements.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={isGenerating} variant="outline">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Policy
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
            <iframe src={previewUrl} className="w-full h-[600px] rounded border border-border" title="Conflict of Interest Policy Preview" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
