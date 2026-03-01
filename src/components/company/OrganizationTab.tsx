import { useState, useEffect } from "react";
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
import { Plus, Trash2, Loader2, Save, Users, FileText, ChevronDown, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CompanyAssetsSection from "@/components/company/CompanyAssetsSection";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/ui/date-picker-field";

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
    "President", "CEO", "Vice President", "Secretary", "Treasurer", "CFO",
    "COO", "CTO", "Assistant Secretary", "Assistant Treasurer",
    "Executive Vice President", "Senior Vice President",
  ],
  "S-Corp": [
    "President", "CEO", "Vice President", "Secretary", "Treasurer", "CFO",
    "COO", "CTO", "Assistant Secretary", "Assistant Treasurer",
    "Executive Vice President", "Senior Vice President",
  ],
  LLC: [
    "Managing Member", "Manager", "Assistant Manager", "Secretary",
    "Treasurer", "Financial Manager", "Organizer", "Member-Manager",
    "Chief Manager", "Operations Manager",
  ],
  "Single Member LLC": [
    "Managing Member", "Manager", "Assistant Manager", "Secretary",
    "Treasurer", "Financial Manager", "Organizer", "Member-Manager",
    "Chief Manager", "Operations Manager",
  ],
  "Non-Profit": [
    "President", "Chair", "Vice President", "Vice Chair", "Secretary",
    "Treasurer", "Executive Director", "Assistant Secretary",
    "Assistant Treasurer", "Board Chair", "Board Vice Chair",
  ],
  Partnership: [
    "Managing Partner", "General Partner", "Limited Partner", "Senior Partner",
    "Partner", "Secretary", "Treasurer", "Financial Partner",
    "Administrative Partner", "Founding Partner",
  ],
};


interface Props {
  companyId: string;
  company: Tables<"companies">;
}

export default function OrganizationTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();

  // Filing details form
  const [filingForm, setFilingForm] = useState({
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
  });

  const saveFiling = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({
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
        })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      toast.success("Filing details saved!");
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
      toast.success("Directors saved!");
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
      {/* Filing & Articles Details */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <CardTitle className="card-section-title">Filing & Articles Details</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Information used to prepare articles of incorporation/organization</CardDescription>
            </div>
            <SectionPdfActions config={{
              title: "Filing & Articles Details",
              companyName: company.name,
              fields: [
                { label: "2nd Name Choice", value: filingForm.second_name_choice },
                { label: "Filing Date", value: filingForm.filing_date ? new Date(filingForm.filing_date + "T00:00:00").toLocaleDateString() : "" },
                { label: "Business Purpose", value: filingForm.business_purpose },
                { label: "Accounting Method", value: filingForm.accounting_method },
                { label: "NAICS Code", value: filingForm.naics_code },
                { label: "First Year Annual Meeting", value: filingForm.first_year_annual_meeting },
                ...(!isLLCType(company.entity_type) ? [
                  { label: "Initial # of Directors", value: filingForm.initial_directors_count },
                  { label: "Max Directors Allowed", value: filingForm.max_directors_allowed },
                  { label: "Max VPs Allowed", value: filingForm.max_vps_allowed },
                ] : []),
                { label: "Additional Provisions", value: filingForm.additional_provisions },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveFiling.mutate();
            }}
            className="space-y-3"
          >
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="field-group">
                <Label className="field-label">2nd Name Choice</Label>
                <Input className="h-8 text-sm" value={filingForm.second_name_choice} onChange={(e) => setFilingForm((p) => ({ ...p, second_name_choice: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Filing Date</Label>
                <Input type="date" className="h-8 text-sm" value={filingForm.filing_date} onChange={(e) => setFilingForm((p) => ({ ...p, filing_date: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Delayed Effective Filing Date</Label>
                <Input type="date" className="h-8 text-sm" value={filingForm.delayed_effective_filing_date} onChange={(e) => setFilingForm((p) => ({ ...p, delayed_effective_filing_date: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Business Purpose</Label>
                <Input className="h-8 text-sm" value={filingForm.business_purpose} onChange={(e) => setFilingForm((p) => ({ ...p, business_purpose: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Accounting Method</Label>
                <Select value={filingForm.accounting_method} onValueChange={(v) => setFilingForm((p) => ({ ...p, accounting_method: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash basis">Cash Basis</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label flex items-center gap-1.5">
                  NAICS Code
                  <a href="https://www.naics.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Label>
                <Input className="h-8 text-sm" value={filingForm.naics_code} onChange={(e) => setFilingForm((p) => ({ ...p, naics_code: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">First Year Annual Meeting</Label>
                <Input type="number" className="h-8 text-sm" value={filingForm.first_year_annual_meeting} onChange={(e) => setFilingForm((p) => ({ ...p, first_year_annual_meeting: e.target.value }))} />
              </div>
              {!isLLCType(company.entity_type) && (
                <>
                  <div className="field-group">
                    <Label className="field-label">Initial # of Directors</Label>
                    <Input type="number" className="h-8 text-sm" value={filingForm.initial_directors_count} onChange={(e) => setFilingForm((p) => ({ ...p, initial_directors_count: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Max Directors Allowed</Label>
                    <Input type="number" className="h-8 text-sm" value={filingForm.max_directors_allowed} onChange={(e) => setFilingForm((p) => ({ ...p, max_directors_allowed: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Max VPs Allowed</Label>
                    <Input type="number" className="h-8 text-sm" value={filingForm.max_vps_allowed} onChange={(e) => setFilingForm((p) => ({ ...p, max_vps_allowed: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <div className="field-group">
              <Label className="field-label">Additional Provisions</Label>
              <Textarea className="text-sm min-h-[60px]" value={filingForm.additional_provisions} onChange={(e) => setFilingForm((p) => ({ ...p, additional_provisions: e.target.value }))} rows={2} />
            </div>
            {/* S Corporation Tax Status — LLC only */}
            {isLLCType(company.entity_type) && (
              <div className="mt-3 flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
                <Checkbox
                  id="s_election_llc"
                  checked={!!company.s_election_date}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      // Clear s_election_date
                      supabase.from("companies").update({ s_election_date: null }).eq("id", companyId).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["company", companyId] });
                      });
                    }
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor="s_election_llc" className="cursor-pointer text-sm font-medium">Is this LLC electing S Corporation tax status?</Label>
                  <p className="text-[11px] text-muted-foreground">Check if this LLC is electing to be taxed as an S Corporation</p>
                  {!!company.s_election_date && (
                    <div className="mt-2 field-group max-w-xs">
                      <Label className="field-label">S Election Effective Date</Label>
                      <DatePickerField
                        value={company.s_election_date ?? ""}
                        onChange={async (v) => {
                          await supabase.from("companies").update({ s_election_date: v || null }).eq("id", companyId);
                          queryClient.invalidateQueries({ queryKey: ["company", companyId] });
                        }}
                      />
                    </div>
                  )}
                  {!company.s_election_date && (
                    <div className="mt-2 field-group max-w-xs">
                      <Label className="field-label">S Election Effective Date</Label>
                      <DatePickerField
                        value=""
                        onChange={async (v) => {
                          await supabase.from("companies").update({ s_election_date: v || null }).eq("id", companyId);
                          queryClient.invalidateQueries({ queryKey: ["company", companyId] });
                        }}
                        placeholder="Select date to enable S election"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={saveFiling.isPending} size="sm">
                {saveFiling.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Filing Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Initial List of Directors - Collapsible */}
      <Collapsible>
        <CollapsibleTrigger asChild>
           <Button variant="outline" className="w-full justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              {isLLCType(company.entity_type) ? "Initial List of Members" : "Initial List of Directors"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] mt-0.5">
                  {isLLCType(company.entity_type) ? "Enter the names of the initial members for this company" : "Enter the names of the initial directors for this company"}
                </CardDescription>
                <SectionPdfActions config={{
                  title: isLLCType(company.entity_type) ? "Initial List of Members" : "Initial List of Directors",
                  companyName: company.name,
                  fields: directorNames.filter((n) => n.trim()).map((n, i) => ({
                    label: isLLCType(company.entity_type) ? `Member ${i + 1}` : `Director ${i + 1}`,
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
                      <Label className="field-label">{isLLCType(company.entity_type) ? `Member ${index + 1}` : `Director ${index + 1}`}</Label>
                      <div className="flex gap-1">
                        <Input
                          className="h-8 text-sm"
                          value={name}
                          onChange={(e) =>
                            setDirectorNames((prev) =>
                              prev.map((n, i) => (i === index ? e.target.value : n))
                            )
                          }
                          placeholder={isLLCType(company.entity_type) ? "Member name" : "Director name"}
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
                    <Plus className="mr-1 h-3 w-3" /> {isLLCType(company.entity_type) ? "Add Another Member" : "Add Another Director"}
                  </Button>
                  <Button type="submit" disabled={saveDirectors.isPending} size="sm">
                    {saveDirectors.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    {isLLCType(company.entity_type) ? "Save Members" : "Save Directors"}
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
              {company.entity_type === "LLC" ? "Managers / Officers" : company.entity_type === "Partnership" ? "Partners" : "Officers"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardDescription className="text-[11px] mt-0.5">
                  {company.entity_type === "LLC" && "Manager-managed or member-managed officers per Wis. Stat. § 183.0401"}
                  {company.entity_type === "Corporation" && "Officers per Wis. Stat. § 180.0840"}
                  {company.entity_type === "S-Corp" && "Officers per Wis. Stat. § 180.0840"}
                  {company.entity_type === "Non-Profit" && "Officers per Wis. Stat. § 181.0840"}
                  {company.entity_type === "Partnership" && "Partners per Wis. Stat. § 178.0401"}
                </CardDescription>
                <SectionPdfActions config={{
                  title: company.entity_type === "LLC" ? "Managers / Officers" : "Officers",
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

      {/* Company Assets */}
      <CompanyAssetsSection companyId={companyId} companyName={company.name} />
    </div>
  );
}
