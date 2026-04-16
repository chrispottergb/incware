import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, FileText, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
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
import MeetingAttendanceSelector from "@/components/meeting/MeetingAttendanceSelector";
import MeetingVehicles from "@/components/meeting/MeetingVehicles";
import MeetingBanking from "@/components/meeting/MeetingBanking";
import MeetingOfficersTable from "@/components/meeting/MeetingOfficersTable";
import { OFFICER_TITLE_OPTIONS } from "@/components/company/OrganizationTab";
import CounselTab from "@/components/company/CounselTab";
import LeasesTab from "@/components/company/LeasesTab";
import BanksTab from "@/components/company/BanksTab";
import WrittenConsentWizard from "@/components/WrittenConsentWizard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  exportMeetingMinutesPDF,
  exportSectionPDF,
  exportAmendmentsPDF,
  exportResolutionsPDF,
  exportFinancialsPDF,
} from "@/lib/meeting-pdf-export";
import { getTerminology } from "@/lib/entity-terminology";
import { useShareCalculations } from "@/hooks/useShareCalculations";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";

export default function MeetingDetail() {
  const { id, meetingId } = useParams<{ id: string; meetingId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const autoPreview = searchParams.get("preview") === "true";
  const queryClient = useQueryClient();
  const [editWizardOpen, setEditWizardOpen] = useState(false);

  const { data: meeting, isLoading, isError, error, refetch } = useQuery({
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

  const isWrittenConsent = meeting?.meeting_type === "Written Consent";
  const isOrganizational = meeting?.meeting_type === "Organizational Meeting";
  const isAnnualMeeting = meeting?.meeting_type === "Annual Meeting";
  const isShareholderMeeting = meeting?.meeting_type === "Shareholder Meeting";
  const showCompanyLevelCounselAndLeases = isAnnualMeeting || isOrganizational;

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
    enabled: !!id,
  });

  // Share/unit calculations for roster auto-population
  const { shareholderHoldings, totalIssuedShares, availableShares } = useShareCalculations(id!);

  // Build enriched roster with holdings + ownership %
  const enrichedShareholderRoster = useMemo(() => {
    return companyShareholders.filter(s => !s.is_treasury).map(s => {
      const holdings = shareholderHoldings[s.id] ?? 0;
      const ownershipPct = totalIssuedShares > 0
        ? (holdings / totalIssuedShares) * 100
        : 0;

      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        zip: s.zip,
        common_shares: String(holdings),
        preferred_shares: ownershipPct.toFixed(2),
      };
    });
  }, [companyShareholders, shareholderHoldings, totalIssuedShares]);

  const { data: companyDirectors = [] } = useQuery({
    queryKey: ["directors", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("directors").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fallback: directors from prior meetings of this company (used when the
  // company-level directors roster is empty or yields no eligible records).
  const { data: priorMeetingDirectors = [] } = useQuery({
    queryKey: ["prior_meeting_directors", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_directors" as any)
        .select("director_name, meeting_id, meetings!inner(company_id, meeting_date)")
        .eq("meetings.company_id", id!)
        .order("meetings(meeting_date)", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  // Fallback: shareholders (with addresses) from prior meetings of this company.
  const { data: priorMeetingShareholders = [] } = useQuery({
    queryKey: ["prior_meeting_shareholders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_shareholders")
        .select("shareholder_name, address, city, state, zip, meeting_id, meetings!inner(company_id, meeting_date)")
        .eq("meetings.company_id", id!)
        .order("meetings(meeting_date)", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!id,
  });

  const { data: companyAttorneys = [] } = useQuery({
    queryKey: ["attorneys", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorneys").select("*, attorney_firms(firm_name)").eq("company_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!isAnnualMeeting,
  });

  const { data: companyAccountants = [] } = useQuery({
    queryKey: ["accountants", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountants").select("*, accountant_firms(firm_name)").eq("company_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!isAnnualMeeting,
  });

  const { data: companyBanks = [] } = useQuery({
    queryKey: ["company_banks", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_banks").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting || isAnnualMeeting),
  });

  const { data: companyBankSigners = [] } = useQuery({
    queryKey: ["bank_authorized_signers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_authorized_signers").select("*").eq("company_id", id!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isOrganizational || isShareholderMeeting || isAnnualMeeting),
  });

  const { data: companyLeases = [] } = useQuery({
    queryKey: ["company_leases", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_assets").select("*").eq("company_id", id!).eq("asset_type", "lease").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!(isAnnualMeeting || isOrganizational),
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

  const hydratedMeetingShareholders = useMemo(() => {
    const normalizeName = (value: string | null | undefined) =>
      (value || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

    return shareholders.map((shareholder: any) => {
      const rosterMatch = companyShareholders.find(
        (candidate: any) => normalizeName(candidate.name) === normalizeName(shareholder.shareholder_name)
      );

      if (!rosterMatch) return shareholder;

      const liveHoldings = shareholderHoldings[rosterMatch.id] ?? 0;
      const liveInterest = totalIssuedShares > 0
        ? Number(((liveHoldings / totalIssuedShares) * 100).toFixed(2))
        : null;

      return {
        ...shareholder,
        address: shareholder.address || rosterMatch.address || null,
        city: shareholder.city || rosterMatch.city || null,
        state: shareholder.state || rosterMatch.state || null,
        zip: shareholder.zip || rosterMatch.zip || null,
        common_shares: shareholder.common_shares && Number(shareholder.common_shares) > 0
          ? shareholder.common_shares
          : liveHoldings,
        preferred_shares: shareholder.preferred_shares && Number(shareholder.preferred_shares) > 0
          ? shareholder.preferred_shares
          : liveInterest,
      };
    });
  }, [shareholders, companyShareholders, shareholderHoldings, totalIssuedShares]);

  // Backfill missing addresses on existing meeting_shareholders rows.
  // Source priority: company shareholders table → prior meetings' shareholder rows.
  const backfilledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!meetingId || backfilledRef.current === meetingId) return;
    if (!shareholders.length) return;

    const normalizeName = (v: string | null | undefined) =>
      (v || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

    const hasAnyAddr = (r: any) => !!(r?.address || r?.city || r?.state || r?.zip);

    // Index prior-meeting shareholder addresses by normalized name (most recent wins;
    // query is ordered desc, so first occurrence is newest).
    const priorIndex = new Map<string, any>();
    for (const r of priorMeetingShareholders as any[]) {
      const key = normalizeName(r.shareholder_name);
      if (!key || priorIndex.has(key)) continue;
      if (hasAnyAddr(r)) priorIndex.set(key, r);
    }

    const updates: Array<{ id: string; address: string | null; city: string | null; state: string | null; zip: string | null }> = [];
    shareholders.forEach((sh: any) => {
      if (hasAnyAddr(sh)) return;
      const key = normalizeName(sh.shareholder_name);
      let match: any = companyShareholders.find(
        (c: any) => normalizeName(c.name) === key && hasAnyAddr(c)
      );
      if (!match) match = priorIndex.get(key);
      if (!match) return;
      updates.push({
        id: sh.id,
        address: match.address || null,
        city: match.city || null,
        state: match.state || null,
        zip: match.zip || null,
      });
    });

    if (updates.length === 0) {
      backfilledRef.current = meetingId;
      return;
    }

    backfilledRef.current = meetingId;
    (async () => {
      try {
        await Promise.all(
          updates.map((u) =>
            supabase
              .from("meeting_shareholders")
              .update({ address: u.address, city: u.city, state: u.state, zip: u.zip })
              .eq("id", u.id)
          )
        );
        queryClient.invalidateQueries({ queryKey: ["meeting_shareholders", meetingId] });
      } catch (err) {
        console.error("Address backfill failed:", err);
      }
    })();
  }, [meetingId, shareholders, companyShareholders, priorMeetingShareholders, queryClient]);

  const { data: directors = [] } = useQuery({
    queryKey: ["meeting_directors", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_directors" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  // Effective director roster for "Add from Company Roster" selector and the
  // Re-Election panel. Priority: company `directors` table → prior meetings'
  // unique director names → directors already on THIS meeting (so Re-Election
  // always has a usable source for legacy/historical entries).
  const effectiveDirectorRoster = useMemo(() => {
    const norm = (v: string) => (v || "").toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string; added_date?: string | null }> = [];

    for (const d of companyDirectors as any[]) {
      const k = norm(d.name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ id: d.id, name: d.name, added_date: d.added_date });
    }

    if (out.length === 0) {
      for (const d of priorMeetingDirectors as any[]) {
        const k = norm(d.director_name);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        out.push({ id: `prior-${k}`, name: d.director_name, added_date: null });
      }
    }

    for (const d of directors as any[]) {
      const k = norm(d.director_name);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ id: `meeting-${d.id}`, name: d.director_name, added_date: null });
    }

    return out;
  }, [companyDirectors, priorMeetingDirectors, directors]);

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

  const { data: capitalAssets = [] } = useQuery({
    queryKey: ["meeting_vehicle_purchases", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_vehicle_purchases").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!meetingId,
  });

  const { data: vehicleLeases = [] } = useQuery({
    queryKey: ["meeting_vehicle_leases", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_vehicle_leases").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data;
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

  const { data: nonRecurringItems = [] } = useQuery({
    queryKey: ["meeting_non_recurring_items", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_non_recurring_items" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!meetingId,
  });


  const { data: leaseTerminations = [] } = useQuery({
    queryKey: ["meeting_lease_terminations", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_lease_terminations" as any).select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!meetingId,
  });

  const { data: balanceEntries = [] } = useQuery({
    queryKey: ["meeting-balance-entries-pdf", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_balance_entries").select("*").eq("meeting_id", meetingId!).order("created_at");
      if (error) throw error;
      return data as any[];
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

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl py-20 px-4">
        <QueryErrorBanner message="Failed to load meeting details." onRetry={refetch} />
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

  // Validation: check if all officers have compensation status
  const officersMissingStatus = officers.filter((o: any) => !o.compensation_status);
  const officersHaveReasonIssue = officers.some((o: any) =>
    (o.compensation_status === "below_market" || o.compensation_status === "above_market") && o.compensation_note?.includes("[REASON]")
  );
  // Dual-role validation: treat a group as resolved when one compensated role remains
  // and all additional duplicate-title rows are marked as included in that primary role.
  const officerNameCounts = new Map<string, any[]>();
  officers.forEach((o: any) => {
    const key = (o.name || "").trim().toLowerCase();
    if (!key) return;
    if (!officerNameCounts.has(key)) officerNameCounts.set(key, []);
    officerNameCounts.get(key)!.push(o);
  });
  const unresolvedDualRoles: string[] = [];
  officerNameCounts.forEach((group) => {
    if (group.length < 2) return;

    const hasExplicitPrimary = group.some((o: any) => o.dual_role_type === "primary");
    const primaryCandidates = group.filter((o: any) => o.compensation_status !== "included_in_primary");
    const hasInferredPrimary = primaryCandidates.length === 1;

    if (!hasExplicitPrimary && !hasInferredPrimary) {
      unresolvedDualRoles.push(group[0].name);
    }
  });
  const officerValidationFailed = officers.length > 0 && (
    officersMissingStatus.length > 0 ||
    officersHaveReasonIssue ||
    unresolvedDualRoles.length > 0
  );

  const generateFullMinutes = () => {
    if (unresolvedDualRoles.length > 0) {
      toast.error(`${unresolvedDualRoles.join(", ")} holds multiple titles. Please designate a Primary Role before generating minutes.`);
      return null as any;
    }
    if (officerValidationFailed) {
      toast.error("All officers must have a Compensation Status set (with [REASON] resolved) before generating minutes.");
      return null as any;
    }
    try {
      
      const doc = exportMeetingMinutesPDF({
        meeting,
        company,
        shareholders: hydratedMeetingShareholders,
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
        nonRecurringItems,
        authorizedSigners,
        capitalAssets,
        vehicleLeases,
        leaseTerminations,
        balanceEntries,
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
        companyAttorneys,
        companyAccountants,
        companyLeases,
      });
      
      return doc;
    } catch (err: any) {
      console.error("[generateFullMinutes] PDF generation crashed:", err);
      toast.error("Failed to generate meeting minutes PDF: " + (err?.message || "Unknown error"));
      return null as any;
    }
  };

  const term = getTerminology(company?.entity_type);

  const allSubTabs = [
    { value: "info", label: "Meeting Info" },
    { value: "financials", label: "Financial" },
    { value: "shareholders", label: term.shareholdersSubTab },
    { value: "directors", label: term.directors },
    { value: "officers", label: "Officers" },
    { value: "counsel", label: "Counsel" },
    { value: "banking", label: "Banking" },
    { value: "leases", label: "Leases" },
    { value: "vehicles", label: "Vehicles & Equipment" },
    { value: "amendments", label: "Amendments" },
    { value: "resolutions", label: "Resolutions" },
    { value: "benefits", label: "Benefits" },
    { value: "loans", label: "Loans & Notes Payable" },
    { value: "agreements", label: "Agreements" },
    { value: "other", label: "Other" },
  ];

  // Shareholder meetings only need a focused subset of tabs
  const shareholderTabs = new Set(["info", "shareholders", "directors", "resolutions", "other"]);
  const subTabs = isShareholderMeeting
    ? allSubTabs.filter(t => shareholderTabs.has(t.value))
    : allSubTabs;

  const meetingFileName = `${company?.name || "meeting"}-${meeting.meeting_type}-${meeting.meeting_date}.pdf`.replace(/\s+/g, "-").toLowerCase();

  // Written Consent document view — Preview / Download / Print only
  if (isWrittenConsent) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/company/${id}#meetings`)}
            className="mt-0.5 shrink-0 h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display text-xl font-bold tracking-tight">
                Written Consent
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {company?.name} · {new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString()}
              {meeting.tax_year && ` · Tax Year ${meeting.tax_year}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditWizardOpen(true)}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>

        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-base">Written Consent in Lieu of a Meeting</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This document was created on {new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString()}.
              Use the actions below to preview, download, or print the formatted document.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <PrintPreviewButton
                label="Print"
                generatePDF={generateFullMinutes}
                fileName={meetingFileName}
                autoPreview={autoPreview}
              />
            </div>
          </CardContent>
        </Card>

        {/* Meeting Info summary */}
        <MeetingInfoCard meeting={meeting} />

        {/* Resolutions */}
        <MeetingResolutions
          meetingId={meeting.id}
          entityType={company?.entity_type || "Corporation"}
          companyId={id}
          companyName={company?.name}
          meetingDate={meeting.meeting_date}
        />

        {/* Edit Written Consent Wizard */}
        <Dialog open={editWizardOpen} onOpenChange={setEditWizardOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Edit Written Consent</DialogTitle>
            </DialogHeader>
            <WrittenConsentWizard
              company={company}
              existingMeetingId={meeting.id}
              onClose={() => setEditWizardOpen(false)}
              onConsentCreated={() => {
                setEditWizardOpen(false);
                refetch();
                queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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
        <div className="border-b border-border">
          <TabsList className="h-auto w-full flex flex-wrap justify-start gap-0 rounded-none bg-transparent p-0">
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
                generatePDF={() => exportFinancialsPDF(company, meeting, financials, nonRecurringItems)}
                fileName={`financials-${meetingFileName}`}
              />
            </div>
            <MeetingFinancials meetingId={meeting.id} />
          </div>
        </TabsContent>
        <TabsContent value="shareholders" className="mt-5">
          <div className="space-y-4">
            <MeetingAttendanceSelector
              meetingId={meeting.id}
              meetingDate={meeting.meeting_date}
              roster={companyShareholders.map((s) => {
                const holdings = shareholderHoldings[s.id] ?? 0;
                const ownershipPct = totalIssuedShares > 0 ? Number((((shareholderHoldings[s.id] ?? 0) / totalIssuedShares) * 100).toFixed(2)) : 0;

                return {
                  id: s.id,
                  name: s.name,
                  address: s.address,
                  city: s.city,
                  state: s.state,
                  zip: s.zip,
                  status: s.status,
                  isTreasury: s.is_treasury,
                  commonShares: holdings,
                  preferredShares: ownershipPct,
                };
              })}
              existingNames={shareholders.map((s) => s.shareholder_name)}
              roleLabel={term.shareholder}
              roleLabelPlural={term.shareholders}
              tableName="meeting_shareholders"
              nameColumn="shareholder_name"
            />
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF(
                  term.shareholders,
                  company, meeting,
                  ["Name", "Address", "City", "St", "ZIP", term.isLLC ? "Units" : "Common", term.isLLC ? "Interest %" : "Ownership %", "Dist. Amount", "Basis", "Add'l Capital"],
                  hydratedMeetingShareholders.map(s => [
                    s.shareholder_name,
                    (s as any).address ?? "—",
                    (s as any).city ?? "—",
                    (s as any).state ?? "—",
                    (s as any).zip ?? "—",
                    s.common_shares?.toLocaleString() ?? "—",
                    term.isLLC && s.preferred_shares != null ? `${s.preferred_shares}%` : (s.preferred_shares?.toLocaleString() ?? "—"),
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
              companyId={id}
              columns={[
                { key: "shareholder_name", label: `${term.shareholder} Name`, required: true, width: "160px" },
                { key: "address", label: "Street Address" },
                { key: "city", label: "City", width: "120px" },
                { key: "state", label: "State", width: "60px" },
                { key: "zip", label: "ZIP", width: "80px" },
                { key: "common_shares", label: term.isLLC ? "Units" : "Common", type: "number", width: "80px" },
                { key: "preferred_shares", label: term.isLLC ? "Interest %" : "Ownership %", type: "number", width: "80px" },
                { key: "distribution_amount", label: "Distribution", type: "number", width: "100px" },
                { key: "basis", label: "Basis", type: "number", width: "90px" },
                { key: "additional_capital_contribution", label: "Add'l Capital", type: "number", width: "100px" },
              ]}
              displayRows={hydratedMeetingShareholders}
              roster={enrichedShareholderRoster}
              rosterFieldMap={{
                name: "shareholder_name",
                address: "address",
                city: "city",
                state: "state",
                zip: "zip",
                common_shares: "common_shares",
                preferred_shares: "preferred_shares",
              }}
              onCreateNewRosterEntry={async (formData) => {
                const name = formData.shareholder_name?.trim();
                if (!name) { toast.error("Name is required"); return null; }
                const { data, error } = await supabase.from("shareholders").insert({
                  company_id: id!,
                  name,
                  address: formData.address || null,
                  city: formData.city || null,
                  state: formData.state || null,
                  zip: formData.zip || null,
                  share_class: "Common",
                }).select("id, name, address, city, state, zip").single();
                if (error) { toast.error(error.message); return null; }
                queryClient.invalidateQueries({ queryKey: ["shareholders", id] });
                return { id: data.id, name: data.name, address: data.address, city: data.city, state: data.state, zip: data.zip };
              }}
            />
          </div>
        </TabsContent>
        <TabsContent value="directors" className="mt-5">
          <div className="space-y-4">
            {(isShareholderMeeting || isAnnualMeeting) && effectiveDirectorRoster.length > 0 && (
              <DirectorReElection directors={effectiveDirectorRoster as any} meetingDirectorNames={directors.map((d: any) => d.director_name)} shareholders={companyShareholders} directorLabel={term.director} directorsLabel={term.directors} shareholdersLabel={term.shareholders} />
            )}
            <MeetingAttendanceSelector
              meetingId={meeting.id}
              meetingDate={meeting.meeting_date}
              roster={effectiveDirectorRoster.map((d) => ({
                id: d.id,
                name: d.name,
                startDate: d.added_date,
              }))}
              existingNames={directors.map((d: any) => d.director_name)}
              roleLabel={term.director}
              roleLabelPlural={term.directors}
              tableName="meeting_directors"
              nameColumn="director_name"
            />
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF(term.directors, company, meeting, [term.directorName], directors.map(d => [d.director_name]))}
                fileName={`directors-${meetingFileName}`}
              />
            </div>
            <MeetingSubTable meetingId={meeting.id} tableName="meeting_directors" title={term.directors}
              columns={[{ key: "director_name", label: term.directorName, required: true }]}
              companyId={id}
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
            <MeetingOfficersTable
              meetingId={meeting.id}
              titleOptions={OFFICER_TITLE_OPTIONS[company?.entity_type || "Corporation"] || OFFICER_TITLE_OPTIONS["Corporation"]}
            />
          </div>
        </TabsContent>
        <TabsContent value="counsel" className="mt-5">
          {showCompanyLevelCounselAndLeases ? (
            <CounselTab companyId={id!} />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PrintPreviewButton
                  label="Print"
                  generatePDF={() => exportSectionPDF("Counsel", company, meeting, ["Accountant", "Accounting Firm", "Attorney", "Law Firm"], counsel.map(c => [c.accountant_name || "—", c.counsel_name || "—", c.attorney_name || "—", c.law_firm || "—"]))}
                  fileName={`counsel-${meetingFileName}`}
                />
              </div>
              <MeetingSubTable meetingId={meeting.id} tableName="meeting_counsel" title="Counsel"
                columns={[
                  { key: "accountant_name", label: "Accountant" },
                  { key: "counsel_name", label: "Accounting Firm" },
                  { key: "attorney_name", label: "Attorney" },
                  { key: "law_firm", label: "Law Firm" },
                ]}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="banking" className="mt-5">
          {showCompanyLevelCounselAndLeases ? (
            <div className="space-y-6">
              <BanksTab companyId={id!} />
              <MeetingBanking meetingId={meeting.id} />
            </div>
          ) : (
            <div className="space-y-4">
              <MeetingBanking meetingId={meeting.id} />
              <div className="mt-6">
                <MeetingAuthorizedSigners meetingId={meeting.id} companyId={meeting.company_id} meetingDate={meeting.meeting_date} />
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="leases" className="mt-5">
          {showCompanyLevelCounselAndLeases ? (
            <LeasesTab companyId={id!} companyName={company?.name} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Leases are available on Annual and Organizational meetings.</p>
          )}
        </TabsContent>
        <TabsContent value="vehicles" className="mt-5">
          {showCompanyLevelCounselAndLeases ? (
            <MeetingVehicles meetingId={meeting.id} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Vehicles & Equipment are available on Annual and Organizational meetings.</p>
          )}
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
            <MeetingResolutions
              meetingId={meeting.id}
              entityType={company?.entity_type || "Corporation"}
              meetingType={meeting.meeting_type}
              companyId={id!}
              companyName={company?.name}
              availableShares={availableShares}
              meetingDate={meeting.meeting_date}
            />
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
            <MeetingLoans
              meetingId={meeting.id}
              companyName={company?.name}
            />
          </div>
        </TabsContent>
        <TabsContent value="agreements" className="mt-5">
          <div className="space-y-4">
            <div className="flex justify-end">
              <PrintPreviewButton
                label="Print"
                generatePDF={() => exportSectionPDF("Agreements", company, meeting,
                  ["Type", "Counterparty", "Date", "Amount", "Expiration", "Status"],
                  agreements.map((a: any) => [
                    a.agreement_type,
                    a.agreement_with || "—",
                    a.agreement_date ? new Date(a.agreement_date + "T00:00:00").toLocaleDateString() : "—",
                    a.amount != null ? `$${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
                    a.expiration_date ? new Date(a.expiration_date + "T00:00:00").toLocaleDateString() : "—",
                    a.status || "Active",
                  ])
                )}
                fileName={`agreements-${meetingFileName}`}
              />
            </div>
            <MeetingAgreements meetingId={meeting.id} meetingDate={meeting.meeting_date} />
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
      </Tabs>
    </div>
  );
}
