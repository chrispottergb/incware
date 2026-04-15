import { useState } from "react";
import DbAddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Download, ChevronLeft, ChevronRight, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { generateOrgMeetingPDF, OrgMeetingData } from "@/lib/org-meeting-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const STEPS = [
  "Meeting Info",
  "Formation & Organization",
  "Registered Agent",
  "Principal Office",
  "EIN Authorization",
  "Managers / Officers",
  "Initial Members",
  "Business Purpose",
  "Operating Agreement",
  "Fiscal Year & Accounting",
  "Authorized Binders",
  "S-Corp Election",
  "Banking Resolutions",
  "General Authorization",
  "Signatures",
];

interface Props {
  company: any;
  onClose?: () => void;
}

function TemplateNote({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-help">
            <Info className="h-3 w-3" />
            <span className="underline decoration-dotted">Template Note</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function OrgMeetingWizard({ company, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewPages, setPreviewPages] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [pdfDocRef, setPdfDocRef] = useState<any>(null);

  const [data, setData] = useState<OrgMeetingData>({
    companyName: company?.name || "",
    stateOfFormation: company?.state_of_incorporation || "Wisconsin",
    meetingDate: "",
    meetingTime: "10:00 AM",
    meetingLocation: company?.address
      ? `${company.address}${company.address_2 ? `, ${company.address_2}` : ""}, ${company.city || ""}, ${company.state || ""} ${company.zip || ""}`
      : "",
    chairperson: "",
    secretary: "",
    taxYear: "",
    filingDate: company?.filing_date || company?.incorporation_date || "",
    stateAgency: "WI Department of Financial Institutions",
    registeredAgentName: company?.registered_agent_name || "",
    registeredAgentAddress: company?.registered_agent_address
      ? `${company.registered_agent_address}${company.registered_agent_address_2 ? `, ${company.registered_agent_address_2}` : ""}, ${company.registered_agent_city || ""}, ${company.registered_agent_state || ""} ${company.registered_agent_zip || ""}`
      : "",
    principalOfficeAddress: company?.address
      ? `${company.address}${company.address_2 ? `, ${company.address_2}` : ""}, ${company.city || ""}, ${company.state || ""} ${company.zip || ""}`
      : "",
    einAuthorizedName: "",
    einAuthorizedTitle: "",
    managers: [{ name: "", title: "Managing Member" }],
    members: [{ name: "", membershipUnits: "", membershipInterestPct: "" }],
    businessPurpose: company?.business_purpose || "",
    operatingAgreementAdopted: true,
    fiscalYearEnd: company?.fiscal_year_end || "December 31",
    firstFiscalYearEnd: `December 31, ${new Date().getFullYear()}`,
    accountingMethod: company?.accounting_method || "cash",
    authorizedBinders: [{ name: "", title: "", scopeOfAuthority: "Full authority" }],
    includeScorp: !!company?.s_election_date,
    scorpEffectiveDate: company?.s_election_date || "",
    includeBanking: false,
    bankName: "",
    bankCity: "",
    bankSignatories: [{ name: "", title: "" }],
    memberSignatures: [{ name: "" }],
  });

  const update = (field: keyof OrgMeetingData, value: any) =>
    setData(prev => ({ ...prev, [field]: value }));

  const updateManager = (idx: number, field: string, value: string) => {
    const updated = [...data.managers];
    (updated[idx] as any)[field] = value;
    update("managers", updated);
  };

  const updateMember = (idx: number, field: string, value: string) => {
    const updated = [...data.members];
    (updated[idx] as any)[field] = value;
    update("members", updated);
  };

  const updateBinder = (idx: number, field: string, value: string) => {
    const updated = [...data.authorizedBinders];
    (updated[idx] as any)[field] = value;
    update("authorizedBinders", updated);
  };

  const updateSignatory = (idx: number, field: string, value: string) => {
    const updated = [...data.bankSignatories];
    (updated[idx] as any)[field] = value;
    update("bankSignatories", updated);
  };

  const updateMemberSig = (idx: number, value: string) => {
    const updated = [...data.memberSignatures];
    updated[idx] = { name: value };
    update("memberSignatures", updated);
  };

  const canGenerate = () => {
    return data.companyName && data.meetingDate && data.chairperson && data.secretary;
  };

  const handleDownload = async () => {
    if (!canGenerate()) {
      toast.error("Please fill in all required fields (Company Name, Meeting Date, Chairperson, Secretary).");
      return;
    }
    const doc = generateOrgMeetingPDF(data);
    const dateStr = data.meetingDate ? format(new Date(data.meetingDate + "T12:00:00"), "yyyy-MM-dd") : "draft";
    const { savePdfReliably } = await import("@/lib/pdf-save");
    await savePdfReliably(doc, `${data.companyName}_Org_Meeting_Minutes_${dateStr}.pdf`);
    toast.success("PDF downloaded successfully!");
  };

  const handlePreview = async () => {
    if (!canGenerate()) {
      toast.error("Please fill in all required fields first.");
      return;
    }
    const doc = generateOrgMeetingPDF(data);
    const arrayBuffer = doc.output("arraybuffer");
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdfDocRef(pdfDoc);
    setPreviewPages(pdfDoc.numPages);
    setPreviewPage(1);
    setPreviewOpen(true);
  };

  const renderPreviewPage = async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (!pdfDocRef || !canvas) return;
    const page = await pdfDocRef.getPage(pageNum);
    const containerWidth = 680;
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width * 2;
    canvas.height = viewport.height * 2;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    ctx.scale(2, 2);
    await page.render({ canvasContext: ctx, viewport }).promise;
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const inputClass = "h-8 text-sm";
  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {STEPS.length}</span>
          <span className="font-medium">{STEPS[step]}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          {/* STEP 0: Meeting Info */}
          {step === 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Meeting Information</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Label className={labelClass}>Company Name *</Label>
                  <Input className={inputClass} value={data.companyName} onChange={e => update("companyName", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>State of Formation</Label>
                  <Input className={inputClass} value={data.stateOfFormation} onChange={e => update("stateOfFormation", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>Meeting Date *</Label>
                  <DatePickerField value={data.meetingDate} onChange={v => update("meetingDate", v)} className={inputClass} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>Meeting Time</Label>
                  <Input className={inputClass} value={data.meetingTime} onChange={e => update("meetingTime", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>Tax Year</Label>
                  <Input className={inputClass} value={data.taxYear} onChange={e => update("taxYear", e.target.value)} />
                </div>
                <div className="col-span-12">
                  <Label className={labelClass}>Meeting Location</Label>
                  <Input className={inputClass} value={data.meetingLocation} onChange={e => update("meetingLocation", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <Label className={labelClass}>Chairperson *</Label>
                  <Input className={inputClass} value={data.chairperson} onChange={e => update("chairperson", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <Label className={labelClass}>Secretary *</Label>
                  <Input className={inputClass} value={data.secretary} onChange={e => update("secretary", e.target.value)} />
                </div>
              </div>
              <TemplateNote text="Add or remove member lines as needed for the attendance list." />
            </div>
          )}

          {/* STEP 1: Formation & Organization */}
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Formation & Organization</h3>
              <p className="text-xs text-muted-foreground italic">This section ratifies the filing of the Articles of Organization.</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Label className={labelClass}>Filing Date of Articles of Organization</Label>
                  <DatePickerField value={data.filingDate} onChange={v => update("filingDate", v)} className={inputClass} />
                </div>
                <div className="col-span-6">
                  <Label className={labelClass}>State Agency Name</Label>
                  <Input className={inputClass} value={data.stateAgency} onChange={e => update("stateAgency", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Registered Agent */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Registered Agent</h3>
              <p className="text-xs text-muted-foreground">Wis. Stat. § 183.0113</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12">
                  <Label className={labelClass}>Registered Agent Name</Label>
                  <Input className={inputClass} value={data.registeredAgentName} onChange={e => update("registeredAgentName", e.target.value)} />
                </div>
                <div className="col-span-12">
                  <Label className={labelClass}>Registered Agent Address (Full)</Label>
                  <DbAddressAutocomplete className={inputClass} value={data.registeredAgentAddress} onChange={(v) => update("registeredAgentAddress", v)} onSelect={(addr) => { update("registeredAgentAddress", addr.line1); }} source="companies" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Principal Office */}
          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Principal Office</h3>
              <div className="col-span-12">
                <Label className={labelClass}>Principal Office Address</Label>
                <DbAddressAutocomplete className={inputClass} value={data.principalOfficeAddress} onChange={(v) => update("principalOfficeAddress", v)} onSelect={(addr) => { update("principalOfficeAddress", addr.line1); }} source="companies" />
              </div>
            </div>
          )}

          {/* STEP 4: EIN Authorization */}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">EIN Authorization</h3>
              <p className="text-xs text-muted-foreground italic">Authorize a person to apply for the Employer Identification Number (EIN).</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Label className={labelClass}>Authorized Person Name</Label>
                  <Input className={inputClass} value={data.einAuthorizedName} onChange={e => update("einAuthorizedName", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <Label className={labelClass}>Title</Label>
                  <Input className={inputClass} value={data.einAuthorizedTitle} onChange={e => update("einAuthorizedTitle", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Initial Managers / Officers */}
          {step === 5 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Initial Managers / Officers</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update("managers", [...data.managers, { name: "", title: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {data.managers.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-1">
                  <div className="col-span-5">
                    {i === 0 && <Label className={labelClass}>Name</Label>}
                    <Input className={inputClass} value={m.name} onChange={e => updateManager(i, "name", e.target.value)} placeholder="Name" />
                  </div>
                  <div className="col-span-5">
                    {i === 0 && <Label className={labelClass}>Title</Label>}
                    <Input className={inputClass} value={m.title} onChange={e => updateManager(i, "title", e.target.value)} placeholder="Title" />
                  </div>
                  <div className="col-span-2 flex items-end">
                    {data.managers.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => update("managers", data.managers.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 6: Initial Members */}
          {step === 6 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Initial Members</h3>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update("members", [...data.members, { name: "", membershipUnits: "", membershipInterestPct: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {data.members.map((m: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    {i === 0 && <Label className={labelClass}>Name</Label>}
                    <Input className={inputClass} value={m.name} onChange={e => updateMember(i, "name", e.target.value)} placeholder="Member name" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className={labelClass}>Membership Units</Label>}
                    <Input className={inputClass} value={m.membershipUnits} onChange={e => updateMember(i, "membershipUnits", e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className={labelClass}>Interest %</Label>}
                    <Input className={inputClass} value={m.membershipInterestPct} onChange={e => updateMember(i, "membershipInterestPct", e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-span-1 flex items-end">
                    {data.members.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => update("members", data.members.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <TemplateNote text="Add or remove member lines as needed." />
            </div>
          )}

          {/* STEP 7: Business Purpose */}
          {step === 7 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Business Purpose</h3>
              <Textarea className="text-sm min-h-[80px]" value={data.businessPurpose} onChange={e => update("businessPurpose", e.target.value)} placeholder="Describe the business purpose of the LLC..." />
            </div>
          )}

          {/* STEP 8: Operating Agreement */}
          {step === 8 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Operating Agreement</h3>
              <p className="text-xs text-muted-foreground">Wis. Stat. § 183.0105</p>
              <div className="flex items-center gap-3">
                <Switch checked={data.operatingAgreementAdopted} onCheckedChange={v => update("operatingAgreementAdopted", v)} />
                <span className="text-sm">{data.operatingAgreementAdopted ? "Adopted at this meeting" : "Not adopted — will be adopted at a future date"}</span>
              </div>
            </div>
          )}

          {/* STEP 9: Fiscal Year & Accounting */}
          {step === 9 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Fiscal Year & Accounting</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <Label className={labelClass}>Fiscal Year End</Label>
                  <Input className={inputClass} value={data.fiscalYearEnd} onChange={e => update("fiscalYearEnd", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>First Fiscal Year End</Label>
                  <Input className={inputClass} value={data.firstFiscalYearEnd} onChange={e => update("firstFiscalYearEnd", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>Accounting Method</Label>
                  <Select value={data.accountingMethod} onValueChange={v => update("accountingMethod", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Basis</SelectItem>
                      <SelectItem value="accrual">Accrual Basis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TemplateNote text="Note the first fiscal year explicitly — new entities may have a short initial year if formed mid-year." />
            </div>
          )}

          {/* STEP 10: Designation of Authorized Binders */}
          {step === 10 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold">Designation of Authorized Binders</h3>
                  <p className="text-xs text-muted-foreground">Wis. Stat. § 183.0407</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update("authorizedBinders", [...data.authorizedBinders, { name: "", title: "", scopeOfAuthority: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {data.authorizedBinders.map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-1">
                  <div className="col-span-4">
                    {i === 0 && <Label className={labelClass}>Name</Label>}
                    <Input className={inputClass} value={b.name} onChange={e => updateBinder(i, "name", e.target.value)} placeholder="Name" />
                  </div>
                  <div className="col-span-3">
                    {i === 0 && <Label className={labelClass}>Title</Label>}
                    <Input className={inputClass} value={b.title} onChange={e => updateBinder(i, "title", e.target.value)} placeholder="Title" />
                  </div>
                  <div className="col-span-4">
                    {i === 0 && <Label className={labelClass}>Scope of Authority</Label>}
                    <Input className={inputClass} value={b.scopeOfAuthority} onChange={e => updateBinder(i, "scopeOfAuthority", e.target.value)} placeholder="Full authority" />
                  </div>
                  <div className="col-span-1 flex items-end">
                    {data.authorizedBinders.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => update("authorizedBinders", data.authorizedBinders.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <TemplateNote text="Scope of Authority examples: 'Full authority', 'Banking and financial documents only', 'Government filings only', or 'All documents up to $[amount]'. Tailor to your LLC's needs." />
            </div>
          )}

          {/* STEP 11: S Corporation Election (optional) */}
          {step === 11 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={data.includeScorp} onCheckedChange={v => update("includeScorp", v)} />
                <h3 className="text-sm font-semibold">S Corporation Election (IRC § 1362)</h3>
              </div>
              <TemplateNote text="Include this section only if the LLC elects S-Corp tax treatment. Remove if not applicable." />
              {data.includeScorp && (
                <div className="pl-6 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Label className={labelClass}>Effective Date</Label>
                      <DatePickerField value={data.scorpEffectiveDate} onChange={v => update("scorpEffectiveDate", v)} className={inputClass} />
                    </div>
                  </div>
                  <p className="text-xs text-destructive font-medium italic">⚠ IRS Form 2553 must be filed within 75 days of the effective date.</p>
                </div>
              )}
            </div>
          )}

          {/* STEP 12: Banking Resolutions (optional) */}
          {step === 12 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={data.includeBanking} onCheckedChange={v => update("includeBanking", v)} />
                <h3 className="text-sm font-semibold">Banking Resolutions</h3>
              </div>
              <TemplateNote text="Include this section if a specific financial institution has been selected. Remove or update as needed." />
              {data.includeBanking && (
                <div className="pl-6 space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <Label className={labelClass}>Bank / Credit Union Name</Label>
                      <Input className={inputClass} value={data.bankName} onChange={e => update("bankName", e.target.value)} />
                    </div>
                    <div className="col-span-6">
                      <Label className={labelClass}>City, State</Label>
                      <Input className={inputClass} value={data.bankCity} onChange={e => update("bankCity", e.target.value)} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <Label className={labelClass}>Authorized Signers</Label>
                    <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => update("bankSignatories", [...data.bankSignatories, { name: "", title: "" }])}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {data.bankSignatories.map((s, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2">
                      <div className="col-span-5">
                        <Input className={inputClass} value={s.name} onChange={e => updateSignatory(i, "name", e.target.value)} placeholder="Name" />
                      </div>
                      <div className="col-span-5">
                        <Input className={inputClass} value={s.title} onChange={e => updateSignatory(i, "title", e.target.value)} placeholder="Title" />
                      </div>
                      <div className="col-span-2">
                        {data.bankSignatories.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => update("bankSignatories", data.bankSignatories.filter((_, j) => j !== i))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 13: General Authorization (auto-populated) */}
          {step === 13 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">General Authorization</h3>
              <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground italic">
                <p className="font-medium text-foreground not-italic mb-2">This section is auto-populated — no input required.</p>
                <p>"RESOLVED, that the authorized binders designated herein are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions."</p>
              </div>
            </div>
          )}

          {/* STEP 14: Signatures */}
          {step === 14 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Signature Lines</h3>
              <p className="text-xs text-muted-foreground">Chairperson ({data.chairperson || "—"}) and Secretary ({data.secretary || "—"}) signature lines are included automatically.</p>

              <div className="flex items-center justify-between mt-3">
                <Label className={labelClass}>Additional Member Signatures</Label>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => update("memberSignatures", [...data.memberSignatures, { name: "" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {data.memberSignatures.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-10">
                    <Input className={inputClass} value={s.name} onChange={e => updateMemberSig(i, e.target.value)} placeholder={`Member ${i + 1} Name`} />
                  </div>
                  <div className="col-span-2">
                    {data.memberSignatures.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => update("memberSignatures", data.memberSignatures.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <TemplateNote text="Add additional signature lines below for each member if required by your state or operating agreement." />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <FileText className="h-4 w-4 mr-1" /> Preview
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={!canGenerate()}>
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[780px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Document Preview</span>
              <div className="flex items-center gap-2 text-sm font-normal">
                <Button variant="outline" size="sm" disabled={previewPage <= 1} onClick={async () => {
                  const p = previewPage - 1;
                  setPreviewPage(p);
                  if (previewCanvas) await renderPreviewPage(p, previewCanvas);
                }}>Prev</Button>
                <span>Page {previewPage} of {previewPages}</span>
                <Button variant="outline" size="sm" disabled={previewPage >= previewPages} onClick={async () => {
                  const p = previewPage + 1;
                  setPreviewPage(p);
                  if (previewCanvas) await renderPreviewPage(p, previewCanvas);
                }}>Next</Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <canvas
              ref={async (el) => {
                if (el && el !== previewCanvas) {
                  setPreviewCanvas(el);
                  await renderPreviewPage(previewPage, el);
                }
              }}
              className="border rounded shadow-sm"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
