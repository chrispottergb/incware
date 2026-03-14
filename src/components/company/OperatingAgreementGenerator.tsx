import { useState, useEffect, useCallback, useRef } from "react";
import { useShareCalculations } from "@/hooks/useShareCalculations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  FileText, Download, Eye, Loader2, Sparkles, Printer, Copy, Check, Share2,
  ChevronDown, History, RotateCcw, FileDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import {
  generateOperatingAgreementPDF, type OperatingAgreementData,
} from "@/lib/operating-agreement-pdf";
import AIProviderSelect from "@/components/company/AIProviderSelect";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";

interface Props {
  companyId: string;
  companyName: string;
  company: any;
}

const AI_SECTION_KEYS = [
  "preamble", "formation", "purpose", "term", "members",
  "capitalContributions", "distributions", "management",
  "meetings", "transfer", "dissolution", "booksAndRecords",
  "tax", "indemnification",
];

const AI_SECTION_LABELS: Record<string, string> = {
  preamble: "Preamble",
  formation: "Formation",
  purpose: "Purpose & Powers",
  term: "Term",
  members: "Members & Interests",
  capitalContributions: "Capital Contributions",
  distributions: "Distributions",
  management: "Management",
  meetings: "Meetings",
  transfer: "Transfer of Interests",
  dissolution: "Dissolution",
  booksAndRecords: "Books & Records",
  tax: "Tax Matters",
  indemnification: "Indemnification",
};

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export default function OperatingAgreementGenerator({ companyId, companyName, company }: Props) {
  const queryClient = useQueryClient();
  const { shareholderHoldings, totalIssuedShares } = useShareCalculations(companyId);
  const [managementType, setManagementType] = useState<"member-managed" | "manager-managed">("member-managed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("ai_provider") || "lovable");
  const [aiDraftSections, setAiDraftSections] = useState<Record<string, string> | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [pendingDownloadType, setPendingDownloadType] = useState<"pdf" | "docx" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [previewPages, setPreviewPages] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewPdfRef = useRef<any>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("*").eq("company_id", companyId).order("name");
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

  const { data: versionHistory = [] } = useQuery({
    queryKey: ["doc-versions", companyId, "Operating Agreement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_registry")
        .select("*")
        .eq("company_id", companyId)
        .eq("document_type", "Operating Agreement")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const buildPdf = useCallback((sections: Record<string, string> | null = null) => {
    const data: OperatingAgreementData = {
      company, members, officers, managementType, aiDraftSections: sections,
      shareholderHoldings: shareholderHoldings || {},
      totalIssuedUnits: totalIssuedShares,
    };
    const doc = generateOperatingAgreementPDF(data);
    setPdfDoc(doc);
    setPreviewPage(1);
    return doc;
  }, [company, members, officers, managementType, shareholderHoldings, totalIssuedShares]);

  const saveVersion = async (doc: any, isAi: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const blob = doc.output("blob");
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const versionNum = versionHistory.length + 1;
      const fileName = `${userId}/${safeName}_Operating_Agreement_v${versionNum}_${Date.now()}.pdf`;

      await supabase.storage
        .from("generated-documents")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: true });

      const { data: signedData } = await supabase.storage
        .from("generated-documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      await supabase.from("document_registry").insert({
        company_id: companyId,
        title: `Operating Agreement v${versionNum} (${managementType})${isAi ? " — AI Assisted" : ""} — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Operating Agreement",
        status: "final",
        file_name: fileName,
        file_url: signedData?.signedUrl || null,
        statute_reference: "Wis. Stat. Ch. 183",
      });

      queryClient.invalidateQueries({ queryKey: ["doc-versions", companyId, "Operating Agreement"] });
    } catch (err: any) {
      console.error("Save version error:", err);
    }
  };

  const handleClientGenerate = async () => {
    setIsGenerating(true);
    try {
      setAiDraftSections(null);
      setIsAiDraft(false);
      const doc = buildPdf(null);
      await saveVersion(doc, false);
      toast.success("Operating Agreement generated!");
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-operating-agreement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ company_id: companyId, management_type: managementType, ai_provider: aiProvider }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) { toast.error("Rate limit exceeded. Please try again shortly."); return; }
        if (response.status === 402) { toast.error("AI credits exhausted. Please add credits."); return; }
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const data = await response.json();
      setAiDraftSections(data.aiDraftSections);
      setIsAiDraft(true);
      const doc = buildPdf(data.aiDraftSections);
      await saveVersion(doc, true);
      toast.success("AI-drafted Operating Agreement generated!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleRevertSection = (sectionKey: string) => {
    if (!aiDraftSections) return;
    const updated = { ...aiDraftSections };
    delete updated[sectionKey];
    setAiDraftSections(Object.keys(updated).length > 0 ? updated : null);
    buildPdf(Object.keys(updated).length > 0 ? updated : null);
    toast.success(`Reverted "${AI_SECTION_LABELS[sectionKey]}" to standard language.`);
  };

  const handleRevertAll = () => {
    setAiDraftSections(null);
    setIsAiDraft(false);
    buildPdf(null);
    toast.success("All sections reverted to standard template.");
  };

  const initiateDownload = (type: "pdf" | "docx") => {
    const hasAccepted = localStorage.getItem(`disclaimer_accepted_${companyId}`);
    if (hasAccepted) {
      type === "pdf" ? executePdfDownload() : executeDocxDownload();
    } else {
      setPendingDownloadType(type);
      setShowDisclaimer(true);
    }
  };

  const handleDisclaimerAccept = () => {
    localStorage.setItem(`disclaimer_accepted_${companyId}`, "true");
    setShowDisclaimer(false);
    if (pendingDownloadType === "pdf") executePdfDownload();
    else executeDocxDownload();
    setPendingDownloadType(null);
  };

  const executePdfDownload = async () => {
    if (pdfDoc) {
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const { savePdfReliably } = await import("@/lib/pdf-save");
      await savePdfReliably(pdfDoc, `${safeName}_Operating_Agreement.pdf`);
    }
  };

  const executeDocxDownload = async () => {
    try {
      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
      const ai = aiDraftSections || {};
      const isManagerManaged = managementType === "manager-managed";
      const filingDate = company.filing_date ? new Date(company.filing_date + "T00:00:00").toLocaleDateString() : "_______________";
      const raName = company.registered_agent_name || "_______________";
      const purpose = company.business_purpose || "any lawful business purpose";
      const fiscalYearEnd = company.fiscal_year_end || "December 31";

      const sections: { heading: string; text: string; isAi?: boolean }[] = [
        { heading: "PREAMBLE", text: ai.preamble || `This Operating Agreement of ${companyName}...`, isAi: !!ai.preamble },
        { heading: "ARTICLE I — FORMATION", text: ai.formation || `The Company was formed as a Wisconsin LLC on ${filingDate}.`, isAi: !!ai.formation },
        { heading: "ARTICLE II — NAME AND PRINCIPAL OFFICE", text: `The name of the Company is "${companyName}".` },
        { heading: "ARTICLE III — PURPOSE AND POWERS", text: ai.purpose || `The Company is organized for the purpose of ${purpose}.`, isAi: !!ai.purpose },
        { heading: "ARTICLE IV — TERM", text: ai.term || "The term of the Company shall be perpetual.", isAi: !!ai.term },
        { heading: "ARTICLE V — MEMBERS", text: ai.members || "The Members are as set forth in Schedule A.", isAi: !!ai.members },
        { heading: "ARTICLE VI — CAPITAL CONTRIBUTIONS", text: ai.capitalContributions || "Each Member shall make initial capital contributions.", isAi: !!ai.capitalContributions },
        { heading: "ARTICLE VII — DISTRIBUTIONS", text: ai.distributions || "Distributions shall be made in proportion to membership interests.", isAi: !!ai.distributions },
        { heading: `ARTICLE VIII — MANAGEMENT`, text: ai.management || `The Company shall be ${isManagerManaged ? "manager" : "member"}-managed.`, isAi: !!ai.management },
        { heading: "ARTICLE IX — MEETINGS", text: ai.meetings || "The Members shall hold annual meetings.", isAi: !!ai.meetings },
        { heading: "ARTICLE X — TRANSFER OF INTERESTS", text: ai.transfer || "No Member may transfer interests without consent.", isAi: !!ai.transfer },
        { heading: "ARTICLE XI — DISSOLUTION", text: ai.dissolution || "The Company shall dissolve upon unanimous agreement.", isAi: !!ai.dissolution },
        { heading: "ARTICLE XII — BOOKS AND RECORDS", text: ai.booksAndRecords || "The Company shall maintain books and records.", isAi: !!ai.booksAndRecords },
        { heading: "ARTICLE XIII — TAX MATTERS", text: ai.tax || `Fiscal year ends ${fiscalYearEnd}.`, isAi: !!ai.tax },
        { heading: "ARTICLE XIV — INDEMNIFICATION", text: ai.indemnification || "The Company shall indemnify Members and officers.", isAi: !!ai.indemnification },
      ];

      const children: Paragraph[] = [
        new Paragraph({
          text: "OPERATING AGREEMENT",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: companyName,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      ];

      for (const s of sections) {
        children.push(new Paragraph({
          text: s.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        }));
        if (s.isAi) {
          children.push(new Paragraph({
            children: [new TextRun({ text: "[AI ASSISTED] ", bold: true, color: "8B5CF6", size: 18 })],
          }));
        }
        children.push(new Paragraph({
          children: [new TextRun({ text: s.text, size: 22 })],
          spacing: { after: 200 },
        }));
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${safeName}_Operating_Agreement.docx`);
      toast.success("Word document downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate Word document: " + err.message);
    }
  };

  const handlePreview = () => {
    if (!pdfDoc) {
      toast.error("Please generate the Operating Agreement first.");
      return;
    }

    const previewCard = document.getElementById("operating-agreement-preview");
    if (previewCard) {
      previewCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handlePrint = () => {
    if (pdfDoc) {
      const blob = pdfDoc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companyName.replace(/[^a-zA-Z0-9]/g, "_")}_Operating_Agreement_Print.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  useEffect(() => {
    if (!pdfDoc) {
      previewPdfRef.current = null;
      setPreviewPages(0);
      return;
    }

    let cancelled = false;
    const loadPdf = async () => {
      try {
        const arrayBuffer = pdfDoc.output("arraybuffer");
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;
        previewPdfRef.current = loadedPdf;
        setPreviewPages(loadedPdf.numPages);
        setPreviewPage(1);
      } catch (error) {
        console.error("Operating Agreement preview load failed:", error);
        if (!cancelled) toast.error("Unable to render preview in Chrome. You can still download the PDF.");
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  useEffect(() => {
    if (!previewPdfRef.current || !previewCanvasRef.current || !previewContainerRef.current || previewPages === 0) return;

    let cancelled = false;
    const renderPage = async () => {
      setIsRenderingPreview(true);
      try {
        const page = await previewPdfRef.current.getPage(previewPage);
        if (cancelled) return;

        const containerWidth = Math.max(previewContainerRef.current!.clientWidth - 24, 320);
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = previewCanvasRef.current!;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = viewport.width * 2;
        canvas.height = viewport.height * 2;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        ctx.setTransform(2, 0, 0, 2, 0, 0);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (error) {
        console.error("Operating Agreement preview render failed:", error);
      } finally {
        if (!cancelled) setIsRenderingPreview(false);
      }
    };

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [previewPage, previewPages]);

  const isLLC = company.entity_type === "LLC" || company.entity_type === "Single Member LLC";
  if (!isLLC) return null;

  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">Operating Agreement</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isAiDraft && <Badge className="bg-purple-600 text-[10px]">AI Assisted</Badge>}
              <Badge variant="outline" className="text-[10px]">Wis. Stat. Ch. 183</Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Generate a comprehensive Wisconsin LLC Operating Agreement. Choose standard template or AI-assisted drafting.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Management Type Selection */}
          <div className="field-group max-w-xs">
            <Label className="field-label">Management Structure</Label>
            <Select value={managementType} onValueChange={(v) => setManagementType(v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member-managed">Member-Managed (Wis. Stat. § 183.0401(1))</SelectItem>
                <SelectItem value="manager-managed">Manager-Managed (Wis. Stat. § 183.0401(2))</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AIProviderSelect value={aiProvider} onChange={setAiProvider} />

          {/* Generation Buttons */}
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

          {/* AI Section Controls */}
          {aiDraftSections && Object.keys(aiDraftSections).length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                  <ChevronDown className="h-3 w-3" />
                  AI-Assisted Sections ({Object.keys(aiDraftSections).length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">Revert individual sections to standard language:</p>
                    <Button variant="ghost" size="sm" className="text-xs h-6" onClick={handleRevertAll}>
                      <RotateCcw className="h-3 w-3" /> Revert All
                    </Button>
                  </div>
                  {AI_SECTION_KEYS.filter(k => aiDraftSections[k]).map(key => (
                    <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-600 text-[8px] h-4">AI</Badge>
                        <span>{AI_SECTION_LABELS[key]}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2" onClick={() => handleRevertSection(key)}>
                        <RotateCcw className="h-2.5 w-2.5" /> Revert
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action Buttons */}
          {pdfDoc && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => initiateDownload("pdf")}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => initiateDownload("docx")}>
                <FileDown className="h-3.5 w-3.5" /> Download Word
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" /> Print
              </Button>
            </div>
          )}

          {/* Version History */}
          {versionHistory.length > 0 && (
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
                  <History className="h-3 w-3" />
                  Version History ({versionHistory.length})
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  {versionHistory.map((v: any, i: number) => (
                    <div key={v.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] h-4">v{versionHistory.length - i}</Badge>
                        <span className="text-muted-foreground">{v.title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Inline Preview */}
      {pdfDoc && (
        <Card id="operating-agreement-preview">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              <Eye className="h-4 w-4" /> Document Preview
              {isAiDraft && <Badge className="bg-purple-600 text-[9px]">Contains AI-Assisted Sections</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {previewPages > 1 && (
              <div className="mb-3 flex items-center justify-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setPreviewPage((page) => Math.max(1, page - 1))}
                  disabled={previewPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">Page {previewPage} of {previewPages}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => setPreviewPage((page) => Math.min(previewPages, page + 1))}
                  disabled={previewPage >= previewPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div ref={previewContainerRef} className="relative flex justify-center overflow-auto rounded border border-border bg-muted/30 p-3">
              {isRenderingPreview && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              <canvas ref={previewCanvasRef} className="max-w-full rounded shadow" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Disclaimer Dialog */}
      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Legal Disclaimer</DialogTitle>
            <DialogDescription className="text-xs">
              Please review and acknowledge before downloading.
            </DialogDescription>
          </DialogHeader>
          <div className="text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto border border-border rounded p-3 bg-muted/30">
            <p><strong>IMPORTANT NOTICE:</strong> This document is generated by EntityIQ as a template for informational purposes only. It does not constitute legal advice and should not be relied upon as such.</p>
            <p>You are strongly encouraged to have this document reviewed by a qualified attorney licensed in your state before executing, filing, or relying on it for any legal purpose.</p>
            <p>EntityIQ makes no warranties, express or implied, regarding the accuracy, completeness, or suitability of this document for any particular purpose. Use of this document is entirely at your own risk.</p>
            {isAiDraft && (
              <p className="text-purple-600 font-medium">This document contains AI-generated content. AI-assisted sections are marked with purple badges and may require additional legal review for accuracy and applicability to your specific circumstances.</p>
            )}
          </div>
          <div className="flex items-start gap-2 mt-2">
            <Checkbox
              id="disclaimer-check"
              checked={disclaimerAccepted}
              onCheckedChange={(v) => setDisclaimerAccepted(!!v)}
            />
            <label htmlFor="disclaimer-check" className="text-xs text-foreground cursor-pointer">
              I acknowledge that this document is a template, not legal advice, and I will seek appropriate legal counsel before using it.
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
            <Button size="sm" disabled={!disclaimerAccepted} onClick={handleDisclaimerAccept}>
              Accept & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
