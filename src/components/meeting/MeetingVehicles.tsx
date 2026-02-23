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

// ── Purchase form ──
interface PurchaseForm {
  year_make_model: string;
  vin: string;
  purchase_date: string;
  purchase_price: string;
  seller: string;
  business_use_description: string;
  authorized_drivers: string;
  notes: string;
}
const emptyPurchase: PurchaseForm = {
  year_make_model: "", vin: "", purchase_date: "", purchase_price: "",
  seller: "", business_use_description: "", authorized_drivers: "", notes: "",
};

// ── Lease form ──
interface LeaseForm {
  year_make_model: string;
  vin: string;
  lease_start_date: string;
  monthly_lease_payment: string;
  lessor_name: string;
  relationship_to_company: string;
  fmv_verified: boolean;
  fmv_notes: string;
  business_use_description: string;
  notes: string;
}
const emptyLease: LeaseForm = {
  year_make_model: "", vin: "", lease_start_date: "", monthly_lease_payment: "",
  lessor_name: "", relationship_to_company: "", fmv_verified: false, fmv_notes: "",
  business_use_description: "", notes: "",
};

export default function MeetingVehicles({ meetingId }: Props) {
  const queryClient = useQueryClient();

  // ── Purchases state ──
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseForm>(emptyPurchase);

  // ── Leases state ──
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [editingLeaseId, setEditingLeaseId] = useState<string | null>(null);
  const [leaseForm, setLeaseForm] = useState<LeaseForm>(emptyLease);

  // ── Queries ──
  const { data: purchases = [] } = useQuery({
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

  const { data: leases = [] } = useQuery({
    queryKey: ["meeting_vehicle_leases", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_vehicle_leases" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  // ── Purchase mutations ──
  const addPurchase = useMutation({
    mutationFn: async () => {
      const payload: any = {
        meeting_id: meetingId,
        year_make_model: purchaseForm.year_make_model,
        vin: purchaseForm.vin || null,
        purchase_date: purchaseForm.purchase_date || null,
        purchase_price: purchaseForm.purchase_price ? parseFloat(purchaseForm.purchase_price) : null,
        seller: purchaseForm.seller || null,
        business_use_description: purchaseForm.business_use_description || null,
        authorized_drivers: purchaseForm.authorized_drivers || null,
        notes: purchaseForm.notes || null,
      };
      const { error } = await supabase.from("meeting_vehicle_purchases" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      closePurchaseDialog();
      toast.success("Vehicle purchase added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updatePurchase = useMutation({
    mutationFn: async () => {
      const payload: any = {
        year_make_model: purchaseForm.year_make_model,
        vin: purchaseForm.vin || null,
        purchase_date: purchaseForm.purchase_date || null,
        purchase_price: purchaseForm.purchase_price ? parseFloat(purchaseForm.purchase_price) : null,
        seller: purchaseForm.seller || null,
        business_use_description: purchaseForm.business_use_description || null,
        authorized_drivers: purchaseForm.authorized_drivers || null,
        notes: purchaseForm.notes || null,
      };
      const { error } = await supabase
        .from("meeting_vehicle_purchases" as any)
        .update(payload as any)
        .eq("id", editingPurchaseId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      closePurchaseDialog();
      toast.success("Vehicle purchase updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deletePurchase = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_vehicle_purchases" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_purchases", meetingId] });
      toast.success("Vehicle purchase removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Lease mutations ──
  const addLease = useMutation({
    mutationFn: async () => {
      const payload: any = {
        meeting_id: meetingId,
        year_make_model: leaseForm.year_make_model,
        vin: leaseForm.vin || null,
        lease_start_date: leaseForm.lease_start_date || null,
        monthly_lease_payment: leaseForm.monthly_lease_payment ? parseFloat(leaseForm.monthly_lease_payment) : null,
        lessor_name: leaseForm.lessor_name || null,
        relationship_to_company: leaseForm.relationship_to_company || null,
        fmv_verified: leaseForm.fmv_verified,
        fmv_notes: leaseForm.fmv_notes || null,
        business_use_description: leaseForm.business_use_description || null,
        notes: leaseForm.notes || null,
      };
      const { error } = await supabase.from("meeting_vehicle_leases" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_leases", meetingId] });
      closeLeaseDialog();
      toast.success("Vehicle lease added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateLease = useMutation({
    mutationFn: async () => {
      const payload: any = {
        year_make_model: leaseForm.year_make_model,
        vin: leaseForm.vin || null,
        lease_start_date: leaseForm.lease_start_date || null,
        monthly_lease_payment: leaseForm.monthly_lease_payment ? parseFloat(leaseForm.monthly_lease_payment) : null,
        lessor_name: leaseForm.lessor_name || null,
        relationship_to_company: leaseForm.relationship_to_company || null,
        fmv_verified: leaseForm.fmv_verified,
        fmv_notes: leaseForm.fmv_notes || null,
        business_use_description: leaseForm.business_use_description || null,
        notes: leaseForm.notes || null,
      };
      const { error } = await supabase
        .from("meeting_vehicle_leases" as any)
        .update(payload as any)
        .eq("id", editingLeaseId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_leases", meetingId] });
      closeLeaseDialog();
      toast.success("Vehicle lease updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLease = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_vehicle_leases" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_vehicle_leases", meetingId] });
      toast.success("Vehicle lease removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Helpers ──
  const closePurchaseDialog = () => { setPurchaseOpen(false); setEditingPurchaseId(null); setPurchaseForm(emptyPurchase); };
  const closeLeaseDialog = () => { setLeaseOpen(false); setEditingLeaseId(null); setLeaseForm(emptyLease); };

  const openEditPurchase = (row: any) => {
    setEditingPurchaseId(row.id);
    setPurchaseForm({
      year_make_model: row.year_make_model || "",
      vin: row.vin || "",
      purchase_date: row.purchase_date || "",
      purchase_price: row.purchase_price?.toString() || "",
      seller: row.seller || "",
      business_use_description: row.business_use_description || "",
      authorized_drivers: row.authorized_drivers || "",
      notes: row.notes || "",
    });
    setPurchaseOpen(true);
  };

  const openEditLease = (row: any) => {
    setEditingLeaseId(row.id);
    setLeaseForm({
      year_make_model: row.year_make_model || "",
      vin: row.vin || "",
      lease_start_date: row.lease_start_date || "",
      monthly_lease_payment: row.monthly_lease_payment?.toString() || "",
      lessor_name: row.lessor_name || "",
      relationship_to_company: row.relationship_to_company || "",
      fmv_verified: row.fmv_verified || false,
      fmv_notes: row.fmv_notes || "",
      business_use_description: row.business_use_description || "",
      notes: row.notes || "",
    });
    setLeaseOpen(true);
  };

  const fmt = (v: any) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString() : "—";

  const pf = (key: keyof PurchaseForm, value: string) => setPurchaseForm(prev => ({ ...prev, [key]: value }));
  const lf = (key: keyof LeaseForm, value: string | boolean) => setLeaseForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* ════ Section 1: Vehicle Purchases ════ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Vehicle Purchases During the Year</CardTitle>
          <Dialog open={purchaseOpen} onOpenChange={(open) => { if (!open) closePurchaseDialog(); else setPurchaseOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingPurchaseId(null); setPurchaseForm(emptyPurchase); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Purchase
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingPurchaseId ? "Edit Vehicle Purchase" : "Add Vehicle Purchase"}</DialogTitle>
                <DialogDescription>Record a vehicle purchase made during the year.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); editingPurchaseId ? updatePurchase.mutate() : addPurchase.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Year / Make / Model</Label>
                    <Input value={purchaseForm.year_make_model} onChange={(e) => pf("year_make_model", e.target.value)} placeholder="e.g., 2024 Ford F-150" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">VIN</Label>
                    <Input value={purchaseForm.vin} onChange={(e) => pf("vin", e.target.value)} placeholder="Vehicle Identification Number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Purchase Date</Label>
                    <DatePickerField value={purchaseForm.purchase_date} onChange={(v) => pf("purchase_date", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Purchase Price ($)</Label>
                    <Input type="number" step="0.01" value={purchaseForm.purchase_price} onChange={(e) => pf("purchase_price", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Seller (Dealership or Individual)</Label>
                    <Input value={purchaseForm.seller} onChange={(e) => pf("seller", e.target.value)} placeholder="Name of seller" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Business Use Description</Label>
                    <Textarea value={purchaseForm.business_use_description} onChange={(e) => pf("business_use_description", e.target.value)} rows={2} placeholder="Describe the business use of this vehicle…" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Authorized Drivers</Label>
                    <Input value={purchaseForm.authorized_drivers} onChange={(e) => pf("authorized_drivers", e.target.value)} placeholder="e.g., John Doe, Jane Doe" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                    <Textarea value={purchaseForm.notes} onChange={(e) => pf("notes", e.target.value)} rows={2} placeholder="Additional notes…" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addPurchase.isPending || updatePurchase.isPending || !purchaseForm.year_make_model}>
                  {(addPurchase.isPending || updatePurchase.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingPurchaseId ? "Save Changes" : "Add Purchase"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No vehicle purchases recorded</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Year / Make / Model</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.year_make_model || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{row.vin || "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(row.purchase_date)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(row.purchase_price)}</TableCell>
                      <TableCell className="text-sm">{row.seller || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditPurchase(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deletePurchase.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
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

      {/* ════ Section 2: Vehicle Leases ════ */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Vehicle Leases Entered Into During the Year</CardTitle>
          <Dialog open={leaseOpen} onOpenChange={(open) => { if (!open) closeLeaseDialog(); else setLeaseOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingLeaseId(null); setLeaseForm(emptyLease); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Lease
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingLeaseId ? "Edit Vehicle Lease" : "Add Vehicle Lease"}</DialogTitle>
                <DialogDescription>Record a vehicle lease entered into during the year.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); editingLeaseId ? updateLease.mutate() : addLease.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Year / Make / Model</Label>
                    <Input value={leaseForm.year_make_model} onChange={(e) => lf("year_make_model", e.target.value)} placeholder="e.g., 2024 Toyota Camry" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">VIN</Label>
                    <Input value={leaseForm.vin} onChange={(e) => lf("vin", e.target.value)} placeholder="Vehicle Identification Number" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Lease Start Date</Label>
                    <DatePickerField value={leaseForm.lease_start_date} onChange={(v) => lf("lease_start_date", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Monthly Lease Payment ($)</Label>
                    <Input type="number" step="0.01" value={leaseForm.monthly_lease_payment} onChange={(e) => lf("monthly_lease_payment", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Lessor Name</Label>
                    <Input value={leaseForm.lessor_name} onChange={(e) => lf("lessor_name", e.target.value)} placeholder="Name of lessor" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Relationship to Company (if any)</Label>
                    <Input value={leaseForm.relationship_to_company} onChange={(e) => lf("relationship_to_company", e.target.value)} placeholder="e.g., Owner, Officer, Related Entity" />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <Checkbox
                      id="fmv_verified"
                      checked={leaseForm.fmv_verified}
                      onCheckedChange={(checked) => lf("fmv_verified", !!checked)}
                    />
                    <Label htmlFor="fmv_verified" className="text-sm cursor-pointer">Fair Market Value Verified</Label>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">FMV Notes</Label>
                    <Input value={leaseForm.fmv_notes} onChange={(e) => lf("fmv_notes", e.target.value)} placeholder="FMV confirmation details…" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Business Use Description</Label>
                    <Textarea value={leaseForm.business_use_description} onChange={(e) => lf("business_use_description", e.target.value)} rows={2} placeholder="Describe the business use…" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                    <Textarea value={leaseForm.notes} onChange={(e) => lf("notes", e.target.value)} rows={2} placeholder="Additional notes…" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addLease.isPending || updateLease.isPending || !leaseForm.year_make_model}>
                  {(addLease.isPending || updateLease.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingLeaseId ? "Save Changes" : "Add Lease"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No vehicle leases recorded</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Year / Make / Model</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Lease Start</TableHead>
                    <TableHead className="text-right">Monthly Payment</TableHead>
                    <TableHead>Lessor</TableHead>
                    <TableHead>FMV</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leases.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.year_make_model || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{row.vin || "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(row.lease_start_date)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{fmt(row.monthly_lease_payment)}</TableCell>
                      <TableCell className="text-sm">{row.lessor_name || "—"}</TableCell>
                      <TableCell className="text-xs">{row.fmv_verified ? "✓ Verified" : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditLease(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteLease.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
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
