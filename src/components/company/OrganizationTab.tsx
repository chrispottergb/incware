import { useState, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Save, Users, FileText, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CompanyAssetsSection from "@/components/company/CompanyAssetsSection";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
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
    sic_code: company.sic_code ?? "",
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
          sic_code: filingForm.sic_code || null,
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

  const [lastOfficers, setLastOfficers] = useState<typeof officers>(undefined);
  if (officers !== lastOfficers) {
    setLastOfficers(officers);
    if (officers) {
      setOfficerForm({
        president: officers.president ?? "",
        vice_president: officers.vice_president ?? "",
        secretary: officers.secretary ?? "",
        treasurer: officers.treasurer ?? "",
      });
    }
  }

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

  // Directors
  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("directors")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [directorDialog, setDirectorDialog] = useState(false);
  const [newDirector, setNewDirector] = useState({
    name: "",
    address: "",
    address_2: "",
    city: "",
    state: "",
    zip: "",
  });

  const addDirector = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("directors").insert({
        company_id: companyId,
        name: newDirector.name,
        address: newDirector.address || null,
        address_2: newDirector.address_2 || null,
        city: newDirector.city || null,
        state: newDirector.state || null,
        zip: newDirector.zip || null,
        added_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directors", companyId] });
      setDirectorDialog(false);
      setNewDirector({ name: "", address: "", address_2: "", city: "", state: "", zip: "" });
      toast.success("Director added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDirectorZipResult = useCallback((result: { city: string; state: string }) => {
    setNewDirector(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange: handleDirectorZipChange } = useZipLookup(handleDirectorZipResult);

  const deleteDirector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("directors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directors", companyId] });
      toast.success("Director removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });


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
                { label: "SIC Code", value: filingForm.sic_code },
                { label: "First Year Annual Meeting", value: filingForm.first_year_annual_meeting },
                { label: "Initial # of Directors", value: filingForm.initial_directors_count },
                { label: "Max Directors Allowed", value: filingForm.max_directors_allowed },
                { label: "Max VPs Allowed", value: filingForm.max_vps_allowed },
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
                <Label className="field-label">SIC Code</Label>
                <Input className="h-8 text-sm" value={filingForm.sic_code} onChange={(e) => setFilingForm((p) => ({ ...p, sic_code: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">First Year Annual Meeting</Label>
                <Input type="number" className="h-8 text-sm" value={filingForm.first_year_annual_meeting} onChange={(e) => setFilingForm((p) => ({ ...p, first_year_annual_meeting: e.target.value }))} />
              </div>
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
            </div>
            <div className="field-group">
              <Label className="field-label">Additional Provisions</Label>
              <Textarea className="text-sm min-h-[60px]" value={filingForm.additional_provisions} onChange={(e) => setFilingForm((p) => ({ ...p, additional_provisions: e.target.value }))} rows={2} />
            </div>
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
              Initial List of Directors
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardDescription className="text-[11px] mt-0.5">Directors serve at the organizational meeting until the board is officially elected</CardDescription>
              <div className="flex items-center gap-1">
                <SectionPdfActions config={{
                  title: "Initial List of Directors",
                  companyName: company.name,
                  table: {
                    headers: ["Director Name", "Business Address", "City", "State", "Zip"],
                    rows: directors.map((d) => [d.name, d.address || "—", d.city || "—", d.state || "—", d.zip || "—"]),
                  },
                }} />
              <Dialog open={directorDialog} onOpenChange={setDirectorDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-7 text-xs">
                    <Plus className="mr-1 h-3 w-3" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display text-base">Add Director</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      addDirector.mutate();
                    }}
                    className="space-y-3"
                  >
                    <div className="field-group">
                      <Label className="field-label">Director Name</Label>
                      <Input className="h-8 text-sm" value={newDirector.name} onChange={(e) => setNewDirector((p) => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Business Address</Label>
                      <Input className="h-8 text-sm" value={newDirector.address} onChange={(e) => setNewDirector((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Address 2</Label>
                      <Input className="h-8 text-sm" value={newDirector.address_2} onChange={(e) => setNewDirector((p) => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor, etc." />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="field-group">
                        <Label className="field-label">City</Label>
                        <Input className="h-8 text-sm" value={newDirector.city} onChange={(e) => setNewDirector((p) => ({ ...p, city: e.target.value }))} />
                      </div>
                      <div className="field-group">
                        <Label className="field-label">State</Label>
                        <Select value={newDirector.state} onValueChange={(v) => setNewDirector((p) => ({ ...p, state: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="field-group">
                        <Label className="field-label">Zip</Label>
                        <Input className="h-8 text-sm" value={newDirector.zip} onChange={(e) => { setNewDirector((p) => ({ ...p, zip: e.target.value })); handleDirectorZipChange(e.target.value); }} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" size="sm" disabled={addDirector.isPending}>
                      {addDirector.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Add Director
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {directors.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-6 text-center">
                  <Users className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No directors added yet</p>
                </div>
              ) : (
                <div className="rounded-md border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="text-xs font-semibold h-8">Director Name</TableHead>
                        <TableHead className="text-xs h-8">Business Address</TableHead>
                        <TableHead className="text-xs h-8">City</TableHead>
                        <TableHead className="text-xs h-8">State</TableHead>
                        <TableHead className="text-xs h-8">Zip</TableHead>
                        <TableHead className="w-10 h-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directors.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium text-sm py-2">{d.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2">{d.address || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2">{d.city || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2">{d.state || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground py-2">{d.zip || "—"}</TableCell>
                          <TableCell className="py-2">
                            <Button variant="ghost" size="icon" onClick={() => deleteDirector.mutate(d.id)} className="h-6 w-6 text-destructive/50 hover:text-destructive">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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
