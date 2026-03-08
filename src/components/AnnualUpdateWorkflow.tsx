import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, Mail, AlertCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadAnnualUpdatePdf, generateAnnualUpdatePdf, type AnnualUpdateData } from "@/lib/annual-update-pdf";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url,
).toString();

interface AnnualUpdateWorkflowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: any[];
}

export default function AnnualUpdateWorkflow({ open, onOpenChange, companies }: AnnualUpdateWorkflowProps) {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [step, setStep] = useState<"select" | "generating" | "ready">("select");
  const [updateData, setUpdateData] = useState<AnnualUpdateData | null>(null);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const handleReset = () => {
    setSelectedCompanyId("");
    setStep("select");
    setUpdateData(null);
    setPreviewPages([]);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(handleReset, 300);
  };

  const handleGenerate = async () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company.");
      return;
    }

    setStep("generating");

    try {
      // Fetch all company data in parallel
      const [
        companyRes,
        officersRes,
        directorsRes,
        shareholdersRes,
        attorneyFirmsRes,
        attorneysRes,
        accountantFirmsRes,
        accountantsRes,
        banksRes,
      ] = await Promise.all([
        supabase.from("companies").select("*").eq("id", selectedCompanyId).single(),
        supabase.from("officers").select("*").eq("company_id", selectedCompanyId).maybeSingle(),
        supabase.from("directors").select("*").eq("company_id", selectedCompanyId).order("name"),
        supabase.from("shareholders").select("*").eq("company_id", selectedCompanyId).order("name"),
        supabase.from("attorney_firms").select("*").eq("company_id", selectedCompanyId),
        supabase.from("attorneys").select("*").eq("company_id", selectedCompanyId),
        supabase.from("accountant_firms").select("*").eq("company_id", selectedCompanyId),
        supabase.from("accountants").select("*").eq("company_id", selectedCompanyId),
        supabase.from("company_banks").select("*").eq("company_id", selectedCompanyId),
      ]);

      if (companyRes.error) throw companyRes.error;

      const company = companyRes.data;
      const data: AnnualUpdateData = {
        company,
        officers: officersRes.data,
        directors: directorsRes.data || [],
        shareholders: shareholdersRes.data || [],
        attorneyFirms: attorneyFirmsRes.data || [],
        attorneys: attorneysRes.data || [],
        accountantFirms: accountantFirmsRes.data || [],
        accountants: accountantsRes.data || [],
        banks: banksRes.data || [],
        registeredAgent: {
          name: company.registered_agent_name,
          address: [company.registered_agent_address, company.registered_agent_address_2].filter(Boolean).join(", "),
          city: company.registered_agent_city,
          state: company.registered_agent_state,
          zip: company.registered_agent_zip,
        },
      };

      setUpdateData(data);
      setStep("ready");

      // Generate preview images from PDF
      try {
        const doc = generateAnnualUpdatePdf(data);
        const pdfBytes = doc.output("arraybuffer");
        const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d")!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          pages.push(canvas.toDataURL("image/png"));
        }
        setPreviewPages(pages);
      } catch (err) {
        console.error("Preview render error:", err);
      }
    } catch (err: any) {
      console.error("Annual update error:", err);
      toast.error("Failed to load company data.");
      setStep("select");
    }
  };

  const handleDownloadPdf = () => {
    if (!updateData) return;
    downloadAnnualUpdatePdf(updateData);
    toast.success("PDF downloaded.");
  };

  const handleSendEmail = () => {
    if (!updateData) return;

    const company = updateData.company;
    const email = company.contact_email;

    if (!email) {
      toast.error("No contact email on file for this company. Please add one in the Company Details first.");
      return;
    }

    // Determine salutation: salutation_name → first word of contact_full_name → first word of company name
    const salutation = company.salutation_name
      || (company.contact_full_name ? company.contact_full_name.split(" ")[0] : null)
      || company.name.split(" ")[0]
      || "Client";

    const subject = encodeURIComponent(`Your Annual Update Review — ${company.name}`);
    const body = encodeURIComponent(
      `Dear ${salutation},\n\n` +
      `Please find attached your Annual Update Review for ${company.name}. ` +
      `This document summarizes all current information we have on file for your entity.\n\n` +
      `Please review each section carefully and let us know if any changes or corrections are needed.\n\n` +
      `We appreciate your prompt attention to this matter.\n\n` +
      `Best regards,\n` +
      `[Your Name]\n` +
      `[Your Firm]`
    );

    // Download the PDF first so the user has it
    downloadAnnualUpdatePdf(updateData);

    // Open mailto
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

    toast.success("PDF downloaded. Your email client should open — please attach the PDF manually.");
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={step === "ready" ? "sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="font-display">Annual Update</DialogTitle>
          <DialogDescription>
            Generate a review document and email it to your client.
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Company</label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCompany && !selectedCompany.contact_email && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No contact email on file for this company. You can still generate the PDF, but email composition will be unavailable.</span>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!selectedCompanyId}
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              Generate Annual Update Review
            </Button>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading company data...</p>
          </div>
        )}

        {step === "ready" && updateData && (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
              ✅ Annual Update Review generated for <strong>{updateData.company.name}</strong>.
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={handleDownloadPdf} variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>

              <Button
                onClick={handleSendEmail}
                className="w-full"
                disabled={!updateData.company.contact_email}
              >
                <Mail className="mr-2 h-4 w-4" />
                Download PDF & Compose Email
              </Button>

              {!updateData.company.contact_email && (
                <p className="text-xs text-muted-foreground text-center">
                  Add a contact email to the company record to enable email composition.
                </p>
              )}
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
              ← Select a different company
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
