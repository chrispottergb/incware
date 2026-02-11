import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, AlertCircle, Scale, BookOpen, Users, FileText, DollarSign, Gavel, Building2 } from "lucide-react";

type Company = Tables<"companies">;

interface Props {
  company: Company;
}

interface ChecklistItem {
  id: string;
  label: string;
  statute: string;
  description: string;
  status: "complete" | "incomplete" | "partial";
  icon: React.ElementType;
}

export default function WIComplianceChecklist({ company }: Props) {
  const companyId = company.id;

  // Fetch related data to determine compliance status
  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, meeting_type, meeting_date")
        .eq("company_id", companyId)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("id, name")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: officers } = useQuery({
    queryKey: ["officers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("officers")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: financials = [] } = useQuery({
    queryKey: ["all_meeting_financials", companyId],
    queryFn: async () => {
      const meetingIds = meetings.map((m) => m.id);
      if (meetingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("meeting_financials")
        .select("id, meeting_id")
        .in("meeting_id", meetingIds);
      if (error) throw error;
      return data;
    },
    enabled: meetings.length > 0,
  });

  const { data: shareholders = [] } = useQuery({
    queryKey: ["all_meeting_shareholders", companyId],
    queryFn: async () => {
      const meetingIds = meetings.map((m) => m.id);
      if (meetingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("meeting_shareholders")
        .select("id, shareholder_name, common_shares, preferred_shares, meeting_id")
        .in("meeting_id", meetingIds);
      if (error) throw error;
      return data;
    },
    enabled: meetings.length > 0,
  });

  const { data: resolutions = [] } = useQuery({
    queryKey: ["all_meeting_resolutions", companyId],
    queryFn: async () => {
      const meetingIds = meetings.map((m) => m.id);
      if (meetingIds.length === 0) return [];
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("id, meeting_id")
        .in("meeting_id", meetingIds);
      if (error) throw error;
      return data;
    },
    enabled: meetings.length > 0,
  });

  // Determine compliance statuses
  const hasAnnualMeetings = meetings.some((m) => m.meeting_type === "Annual Meeting");
  const hasOrgMeeting = meetings.some((m) => m.meeting_type === "Organizational Meeting");
  const hasMinutes = meetings.length > 0;
  const hasResolutions = resolutions.length > 0;
  const hasAccounting = financials.length > 0;
  const hasShareholderRecord = shareholders.length > 0;
  const hasDirectors = directors.length > 0;
  const hasOfficers = officers && (officers.president || officers.secretary || officers.treasurer);
  const hasRegisteredAgent = !!company.registered_agent_name;
  const hasIncDate = !!company.incorporation_date;
  const hasState = !!company.state_of_incorporation;
  const hasShares = !!company.authorized_shares;
  const hasCorporateStatus = !!company.corporate_status && company.corporate_status !== "";
  const hasVerification = !!company.verification_date;
  const hasAnnualReport = !!company.annual_report_year;
  const hasFiscalYear = !!company.fiscal_year_end;

  const checklist: ChecklistItem[] = [
    {
      id: "minutes",
      label: "Minutes of Shareholders & Board Meetings",
      statute: "§ 180.1601(1)(a)",
      description:
        "A corporation shall keep as permanent records minutes of meetings of its shareholders and board of directors. This includes annual meetings, special meetings, and organizational meetings.",
      status: hasMinutes ? (hasAnnualMeetings ? "complete" : "partial") : "incomplete",
      icon: BookOpen,
    },
    {
      id: "actions_without_meeting",
      label: "Records of Actions Without a Meeting",
      statute: "§ 180.1601(1)(b)",
      description:
        "Records of actions taken by the shareholders or board of directors without a meeting (written consents/resolutions in lieu of meeting).",
      status: hasResolutions ? "complete" : "incomplete",
      icon: FileText,
    },
    {
      id: "committee_actions",
      label: "Records of Committee Actions",
      statute: "§ 180.1601(1)(c)",
      description:
        "Records of actions taken by a committee of the board of directors in place of the board of directors and on behalf of the corporation.",
      status: hasResolutions ? "partial" : "incomplete",
      icon: Users,
    },
    {
      id: "accounting",
      label: "Appropriate Accounting Records",
      statute: "§ 180.1601(2)",
      description:
        "A corporation shall maintain appropriate accounting records. This includes financial statements, income/expense reports, and balance sheets reviewed at meetings.",
      status: hasAccounting ? "complete" : "incomplete",
      icon: DollarSign,
    },
    {
      id: "shareholder_record",
      label: "Record of Shareholders",
      statute: "§ 180.1601(3)",
      description:
        "A corporation or its agent shall maintain a record of its shareholders, in a form that permits preparation of a list of the names and addresses of all shareholders, by class or series of shares and showing the number and class or series of shares held by each shareholder.",
      status: hasShareholderRecord
        ? shareholders.some((s) => s.common_shares || s.preferred_shares)
          ? "complete"
          : "partial"
        : "incomplete",
      icon: Users,
    },
    {
      id: "articles",
      label: "Articles of Incorporation on File",
      statute: "§ 180.0202",
      description:
        "The articles of incorporation must be filed with the WI Department of Financial Institutions. The corporate records book should contain a copy of the original articles and any amendments.",
      status: hasIncDate && hasState ? "complete" : "incomplete",
      icon: Gavel,
    },
    {
      id: "bylaws",
      label: "Corporate Bylaws",
      statute: "§ 180.0206 / § 180.1602(1m)",
      description:
        "The corporation should adopt bylaws. Under § 180.1602(1m), shareholders have the right to inspect and copy the corporation's bylaws during regular business hours at the principal office (5 business days written notice required).",
      status: hasOrgMeeting ? "partial" : "incomplete",
      icon: BookOpen,
    },
    {
      id: "registered_agent",
      label: "Registered Agent on File",
      statute: "§ 180.0501",
      description:
        "Each corporation must continuously maintain in Wisconsin a registered office and a registered agent. The registered agent's name and address must be on file with the Department of Financial Institutions.",
      status: hasRegisteredAgent ? "complete" : "incomplete",
      icon: Building2,
    },
    {
      id: "annual_report",
      label: "Annual Report Filing",
      statute: "§ 180.1622",
      description:
        "Each domestic corporation shall deliver to the Department of Financial Institutions an annual report. Failure to file may result in administrative dissolution (§ 180.1420). The report must include the corporation's name, state of incorporation, registered agent, principal office address, officers, and directors.",
      status: hasAnnualReport ? "complete" : "incomplete",
      icon: FileText,
    },
    {
      id: "corporate_status",
      label: "Corporate Status Verification",
      statute: "§ 180.1420 / § 180.1421",
      description:
        "Always verify corporate status with the WI Secretary of State / DFI. Administrative dissolution may occur for failure to file annual reports, failure to maintain a registered agent, or failure to pay fees. Reinstatement is possible under § 180.1422 within 5 years.",
      status: hasVerification ? "complete" : hasCorporateStatus ? "partial" : "incomplete",
      icon: Scale,
    },
    {
      id: "officers_directors",
      label: "Officers & Directors on Record",
      statute: "§ 180.0801 / § 180.0840",
      description:
        "A corporation shall have a board of directors (§ 180.0801). A corporation shall have the officers described in its bylaws or appointed by the board (§ 180.0840). Officers and directors must be listed in annual reports and meeting minutes.",
      status:
        hasDirectors && hasOfficers
          ? "complete"
          : hasDirectors || hasOfficers
          ? "partial"
          : "incomplete",
      icon: Users,
    },
    {
      id: "shares_authorized",
      label: "Authorized Shares Properly Documented",
      statute: "§ 180.0601",
      description:
        "The articles of incorporation must state the classes of shares and number of shares authorized (§ 180.0601). If par value applies, it must also be stated. Shares may not be issued until the articles are filed and consideration received.",
      status: hasShares ? "complete" : "incomplete",
      icon: FileText,
    },
    {
      id: "shareholder_inspection",
      label: "Shareholder Inspection Rights",
      statute: "§ 180.1602",
      description:
        "Shareholders who have held shares for 6+ months or hold 5%+ of outstanding shares may inspect: minutes, accounting records, and shareholder records. They must give 5 business days written notice, state a proper purpose, and describe records sought. This right cannot be abolished by articles or bylaws.",
      status: "partial",
      icon: Scale,
    },
    {
      id: "fiscal_year",
      label: "Fiscal Year & Accounting Method",
      statute: "§ 180.1601(2)",
      description:
        "The corporation must establish and document its fiscal year end and accounting method (cash or accrual basis). This is critical for tax returns, annual reports, and financial statement preparation.",
      status: hasFiscalYear ? "complete" : "incomplete",
      icon: DollarSign,
    },
  ];

  const completeCount = checklist.filter((c) => c.status === "complete").length;
  const partialCount = checklist.filter((c) => c.status === "partial").length;
  const incompleteCount = checklist.filter((c) => c.status === "incomplete").length;

  const statusIcon = (status: string) => {
    if (status === "complete")
      return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
    if (status === "partial")
      return <AlertCircle className="h-4 w-4 text-warning shrink-0" />;
    return <AlertCircle className="h-4 w-4 text-destructive/60 shrink-0" />;
  };

  const statusBadge = (status: string) => {
    if (status === "complete")
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] px-1.5 py-0">
          Complete
        </Badge>
      );
    if (status === "partial")
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1.5 py-0">
          Partial
        </Badge>
      );
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0">
        Missing
      </Badge>
    );
  };

  return (
    <Card className="border-l-2 border-l-primary">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <CardTitle className="card-section-title">
            Wisconsin Corporate Records Compliance
          </CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          Required records per Wis. Stat. Ch. 180 — Business Corporations (2025)
        </CardDescription>
        <div className="flex gap-3 mt-2">
          <span className="flex items-center gap-1 text-[10px] font-medium text-success">
            <CheckCircle2 className="h-3 w-3" /> {completeCount} Complete
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-warning">
            <AlertCircle className="h-3 w-3" /> {partialCount} Partial
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-destructive/70">
            <AlertCircle className="h-3 w-3" /> {incompleteCount} Missing
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <Accordion type="multiple" className="w-full">
          {checklist.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="border-border">
              <AccordionTrigger className="py-2.5 hover:no-underline">
                <div className="flex items-center gap-2.5 text-left">
                  {statusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.label}</span>
                      {statusBadge(item.status)}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Wis. Stat. {item.statute}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className="ml-7 rounded-md bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Important Notice
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Per Wis. Stat. § 180.1601(4), a corporation shall maintain its records in written form or in another form capable of conversion into written form within a reasonable time. This system satisfies that requirement. Shareholders with 6+ months ownership or 5%+ of outstanding shares have inspection rights under § 180.1602 — these rights cannot be abolished by articles or bylaws.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
