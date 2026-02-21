import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FileText, Download, Eye, Loader2, Printer, Copy, Check, Share2,
} from "lucide-react";
import {
  generateSMOperatingAgreementPDF,
  type SMOperatingAgreementData,
} from "@/lib/smllc-operating-agreement-pdf";

interface Props {
  companyId: string;
  companyName: string;
  company: any;
}

export default function SMOperatingAgreementGenerator({ companyId, companyName, company }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  const { data: members = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("*").eq("company_id", companyId).order("name");
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
  }, [company]);

  useEffect(() => {
    if (members.length > 0) {
      setFormMemberName(members[0].name || "");
    }
  }, [members]);

  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      // Build a merged company object from form fields
      const mergedCompany = {
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
      };
      const mergedMembers = [{ name: formMemberName }];

      const data: SMOperatingAgreementData = { company: mergedCompany, members: mergedMembers };
      const doc = generateSMOperatingAgreementPDF(data);
      setPdfDoc(doc);
      const blob = doc.output("blob");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Sole Member Operating Agreement generated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (pdfDoc) {
      const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      pdfDoc.save(`${safeName}_SM_Operating_Agreement.pdf`);
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
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("You must be logged in to share documents.");

      const blob = pdfDoc.output("blob");
      const safeName = formCompanyName.replace(/[^a-zA-Z0-9]/g, "_") || "SMLLC";
      const fileName = `${userId}/${safeName}_SM_Operating_Agreement_${Date.now()}.pdf`;

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
        title: `Sole Member Operating Agreement — ${new Date().toLocaleDateString()}`,
        document_category: "corporate",
        document_type: "Sole Member Operating Agreement",
        status: "final",
        file_name: fileName,
        file_url: signedData.signedUrl,
        statute_reference: "Wis. Stat. Ch. 183",
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

  return (
    <div className="space-y-5 animate-fade-in">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">
                Sole Member Operating Agreement
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Wis. Stat. Ch. 183
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Review and edit the fields below, then generate the Wisconsin Single Member LLC Operating Agreement. Fields are pre-filled from the company record.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Company Information ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Company Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group">
                <Label className="field-label">Company Name</Label>
                <Input
                  value={formCompanyName}
                  onChange={(e) => setFormCompanyName(e.target.value)}
                  placeholder="Company Name, LLC"
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Sole Member Name</Label>
                <Input
                  value={formMemberName}
                  onChange={(e) => setFormMemberName(e.target.value)}
                  placeholder="Full legal name of sole member"
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Filing / Effective Date</Label>
                <Input
                  type="date"
                  value={formFilingDate}
                  onChange={(e) => setFormFilingDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Fiscal Year End Month</Label>
                <Input
                  value={formFiscalYearEnd}
                  onChange={(e) => setFormFiscalYearEnd(e.target.value)}
                  placeholder="December"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="field-group mt-3">
              <Label className="field-label">Business Purpose</Label>
              <Textarea
                value={formBusinessPurpose}
                onChange={(e) => setFormBusinessPurpose(e.target.value)}
                placeholder="Describe the purpose of the company…"
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>

          <Separator />

          {/* ── Company Address ── */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Principal Office Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="field-group sm:col-span-2">
                <Label className="field-label">Address</Label>
                <Input
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Street address"
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">City</Label>
                <Input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="City"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Input
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    placeholder="WI"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="field-group">
                  <Label className="field-label">ZIP</Label>
                  <Input
                    value={formZip}
                    onChange={(e) => setFormZip(e.target.value)}
                    placeholder="ZIP"
                    className="h-8 text-sm"
                  />
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
                <Input
                  value={formRAName}
                  onChange={(e) => setFormRAName(e.target.value)}
                  placeholder="Registered agent name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group sm:col-span-2">
                <Label className="field-label">Address</Label>
                <Input
                  value={formRAAddress}
                  onChange={(e) => setFormRAAddress(e.target.value)}
                  placeholder="Street address"
                  className="h-8 text-sm"
                />
              </div>
              <div className="field-group">
                <Label className="field-label">City</Label>
                <Input
                  value={formRACity}
                  onChange={(e) => setFormRACity(e.target.value)}
                  placeholder="City"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Input
                    value={formRAState}
                    onChange={(e) => setFormRAState(e.target.value)}
                    placeholder="WI"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="field-group">
                  <Label className="field-label">ZIP</Label>
                  <Input
                    value={formRAZip}
                    onChange={(e) => setFormRAZip(e.target.value)}
                    placeholder="ZIP"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Generate Button */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Generate Agreement
            </Button>
          </div>

          {/* Action Buttons */}
          {pdfDoc && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
              <Button variant="secondary" size="sm" onClick={handleShare}>
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
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline Preview */}
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
              title="Sole Member Operating Agreement Preview"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
