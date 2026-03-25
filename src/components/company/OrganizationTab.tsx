import { useState, useEffect, useCallback } from "react";
import { isLLCType } from "@/lib/entity-terminology";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Loader2, Save, Users, FileText, ChevronDown, ExternalLink, Shield, History, Building2, User, Phone, Globe } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useZipLookup } from "@/hooks/useZipLookup";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

// Entity-type-specific officer field labels
function getOfficerFields(entityType: string) {
  switch (entityType) {
    case "LLC":
    case "LLC-S":
    case "Single Member LLC":
      return [
        { key: "president", label: "Managing Member / Manager", placeholder: "Name" },
        { key: "vice_president", label: "Assistant Manager", placeholder: "Name" },
        { key: "secretary", label: "Secretary / Organizer", placeholder: "Name" },
        { key: "treasurer", label: "Treasurer / Financial Manager", placeholder: "Name" },
      ];
    case "Non-Profit":
      return [
        { key: "president", label: "President / Chair", placeholder: "Name" },
        { key: "vice_president", label: "Vice President / Vice Chair", placeholder: "Name" },
        { key: "secretary", label: "Secretary", placeholder: "Name" },
        { key: "treasurer", label: "Treasurer", placeholder: "Name" },
      ];
    case "Partnership":
      return [
        { key: "president", label: "Managing Partner / General Partner", placeholder: "Name" },
        { key: "vice_president", label: "Partner", placeholder: "Name" },
        { key: "secretary", label: "Secretary (if applicable)", placeholder: "Name" },
        { key: "treasurer", label: "Treasurer / Financial Partner", placeholder: "Name" },
      ];
    case "S-Corp":
      return [
        { key: "president", label: "President / CEO", placeholder: "Name" },
        { key: "vice_president", label: "Vice President", placeholder: "Name" },
        { key: "secretary", label: "Secretary", placeholder: "Name" },
        { key: "treasurer", label: "Treasurer / CFO", placeholder: "Name" },
      ];
    case "Corporation":
    default:
      return [
        { key: "president", label: "President / CEO", placeholder: "Name" },
        { key: "vice_president", label: "Vice President", placeholder: "Name" },
        { key: "secretary", label: "Secretary", placeholder: "Name" },
        { key: "treasurer", label: "Treasurer / CFO", placeholder: "Name" },
      ];
  }
}

// Entity-type-specific officer title dropdown options for meeting officers
export const OFFICER_TITLE_OPTIONS: Record<string, string[]> = {
  Corporation: [
    "President", "CEO", "Vice President", "Secretary", "Treasurer", "Secretary/Treasurer", "CFO",
    "COO", "CTO", "Assistant Secretary", "Assistant Treasurer",
    "Executive Vice President", "Senior Vice President",
  ],
  "S-Corp": [
    "President", "CEO", "Vice President", "Secretary", "Treasurer", "Secretary/Treasurer", "CFO",
    "COO", "CTO", "Assistant Secretary", "Assistant Treasurer",
    "Executive Vice President", "Senior Vice President",
  ],
  LLC: [
    "Managing Member", "Manager", "Assistant Manager", "Secretary",
    "Treasurer", "Secretary/Treasurer", "Financial Manager", "Organizer", "Member-Manager",
    "Chief Manager", "Operations Manager",
  ],
  "Single Member LLC": [
    "Managing Member", "Manager", "Assistant Manager", "Secretary",
    "Treasurer", "Secretary/Treasurer", "Financial Manager", "Organizer", "Member-Manager",
    "Chief Manager", "Operations Manager",
  ],
  "LLC-S": [
    "Managing Member", "Manager", "Assistant Manager", "Secretary",
    "Treasurer", "Secretary/Treasurer", "Financial Manager", "Organizer", "Member-Manager",
    "Chief Manager", "Operations Manager",
  ],
  "Non-Profit": [
    "President", "Chair", "Vice President", "Vice Chair", "Secretary",
    "Treasurer", "Secretary/Treasurer", "Executive Director", "Assistant Secretary",
    "Assistant Treasurer", "Board Chair", "Board Vice Chair",
  ],
  Partnership: [
    "Managing Partner", "General Partner", "Limited Partner", "Senior Partner",
    "Partner", "Secretary", "Treasurer", "Secretary/Treasurer", "Financial Partner",
    "Administrative Partner", "Founding Partner",
  ],
};

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
  ME: { name: "ME Secretary of State", url: "https://icrs.informe.org/nei-sos-icrs/ICRS?MainPage=x" },
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
  NJ: { name: "NJ DORES", url: "https://www.njportal.com/DOR/BusinessNameSearch" },
  NM: { name: "NM Secretary of State", url: "https://portal.sos.state.nm.us/BFS/online/CorporationBusinessSearch" },
  NY: { name: "NY Dept. of State", url: "https://apps.dos.ny.gov/publicInquiry/" },
  NC: { name: "NC Secretary of State", url: "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration" },
  ND: { name: "ND Secretary of State", url: "https://firststop.sos.nd.gov/search/business" },
  OH: { name: "OH Secretary of State", url: "https://businesssearch.ohiosos.gov/" },
  OK: { name: "OK Secretary of State", url: "https://www.sos.ok.gov/corp/corpInquiryFind.aspx" },
  OR: { name: "OR Secretary of State", url: "http://egov.sos.state.or.us/br/pkg_web_name_srch_inq.login" },
  PA: { name: "PA Dept. of State", url: "https://www.corporations.pa.gov/search/corpsearch" },
  RI: { name: "RI Secretary of State", url: "http://business.sos.ri.gov/CorpWeb/CorpSearch/CorpSearch.aspx" },
  SC: { name: "SC Secretary of State", url: "https://businessfilings.sc.gov/BusinessFiling/Entity/Search" },
  SD: { name: "SD Secretary of State", url: "https://sosenterprise.sd.gov/BusinessServices/Business/FilingSearch.aspx" },
  TN: { name: "TN Secretary of State", url: "https://tnbear.tn.gov/ECommerce/FilingSearch.aspx" },
  TX: { name: "TX Secretary of State", url: "https://mycpa.cpa.state.tx.us/coa/" },
  UT: { name: "UT Dept. of Commerce", url: "https://secure.utah.gov/bes/" },
  VT: { name: "VT Secretary of State", url: "https://bizfilings.vermont.gov/online/BusinessInquire" },
  VA: { name: "VA SCC", url: "https://cis.scc.virginia.gov/EntitySearch/Index" },
  WA: { name: "WA Secretary of State", url: "https://ccfs.sos.wa.gov/" },
  WV: { name: "WV Secretary of State", url: "https://apps.wv.gov/SOS/BusinessEntity/" },
  WI: { name: "WI DFI", url: "https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx" },
  WY: { name: "WY Secretary of State", url: "https://wyobiz.wyo.gov/Business/FilingSearch.aspx" },
  DC: { name: "DC DCRA", url: "https://corponline.dcra.dc.gov/BizEntity.aspx" },
};


interface Props {
  companyId: string;
  company: Tables<"companies">;
}

export default function OrganizationTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const isLLC = isLLCType(company.entity_type);

  // --- Registered Agent (LLC only) ---
  const [raForm, setRaForm] = useState({
    registered_agent_name: (company as any).registered_agent_name ?? "",
    registered_agent_type: (company as any).registered_agent_type ?? "",
    registered_agent_address: (company as any).registered_agent_address ?? "",
    registered_agent_address_2: (company as any).registered_agent_address_2 ?? "",
    registered_agent_city: (company as any).registered_agent_city ?? "",
    registered_agent_state: (company as any).registered_agent_state ?? (company as any).state_of_incorporation ?? "",
    registered_agent_zip: (company as any).registered_agent_zip ?? "",
    registered_agent_phone: (company as any).registered_agent_phone ?? "",
    registered_agent_email: (company as any).registered_agent_email ?? "",
    registered_agent_appointed_date: (company as any).registered_agent_appointed_date ?? "",
    registered_agent_resigned_date: (company as any).registered_agent_resigned_date ?? "",
  });

  useEffect(() => {
    setRaForm({
      registered_agent_name: (company as any).registered_agent_name ?? "",
      registered_agent_type: (company as any).registered_agent_type ?? "",
      registered_agent_address: (company as any).registered_agent_address ?? "",
      registered_agent_address_2: (company as any).registered_agent_address_2 ?? "",
      registered_agent_city: (company as any).registered_agent_city ?? "",
      registered_agent_state: (company as any).registered_agent_state ?? (company as any).state_of_incorporation ?? "",
      registered_agent_zip: (company as any).registered_agent_zip ?? "",
      registered_agent_phone: (company as any).registered_agent_phone ?? "",
      registered_agent_email: (company as any).registered_agent_email ?? "",
      registered_agent_appointed_date: (company as any).registered_agent_appointed_date ?? "",
      registered_agent_resigned_date: (company as any).registered_agent_resigned_date ?? "",
    });
  }, [company.id]);

  const handleRaZipResult = useCallback((result: { city: string; state: string }) => {
    setRaForm(prev => ({ ...prev, registered_agent_city: result.city, registered_agent_state: result.state }));
  }, []);
  const { handleZipChange: handleRaZip, zipError: raZipError } = useZipLookup(handleRaZipResult);

  // Fetch history
  const { data: raHistory = [] } = useQuery({
    queryKey: ["registered-agent-history", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registered_agent_history" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: isLLC,
  });

  const [showRaHistory, setShowRaHistory] = useState(false);

  const saveRegisteredAgent = useMutation({
    mutationFn: async () => {
      if (!raForm.registered_agent_name.trim()) throw new Error("Registered Agent Name is required.");
      if (!raForm.registered_agent_address.trim()) throw new Error("Registered Agent Address is required.");
      if (!raForm.registered_agent_state) throw new Error("Registered Agent State is required.");
      if (!raForm.registered_agent_zip.trim()) throw new Error("Registered Agent Zip is required.");

      // If agent name changed and there was a previous agent, archive to history
      const prevName = (company as any).registered_agent_name;
      if (prevName && prevName.trim() && prevName.trim() !== raForm.registered_agent_name.trim()) {
        await supabase.from("registered_agent_history" as any).insert({
          company_id: companyId,
          agent_name: prevName,
          agent_type: (company as any).registered_agent_type || null,
          address: (company as any).registered_agent_address || null,
          address_2: (company as any).registered_agent_address_2 || null,
          city: (company as any).registered_agent_city || null,
          state: (company as any).registered_agent_state || null,
          zip: (company as any).registered_agent_zip || null,
          phone: (company as any).registered_agent_phone || null,
          email: (company as any).registered_agent_email || null,
          appointed_date: (company as any).registered_agent_appointed_date || null,
          resigned_date: raForm.registered_agent_resigned_date || new Date().toISOString().split("T")[0],
        });
      }

      const { error } = await supabase
        .from("companies")
        .update({
          registered_agent_name: raForm.registered_agent_name || null,
          registered_agent_type: raForm.registered_agent_type || null,
          registered_agent_address: raForm.registered_agent_address || null,
          registered_agent_address_2: raForm.registered_agent_address_2 || null,
          registered_agent_city: raForm.registered_agent_city || null,
          registered_agent_state: raForm.registered_agent_state || null,
          registered_agent_zip: raForm.registered_agent_zip || null,
          registered_agent_phone: raForm.registered_agent_phone || null,
          registered_agent_email: raForm.registered_agent_email || null,
          registered_agent_appointed_date: raForm.registered_agent_appointed_date || null,
          registered_agent_resigned_date: raForm.registered_agent_resigned_date || null,
        } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["registered-agent-history", companyId] });
      toast.success("Registered Agent saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Filing details form
  const [filingForm, setFilingForm] = useState({
    name: company.name,
    entity_type: company.entity_type,
    state_of_incorporation: company.state_of_incorporation ?? "",
    incorporation_date: company.incorporation_date ?? "",
    fiscal_year_end: company.fiscal_year_end ?? "",
    scheduled_annual_meeting: company.scheduled_annual_meeting ?? "",
    corporate_status: company.corporate_status ?? "current",
    verification_date: (company as any).verification_date ?? "",
    annual_report_year: (company as any).annual_report_year?.toString() ?? "",
    second_name_choice: company.second_name_choice ?? "",
    filing_date: company.filing_date ?? "",
    delayed_effective_filing_date: company.delayed_effective_filing_date ?? "",
    business_purpose: company.business_purpose ?? "",
    accounting_method: company.accounting_method ?? "cash basis",
    naics_code: company.naics_code ?? "",
    first_year_annual_meeting: company.first_year_annual_meeting?.toString() ?? "",
    initial_directors_count: company.initial_directors_count?.toString() ?? "",
    max_directors_allowed: company.max_directors_allowed?.toString() ?? "",
    max_vps_allowed: company.max_vps_allowed?.toString() ?? "",
    additional_provisions: company.additional_provisions ?? "",
    s_election_date: company.s_election_date ?? "",
    address: company.address ?? "",
    address_2: company.address_2 ?? "",
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
    management_type: (company as any).management_type ?? "",
  });

  const { handleZipChange: handleFilingZipChange, zipError: filingZipError } = useZipLookup(({ city, state }) => {
    setFilingForm((p) => ({ ...p, city, state }));
  });
  // ─── Organizers ────────────────────────────────────────────────────────────
  const { data: organizers = [], refetch: refetchOrganizers } = useQuery({
    queryKey: ["organizers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizers" as any)
        .select("*")
        .eq("company_id", companyId)
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
        company_id: companyId,
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

  const [llcSElectionEnabled, setLlcSElectionEnabled] = useState(!!company.s_election_date);

  // Phone formatting helper
  const formatPhone = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (field: string, value: string) => {
    setFilingForm((p) => ({ ...p, [field]: formatPhone(value) }));
  };

  const formatWebpage = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  useEffect(() => {
    setLlcSElectionEnabled(!!company.s_election_date);
    setFilingForm((prev) => ({ ...prev, s_election_date: company.s_election_date ?? "" }));
  }, [company.id, company.s_election_date]);

  const saveFiling = useMutation({
    mutationFn: async () => {
      if (isLLCType(company.entity_type) && llcSElectionEnabled && !filingForm.s_election_date) {
        throw new Error("S Election Effective Date is required when LLC S Corporation tax status is enabled.");
      }

      const { error } = await supabase
        .from("companies")
        .update({
          name: filingForm.name,
          entity_type: filingForm.entity_type,
          state_of_incorporation: filingForm.state_of_incorporation || null,
          incorporation_date: filingForm.incorporation_date || null,
          fiscal_year_end: filingForm.fiscal_year_end || null,
          scheduled_annual_meeting: filingForm.scheduled_annual_meeting || null,
          corporate_status: filingForm.corporate_status,
          verification_date: filingForm.verification_date || null,
          annual_report_year: filingForm.annual_report_year ? parseInt(filingForm.annual_report_year) : null,
          second_name_choice: filingForm.second_name_choice || null,
          filing_date: filingForm.filing_date || null,
          delayed_effective_filing_date: filingForm.delayed_effective_filing_date || null,
          business_purpose: filingForm.business_purpose || null,
          accounting_method: filingForm.accounting_method || null,
          naics_code: filingForm.naics_code || null,
          first_year_annual_meeting: filingForm.first_year_annual_meeting ? parseInt(filingForm.first_year_annual_meeting) : null,
          initial_directors_count: filingForm.initial_directors_count ? parseInt(filingForm.initial_directors_count) : null,
          max_directors_allowed: filingForm.max_directors_allowed ? parseInt(filingForm.max_directors_allowed) : null,
          max_vps_allowed: filingForm.max_vps_allowed ? parseInt(filingForm.max_vps_allowed) : null,
          additional_provisions: filingForm.additional_provisions || null,
          address: filingForm.address || null,
          address_2: filingForm.address_2 || null,
          city: filingForm.city || null,
          state: filingForm.state || null,
          zip: filingForm.zip || null,
          phone: filingForm.phone || null,
          contact_full_name: filingForm.contact_full_name || null,
          contact_email: filingForm.contact_email || null,
          salutation_name: filingForm.salutation_name || null,
          contact_phone: filingForm.contact_phone || null,
          contact_cell: filingForm.contact_cell || null,
          contact_webpage: filingForm.contact_webpage ? formatWebpage(filingForm.contact_webpage) : null,
          s_election_date: isLLCType(company.entity_type)
            ? (llcSElectionEnabled ? (filingForm.s_election_date || null) : null)
            : company.s_election_date,
          management_type: isLLCType(company.entity_type) ? (filingForm.management_type || null) : (company as any).management_type,
        } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Organizational info saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Officers
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

  const [officerForm, setOfficerForm] = useState({
    president: "",
    vice_president: "",
    secretary: "",
    treasurer: "",
  });

  useEffect(() => {
    if (officers) {
      setOfficerForm({
        president: officers.president ?? "",
        vice_president: officers.vice_president ?? "",
        secretary: officers.secretary ?? "",
        treasurer: officers.treasurer ?? "",
      });
    }
  }, [officers]);

  const saveOfficers = useMutation({
    mutationFn: async () => {
      if (officers) {
        const { error } = await supabase
          .from("officers")
          .update({
            president: officerForm.president || null,
            vice_president: officerForm.vice_president || null,
            secretary: officerForm.secretary || null,
            treasurer: officerForm.treasurer || null,
          })
          .eq("id", officers.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("officers").insert({
          company_id: companyId,
          president: officerForm.president || null,
          vice_president: officerForm.vice_president || null,
          secretary: officerForm.secretary || null,
          treasurer: officerForm.treasurer || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["officers", companyId] });
      toast.success("Officers saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Directors - simple name fields like officers
  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Maintain a local form state for director names (up to configured count)
  const directorCount = company.initial_directors_count || 3;
  const [directorNames, setDirectorNames] = useState<string[]>([]);

  useEffect(() => {
    const names = directors.map((d) => d.name);
    while (names.length < directorCount) names.push("");
    setDirectorNames(names);
  }, [directors, directorCount]);

  const saveDirectors = useMutation({
    mutationFn: async () => {
      const trimmedNames = directorNames.map((n) => n.trim()).filter((n) => n !== "");
      
      // Delete all existing directors for this company
      const { error: delError } = await supabase
        .from("directors")
        .delete()
        .eq("company_id", companyId);
      if (delError) throw delError;

      // Insert the new list
      if (trimmedNames.length > 0) {
        // Deduplicate by lowercase name
        const seen = new Set<string>();
        const uniqueNames = trimmedNames.filter((n) => {
          const lower = n.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        const { error: insError } = await supabase.from("directors").insert(
          uniqueNames.map((name) => ({
            company_id: companyId,
            name,
            added_date: new Date().toISOString().split("T")[0],
          }))
        );
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directors", companyId] });
      toast.success(isLLCType(company.entity_type) ? "Authorized Binders saved!" : "Directors saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addDirectorSlot = () => {
    setDirectorNames((prev) => [...prev, ""]);
  };

  const removeDirectorSlot = (index: number) => {
    setDirectorNames((prev) => prev.filter((_, i) => i !== index));
  };


  return (
    <div className="space-y-5">
      {/* Verification of Corporate Status — mirrors IncorporationTab section for LLC entities */}
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
                    { label: "Corporate Status", value: filingForm.corporate_status },
                    { label: "Verification Date", value: filingForm.verification_date ? new Date(filingForm.verification_date + "T00:00:00").toLocaleDateString() : "" },
                    { label: "Annual Report Filed Year", value: filingForm.annual_report_year },
                  ],
                }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                <div className="field-group col-span-4">
                  <Label className="field-label">Corporate Status</Label>
                  <Select value={filingForm.corporate_status} onValueChange={(v) => setFilingForm((p) => ({ ...p, corporate_status: v }))}>
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
                  <DatePickerField value={filingForm.verification_date || ""} onChange={(v) => setFilingForm((p) => ({ ...p, verification_date: v }))} className="h-7" />
                </div>
                <div className="field-group col-span-4">
                  <Label className="field-label">Annual Report Year</Label>
                  <Input type="number" className="h-7 text-sm" value={filingForm.annual_report_year} onChange={(e) => setFilingForm((p) => ({ ...p, annual_report_year: e.target.value }))} placeholder="2024" />
                </div>
              </div>
              {filingForm.state_of_incorporation && (() => {
                const sosInfo = STATE_SOS_INFO[filingForm.state_of_incorporation];
                const isWI = filingForm.state_of_incorporation === "WI";
                if (!sosInfo) return null;
                return (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        let url = sosInfo.url;
                        if (isWI && filingForm.name) {
                          url = `https://apps.dfi.wi.gov/apps/CorpSearch/Results.aspx?type=Simple&q=${encodeURIComponent(filingForm.name)}`;
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

      {/* Organizational Info */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <CardTitle className="card-section-title">Organizational Info</CardTitle>
              </div>
            </div>
            <SectionPdfActions config={{
              title: "Organizational Info",
              companyName: company.name,
              fields: [
                { label: "Company Name", value: filingForm.name },
                { label: "Entity Type", value: filingForm.entity_type },
                { label: "State of Organization", value: filingForm.state_of_incorporation },
                { label: "Organization Date", value: filingForm.incorporation_date ? new Date(filingForm.incorporation_date + "T00:00:00").toLocaleDateString() : "" },
                { label: "Fiscal Year End", value: filingForm.fiscal_year_end },
                { label: "Scheduled Annual Meeting", value: filingForm.scheduled_annual_meeting },
                { label: "Contact Name", value: filingForm.contact_full_name },
                { label: "Salutation", value: filingForm.salutation_name },
                { label: "Email", value: filingForm.contact_email },
                { label: "Main Phone", value: filingForm.contact_phone },
                { label: "Cell Phone", value: filingForm.contact_cell },
                { label: "Webpage", value: filingForm.contact_webpage },
                { label: "Address", value: [filingForm.address, filingForm.address_2].filter(Boolean).join(", ") },
                { label: "City / State / Zip", value: [filingForm.city, filingForm.state, filingForm.zip].filter(Boolean).join(", ") },
                { label: "Business Purpose", value: filingForm.business_purpose },
                { label: "NAICS Code", value: filingForm.naics_code },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveFiling.mutate();
            }}
            className="space-y-3"
          >
            {/* Company Details - compact grid */}
            <div className="grid grid-cols-12 gap-x-3 gap-y-2">
              <div className="field-group col-span-12 sm:col-span-5">
                <Label className="field-label">Company Name</Label>
                <Input className="h-7 text-sm" value={filingForm.name} onChange={(e) => setFilingForm((p) => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Entity Type</Label>
                <Select value={filingForm.entity_type} onValueChange={(v) => setFilingForm((p) => ({ ...p, entity_type: v }))}>
                  <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Corporation", "LLC", "LLC-S", "Single Member LLC", "S-Corp", "Non-Profit", "Partnership"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group col-span-6 sm:col-span-2">
                <Label className="field-label">State of Org.</Label>
                <Select value={filingForm.state_of_incorporation} onValueChange={(v) => setFilingForm((p) => ({ ...p, state_of_incorporation: v }))}>
                  <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Status field moved to Verification of Corporate Status collapsible section above */}
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Organization Date</Label>
                <DatePickerField value={filingForm.incorporation_date || ""} onChange={(v) => setFilingForm((p) => ({ ...p, incorporation_date: v }))} className="h-7" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Delayed Effective Date</Label>
                <DatePickerField value={filingForm.delayed_effective_filing_date || ""} onChange={(v) => setFilingForm((p) => ({ ...p, delayed_effective_filing_date: v }))} className="h-7" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Fiscal Year End</Label>
                <Input className="h-7 text-sm" value={filingForm.fiscal_year_end} onChange={(e) => setFilingForm((p) => ({ ...p, fiscal_year_end: e.target.value }))} placeholder="December 31" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Sched. Annual Mtg Date</Label>
                <Input className="h-7 text-sm" value={filingForm.scheduled_annual_meeting} onChange={(e) => setFilingForm((p) => ({ ...p, scheduled_annual_meeting: e.target.value }))} placeholder="1st Monday in April" />
              </div>
              <div className="field-group col-span-6 sm:col-span-3">
                <Label className="field-label">Accounting Method</Label>
                <Select value={filingForm.accounting_method} onValueChange={(v) => setFilingForm((p) => ({ ...p, accounting_method: v }))}>
                  <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash basis">Cash Basis</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* LLC ONLY: Management Type dropdown — Member Managed / Manager Managed. Only renders for LLC and Single Member LLC entity types. DO NOT remove or make visible for Corp/S-Corp entities. */}
              {isLLCType(filingForm.entity_type) && (
                <div className="field-group col-span-6 sm:col-span-3">
                  <Label className="field-label">Management Type</Label>
                  <Select value={filingForm.management_type} onValueChange={(v) => setFilingForm((p) => ({ ...p, management_type: v }))}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member_managed">Member Managed</SelectItem>
                      <SelectItem value="manager_managed">Manager Managed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="field-group col-span-12 sm:col-span-7">
                <Label className="field-label">Business Purpose</Label>
                <Textarea className="text-sm min-h-[50px]" value={filingForm.business_purpose} onChange={(e) => setFilingForm((p) => ({ ...p, business_purpose: e.target.value }))} rows={2} placeholder="Describe the business purpose..." />
              </div>
              <div className="field-group col-span-6 sm:col-span-2">
                <Label className="field-label flex items-center gap-1">
                  NAICS
                  <a href="https://www.naics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Label>
                <Input className="h-7 text-sm" value={filingForm.naics_code} onChange={(e) => setFilingForm((p) => ({ ...p, naics_code: e.target.value }))} placeholder="Code" />
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
                  <Input className="h-7 text-sm" value={filingForm.contact_full_name} onChange={(e) => setFilingForm((p) => ({ ...p, contact_full_name: e.target.value }))} placeholder="First and Last Name" />
                </div>
                <div className="field-group col-span-6 sm:col-span-2">
                  <Label className="field-label">Salutation</Label>
                  <Input className="h-7 text-sm" value={filingForm.salutation_name} onChange={(e) => setFilingForm((p) => ({ ...p, salutation_name: e.target.value }))} placeholder='"John"' />
                </div>
                <div className="field-group col-span-12 sm:col-span-5">
                  <Label className="field-label">Email</Label>
                  <Input className="h-7 text-sm" type="email" value={filingForm.contact_email} onChange={(e) => setFilingForm((p) => ({ ...p, contact_email: e.target.value }))} placeholder="client@example.com" />
                </div>
                <div className="field-group col-span-6 sm:col-span-3">
                  <Label className="field-label flex items-center gap-1"><Phone className="h-3 w-3" /> Main Phone</Label>
                  <Input className="h-7 text-sm" value={filingForm.contact_phone} onChange={(e) => handlePhoneChange("contact_phone", e.target.value)} placeholder="(555) 555-5555" />
                </div>
                <div className="field-group col-span-6 sm:col-span-3">
                  <Label className="field-label flex items-center gap-1"><Phone className="h-3 w-3" /> Cell Phone</Label>
                  <Input className="h-7 text-sm" value={filingForm.contact_cell} onChange={(e) => handlePhoneChange("contact_cell", e.target.value)} placeholder="(555) 555-5555" />
                </div>
                <div className="field-group col-span-12 sm:col-span-6">
                  <Label className="field-label flex items-center gap-1"><Globe className="h-3 w-3" /> Webpage</Label>
                  <div className="flex items-center gap-2">
                    <Input className="h-7 text-sm" type="url" value={filingForm.contact_webpage} onChange={(e) => setFilingForm((p) => ({ ...p, contact_webpage: e.target.value }))} placeholder="www.example.com" onBlur={(e) => { if (e.target.value) setFilingForm((p) => ({ ...p, contact_webpage: formatWebpage(e.target.value) })); }} />
                    {filingForm.contact_webpage && (
                      <a href={formatWebpage(filingForm.contact_webpage)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline shrink-0 inline-flex items-center gap-0.5">
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
                  <Label className="field-label">Address 1</Label>
                  <Input className="h-7 text-sm" value={filingForm.address} onChange={(e) => setFilingForm((p) => ({ ...p, address: e.target.value }))} placeholder="Street address" />
                </div>
                <div className="field-group col-span-12 sm:col-span-2">
                  <Label className="field-label">Address 2</Label>
                  <Input className="h-7 text-sm" value={filingForm.address_2} onChange={(e) => setFilingForm((p) => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor" />
                </div>
                <div className="field-group col-span-6 sm:col-span-3">
                  <Label className="field-label">City</Label>
                  <Input className="h-7 text-sm" value={filingForm.city} onChange={(e) => setFilingForm((p) => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="field-group col-span-3 sm:col-span-1 min-w-[60px]">
                  <Label className="field-label">State</Label>
                  <Select value={filingForm.state} onValueChange={(v) => setFilingForm((p) => ({ ...p, state: v }))}>
                    <SelectTrigger className="h-7 text-sm min-w-[60px]"><SelectValue placeholder="ST" /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group col-span-3 sm:col-span-2">
                  <Label className="field-label">Zip</Label>
                  <Input className="h-7 text-sm" value={filingForm.zip} onChange={(e) => { const v = e.target.value.replace(/[^\d-]/g, "").slice(0, 10); setFilingForm((p) => ({ ...p, zip: v })); handleFilingZipChange(v); }} placeholder="55555" />
                  {filingZipError && <p className="text-[10px] text-destructive mt-0.5">{filingZipError}</p>}
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



            {/* S Corporation Tax Status — LLC only */}
            {isLLCType(company.entity_type) && (
              <div className="mt-3 flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <Checkbox
                  id="s_election_llc"
                  checked={llcSElectionEnabled}
                  onCheckedChange={(checked) => {
                    const enabled = !!checked;
                    setLlcSElectionEnabled(enabled);
                    if (!enabled) {
                      setFilingForm((p) => ({ ...p, s_election_date: "" }));
                    }
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor="s_election_llc" className="cursor-pointer text-sm font-medium">Is this LLC electing S Corporation tax status?</Label>
                  <p className="text-[11px] text-muted-foreground">Check if this LLC is electing to be taxed as an S Corporation.</p>
                  {llcSElectionEnabled && (
                    <div className="mt-2 field-group max-w-xs">
                      <Label className="field-label">S Election Effective Date</Label>
                      <DatePickerField
                        value={filingForm.s_election_date}
                        onChange={(v) => setFilingForm((p) => ({ ...p, s_election_date: v || "" }))}
                        placeholder="Select effective date"
                      />
                      {!filingForm.s_election_date && (
                        <p className="mt-1 text-[11px] text-destructive">S Election Effective Date is required when enabled.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saveFiling.isPending} size="sm">
                {saveFiling.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Organizational Info
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Registered Agent - LLC only */}
      {isLLC && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Registered Agent
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-[11px] mt-0.5">
                    The registered agent receives legal and state correspondence on behalf of the LLC
                  </CardDescription>
                  <div className="flex items-center gap-1">
                    {raHistory.length > 0 && (
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowRaHistory(!showRaHistory)}>
                        <History className="h-3 w-3" />
                        {showRaHistory ? "Hide" : "Show"} History ({raHistory.length})
                      </Button>
                    )}
                    <SectionPdfActions config={{
                      title: "Registered Agent",
                      companyName: company.name,
                      fields: [
                        { label: "Agent Name", value: raForm.registered_agent_name },
                        { label: "Agent Type", value: raForm.registered_agent_type },
                        { label: "Address", value: raForm.registered_agent_address },
                        { label: "Address 2", value: raForm.registered_agent_address_2 },
                        { label: "City", value: raForm.registered_agent_city },
                        { label: "State", value: raForm.registered_agent_state },
                        { label: "Zip", value: raForm.registered_agent_zip },
                        { label: "Phone", value: raForm.registered_agent_phone },
                        { label: "Email", value: raForm.registered_agent_email },
                        { label: "Date Appointed", value: raForm.registered_agent_appointed_date },
                        { label: "Date Resigned/Changed", value: raForm.registered_agent_resigned_date },
                      ],
                    }} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveRegisteredAgent.mutate();
                  }}
                  className="space-y-3"
                >
                  <div className="grid grid-cols-12 gap-x-3 gap-y-2">
                    <div className="field-group col-span-12 sm:col-span-5">
                      <Label className="field-label">Agent Name <span className="text-destructive">*</span></Label>
                      <Input className="h-7 text-sm" value={raForm.registered_agent_name} onChange={(e) => setRaForm(p => ({ ...p, registered_agent_name: e.target.value }))} placeholder="Individual or entity name" />
                    </div>
                    <div className="field-group col-span-12 sm:col-span-5">
                      <Label className="field-label">Email Address</Label>
                      <Input type="email" className="h-7 text-sm" value={raForm.registered_agent_email} onChange={(e) => setRaForm(p => ({ ...p, registered_agent_email: e.target.value }))} />
                    </div>
                    <div className="field-group col-span-12 sm:col-span-2" />
                  </div>
                  <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                    <div className="field-group col-span-3">
                      <Label className="field-label">Address <span className="text-destructive">*</span></Label>
                      <Input className="h-7 text-sm" value={raForm.registered_agent_address} onChange={(e) => setRaForm(p => ({ ...p, registered_agent_address: e.target.value }))} placeholder="Physical address (no P.O. Boxes)" />
                    </div>
                    <div className="field-group col-span-3">
                      <Label className="field-label">Address 2</Label>
                      <Input className="h-7 text-sm" value={raForm.registered_agent_address_2} onChange={(e) => setRaForm(p => ({ ...p, registered_agent_address_2: e.target.value }))} placeholder="Suite, Unit, Floor" />
                    </div>
                    <div className="field-group col-span-2">
                      <Label className="field-label">City</Label>
                      <Input className="h-7 text-sm" value={raForm.registered_agent_city} onChange={(e) => setRaForm(p => ({ ...p, registered_agent_city: e.target.value }))} />
                    </div>
                    <div className="field-group col-span-2">
                      <Label className="field-label">State <span className="text-destructive">*</span></Label>
                      <Select value={raForm.registered_agent_state} onValueChange={(v) => setRaForm(p => ({ ...p, registered_agent_state: v }))}>
                        <SelectTrigger className="h-7 text-sm min-w-[60px] px-2"><SelectValue placeholder="ST" /></SelectTrigger>
                        <SelectContent>
                          {US_STATES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="field-group col-span-2">
                      <Label className="field-label">Zip <span className="text-destructive">*</span></Label>
                      <Input className="h-7 text-sm" value={raForm.registered_agent_zip} onChange={(e) => { setRaForm(p => ({ ...p, registered_agent_zip: e.target.value })); handleRaZip(e.target.value); }} />
                      {raZipError && <p className="text-[10px] text-destructive mt-0.5">{raZipError}</p>}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={saveRegisteredAgent.isPending} size="sm">
                      {saveRegisteredAgent.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      Save Registered Agent
                    </Button>
                  </div>
                </form>

                {/* History panel */}
                {showRaHistory && raHistory.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <History className="h-3 w-3" /> Agent Change History
                    </h4>
                    <div className="space-y-2">
                      {raHistory.map((h: any) => (
                        <div key={h.id} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{h.agent_name}</span>
                            <span className="text-muted-foreground">
                              {h.appointed_date ? new Date(h.appointed_date + "T00:00:00").toLocaleDateString() : "?"} — {h.resigned_date ? new Date(h.resigned_date + "T00:00:00").toLocaleDateString() : "?"}
                            </span>
                          </div>
                          {(h.address || h.city || h.state) && (
                            <p className="text-muted-foreground mt-0.5">
                              {[h.address, h.address_2, h.city, h.state, h.zip].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Initial List of Directors - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
           <Button variant="outline" className="w-full justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              {isLLCType(company.entity_type) ? "Authorized Binders" : "Initial List of Directors"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] mt-0.5">
                  {isLLCType(company.entity_type) ? "Enter the names of the authorized binders for this company" : "Enter the names of the initial directors for this company"}
                </CardDescription>
                <SectionPdfActions config={{
                  title: isLLCType(company.entity_type) ? "Authorized Binders" : "Initial List of Directors",
                  companyName: company.name,
                  fields: directorNames.filter((n) => n.trim()).map((n, i) => ({
                    label: isLLCType(company.entity_type) ? `Authorized Binder ${i + 1}` : `Director ${i + 1}`,
                    value: n.trim(),
                  })),
                }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveDirectors.mutate();
                }}
                className="space-y-3"
              >
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {directorNames.map((name, index) => (
                    <div key={index} className="field-group">
                      <Label className="field-label">{isLLCType(company.entity_type) ? `Authorized Binder ${index + 1}` : `Director ${index + 1}`}</Label>
                      <div className="flex gap-1">
                        <Input
                          className="h-8 text-sm"
                          value={name}
                          onChange={(e) =>
                            setDirectorNames((prev) =>
                              prev.map((n, i) => (i === index ? e.target.value : n))
                            )
                          }
                          placeholder={isLLCType(company.entity_type) ? "Authorized binder name" : "Director name"}
                        />
                        {directorNames.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-destructive/50 hover:text-destructive"
                            onClick={() => removeDirectorSlot(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addDirectorSlot}>
                    <Plus className="mr-1 h-3 w-3" /> {isLLCType(company.entity_type) ? "Add Another Binder" : "Add Another Director"}
                  </Button>
                  <Button type="submit" disabled={saveDirectors.isPending} size="sm">
                    {saveDirectors.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    {isLLCType(company.entity_type) ? "Save Authorized Binders" : "Save Directors"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Officers - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              {isLLCType(company.entity_type) ? "Managers / Officers" : company.entity_type === "Partnership" ? "Partners" : "Officers"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] mt-0.5">
                   {isLLCType(company.entity_type) && "Manager-managed or member-managed officers per Wis. Stat. § 183.0401"}
                   {company.entity_type === "Corporation" && "Officers per Wis. Stat. § 180.0840"}
                   {company.entity_type === "S-Corp" && "Officers per Wis. Stat. § 180.0840"}
                  {company.entity_type === "Non-Profit" && "Officers per Wis. Stat. § 181.0840"}
                  {company.entity_type === "Partnership" && "Partners per Wis. Stat. § 178.0401"}
                </CardDescription>
                <SectionPdfActions config={{
                  title: isLLCType(company.entity_type) ? "Managers / Officers" : "Officers",
                  companyName: company.name,
                  fields: getOfficerFields(company.entity_type).map((f) => ({
                    label: f.label,
                    value: (officerForm as any)[f.key] || "",
                  })),
                }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveOfficers.mutate();
                }}
                className="space-y-3"
              >
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {getOfficerFields(company.entity_type).map((field) => (
                    <div key={field.key} className="field-group">
                      <Label className="field-label">{field.label}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={(officerForm as any)[field.key] || ""}
                        onChange={(e) => setOfficerForm((p) => ({ ...p, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={saveOfficers.isPending} size="sm">
                    {saveOfficers.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save {company.entity_type === "LLC" ? "Managers" : company.entity_type === "Partnership" ? "Partners" : "Officers"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
