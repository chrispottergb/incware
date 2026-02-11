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

  // Filing details form (lives on companies table per original manual's Org Info tab)
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

  // Directors (Initial List of Directors per manual)
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

  // Assets (Benefits, Vehicles/Equipment, Leases, Property)
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
    <div className="space-y-6">
      {/* Filing / Articles Details — matches original Org Info tab */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Filing & Articles Details</CardTitle>
          </div>
          <CardDescription>Information used to prepare articles of incorporation/organization</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveFiling.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">2nd Name Choice</Label>
                <Input value={filingForm.second_name_choice} onChange={(e) => setFilingForm((p) => ({ ...p, second_name_choice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Filing Date</Label>
                <Input type="date" value={filingForm.filing_date} onChange={(e) => setFilingForm((p) => ({ ...p, filing_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Delayed Effective Filing Date</Label>
                <Input type="date" value={filingForm.delayed_effective_filing_date} onChange={(e) => setFilingForm((p) => ({ ...p, delayed_effective_filing_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Business Purpose</Label>
                <Input value={filingForm.business_purpose} onChange={(e) => setFilingForm((p) => ({ ...p, business_purpose: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Accounting Method</Label>
                <Select value={filingForm.accounting_method} onValueChange={(v) => setFilingForm((p) => ({ ...p, accounting_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash basis">Cash Basis</SelectItem>
                    <SelectItem value="accrual">Accrual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">SIC Code</Label>
                <Input value={filingForm.sic_code} onChange={(e) => setFilingForm((p) => ({ ...p, sic_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">First Year Annual Meeting</Label>
                <Input type="number" value={filingForm.first_year_annual_meeting} onChange={(e) => setFilingForm((p) => ({ ...p, first_year_annual_meeting: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Initial # of Directors</Label>
                <Input type="number" value={filingForm.initial_directors_count} onChange={(e) => setFilingForm((p) => ({ ...p, initial_directors_count: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Max Directors Allowed</Label>
                <Input type="number" value={filingForm.max_directors_allowed} onChange={(e) => setFilingForm((p) => ({ ...p, max_directors_allowed: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Max VPs Allowed</Label>
                <Input type="number" value={filingForm.max_vps_allowed} onChange={(e) => setFilingForm((p) => ({ ...p, max_vps_allowed: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Additional Provisions</Label>
              <Textarea value={filingForm.additional_provisions} onChange={(e) => setFilingForm((p) => ({ ...p, additional_provisions: e.target.value }))} rows={3} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saveFiling.isPending} size="sm">
                {saveFiling.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Filing Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Initial List of Directors */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Initial List of Directors</CardTitle>
            </div>
            <CardDescription className="mt-1">Directors serve at the organizational meeting until the board is officially elected</CardDescription>
          </div>
          <Dialog open={directorDialog} onOpenChange={setDirectorDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Director</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addDirector.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Director Name</Label>
                  <Input
                    value={newDirector.name}
                    onChange={(e) => setNewDirector((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Business Address</Label>
                  <Input
                    value={newDirector.address}
                    onChange={(e) => setNewDirector((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input
                      value={newDirector.city}
                      onChange={(e) => setNewDirector((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">State</Label>
                    <Select value={newDirector.state} onValueChange={(v) => setNewDirector((p) => ({ ...p, state: v }))}>
                      <SelectTrigger><SelectValue placeholder="ST" /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
                    <Input
                      value={newDirector.zip}
                      onChange={(e) => setNewDirector((p) => ({ ...p, zip: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addDirector.isPending}>
                  {addDirector.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Director
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {directors.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No directors added yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Director Name</TableHead>
                    <TableHead>Business Address</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Zip</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {directors.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-muted-foreground">{d.address}</TableCell>
                      <TableCell className="text-muted-foreground">{d.city}</TableCell>
                      <TableCell className="text-muted-foreground">{d.state}</TableCell>
                      <TableCell className="text-muted-foreground">{d.zip}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteDirector.mutate(d.id)}
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Officers</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveOfficers.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">President</Label>
                <Input
                  value={officerForm.president}
                  onChange={(e) => setOfficerForm((p) => ({ ...p, president: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Vice President</Label>
                <Input
                  value={officerForm.vice_president}
                  onChange={(e) => setOfficerForm((p) => ({ ...p, vice_president: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Secretary</Label>
                <Input
                  value={officerForm.secretary}
                  onChange={(e) => setOfficerForm((p) => ({ ...p, secretary: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Treasurer</Label>
                <Input
                  value={officerForm.treasurer}
                  onChange={(e) => setOfficerForm((p) => ({ ...p, treasurer: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saveOfficers.isPending} size="sm">
                {saveOfficers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Officers
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Company Assets */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Assets</CardTitle>
            </div>
            <CardDescription className="mt-1">Benefits, Vehicles/Equipment, Leases, and Property</CardDescription>
          </div>
          <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Add Asset</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addAsset.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Asset Type</Label>
                  <Select value={newAsset.asset_type} onValueChange={(v) => setNewAsset((p) => ({ ...p, asset_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Description</Label>
                  <Input
                    value={newAsset.description}
                    onChange={(e) => setNewAsset((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Value ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newAsset.value}
                    onChange={(e) => setNewAsset((p) => ({ ...p, value: e.target.value }))}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={addAsset.isPending}>
                  {addAsset.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Asset
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Briefcase className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No assets added yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                          {a.asset_type}
                        </span>
                      </TableCell>
                      <TableCell>{a.description}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {a.value != null ? `$${Number(a.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAsset.mutate(a.id)}
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
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
