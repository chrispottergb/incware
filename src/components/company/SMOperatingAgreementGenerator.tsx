import { useState, useEffect, useCallback, useRef } from "react";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  FileText, Download, Eye, Loader2, Printer, Copy, Check, Share2,
  Sparkles, ChevronDown, History, RotateCcw, FileDown, Upload, Save,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
import DocumentVersionHistory from "@/components/company/DocumentVersionHistory";
import {
  generateSMOperatingAgreementPDF,
  type SMOperatingAgreementData,
} from "@/lib/smllc-operating-agreement-pdf";
import {
  generateSMScorpOperatingAgreementPDF,
} from "@/lib/smllc-scorp-operating-agreement-pdf";
import AIProviderSelect from "@/components/company/AIProviderSelect";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { useAutoSave } from "@/hooks/useAutoSave";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";

interface Props {
  companyId: string;
  companyName: string;
  company: any;
}

export default function SMOperatingAgreementGenerator({ companyId, companyName, company }: Props) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("ai_provider") || "lovable");
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [pendingDownloadType, setPendingDownloadType] = useState<"pdf" | "docx" | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isAiDraft, setIsAiDraft] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  // pdf.js in-app preview (avoids nested-iframe blocking + browser download-on-open behavior)
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // Editable form fields
  const [formCompanyName, setFormCompanyName] = useState("");
  const [formMemberName, setFormMemberName] = useState("");
  const [formFilingDate, setFormFilingDate] = useState("");
  const [formBusinessPurpose, setFormBusinessPurpose] = useState("");
  const [formFiscalYearEnd, setFormFiscalYearEnd] = useState("");
  const [formRAName, setFormRAName] = useState("");
  const [formRAAddress, setFormRAAddress] = useState("");
  const [formRACity, setFormRACity] = useState("");
  const [formRAState, setFormRAState] = useState("");
  const [formRAZip, setFormRAZip] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZip, setFormZip] = useState("");
  const lastServerFilingDateRef = useRef("");
  const lastServerCompanyIdRef = useRef<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Live issued-units total from share_transactions (single source of truth).
  // Drives both the units clause in the generated PDFs and the "disable Generate
  // when zero" primary guard so we never emit "0 units / 0%" as a real fact.
  const { data: issuedUnits = 0 } = useQuery({
    queryKey: ["oa-issued-units", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("transaction_type, num_shares, status")
        .eq("company_id", companyId);
      if (error) throw error;
      const ISSUE = new Set([
        "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
        "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
        "treasury_reissue", "Reissuance", "reissuance",
        "Capital Contribution", "Initial Contribution", "initial_contribution",
        "additional_contribution", "membership_issuance", "opening_balance",
      ]);
      const REDUCE = new Set([
        "Redemption", "redemption", "Cancellation", "cancellation", "Return of Capital",
        "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
      ]);
      return (data || [])
        .filter((t: any) => t.status !== "corrected")
        .reduce((sum: number, t: any) => {
          const n = Number(t.num_shares) || 0;
          if (ISSUE.has(t.transaction_type)) return sum + n;
          if (REDUCE.has(t.transaction_type)) return sum - n;
          return sum;
        }, 0);
    },
  });
  const hasIssuedUnits = issuedUnits > 0;

  // S-corp election controls which template is generated and how versions are saved.
  const isScorpElected = !!company?.s_election_date;
  const OA_DOC_TYPES = [
    "Sole Member Operating Agreement",
    "Operating Agreement (S-Corp Election)",
  ] as const;

  const { data: versionHistory = [] } = useQuery({
    queryKey: ["doc-versions", companyId, "OperatingAgreement-combined"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_registry")
        .select("*")
        .eq("company_id", companyId)
        .in("document_type", OA_DOC_TYPES as unknown as string[])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Populate form from company + member data
  useEffect(() => {
    setFormCompanyName(company.name || "");
    setFormFilingDate(company.filing_date || "");
    setFormBusinessPurpose(company.business_purpose || "");
    setFormFiscalYearEnd(company.fiscal_year_end || "December");
    setFormRAName(company.registered_agent_name || "");
    setFormRAAddress(company.registered_agent_address || "");
    setFormRACity(company.registered_agent_city || "");
    setFormRAState(company.registered_agent_state || "");
    setFormRAZip(company.registered_agent_zip || "");
    setFormAddress(company.address || "");
    setFormCity(company.city || "");
    setFormState(company.state || "");
    setFormZip(company.zip || "");
    // Only re-initialize when switching to a different company, not on every
    // refetch of the same company (which would clobber in-progress edits like
    // the Filing/Effective Date the user is currently typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    const nextCompanyId = company?.id ?? null;
    const nextServerFilingDate = company?.filing_date || "";
    const switchedCompany = lastServerCompanyIdRef.current !== nextCompanyId;
    const localStillMatchesLastServerValue = formFilingDate === lastServerFilingDateRef.current;

    if (switchedCompany || localStillMatchesLastServerValue) {
      setFormFilingDate(nextServerFilingDate);
    }

    lastServerCompanyIdRef.current = nextCompanyId;
    lastServerFilingDateRef.current = nextServerFilingDate;
  }, [company?.id, company?.filing_date, formFilingDate]);

  useEffect(() => {
    if (members.length > 0) {
      setFormMemberName(members[0].name || "");
    }
  }, [members]);

  const getMergedCompany = () => ({
    ...company,
    name: formCompanyName,
    filing_date: formFilingDate,
    business_purpose: formBusinessPurpose,
    fiscal_year_end: formFiscalYearEnd,
    registered_agent_name: formRAName,
    registered_agent_address: formRAAddress,
    registered_agent_city: formRACity,
    registered_agent_state: formRAState,
    registered_agent_zip: formRAZip,
    address: formAddress,
    city: formCity,
    state: formState,
    zip: formZip,
  });

  const filingDateAutoSave = useAutoSave({
    data: { filing_date: formFilingDate },
    onSave: async ({ filing_date }) => {
      const { error } = await supabase
        .from("companies")
        .update({ filing_date: filing_date || null })
        .eq("id", companyId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    enabled: !!companyId,
  });

  const [isSavingVersion, setIsSavingVersion] = useState(false);

  // Marks every prior OA row (non-superseded) as superseded because a new S-corp
  // version is being saved. Runs immediately before insert so failures abort cleanly.
  const supersedePriorOARows = async () => {
    const { error } = await supabase
      .from("document_registry")
      .update({
        status: "superseded",
        superseded_reason: "Superseded — S-corp election",
        superseded_at: new Date().toISOString(),
      } as any)
      .eq("company_id", companyId)
      .in("document_type", OA_DOC_TYPES as unknown as string[])
      .neq("status", "superseded");
    if (error) throw error;
  };

  const saveVersion = async (doc: any, isAi: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const blob = doc.output("blob");
      const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      const versionNum = versionHistory.length + 1;
      const suffix = isScorpElected ? "SCorp_Operating_Agreement" : "SM_Operating_Agreement";
      const fileName = `${userId}/${safeName}_${suffix}_v${versionNum}_${Date.now()}.pdf`;

      await supabase.storage
        .from("generated-documents")
        .upload(fileName, blob, { contentType: "application/pdf", upsert: true });

      const { data: signedData } = await supabase.storage
        .from("generated-documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      if (isScorpElected) {
        // Supersede prior OA rows first — abort if update fails so we don't create
        // a "current" S-corp row alongside a still-current standard version.
        await supersedePriorOARows();
      }

      const titlePrefix = isScorpElected
        ? "Operating Agreement (S-Corp Election)"
        : "SM Operating Agreement";
      const insertPayload: any = {
        company_id: companyId,
        title: `${titlePrefix} v${versionNum}${isAi ? " — AI Assisted" : ""} — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: isScorpElected
          ? "Operating Agreement (S-Corp Election)"
          : "Sole Member Operating Agreement",
        status: isScorpElected ? "current" : "final",
        file_name: fileName,
        file_url: signedData?.signedUrl || null,
        statute_reference: isScorpElected
          ? "IRC § 1362; IRC § 1361"
          : "Wis. Stat. Ch. 183",
      };
      if (isScorpElected) {
        insertPayload.description =
          "Regenerated to reflect S corporation tax election — includes reasonable compensation, transfer restriction, and single-class-of-stock provisions.";
      }

      const { error: insertErr } = await supabase
        .from("document_registry")
        .insert(insertPayload);
      if (insertErr) throw insertErr;

      queryClient.invalidateQueries({ queryKey: ["doc-versions", companyId, "OperatingAgreement-combined"] });
    } catch (err: any) {
      console.error("Save version error:", err);
      throw err;
    }
  };

  const handleSaveVersion = async () => {
    if (!pdfDoc) { toast.error("Generate the document first"); return; }
    setIsSavingVersion(true);
    try {
      await saveVersion(pdfDoc, isAiDraft);
      setSavedThisSession(true);
      toast.success("Version saved to history");
    } catch (err: any) {
      toast.error(err.message || "Failed to save version");
    } finally {
      setIsSavingVersion(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "doc", "docx"].includes(ext)) {
      toast.error("Only PDF, DOC, or DOCX files are supported");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be 20 MB or smaller");
      return;
    }

    setIsImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) { toast.error("Please log in first"); return; }

      const safeName = (formCompanyName || companyName).replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      const fileName = `${userId}/${safeName}_SM_Operating_Agreement_imported_${Date.now()}.${ext}`;
      const contentType =
        file.type ||
        (ext === "pdf" ? "application/pdf"
          : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/msword");

      const { error: upErr } = await supabase.storage
        .from("generated-documents")
        .upload(fileName, file, { contentType, upsert: true });
      if (upErr) throw upErr;

      const { data: signedData } = await supabase.storage
        .from("generated-documents")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      const { error: regErr } = await supabase.from("document_registry").insert({
        company_id: companyId,
        title: `SM Operating Agreement (Imported) — ${file.name} — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Sole Member Operating Agreement",
        status: "final",
        file_name: fileName,
        file_url: signedData?.signedUrl || null,
        statute_reference: "Wis. Stat. Ch. 183",
      });
      if (regErr) throw regErr;

      queryClient.invalidateQueries({ queryKey: ["doc-versions", companyId, "OperatingAgreement-combined"] });
      toast.success("Operating Agreement imported successfully");
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const mergedCompany = getMergedCompany();
      const mergedMembers = [{ name: formMemberName }];

      // Sole Member LLC: by definition the sole member owns 100% of the Company,
      // regardless of any stale ownership_percentage stored on the member row.
      const data: SMOperatingAgreementData = {
        company: mergedCompany,
        members: mergedMembers,
        issuedUnits,
        ownershipPercentage: 100,
      };
      const doc = isScorpElected
        ? generateSMScorpOperatingAgreementPDF(data)
        : generateSMOperatingAgreementPDF(data);
      setPdfDoc(doc);
      setSavedThisSession(false);
      setIsAiDraft(false);
      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(
        isScorpElected
          ? "S-Corp Sole Member Operating Agreement generated! Click 'Save Version' to snapshot."
          : "Sole Member Operating Agreement generated! Click 'Save Version' to snapshot."
      );
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
          body: JSON.stringify({
            company_id: companyId,
            management_type: "member-managed",
            ai_provider: aiProvider,
            is_single_member: true,
            form_overrides: {
              company_name: formCompanyName,
              member_name: formMemberName,
              filing_date: formFilingDate,
              business_purpose: formBusinessPurpose,
              fiscal_year_end: formFiscalYearEnd,
            },
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 429) { toast.error("Rate limit exceeded."); return; }
        if (response.status === 402) { toast.error("AI credits exhausted."); return; }
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const respData = await response.json();
      // For SM LLC, we use the standard template but mark it as AI-assisted
      // The edge function returns aiDraftSections which we'll note but the SM template is fixed
      setIsAiDraft(true);

      const mergedCompany = getMergedCompany();
      const mergedMembers = [{ name: formMemberName }];
      // Sole Member LLC: sole member always owns 100% by definition.
      const data: SMOperatingAgreementData = {
        company: mergedCompany,
        members: mergedMembers,
        issuedUnits,
        ownershipPercentage: 100,
      };
      const doc = isScorpElected
        ? generateSMScorpOperatingAgreementPDF(data)
        : generateSMOperatingAgreementPDF(data);
      setPdfDoc(doc);
      setSavedThisSession(false);
      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(
        isScorpElected
          ? "AI-assisted S-Corp Sole Member Operating Agreement generated! Click 'Save Version' to snapshot."
          : "AI-assisted Sole Member Operating Agreement generated! Click 'Save Version' to snapshot."
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setIsAiGenerating(false);
    }
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
      const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      const { savePdfReliably } = await import("@/lib/pdf-save");
      await savePdfReliably(pdfDoc, `${safeName}_SM_Operating_Agreement.pdf`);
    }
  };

  const executeDocxDownload = async () => {
    try {
      const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              text: "SOLE MEMBER OPERATING AGREEMENT",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: formCompanyName,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              children: [new TextRun({ text: `This Operating Agreement is made as of ${formFilingDate || "___"}, by ${formMemberName} as the sole member of ${formCompanyName}, LLC.`, size: 22 })],
              spacing: { after: 200 },
            }),
            new Paragraph({ text: "ARTICLE 1 — ORGANIZATION", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({
              children: [new TextRun({ text: `The Member has formed a Wisconsin LLC named ${formCompanyName}, LLC. Business purpose: ${formBusinessPurpose || "general business"}.`, size: 22 })],
              spacing: { after: 200 },
            }),
            new Paragraph({ text: "ARTICLE 2 — CAPITAL CONTRIBUTIONS", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({
              children: [new TextRun({ text: "The Member may make capital contributions as determined appropriate.", size: 22 })],
              spacing: { after: 200 },
            }),
            new Paragraph({ text: "ARTICLE 3 — BOOKS AND RECORDS", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({
              children: [new TextRun({ text: `Fiscal year ending month: ${formFiscalYearEnd || "December"}.`, size: 22 })],
              spacing: { after: 200 },
            }),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${safeName}_SM_Operating_Agreement.docx`);
      toast.success("Word document downloaded!");
    } catch (err: any) {
      toast.error("Failed to generate Word document: " + err.message);
    }
  };

  const handlePreview = () => {
    if (!pdfDoc) { toast.error("Generate a draft first"); return; }
    try {
      const arrayBuf = pdfDoc.output("arraybuffer");
      if (!arrayBuf || arrayBuf.byteLength === 0) {
        toast.error("PDF generation produced an empty document");
        return;
      }
      setPdfData(new Uint8Array(arrayBuf));
      setCurrentPage(1);
      setPreviewOpen(true);
    } catch (err: any) {
      console.error("Preview error:", err);
      toast.error("Failed to open preview: " + (err?.message || "unknown error"));
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPdfData(null);
    pdfDocRef.current = null;
    setPageCount(0);
  };

  // Load PDF document when preview data changes
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
        toast.error("Failed to load preview");
      }
    })();
    return () => { cancelled = true; };
  }, [pdfData]);

  // Render current page
  useEffect(() => {
    if (!pdfDocRef.current || !canvasRef.current || !previewContainerRef.current || pageCount === 0) return;
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const page = await pdfDocRef.current.getPage(currentPage);
        if (cancelled) return;
        const container = previewContainerRef.current!;
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

  const handlePrint = async () => {
    if (!pdfDoc) { toast.error("Generate a draft first"); return; }
    try {
      const { printPdfInIframe } = await import("@/lib/pdf-save");
      const ok = await printPdfInIframe(pdfDoc);
      if (!ok) {
        const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
        const { savePdfReliably } = await import("@/lib/pdf-save");
        await savePdfReliably(pdfDoc, `${safeName}_SM_Operating_Agreement.pdf`);
      }
    } catch (err: any) {
      console.error("Print error:", err);
      toast.error("Failed to print: " + (err?.message || "unknown error"));
    }
  };


  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">
                {isScorpElected
                  ? "Sole Member Operating Agreement (S-Corp Election)"
                  : "Sole Member Operating Agreement"}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {isAiDraft && <Badge className="bg-purple-600 text-[10px]">AI Assisted</Badge>}
              {isScorpElected && (
                <Badge className="bg-amber-600 text-[10px]">S-Corp Election</Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {isScorpElected ? "IRC § 1362 · Wis. Stat. Ch. 183" : "Wis. Stat. Ch. 183"}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review and edit the fields below, then generate. Choose standard template or AI-assisted drafting.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Company Information ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Company Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group">
                <Label className="field-label">Company Name</Label>
                <Input value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} placeholder="Company Name, LLC" className="h-8 text-sm" />
              </div>
              <div className="field-group">
                <Label className="field-label">Sole Member Name</Label>
                <Input value={formMemberName} onChange={(e) => setFormMemberName(e.target.value)} placeholder="Full legal name" className="h-8 text-sm" />
              </div>
              <div className="field-group" onBlur={filingDateAutoSave.handleBlur}>
                <Label className="field-label">Filing / Effective Date</Label>
                <DatePickerField
                  value={formFilingDate}
                  onChange={(v) => {
                    setFormFilingDate(v);
                    filingDateAutoSave.triggerSave();
                  }}
                />
                <SaveStatusIndicator
                  status={filingDateAutoSave.status}
                  lastSavedAt={filingDateAutoSave.lastSavedAt}
                  className="mt-1"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Fiscal Year End Month</Label>
                <Input value={formFiscalYearEnd} onChange={(e) => setFormFiscalYearEnd(e.target.value)} placeholder="December" className="h-8 text-sm" />
              </div>
            </div>
            <div className="field-group mt-3">
              <Label className="field-label">Business Purpose</Label>
              <Textarea value={formBusinessPurpose} onChange={(e) => setFormBusinessPurpose(e.target.value)} placeholder="Describe the purpose…" className="text-sm min-h-[60px]" />
            </div>
          </div>

          <Separator />

          {/* ── Company Address ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Principal Office Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group sm:col-span-2">
                <Label className="field-label">Address</Label>
                <DbAddressAutocomplete value={formAddress} onChange={(v) => setFormAddress(v)} onSelect={(addr) => { setFormAddress(addr.line1); setFormCity(addr.city); setFormState(addr.state); setFormZip(addr.zip); }} placeholder="Street address" className="h-8 text-sm" source="companies" />
              </div>
              <div className="field-group">
                <Label className="field-label">City</Label>
                <Input value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="City" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Input value={formState} onChange={(e) => setFormState(e.target.value)} placeholder="WI" className="h-8 text-sm" />
                </div>
                <div className="field-group">
                  <Label className="field-label">ZIP</Label>
                  <Input value={formZip} onChange={(e) => setFormZip(e.target.value)} placeholder="ZIP" className="h-8 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Registered Agent ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Registered Agent</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group sm:col-span-2">
                <Label className="field-label">Registered Agent Name</Label>
                <Input value={formRAName} onChange={(e) => setFormRAName(e.target.value)} placeholder="Registered agent name" className="h-8 text-sm" />
              </div>
              <div className="field-group sm:col-span-2">
                <Label className="field-label">Address</Label>
                <DbAddressAutocomplete value={formRAAddress} onChange={(v) => setFormRAAddress(v)} onSelect={(addr) => { setFormRAAddress(addr.line1); setFormRACity(addr.city); setFormRAState(addr.state); setFormRAZip(addr.zip); }} placeholder="Street address" className="h-8 text-sm" source="companies" />
              </div>
              <div className="field-group">
                <Label className="field-label">City</Label>
                <Input value={formRACity} onChange={(e) => setFormRACity(e.target.value)} placeholder="City" className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Input value={formRAState} onChange={(e) => setFormRAState(e.target.value)} placeholder="WI" className="h-8 text-sm" />
                </div>
                <div className="field-group">
                  <Label className="field-label">ZIP</Label>
                  <Input value={formRAZip} onChange={(e) => setFormRAZip(e.target.value)} placeholder="ZIP" className="h-8 text-sm" />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <AIProviderSelect value={aiProvider} onChange={setAiProvider} />

          {/* Status Strip */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="uppercase tracking-wider text-muted-foreground text-[10px]">Template:</span>
            {isScorpElected ? (
              <Badge className="bg-amber-600 text-[10px]">S-Corp Election</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Standard</Badge>
            )}
            <span className="mx-1 text-muted-foreground/50">·</span>
            <span className="uppercase tracking-wider text-muted-foreground text-[10px]">Draft:</span>
            {!pdfDoc && (
              <Badge variant="secondary" className="text-[10px] text-muted-foreground">No draft generated</Badge>
            )}
            {pdfDoc && !savedThisSession && (
              <Badge className="bg-amber-600 text-[10px]">Draft generated — not saved</Badge>
            )}
            {pdfDoc && savedThisSession && (
              <Badge className="bg-success text-[10px]">Saved as current version</Badge>
            )}
          </div>

          {/* Grouped Toolbar */}
          <TooltipProvider delayDuration={200}>
            <div className="flex flex-wrap items-start gap-4 rounded-md border border-border bg-muted/20 p-3">
              {/* GENERATE group */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Generate</span>
                <div className="flex flex-wrap gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={hasIssuedUnits ? -1 : 0}>
                        <Button
                          onClick={handleGenerate}
                          disabled={isGenerating || isAiGenerating || isImporting || !hasIssuedUnits}
                          variant="outline"
                          size="sm"
                        >
                          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          Generate Standard
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!hasIssuedUnits && (
                      <TooltipContent>Record an initial contribution before generating an operating agreement.</TooltipContent>
                    )}
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={hasIssuedUnits ? -1 : 0}>
                        <Button
                          onClick={handleAiGenerate}
                          disabled={isGenerating || isAiGenerating || isImporting || !hasIssuedUnits}
                          variant="outline"
                          size="sm"
                        >
                          {isAiGenerating ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting with AI…</>
                          ) : (
                            <><Sparkles className="h-3.5 w-3.5" /> AI-Assisted Draft</>
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {!hasIssuedUnits && (
                      <TooltipContent>Record an initial contribution before generating an operating agreement.</TooltipContent>
                    )}
                  </Tooltip>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => importInputRef.current?.click()}
                    disabled={isGenerating || isAiGenerating || isImporting}
                  >
                    {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {isImporting ? "Importing…" : "Import Existing"}
                  </Button>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden md:block h-16 self-center" />

              {/* EXPORT & SAVE group */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Export & Save</span>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: "pdf", icon: <Download className="h-3.5 w-3.5" />, label: "Download PDF", onClick: () => initiateDownload("pdf") },
                    { key: "docx", icon: <FileDown className="h-3.5 w-3.5" />, label: "Download Word", onClick: () => initiateDownload("docx") },
                    { key: "prev", icon: <Eye className="h-3.5 w-3.5" />, label: "Preview", onClick: handlePreview },
                    { key: "print", icon: <Printer className="h-3.5 w-3.5" />, label: "Print", onClick: handlePrint },
                  ] as const).map((b) => {
                    const btn = (
                      <Button
                        key={b.key}
                        variant="outline"
                        size="sm"
                        onClick={b.onClick}
                        disabled={!pdfDoc}
                      >
                        {b.icon} {b.label}
                      </Button>
                    );
                    if (pdfDoc) return btn;
                    return (
                      <Tooltip key={b.key}>
                        <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
                        <TooltipContent>Generate a draft first</TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <Button variant="default" size="sm" onClick={handleSaveVersion} disabled={!pdfDoc || isSavingVersion}>
                    {isSavingVersion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Version
                  </Button>
                </div>
              </div>
            </div>
          </TooltipProvider>

          {/* Version History — persistent panel directly below toolbar */}
          <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
            <DocumentVersionHistory
              companyId={companyId}
              documentType={["Sole Member Operating Agreement", "Operating Agreement (S-Corp Election)"]}
              defaultOpen={versionHistory.length > 1}
            />
          </div>


        </CardContent>
      </Card>

      {/* Inline preview removed — the editor's iframe blocks nested blob: iframes
          ("This content is blocked"). Use the Preview button in the toolbar to
          open the PDF in a new tab. */}


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
            <p><strong>IMPORTANT NOTICE:</strong> This document is generated by EntityIQ as a template for informational purposes only. It does not constitute legal advice.</p>
            <p>You are strongly encouraged to have this document reviewed by a qualified attorney before executing or relying on it.</p>
            <p>EntityIQ makes no warranties regarding the accuracy or suitability of this document. Use is at your own risk.</p>
            {isAiDraft && (
              <p className="text-purple-600 font-medium">This document contains AI-generated content which may require additional legal review.</p>
            )}
          </div>
          <div className="flex items-start gap-2 mt-2">
            <Checkbox id="sm-disclaimer-check" checked={disclaimerAccepted} onCheckedChange={(v) => setDisclaimerAccepted(!!v)} />
            <label htmlFor="sm-disclaimer-check" className="text-xs text-foreground cursor-pointer">
              I acknowledge this is a template, not legal advice, and I will seek appropriate legal counsel.
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
            <Button size="sm" disabled={!disclaimerAccepted} onClick={handleDisclaimerAccept}>Accept & Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog (pdf.js canvas — avoids blob-iframe blocking) */}
      <Dialog open={previewOpen} onOpenChange={(o) => (o ? setPreviewOpen(true) : handleClosePreview())}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-display text-base">Document Preview</DialogTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => initiateDownload("pdf")}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div ref={previewContainerRef} className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30 relative">
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
