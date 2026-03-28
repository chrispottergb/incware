import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  DialogDescription,
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
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
}

interface AssetForm {
  year_make_model: string;
  asset_type: string;
  transaction_type: string;
  vin: string;
  date: string;
  amount: string;
  seller: string;
  business_use_description: string;
  authorized_drivers: string;
  notes: string;
}

const emptyAsset: AssetForm = {
  year_make_model: "",
  asset_type: "Vehicle",
  transaction_type: "Purchased",
  vin: "",
  date: "",
  amount: "",
  seller: "",
  business_use_description: "",
  authorized_drivers: "",
  notes: "",
};

// ── Lease Termination form ──
interface LeaseTermForm {
  property_description: string;
  landlord_name: string;
  lease_end_date: string;
  termination_reason: string;
  early_termination: boolean;
  penalty_amount: string;
  notes: string;
}
const emptyLeaseTerm: LeaseTermForm = {
  property_description: "", landlord_name: "", lease_end_date: "",
  termination_reason: "", early_termination: false, penalty_amount: "", notes: "",
};

const transactionColors: Record<string, string> = {
  Purchased: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Leased: "bg-blue-100 text-blue-800 border-blue-200",
  Sold: "bg-amber-100 text-amber-800 border-amber-200",
  "Trade-in": "bg-purple-100 text-purple-800 border-purple-200",
};

const typeColors: Record<string, string> = {
  Vehicle: "bg-slate-100 text-slate-800 border-slate-200",
  Equipment: "bg-orange-100 text-orange-800 border-orange-200",
};

export default function MeetingVehicles({ meetingId }: Props) {
  const queryClient = useQueryClient();

  const [assetOpen, setAssetOpen] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAsset);

  const [leaseTermOpen, setLeaseTermOpen] = useState(false);
  const [editingLeaseTermId, setEditingLeaseTermId] = useState<string | null>(null);
  const [leaseTermForm, setLeaseTermForm] = useState<LeaseTermForm>(emptyLeaseTerm);

  // ── Query unified assets ──
  const { data: assets = [] } = useQuery({
    queryKey: ["meeting_vehicle_purchases", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_vehicle_purchases" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: leaseTerminations = [] } = useQuery({
    queryKey: ["meeting_lease_terminations", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_lease_terminations" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Asset mutations ──
  const addAsset = useMutation({
    mutationFn: async () => {
      const payload: any = {
        meeting_id: meetingId,
        year_make_model: assetForm.year_make_model,
        asset_type: assetForm.asset_type,
        transaction_type: assetForm.transaction_type,
        vin: assetForm.vin || null,
        purchase_date: assetForm.purchase_date || null,
        purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
        seller: assetForm.seller || null,
        business_use_description: assetForm.business_use_description || null,
        authorized_drivers: assetForm.authorized_drivers || null,
        notes: assetForm.notes || null,
      };
      const { error } = await supabase.from("meeting_vehicle_purchases" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      closeAssetDialog();
      toast.success("Capital asset added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAsset = useMutation({
    mutationFn: async () => {
      const payload: any = {
        year_make_model: assetForm.year_make_model,
        asset_type: assetForm.asset_type,
        transaction_type: assetForm.transaction_type,
        vin: assetForm.vin || null,
        purchase_date: assetForm.purchase_date || null,
        purchase_price: assetForm.purchase_price ? parseFloat(assetForm.purchase_price) : null,
        seller: assetForm.seller || null,
        business_use_description: assetForm.business_use_description || null,
        authorized_drivers: assetForm.authorized_drivers || null,
        notes: assetForm.notes || null,
      };
      const { error } = await supabase
        .from("meeting_vehicle_purchases" as any)
        .update(payload as any)
        .eq("id", editingAssetId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      closeAssetDialog();
      toast.success("Capital asset updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAsset = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_vehicle_purchases" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      toast.success("Capital asset removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Lease Termination mutations ──
  const addLeaseTerm = useMutation({
    mutationFn: async () => {
      const payload: any = {
        meeting_id: meetingId,
        property_description: leaseTermForm.property_description,
        landlord_name: leaseTermForm.landlord_name || null,
        lease_end_date: leaseTermForm.lease_end_date || null,
        termination_reason: leaseTermForm.termination_reason || null,
        early_termination: leaseTermForm.early_termination,
        penalty_amount: leaseTermForm.penalty_amount ? parseFloat(leaseTermForm.penalty_amount) : null,
        notes: leaseTermForm.notes || null,
      };
      const { error } = await supabase.from("meeting_lease_terminations" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_lease_terminations", meetingId] });
      closeLeaseTermDialog();
      toast.success("Lease termination added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateLeaseTerm = useMutation({
    mutationFn: async () => {
      const payload: any = {
        property_description: leaseTermForm.property_description,
        landlord_name: leaseTermForm.landlord_name || null,
        lease_end_date: leaseTermForm.lease_end_date || null,
        termination_reason: leaseTermForm.termination_reason || null,
        early_termination: leaseTermForm.early_termination,
        penalty_amount: leaseTermForm.penalty_amount ? parseFloat(leaseTermForm.penalty_amount) : null,
        notes: leaseTermForm.notes || null,
      };
      const { error } = await supabase.from("meeting_lease_terminations" as any).update(payload as any).eq("id", editingLeaseTermId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_lease_terminations", meetingId] });
      closeLeaseTermDialog();
      toast.success("Lease termination updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLeaseTerm = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_lease_terminations" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_lease_terminations", meetingId] });
      toast.success("Lease termination removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Helpers ──
  const closeAssetDialog = () => { setAssetOpen(false); setEditingAssetId(null); setAssetForm(emptyAsset); };
  const closeLeaseTermDialog = () => { setLeaseTermOpen(false); setEditingLeaseTermId(null); setLeaseTermForm(emptyLeaseTerm); };

  const openEditAsset = (row: any) => {
    setEditingAssetId(row.id);
    setAssetForm({
      year_make_model: row.year_make_model || "",
      asset_type: row.asset_type || "Vehicle",
      transaction_type: row.transaction_type || "Purchased",
      vin: row.vin || "",
      purchase_date: row.purchase_date || "",
      purchase_price: row.purchase_price?.toString() || "",
      seller: row.seller || "",
      business_use_description: row.business_use_description || "",
      authorized_drivers: row.authorized_drivers || "",
      notes: row.notes || "",
    });
    setAssetOpen(true);
  };

  const openEditLeaseTerm = (row: any) => {
    setEditingLeaseTermId(row.id);
    setLeaseTermForm({
      property_description: row.property_description || "",
      landlord_name: row.landlord_name || "",
      lease_end_date: row.lease_end_date || "",
      termination_reason: row.termination_reason || "",
      early_termination: row.early_termination || false,
      penalty_amount: row.penalty_amount?.toString() || "",
      notes: row.notes || "",
    });
    setLeaseTermOpen(true);
  };

  const fmt = (v: any) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString() : "—";

  const af = (key: keyof AssetForm, value: string | boolean) => setAssetForm(prev => ({ ...prev, [key]: value as any }));
  const ltf = (key: keyof LeaseTermForm, value: string | boolean) => setLeaseTermForm(prev => ({ ...prev, [key]: value }));

  const sellerLabel = assetForm.transaction_type === "Sold" ? "Buyer" : assetForm.transaction_type === "Leased" ? "Lessor" : "Seller";

  return (
    <div className="space-y-6">
      {/* ════ Unified Capital Asset Additions ════ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Capital Asset Additions During the Year</CardTitle>
          <Dialog open={assetOpen} onOpenChange={(open) => { if (!open) closeAssetDialog(); else setAssetOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingAssetId(null); setAssetForm(emptyAsset); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingAssetId ? "Edit Capital Asset" : "Add Capital Asset"}</DialogTitle>
                <DialogDescription>Record a capital asset transaction during the year.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); editingAssetId ? updateAsset.mutate() : addAsset.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Year / Make / Model</Label>
                    <Input value={assetForm.year_make_model} onChange={(e) => af("year_make_model", e.target.value)} placeholder="e.g., 2024 Ford F-150" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                    <Select value={assetForm.asset_type} onValueChange={(v) => af("asset_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vehicle">Vehicle</SelectItem>
                        <SelectItem value="Equipment">Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Transaction</Label>
                    <Select value={assetForm.transaction_type} onValueChange={(v) => af("transaction_type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Purchased">Purchased</SelectItem>
                        <SelectItem value="Leased">Leased</SelectItem>
                        <SelectItem value="Sold">Sold</SelectItem>
                        <SelectItem value="Trade-in">Trade-in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">VIN / Serial No.</Label>
                    <Input value={assetForm.vin} onChange={(e) => af("vin", e.target.value)} placeholder="Identification number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                    <DatePickerField value={assetForm.purchase_date} onChange={(v) => af("purchase_date", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Price ($)</Label>
                    <Input type="number" step="0.01" value={assetForm.purchase_price} onChange={(e) => af("purchase_price", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">{sellerLabel}</Label>
                    <Input value={assetForm.seller} onChange={(e) => af("seller", e.target.value)} placeholder={`Name of ${sellerLabel.toLowerCase()}`} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Business Use Description</Label>
                    <Textarea value={assetForm.business_use_description} onChange={(e) => af("business_use_description", e.target.value)} rows={2} placeholder="Describe the business use…" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                    <Textarea value={assetForm.notes} onChange={(e) => af("notes", e.target.value)} rows={2} placeholder="Additional notes…" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addAsset.isPending || updateAsset.isPending || !assetForm.year_make_model}>
                  {(addAsset.isPending || updateAsset.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAssetId ? "Save Changes" : "Add Asset"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No capital assets recorded</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Year / Make / Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>VIN / Serial No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Seller / Buyer</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm whitespace-nowrap">{row.year_make_model || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${typeColors[row.asset_type] || ""}`}>
                          {row.asset_type || "Vehicle"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${transactionColors[row.transaction_type] || ""}`}>
                          {row.transaction_type || "Purchased"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{row.vin || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{fmtDate(row.purchase_date)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(row.purchase_price)}</TableCell>
                      <TableCell className="text-sm">{row.seller || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditAsset(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteAsset.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════ Leases Ended ════ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Leases Ended During the Year</CardTitle>
          <Dialog open={leaseTermOpen} onOpenChange={(open) => { if (!open) closeLeaseTermDialog(); else setLeaseTermOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingLeaseTermId(null); setLeaseTermForm(emptyLeaseTerm); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Termination
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingLeaseTermId ? "Edit Lease Termination" : "Add Lease Termination"}</DialogTitle>
                <DialogDescription>Record a lease that ended or was terminated during the year.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); editingLeaseTermId ? updateLeaseTerm.mutate() : addLeaseTerm.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Property / Vehicle Description</Label>
                    <Input value={leaseTermForm.property_description} onChange={(e) => ltf("property_description", e.target.value)} placeholder="e.g., Office at 123 Main St or 2022 Toyota Camry" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Landlord / Lessor Name</Label>
                    <Input value={leaseTermForm.landlord_name} onChange={(e) => ltf("landlord_name", e.target.value)} placeholder="Name of landlord or lessor" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Lease End Date</Label>
                    <DatePickerField value={leaseTermForm.lease_end_date} onChange={(v) => ltf("lease_end_date", v)} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Reason for Termination</Label>
                    <Input value={leaseTermForm.termination_reason} onChange={(e) => ltf("termination_reason", e.target.value)} placeholder="e.g., Lease expired, Relocated, Early termination" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Checkbox
                      id="early_termination"
                      checked={leaseTermForm.early_termination}
                      onCheckedChange={(checked) => ltf("early_termination", !!checked)}
                    />
                    <Label htmlFor="early_termination" className="text-sm cursor-pointer">Early Termination</Label>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Penalty Amount ($)</Label>
                    <Input type="number" step="0.01" value={leaseTermForm.penalty_amount} onChange={(e) => ltf("penalty_amount", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                    <Textarea value={leaseTermForm.notes} onChange={(e) => ltf("notes", e.target.value)} rows={2} placeholder="Additional notes…" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addLeaseTerm.isPending || updateLeaseTerm.isPending || !leaseTermForm.property_description}>
                  {(addLeaseTerm.isPending || updateLeaseTerm.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingLeaseTermId ? "Save Changes" : "Add Termination"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {leaseTerminations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No lease terminations recorded</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Property / Vehicle</TableHead>
                    <TableHead>Landlord / Lessor</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Early?</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaseTerminations.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.property_description || "—"}</TableCell>
                      <TableCell className="text-sm">{row.landlord_name || "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(row.lease_end_date)}</TableCell>
                      <TableCell className="text-sm">{row.termination_reason || "—"}</TableCell>
                      <TableCell className="text-xs">{row.early_termination ? "Yes" : "No"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditLeaseTerm(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLeaseTerm.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
