import { useState, useCallback } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Calendar, MapPin, ChevronRight, Upload, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { useNavigate } from "react-router-dom";
import TaxReturnUpload from "@/components/TaxReturnUpload";
import { isLLCType } from "@/lib/entity-terminology";
import OrgMeetingWizard from "@/components/OrgMeetingWizard";
import AnnualMeetingWizard from "@/components/AnnualMeetingWizard";
import WrittenConsentWizard from "@/components/WrittenConsentWizard";

const CORP_MEETING_TYPES = [
  "Shareholder Meeting",
  "Annual Meeting",
  "Organizational Meeting",
  "Special Meeting of Board of Directors",
  "Written Consent",
];

const LLC_MEETING_TYPES = [
  "Annual Meeting",
  "Organizational Meeting",
  "Special Meeting of Members",
  "Written Consent",
];

const SUB_TYPES: Record<string, string[]> = {
  "Shareholder Meeting": [
    "Statutory Close Corporation",
    "Election of Board of Directors",
    "Approve Officer Compensation",
    "Approve Amendments to Articles/Bylaws",
    "Approve Merger or Dissolution",
    "Other",
  ],

  "Special Meeting of Board of Directors": [
    "Approve Officer Bonuses",
    "Approve Issuance, Transfer, Sale of Shares",
    "Authorize a Line of Credit",
    "Adopt Regular Meeting Resolution",
    "Approve Distributions",
    "Other",
  ],
  "Special Meeting of Members": [
    "Approve Officer Compensation",
    "Approve Amendments to Operating Agreement",
    "Approve Issuance, Transfer of Membership Interests",
    "Authorize a Line of Credit",
    "Approve Distributions",
    "Other",
  ],
};

interface Props {
  companyId: string;
  company: Tables<"companies">;
}

export default function MeetingsTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [orgWizardOpen, setOrgWizardOpen] = useState(false);
  const [annualWizardOpen, setAnnualWizardOpen] = useState(false);
  const [consentWizardOpen, setConsentWizardOpen] = useState(false);
  const [editingConsentId, setEditingConsentId] = useState<string | null>(null);

  const defaultForm = () => ({
    meeting_date: "",
    meeting_time: "10:00 AM",
    tax_year: "",
    meeting_type: "Annual Meeting",
    sub_type: "",
    meeting_location: company.address
      ? `${company.address}, ${company.city ?? ""}, ${company.state ?? ""}`
      : "",
    chairperson: "",
    mtg_secretary: "",
    others_present: "",
    prior_mtg_date: "",
    next_annual_mtg: "",
    company_name_at_meeting: company.name,
    company_address_at_meeting: company.address ?? "",
    company_city_at_meeting: company.city ?? "",
    company_state_at_meeting: company.state ?? "",
    company_zip_at_meeting: company.zip ?? "",
  });

  const [form, setForm] = useState(defaultForm());
  const [prefilled, setPrefilled] = useState(false);

  const handleMeetingZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, company_city_at_meeting: result.city, company_state_at_meeting: result.state }));
  }, []);
  const { handleZipChange: handleMeetingZipChange, isLoading: zipLoading, zipError } = useZipLookup(handleMeetingZipResult);

  const { data: meetings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["meetings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("company_id", companyId)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // When dialog opens or meeting type changes to Annual, try to prefill from last annual meeting
  const prefillFromLastAnnual = async () => {
    const { data: lastAnnual } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", companyId)
      .eq("meeting_type", "Annual Meeting")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastAnnual) {
      setForm(prev => ({
        ...prev,
        // Don't copy date — leave blank for user
        meeting_time: lastAnnual.meeting_time || prev.meeting_time,
        meeting_location: lastAnnual.meeting_location || prev.meeting_location,
        chairperson: lastAnnual.chairperson || "",
        mtg_secretary: lastAnnual.mtg_secretary || "",
        others_present: lastAnnual.others_present || "",
        prior_mtg_date: lastAnnual.meeting_date || "",
        next_annual_mtg: "",
        company_name_at_meeting: lastAnnual.company_name_at_meeting || company.name,
        company_address_at_meeting: lastAnnual.company_address_at_meeting || company.address || "",
        company_city_at_meeting: lastAnnual.company_city_at_meeting || company.city || "",
        company_state_at_meeting: lastAnnual.company_state_at_meeting || company.state || "",
        company_zip_at_meeting: lastAnnual.company_zip_at_meeting || company.zip || "",
      }));
      setPrefilled(true);
    } else {
      setPrefilled(false);
    }
  };

  // Prefill from the last Statutory Close Corporation shareholder meeting only.
  const prefillFromLastStatutoryClose = async () => {
    const { data: last } = await supabase
      .from("meetings")
      .select("*")
      .eq("company_id", companyId)
      .eq("meeting_type", "Shareholder Meeting")
      .eq("sub_type", "Statutory Close Corporation")
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (last) {
      setForm(prev => ({
        ...prev,
        meeting_time: last.meeting_time || prev.meeting_time,
        meeting_location: last.meeting_location || prev.meeting_location,
        chairperson: last.chairperson || "",
        mtg_secretary: last.mtg_secretary || "",
        others_present: last.others_present || "",
        prior_mtg_date: last.meeting_date || "",
        next_annual_mtg: "",
        company_name_at_meeting: last.company_name_at_meeting || company.name,
        company_address_at_meeting: last.company_address_at_meeting || company.address || "",
        company_city_at_meeting: last.company_city_at_meeting || company.city || "",
        company_state_at_meeting: last.company_state_at_meeting || company.state || "",
        company_zip_at_meeting: last.company_zip_at_meeting || company.zip || "",
      }));
      setPrefilled(true);
    } else {
      setPrefilled(false);
    }
  };

  const handleStartFresh = () => {
    setForm(prev => ({
      ...defaultForm(),
      meeting_type: prev.meeting_type,
      tax_year: prev.tax_year,
    }));
    setPrefilled(false);
  };

  const handleDialogOpen = (open: boolean) => {
    setDialogOpen(open);
    if (open) {
      const fresh = defaultForm();
      setForm(fresh);
      setPrefilled(false);
      // Auto-prefill for Annual Meeting
      if (fresh.meeting_type === "Annual Meeting") {
        prefillFromLastAnnual();
      }
    }
  };

  const handleMeetingTypeChange = (v: string) => {
    setForm(p => ({ ...p, meeting_type: v, sub_type: "" }));
    setPrefilled(false);
    if (v === "Annual Meeting") {
      prefillFromLastAnnual();
    }
  };

  const handleSubTypeChange = (v: string) => {
    setForm(p => ({ ...p, sub_type: v }));
    if (form.meeting_type === "Shareholder Meeting" && v === "Statutory Close Corporation") {
      prefillFromLastStatutoryClose();
    }
  };


  // Clone sub-table data from prior annual meeting (excluding vehicles/equipment)
  const cloneSubTables = async (newMeetingId: string, priorMeetingId: string) => {
    // Tables to clone and their key columns (excluding id, meeting_id, created_at)
    const cloneTasks = [
      { table: "meeting_officers", fields: ["name", "title", "salary", "bonus"] },
      { table: "meeting_directors", fields: ["director_name"] },
      { table: "meeting_shareholders", fields: ["shareholder_name", "common_shares", "preferred_shares", "distribution", "distribution_amount", "additional_capital_contribution"] },
      { table: "meeting_counsel", fields: ["counsel_name", "bank_name", "accountant_name", "attorney_name", "law_firm"] },
      { table: "meeting_authorized_signers", fields: ["signer_name", "title", "bank_name", "signer_id"] },
      { table: "meeting_benefits", fields: ["benefit_description", "benefit_type", "provider", "plan_year", "transaction_type", "agent_administrator", "insurance_agency", "eligibility_comments", "new_plan_effective_date", "retirement_contribution"] },
      { table: "meeting_loans", fields: ["loan_type", "loan_amount", "loan_rate", "loan_duration", "loan_date", "start_date", "end_date", "lender_name", "borrower_name", "loan_direction", "repayment_terms", "notes"] },
      { table: "agreements", fields: ["agreement_type", "agreement_with", "agreement_date", "agreement_purpose", "amount", "expiration_date", "status", "notes", "is_carried_forward"], filterActive: true },
      { table: "meeting_other", fields: ["notes"] },
      // Explicitly NOT cloning: meeting_vehicle_purchases, meeting_vehicle_leases, meeting_vehicle_sales, meeting_assets (equipment), meeting_lease_terminations
    ];

    for (const task of cloneTasks) {
      let query = supabase
        .from(task.table as any)
        .select("*")
        .eq("meeting_id", priorMeetingId);

      // For agreements, only carry forward Active ones
      if ((task as any).filterActive) {
        query = query.eq("status", "Active");
      }

      const { data: rows } = await query;

      if (rows && rows.length > 0) {
        const newRows = rows.map((row: any) => {
          const newRow: any = { meeting_id: newMeetingId };
          for (const field of task.fields) {
            if (row[field] !== undefined) newRow[field] = row[field];
          }
          // Mark agreements as carried forward
          if ((task as any).filterActive) {
            newRow.is_carried_forward = true;
          }
          return newRow;
        });
        await supabase.from(task.table as any).insert(newRows as any);
      }
    }

    // Clone financials: map prior current year → new previous year, leave current year blank
    const { data: priorFinancials } = await supabase
      .from("meeting_financials")
      .select("*")
      .eq("meeting_id", priorMeetingId)
      .maybeSingle();

    if (priorFinancials) {
      await supabase.from("meeting_financials").insert({
        meeting_id: newMeetingId,
        previous_total_sales: priorFinancials.current_total_sales,
        previous_cog: priorFinancials.current_cog,
        previous_gross_profit: priorFinancials.current_gross_profit,
        previous_cog_ratio: priorFinancials.current_cog_ratio,
        previous_net_income: priorFinancials.current_net_income,
        // current year fields intentionally left null for user entry
      });
    }
  };

  const createMeeting = useMutation({
    mutationFn: async () => {
      // Find most recent annual meeting for cloning (if creating Annual Meeting)
      let priorAnnualId: string | null = null;
      if (form.meeting_type === "Annual Meeting") {
        const { data: lastAnnual } = await supabase
          .from("meetings")
          .select("id")
          .eq("company_id", companyId)
          .eq("meeting_type", "Annual Meeting")
          .order("meeting_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        priorAnnualId = lastAnnual?.id || null;
      }

      const defaultProfitPlan = "The officers and/or managers reviewed the general financial and operational condition of the company. Overall, the company continues to be managed in a manner consistent with its stated business objectives. A general discussion was held regarding ongoing business performance, operational efficiency, and overall financial trends since the last meeting. The leadership also discussed opportunities to improve profitability and strengthen operations, including (optional: insert specific profit improvement initiatives, cost control measures, revenue strategies, or operational changes discussed). The company remains focused on maintaining sound financial practices, regulatory compliance, and long-term business stability while pursuing appropriate strategic improvements as discussed.";

      const { data: newMeeting, error } = await supabase.from("meetings").insert({
        company_id: companyId,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || null,
        tax_year: form.tax_year ? parseInt(form.tax_year) : null,
        meeting_type: form.meeting_type,
        sub_type: form.sub_type || null,
        meeting_location: form.meeting_location || null,
        chairperson: form.chairperson || null,
        mtg_secretary: form.mtg_secretary || null,
        others_present: form.others_present || null,
        prior_mtg_date: form.prior_mtg_date || null,
        next_annual_mtg: form.next_annual_mtg || null,
        company_name_at_meeting: form.company_name_at_meeting || null,
        company_address_at_meeting: form.company_address_at_meeting || null,
        company_city_at_meeting: form.company_city_at_meeting || null,
        company_state_at_meeting: form.company_state_at_meeting || null,
        company_zip_at_meeting: form.company_zip_at_meeting || null,
        profit_improvement_plan: form.meeting_type === "Annual Meeting" ? defaultProfitPlan : null,
      }).select("id").single();
      if (error) throw error;

      // Clone sub-tables if creating annual meeting with prior data
      if (priorAnnualId && newMeeting && prefilled) {
        await cloneSubTables(newMeeting.id, priorAnnualId);
      }

      // Auto-populate shareholders with current share data for Shareholder Meetings
      if (newMeeting && form.meeting_type === "Shareholder Meeting") {
        const { data: shareholders } = await supabase
          .from("shareholders")
          .select("id, name, is_treasury, ownership_percentage, address, city, state, zip")
          .eq("company_id", companyId);

        const { data: certificates } = await supabase
          .from("stock_certificates")
          .select("shareholder_id, num_shares, share_class, status")
          .eq("company_id", companyId)
          .eq("status", "active");

        if (shareholders && shareholders.length > 0) {
          const shRows = shareholders
            .filter(s => !s.is_treasury)
            .map(s => {
              const memberCerts = (certificates || []).filter(c => c.shareholder_id === s.id);
              const commonShares = memberCerts
                .filter(c => c.share_class === "Common")
                .reduce((sum, c) => sum + (c.num_shares || 0), 0);
              const preferredShares = memberCerts
                .filter(c => c.share_class === "Preferred")
                .reduce((sum, c) => sum + (c.num_shares || 0), 0);
              return {
                meeting_id: newMeeting.id,
                shareholder_name: s.name,
                address: s.address || null,
                city: s.city || null,
                state: s.state || null,
                zip: s.zip || null,
                common_shares: commonShares,
                preferred_shares: preferredShares,
              };
            });
          if (shRows.length > 0) {
            await supabase.from("meeting_shareholders").insert(shRows);
          }
        }
      }

      // Auto-populate directors for Board of Directors meetings (Special or Annual for corps)
      const isDirectorMeeting =
        form.meeting_type === "Special Meeting of Board of Directors" ||
        (form.meeting_type === "Annual Meeting" && !isLLCType(company.entity_type));
      if (newMeeting && isDirectorMeeting) {
        const { data: directors } = await supabase
          .from("directors")
          .select("name, added_date")
          .eq("company_id", companyId);

        if (directors && directors.length > 0) {
          const meetingDate = form.meeting_date;
          const eligible = directors.filter((d) => {
            if (d.added_date && d.added_date > meetingDate) return false;
            return true;
          });
          const dirRows = eligible.map((d) => ({
            meeting_id: newMeeting.id,
            director_name: d.name,
          }));
          if (dirRows.length > 0) {
            await supabase.from("meeting_directors").insert(dirRows);
          }
        }
      }

      // Auto-populate members for LLC Annual Meetings and Special Meeting of Members
      const isLLCMemberMeeting = isLLCType(company.entity_type) && 
        (form.meeting_type === "Annual Meeting" || form.meeting_type === "Special Meeting of Members");
      if (newMeeting && isLLCMemberMeeting) {
        const { data: members } = await supabase
          .from("shareholders")
          .select("id, name, is_treasury, status, ownership_percentage, address, city, state, zip")
          .eq("company_id", companyId);

        const { data: certs } = await supabase
          .from("stock_certificates")
          .select("shareholder_id, num_shares, share_class, status")
          .eq("company_id", companyId)
          .eq("status", "active");

        if (members && members.length > 0) {
          const eligible = members.filter((m) => {
            if (m.is_treasury) return false;
            if (m.status && m.status !== "active") return false;
            return true;
          });
          const memberRows = eligible.map((m) => {
            const memberCerts = (certs || []).filter((c) => c.shareholder_id === m.id);
            const units = memberCerts
              .filter((c) => c.share_class === "Common" || c.share_class === "Membership Units")
              .reduce((sum, c) => sum + (c.num_shares || 0), 0);
            const interest = memberCerts
              .filter((c) => c.share_class === "Preferred" || c.share_class === "Membership Interest")
              .reduce((sum, c) => sum + (c.num_shares || 0), 0);
            return {
              meeting_id: newMeeting.id,
              shareholder_name: m.name,
              address: m.address || null,
              city: m.city || null,
              state: m.state || null,
              zip: m.zip || null,
              common_shares: units,
              preferred_shares: interest || m.ownership_percentage || null,
            };
          });
          if (memberRows.length > 0) {
            await supabase.from("meeting_shareholders").insert(memberRows);
          }
        }
      }

      return newMeeting;
    },
    onSuccess: (newMeeting) => {
      queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
      setDialogOpen(false);
      if (prefilled) {
        toast.success("Annual Meeting created with data from your last annual meeting!");
      } else {
        toast.success("Meeting created!");
      }
      // Navigate directly to the new meeting
      if (newMeeting?.id) {
        navigate(`/company/${companyId}/meetings/${newMeeting.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["prior_meeting_financials_for_autofill"] });
      toast.success("Meeting deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasSubTypes = SUB_TYPES[form.meeting_type];
  const isOrgMeeting = form.meeting_type === "Organizational Meeting";

  const meetingTypeColor = (type: string) => {
    if (type === "Annual Meeting") return "bg-primary/10 text-primary";
    if (type === "Organizational Meeting") return "bg-accent/10 text-accent";
    return "bg-warning/10 text-warning";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Meetings</h3>
          <p className="text-sm text-muted-foreground">
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} on record
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TaxReturnUpload
            companyId={companyId}
            mode="populate"
            onExtracted={() => {
              queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Tax Return
              </Button>
            }
          />
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">New Meeting</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (form.meeting_type === "Written Consent") {
                  setDialogOpen(false);
                  setEditingConsentId(null);
                  setConsentWizardOpen(true);
                  return;
                }
                createMeeting.mutate();
              }}
              className="space-y-4"
            >
              {/* Prefilled notice */}
              {prefilled && (
                <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-xs text-primary">
                    📋 Data pre-filled from your last annual meeting — please review and update as needed.
                  </p>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-destructive shrink-0 ml-2" onClick={handleStartFresh}>
                    Start Fresh
                  </Button>
                </div>
              )}
              {/* Meeting Info Section */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Date *</Label>
                  <DatePickerField
                    value={form.meeting_date}
                    onChange={(val) => setForm((p) => ({ ...p, meeting_date: val }))}
                    placeholder="Pick a date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Time</Label>
                  <Input
                    value={form.meeting_time}
                    onChange={(e) => setForm((p) => ({ ...p, meeting_time: e.target.value }))}
                    placeholder="10:00 AM"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tax Year</Label>
                  <Input
                    type="number"
                    value={form.tax_year}
                    onChange={(e) => setForm((p) => ({ ...p, tax_year: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Meeting Type</Label>
                  <Select
                    value={form.meeting_type}
                    onValueChange={handleMeetingTypeChange}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(isLLCType(company.entity_type) ? LLC_MEETING_TYPES : CORP_MEETING_TYPES).map((t) => (
                        <SelectItem key={t} value={t}>{t === "Shareholder Meeting" ? "Annual Meeting of Shareholders" : t === "Annual Meeting" && !isLLCType(company.entity_type) ? "Annual Meeting of Directors" : t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasSubTypes && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Sub Type</Label>
                    <Select value={form.sub_type} onValueChange={(v) => setForm((p) => ({ ...p, sub_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select sub type" /></SelectTrigger>
                      <SelectContent>
                        {SUB_TYPES[form.meeting_type].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Meeting Location</Label>
                <Input
                  value={form.meeting_location}
                  onChange={(e) => setForm((p) => ({ ...p, meeting_location: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Chairperson</Label>
                  <Input
                    value={form.chairperson}
                    onChange={(e) => setForm((p) => ({ ...p, chairperson: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Meeting Secretary</Label>
                  <Input
                    value={form.mtg_secretary}
                    onChange={(e) => setForm((p) => ({ ...p, mtg_secretary: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Others Present</Label>
                <Input
                  value={form.others_present}
                  onChange={(e) => setForm((p) => ({ ...p, others_present: e.target.value }))}
                />
              </div>

              {form.meeting_type !== "Written Consent" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {!isOrgMeeting && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Prior Meeting Date</Label>
                      <DatePickerField
                        value={form.prior_mtg_date}
                        onChange={(val) => setForm((p) => ({ ...p, prior_mtg_date: val }))}
                        placeholder="Pick a date"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Next Annual Meeting</Label>
                    <DatePickerField
                      value={form.next_annual_mtg}
                      onChange={(val) => setForm((p) => ({ ...p, next_annual_mtg: val }))}
                      placeholder="Pick a date"
                    />
                  </div>
                </div>
              )}

              {/* Company info at time of meeting */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Company Name & Address on Day of Meeting
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                    <Input
                      value={form.company_name_at_meeting}
                      onChange={(e) => setForm((p) => ({ ...p, company_name_at_meeting: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                    <DbAddressAutocomplete
                      value={form.company_address_at_meeting}
                      onChange={(v) => setForm((p) => ({ ...p, company_address_at_meeting: v }))}
                      onSelect={(addr) => { setForm((p) => ({ ...p, company_address_at_meeting: addr.line1, company_city_at_meeting: addr.city, company_state_at_meeting: addr.state, company_zip_at_meeting: addr.zip })); }}
                      source="companies"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input
                      value={form.company_city_at_meeting}
                      onChange={(e) => setForm((p) => ({ ...p, company_city_at_meeting: e.target.value }))}
                      placeholder={zipLoading ? "Loading..." : ""}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">State</Label>
                      <Input
                        value={form.company_state_at_meeting}
                        onChange={(e) => setForm((p) => ({ ...p, company_state_at_meeting: e.target.value }))}
                        placeholder={zipLoading ? "Loading..." : ""}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
                      <Input
                        value={form.company_zip_at_meeting}
                        onChange={(e) => { setForm((p) => ({ ...p, company_zip_at_meeting: e.target.value })); handleMeetingZipChange(e.target.value); }}
                      />
                      {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMeeting.isPending}>
                {createMeeting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Meeting
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Meeting List */}
      {isError ? (
        <QueryErrorBanner message="Failed to load meetings." onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : meetings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-display text-lg font-semibold">No meetings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first meeting to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
              onClick={() => {
                const path = `/company/${companyId}/meetings/${m.id}`;
                navigate(m.meeting_type === "Written Consent" ? `${path}?preview=true` : path);
              }}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={meetingTypeColor(m.meeting_type)}>
                      {m.meeting_type}
                    </Badge>
                    {m.sub_type && (
                      <span className="text-xs text-muted-foreground">· {m.sub_type}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(m.meeting_date + "T00:00:00").toLocaleDateString()}
                    </span>
                    {m.meeting_location && (
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {m.meeting_location}
                      </span>
                    )}
                  </div>
                </div>
                {m.meeting_type === "Written Consent" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    title="Edit Written Consent"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingConsentId(m.id);
                      setConsentWizardOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/60 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(m.id);
                    setDeleteStep(1);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Annual Meeting Wizard Dialog */}
      <Dialog open={annualWizardOpen} onOpenChange={setAnnualWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Annual Meeting Minutes Generator</DialogTitle>
          </DialogHeader>
          <AnnualMeetingWizard
            company={company}
            onClose={() => setAnnualWizardOpen(false)}
            onMeetingCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
              setAnnualWizardOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Organizational Meeting Wizard Dialog */}
      <Dialog open={orgWizardOpen} onOpenChange={setOrgWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Organizational Meeting Minutes Generator</DialogTitle>
          </DialogHeader>
          <OrgMeetingWizard company={company} onClose={() => setOrgWizardOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Written Consent Wizard Dialog */}
      <Dialog open={consentWizardOpen} onOpenChange={(open) => {
        setConsentWizardOpen(open);
        if (!open) setEditingConsentId(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingConsentId ? "Edit Written Consent" : "Written Consent Wizard"}
            </DialogTitle>
          </DialogHeader>
          <WrittenConsentWizard
            key={editingConsentId || "new"}
            company={company}
            existingMeetingId={editingConsentId || undefined}
            onClose={() => { setConsentWizardOpen(false); setEditingConsentId(null); }}
            onConsentCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
              setConsentWizardOpen(false);
              setEditingConsentId(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteStep === 1} onOpenChange={(open) => { if (!open) { setDeleteStep(0); setDeletingId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              All data tied to this meeting — officers, financials, resolutions, and more — will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteStep(0); setDeletingId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setDeleteStep(2); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteStep === 2} onOpenChange={(open) => { if (!open) { setDeleteStep(0); setDeletingId(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This can't be undone</AlertDialogTitle>
            <AlertDialogDescription>
              Once deleted, there is no way to recover this meeting or any of its records. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteStep(0); setDeletingId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) deleteMeeting.mutate(deletingId);
                setDeleteStep(0);
                setDeletingId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Meeting
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
