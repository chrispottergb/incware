import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, Loader2, Save, Users, Briefcase } from "lucide-react";
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
}

export default function OrganizationTab({ companyId }: Props) {
  const queryClient = useQueryClient();

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

  // Sync form when data loads
  const officersLoaded = officers !== undefined;
  useState(() => {
    if (officers) {
      setOfficerForm({
        president: officers.president ?? "",
        vice_president: officers.vice_president ?? "",
        secretary: officers.secretary ?? "",
        treasurer: officers.treasurer ?? "",
      });
    }
  });

  // Re-sync when officers data changes
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
    <div className="space-y-6">
      {/* Officers */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Officers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveOfficers.mutate();
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>President</Label>
              <Input
                value={officerForm.president}
                onChange={(e) => setOfficerForm((p) => ({ ...p, president: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Vice President</Label>
              <Input
                value={officerForm.vice_president}
                onChange={(e) => setOfficerForm((p) => ({ ...p, vice_president: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Secretary</Label>
              <Input
                value={officerForm.secretary}
                onChange={(e) => setOfficerForm((p) => ({ ...p, secretary: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Treasurer</Label>
              <Input
                value={officerForm.treasurer}
                onChange={(e) => setOfficerForm((p) => ({ ...p, treasurer: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={saveOfficers.isPending} size="sm">
                {saveOfficers.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Officers
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Directors */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Directors
          </CardTitle>
          <Dialog open={directorDialog} onOpenChange={setDirectorDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add Director
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
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={newDirector.name}
                    onChange={(e) => setNewDirector((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    value={newDirector.address}
                    onChange={(e) => setNewDirector((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={newDirector.city}
                      onChange={(e) => setNewDirector((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <Select value={newDirector.state} onValueChange={(v) => setNewDirector((p) => ({ ...p, state: v }))}>
                      <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Zip</Label>
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
            <p className="text-sm text-muted-foreground py-4 text-center">No directors added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
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
                    <TableCell>{d.address}</TableCell>
                    <TableCell>{d.city}</TableCell>
                    <TableCell>{d.state}</TableCell>
                    <TableCell>{d.zip}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDirector.mutate(d.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Company Assets */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" /> Assets
          </CardTitle>
          <Dialog open={assetDialog} onOpenChange={setAssetDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" /> Add Asset
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
                <div className="space-y-2">
                  <Label>Asset Type</Label>
                  <Select value={newAsset.asset_type} onValueChange={(v) => setNewAsset((p) => ({ ...p, asset_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSET_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={newAsset.description}
                    onChange={(e) => setNewAsset((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value ($)</Label>
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
            <p className="text-sm text-muted-foreground py-4 text-center">No assets added yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="capitalize">{a.asset_type}</TableCell>
                    <TableCell>{a.description}</TableCell>
                    <TableCell className="text-right">
                      {a.value != null ? `$${Number(a.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteAsset.mutate(a.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
