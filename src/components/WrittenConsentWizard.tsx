import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  AlertTriangle,
  User,
  Loader2,
  Check,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { isLLCType, getTerminology } from "@/lib/entity-terminology";
import { useShareCalculations } from "@/hooks/useShareCalculations";
import {
  RESOLUTION_TYPES,
  ACTION_CATEGORIES,
  filterByCategory,
  getResolutionCategory,
  type ActionCategory,
  type ResolutionType,
} from "@/lib/resolution-types";
import { format } from "date-fns";
import { generatePromissoryNotePDF } from "@/lib/promissory-note-pdf";
import { exportMeetingMinutesPDF } from "@/lib/meeting-pdf-export";
import { savePdfReliably } from "@/lib/pdf-save";
import * as pdfjsLib from "pdfjs-dist";
import { Download, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const STEPS = ["Entity", "Action", "Resolution", "Signers", "Review"];

interface Props {
  company: any;
  existingMeetingId?: string;
  onClose?: () => void;
  onConsentCreated?: () => void;
}

export default function WrittenConsentWizard({ company, existingMeetingId, onClose, onConsentCreated }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const t = getTerminology(company.entity_type);
  const isSMLLC = company.entity_type === "Single Member LLC";
  const isLLC = isLLCType(company.entity_type);
  const isCorp = company.entity_type === "Corporation" || company.entity_type === "S-Corp";

  // Share/unit calculations for populating member holdings
  const { shareholderHoldings, totalIssuedShares } = useShareCalculations(company.id);

  const [step, setStep] = useState(0);
  const [draftMeetingId, setDraftMeetingId] = useState<string | null>(existingMeetingId || null);
  const [loadingExisting, setLoadingExisting] = useState(!!existingMeetingId);

  // Step 1: Entity
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [taxYear, setTaxYear] = useState("");
  const [managementType, setManagementType] = useState(company.management_type || "Member Managed");

  // Step 2: Action
  const [actionCategory, setActionCategory] = useState<ActionCategory | "">("");
  const [selectedAction, setSelectedAction] = useState("");
  const [consentType, setConsentType] = useState<"Unanimous" | "Majority">(
    isCorp ? "Unanimous" : "Unanimous"
  );
  const [ownershipThreshold, setOwnershipThreshold] = useState("100");

  // Step 3: Resolution
  const [resolutionText, setResolutionText] = useState("");

  // Promissory Note wizard state
  const LOAN_RESOLUTION_LABELS = [
    "Approve Loan from Related Party",
    "Approve Loan to Related Party",
    "Approve Related Party Loan Agreement",
  ];
  const isLoanResolution = LOAN_RESOLUTION_LABELS.includes(selectedAction);

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({
    lenderName: "", borrowerName: "", loanAmount: "", interestRate: "",
    loanDuration: "", startDate: "", endDate: "", repaymentTerms: "",
  });
  const [noteStep, setNoteStep] = useState<"edit" | "preview">("edit");
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(null);
  const [consentPreviewPages, setConsentPreviewPages] = useState<string[]>([]);
  const [consentPreviewLoading, setConsentPreviewLoading] = useState(false);
  const [savingConsentPdf, setSavingConsentPdf] = useState(false);

  const updateNoteField = (key: string, value: string) =>
    setNoteForm((prev) => ({ ...prev, [key]: value }));

  const buildConsentFilename = useCallback(() => {
    const base = `${company.name}-written-consent-${effectiveDate || format(new Date(), "yyyy-MM-dd")}`;
    return `${base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.pdf`;
  }, [company.name, effectiveDate]);



  const renderNotePreview = async () => {
    setPreviewLoading(true);
    try {
      const doc = generatePromissoryNotePDF({
        lenderName: noteForm.lenderName,
        borrowerName: noteForm.borrowerName,
        loanAmount: noteForm.loanAmount ? parseFloat(noteForm.loanAmount) : null,
        interestRate: noteForm.interestRate ? parseFloat(noteForm.interestRate) : null,
        loanDuration: noteForm.loanDuration,
        startDate: noteForm.startDate,
        endDate: noteForm.endDate,
        repaymentTerms: noteForm.repaymentTerms,
        companyName: company.name || "",
      });
      const bytes = doc.output("arraybuffer");
      setCurrentPdfBytes(new Uint8Array(bytes));
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }
      setPreviewPages(pages);
      setNoteStep("preview");
    } catch {
      toast.error("Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const [savingNotePdf, setSavingNotePdf] = useState(false);

  const handleSaveNotePdf = async () => {
    if (!currentPdfBytes) return;
    const filename = `promissory-note-${noteForm.borrowerName || "loan"}.pdf`.replace(/\s+/g, "-").toLowerCase();
    const blob = new Blob([currentPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });

    // Upload to storage if user is authenticated
    if (user?.id) {
      setSavingNotePdf(true);
      try {
        const filePath = `${user.id}/promissory-notes/${company.id}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("generated-documents")
          .upload(filePath, blob, { upsert: true, contentType: "application/pdf" });
        if (uploadError) throw uploadError;
      } catch (err: any) {
        toast.error(err.message || "Failed to upload promissory note");
        setSavingNotePdf(false);
        return;
      }
      setSavingNotePdf(false);
    }

    // Local download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setNoteDialogOpen(false);
    toast.success("Promissory note saved!");
  };

  // Step 4: Signers (auto-populated)
  // No additional state needed — computed from queries

  // Queries for signers
  const { data: directors = [] } = useQuery({
    queryKey: ["directors", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("*")
        .eq("company_id", company.id);
      if (error) throw error;
      return data;
    },
    enabled: !!company.id,
  });

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders-for-consent", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select("*")
        .eq("company_id", company.id)
        .eq("status", "active")
        .eq("is_treasury", false);
      if (error) throw error;
      return data;
    },
    enabled: !!company.id,
  });

  // Get resolution options for this entity type
  const resolutionOptions = RESOLUTION_TYPES[company.entity_type] || RESOLUTION_TYPES["Corporation"];

  // Filtered actions by category
  const filteredActions = useMemo(() => {
    if (!actionCategory) return [];
    return filterByCategory(resolutionOptions, actionCategory);
  }, [actionCategory, resolutionOptions]);

  // Selected resolution template
  const selectedResolution = useMemo(() => {
    return resolutionOptions.find((r) => r.label === selectedAction);
  }, [selectedAction, resolutionOptions]);

  // Compute signers based on entity type
  const signers = useMemo(() => {
    if (isCorp) {
      return directors.map((d) => ({
        name: d.name,
        role: t.director,
        id: d.id,
      }));
    }
    if (isLLC) {
      if (isSMLLC) {
        return shareholders.slice(0, 1).map((s) => ({
          name: s.name,
          role: "Sole Member",
          id: s.id,
        }));
      }
      if (managementType === "Manager Managed") {
        // For manager-managed, use directors (authorized binders)
        return directors.map((d) => ({
          name: d.name,
          role: "Manager",
          id: d.id,
        }));
      }
      // Member managed — all members
      return shareholders.map((s) => ({
        name: s.name,
        role: "Member",
        id: s.id,
        ownershipPct: s.ownership_percentage,
      }));
    }
    return [];
  }, [isCorp, isLLC, isSMLLC, managementType, directors, shareholders, t]);

  // Voting statute
  const votingStatute = useMemo(() => {
    if (isCorp) return "Wis. Stat. § 180.0704";
    if (isLLC) return "Wis. Stat. § 183.0404";
    return "";
  }, [isCorp, isLLC]);

  // Validation warnings
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (consentType === "Unanimous" && ownershipThreshold !== "100" && !isSMLLC) {
      w.push("Unanimous consent requires 100% ownership threshold.");
    }
    if (!resolutionText.trim() && step >= 2) {
      w.push("Resolution text is required.");
    }
    if (signers.length === 0 && step >= 3) {
      w.push(`No ${isCorp ? "directors" : "members"} found. Please add them to the company record first.`);
    }
    
    return w;
  }, [consentType, ownershipThreshold, resolutionText, signers, step, isCorp, isSMLLC, effectiveDate]);

  // Can advance to next step
  const canAdvance = useMemo(() => {
    if (step === 0) return !!effectiveDate;
    if (step === 1) return !!actionCategory && !!selectedAction;
    if (step === 2) return !!resolutionText.trim();
    if (step === 3) return signers.length > 0;
    return true;
  }, [step, effectiveDate, actionCategory, selectedAction, resolutionText, signers]);

  // Handle action selection — auto-fill resolution template
  const handleActionSelect = (action: string) => {
    setSelectedAction(action);
    const match = resolutionOptions.find((r) => r.label === action);
    if (match?.template) {
      setResolutionText(match.template);
    } else {
      setResolutionText("");
    }
  };

  // ---------- DRAFT SAVE LOGIC ----------
  const buildMeetingPayload = useCallback(() => ({
    company_id: company.id,
    meeting_date: effectiveDate,
    meeting_type: "Written Consent" as const,
    sub_type: selectedAction || null,
    tax_year: taxYear ? parseInt(taxYear) : null,
    purpose: selectedAction ? `Written Consent — ${selectedAction}` : "Written Consent",
    document_status: "draft",
    company_name_at_meeting: company.name,
    company_address_at_meeting: company.address || null,
    company_city_at_meeting: company.city || null,
    company_state_at_meeting: company.state || null,
    company_zip_at_meeting: company.zip || null,
  }), [company, effectiveDate, selectedAction, taxYear]);

  const saveDraft = useCallback(async (): Promise<string> => {
    const payload = buildMeetingPayload();

    let meetingId = draftMeetingId;

    if (!meetingId) {
      // INSERT new draft
      const { data, error } = await supabase
        .from("meetings")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      meetingId = data.id;
      setDraftMeetingId(meetingId);
    } else {
      // UPDATE existing
      const { error } = await supabase
        .from("meetings")
        .update(payload)
        .eq("id", meetingId);
      if (error) throw error;
    }

    // Save resolution (delete + re-insert)
    const { error: deleteResolutionError } = await supabase
      .from("meeting_resolutions")
      .delete()
      .eq("meeting_id", meetingId);
    if (deleteResolutionError) throw deleteResolutionError;

    if (resolutionText.trim()) {
      const { error: insertResolutionError } = await supabase.from("meeting_resolutions").insert({
        meeting_id: meetingId,
        purpose: selectedAction || "Written Consent",
        resolution_text: resolutionText,
      });
      if (insertResolutionError) throw insertResolutionError;
    }

    // Save signers (delete + re-insert)
    if (isCorp) {
      const { error: deleteDirectorError } = await supabase
        .from("meeting_directors")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteDirectorError) throw deleteDirectorError;

      const directorRows = signers.map((s) => ({
        meeting_id: meetingId!,
        director_name: s.name,
      }));
      if (directorRows.length > 0) {
        const { error: insertDirectorError } = await supabase.from("meeting_directors").insert(directorRows);
        if (insertDirectorError) throw insertDirectorError;
      }
    } else {
      const { error: deleteShareholderError } = await supabase
        .from("meeting_shareholders")
        .delete()
        .eq("meeting_id", meetingId);
      if (deleteShareholderError) throw deleteShareholderError;

      const memberRows = signers.map((s) => {
        const sh = shareholders.find((sh) => sh.id === s.id);
        const holdings = sh ? (shareholderHoldings[sh.id] ?? 0) : 0;
        const ownershipPct = totalIssuedShares > 0 && sh
          ? Number(((holdings / totalIssuedShares) * 100).toFixed(2))
          : (sh?.ownership_percentage ?? 0);
        return {
          meeting_id: meetingId!,
          shareholder_name: s.name,
          address: sh?.address || null,
          city: sh?.city || null,
          state: sh?.state || null,
          zip: sh?.zip || null,
          common_shares: holdings,
          preferred_shares: ownershipPct,
        };
      });
      if (memberRows.length > 0) {
        const { error: insertShareholderError } = await supabase.from("meeting_shareholders").insert(memberRows);
        if (insertShareholderError) throw insertShareholderError;
      }
    }

    const metadata = JSON.stringify({
      managementType,
      actionCategory,
      consentType,
      ownershipThreshold,
    });

    const { error: deleteMetadataError } = await supabase
      .from("meeting_other")
      .delete()
      .eq("meeting_id", meetingId);
    if (deleteMetadataError) throw deleteMetadataError;

    const { error: insertMetadataError } = await supabase.from("meeting_other").insert({
      meeting_id: meetingId,
      notes: metadata,
    });
    if (insertMetadataError) throw insertMetadataError;

    return meetingId;
  }, [
    actionCategory,
    buildMeetingPayload,
    consentType,
    draftMeetingId,
    isCorp,
    managementType,
    ownershipThreshold,
    resolutionText,
    selectedAction,
    shareholders,
    shareholderHoldings,
    signers,
    totalIssuedShares,
  ]);

  // ---------- LOAD EXISTING DATA ----------
  useEffect(() => {
    if (!existingMeetingId) return;

    const loadExisting = async () => {
      setLoadingExisting(true);
      try {
        // Load meeting
        const { data: meeting, error: meetingErr } = await supabase
          .from("meetings")
          .select("*")
          .eq("id", existingMeetingId)
          .single();
        if (meetingErr || !meeting) throw meetingErr || new Error("Meeting not found");

        setEffectiveDate(meeting.meeting_date || format(new Date(), "yyyy-MM-dd"));
        setTaxYear(meeting.tax_year ? String(meeting.tax_year) : "");

        // Derive action category from sub_type
        if (meeting.sub_type) {
          setSelectedAction(meeting.sub_type);
          // Find the category for this action
          const cat = getResolutionCategory(meeting.sub_type);
          if (cat) {
            setActionCategory(cat);
          }
        }

        // Load resolution
        const { data: resolutions } = await supabase
          .from("meeting_resolutions")
          .select("*")
          .eq("meeting_id", existingMeetingId)
          .limit(1);
        if (resolutions && resolutions.length > 0) {
          setResolutionText(resolutions[0].resolution_text || "");
          if (!meeting.sub_type && resolutions[0].purpose) {
            setSelectedAction(resolutions[0].purpose);
          }
        }

        const { data: metadataRows } = await supabase
          .from("meeting_other")
          .select("notes")
          .eq("meeting_id", existingMeetingId)
          .limit(1);

        const rawMetadata = metadataRows?.[0]?.notes;
        if (rawMetadata) {
          try {
            const parsed = JSON.parse(rawMetadata);
            if (parsed.managementType) setManagementType(parsed.managementType);
            if (parsed.actionCategory) setActionCategory(parsed.actionCategory);
            if (parsed.consentType) setConsentType(parsed.consentType);
            if (parsed.ownershipThreshold) setOwnershipThreshold(parsed.ownershipThreshold);
          } catch {
            // Ignore legacy non-JSON notes rows
          }
        }
      } catch (err: any) {
        toast.error("Failed to load consent data");
        console.error(err);
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExisting();
  }, [existingMeetingId]);

  // Step advance with auto-save
  const handleNext = async () => {
    try {
      await saveDraft();
    } catch (err: any) {
      console.error("Draft save failed:", err);
      toast.error(err.message || "Could not save your written consent draft.");
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handlePreviewConsentPdf = async () => {
    setConsentPreviewLoading(true);
    try {
      const meetingId = await saveDraft();
      const { bytes } = buildConsentPdf(meetingId);
      const pages = await renderPdfPages(bytes);
      setConsentPreviewPages(pages);
    } catch (err: any) {
      console.error("Consent PDF preview failed:", err);
      toast.error(err.message || "Failed to generate written consent preview.");
    } finally {
      setConsentPreviewLoading(false);
    }
  };

  const handleSaveConsentPdf = async () => {
    if (!user?.id) {
      toast.error("You must be signed in to save this PDF.");
      return;
    }

    setSavingConsentPdf(true);
    try {
      const meetingId = await saveDraft();
      const { doc } = buildConsentPdf(meetingId);
      const filename = buildConsentFilename();
      const filePath = `${user.id}/written-consent/${meetingId}/${filename}`;
      const blob = doc.output("blob");

      const { error: uploadError } = await supabase.storage
        .from("generated-documents")
        .upload(filePath, blob, { upsert: true, contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("generated-documents")
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;
      if (!publicUrl) throw new Error("Unable to build a public file URL.");

      const documentMarker = `written-consent:${meetingId}`;
      const { data: existingDocument, error: lookupError } = await supabase
        .from("company_documents")
        .select("id")
        .eq("company_id", company.id)
        .eq("notes", documentMarker)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existingDocument?.id) {
        const { error: updateDocumentError } = await supabase
          .from("company_documents")
          .update({
            file_name: filename,
            file_path: publicUrl,
            file_size: blob.size,
            file_type: "application/pdf",
            category: "Meeting Minutes & Resolutions",
          })
          .eq("id", existingDocument.id);
        if (updateDocumentError) throw updateDocumentError;
      } else {
        const { error: insertDocumentError } = await supabase.from("company_documents").insert({
          company_id: company.id,
          user_id: user.id,
          file_name: filename,
          file_path: publicUrl,
          file_size: blob.size,
          file_type: "application/pdf",
          category: "Meeting Minutes & Resolutions",
          notes: documentMarker,
        });
        if (insertDocumentError) throw insertDocumentError;
      }

      queryClient.invalidateQueries({ queryKey: ["company_documents", company.id] });
      queryClient.invalidateQueries({ queryKey: ["meetings", company.id] });

      await savePdfReliably(doc, filename);
      toast.success("Written consent PDF saved.");
    } catch (err: any) {
      console.error("Consent PDF save failed:", err);
      toast.error(err.message || "Failed to save written consent PDF.");
    } finally {
      setSavingConsentPdf(false);
    }
  };

  // Create consent mutation (final save)
  const createConsent = useMutation({
    mutationFn: async () => {
      const meetingId = await saveDraft();
      const { error } = await supabase
        .from("meetings")
        .update({ document_status: "final" })
        .eq("id", meetingId);
      if (error) throw error;
      return { id: meetingId };
    },
    onSuccess: (meeting) => {
      queryClient.invalidateQueries({ queryKey: ["meetings", company.id] });
      toast.success(existingMeetingId ? "Written consent updated!" : "Written consent created!");
      onConsentCreated?.();
      if (!onConsentCreated) {
        onClose?.();
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const progressPct = ((step + 1) / STEPS.length) * 100;

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading consent data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
        <div className="flex justify-between">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`text-[10px] ${
                i <= step ? "text-primary font-medium" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && step >= 1 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <Alert key={i} variant="destructive" className="py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{w}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* === STEP 1: Entity === */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
              <div className="flex items-center gap-2">
                <Input value={company.name} disabled className="bg-muted/50" />
                <Badge variant="secondary" className="text-[10px] shrink-0">Auto-filled</Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Entity Type</Label>
              <div className="flex items-center gap-2">
                <Input value={company.entity_type} disabled className="bg-muted/50" />
                <Badge variant="secondary" className="text-[10px] shrink-0">Auto-filled</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">State</Label>
              <div className="flex items-center gap-2">
                <Input value={company.state_of_incorporation || company.state || "WI"} disabled className="bg-muted/50" />
                <Badge variant="secondary" className="text-[10px] shrink-0">Auto-filled</Badge>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tax Year *</Label>
              <Input
                type="number"
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                placeholder="e.g. 2025"
              />
            </div>
          </div>

          {isLLC && !isSMLLC && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Management Structure</Label>
              <Select value={managementType} onValueChange={setManagementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Member Managed">Member Managed</SelectItem>
                  <SelectItem value="Manager Managed">Manager Managed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Effective Date *</Label>
              <DatePickerField
                value={effectiveDate}
                onChange={setEffectiveDate}
                placeholder="Pick effective date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date Drafted</Label>
              <div className="flex items-center gap-2">
                <Input value={format(new Date(), "MM/dd/yyyy")} disabled className="bg-muted/50" />
                <Badge variant="secondary" className="text-[10px] shrink-0">Today</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Address</Label>
            <Input
              value={[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ")}
              disabled
              className="bg-muted/50"
            />
          </div>
        </div>
      )}

      {/* === STEP 2: Action === */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Action Category *</Label>
            <Select
              value={actionCategory}
              onValueChange={(v) => {
                setActionCategory(v as ActionCategory);
                setSelectedAction("");
                setResolutionText("");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {ACTION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {actionCategory && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Specific Action *</Label>
              <Select value={selectedAction} onValueChange={handleActionSelect}>
                <SelectTrigger><SelectValue placeholder="Select an action" /></SelectTrigger>
                <SelectContent>
                  {filteredActions.map((a) => (
                    <SelectItem key={a.label} value={a.label}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedResolution?.statute && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  📜 {selectedResolution.statute}
                </p>
              )}
            </div>
          )}

          {!isSMLLC && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-primary" />
                <Label className="text-xs font-medium">Voting Threshold</Label>
              </div>

              {isCorp && (
                <Alert className="py-2 border-primary/20 bg-primary/5">
                  <AlertDescription className="text-xs">
                    <strong>Unanimous consent required</strong> — {votingStatute} requires all directors to consent in writing for action without a meeting.
                  </AlertDescription>
                </Alert>
              )}

              {isLLC && !isSMLLC && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Consent Type</Label>
                    <Select
                      value={consentType}
                      onValueChange={(v) => {
                        setConsentType(v as "Unanimous" | "Majority");
                        if (v === "Unanimous") setOwnershipThreshold("100");
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unanimous">Unanimous</SelectItem>
                        <SelectItem value="Majority">Majority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Ownership % Required</Label>
                    <Input
                      type="number"
                      value={ownershipThreshold}
                      onChange={(e) => setOwnershipThreshold(e.target.value)}
                      disabled={consentType === "Unanimous"}
                      min="1"
                      max="100"
                    />
                  </div>
                </div>
              )}

              {votingStatute && !isCorp && (
                <p className="text-[10px] text-muted-foreground">
                  📜 {votingStatute}
                </p>
              )}
            </div>
          )}

          {isSMLLC && (
            <Alert className="py-2 border-primary/20 bg-primary/5">
              <AlertDescription className="text-xs">
                As a Single Member LLC, this consent is valid by the sole member's signature. No voting threshold applies.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* === STEP 3: Resolution === */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">{selectedAction || "Custom Resolution"}</h4>
              {selectedResolution?.statute && (
                <p className="text-[10px] text-muted-foreground">📜 {selectedResolution.statute}</p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px]">{company.entity_type}</Badge>
          </div>

          {!resolutionText.trim() && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                Fill in the resolution text below. Replace all blank fields (______) with the required information.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Resolution Text *</Label>
            <Textarea
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
              placeholder="Enter or modify the resolution text..."
            />
          </div>

          {resolutionText.includes("______") && (
            <Alert className="py-2 border-warning/20 bg-warning/5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <AlertDescription className="text-xs text-warning-foreground">
                This resolution contains blank fields (______) that should be filled in before creating the consent.
              </AlertDescription>
            </Alert>
          )}

          {/* Promissory Note button for loan resolutions */}
          {isLoanResolution && (
            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Auto-save draft before opening promissory note dialog
                  try {
                    await saveDraft();
                  } catch (err: any) {
                    console.error("Draft save before promissory note failed:", err);
                  }
                  setNoteForm({
                    lenderName: "", borrowerName: "", loanAmount: "", interestRate: "",
                    loanDuration: "", startDate: effectiveDate, endDate: "", repaymentTerms: "",
                  });
                  setNoteStep("edit");
                  setPreviewPages([]);
                  setCurrentPdfBytes(null);
                  setNoteDialogOpen(true);
                }}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" />
                Create Promissory Note
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Generate a pre-filled promissory note to accompany this resolution.
              </p>
            </div>
          )}
        </div>
      )}

      {/* === STEP 4: Signers === */}
      {step === 3 && (
        <div className="space-y-4">
          <Alert className="py-2 border-primary/20 bg-primary/5">
            <Info className="h-3.5 w-3.5" />
            <AlertDescription className="text-xs">
              {isCorp
                ? "All directors are listed as signers for this written consent. Under Wis. Stat. § 180.0704, unanimous written consent of all directors is required."
                : isSMLLC
                ? "As the sole member, your signature constitutes valid consent."
                : managementType === "Manager Managed"
                ? "All managers are listed as signers for this consent."
                : "All members are listed as signers for this consent."
              }
            </AlertDescription>
          </Alert>

          {signers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <User className="mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">No {isCorp ? "directors" : "members"} found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add {isCorp ? "directors" : "members"} to the company record before creating a consent.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {signers.map((s, i) => (
                <Card key={s.id || i} className="border">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.role}</p>
                    </div>
                    {"ownershipPct" in s && s.ownershipPct != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {Number(s.ownershipPct).toFixed(1)}%
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Pending
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === STEP 5: Review === */}
      {step === 4 && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold">Review Written Consent</h4>

          <div className="space-y-3">
            <Card>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Company</span>
                  <span className="text-sm font-medium">{company.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Entity Type</span>
                  <span className="text-sm">{company.entity_type}</span>
                </div>
                {isLLC && !isSMLLC && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Management</span>
                    <span className="text-sm">{managementType}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Effective Date</span>
                  <span className="text-sm">
                    {effectiveDate ? new Date(effectiveDate + "T00:00:00").toLocaleDateString() : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Category</span>
                  <Badge variant="outline" className="text-[10px]">{actionCategory}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Action</span>
                  <span className="text-sm font-medium">{selectedAction}</span>
                </div>
                {selectedResolution?.statute && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Statute</span>
                    <span className="text-[10px]">{selectedResolution.statute}</span>
                  </div>
                )}
                {!isSMLLC && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Consent Type</span>
                    <span className="text-sm">{isCorp ? "Unanimous" : consentType}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-md p-3 max-h-32 overflow-y-auto">
                  {resolutionText}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground mb-2">
                  Signers ({signers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {signers.map((s, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {s.name} — {s.role}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreviewConsentPdf}
                disabled={consentPreviewLoading || savingConsentPdf || signers.length === 0}
              >
                {consentPreviewLoading ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-3.5 w-3.5" />
                )}
                Preview PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveConsentPdf}
                disabled={savingConsentPdf || consentPreviewLoading || signers.length === 0}
              >
                {savingConsentPdf ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-2 h-3.5 w-3.5" />
                )}
                Save as PDF
              </Button>
            </div>

            {consentPreviewPages.length > 0 && (
              <Card>
                <CardContent className="py-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Written Consent PDF Preview</p>
                  {consentPreviewPages.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={src}
                      alt={`Written consent preview page ${index + 1}`}
                      className="w-full rounded border border-border shadow-sm"
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => (step === 0 ? onClose?.() : setStep(step - 1))}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            size="sm"
            onClick={handleNext}
            disabled={!canAdvance}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => createConsent.mutate()}
            disabled={createConsent.isPending || !canAdvance || signers.length === 0}
          >
            {createConsent.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-1" />
            )}
            {existingMeetingId ? "Update Consent" : "Create Consent"}
          </Button>
        )}
      </div>

      {/* Promissory Note Wizard Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => { if (!open) { setNoteDialogOpen(false); setNoteStep("edit"); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {noteStep === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Create Promissory Note
                </DialogTitle>
                <DialogDescription>Review and edit the details below, then click Preview to see the formatted document.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Lender Name</Label>
                  <Input value={noteForm.lenderName} onChange={(e) => updateNoteField("lenderName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Borrower Name</Label>
                  <Input value={noteForm.borrowerName} onChange={(e) => updateNoteField("borrowerName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Principal Amount ($)</Label>
                  <Input type="number" step="0.01" value={noteForm.loanAmount} onChange={(e) => updateNoteField("loanAmount", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Interest Rate (%)</Label>
                  <Input type="number" step="0.01" value={noteForm.interestRate} onChange={(e) => updateNoteField("interestRate", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Loan Duration</Label>
                  <Input value={noteForm.loanDuration} onChange={(e) => updateNoteField("loanDuration", e.target.value)} placeholder="e.g., 5 years" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <DatePickerField value={noteForm.startDate} onChange={(v) => updateNoteField("startDate", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <DatePickerField value={noteForm.endDate} onChange={(v) => updateNoteField("endDate", v)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Repayment Terms</Label>
                  <Textarea value={noteForm.repaymentTerms} onChange={(e) => updateNoteField("repaymentTerms", e.target.value)} rows={3} placeholder="Monthly payments, balloon payment, etc." />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button onClick={renderNotePreview} disabled={previewLoading}>
                  {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Preview
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Promissory Note Preview</DialogTitle>
                <DialogDescription>Review the document below. You can go back to edit or save as PDF.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {previewPages.map((src, i) => (
                  <img key={i} src={src} alt={`Page ${i + 1}`} className="w-full rounded border border-border shadow-sm" />
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" onClick={() => setNoteStep("edit")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back / Edit
                </Button>
                <Button onClick={handleSaveNotePdf} disabled={savingNotePdf}>
                  {savingNotePdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {savingNotePdf ? "Saving…" : "Save as PDF"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
