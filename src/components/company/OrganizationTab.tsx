import { useState } from "react";
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
import { Plus, Trash2, Loader2, Save, Users, Briefcase, FileText } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const ASSET_TYPES = [
  { value: "benefit", label: "Benefits" },
  { value: "vehicle", label: "Vehicles / Equipment" },
  { value: "lease", label: "Leases" },
  { value: "property", label: "Property" },
];

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
      setNewDirector({ name: "", address: "", city: "", state: "", zip: "" });
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
      queryClient.invalidateQueries({ queryKey: ["directors", companyId] });
      toast.success("Director removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Assets
  const { data: assets = [] } = useQuery({
    queryKey: ["company_assets", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_assets")
        .select("*")
        .eq("company_id", companyId)
        .order("asset_type");
      if (error) throw error;
      return data;
    },
  });

  const [assetDialog, setAssetDialog] = useState(false);
  const [newAsset, setNewAsset] = useState({
    asset_type: "benefit",
    description: "",
    value: "",
  });

  const addAsset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_assets").insert({
        company_id: companyId,
        asset_type: newAsset.asset_type,
        description: newAsset.description,
        value: newAsset.value ? parseFloat(newAsset.value) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId] });
      setAssetDialog(false);
      setNewAsset({ asset_type: "benefit", description: "", value: "" });
      toast.success("Asset added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId] });
      toast.success("Asset removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      {/* Filing & Articles Details */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">Filing & Articles Details</CardTitle>
          </div>
          <CardDescription className="text-[11px]">Information used to prepare articles of incorporation/organization</CardDescription>
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

      {/* Initial List of Directors */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Initial List of Directors</CardTitle>
            </div>
            <CardDescription className="text-[11px] mt-0.5">Directors serve at the organizational meeting until the board is officially elected</CardDescription>
          </div>
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
                    <Input className="h-8 text-sm" value={newDirector.zip} onChange={(e) => setNewDirector((p) => ({ ...p, zip: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={addDirector.isPending}>
                  {addDirector.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Add Director
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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

      {/* Officers */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">Officers</CardTitle>
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
              <div className="field-group">
                <Label className="field-label">President</Label>
                <Input className="h-8 text-sm" value={officerForm.president} onChange={(e) => setOfficerForm((p) => ({ ...p, president: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Vice President</Label>
                <Input className="h-8 text-sm" value={officerForm.vice_president} onChange={(e) => setOfficerForm((p) => ({ ...p, vice_president: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Secretary</Label>
                <Input className="h-8 text-sm" value={officerForm.secretary} onChange={(e) => setOfficerForm((p) => ({ ...p, secretary: e.target.value }))} />
              </div>
              <div className="field-group">
                <Label className="field-label">Treasurer</Label>
                <Input className="h-8 text-sm" value={officerForm.treasurer} onChange={(e) => setOfficerForm((p) => ({ ...p, treasurer: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saveOfficers.isPending} size="sm">
                {saveOfficers.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Officers
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Company Assets */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Assets</CardTitle>
            </div>
            <CardDescription className="text-[11px] mt-0.5">Benefits, Vehicles/Equipment, Leases, and Property</CardDescription>
          </div>
          <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-base">Add Asset</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addAsset.mutate();
                }}
                className="space-y-3"
              >
                <div className="field-group">
                  <Label className="field-label">Asset Type</Label>
                  <Select value={newAsset.asset_type} onValueChange={(v) => setNewAsset((p) => ({ ...p, asset_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Description</Label>
                  <Input className="h-8 text-sm" value={newAsset.description} onChange={(e) => setNewAsset((p) => ({ ...p, description: e.target.value }))} required />
                </div>
                <div className="field-group">
                  <Label className="field-label">Value ($)</Label>
                  <Input type="number" step="0.01" className="h-8 text-sm" value={newAsset.value} onChange={(e) => setNewAsset((p) => ({ ...p, value: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={addAsset.isPending}>
                  {addAsset.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Add Asset
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {assets.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-6 text-center">
              <Briefcase className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">No assets added yet</p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-semibold h-8">Type</TableHead>
                    <TableHead className="text-xs h-8">Description</TableHead>
                    <TableHead className="text-xs text-right h-8">Value</TableHead>
                    <TableHead className="w-10 h-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="py-2">
                        <span className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium capitalize text-primary">
                          {a.asset_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm py-2">{a.description}</TableCell>
                      <TableCell className="text-right font-mono text-xs py-2">
                        {a.value != null ? `$${Number(a.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button variant="ghost" size="icon" onClick={() => deleteAsset.mutate(a.id)} className="h-6 w-6 text-destructive/50 hover:text-destructive">
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
    </div>
  );
}
