import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Download, ChevronLeft, ChevronRight, FileText, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { generateAnnualMeetingPDF, AnnualMeetingData } from "@/lib/annual-meeting-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const STEPS = [
  "Meeting Information",
  "Call to Order",
  "Professional Advisors",
  "Members & Officers",
  "Authorized Binders",
  "Financial Information",
  "Banking",
  "Tax & Accounting",
  "Loans",
  "Leases",
  "Vehicles & Equipment",
  "Employee Benefits",
  "Special Resolutions",
  "Registered Agent",
  "General Authorization",
  "Signatures",
];

interface Props {
  company: any;
  onClose?: () => void;
  onMeetingCreated?: () => void;
}

// ---- Extracted DynamicTable to prevent re-mount on every keystroke ----
function DynamicTableStable({
  field,
  columns,
  addTemplate,
  rows,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  field: string;
  columns: { key: string; label: string; wide?: boolean }[];
  addTemplate: any;
  rows: any[];
  onUpdateItem: (field: string, idx: number, key: string, value: string) => void;
  onAddItem: (field: string, template: any) => void;
  onRemoveItem: (field: string, idx: number) => void;
}) {
  const inputClass = "h-8 text-sm";
  const labelClass = "text-xs font-medium text-muted-foreground";
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddItem(field, addTemplate)}>
          <Plus className="h-3 w-3 mr-1" /> Add Row
        </Button>
      </div>
      <div className="overflow-x-auto">
        {rows.map((row: any, i: number) => (
          <div key={i} className="grid gap-2 items-end mb-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr)) 40px` }}>
            {columns.map(col => (
              <div key={col.key}>
                {i === 0 && <Label className={labelClass}>{col.label}</Label>}
                <Input className={inputClass} value={row[col.key] || ""} onChange={e => onUpdateItem(field, i, col.key, e.target.value)} placeholder={col.label} />
              </div>
            ))}
            <div className="flex items-end">
              {rows.length > 1 && (
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => onRemoveItem(field, i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

function RequiredField({ label, value }: { label: string; value: string }) {
  const missing = !value?.trim();
  return (
    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
      {label} *
      {missing && <AlertTriangle className="h-3 w-3 text-destructive" />}
    </span>
  );
}

const STORAGE_KEY_PREFIX = "annual_meeting_draft_";

export default function AnnualMeetingWizard({ company, onClose, onMeetingCreated }: Props) {
  const queryClient = useQueryClient();
  const storageKey = `${STORAGE_KEY_PREFIX}${company?.id || "unknown"}`;
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved).step || 0;
    } catch {}
    return 0;
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewPages, setPreviewPages] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [pdfDocRef, setPdfDocRef] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);

  // Fetch company data for pre-fill
  const { data: companyShareholders = [] } = useQuery({
    queryKey: ["shareholders", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("shareholders").select("*").eq("company_id", company.id).eq("status", "active").order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: companyOfficers } = useQuery({
    queryKey: ["officers", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("officers").select("*").eq("company_id", company.id).maybeSingle();
      return data;
    },
    enabled: !!company?.id,
  });

  const { data: companyDirectors = [] } = useQuery({
    queryKey: ["directors", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("directors").select("*").eq("company_id", company.id).order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: companyBanks = [] } = useQuery({
    queryKey: ["company_banks", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("company_banks").select("*").eq("company_id", company.id).order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: bankSigners = [] } = useQuery({
    queryKey: ["bank_authorized_signers", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("bank_authorized_signers").select("*").eq("company_id", company.id).order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: attorneys = [] } = useQuery({
    queryKey: ["attorneys", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("attorneys").select("*, attorney_firms(firm_name, address, city, state, zip, phone, email)").eq("company_id", company.id);
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: accountants = [] } = useQuery({
    queryKey: ["accountants", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("accountants").select("*, accountant_firms(firm_name, address, city, state, zip, phone, email)").eq("company_id", company.id);
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: companyAssets = [] } = useQuery({
    queryKey: ["company_assets_all", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("company_assets").select("*").eq("company_id", company.id).order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  const { data: companyLeases = [] } = useQuery({
    queryKey: ["company_leases", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("company_assets").select("*").eq("company_id", company.id).eq("asset_type", "Lease").order("created_at");
      return data || [];
    },
    enabled: !!company?.id,
  });

  // Fetch prior annual meeting data
  const { data: priorMeeting } = useQuery({
    queryKey: ["prior_annual_meeting", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("meetings").select("*").eq("company_id", company.id).eq("meeting_type", "Annual Meeting").order("meeting_date", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    enabled: !!company?.id,
  });

  const { data: priorBenefits = [] } = useQuery({
    queryKey: ["prior_meeting_benefits", priorMeeting?.id],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_benefits").select("*").eq("meeting_id", priorMeeting!.id).order("created_at");
      return data || [];
    },
    enabled: !!priorMeeting?.id,
  });

  const { data: priorLoans = [] } = useQuery({
    queryKey: ["prior_meeting_loans", priorMeeting?.id],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_loans").select("*").eq("meeting_id", priorMeeting!.id).order("created_at");
      return data || [];
    },
    enabled: !!priorMeeting?.id,
  });

  const { data: priorOfficers = [] } = useQuery({
    queryKey: ["prior_meeting_officers", priorMeeting?.id],
    queryFn: async () => {
      const { data } = await supabase.from("meeting_officers").select("*").eq("meeting_id", priorMeeting!.id).order("created_at");
      return data || [];
    },
    enabled: !!priorMeeting?.id,
  });

  const buildDefaultData = (): AnnualMeetingData => {
    // Build advisors from attorneys + accountants
    const advisorList: AnnualMeetingData["advisors"] = [];
    attorneys.forEach((a: any) => {
      const firm = a.attorney_firms;
      advisorList.push({
        role: "Attorney",
        nameFirm: firm ? `${a.attorney_name} / ${firm.firm_name}` : a.attorney_name,
        address: firm ? [firm.address, firm.city, firm.state, firm.zip].filter(Boolean).join(", ") : "",
        phoneEmail: [a.phone, a.email].filter(Boolean).join(" / "),
      });
    });
    accountants.forEach((a: any) => {
      const firm = a.accountant_firms;
      advisorList.push({
        role: "Accountant",
        nameFirm: firm ? `${a.accountant_name} / ${firm.firm_name}` : a.accountant_name,
        address: firm ? [firm.address, firm.city, firm.state, firm.zip].filter(Boolean).join(", ") : "",
        phoneEmail: [a.phone, a.email].filter(Boolean).join(" / "),
      });
    });
    if (advisorList.length === 0) advisorList.push({ role: "", nameFirm: "", address: "", phoneEmail: "" });

    // Build members from shareholders
    const memberList = companyShareholders.length > 0
      ? companyShareholders.filter(s => !s.is_treasury).map(s => ({
        name: s.name,
        units: s.ownership_percentage?.toString() || "",
        interestPct: s.ownership_percentage?.toString() || "",
        address: [s.address, s.city, s.state, s.zip].filter(Boolean).join(", "),
      }))
      : [{ name: "", units: "", interestPct: "", address: "" }];

    // Build officers with bonus field
    const officerList: AnnualMeetingData["officers"] = [];
    if (priorOfficers.length > 0) {
      priorOfficers.forEach((o: any) => {
        officerList.push({ name: o.name, title: o.title, salary: o.salary?.toString() || "", bonus: o.bonus?.toString() || "", status: "Re-Appointed" });
      });
    } else if (companyOfficers) {
      if (companyOfficers.president) officerList.push({ name: companyOfficers.president, title: "Managing Member", salary: "", bonus: "", status: "Re-Appointed" });
      if (companyOfficers.vice_president) officerList.push({ name: companyOfficers.vice_president, title: "Member", salary: "", bonus: "", status: "Re-Appointed" });
      if (companyOfficers.secretary) officerList.push({ name: companyOfficers.secretary, title: "Secretary", salary: "", bonus: "", status: "Re-Appointed" });
      if (companyOfficers.treasurer) officerList.push({ name: companyOfficers.treasurer, title: "Treasurer", salary: "", bonus: "", status: "Re-Appointed" });
    }
    if (officerList.length === 0) officerList.push({ name: "", title: "", salary: "", bonus: "", status: "Re-Appointed" });

    // Compensation items from officers
    const compensationList: AnnualMeetingData["compensationItems"] = officerList
      .filter(o => o.name)
      .map(o => ({ name: o.name, title: o.title, salary: o.salary, bonus: o.bonus, notes: "" }));
    if (compensationList.length === 0) compensationList.push({ name: "", title: "", salary: "", bonus: "", notes: "" });

    // Build authorized binders from company field
    const binderList: AnnualMeetingData["authorizedBinders"] = [];
    if (company?.authorized_binders) {
      company.authorized_binders.split(",").forEach((b: string) => {
        binderList.push({ name: b.trim(), title: "", scope: "Full authority", status: "Confirmed" });
      });
    }
    if (binderList.length === 0) {
      officerList.forEach(o => {
        if (o.name) binderList.push({ name: o.name, title: o.title, scope: "Full authority", status: "Confirmed" });
      });
    }
    if (binderList.length === 0) binderList.push({ name: "", title: "", scope: "Full authority", status: "Confirmed" });

    // Build bank accounts
    const bankList = companyBanks.length > 0
      ? companyBanks.map(b => {
        const signers = bankSigners.filter(s => s.bank_id === b.id);
        return {
          institution: b.bank_name,
          accountType: b.account_type || "Checking",
          signatory: signers.map(s => s.signer_name).join(", ") || "",
          title: signers.map(s => s.title || "").join(", ") || "",
        };
      })
      : [{ institution: "", accountType: "", signatory: "", title: "" }];

    // Build vehicles from assets
    const vehicleList = companyAssets
      .filter(a => a.asset_type === "Vehicle")
      .map(a => ({
        yearMakeModel: [a.year, a.make, a.model].filter(Boolean).join(" ") || a.description,
        vin: a.vin || "",
        ownedLeased: a.ownership_type || "Owned",
        primaryDriver: "",
        businessUsePct: "",
        notes: "",
      }));

    // Build equipment from assets
    const equipmentList = companyAssets
      .filter(a => a.asset_type === "Equipment")
      .map(a => ({
        description: a.description,
        manufacturer: a.manufacturer || "",
        ownedLeased: a.ownership_type || "Owned",
        value: a.value?.toString() || "",
        notes: "",
      }));

    // Build leases from company assets
    const leaseList = companyLeases.length > 0
      ? companyLeases.map(l => ({
        property: l.description,
        lessor: l.landlord_name || "",
        lessee: company?.name ? `${company.name}, LLC` : "",
        monthlyAmount: l.lease_amount?.toString() || l.monthly_payment?.toString() || "",
        term: l.lease_end_date || l.lease_term || "",
        leaseBack: "N",
      }))
      : [];

    // Build benefit plans from prior meeting
    const benefitList = priorBenefits.length > 0
      ? priorBenefits.map((b: any) => ({
        planType: b.benefit_type || b.benefit_description || "",
        provider: b.provider || "",
        eligibility: b.eligibility_comments || "",
        contribution: b.retirement_contribution?.toString() || "",
        status: "Active",
      }))
      : [{ planType: "", provider: "", eligibility: "", contribution: "", status: "Active" }];

    // Build loans from prior meeting
    const instLoans = priorLoans.filter((l: any) => l.loan_direction !== "member_to_company" && l.loan_direction !== "company_to_member").map((l: any) => ({
      lender: l.lender_name || "",
      loanType: l.loan_type || "",
      balance: l.loan_amount?.toString() || "",
      rate: l.loan_rate?.toString() || "",
      maturity: l.end_date || "",
      signatory: "",
    }));
    const memLoans = priorLoans.filter((l: any) => l.loan_direction === "member_to_company" || l.loan_direction === "company_to_member").map((l: any) => ({
      lender: l.lender_name || "",
      borrower: l.borrower_name || "",
      amount: l.loan_amount?.toString() || "",
      rate: l.loan_rate?.toString() || "",
      terms: l.repayment_terms || "",
      notes: l.notes || "",
    }));

    // Build attendees from members
    const attendeeList = memberList.filter(m => m.name).map(m => ({ name: m.name, title: "" }));
    if (attendeeList.length === 0) attendeeList.push({ name: "", title: "" });

    // Registered agent
    const raAddr = [company?.registered_agent_address, company?.registered_agent_city, company?.registered_agent_state, company?.registered_agent_zip].filter(Boolean).join(", ");

    return {
      companyName: company?.name || "",
      stateOfFormation: company?.state_of_incorporation || "Wisconsin",
      meetingDate: "",
      meetingTime: priorMeeting?.meeting_time || "10:00 AM",
      meetingLocation: priorMeeting?.meeting_location || (company?.address ? `${company.address}, ${company.city || ""}, ${company.state || ""}` : ""),
      chairperson: priorMeeting?.chairperson || "",
      secretary: priorMeeting?.mtg_secretary || "",
      taxYear: new Date().getFullYear().toString(),
      priorMeetingDate: priorMeeting?.meeting_date || "",

      attendees: attendeeList,
      advisors: advisorList,
      members: memberList,
      officers: officerList,
      authorizedBinders: binderList,

      fiscalYearEnd: company?.fiscal_year_end || "December 31",
      financialItems: [
        { item: "Total Revenue", amount: "", notes: "" },
        { item: "Cost of Goods Sold", amount: "", notes: "" },
        { item: "Gross Profit", amount: "", notes: "" },
        { item: "Total Expenses", amount: "", notes: "" },
        { item: "Net Income", amount: "", notes: "" },
      ],
      compensationItems: compensationList,
      distributions: memberList.filter(m => m.name).map(m => ({ memberName: m.name, amount: "", date: "", notes: "" })),
      retainedEarnings: "",
      retainedEarningsJustification: "",

      includeBanking: companyBanks.length > 0,
      bankAccounts: bankList,
      includeBankingChanges: false,
      bankingChanges: [{ changeType: "", institution: "", details: "" }],

      accountingMethod: company?.accounting_method || "cash",
      taxElections: [{ election: "S Corporation (Form 2553)", status: company?.s_election_date ? "Active" : "N/A", effectiveDate: company?.s_election_date || "", notes: "" }],

      institutionalLoans: instLoans.length > 0 ? instLoans : [],
      memberLoans: memLoans.length > 0 ? memLoans : [],

      leases: leaseList,
      vehicles: vehicleList,
      equipment: equipmentList,

      benefitPlans: benefitList,
      profitSharingAmount: "",

      includeSpecialResolutions: false,
      specialResolutions: [{ title: "", whereas: "", resolved: "" }],

      registeredAgentName: company?.registered_agent_name || "",
      registeredAgentAddress: raAddr,

      memberSignatures: attendeeList.filter(a => a.name).map(a => ({ name: a.name })),
    };
  };

  const [data, setData] = useState<AnnualMeetingData>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) return parsed.data;
      }
    } catch {}
    return buildDefaultData();
  });
  const [initialized, setInitialized] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? true : false;
    } catch {}
    return false;
  });

  // Check if draft exists on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setHasDraft(true);
    } catch {}
  }, []);

  // Re-initialize when company data loads (only if no draft)
  useEffect(() => {
    if (!initialized && company?.id) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setInitialized(true);
          return; // Don't overwrite draft data
        }
      } catch {}
      setData(buildDefaultData());
      setInitialized(true);
    }
  }, [companyShareholders, companyOfficers, companyBanks, priorMeeting, attorneys, accountants, companyAssets, companyLeases, priorOfficers]);

  // Auto-save to localStorage whenever data or step changes
  useEffect(() => {
    if (initialized) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ data, step }));
      } catch {}
    }
  }, [data, step, initialized, storageKey]);

  const clearDraft = () => {
    try { localStorage.removeItem(storageKey); } catch {}
    setHasDraft(false);
  };

  const handleStartOver = () => {
    clearDraft();
    setData(buildDefaultData());
    setStep(0);
    setInitialized(true);
    toast.info("Draft cleared — starting fresh.");
  };

  const update = (field: keyof AnnualMeetingData, value: any) =>
    setData(prev => ({ ...prev, [field]: value }));

  const handleUpdateItem = useCallback((field: string, idx: number, key: string, value: string) => {
    setData(prev => {
      const arr = [...(prev[field as keyof AnnualMeetingData] as any[])];
      arr[idx] = { ...arr[idx], [key]: value };
      return { ...prev, [field]: arr };
    });
  }, []);

  const handleAddItem = useCallback((field: string, template: any) => {
    setData(prev => ({
      ...prev,
      [field]: [...(prev[field as keyof AnnualMeetingData] as any[]), template],
    }));
  }, []);

  const handleRemoveItem = useCallback((field: string, idx: number) => {
    setData(prev => ({
      ...prev,
      [field]: (prev[field as keyof AnnualMeetingData] as any[]).filter((_: any, i: number) => i !== idx),
    }));
  }, []);

  // Keep legacy helpers for inline usage (special resolutions, signatures)
  const updateArrayItem = (field: keyof AnnualMeetingData, idx: number, key: string, value: string) => {
    handleUpdateItem(field, idx, key, value);
  };
  const addArrayItem = (field: keyof AnnualMeetingData, template: any) => {
    handleAddItem(field, template);
  };
  const removeArrayItem = (field: keyof AnnualMeetingData, idx: number) => {
    handleRemoveItem(field, idx);
  };

  const canGenerate = () => {
    return data.companyName && data.meetingDate && data.chairperson && data.secretary;
  };

  const [saving, setSaving] = useState(false);

  const handleSaveMeeting = async () => {
    if (!canGenerate()) {
      toast.error("Please fill in all required fields (Company Name, Meeting Date, Chairperson, Secretary).");
      return;
    }
    setSaving(true);
    try {
      const { data: newMeeting, error } = await supabase.from("meetings").insert({
        company_id: company.id,
        meeting_date: data.meetingDate,
        meeting_time: data.meetingTime || null,
        tax_year: data.taxYear ? parseInt(data.taxYear) : null,
        meeting_type: "Annual Meeting",
        meeting_location: data.meetingLocation || null,
        chairperson: data.chairperson || null,
        mtg_secretary: data.secretary || null,
        prior_mtg_date: data.priorMeetingDate || null,
        company_name_at_meeting: data.companyName || null,
      }).select("id").single();

      if (error) throw error;

      if (newMeeting) {
        // Save officers
        const officerRows = data.officers.filter(o => o.name).map(o => ({
          meeting_id: newMeeting.id,
          name: o.name,
          title: o.title,
          salary: o.salary ? parseFloat(o.salary) : null,
          bonus: o.bonus ? parseFloat(o.bonus) : null,
        }));
        if (officerRows.length > 0) await supabase.from("meeting_officers").insert(officerRows);

        // Save shareholders
        const shRows = data.members.filter(m => m.name).map(m => ({
          meeting_id: newMeeting.id,
          shareholder_name: m.name,
        }));
        if (shRows.length > 0) await supabase.from("meeting_shareholders").insert(shRows);
      }

      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["meetings", company.id] });
      toast.success("Annual Meeting saved successfully!");
      onMeetingCreated?.();
      onClose?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save meeting");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!canGenerate()) {
      toast.error("Please fill in all required fields (Company Name, Meeting Date, Chairperson, Secretary).");
      return;
    }
    const doc = generateAnnualMeetingPDF(data);
    const dateStr = data.meetingDate ? format(new Date(data.meetingDate + "T12:00:00"), "yyyy-MM-dd") : "draft";
    doc.save(`${data.companyName}_Annual_Meeting_Minutes_${dateStr}.pdf`);
    toast.success("PDF downloaded successfully!");
  };

  const handlePreview = async () => {
    if (!canGenerate()) {
      toast.error("Please fill in all required fields first.");
      return;
    }
    const doc = generateAnnualMeetingPDF(data);
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

  // Retained earnings exceeds $250k?
  const retainedExceeds250k = parseFloat(data.retainedEarnings?.replace(/[^0-9.]/g, "") || "0") > 250000;

  // Helper to render DynamicTableStable with common props
  const renderTable = (field: keyof AnnualMeetingData, columns: { key: string; label: string; wide?: boolean }[], addTemplate: any) => (
    <DynamicTableStable
      field={field}
      columns={columns}
      addTemplate={addTemplate}
      rows={data[field] as any[]}
      onUpdateItem={handleUpdateItem}
      onAddItem={handleAddItem}
      onRemoveItem={handleRemoveItem}
    />
  );

  return (
    <div className="space-y-4">
      {/* Draft notice */}
      {hasDraft && (
        <div className="flex items-center justify-between rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
          <p className="text-xs text-accent-foreground">
            📝 Your draft has been restored. All changes are auto-saved as you work.
          </p>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-destructive shrink-0 ml-2" onClick={handleStartOver}>
            Start Over
          </Button>
        </div>
      )}

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
            className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">

          {/* STEP 0: Meeting Information */}
          {step === 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Meeting Information</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <RequiredField label="Company Name" value={data.companyName} />
                  <Input className={inputClass} value={data.companyName} onChange={e => update("companyName", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <Label className={labelClass}>State of Formation</Label>
                  <Input className={inputClass} value={data.stateOfFormation} onChange={e => update("stateOfFormation", e.target.value)} />
                </div>
                <div className="col-span-4">
                  <RequiredField label="Meeting Date" value={data.meetingDate} />
                  <Input className={inputClass} type="date" value={data.meetingDate} onChange={e => update("meetingDate", e.target.value)} />
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
                  <RequiredField label="Chairperson" value={data.chairperson} />
                  <Input className={inputClass} value={data.chairperson} onChange={e => update("chairperson", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <RequiredField label="Secretary" value={data.secretary} />
                  <Input className={inputClass} value={data.secretary} onChange={e => update("secretary", e.target.value)} />
                </div>
              </div>
              <h4 className="text-xs font-semibold mt-3">Attendees</h4>
              <TemplateNote text="Add or remove attendee lines as needed. Note any members attending remotely." />
              {renderTable("attendees", [{ key: "name", label: "Name" }, { key: "title", label: "Title" }], { name: "", title: "" })}
            </div>
          )}

          {/* STEP 1: Call to Order */}
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Call to Order & Approval of Prior Meeting Minutes</h3>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Label className={labelClass}>Prior Meeting Date</Label>
                  <Input className={inputClass} type="date" value={data.priorMeetingDate} onChange={e => update("priorMeetingDate", e.target.value)} />
                  {priorMeeting?.meeting_date && (
                    <p className="text-xs text-muted-foreground mt-1">Pre-filled from last annual meeting on file</p>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground italic space-y-2">
                <p><strong className="not-italic">WHEREAS,</strong> the Annual Meeting of {data.companyName || "[Company Name]"}, LLC was duly called and noticed in accordance with the Operating Agreement;</p>
                <p><strong className="not-italic">WHEREAS,</strong> the minutes of the previous Annual Meeting held on {data.priorMeetingDate ? format(new Date(data.priorMeetingDate + "T12:00:00"), "MMMM d, yyyy") : "[Prior Meeting Date]"} have been reviewed by the members;</p>
                <p><strong className="not-italic">RESOLVED,</strong> that the meeting is hereby called to order, and the minutes of the Annual Meeting held on {data.priorMeetingDate ? format(new Date(data.priorMeetingDate + "T12:00:00"), "MMMM d, yyyy") : "[Prior Meeting Date]"} are hereby approved and adopted as a true and accurate record of that meeting.</p>
              </div>
            </div>
          )}

          {/* STEP 2: Professional Advisors */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Professional Advisors on Record</h3>
              <TemplateNote text="Confirm or update the company's professional support team annually. Include attorneys, accountants, insurance agents, and financial advisors." />
              {renderTable("advisors", [
                  { key: "role", label: "Role" },
                  { key: "nameFirm", label: "Name / Firm" },
                  { key: "address", label: "Address" },
                  { key: "phoneEmail", label: "Phone / Email" },
                ], { role: "", nameFirm: "", address: "", phoneEmail: "" })}
            </div>
          )}

          {/* STEP 3: Members & Officers */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Members, Managers & Officers</h3>
              <div>
                <h4 className="text-xs font-semibold mb-2">Current Members & Ownership</h4>
                {renderTable("members", [
                    { key: "name", label: "Name" },
                    { key: "units", label: "Membership Units" },
                    { key: "interestPct", label: "Interest %" },
                    { key: "address", label: "Address" },
                  ], { name: "", units: "", interestPct: "", address: "" })}
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2">Re-Appointment or Election of Managers / Officers</h4>
                {renderTable("officers", [
                    { key: "name", label: "Name" },
                    { key: "title", label: "Title" },
                    { key: "salary", label: "Salary" },
                    { key: "bonus", label: "Bonus" },
                    { key: "status", label: "Status" },
                  ], { name: "", title: "", salary: "", bonus: "", status: "Re-Appointed" })}
              </div>
            </div>
          )}

          {/* STEP 4: Authorized Binders */}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Authorized Binders — Confirmation or Update</h3>
              <p className="text-xs text-muted-foreground">Wis. Stat. § 183.0407</p>
              <TemplateNote text="Authorized binders are persons empowered to execute contracts and bind the company. Review and update annually." />
              {renderTable("authorizedBinders", [
                  { key: "name", label: "Name" },
                  { key: "title", label: "Title" },
                  { key: "scope", label: "Scope of Authority" },
                  { key: "status", label: "Status" },
                ], { name: "", title: "", scope: "Full authority", status: "Confirmed" })}
            </div>
          )}

          {/* STEP 5: Financial Information */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Financial Information</h3>

              <div>
                <h4 className="text-xs font-semibold mb-2">Prior Year Financial Review</h4>
                {renderTable("financialItems", [
                    { key: "item", label: "Item" },
                    { key: "amount", label: "Amount" },
                    { key: "notes", label: "Notes" },
                  ], { item: "", amount: "", notes: "" })}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Compensation & Bonuses</h4>
                <TemplateNote text="Record compensation and bonus amounts approved for each officer/manager. These should match W-2 or guaranteed payment amounts." />
                {renderTable("compensationItems", [
                    { key: "name", label: "Name" },
                    { key: "title", label: "Title" },
                    { key: "salary", label: "Salary" },
                    { key: "bonus", label: "Bonus" },
                    { key: "notes", label: "Notes" },
                  ], { name: "", title: "", salary: "", bonus: "", notes: "" })}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Distributions</h4>
                {renderTable("distributions", [
                    { key: "memberName", label: "Member Name" },
                    { key: "amount", label: "Distribution Amount" },
                    { key: "date", label: "Distribution Date" },
                    { key: "notes", label: "Notes" },
                  ], { memberName: "", amount: "", date: "", notes: "" })}
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Retained Earnings</h4>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Label className={labelClass}>Retained Earnings Balance ($)</Label>
                    <Input className={inputClass} value={data.retainedEarnings} onChange={e => update("retainedEarnings", e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                {retainedExceeds250k && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      Retained earnings exceeds $250,000 — justification required
                    </div>
                    <Textarea
                      className="text-sm min-h-[60px]"
                      value={data.retainedEarningsJustification}
                      onChange={e => update("retainedEarningsJustification", e.target.value)}
                      placeholder="Provide business justification for retaining earnings above $250,000 (e.g., planned capital expenditures, working capital needs, debt retirement)"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Banking */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={data.includeBanking} onCheckedChange={v => update("includeBanking", v)} />
                <h3 className="text-sm font-semibold">Current Banking Relationships</h3>
              </div>
              {data.includeBanking && (
                {renderTable("bankAccounts", [
                    { key: "institution", label: "Institution" },
                    { key: "accountType", label: "Account Type" },
                    { key: "signatory", label: "Auth. Signatory" },
                    { key: "title", label: "Title" },
                  ], { institution: "", accountType: "", signatory: "", title: "" })}
              )}

              <div className="flex items-center gap-3 pt-2 border-t">
                <Switch checked={data.includeBankingChanges} onCheckedChange={v => update("includeBankingChanges", v)} />
                <h4 className="text-xs font-semibold">Banking Changes</h4>
              </div>
              <TemplateNote text="Toggle on to authorize new accounts, close existing accounts, or change signatories." />
              {data.includeBankingChanges && (
                {renderTable("bankingChanges", [
                    { key: "changeType", label: "Change Type" },
                    { key: "institution", label: "Institution" },
                    { key: "details", label: "Details" },
                  ], { changeType: "", institution: "", details: "" })}
              )}
            </div>
          )}

          {/* STEP 7: Tax & Accounting */}
          {step === 7 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Tax & Accounting</h3>

              <h4 className="text-xs font-semibold">Fiscal Year Confirmation</h4>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-6">
                  <Label className={labelClass}>Fiscal Year End</Label>
                  <Input className={inputClass} value={data.fiscalYearEnd} onChange={e => update("fiscalYearEnd", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <Label className={labelClass}>Accounting Method</Label>
                  <Select value={data.accountingMethod} onValueChange={v => update("accountingMethod", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Basis</SelectItem>
                      <SelectItem value="accrual">Accrual Basis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <h4 className="text-xs font-semibold mt-2">Tax Elections — Confirmation or Changes</h4>
              {renderTable("taxElections", [
                  { key: "election", label: "Election" },
                  { key: "status", label: "Status" },
                  { key: "effectiveDate", label: "Effective Date" },
                  { key: "notes", label: "Notes" },
                ], { election: "", status: "", effectiveDate: "", notes: "" })}
            </div>
          )}

          {/* STEP 8: Loans */}
          {step === 8 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Loans</h3>
              <div>
                <h4 className="text-xs font-semibold mb-2">Loans From Financial Institutions</h4>
                <TemplateNote text="Include all active loans or lines of credit, or authorize new ones below." />
                {renderTable("institutionalLoans", [
                    { key: "lender", label: "Lender" },
                    { key: "loanType", label: "Loan Type" },
                    { key: "balance", label: "Balance / Amount" },
                    { key: "rate", label: "Interest Rate" },
                    { key: "maturity", label: "Maturity Date" },
                    { key: "signatory", label: "Auth. Signatory" },
                  ], { lender: "", loanType: "", balance: "", rate: "", maturity: "", signatory: "" })}
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2">Member Loans</h4>
                <TemplateNote text="Document any loans between members and the company. Interest rates should reflect applicable federal rate (AFR) minimums." />
                {renderTable("memberLoans", [
                    { key: "lender", label: "Lender" },
                    { key: "borrower", label: "Borrower" },
                    { key: "amount", label: "Amount" },
                    { key: "rate", label: "Rate" },
                    { key: "terms", label: "Terms" },
                    { key: "notes", label: "Notes" },
                  ], { lender: "", borrower: "", amount: "", rate: "", terms: "", notes: "" })}
              </div>
            </div>
          )}

          {/* STEP 9: Leases */}
          {step === 9 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Leases</h3>
              <TemplateNote text="Include all property, equipment, and vehicle leases. Mark lease-back arrangements where the lessor is a member or related party." />
              <DynamicTable
                field="leases"
                columns={[
                  { key: "property", label: "Property / Asset" },
                  { key: "lessor", label: "Lessor" },
                  { key: "lessee", label: "Lessee" },
                  { key: "monthlyAmount", label: "Monthly Amount" },
                  { key: "term", label: "Term / Expiration" },
                  { key: "leaseBack", label: "Lease-Back?" },
                ]}
                addTemplate={{ property: "", lessor: "", lessee: "", monthlyAmount: "", term: "", leaseBack: "N" }}
              />
            </div>
          )}

          {/* STEP 10: Vehicles & Equipment */}
          {step === 10 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Vehicles & Equipment</h3>

              <div>
                <h4 className="text-xs font-semibold mb-2">Company Vehicles</h4>
                <DynamicTable
                  field="vehicles"
                  columns={[
                    { key: "yearMakeModel", label: "Year / Make / Model" },
                    { key: "vin", label: "VIN" },
                    { key: "ownedLeased", label: "Owned / Leased" },
                    { key: "primaryDriver", label: "Primary Driver" },
                    { key: "businessUsePct", label: "Business Use %" },
                    { key: "notes", label: "Notes" },
                  ]}
                  addTemplate={{ yearMakeModel: "", vin: "", ownedLeased: "Owned", primaryDriver: "", businessUsePct: "", notes: "" }}
                />
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Major Equipment</h4>
                <TemplateNote text="List significant equipment items owned or leased by the company." />
                <DynamicTable
                  field="equipment"
                  columns={[
                    { key: "description", label: "Description" },
                    { key: "manufacturer", label: "Manufacturer" },
                    { key: "ownedLeased", label: "Owned / Leased" },
                    { key: "value", label: "Value" },
                    { key: "notes", label: "Notes" },
                  ]}
                  addTemplate={{ description: "", manufacturer: "", ownedLeased: "Owned", value: "", notes: "" }}
                />
              </div>
            </div>
          )}

          {/* STEP 11: Employee Benefits */}
          {step === 11 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Employee Benefit Plans</h3>
              <DynamicTable
                field="benefitPlans"
                columns={[
                  { key: "planType", label: "Plan Type" },
                  { key: "provider", label: "Provider" },
                  { key: "eligibility", label: "Eligibility" },
                  { key: "contribution", label: "Company Contribution" },
                  { key: "status", label: "Status" },
                ]}
                addTemplate={{ planType: "", provider: "", eligibility: "", contribution: "", status: "Active" }}
              />
              <div>
                <h4 className="text-xs font-semibold mb-2">Profit Sharing</h4>
                <TemplateNote text="Profit sharing amounts must be approved before fiscal year end." />
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-6">
                    <Label className={labelClass}>Profit Sharing Contribution ($)</Label>
                    <Input className={inputClass} value={data.profitSharingAmount} onChange={e => update("profitSharingAmount", e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 12: Special Resolutions */}
          {step === 12 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={data.includeSpecialResolutions} onCheckedChange={v => update("includeSpecialResolutions", v)} />
                <h3 className="text-sm font-semibold">Special Resolutions</h3>
              </div>
              <TemplateNote text="Additional resolution types to consider: Amendment of Operating Agreement, Admission/Withdrawal of Members, Transfer of Membership Interests, Real Property Purchase/Sale, Joint Ventures, Key Legal Decisions, Bad Debt Write-Offs." />
              {data.includeSpecialResolutions && (
                <div className="space-y-4">
                  {data.specialResolutions.map((r, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2 relative">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold">Resolution {i + 1}</h4>
                        {data.specialResolutions.length > 1 && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeArrayItem("specialResolutions", i)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className={labelClass}>Title</Label>
                        <Input className={inputClass} value={r.title} onChange={e => updateArrayItem("specialResolutions", i, "title", e.target.value)} placeholder="Resolution Title" />
                      </div>
                      <div>
                        <Label className={labelClass}>WHEREAS clause (optional)</Label>
                        <Textarea className="text-sm min-h-[60px]" value={r.whereas} onChange={e => updateArrayItem("specialResolutions", i, "whereas", e.target.value)} placeholder="Enter whereas clause or leave blank" />
                      </div>
                      <div>
                        <Label className={labelClass}>RESOLVED clause</Label>
                        <Textarea className="text-sm min-h-[60px]" value={r.resolved} onChange={e => updateArrayItem("specialResolutions", i, "resolved", e.target.value)} placeholder="Enter resolved clause" />
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addArrayItem("specialResolutions", { title: "", whereas: "", resolved: "" })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Resolution
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 13: Registered Agent */}
          {step === 13 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Registered Agent Confirmation</h3>
              <p className="text-xs text-muted-foreground">Wis. Stat. § 183.0113</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12">
                  <Label className={labelClass}>Registered Agent Name</Label>
                  <Input className={inputClass} value={data.registeredAgentName} onChange={e => update("registeredAgentName", e.target.value)} />
                </div>
                <div className="col-span-12">
                  <Label className={labelClass}>Registered Agent Address</Label>
                  <Input className={inputClass} value={data.registeredAgentAddress} onChange={e => update("registeredAgentAddress", e.target.value)} />
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/50 text-xs text-muted-foreground italic">
                <p><strong className="not-italic">RESOLVED,</strong> that {data.registeredAgentName || "[Name]"}, located at {data.registeredAgentAddress || "[Address]"}, is hereby confirmed as the registered agent of the limited liability company in the State of Wisconsin, pursuant to Wis. Stat. § 183.0113.</p>
              </div>
            </div>
          )}

          {/* STEP 14: General Authorization */}
          {step === 14 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">General Authorization</h3>
              <div className="p-3 rounded-md bg-muted/50 text-sm text-muted-foreground italic">
                <p className="font-medium text-foreground not-italic mb-2">This section is auto-populated — no input required.</p>
                <p>"RESOLVED, that the authorized binders of the limited liability company are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions."</p>
              </div>
            </div>
          )}

          {/* STEP 15: Signatures */}
          {step === 15 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Signature Lines</h3>
              <p className="text-xs text-muted-foreground">Chairperson ({data.chairperson || "—"}) and Secretary ({data.secretary || "—"}) signature lines are included automatically.</p>
              <div className="flex items-center justify-between mt-3">
                <Label className={labelClass}>Additional Member Signatures</Label>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => addArrayItem("memberSignatures", { name: "" })}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              {data.memberSignatures.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <div className="col-span-10">
                    <Input className={inputClass} value={s.name} onChange={e => updateArrayItem("memberSignatures", i, "name", e.target.value)} placeholder={`Member ${i + 1} Name`} />
                  </div>
                  <div className="col-span-2">
                    {data.memberSignatures.length > 1 && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeArrayItem("memberSignatures", i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <TemplateNote text="Add additional signature lines below for each member if required by your Operating Agreement." />
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
          <Button variant="outline" size="sm" onClick={handleSaveMeeting} disabled={!canGenerate() || saving}>
            {saving ? "Saving..." : "Save Meeting"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handlePreview}>
                <FileText className="h-4 w-4 mr-1" /> Preview
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={!canGenerate()}>
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
