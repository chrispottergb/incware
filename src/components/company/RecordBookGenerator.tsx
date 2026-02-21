import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  BookOpen,
  Download,
  Share2,
  Loader2,
  FileText,
  Copy,
  Check,
  Eye,
} from "lucide-react";
import {
  generateRecordBookPDF,
  downloadRecordBookPDF,
  getRecordBookBlob,
  getRecordBookPreviewUrl,
  type RecordBookData,
} from "@/lib/record-book-pdf";

interface RecordBookGeneratorProps {
  companyId: string;
  companyName: string;
  entityType: string;
}

export default function RecordBookGenerator({
  companyId,
  companyName,
  entityType,
}: RecordBookGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress("Fetching company data & generating AI narrative…");
    setPdfDoc(null);
    setPreviewUrl(null);
    setShareUrl(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
          body: JSON.stringify({ company_id: companyId }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 402) {
          throw new Error("AI credits exhausted. Please add credits in Settings → Workspace → Usage to continue.");
        }
        if (response.status === 429) {
          throw new Error("AI rate limit reached. Please wait a moment and try again.");
        }
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const data: RecordBookData = await response.json();

      setProgress("Building PDF…");
      const doc = generateRecordBookPDF(data);
      setPdfDoc(doc);

      const url = getRecordBookPreviewUrl(doc);
      setPreviewUrl(url);

      toast({ title: "Record book generated successfully!" });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Generation failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress("");
    }
  };

  const handleDownload = () => {
    if (pdfDoc) {
      downloadRecordBookPDF(pdfDoc, companyName);
    }
  };

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
        .upload(fileName, blob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("generated-documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 days

      if (signedError) throw signedError;

      setShareUrl(signedData.signedUrl);

      // Log to document registry
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
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
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
      {/* Generator Card */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">
                Corporate Record Book
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              AI-Powered
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a comprehensive, beautifully formatted corporate record
            book with AI-generated executive summary and compliance narrative.
            One-click shareable with IRS and state departments of revenue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress || "Generating…"}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate Record Book
              </>
            )}
          </Button>

          {/* Action buttons */}
          {pdfDoc && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => previewUrl && window.open(previewUrl, "_blank")}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShare}
                disabled={!!progress}
              >
                <Share2 className="h-3.5 w-3.5" />
                Create Share Link
              </Button>
            </div>
          )}

          {/* Share URL */}
          {shareUrl && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Shareable Link (30-day expiry):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] bg-background rounded px-2 py-1.5 border border-border truncate">
                  {shareUrl}
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Share this link with the IRS, Wisconsin DOR, or other authorized parties.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline preview */}
      {previewUrl && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              src={previewUrl}
              className="w-full h-[600px] rounded border border-border"
              title="Record Book Preview"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
