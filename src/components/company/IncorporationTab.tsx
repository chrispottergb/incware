import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Save, Shield, Building2, Share2, UserCheck, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import WIComplianceChecklist from "./WIComplianceChecklist";
import SectionPdfActions from "./SectionPdfActions";

const ENTITY_TYPES = ["Corporation", "LLC", "S-Corp", "Non-Profit", "Partnership"];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

type Company = Tables<"companies">;

interface Props {
  company: Company;
}

export default function IncorporationTab({ company }: Props) {
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
    registered_agent_address: company.registered_agent_address ?? "",
    registered_agent_city: company.registered_agent_city ?? "",
    registered_agent_state: company.registered_agent_state ?? "",
    registered_agent_zip: company.registered_agent_zip ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    phone: company.phone ?? "",
  });

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const save = useMutation({
    mutationFn: async () => {
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
          s_election_date: form.s_election_date || null,
          scheduled_annual_meeting: form.scheduled_annual_meeting || null,
          election_1244: form.election_1244,
          seal_type: form.seal_type,
          corporate_status: form.corporate_status,
          verification_date: form.verification_date || null,
          annual_report_year: form.annual_report_year ? parseInt(form.annual_report_year) : null,
          registered_agent_name: form.registered_agent_name || null,
          registered_agent_address: form.registered_agent_address || null,
          registered_agent_city: form.registered_agent_city || null,
          registered_agent_state: form.registered_agent_state || null,
          registered_agent_zip: form.registered_agent_zip || null,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          phone: form.phone || null,
        })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", company.id] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Incorporation info saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
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
            <CardContent className="grid gap-3 sm:grid-cols-3 px-4 pb-4">
              <div className="field-group">
                <Label className="field-label">Corporate Status</Label>
                <Select value={form.corporate_status} onValueChange={(v) => update("corporate_status", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current</SelectItem>
                    <SelectItem value="delinquent">Delinquent</SelectItem>
                    <SelectItem value="dissolved">Dissolved</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">Verification Date</Label>
                <Input type="date" className="h-8 text-sm" value={form.verification_date} onChange={(e) => update("verification_date", e.target.value)} />
              </div>
              <div className="field-group">
                <Label className="field-label">Annual Report Filed Year</Label>
                <Input type="number" className="h-8 text-sm" value={form.annual_report_year} onChange={(e) => update("annual_report_year", e.target.value)} placeholder="2024" />
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Company Information */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Company Information</CardTitle>
            </div>
            <SectionPdfActions config={{
              title: "Company Information",
              companyName: company.name,
              fields: [
                { label: "Company Name", value: form.name },
                { label: "Entity Type", value: form.entity_type },
                { label: "State of Incorporation", value: form.state_of_incorporation },
                { label: "Incorporation Date", value: form.incorporation_date ? new Date(form.incorporation_date + "T00:00:00").toLocaleDateString() : "" },
                { label: "Fiscal Year End", value: form.fiscal_year_end },
                { label: "Scheduled Annual Meeting", value: form.scheduled_annual_meeting },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 px-4 pb-4">
          <div className="field-group">
            <Label className="field-label">Company Name</Label>
            <Input className="h-8 text-sm" value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="field-group">
            <Label className="field-label">Entity Type</Label>
            <Select value={form.entity_type} onValueChange={(v) => update("entity_type", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field-group">
            <Label className="field-label">State of Incorporation</Label>
            <Select value={form.state_of_incorporation} onValueChange={(v) => update("state_of_incorporation", v)}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="field-group">
            <Label className="field-label">Incorporation Date</Label>
            <Input type="date" className="h-8 text-sm" value={form.incorporation_date} onChange={(e) => update("incorporation_date", e.target.value)} />
          </div>
          <div className="field-group">
            <Label className="field-label">Fiscal Year End</Label>
            <Input className="h-8 text-sm" value={form.fiscal_year_end} onChange={(e) => update("fiscal_year_end", e.target.value)} placeholder="December 31" />
          </div>
          <div className="field-group">
            <Label className="field-label">Scheduled Annual Meeting</Label>
            <Input className="h-8 text-sm" value={form.scheduled_annual_meeting} onChange={(e) => update("scheduled_annual_meeting", e.target.value)} placeholder="1st Monday in April" />
          </div>
        </CardContent>
      </Card>

      {/* Shares & Elections */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Shares & Elections</CardTitle>
            </div>
            <SectionPdfActions config={{
              title: "Shares & Elections",
              companyName: company.name,
              fields: [
                { label: "Authorized Shares", value: form.authorized_shares },
                { label: "Par Value Type", value: form.par_value_type === "par" ? "Par Value" : "No Par Value" },
                { label: "Par Value ($)", value: form.par_value },
                { label: "S-Election Date", value: form.s_election_date ? new Date(form.s_election_date + "T00:00:00").toLocaleDateString() : "" },
                { label: "Seal", value: form.seal_type === "seal" ? "Seal" : "No Seal" },
                { label: "Section 1244 Election", value: form.election_1244 ? "Yes" : "No" },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="field-group">
              <Label className="field-label">Authorized Shares</Label>
              <Input type="number" className="h-8 text-sm" value={form.authorized_shares} onChange={(e) => update("authorized_shares", e.target.value)} />
            </div>
            <div className="field-group">
              <Label className="field-label">Par Value Type</Label>
              <Select value={form.par_value_type} onValueChange={(v) => update("par_value_type", v)}>
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
            <div className="field-group">
              <Label className="field-label">S-Election Date</Label>
              <Input type="date" className="h-8 text-sm" value={form.s_election_date} onChange={(e) => update("s_election_date", e.target.value)} />
            </div>
            <div className="field-group">
              <Label className="field-label">Seal</Label>
              <Select value={form.seal_type} onValueChange={(v) => update("seal_type", v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seal">Seal</SelectItem>
                  <SelectItem value="no_seal">No Seal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <Checkbox
              id="election_1244"
              checked={form.election_1244}
              onCheckedChange={(v) => update("election_1244", !!v)}
            />
            <div>
              <Label htmlFor="election_1244" className="cursor-pointer text-sm font-medium">Section 1244 Election</Label>
              <p className="text-[11px] text-muted-foreground">A loss on Section 1244 stock is treated as an ordinary loss</p>
            </div>
          </div>
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
                { label: "Address", value: form.registered_agent_address },
                { label: "City", value: form.registered_agent_city },
                { label: "State", value: form.registered_agent_state },
                { label: "Zip", value: form.registered_agent_zip },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2 px-4 pb-4">
          <div className="field-group sm:col-span-2">
            <Label className="field-label">Agent Name</Label>
            <Input className="h-8 text-sm" value={form.registered_agent_name} onChange={(e) => update("registered_agent_name", e.target.value)} />
          </div>
          <div className="field-group sm:col-span-2">
            <Label className="field-label">Address</Label>
            <Input className="h-8 text-sm" value={form.registered_agent_address} onChange={(e) => update("registered_agent_address", e.target.value)} />
          </div>
          <div className="field-group">
            <Label className="field-label">City</Label>
            <Input className="h-8 text-sm" value={form.registered_agent_city} onChange={(e) => update("registered_agent_city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field-group">
              <Label className="field-label">State</Label>
              <Select value={form.registered_agent_state} onValueChange={(v) => update("registered_agent_state", v)}>
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
              <Input className="h-8 text-sm" value={form.registered_agent_zip} onChange={(e) => update("registered_agent_zip", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Address */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Company Address</CardTitle>
            </div>
            <SectionPdfActions config={{
              title: "Company Address",
              companyName: company.name,
              fields: [
                { label: "Address", value: form.address },
                { label: "City", value: form.city },
                { label: "State", value: form.state },
                { label: "Zip", value: form.zip },
                { label: "Phone", value: form.phone },
              ],
            }} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2 px-4 pb-4">
          <div className="field-group sm:col-span-2">
            <Label className="field-label">Address</Label>
            <Input className="h-8 text-sm" value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div className="field-group">
            <Label className="field-label">City</Label>
            <Input className="h-8 text-sm" value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field-group">
              <Label className="field-label">State</Label>
              <Select value={form.state} onValueChange={(v) => update("state", v)}>
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
              <Input className="h-8 text-sm" value={form.zip} onChange={(e) => update("zip", e.target.value)} />
            </div>
          </div>
          <div className="field-group">
            <Label className="field-label">Phone</Label>
            <Input className="h-8 text-sm" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
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

      {/* Sticky Save Bar */}
      <div className="sticky bottom-3 flex justify-end">
        <Button type="submit" disabled={save.isPending} size="sm" className="shadow-lg">
          {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
