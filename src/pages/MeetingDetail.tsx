import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import MeetingAuthorizedSigners from "@/components/meeting/MeetingAuthorizedSigners";
import MeetingInfoCard from "@/components/meeting/MeetingInfoCard";
import MeetingFinancials from "@/components/meeting/MeetingFinancials";
import MeetingSubTable from "@/components/meeting/MeetingSubTable";
import MeetingResolutions from "@/components/meeting/MeetingResolutions";
import MeetingAmendments from "@/components/meeting/MeetingAmendments";
import MeetingBenefits from "@/components/meeting/MeetingBenefits";
import MeetingLoans from "@/components/meeting/MeetingLoans";
import MeetingAgreements from "@/components/meeting/MeetingAgreements";
import PrintPreviewButton from "@/components/meeting/PrintPreviewButton";
import DirectorReElection from "@/components/meeting/DirectorReElection";
import { OFFICER_TITLE_OPTIONS } from "@/components/company/OrganizationTab";
import {
  exportMeetingMinutesPDF,
  exportSectionPDF,
  exportAmendmentsPDF,
  exportResolutionsPDF,
  exportFinancialsPDF,
} from "@/lib/meeting-pdf-export";
import { getTerminology } from "@/lib/entity-terminology";

export default function MeetingDetail() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>();
  const navigate = useNavigate();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("id", meetingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: company } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const isOrganizational = meeting?.meeting_type === "Organizational Meeting";
  const isShareholderMeeting = meeting?.meeting_type === "Shareholder Meeting";
  // Fetch company-level data for organizational meeting boilerplate
  const { data: companyOfficers } = useQuery({
    queryKey: ["officers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("officers").select("*").eq("company_id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting),
  });

  const { data: companyShareholders = [] } = useQuery({
    queryKey: ["shareholders", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("shareholders").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting),
  });

  const { data: companyDirectors = [] } = useQuery({
    queryKey: ["directors", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("directors").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting),
  });

  const { data: companyBanks = [] } = useQuery({
    queryKey: ["company_banks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_banks").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting),
  });

  const { data: companyBankSigners = [] } = useQuery({
    queryKey: ["bank_authorized_signers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_authorized_signers").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting),
  });
  // Fetch prior year meeting for comparison (most recent meeting before this one for same company)
  const { data: priorMeeting } = useQuery({
    queryKey: ["prior_meeting", id, meeting?.meeting_date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("company_id", id!)
        .lt("meeting_date", meeting!.meeting_date)
        .order("meeting_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!meeting?.meeting_date,
  });

  const priorMeetingId = priorMeeting?.id;

  // Fetch all sub-data for full minutes PDF
  const { data: shareholders = [] } = useQuery({
    queryKey: ["meeting_shareholders", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_shareholders").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: directors = [] } = useQuery({
    queryKey: ["meeting_directors", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_directors" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: officers = [] } = useQuery({
    queryKey: ["meeting_officers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_officers").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: counsel = [] } = useQuery({
    queryKey: ["meeting_counsel", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_counsel" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["meeting_assets", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_assets" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: amendments = [] } = useQuery({
    queryKey: ["meeting_amendments", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_amendments" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: resolutions = [] } = useQuery({
    queryKey: ["meeting_resolutions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_resolutions").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: benefits = [] } = useQuery({
    queryKey: ["meeting_benefits", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_benefits" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["meeting_loans", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_loans" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["agreements", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agreements" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: other = [] } = useQuery({
    queryKey: ["meeting_other", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_other" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: authorizedSigners = [] } = useQuery({
    queryKey: ["meeting_authorized_signers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_authorized_signers" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: financials } = useQuery({
    queryKey: ["meeting_financials", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_financials").select("*").eq("meeting_id", meetingId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  // Fetch prior year sub-data for change-based resolution generation
  const { data: priorOfficers = [] } = useQuery({
    queryKey: ["meeting_officers", priorMeetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_officers").select("*").eq("meeting_id", priorMeetingId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!priorMeetingId,
  });

  const { data: priorBenefits = [] } = useQuery({
    queryKey: ["meeting_benefits", priorMeetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_benefits" as any).select("*").eq("meeting_id", priorMeetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!priorMeetingId,
  });

  const { data: priorLoans = [] } = useQuery({
    queryKey: ["meeting_loans", priorMeetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_loans" as any).select("*").eq("meeting_id", priorMeetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!priorMeetingId,
  });

  const { data: priorSigners = [] } = useQuery({
    queryKey: ["meeting_authorized_signers", priorMeetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_authorized_signers" as any).select("*").eq("meeting_id", priorMeetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!priorMeetingId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Calendar className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Meeting not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(`/company/${id}`)}>
          Back to Company
        </Button>
      </div>
    );
  }

  const generateFullMinutes = () =>
    exportMeetingMinutesPDF({
      meeting,
      company,
      shareholders,
      directors,
      officers,
      counsel,
      assets,
      amendments,
      resolutions,
      benefits,
      loans,
      agreements,
      other,
      financials,
      authorizedSigners,
      priorYear: priorMeetingId ? {
        officers: priorOfficers,
        benefits: priorBenefits,
        loans: priorLoans,
        authorizedSigners: priorSigners,
      } : undefined,
      companyOfficers: companyOfficers || undefined,
      companyShareholders,
      companyDirectors,
      companyBanks,
      companyBankSigners,
    });

  const term = getTerminology(company?.entity_type);

  const subTabs = [
    { value: "info", label: "Meeting Info" },
    { value: "financials", label: "Financial" },
    { value: "shareholders", label: term.shareholdersSubTab },
    { value: "directors", label: "Directors" },
    { value: "officers", label: "Officers" },
    { value: "counsel", label: "Counsel / Banking" },
    { value: "assets", label: "Assets" },
    { value: "amendments", label: "Amendments" },
    { value: "resolutions", label: "Resolutions" },
    { value: "benefits", label: "Benefits" },
    { value: "loans", label: "Loans" },
    { value: "agreements", label: "Agreements" },
    { value: "other", label: "Other" },
    { value: "auth_signers", label: "Auth. Signatories" },
  ];

  const meetingFileName = `${company?.name || "meeting"}-${meeting.meeting_type}-${meeting.meeting_date}.pdf`.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/company/${id}`)}
          className="mt-0.5 shrink-0 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-xl font-bold tracking-tight">
              {meeting.meeting_type}
            </h1>
            {meeting.sub_type && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meeting.sub_type}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {company?.name} · {new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString()}
            {meeting.tax_year && ` · Tax Year ${meeting.tax_year}`}
          </p>
        </div>
        <PrintPreviewButton
          label="Print Full Minutes"
          generatePDF={generateFullMinutes}
          fileName={meetingFileName}
        />
      </div>

      <Tabs defaultValue="info" className="w-full">
        <div className="border-b border-border overflow-x-auto">
          <TabsList className="h-auto w-max justify-start gap-0 rounded-none bg-transparent p-0">
            {subTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-[11px] sm:text-xs font-medium text-muted-foreground whitespace-nowrap transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="info" className="mt-5">
          <MeetingInfoCard meeting={meeting} />
        </TabsContent>
        <TabsContent value="financials" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportFinancialsPDF(company, meeting, financials)}
                fileName={`financials-${meetingFileName}`}
              />
            </div>
            <MeetingFinancials meetingId={meeting.id} />
          </div>
        </TabsContent>
        <TabsContent value="shareholders" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF(
                  term.shareholders,
                  company, meeting,
                  ["Name", term.isLLC ? "Membership Units" : "Common Shares", term.isLLC ? "Profits Interest Units" : "Preferred Shares", "Distribution", "Dist. Amount", "Basis", "Add'l Capital"],
                  shareholders.map(s => [
                    s.shareholder_name,
                    s.common_shares?.toLocaleString() ?? "—",
                    s.preferred_shares?.toLocaleString() ?? "—",
                    s.distribution || "—",
                    s.distribution_amount != null ? `$${Number(s.distribution_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                    s.basis != null ? `$${Number(s.basis).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                    s.additional_capital_contribution != null ? `$${Number(s.additional_capital_contribution).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                  ]),
                )}
                fileName={`${term.shareholders.toLowerCase()}-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_shareholders"
              title={term.shareholders}
              columns={[
                { key: "shareholder_name", label: `${term.shareholder} Name`, required: true },
                { key: "common_shares", label: term.isLLC ? "Membership Units" : "Common Shares", type: "number" },
                { key: "preferred_shares", label: term.isLLC ? "Profits Interest Units" : "Preferred Shares", type: "number" },
                { key: "distribution", label: "Distribution" },
                { key: "distribution_amount", label: "Distribution Amount", type: "number" },
                { key: "basis", label: `${term.shareholder} Basis`, type: "number" },
                { key: "additional_capital_contribution", label: "Additional Capital Contribution", type: "number" },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="directors" className="mt-5">
          <div className="space-y-4">
            {isShareholderMeeting && companyDirectors.length > 0 && (
              <DirectorReElection directors={companyDirectors} shareholders={companyShareholders} />
            )}
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Directors", company, meeting, ["Director Name"], directors.map(d => [d.director_name]))}
                fileName={`directors-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_directors" title="Directors"
              columns={[{ key: "director_name", label: "Director Name", required: true }]}
            />
          </div>
        </TabsContent>
        <TabsContent value="officers" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Officers", company, meeting,
                  ["Title", "Name", "Salary", "Bonus"],
                  officers.map((o: any) => [
                    o.title,
                    o.name,
                    o.salary != null ? `$${Number(o.salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                    o.bonus != null ? `$${Number(o.bonus).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                  ])
                )}
                fileName={`officers-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_officers" title="Officers"
              columns={[
                { key: "title", label: "Title", required: true, type: "select", options: OFFICER_TITLE_OPTIONS[company?.entity_type || "Corporation"] || OFFICER_TITLE_OPTIONS["Corporation"] },
                { key: "name", label: "Name", required: true },
                { key: "salary", label: "Salary", type: "number" },
                { key: "bonus", label: "Bonus", type: "number" },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="counsel" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Counsel / Banking", company, meeting, ["Accountant", "Accounting Firm", "Attorney", "Law Firm", "Bank"], counsel.map(c => [c.accountant_name || "—", c.counsel_name || "—", c.attorney_name || "—", c.law_firm || "—", c.bank_name || "—"]))}
                fileName={`counsel-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_counsel" title="Counsel / Banking"
              columns={[
                { key: "accountant_name", label: "Accountant" },
                { key: "counsel_name", label: "Accounting Firm" },
                { key: "attorney_name", label: "Attorney" },
                { key: "law_firm", label: "Law Firm" },
                { key: "bank_name", label: "Bank" },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="assets" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Assets", company, meeting, ["Type", "Description", "Value"], assets.map(a => [a.asset_type, a.description, a.value != null ? `$${Number(a.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"]))}
                fileName={`assets-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_assets" title="Vehicles / Equipment / Leases / Property"
              columns={[
                { key: "asset_type", label: "Type", required: true },
                { key: "description", label: "Description", required: true },
                { key: "value", label: "Value", type: "number" },
              ]}
            />
          </div>
        </TabsContent>
        <TabsContent value="amendments" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportAmendmentsPDF(company, meeting, amendments)}
                fileName={`amendments-${meetingFileName}`}
              />
            </div>
            <MeetingAmendments meetingId={meeting.id} entityType={company?.entity_type || "Corporation"} />
          </div>
        </TabsContent>
        <TabsContent value="resolutions" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportResolutionsPDF(company, meeting, resolutions)}
                fileName={`resolutions-${meetingFileName}`}
              />
            </div>
            <MeetingResolutions meetingId={meeting.id} entityType={company?.entity_type || "Corporation"} meetingType={meeting.meeting_type} />
          </div>
        </TabsContent>
        <TabsContent value="benefits" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Benefits", company, meeting,
                  ["Benefit Type", "Provider", "Agent/Admin", "Insurance Agency", "Plan Year", "Contribution"],
                  benefits.map(b => [
                    b.benefit_type || b.benefit_description || "—",
                    b.provider || "—",
                    b.agent_administrator || "—",
                    b.insurance_agency || "—",
                    b.plan_year?.toString() || "—",
                    b.retirement_contribution != null ? `$${Number(b.retirement_contribution).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                  ])
                )}
                fileName={`benefits-${meetingFileName}`}
              />
            </div>
            <MeetingBenefits meetingId={meeting.id} />
          </div>
        </TabsContent>
        <TabsContent value="loans" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Loans", company, meeting,
                  ["Type", "Rate", "Amount", "Date", "Notes"],
                  loans.map((l: any) => [
                    l.loan_type || "—",
                    l.loan_rate != null ? `${Number(l.loan_rate).toFixed(2)}%` : "—",
                    l.loan_amount != null ? `$${Number(l.loan_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                    l.loan_date ? new Date(l.loan_date + "T00:00:00").toLocaleDateString() : "—",
                    l.notes || "—",
                  ])
                )}
                fileName={`loans-${meetingFileName}`}
              />
            </div>
            <MeetingLoans meetingId={meeting.id} companyName={company?.name} />
          </div>
        </TabsContent>
        <TabsContent value="agreements" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Agreements", company, meeting,
                  ["Type", "Date", "With", "Purpose"],
                  agreements.map((a: any) => [
                    a.agreement_type,
                    a.agreement_date ? new Date(a.agreement_date + "T00:00:00").toLocaleDateString() : "—",
                    a.agreement_with || "—",
                    a.agreement_purpose || "—",
                  ])
                )}
                fileName={`agreements-${meetingFileName}`}
              />
            </div>
            <MeetingAgreements meetingId={meeting.id} />
          </div>
        </TabsContent>
        <TabsContent value="other" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Other Notes", company, meeting, ["Notes"], other.map(o => [o.notes]))}
                fileName={`other-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_other" title="Other Notes"
              columns={[{ key: "notes", label: "Notes", required: true, wide: true }]}
            />
          </div>
        </TabsContent>
        <TabsContent value="auth_signers" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Authorized Signatories", company, meeting, ["Name", "Title", "Bank"], authorizedSigners.map((s: any) => [s.signer_name, s.title || "—", s.bank_name || "—"]))}
                fileName={`auth-signatories-${meetingFileName}`}
              />
            </div>
            <MeetingAuthorizedSigners meetingId={meeting.id} companyId={meeting.company_id} meetingDate={meeting.meeting_date} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
