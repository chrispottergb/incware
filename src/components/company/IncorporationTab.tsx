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
import { Loader2, Save, Shield, Building2, Share2, UserCheck } from "lucide-react";
import { toast } from "sonner";

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
      className="space-y-6"
    >
      {/* Corporate Status Verification */}
      <Card className="border-l-4 border-l-warning">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-warning" />
            <CardTitle className="font-display text-base">Verification of Corporate Status</CardTitle>
          </div>
          <CardDescription>Always verify corporate status with the Secretary of State</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Corporate Status</Label>
            <Select value={form.corporate_status} onValueChange={(v) => update("corporate_status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="delinquent">Delinquent</SelectItem>
                <SelectItem value="dissolved">Dissolved</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Verification Date</Label>
            <Input type="date" value={form.verification_date} onChange={(e) => update("verification_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Annual Report Filed Year</Label>
            <Input type="number" value={form.annual_report_year} onChange={(e) => update("annual_report_year", e.target.value)} placeholder="2024" />
          </div>
        </CardContent>
      </Card>

      {/* Company Information */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Company Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Entity Type</Label>
            <Select value={form.entity_type} onValueChange={(v) => update("entity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">State of Incorporation</Label>
            <Select value={form.state_of_incorporation} onValueChange={(v) => update("state_of_incorporation", v)}>
              <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Incorporation Date</Label>
            <Input type="date" value={form.incorporation_date} onChange={(e) => update("incorporation_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Fiscal Year End</Label>
            <Input value={form.fiscal_year_end} onChange={(e) => update("fiscal_year_end", e.target.value)} placeholder="December 31" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Scheduled Annual Meeting</Label>
            <Input value={form.scheduled_annual_meeting} onChange={(e) => update("scheduled_annual_meeting", e.target.value)} placeholder="1st Monday in April" />
          </div>
        </CardContent>
      </Card>

      {/* Shares & Elections */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Shares & Elections</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Authorized Shares</Label>
              <Input type="number" value={form.authorized_shares} onChange={(e) => update("authorized_shares", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Par Value Type</Label>
              <Select value={form.par_value_type} onValueChange={(v) => update("par_value_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="par">Par Value</SelectItem>
                  <SelectItem value="no_par">No Par Value</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.par_value_type === "par" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Par Value ($)</Label>
                <Input type="number" step="0.01" value={form.par_value} onChange={(e) => update("par_value", e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">S-Election Date</Label>
              <Input type="date" value={form.s_election_date} onChange={(e) => update("s_election_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Seal</Label>
              <Select value={form.seal_type} onValueChange={(v) => update("seal_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seal">Seal</SelectItem>
                  <SelectItem value="no_seal">No Seal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Checkbox
              id="election_1244"
              checked={form.election_1244}
              onCheckedChange={(v) => update("election_1244", !!v)}
            />
            <div>
              <Label htmlFor="election_1244" className="cursor-pointer font-medium">Section 1244 Election</Label>
              <p className="text-xs text-muted-foreground">A loss on Section 1244 stock is treated as an ordinary loss</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registered Agent */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Registered Agent</CardTitle>
          </div>
          <CardDescription>Statutory agent on file with the Secretary of State for service of process</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Agent Name</Label>
            <Input value={form.registered_agent_name} onChange={(e) => update("registered_agent_name", e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Address</Label>
            <Input value={form.registered_agent_address} onChange={(e) => update("registered_agent_address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">City</Label>
            <Input value={form.registered_agent_city} onChange={(e) => update("registered_agent_city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">State</Label>
              <Select value={form.registered_agent_state} onValueChange={(v) => update("registered_agent_state", v)}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
              <Input value={form.registered_agent_zip} onChange={(e) => update("registered_agent_zip", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Address */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Company Address</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-medium text-muted-foreground">Address</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">City</Label>
            <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">State</Label>
              <Select value={form.state} onValueChange={(v) => update("state", v)}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
              <Input value={form.zip} onChange={(e) => update("zip", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-4 flex justify-end">
        <Button type="submit" disabled={save.isPending} size="lg" className="shadow-lg">
          {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}
