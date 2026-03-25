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
import { CheckCircle2, AlertCircle, Scale, BookOpen, Users, FileText, DollarSign, Gavel, Building2, Shield, ClipboardList } from "lucide-react";

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
  entityTypes: string[]; // which entity types this applies to
}

export default function WIComplianceChecklist({ company }: Props) {
  const companyId = company.id;
  const isLLC = company.entity_type === "LLC" || company.entity_type === "LLC-S" || company.entity_type === "Single Member LLC";
  const isCorp = !isLLC; // Corporation or S-Corp

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

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select("id, name, status")
        .eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: stockCerts = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("id, status")
        .eq("company_id", companyId);
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

  const { data: meetingShareholders = [] } = useQuery({
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
  const hasShareholderRecord = shareholders.length > 0 || meetingShareholders.length > 0;
  const hasShareholderShares = meetingShareholders.some((s) => s.common_shares || s.preferred_shares) || shareholders.length > 0;
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
  const hasStockCerts = stockCerts.length > 0;

  // ── Corporation-specific items (Wis. Stat. Ch. 180) ──
  const corpItems: ChecklistItem[] = [
    {
      id: "minutes",
      label: "Minutes of Shareholders & Board Meetings",
      statute: "§ 180.1601(1)(a)",
      description:
        "A corporation shall keep as permanent records minutes of meetings of its shareholders and board of directors. This includes annual meetings, special meetings, and organizational meetings. Minutes must document all actions taken and decisions made.",
      status: hasMinutes ? (hasAnnualMeetings ? "complete" : "partial") : "incomplete",
      icon: BookOpen,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "actions_without_meeting",
      label: "Records of Actions Without a Meeting",
      statute: "§ 180.1601(1)(b)",
      description:
        "Records of actions taken by the shareholders or board of directors without a meeting (written consents / resolutions in lieu of meeting). Under § 180.0704, shareholders may act without a meeting if written consent is signed by all shareholders entitled to vote.",
      status: hasResolutions ? "complete" : "incomplete",
      icon: FileText,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "committee_actions",
      label: "Records of Board Committee Actions",
      statute: "§ 180.1601(1)(c)",
      description:
        "Records of actions taken by a committee of the board of directors in place of the board and on behalf of the corporation. Per § 180.0825, the board may create committees of one or more directors with delegated authority.",
      status: hasResolutions ? "partial" : "incomplete",
      icon: Users,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "accounting",
      label: "Appropriate Accounting Records",
      statute: "§ 180.1601(2)",
      description:
        "A corporation shall maintain appropriate accounting records. This includes general ledgers, journals, income statements, balance sheets, and cash flow statements. Financial records should be reviewed at annual meetings.",
      status: hasAccounting ? "complete" : "incomplete",
      icon: DollarSign,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "shareholder_record",
      label: "Record of Shareholders (Names, Addresses, Shares)",
      statute: "§ 180.1601(3)",
      description:
        "A corporation or its agent shall maintain a record of its shareholders, in a form that permits preparation of a list of the names and addresses of all shareholders, by class or series of shares, showing the number and class or series of shares held by each shareholder.",
      status: hasShareholderRecord
        ? hasShareholderShares
          ? "complete"
          : "partial"
        : "incomplete",
      icon: Users,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "records_form",
      label: "Records Maintained in Written or Convertible Form",
      statute: "§ 180.1601(4)",
      description:
        "A corporation shall maintain its records in written form or in another form capable of conversion into written form within a reasonable time. Electronic records (such as this system) satisfy this requirement as long as they can be printed or exported.",
      status: "complete", // This system satisfies the requirement
      icon: ClipboardList,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "records_principal_office",
      label: "Records Kept at Principal Office",
      statute: "§ 180.1601(5)",
      description:
        "A corporation shall keep a copy of the following records at its principal office: articles of incorporation and all amendments, bylaws and all amendments, board resolutions creating one or more classes of shares (if not in articles/bylaws), minutes of all shareholders' meetings and records of actions taken without a meeting for the past 3 years, written communications to shareholders for the past 3 years, a list of officers and directors, and the most recent annual report.",
      status:
        hasIncDate && hasAnnualMeetings
          ? "complete"
          : hasIncDate || hasMinutes
          ? "partial"
          : "incomplete",
      icon: Building2,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "articles",
      label: "Articles of Incorporation on File",
      statute: "§ 180.0202",
      description:
        "Articles of incorporation must be filed with the WI Department of Financial Institutions (DFI). The articles must set forth the corporate name, number of authorized shares (and classes/series if applicable), the registered agent name and address, and the incorporator's name and address. The corporate records book should contain the original articles and any amendments.",
      status: hasIncDate && hasState ? "complete" : "incomplete",
      icon: Gavel,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "bylaws",
      label: "Corporate Bylaws",
      statute: "§ 180.0206 / § 180.1601(5)(a)2.",
      description:
        "The corporation should adopt bylaws for governance. Under § 180.0206, the incorporators or board of directors shall adopt initial bylaws. A copy of bylaws and all amendments must be kept at the principal office (§ 180.1601(5)(a)2.) and shareholders have the right to inspect them (§ 180.1602(1m)).",
      status: hasOrgMeeting ? "partial" : "incomplete",
      icon: BookOpen,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "registered_agent",
      label: "Registered Agent on File",
      statute: "§ 180.0501",
      description:
        "Each corporation must continuously maintain in Wisconsin a registered office and a registered agent at that office. The agent may be an individual resident of Wisconsin or a domestic/foreign entity authorized to transact business in Wisconsin. Changes must be filed with the DFI.",
      status: hasRegisteredAgent ? "complete" : "incomplete",
      icon: Building2,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "annual_report",
      label: "Annual Report Filing with DFI",
      statute: "§ 180.1622",
      description:
        "Each domestic corporation shall deliver an annual report to the DFI. The report must include: corporation name, state of incorporation, registered agent name and address, principal office address, names and addresses of officers and directors. Failure to file may result in administrative dissolution under § 180.1420.",
      status: hasAnnualReport ? "complete" : "incomplete",
      icon: FileText,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "corporate_status",
      label: "Corporate Status Verification with DFI",
      statute: "§ 180.1420 / § 180.1421",
      description:
        "Verify corporate status with the WI DFI regularly. Administrative dissolution may occur for: failure to file annual reports, failure to maintain a registered agent, failure to pay fees, or failure to appoint a registered agent within 60 days of resignation. Reinstatement is possible under § 180.1422 within 5 years.",
      status: hasVerification ? "complete" : hasCorporateStatus ? "partial" : "incomplete",
      icon: Scale,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "officers_directors",
      label: "Officers & Directors on Record",
      statute: "§ 180.0801 / § 180.0840",
      description:
        "A corporation shall have a board of directors (§ 180.0801) unless shareholder management is authorized in the articles. A corporation shall have officers described in its bylaws or appointed by the board (§ 180.0840). An officer may appoint other officers if authorized. The same person may hold multiple offices.",
      status:
        hasDirectors && hasOfficers
          ? "complete"
          : hasDirectors || hasOfficers
          ? "partial"
          : "incomplete",
      icon: Users,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "shares_authorized",
      label: "Authorized Shares Properly Documented",
      statute: "§ 180.0601",
      description:
        "The articles must state the classes of shares and the number of shares the corporation is authorized to issue. If more than one class, the articles must state the distinguishing designation and number of shares of each class. Par value, if applicable, must be stated. No shares may be issued until articles are filed and consideration is received.",
      status: hasShares ? "complete" : "incomplete",
      icon: FileText,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "stock_certificates",
      label: "Stock Certificates or Uncertificated Shares Notice",
      statute: "§ 180.0625 / § 180.0626",
      description:
        "Under § 180.0625, shareholders are entitled to stock certificates unless the board authorizes uncertificated shares. Certificates must state: corporation name, shareholder name, number and class/series of shares. For uncertificated shares, the corporation must send a written statement with the same information within a reasonable time (§ 180.0626).",
      status: hasStockCerts ? "complete" : "incomplete",
      icon: FileText,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "shareholder_inspection",
      label: "Shareholder Inspection Rights Compliance",
      statute: "§ 180.1602",
      description:
        "Shareholders owning 5%+ of outstanding shares or who have held shares for 6+ months may inspect and copy: minutes, accounting records, shareholder records, articles, bylaws, and board resolutions. They must give 5 business days' written notice and state a proper purpose. This right cannot be abolished by articles or bylaws. Failure to comply may result in court-ordered inspection and attorney fees (§ 180.1604).",
      status: "partial",
      icon: Scale,
      entityTypes: ["Corporation", "S-Corp"],
    },
    {
      id: "fiscal_year",
      label: "Fiscal Year & Accounting Method Documented",
      statute: "§ 180.1601(2)",
      description:
        "The corporation must establish and document its fiscal year end and accounting method (cash or accrual basis). This is critical for tax returns (including S-Corp elections under IRC § 1362), annual report filings, and financial statement preparation reviewed at meetings.",
      status: hasFiscalYear ? "complete" : "incomplete",
      icon: DollarSign,
      entityTypes: ["Corporation", "S-Corp"],
    },
  ];

  // ── LLC-specific items (Wis. Stat. Ch. 183 — Uniform LLC Law, eff. 1/1/2023) ──
  const llcItems: ChecklistItem[] = [
    {
      id: "llc_articles_org",
      label: "Articles of Organization on File",
      statute: "§ 183.0201",
      description:
        "To form an LLC, articles of organization must be filed with the WI DFI. The articles must include: LLC name, registered agent name and address, whether the LLC is member-managed or manager-managed, the organizer's name and address, and the effective date. The records book should retain the original articles and any amendments or restatements (§ 183.0202).",
      status: hasIncDate && hasState ? "complete" : "incomplete",
      icon: Gavel,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_operating_agreement",
      label: "Operating Agreement",
      statute: "§ 183.0105",
      description:
        "An operating agreement governs the relations among the members, managers, and LLC, and the LLC's activities and affairs. Under the Uniform LLC Law (eff. 1/1/2023), the operating agreement may be written, oral, or implied, but a written agreement is strongly recommended. The agreement may not eliminate the duty of loyalty, duty of care, or the contractual obligation of good faith and fair dealing (§ 183.0105(3)).",
      status: hasOrgMeeting ? "partial" : "incomplete",
      icon: BookOpen,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_registered_agent",
      label: "Registered Agent on File",
      statute: "§ 183.0113",
      description:
        "Each LLC must continuously maintain a registered agent in Wisconsin. The agent must be an individual resident of WI or an entity authorized to do business in WI. Changes must be filed with the DFI via a statement of change (§ 183.0114). Resignation of the agent must be properly noticed (§ 183.0115).",
      status: hasRegisteredAgent ? "complete" : "incomplete",
      icon: Building2,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_annual_report",
      label: "Annual Report Filing with DFI",
      statute: "§ 183.0212",
      description:
        "Each domestic LLC shall deliver an annual report to the DFI containing: LLC name, jurisdiction of organization, registered agent name and address, principal office address, and names and addresses of managers (if manager-managed) or members (if member-managed). Failure to file may result in administrative dissolution under § 183.0708.",
      status: hasAnnualReport ? "complete" : "incomplete",
      icon: FileText,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_member_info_rights",
      label: "Member Information Rights & Records Access",
      statute: "§ 183.0410",
      description:
        "In a member-managed LLC, each member may inspect and copy any record regarding the LLC's activities, affairs, and financial condition on reasonable notice (§ 183.0410(1)(a)). The LLC must furnish information material to members' rights without demand (§ 183.0410(1)(b)1.). In a manager-managed LLC, members may obtain information for a purpose material to their interest with 10 days' written demand (§ 183.0410(2)(b)). The LLC may charge reasonable copying costs (§ 183.0410(5)).",
      status: "partial",
      icon: Scale,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_accounting",
      label: "Financial & Accounting Records",
      statute: "§ 183.0410(1)(b)",
      description:
        "The LLC must maintain records of its financial condition and furnish financial information to members. While Ch. 183 does not prescribe specific accounting methods, the LLC should maintain income statements, balance sheets, capital accounts, and distribution records sufficient to prepare tax returns (Form 1065/Schedule K-1) and satisfy member inspection rights.",
      status: hasAccounting ? "complete" : "incomplete",
      icon: DollarSign,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_member_record",
      label: "Record of Members & Ownership Interests",
      statute: "§ 183.0410 / § 183.0401",
      description:
        "The LLC should maintain a current list of all members showing names, addresses, and percentage or other ownership interests. Under § 183.0401, each member has equal rights in management (member-managed) or the managers manage the LLC (manager-managed). Transferable interests are governed by § 183.0502. Accurate records are essential for K-1 preparation and buy-sell events.",
      status: hasShareholderRecord ? "complete" : "incomplete",
      icon: Users,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_managers_officers",
      label: "Managers / Managing Members on Record",
      statute: "§ 183.0407",
      description:
        "If the LLC is manager-managed, managers have the exclusive authority to manage under § 183.0407(3). Each manager has equal rights in management. Managers must be identified in the annual report. For member-managed LLCs, each member has equal rights in management (§ 183.0401(1)). Proper documentation of who has management authority is essential.",
      status:
        hasDirectors || hasOfficers ? "complete" : "incomplete",
      icon: Users,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_status_verification",
      label: "LLC Status Verification with DFI",
      statute: "§ 183.0708 / § 183.0709",
      description:
        "Verify LLC status with the WI DFI regularly. Administrative dissolution may occur under § 183.0708 for: failure to file annual reports, failure to maintain a registered agent, or failure to pay fees. The DFI must give 60 days' written notice before dissolving. Reinstatement is possible under § 183.0709 within 5 years of dissolution.",
      status: hasVerification ? "complete" : hasCorporateStatus ? "partial" : "incomplete",
      icon: Shield,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_fiscal_year",
      label: "Tax Year & Accounting Method",
      statute: "IRC § 706 / § 183.0410",
      description:
        "The LLC must establish and document its tax year and accounting method. Multi-member LLCs taxed as partnerships must generally adopt the tax year of the majority interest partners (IRC § 706(b)). Single-member LLCs follow the owner's tax year. The accounting method (cash or accrual) must be documented for tax filings and member information rights.",
      status: hasFiscalYear ? "complete" : "incomplete",
      icon: DollarSign,
      entityTypes: ["LLC"],
    },
    {
      id: "llc_distribution_records",
      label: "Distribution Records & Limitations",
      statute: "§ 183.0404 / § 183.0405",
      description:
        "The LLC should document all distributions to members. Under § 183.0404, distributions must be made in equal shares among members (unless the operating agreement provides otherwise). Under § 183.0405, the LLC may not make a distribution if after the distribution it would be unable to pay debts as they become due or total assets would be less than total liabilities plus preferential rights.",
      status: hasAccounting ? "partial" : "incomplete",
      icon: DollarSign,
      entityTypes: ["LLC"],
    },
  ];

  // Filter checklist by entity type
  const allItems = [...corpItems, ...llcItems];
  const checklist = allItems.filter((item) =>
    item.entityTypes.some((et) => {
      if (isLLC) return et === "LLC" || et === "LLC-S";
      return et === "Corporation" || et === "S-Corp";
    })
  );

  const completeCount = checklist.filter((c) => c.status === "complete").length;
  const partialCount = checklist.filter((c) => c.status === "partial").length;
  const incompleteCount = checklist.filter((c) => c.status === "incomplete").length;
  const totalCount = checklist.length;
  const scorePercent = Math.round(((completeCount + partialCount * 0.5) / totalCount) * 100);

  const chapterRef = isLLC ? "Ch. 183" : "Ch. 180";
  const chapterTitle = isLLC
    ? "Uniform Limited Liability Company Law"
    : "Business Corporations";
  const entityLabel = isLLC ? "LLC" : "Corporation";

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
            Wisconsin {entityLabel} Records Compliance
          </CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          Required records per Wis. Stat. {chapterRef} — {chapterTitle} (2025)
        </CardDescription>
        <div className="flex gap-3 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-[10px] font-medium text-success">
            <CheckCircle2 className="h-3 w-3" /> {completeCount} Complete
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-warning">
            <AlertCircle className="h-3 w-3" /> {partialCount} Partial
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-destructive/70">
            <AlertCircle className="h-3 w-3" /> {incompleteCount} Missing
          </span>
          <span className="ml-auto text-[10px] font-semibold text-primary">
            Score: {scorePercent}%
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
            Important Notice — Wis. Stat. {chapterRef}
          </p>
          {isCorp ? (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Per Wis. Stat. § 180.1601(4), a corporation shall maintain its records in written form or in another form capable of conversion into written form within a reasonable time. This system satisfies that requirement. Per § 180.1601(5), copies of articles, bylaws, minutes (3 years), shareholder communications (3 years), officer/director list, and the most recent annual report must be kept at the principal office. Shareholders with 6+ months ownership or 5%+ of outstanding shares have inspection rights under § 180.1602 — these rights cannot be abolished by articles or bylaws.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Under the Wisconsin Uniform Limited Liability Company Law (Ch. 183, eff. 1/1/2023), members have broad information rights regarding the LLC's activities, affairs, and financial condition (§ 183.0410). In a member-managed LLC, members may inspect any company record on reasonable notice. In a manager-managed LLC, members must make a written demand describing the information sought and the purpose. The LLC may impose reasonable restrictions and charge copying costs (§ 183.0410(5), (8)). Failure to maintain a registered agent or file annual reports may result in administrative dissolution (§ 183.0708).
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
