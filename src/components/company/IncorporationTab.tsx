// LLC-SPECIFIC RULES ACTIVE — See LLC FORM RULES comments at lines ~99, ~948, ~1057 before editing. DO NOT regenerate this component from a template.
import { useState, useCallback, useEffect, useRef } from "react";
import { useAutoSave } from "@/hooks/useAutoSave";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";
import { useZipLookup } from "@/hooks/useZipLookup";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Shield, Building2, Share2, UserCheck, ChevronDown, Users, Heart, RefreshCw, ExternalLink, User, Phone, Globe, Plus, Trash2, Check, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import WIComplianceChecklist from "./WIComplianceChecklist";
import SectionPdfActions from "./SectionPdfActions";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { cn } from "@/lib/utils";
import { isLLCType } from "@/lib/entity-terminology";

const ENTITY_TYPES = ["Corporation", "LLC", "LLC-S", "Single Member LLC", "S-Corp", "Non-Profit", "Partnership"];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const STATE_SOS_INFO: Record<string, { name: string; url: string }> = {
  AL: { name: "AL Secretary of State", url: "https://www.sos.alabama.gov/business-services" },
  AK: { name: "AK Div. of Corporations", url: "https://www.commerce.alaska.gov/cbp/main/search/entities" },
  AZ: { name: "AZ Corporation Commission", url: "https://ecorp.azcc.gov/EntitySearch/Index" },
  AR: { name: "AR Secretary of State", url: "https://www.sos.arkansas.gov/corps/search_all.php" },
  CA: { name: "CA Secretary of State", url: "https://bizfileonline.sos.ca.gov/search/business" },
  CO: { name: "CO Secretary of State", url: "https://www.sos.state.co.us/biz/BusinessEntityCriteriaExt.do" },
  CT: { name: "CT Secretary of State", url: "https://service.ct.gov/business/s/onlinebusinesssearch" },
  DE: { name: "DE Div. of Corporations", url: "https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx" },
  FL: { name: "FL Div. of Corporations", url: "https://search.sunbiz.org/Inquiry/CorporationSearch/ByName" },
  GA: { name: "GA Secretary of State", url: "https://ecorp.sos.ga.gov/BusinessSearch" },
  HI: { name: "HI DCCA", url: "https://hbe.ehawaii.gov/documents/search.html" },
  ID: { name: "ID Secretary of State", url: "https://sosbiz.idaho.gov/search/business" },
  IL: { name: "IL Secretary of State", url: "https://www.ilsos.gov/corporatellc/" },
  IN: { name: "IN Secretary of State", url: "https://bsd.sos.in.gov/publicbusinesssearch" },
  IA: { name: "IA Secretary of State", url: "https://sos.iowa.gov/search/business/(S(search))/search.aspx" },
  KS: { name: "KS Secretary of State", url: "https://www.kansas.gov/bess/flow/main?execution=e1s1" },
  KY: { name: "KY Secretary of State", url: "https://web.sos.ky.gov/bussearchnew/search" },
  LA: { name: "LA Secretary of State", url: "https://coraweb.sos.la.gov/CommercialSearch/CommercialSearch.aspx" },
  ME: { name: "ME Secretary of State", url: "https://www.maine.gov/sos/cec/corp/corp_search.html" },
  MD: { name: "MD SDAT", url: "https://egov.maryland.gov/BusinessExpress/EntitySearch" },
  MA: { name: "MA Secretary of State", url: "https://corp.sec.state.ma.us/corpweb/CorpSearch/CorpSearch.aspx" },
  MI: { name: "MI LARA", url: "https://cofs.lara.state.mi.us/SearchApi/Search/Search" },
  MN: { name: "MN Secretary of State", url: "https://mblsportal.sos.state.mn.us/Business/Search" },
  MS: { name: "MS Secretary of State", url: "https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx" },
  MO: { name: "MO Secretary of State", url: "https://bsd.sos.mo.gov/BusinessEntity/BESearch.aspx" },
  MT: { name: "MT Secretary of State", url: "https://sosmt.gov/business/" },
  NE: { name: "NE Secretary of State", url: "https://www.nebraska.gov/sos/corp/corpsearch.cgi" },
  NV: { name: "NV Secretary of State", url: "https://esos.nv.gov/EntitySearch/OnlineEntitySearch" },
  NH: { name: "NH Secretary of State", url: "https://quickstart.sos.nh.gov/online/BusinessInquire" },
  NJ: { name: "NJ Div. of Revenue", url: "https://www.njportal.com/DOR/BusinessNameSearch/" },
  NM: { name: "NM Secretary of State", url: "https://portal.sos.state.nm.us/BFS/online/CorporationBusinessSearch" },
  NY: { name: "NY Div. of Corporations", url: "https://appext20.dos.ny.gov/corp_public/CORPSEARCH.ENTITY_SEARCH_ENTRY" },
  NC: { name: "NC Secretary of State", url: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration" },
  ND: { name: "ND Secretary of State", url: "https://firststop.sos.nd.gov/search/business" },
  OH: { name: "OH Secretary of State", url: "https://businesssearch.ohiosos.gov/" },
  OK: { name: "OK Secretary of State", url: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx" },
  OR: { name: "OR Secretary of State", url: "https://sos.oregon.gov/business/pages/find.aspx" },
  PA: { name: "PA Dept. of State", url: "https://www.corporations.pa.gov/search/corpsearch" },
  RI: { name: "RI Secretary of State", url: "https://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx" },
  SC: { name: "SC Secretary of State", url: "https://businessfilings.sc.gov/businessfiling/Entity/Search" },
  SD: { name: "SD Secretary of State", url: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx" },
  TN: { name: "TN Secretary of State", url: "https://tnbear.tn.gov/ECommerce/FilingSearch.aspx" },
  TX: { name: "TX Secretary of State", url: "https://mycpa.cpa.state.tx.us/coa/" },
  UT: { name: "UT Div. of Corporations", url: "https://secure.utah.gov/bes/" },
  VT: { name: "VT Secretary of State", url: "https://bizfilings.vermont.gov/online/BusinessInquire" },
  VA: { name: "VA SCC", url: "https://cis.scc.virginia.gov/EntitySearch/Index" },
  WA: { name: "WA Secretary of State", url: "https://ccfs.sos.wa.gov/" },
  WV: { name: "WV Secretary of State", url: "https://apps.wv.gov/SOS/BusinessEntity/" },
  WI: { name: "WI DFI", url: "https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx" },
  WY: { name: "WY Secretary of State", url: "https://wyobiz.wyo.gov/Business/FilingSearch.aspx" },
  DC: { name: "DC DCRA", url: "https://corponline.dcra.dc.gov/BizEntity.aspx" },
};

// ─── Entity-aware card config ────────────────────────────────────────────────
// LLC FORM RULES: Members not Directors. Section renamed to Management & Elections. Management Type dropdown: Member Managed / Manager Managed. No share/par value fields. Keep: S-Election, Seal. DO NOT REVERT.
function getEquityCardConfig(entityType: string) {
  switch (entityType) {
    case "LLC":
    case "LLC-S":
    case "Single Member LLC":
      return {
        title: "Management & Elections",
        icon: <Users className="h-3.5 w-3.5 text-primary" />,
        description: "LLC management structure and elections",
        showAuthorizedShares: false,
        showParValue: false,
        showSElection: true,
        show1244: false,
        showSeal: true,
        showMembershipUnits: true,
        showManagementType: true,
        showPartnershipInterest: false,
        authorizedLabel: "",
      };
    case "S-Corp":
      return {
        title: "Shares & Elections",
        icon: <Share2 className="h-3.5 w-3.5 text-primary" />,
        description: "S-Corporation shares, par value, and tax elections",
        showAuthorizedShares: true,
        showParValue: true,
        showSElection: true,
        show1244: true,
        showSeal: true,
        showMembershipUnits: false,
        showManagementType: false,
        showPartnershipInterest: false,
        authorizedLabel: "Authorized Shares",
      };
    case "Partnership":
      return {
        title: "Partnership Interests",
        icon: <Users className="h-3.5 w-3.5 text-primary" />,
        description: "Partnership unit allocation and interest structure",
        showAuthorizedShares: false,
        showParValue: false,
        showSElection: false,
        show1244: false,
        showSeal: false,
        showMembershipUnits: false,
        showManagementType: false,
        showPartnershipInterest: true,
        authorizedLabel: "Total Partnership Units",
      };
    case "Non-Profit":
      return {
        title: "Governance",
        icon: <Heart className="h-3.5 w-3.5 text-primary" />,
        description: "Non-profit organizational governance",
        showAuthorizedShares: false,
        showParValue: false,
        showSElection: false,
        show1244: false,
        showSeal: true,
        showMembershipUnits: false,
        showManagementType: false,
        showPartnershipInterest: false,
        authorizedLabel: "",
      };
    default: // Corporation
      return {
        title: "Shares & Elections",
        icon: <Share2 className="h-3.5 w-3.5 text-primary" />,
        description: "Authorized shares, par value, and corporate elections",
        showAuthorizedShares: true,
        showParValue: true,
        showSElection: false,
        show1244: true,
        showSeal: true,
        showMembershipUnits: false,
        showManagementType: false,
        showPartnershipInterest: false,
        authorizedLabel: "Authorized Shares",
      };
  }
}

type Company = Tables<"companies">;

interface Props {
  company: Company;
}

export default function IncorporationTab({ company }: Props) {
  const [verifying, setVerifying] = useState(false);
  const [wdfiResults, setWdfiResults] = useState<any[]>([]);
  const [wdfiVerificationDate, setWdfiVerificationDate] = useState("");
  const [showWdfiDialog, setShowWdfiDialog] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: company.name,
    entity_type: company.entity_type,
    state_of_incorporation: company.state_of_incorporation ?? "",
    incorporation_date: company.incorporation_date ?? "",
    fiscal_year_end: company.fiscal_year_end ?? "",
    authorized_shares: company.authorized_shares?.toString() ?? "",
    par_value_type: company.par_value_type ?? "par",
    par_value: company.par_value?.toString() ?? "",
    s_election_date: company.s_election_date ?? "",
    scheduled_annual_meeting: company.scheduled_annual_meeting ?? "",
    election_1244: company.election_1244 ?? false,
    seal_type: company.seal_type ?? "no_seal",
    corporate_status: company.corporate_status ?? "current",
    verification_date: company.verification_date ?? "",
    annual_report_year: company.annual_report_year?.toString() ?? "",
    registered_agent_name: company.registered_agent_name ?? "",
    registered_agent_email: (company as any).registered_agent_email ?? "",
    registered_agent_address: company.registered_agent_address ?? "",
    registered_agent_address_2: (company as any).registered_agent_address_2 ?? "",
    registered_agent_city: company.registered_agent_city ?? "",
    registered_agent_state: company.registered_agent_state ?? "",
    registered_agent_zip: company.registered_agent_zip ?? "",
    address: company.address ?? "",
    address_2: (company as any).address_2 ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    phone: company.phone ?? "",
    contact_full_name: (company as any).contact_full_name ?? "",
    contact_email: (company as any).contact_email ?? "",
    salutation_name: (company as any).salutation_name ?? "",
    contact_phone: (company as any).contact_phone ?? "",
    contact_cell: (company as any).contact_cell ?? "",
    contact_webpage: (company as any).contact_webpage ?? "",
    authorized_binders: (company as any).authorized_binders ?? "",
    business_purpose: company.business_purpose ?? "",
    naics_code: company.naics_code ?? "",
  });

  // Phone formatting helper
  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (field: string, value: string) => {
    update(field, formatPhone(value));
  };

  const formatWebpage = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };
  const [llcSElectionEnabled, setLlcSElectionEnabled] = useState(isLLCType(company.entity_type) ? !!company.s_election_date : false);

  // Reset form when company changes (e.g. navigating between entities)
  useEffect(() => {
    setForm({
      name: company.name,
      entity_type: company.entity_type,
      state_of_incorporation: company.state_of_incorporation ?? "",
      incorporation_date: company.incorporation_date ?? "",
      fiscal_year_end: company.fiscal_year_end ?? "",
      authorized_shares: company.authorized_shares?.toString() ?? "",
      par_value_type: company.par_value_type ?? "par",
      par_value: company.par_value?.toString() ?? "",
      s_election_date: company.s_election_date ?? "",
      scheduled_annual_meeting: company.scheduled_annual_meeting ?? "",
      election_1244: company.election_1244 ?? false,
      seal_type: company.seal_type ?? "no_seal",
      corporate_status: company.corporate_status ?? "current",
      verification_date: company.verification_date ?? "",
      annual_report_year: company.annual_report_year?.toString() ?? "",
      registered_agent_name: company.registered_agent_name ?? "",
      registered_agent_email: (company as any).registered_agent_email ?? "",
      registered_agent_address: company.registered_agent_address ?? "",
      registered_agent_address_2: (company as any).registered_agent_address_2 ?? "",
      registered_agent_city: company.registered_agent_city ?? "",
      registered_agent_state: company.registered_agent_state ?? "",
      registered_agent_zip: company.registered_agent_zip ?? "",
      address: company.address ?? "",
      address_2: (company as any).address_2 ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      zip: company.zip ?? "",
      phone: company.phone ?? "",
      contact_full_name: (company as any).contact_full_name ?? "",
      contact_email: (company as any).contact_email ?? "",
      salutation_name: (company as any).salutation_name ?? "",
      contact_phone: (company as any).contact_phone ?? "",
      contact_cell: (company as any).contact_cell ?? "",
      contact_webpage: (company as any).contact_webpage ?? "",
      authorized_binders: (company as any).authorized_binders ?? "",
      business_purpose: company.business_purpose ?? "",
      naics_code: company.naics_code ?? "",
    });
    setLlcSElectionEnabled(isLLCType(company.entity_type) ? !!company.s_election_date : false);
  }, [company.id]);


  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // For Select/Checkbox controls that don't reliably fire blur
  const updateAndSave = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // triggerSave is called after state settles (via useAutoSave debounce)
    setTimeout(() => incAutoSave.triggerSave(), 50);
  };
  const handleAgentZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, registered_agent_city: result.city, registered_agent_state: result.state }));
  }, []);

  const handleCompanyZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);

  const { handleZipChange: handleAgentZip, isLoading: agentZipLoading, zipError: agentZipError } = useZipLookup(handleAgentZipResult);
  const { handleZipChange: handleCompanyZip, isLoading: companyZipLoading, zipError: companyZipError } = useZipLookup(handleCompanyZipResult);

  // ─── Organizers ────────────────────────────────────────────────────────────
  const { data: organizers = [], refetch: refetchOrganizers } = useQuery({
    queryKey: ["organizers", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizers" as any)
        .select("*")
        .eq("company_id", company.id)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const [newOrganizer, setNewOrganizer] = useState({ organizer_name: "", address: "", address_2: "", city: "", state: "", zip: "" });
  const [showOrganizerForm, setShowOrganizerForm] = useState(false);

  const handleOrganizerZipResult = useCallback((result: { city: string; state: string }) => {
    setNewOrganizer(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange: handleOrganizerZip, zipError: organizerZipError } = useZipLookup(handleOrganizerZipResult);

  const addOrganizer = useMutation({
    mutationFn: async () => {
      if (!newOrganizer.organizer_name.trim()) throw new Error("Organizer name is required");
      const { error } = await supabase.from("organizers" as any).insert({
        company_id: company.id,
        organizer_name: newOrganizer.organizer_name.trim(),
        address: newOrganizer.address || null,
        address_2: newOrganizer.address_2 || null,
        city: newOrganizer.city || null,
        state: newOrganizer.state || null,
        zip: newOrganizer.zip || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOrganizers();
      setNewOrganizer({ organizer_name: "", address: "", address_2: "", city: "", state: "", zip: "" });
      setShowOrganizerForm(false);
      toast.success("Organizer added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteOrganizer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organizers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOrganizers();
      toast.success("Organizer removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Initial Directors ─────────────────────────────────────────────────────
  const { data: directors = [], refetch: refetchDirectors } = useQuery({
    queryKey: ["directors", company.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("*")
        .eq("company_id", company.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const [newDirector, setNewDirector] = useState({ name: "", address: "", address_2: "", city: "", state: "", zip: "" });
  const [showDirectorForm, setShowDirectorForm] = useState(false);

  const handleDirectorZipResult = useCallback((result: { city: string; state: string }) => {
    setNewDirector(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange: handleDirectorZip, zipError: directorZipError } = useZipLookup(handleDirectorZipResult);

  const addDirector = useMutation({
    mutationFn: async () => {
      if (!newDirector.name.trim()) throw new Error("Director name is required");
      const { error } = await supabase.from("directors").insert({
        company_id: company.id,
        name: newDirector.name.trim(),
        address: newDirector.address || null,
        address_2: newDirector.address_2 || null,
        city: newDirector.city || null,
        state: newDirector.state || null,
        zip: newDirector.zip || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDirectors();
      setNewDirector({ name: "", address: "", address_2: "", city: "", state: "", zip: "" });
      setShowDirectorForm(false);
      toast.success("Director added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteDirector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("directors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchDirectors();
      toast.success("Director removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Derive card config reactively from current entity_type
  const equityCard = getEquityCardConfig(form.entity_type);

  const applyWdfiResult = (result: any, verificationDate: string) => {
    update("corporate_status", result.mappedStatus);
    update("verification_date", verificationDate);
    if (result.annualReportYear) {
      update("annual_report_year", result.annualReportYear);
    } else if (result.mappedStatus === "current" && result.statusDate) {
      // Fallback to status date year if detail page scrape failed
      const year = result.statusDate.split("-")[0];
      if (year) update("annual_report_year", year);
    }
    toast.success(`WDFI Status: ${result.status} → ${result.mappedStatus}${result.entityId ? ` (ID: ${result.entityId})` : ""}`);
  };

  const handleVerifyWDFI = async () => {
    if (!form.name.trim()) {
      toast.error("Company name is required for WDFI verification");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("verify-wdfi-status", {
        body: { company_name: form.name },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || "WDFI verification failed");
        return;
      }
      if (!data.results || data.results.length === 0) {
        toast.warning("No matching entities found on WDFI for this company name.");
        return;
      }
      if (data.results.length === 1) {
        applyWdfiResult(data.results[0], data.verificationDate);
      } else {
        // Multiple results — show selection dialog
        setWdfiResults(data.results);
        setWdfiVerificationDate(data.verificationDate);
        setShowWdfiDialog(true);
      }
    } catch (err: any) {
      console.error("WDFI verification error:", err);
      toast.error(err.message || "Failed to verify with WDFI");
    } finally {
      setVerifying(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (isLLCType(form.entity_type) && llcSElectionEnabled && !form.s_election_date) {
        throw new Error("S Election Effective Date is required when LLC S Corporation tax status is enabled.");
      }

      const { error } = await supabase
        .from("companies")
        .update({
          name: form.name,
          entity_type: form.entity_type,
          state_of_incorporation: form.state_of_incorporation || null,
          incorporation_date: form.incorporation_date || null,
          fiscal_year_end: form.fiscal_year_end || null,
          authorized_shares: form.authorized_shares ? parseInt(form.authorized_shares) : null,
          par_value_type: form.par_value_type,
          par_value: form.par_value ? parseFloat(form.par_value) : null,
          s_election_date: isLLCType(form.entity_type)
            ? (llcSElectionEnabled ? (form.s_election_date || null) : null)
            : (form.s_election_date || null),
          scheduled_annual_meeting: form.scheduled_annual_meeting || null,
          election_1244: form.election_1244,
          seal_type: form.seal_type,
          corporate_status: form.corporate_status,
          verification_date: form.verification_date || null,
          annual_report_year: form.annual_report_year ? parseInt(form.annual_report_year) : null,
          registered_agent_name: form.registered_agent_name || null,
          registered_agent_email: form.registered_agent_email || null,
          registered_agent_address: form.registered_agent_address || null,
          registered_agent_address_2: form.registered_agent_address_2 || null,
          registered_agent_city: form.registered_agent_city || null,
          registered_agent_state: form.registered_agent_state || null,
          registered_agent_zip: form.registered_agent_zip || null,
          address: form.address || null,
          address_2: form.address_2 || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          phone: form.phone || null,
          contact_full_name: form.contact_full_name || null,
          contact_email: form.contact_email || null,
          salutation_name: form.salutation_name || null,
          contact_phone: form.contact_phone || null,
          contact_cell: form.contact_cell || null,
          contact_webpage: form.contact_webpage ? formatWebpage(form.contact_webpage) : null,
           authorized_binders: form.authorized_binders || null,
           business_purpose: form.business_purpose || null,
           naics_code: form.naics_code || null,
        } as any)
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", company.id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Auto-save using shared hook
  const incAutoSave = useAutoSave({
    data: form,
    onSave: async () => { await save.mutateAsync(); },
    enabled: !!company.id,
  });

  return (
    <div
      onBlur={incAutoSave.handleBlur}
      className="space-y-5"
    >
      {/* Corporate Status Verification - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-medium border-l-2 border-l-warning">
            <span className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-warning" />
              Verification of Corporate Status
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card className="border-l-2 border-l-warning">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px]">Always verify corporate status with the Secretary of State</CardDescription>
                <SectionPdfActions config={{
                  title: "Verification of Corporate Status",
                  companyName: company.name,
                  fields: [
                    { label: "Corporate Status", value: form.corporate_status },
                    { label: "Verification Date", value: form.verification_date ? new Date(form.verification_date + "T00:00:00").toLocaleDateString() : "" },
                    { label: "Annual Report Filed Year", value: form.annual_report_year },
                  ],
                }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                <div className="field-group col-span-4">
                  <Label className="field-label">Corporate Status</Label>
                  <Select value={form.corporate_status} onValueChange={(v) => updateAndSave("corporate_status", v)}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current</SelectItem>
                      <SelectItem value="delinquent">Delinquent</SelectItem>
                      <SelectItem value="admin_dissolved">Administratively Dissolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group col-span-4">
                  <Label className="field-label">Verification Date</Label>
                  <DatePickerField value={form.verification_date || ""} onChange={(v) => updateAndSave("verification_date", v)} className="h-7" />
                </div>
                <div className="field-group col-span-4">
                  <Label className="field-label">Annual Report Year</Label>
                  <Input type="number" className="h-7 text-sm" value={form.annual_report_year} onChange={(e) => update("annual_report_year", e.target.value)} placeholder="2024" />
                </div>
              </div>
              {form.state_of_incorporation && (() => {
                const sosInfo = STATE_SOS_INFO[form.state_of_incorporation];
                const isWI = form.state_of_incorporation === "WI";
                if (!sosInfo) return null;
                return (
                  <div className="flex gap-2">
                    {isWI && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={verifying}
                        onClick={handleVerifyWDFI}
                      >
                        {verifying ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Auto-Verify with {sosInfo.name}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        let url = sosInfo.url;
                        if (isWI && form.name) {
                          url = `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q=${encodeURIComponent(form.name)}`;
                        }
                        window.open(url, "_blank");
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {isWI ? "Open" : "Verify at"} {sosInfo.name}
                    </Button>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Company */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">{isLLCType(company.entity_type) ? "Organizational Info" : "Incorporation Info"}</CardTitle>
            </div>
            <SectionPdfActions config={{
              title: isLLCType(company.entity_type) ? "Organizational Info" : "Incorporation Info",
              companyName: company.name,
              fields: [
                { label: "Company Name", value: form.name },
                { label: "Entity Type", value: form.entity_type },
                { label: "State of Incorporation", value: form.state_of_incorporation },
                { label: "Incorporation Date", value: form.incorporation_date ? new Date(form.incorporation_date + "T00:00:00").toLocaleDateString() : "" },
                { label: "Fiscal Year End", value: form.fiscal_year_end },
                { label: "Scheduled Annual Meeting", value: form.scheduled_annual_meeting },
                { label: "Contact Name", value: form.contact_full_name },
                { label: "Salutation", value: form.salutation_name },
                { label: "Email", value: form.contact_email },
                { label: "Main Phone", value: form.contact_phone },
                { label: "Cell Phone", value: form.contact_cell },
                { label: "Webpage", value: form.contact_webpage },
                { label: "Address", value: [form.address, form.address_2].filter(Boolean).join(", ") },
                { label: "City / State / Zip", value: [form.city, form.state, form.zip].filter(Boolean).join(", ") },
                { label: "Business Purpose", value: form.business_purpose },
                { label: "NAICS Code", value: form.naics_code },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-5">
          {/* Company Details - compact grid */}
          <div className="grid grid-cols-12 gap-x-3 gap-y-2">
            <div className="field-group col-span-12 sm:col-span-5">
              <Label className="field-label">Company Name</Label>
              <Input className="h-7 text-sm" value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </div>
            <div className="field-group col-span-6 sm:col-span-3">
              <Label className="field-label">Entity Type</Label>
              <Select value={form.entity_type} onValueChange={(v) => updateAndSave("entity_type", v)}>
                <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="field-group col-span-6 sm:col-span-2">
              <Label className="field-label">State of Inc.</Label>
              <Select value={form.state_of_incorporation} onValueChange={(v) => updateAndSave("state_of_incorporation", v)}>
                <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="field-group col-span-6 sm:col-span-2">
              <Label className="field-label">Status</Label>
              <Select value={form.corporate_status} onValueChange={(v) => updateAndSave("corporate_status", v)}>
                <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="delinquent">Delinquent</SelectItem>
                  <SelectItem value="admin_dissolved">Administratively Dissolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="field-group col-span-6 sm:col-span-3">
              <Label className="field-label">Incorporation Date</Label>
              <DatePickerField value={form.incorporation_date || ""} onChange={(v) => updateAndSave("incorporation_date", v)} className="h-7" />
            </div>
            <div className="field-group col-span-6 sm:col-span-3">
              <Label className="field-label">Fiscal Year End</Label>
              <Input className="h-7 text-sm" value={form.fiscal_year_end} onChange={(e) => update("fiscal_year_end", e.target.value)} placeholder="December 31" />
            </div>
            <div className="field-group col-span-6 sm:col-span-3">
              <Label className="field-label">Sched. Annual Mtg Date</Label>
              <Input className="h-7 text-sm" value={form.scheduled_annual_meeting} onChange={(e) => update("scheduled_annual_meeting", e.target.value)} placeholder="1st Monday in April" />
            </div>
            <div className="field-group col-span-12 sm:col-span-10">
              <Label className="field-label">Business Purpose</Label>
              <Textarea className="text-sm min-h-[50px]" value={form.business_purpose} onChange={(e) => update("business_purpose", e.target.value)} placeholder="Describe the business purpose..." rows={2} />
            </div>
            <div className="field-group col-span-6 sm:col-span-2">
              <Label className="field-label flex items-center gap-1">
                NAICS
                <a href="https://www.naics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Label>
              <Input className="h-7 text-sm" value={form.naics_code} onChange={(e) => update("naics_code", e.target.value)} placeholder="Code" />
            </div>
          </div>

          {/* Primary Contact - compact */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Primary Contact</h3>
            </div>
            <div className="grid grid-cols-12 gap-x-3 gap-y-2">
              <div className="field-group col-span-12 sm:col-span-5">
                <Label className="field-label">Full Name</Label>
                <Input className="h-7 text-sm" value={form.contact_full_name} onChange={(e) => update("contact_full_name", e.target.value)} placeholder="First and Last Name" />
              </div>
              <div className="field-group col-span-6 sm:col-span-2">
                <Label className="field-label">Salutation</Label>
                <Input className="h-7 text-sm" value={form.salutation_name} onChange={(e) => update("salutation_name", e.target.value)} placeholder='"John"' />
              </div>
              <div className="field-group col-span-12 sm:col-span-5">
                <Label className="field-label">Email</Label>
                <Input className="h-7 text-sm" type="email" value={form.contact_email} onChange={(e) => update("contact_email", e.target.value)} placeholder="client@example.com" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label flex items-center gap-1"><Phone className="h-3 w-3" /> Main Phone</Label>
                <Input className="h-7 text-sm" value={form.contact_phone} onChange={(e) => handlePhoneChange("contact_phone", e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label flex items-center gap-1"><Phone className="h-3 w-3" /> Cell Phone</Label>
                <Input className="h-7 text-sm" value={form.contact_cell} onChange={(e) => handlePhoneChange("contact_cell", e.target.value)} placeholder="(555) 555-5555" />
              </div>
              <div className="field-group col-span-12 sm:col-span-6">
                <Label className="field-label flex items-center gap-1"><Globe className="h-3 w-3" /> Webpage</Label>
                <div className="flex items-center gap-2">
                  <Input className="h-7 text-sm" type="url" value={form.contact_webpage} onChange={(e) => update("contact_webpage", e.target.value)} placeholder="www.example.com" onBlur={(e) => { if (e.target.value) update("contact_webpage", formatWebpage(e.target.value)); }} />
                  {form.contact_webpage && (
                    <a href={formatWebpage(form.contact_webpage)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline shrink-0 inline-flex items-center gap-0.5">
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Company Address - compact */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Company Address</h3>
            </div>
            <div className="grid grid-cols-12 gap-x-3 gap-y-2">
              <div className="field-group col-span-12 sm:col-span-4">
                <Label className="field-label">Address Line 1</Label>
                <Input className="h-7 text-sm" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Street address" />
              </div>
              <div className="field-group col-span-12 sm:col-span-2">
                <Label className="field-label">Address Line 2</Label>
                <Input className="h-7 text-sm" value={form.address_2} onChange={(e) => update("address_2", e.target.value)} placeholder="Suite, Unit, Floor" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">City</Label>
                <Input className="h-7 text-sm" value={form.city} onChange={(e) => update("city", e.target.value)} />
              </div>
              <div className="field-group col-span-3 sm:col-span-1">
                <Label className="field-label">State</Label>
                <Select value={form.state} onValueChange={(v) => updateAndSave("state", v)}>
                  <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group col-span-3 sm:col-span-2">
                <Label className="field-label">Zip</Label>
                <Input className="h-7 text-sm" value={form.zip} onChange={(e) => { const v = e.target.value.replace(/[^\d-]/g, "").slice(0, 10); update("zip", v); handleCompanyZip(v); }} placeholder="55555" />
                {companyZipError && <p className="text-[10px] text-destructive mt-0.5">{companyZipError}</p>}
              </div>
            </div>
          </div>

          {/* Organizers */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Organizer(s)</h3>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowOrganizerForm(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add Organizer
              </Button>
            </div>

            {organizers.length === 0 && !showOrganizerForm && (
              <p className="text-sm text-muted-foreground text-center py-3">No organizers added yet.</p>
            )}

            {organizers.map((org: any) => (
              <div key={org.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
                <div className="flex-1 text-sm">
                  <span className="font-medium">{org.organizer_name}</span>
                  {(org.address || org.city) && (
                    <span className="text-muted-foreground ml-2">
                      — {[org.address, org.address_2, org.city, org.state, org.zip].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteOrganizer.mutate(org.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {showOrganizerForm && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                  <div className="field-group col-span-3">
                    <Label className="field-label">Organizer Name</Label>
                    <Input className="h-7 text-sm" value={newOrganizer.organizer_name} onChange={(e) => setNewOrganizer(p => ({ ...p, organizer_name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div className="field-group col-span-3">
                    <Label className="field-label">Address</Label>
                    <Input className="h-7 text-sm" value={newOrganizer.address} onChange={(e) => setNewOrganizer(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-2">
                    <Label className="field-label">Address 2</Label>
                    <Input className="h-7 text-sm" value={newOrganizer.address_2} onChange={(e) => setNewOrganizer(p => ({ ...p, address_2: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-2">
                    <Label className="field-label">City</Label>
                    <Input className="h-7 text-sm" value={newOrganizer.city} onChange={(e) => setNewOrganizer(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-1">
                    <Label className="field-label">State</Label>
                    <Select value={newOrganizer.state} onValueChange={(v) => setNewOrganizer(p => ({ ...p, state: v }))}>
                      <SelectTrigger className="h-7 text-sm min-w-[60px] px-2"><SelectValue placeholder="ST" /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field-group col-span-1">
                    <Label className="field-label">Zip</Label>
                    <Input className="h-7 text-sm" value={newOrganizer.zip} onChange={(e) => { const v = e.target.value; setNewOrganizer(p => ({ ...p, zip: v })); handleOrganizerZip(v); }} maxLength={10} />
                    {organizerZipError && <p className="text-[10px] text-destructive mt-0.5">{organizerZipError}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowOrganizerForm(false); setNewOrganizer({ organizer_name: "", address: "", address_2: "", city: "", state: "", zip: "" }); }}>Cancel</Button>
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={() => addOrganizer.mutate()} disabled={addOrganizer.isPending}>
                    {addOrganizer.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Initial Directors / Initial Members (LLC) */}
          {/* LLC FORM RULES: Members not Directors. Section renamed to Management & Elections. Management Type dropdown: Member Managed / Manager Managed. No share/par value fields. Keep: S-Election, Seal. DO NOT REVERT. */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  {isLLCType(form.entity_type) ? "Initial Member(s)" : "Initial Director(s)"}
                </h3>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowDirectorForm(true)}>
                <Plus className="h-3 w-3 mr-1" /> {isLLCType(form.entity_type) ? "Add Member" : "Add Director"}
              </Button>
            </div>

            {directors.length === 0 && !showDirectorForm && (
              <p className="text-sm text-muted-foreground text-center py-3">
                {isLLCType(form.entity_type) ? "No initial members added yet." : "No initial directors added yet."}
              </p>
            )}

            {directors.map((dir) => (
              <div key={dir.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
                <div className="flex-1 text-sm">
                  <span className="font-medium">{dir.name}</span>
                  {(dir.address || dir.city) && (
                    <span className="text-muted-foreground ml-2">
                      — {[dir.address, dir.address_2, dir.city, dir.state, dir.zip].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteDirector.mutate(dir.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {showDirectorForm && (
              <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                  <div className="field-group col-span-3">
                    <Label className="field-label">{isLLCType(form.entity_type) ? "Member Name" : "Director Name"}</Label>
                    <Input className="h-7 text-sm" value={newDirector.name} onChange={(e) => setNewDirector(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
                  </div>
                  <div className="field-group col-span-3">
                    <Label className="field-label">Address</Label>
                    <Input className="h-7 text-sm" value={newDirector.address} onChange={(e) => setNewDirector(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-2">
                    <Label className="field-label">Address 2</Label>
                    <Input className="h-7 text-sm" value={newDirector.address_2} onChange={(e) => setNewDirector(p => ({ ...p, address_2: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-2">
                    <Label className="field-label">City</Label>
                    <Input className="h-7 text-sm" value={newDirector.city} onChange={(e) => setNewDirector(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-1">
                    <Label className="field-label">State</Label>
                    <Select value={newDirector.state} onValueChange={(v) => setNewDirector(p => ({ ...p, state: v }))}>
                      <SelectTrigger className="h-7 text-sm min-w-[60px] px-2"><SelectValue placeholder="ST" /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field-group col-span-1">
                    <Label className="field-label">Zip</Label>
                    <Input className="h-7 text-sm" value={newDirector.zip} onChange={(e) => { const v = e.target.value; setNewDirector(p => ({ ...p, zip: v })); handleDirectorZip(v); }} maxLength={10} />
                    {directorZipError && <p className="text-[10px] text-destructive mt-0.5">{directorZipError}</p>}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowDirectorForm(false); setNewDirector({ name: "", address: "", address_2: "", city: "", state: "", zip: "" }); }}>Cancel</Button>
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={() => addDirector.mutate()} disabled={addDirector.isPending}>
                    {addDirector.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Dynamic Equity / Governance Card ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {equityCard.icon}
              <CardTitle className="card-section-title">{equityCard.title}</CardTitle>
            </div>
            <SectionPdfActions config={{
              title: equityCard.title,
              companyName: company.name,
              fields: [
                ...(equityCard.showAuthorizedShares || equityCard.showMembershipUnits || equityCard.showPartnershipInterest
                  ? [{ label: equityCard.authorizedLabel, value: form.authorized_shares }]
                  : []),
                ...(equityCard.showParValue ? [
                  { label: "Par Value Type", value: form.par_value_type === "par" ? "Par Value" : "No Par Value" },
                  { label: "Par Value ($)", value: form.par_value },
                ] : []),
                ...(equityCard.showSElection ? [{ label: "S-Election Date", value: form.s_election_date ? new Date(form.s_election_date + "T00:00:00").toLocaleDateString() : "" }] : []),
                ...(equityCard.showSeal ? [{ label: "Seal", value: form.seal_type === "seal" ? "Seal" : "No Seal" }] : []),
                ...(equityCard.show1244 ? [{ label: "Section 1244 Election", value: form.election_1244 ? "Yes" : "No" }] : []),
              ],
            }} />
          </div>
          {equityCard.description && (
            <CardDescription className="text-[11px] mt-0.5">{equityCard.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">

            {/* LLC: Management Type — DO NOT add share/par value fields here. See LLC FORM RULES comment above. */}
            {equityCard.showManagementType && (
              <div className="field-group">
                <Label className="field-label">Management Type</Label>
                <Select defaultValue="member_managed">
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member_managed">Member Managed</SelectItem>
                    <SelectItem value="manager_managed">Manager Managed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Partnership: Partnership Interest */}
            {equityCard.showPartnershipInterest && (
              <>
                <div className="field-group">
                  <Label className="field-label">Total Partnership Units</Label>
                  <Input type="number" className="h-8 text-sm" value={form.authorized_shares} onChange={(e) => update("authorized_shares", e.target.value)} placeholder="e.g. 100" />
                </div>
                <div className="field-group">
                  <Label className="field-label">Partnership Type</Label>
                  <Select defaultValue="general">
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Partnership</SelectItem>
                      <SelectItem value="limited">Limited Partnership (LP)</SelectItem>
                      <SelectItem value="llp">Limited Liability Partnership (LLP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Corporation / S-Corp: Authorized Shares */}
            {equityCard.showAuthorizedShares && (
              <div className="field-group">
                <Label className="field-label">Authorized Shares</Label>
                <Input type="number" className="h-8 text-sm" value={form.authorized_shares} onChange={(e) => update("authorized_shares", e.target.value)} />
              </div>
            )}

            {/* Par Value — Corporation & S-Corp only */}
            {equityCard.showParValue && (
              <>
                <div className="field-group">
                  <Label className="field-label">Par Value Type</Label>
                  <Select value={form.par_value_type} onValueChange={(v) => updateAndSave("par_value_type", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="par">Par Value</SelectItem>
                      <SelectItem value="no_par">No Par Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.par_value_type === "par" && (
                  <div className="field-group">
                    <Label className="field-label">Par Value ($)</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={form.par_value} onChange={(e) => update("par_value", e.target.value)} />
                  </div>
                )}
              </>
            )}

            {/* S-election controls */}
            {equityCard.showSElection && !isLLCType(form.entity_type) && (
              <div className="field-group">
                <Label className="field-label">S-Election Date</Label>
                <DatePickerField value={form.s_election_date || ""} onChange={(v) => updateAndSave("s_election_date", v)} />
              </div>
            )}
            {equityCard.showSElection && isLLCType(form.entity_type) && (
              <div className="col-span-full mt-1 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="s_election_llc_incorp"
                    checked={llcSElectionEnabled}
                    onCheckedChange={(checked) => {
                      const enabled = !!checked;
                      setLlcSElectionEnabled(enabled);
                      if (!enabled) updateAndSave("s_election_date", "");
                    }}
                  />
                  <div className="flex-1">
                    <Label htmlFor="s_election_llc_incorp" className="cursor-pointer text-sm font-medium">Is this LLC electing S Corporation tax status?</Label>
                    <p className="text-[11px] text-muted-foreground">When enabled, set the effective date below.</p>
                    {llcSElectionEnabled && (
                      <div className="mt-2 max-w-xs">
                        <Label className="field-label">S Election Effective Date</Label>
                        <DatePickerField value={form.s_election_date || ""} onChange={(v) => updateAndSave("s_election_date", v)} />
                        {!form.s_election_date && (
                          <p className="mt-1 text-[11px] text-destructive">S Election Effective Date is required when enabled.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Seal — all except Partnership */}
            {equityCard.showSeal && (
              <div className="field-group">
                <Label className="field-label">Seal</Label>
                <Select value={form.seal_type} onValueChange={(v) => updateAndSave("seal_type", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seal">Seal</SelectItem>
                    <SelectItem value="no_seal">No Seal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

          </div>

          {/* Section 1244 — Corporation & S-Corp only */}
          {equityCard.show1244 && (
            <div className="mt-3 flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <Checkbox
                id="election_1244"
                checked={form.election_1244}
                onCheckedChange={(v) => updateAndSave("election_1244", !!v)}
              />
              <div>
                <Label htmlFor="election_1244" className="cursor-pointer text-sm font-medium">Section 1244 Election</Label>
                <p className="text-[11px] text-muted-foreground">A loss on Section 1244 stock is treated as an ordinary loss</p>
              </div>
            </div>
          )}

          {/* S Corporation Tax Status — Corporation only (S-Corp & LLC have it elsewhere) */}
          {form.entity_type === "Corporation" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <Checkbox
                id="s_election_corp"
                checked={!!form.s_election_date}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    updateAndSave("s_election_date", "");
                  }
                }}
              />
              <div className="flex-1">
                <Label htmlFor="s_election_corp" className="cursor-pointer text-sm font-medium">Is the corporation electing S Corporation tax status?</Label>
                <p className="text-[11px] text-muted-foreground">Check if this corporation is making an S Corporation election with the IRS</p>
                {!!form.s_election_date && (
                  <div className="mt-2 field-group max-w-xs">
                    <Label className="field-label">Date of S Election</Label>
                    <DatePickerField value={form.s_election_date} onChange={(v) => updateAndSave("s_election_date", v)} />
                  </div>
                )}
                {!form.s_election_date && (
                  <div className="mt-2 field-group max-w-xs">
                    <Label className="field-label">Date of S Election</Label>
                    <DatePickerField value="" onChange={(v) => updateAndSave("s_election_date", v)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LLC: Membership Interest note */}
          {equityCard.showMembershipUnits && (
            <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                LLC members hold <strong>Membership Interest</strong> — not shares. Interest is expressed as units or percentage of ownership as defined in the Operating Agreement.
              </p>
            </div>
          )}

          {/* LLC: Authorized Binders */}
          {equityCard.showMembershipUnits && (
            <div className="mt-3 field-group">
              <Label className="field-label">Authorized Binders (Wis. Stat. § 183.0301)</Label>
              <Input className="h-8 text-sm" placeholder="Names of persons authorized to bind the LLC" value={form.authorized_binders} onChange={(e) => update("authorized_binders", e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-0.5">Persons authorized to bind the LLC per the Operating Agreement</p>
            </div>
          )}

          {/* Non-Profit: No equity note */}
          {form.entity_type === "Non-Profit" && (
            <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">
                Non-profit organizations do not issue shares or membership interests. Governance is managed through the Board of Directors and organizational bylaws.
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Registered Agent */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <CardTitle className="card-section-title">Registered Agent</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Statutory agent on file with the Secretary of State</CardDescription>
            </div>
            <SectionPdfActions config={{
              title: "Registered Agent",
              companyName: company.name,
              fields: [
                { label: "Agent Name", value: form.registered_agent_name },
                { label: "Email", value: form.registered_agent_email },
                { label: "Address", value: form.registered_agent_address },
                { label: "Address 2", value: form.registered_agent_address_2 },
                { label: "City", value: form.registered_agent_city },
                { label: "State", value: form.registered_agent_state },
                { label: "Zip", value: form.registered_agent_zip },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-12 gap-x-3 gap-y-2">
            <div className="field-group col-span-12 sm:col-span-5">
              <Label className="field-label">Agent Name</Label>
              <Input className="h-7 text-sm" value={form.registered_agent_name} onChange={(e) => update("registered_agent_name", e.target.value)} />
            </div>
            <div className="field-group col-span-12 sm:col-span-5">
              <Label className="field-label">Email Address</Label>
              <Input type="email" className="h-7 text-sm" value={form.registered_agent_email} onChange={(e) => update("registered_agent_email", e.target.value)} />
            </div>
            <div className="field-group col-span-12 sm:col-span-2" />
          </div>
          <div className="grid grid-cols-12 gap-x-2 gap-y-2 mt-2">
            <div className="field-group col-span-3">
              <Label className="field-label">Address</Label>
              <Input className="h-7 text-sm" value={form.registered_agent_address} onChange={(e) => update("registered_agent_address", e.target.value)} />
            </div>
            <div className="field-group col-span-3">
              <Label className="field-label">Address 2</Label>
              <Input className="h-7 text-sm" value={form.registered_agent_address_2} onChange={(e) => update("registered_agent_address_2", e.target.value)} placeholder="Suite, Unit, Floor" />
            </div>
            <div className="field-group col-span-2">
              <Label className="field-label">City</Label>
              <Input className="h-7 text-sm" value={form.registered_agent_city} onChange={(e) => update("registered_agent_city", e.target.value)} />
            </div>
            <div className="field-group col-span-2">
              <Label className="field-label">State</Label>
              <Select value={form.registered_agent_state} onValueChange={(v) => updateAndSave("registered_agent_state", v)}>
                <SelectTrigger className="h-7 text-sm min-w-[60px] px-2"><SelectValue placeholder="ST" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="field-group col-span-2">
              <Label className="field-label">Zip</Label>
              <Input className="h-7 text-sm" value={form.registered_agent_zip} onChange={(e) => { update("registered_agent_zip", e.target.value); handleAgentZip(e.target.value); }} />
              {agentZipError && <p className="text-[10px] text-destructive mt-0.5">{agentZipError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* WI Compliance Checklist - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-warning" />
              Records Compliance Checklist
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <WIComplianceChecklist company={company} />
        </CollapsibleContent>
      </Collapsible>

      {/* Auto-save Status Indicator */}
      <div className="sticky bottom-3 flex justify-end">
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-fade-in">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1.5 text-xs text-success animate-fade-in">
            <Check className="h-3 w-3" /> All changes saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="flex items-center gap-1.5 text-xs text-destructive animate-fade-in">
            <AlertTriangle className="h-3 w-3" /> Failed to save — please try again
          </span>
        )}
      </div>
      {/* WDFI Entity Selection Dialog */}
      <Dialog open={showWdfiDialog} onOpenChange={setShowWdfiDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Entity</DialogTitle>
            <DialogDescription>Multiple entities matched "{form.name}". Select the correct one:</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {wdfiResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                className="w-full text-left p-3 rounded-md border hover:bg-accent transition-colors"
                onClick={() => {
                  applyWdfiResult(result, wdfiVerificationDate);
                  setShowWdfiDialog(false);
                }}
              >
                <div className="font-medium text-sm">{result.entityName}</div>
                <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                  {result.entityId && <span>ID: {result.entityId}</span>}
                  {result.type && <span>{result.type}</span>}
                  <span className={cn(
                    "font-medium",
                    result.mappedStatus === "current" && "text-green-600",
                    result.mappedStatus === "delinquent" && "text-yellow-600",
                    result.mappedStatus === "admin_dissolved" && "text-red-600",
                  )}>
                    {result.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
