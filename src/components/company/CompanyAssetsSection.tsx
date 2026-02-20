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
import { Plus, Trash2, Loader2, Briefcase, Car, Wrench, FileText, Home, Pencil } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";

const ASSET_TABS = [
  { key: "vehicle", label: "Vehicles", icon: Car },
  { key: "equipment", label: "Equipment", icon: Wrench },
  { key: "lease", label: "Leases", icon: FileText },
  { key: "property", label: "Property", icon: Home },
] as const;

type AssetTab = (typeof ASSET_TABS)[number]["key"];

interface Props {
  companyId: string;
  companyName?: string;
}

export default function CompanyAssetsSection({ companyId, companyName = "" }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AssetTab>("vehicle");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state for each type — updated with new fields
  const [vehicleForm, setVehicleForm] = useState({ year: "", make: "", model: "", cost: "", ownership_type: "owned", description: "", vin: "", purchase_date: "", purchase_amount: "" });
  const [equipmentForm, setEquipmentForm] = useState({ year: "", make: "", model: "", running_hours: "", manufacturer: "", ownership_type: "owned", description: "", purchase_date: "", purchase_amount: "", lease_date: "", lease_amount: "" });
  const [leaseForm, setLeaseForm] = useState({ description: "", value: "", address: "", landlord_name: "", landlord_address: "", lease_start_date: "", lease_end_date: "", lease_term: "", monthly_payment: "" });
  const [propertyForm, setPropertyForm] = useState({ address: "", address_2: "", finance_company: "", escrow: "", mortgage: "", taxes: "", description: "" });

  const { data: allAssets = [] } = useQuery({
    queryKey: ["company_assets", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_assets")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const assets = allAssets.filter((a) => a.asset_type === activeTab);

  const saveAsset = useMutation({
    mutationFn: async () => {
      let payload: any = { asset_type: activeTab };

      if (activeTab === "vehicle") {
        payload = {
          ...payload, year: vehicleForm.year || null, make: vehicleForm.make || null,
          model: vehicleForm.model || null, cost: vehicleForm.cost ? parseFloat(vehicleForm.cost) : null,
          ownership_type: vehicleForm.ownership_type, vin: vehicleForm.vin || null,
          purchase_date: vehicleForm.purchase_date || null,
          purchase_amount: vehicleForm.purchase_amount ? parseFloat(vehicleForm.purchase_amount) : null,
          description: `${vehicleForm.year} ${vehicleForm.make} ${vehicleForm.model}`.trim() || "Vehicle",
        };
      } else if (activeTab === "equipment") {
        payload = {
          ...payload, year: equipmentForm.year || null, make: equipmentForm.make || null,
          model: equipmentForm.model || null, running_hours: equipmentForm.running_hours ? parseFloat(equipmentForm.running_hours) : null,
          manufacturer: equipmentForm.manufacturer || null, ownership_type: equipmentForm.ownership_type,
          purchase_date: equipmentForm.purchase_date || null,
          purchase_amount: equipmentForm.purchase_amount ? parseFloat(equipmentForm.purchase_amount) : null,
          lease_date: equipmentForm.lease_date || null,
          lease_amount: equipmentForm.lease_amount ? parseFloat(equipmentForm.lease_amount) : null,
          description: equipmentForm.description || `${equipmentForm.manufacturer || ""} ${equipmentForm.make || ""} ${equipmentForm.model || ""}`.trim() || "Equipment",
        };
      } else if (activeTab === "lease") {
        payload = {
          ...payload,
          description: leaseForm.description,
          value: leaseForm.value ? parseFloat(leaseForm.value) : null,
          address: leaseForm.address || null,
          landlord_name: (leaseForm as any).landlord_name || null,
          landlord_address: (leaseForm as any).landlord_address || null,
          lease_start_date: (leaseForm as any).lease_start_date || null,
          lease_end_date: (leaseForm as any).lease_end_date || null,
          lease_term: (leaseForm as any).lease_term || null,
          monthly_payment: (leaseForm as any).monthly_payment ? parseFloat((leaseForm as any).monthly_payment) : null,
        } as any;
      } else if (activeTab === "property") {
      payload = {
          ...payload, address: propertyForm.address || null, address_2: propertyForm.address_2 || null,
          finance_company: propertyForm.finance_company || null,
          escrow: propertyForm.escrow ? parseFloat(propertyForm.escrow) : null,
          mortgage: propertyForm.mortgage ? parseFloat(propertyForm.mortgage) : null,
          taxes: propertyForm.taxes ? parseFloat(propertyForm.taxes) : null,
          description: propertyForm.address || "Property",
        };
      }

      if (editId) {
        const { error } = await supabase.from("company_assets").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_assets").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Asset updated!" : "Asset added!");
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

  const resetForm = () => {
    setVehicleForm({ year: "", make: "", model: "", cost: "", ownership_type: "owned", description: "", vin: "", purchase_date: "", purchase_amount: "" });
    setEquipmentForm({ year: "", make: "", model: "", running_hours: "", manufacturer: "", ownership_type: "owned", description: "", purchase_date: "", purchase_amount: "", lease_date: "", lease_amount: "" });
    setLeaseForm({ description: "", value: "", address: "", landlord_name: "", landlord_address: "", lease_start_date: "", lease_end_date: "", lease_term: "", monthly_payment: "" });
    setPropertyForm({ address: "", address_2: "", finance_company: "", escrow: "", mortgage: "", taxes: "", description: "" });
    setEditId(null);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setActiveTab(a.asset_type as AssetTab);
    if (a.asset_type === "vehicle") {
      setVehicleForm({ year: a.year || "", make: a.make || "", model: a.model || "", cost: a.cost != null ? String(a.cost) : "", ownership_type: a.ownership_type || "owned", description: a.description || "", vin: a.vin || "", purchase_date: a.purchase_date || "", purchase_amount: a.purchase_amount != null ? String(a.purchase_amount) : "" });
    } else if (a.asset_type === "equipment") {
      setEquipmentForm({ year: a.year || "", make: a.make || "", model: a.model || "", running_hours: a.running_hours != null ? String(a.running_hours) : "", manufacturer: a.manufacturer || "", ownership_type: a.ownership_type || "owned", description: a.description || "", purchase_date: a.purchase_date || "", purchase_amount: a.purchase_amount != null ? String(a.purchase_amount) : "", lease_date: a.lease_date || "", lease_amount: a.lease_amount != null ? String(a.lease_amount) : "" });
    } else if (a.asset_type === "lease") {
      setLeaseForm({ description: a.description || "", value: a.value != null ? String(a.value) : "", address: a.address || "", landlord_name: (a as any).landlord_name || "", landlord_address: (a as any).landlord_address || "", lease_start_date: (a as any).lease_start_date || "", lease_end_date: (a as any).lease_end_date || "", lease_term: (a as any).lease_term || "", monthly_payment: (a as any).monthly_payment != null ? String((a as any).monthly_payment) : "" });
    } else if (a.asset_type === "property") {
      setPropertyForm({ address: a.address || "", address_2: (a as any).address_2 || "", finance_company: a.finance_company || "", escrow: a.escrow != null ? String(a.escrow) : "", mortgage: a.mortgage != null ? String(a.mortgage) : "", taxes: a.taxes != null ? String(a.taxes) : "", description: a.description || "" });
    }
    setDialogOpen(true);
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">Vehicles, Equipment, Leases & Property</CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions
            config={{
              title: `Company Assets — ${ASSET_TABS.find((t) => t.key === activeTab)?.label || "All"}`,
              companyName,
              table: {
                headers: activeTab === "vehicle"
                  ? ["Year", "Make", "Model", "VIN", "Cost", "Ownership"]
                  : activeTab === "equipment"
                  ? ["Year", "Make", "Model", "Manufacturer", "Running Hrs", "Lease/Own"]
                   : activeTab === "lease"
                   ? ["Description", "Property Address", "Landlord", "Term", "Monthly", "Value"]
                  : ["Address", "Finance Co.", "Escrow", "Mortgage", "Taxes"],
                 rows: assets.map((a) => {
                   if (activeTab === "vehicle") return [a.year || "—", a.make || "—", a.model || "—", (a as any).vin || "—", fmt(a.cost), a.ownership_type || "—"];
                   if (activeTab === "equipment") return [a.year || "—", a.make || "—", a.model || "—", a.manufacturer || "—", a.running_hours?.toString() || "—", a.ownership_type || "—"];
                   if (activeTab === "lease") return [a.description, a.address || "—", (a as any).landlord_name || "—", (a as any).lease_term || "—", fmt((a as any).monthly_payment), fmt(a.value)];
                   return [a.address || "—", a.finance_company || "—", fmt(a.escrow), fmt(a.mortgage), fmt(a.taxes)];
                 }),
              },
            }}
          />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-base">
                {editId ? "Edit" : "Add"} {ASSET_TABS.find((t) => t.key === activeTab)?.label.slice(0, -1) || "Asset"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveAsset.mutate(); }} className="space-y-3">
              {activeTab === "vehicle" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Year</Label>
                      <Input className="h-8 text-sm" value={vehicleForm.year} onChange={(e) => setVehicleForm((p) => ({ ...p, year: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Make</Label>
                      <Input className="h-8 text-sm" value={vehicleForm.make} onChange={(e) => setVehicleForm((p) => ({ ...p, make: e.target.value }))} required />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Model</Label>
                      <Input className="h-8 text-sm" value={vehicleForm.model} onChange={(e) => setVehicleForm((p) => ({ ...p, model: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="field-group">
                    <Label className="field-label">VIN</Label>
                    <Input className="h-8 text-sm" value={vehicleForm.vin} onChange={(e) => setVehicleForm((p) => ({ ...p, vin: e.target.value }))} placeholder="Vehicle Identification Number" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Cost ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={vehicleForm.cost} onChange={(e) => setVehicleForm((p) => ({ ...p, cost: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Ownership</Label>
                      <Select value={vehicleForm.ownership_type} onValueChange={(v) => setVehicleForm((p) => ({ ...p, ownership_type: v }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owned">Owned</SelectItem>
                          <SelectItem value="leased">Leased</SelectItem>
                          <SelectItem value="financed">Financed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Purchase Date</Label>
                      <Input type="date" className="h-8 text-sm" value={vehicleForm.purchase_date} onChange={(e) => setVehicleForm((p) => ({ ...p, purchase_date: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Purchase Amount ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={vehicleForm.purchase_amount} onChange={(e) => setVehicleForm((p) => ({ ...p, purchase_amount: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "equipment" && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Year</Label>
                      <Input className="h-8 text-sm" value={equipmentForm.year} onChange={(e) => setEquipmentForm((p) => ({ ...p, year: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Make</Label>
                      <Input className="h-8 text-sm" value={equipmentForm.make} onChange={(e) => setEquipmentForm((p) => ({ ...p, make: e.target.value }))} required />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Model</Label>
                      <Input className="h-8 text-sm" value={equipmentForm.model} onChange={(e) => setEquipmentForm((p) => ({ ...p, model: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Manufacturer</Label>
                      <Input className="h-8 text-sm" value={equipmentForm.manufacturer} onChange={(e) => setEquipmentForm((p) => ({ ...p, manufacturer: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Running Hours</Label>
                      <Input type="number" className="h-8 text-sm" value={equipmentForm.running_hours} onChange={(e) => setEquipmentForm((p) => ({ ...p, running_hours: e.target.value }))} />
                    </div>
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Lease / Own</Label>
                    <Select value={equipmentForm.ownership_type} onValueChange={(v) => setEquipmentForm((p) => ({ ...p, ownership_type: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owned">Own</SelectItem>
                        <SelectItem value="leased">Lease</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Purchase Date</Label>
                      <Input type="date" className="h-8 text-sm" value={equipmentForm.purchase_date} onChange={(e) => setEquipmentForm((p) => ({ ...p, purchase_date: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Purchase Amount ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={equipmentForm.purchase_amount} onChange={(e) => setEquipmentForm((p) => ({ ...p, purchase_amount: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Lease Date</Label>
                      <Input type="date" className="h-8 text-sm" value={equipmentForm.lease_date} onChange={(e) => setEquipmentForm((p) => ({ ...p, lease_date: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Lease Amount ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={equipmentForm.lease_amount} onChange={(e) => setEquipmentForm((p) => ({ ...p, lease_amount: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "lease" && (
                <>
                  <div className="field-group">
                    <Label className="field-label">Lease Description</Label>
                    <Input className="h-8 text-sm" value={leaseForm.description} onChange={(e) => setLeaseForm((p) => ({ ...p, description: e.target.value }))} required />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Property Address</Label>
                    <Input className="h-8 text-sm" value={leaseForm.address} onChange={(e) => setLeaseForm((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Landlord Name</Label>
                      <Input className="h-8 text-sm" value={leaseForm.landlord_name} onChange={(e) => setLeaseForm((p) => ({ ...p, landlord_name: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Landlord Address</Label>
                      <Input className="h-8 text-sm" value={leaseForm.landlord_address} onChange={(e) => setLeaseForm((p) => ({ ...p, landlord_address: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Lease Start Date</Label>
                      <Input type="date" className="h-8 text-sm" value={leaseForm.lease_start_date} onChange={(e) => setLeaseForm((p) => ({ ...p, lease_start_date: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Lease End Date</Label>
                      <Input type="date" className="h-8 text-sm" value={leaseForm.lease_end_date} onChange={(e) => setLeaseForm((p) => ({ ...p, lease_end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Lease Term</Label>
                      <Input className="h-8 text-sm" value={leaseForm.lease_term} onChange={(e) => setLeaseForm((p) => ({ ...p, lease_term: e.target.value }))} placeholder="e.g. 12 months" />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Monthly Payment ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={leaseForm.monthly_payment} onChange={(e) => setLeaseForm((p) => ({ ...p, monthly_payment: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Value ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={leaseForm.value} onChange={(e) => setLeaseForm((p) => ({ ...p, value: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === "property" && (
                <>
                  <div className="field-group">
                    <Label className="field-label">Address</Label>
                    <Input className="h-8 text-sm" value={propertyForm.address} onChange={(e) => setPropertyForm((p) => ({ ...p, address: e.target.value }))} required />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Address 2</Label>
                    <Input className="h-8 text-sm" value={propertyForm.address_2} onChange={(e) => setPropertyForm((p) => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor, etc." />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Finance Company</Label>
                      <Input className="h-8 text-sm" value={propertyForm.finance_company} onChange={(e) => setPropertyForm((p) => ({ ...p, finance_company: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Escrow ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={propertyForm.escrow} onChange={(e) => setPropertyForm((p) => ({ ...p, escrow: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Mortgage ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={propertyForm.mortgage} onChange={(e) => setPropertyForm((p) => ({ ...p, mortgage: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Taxes ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={propertyForm.taxes} onChange={(e) => setPropertyForm((p) => ({ ...p, taxes: e.target.value }))} />
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full" size="sm" disabled={saveAsset.isPending}>
                {saveAsset.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editId ? "Save Changes" : `Add ${ASSET_TABS.find((t) => t.key === activeTab)?.label.slice(0, -1)}`}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Sub-tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          {ASSET_TABS.map((tab) => {
            const Icon = tab.icon;
            const count = allAssets.filter((a) => a.asset_type === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {assets.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center">
            <Briefcase className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No {ASSET_TABS.find((t) => t.key === activeTab)?.label.toLowerCase()} added yet</p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {activeTab === "vehicle" && (
                    <>
                      <TableHead className="text-xs font-semibold h-8">Year</TableHead>
                      <TableHead className="text-xs h-8">Make</TableHead>
                      <TableHead className="text-xs h-8">Model</TableHead>
                      <TableHead className="text-xs h-8">VIN</TableHead>
                      <TableHead className="text-xs text-right h-8">Cost</TableHead>
                      <TableHead className="text-xs h-8">Ownership</TableHead>
                    </>
                  )}
                  {activeTab === "equipment" && (
                    <>
                      <TableHead className="text-xs font-semibold h-8">Year</TableHead>
                      <TableHead className="text-xs h-8">Make</TableHead>
                      <TableHead className="text-xs h-8">Model</TableHead>
                      <TableHead className="text-xs h-8">Manufacturer</TableHead>
                      <TableHead className="text-xs text-right h-8">Running Hrs</TableHead>
                      <TableHead className="text-xs h-8">Lease/Own</TableHead>
                    </>
                  )}
                  {activeTab === "lease" && (
                    <>
                      <TableHead className="text-xs font-semibold h-8">Description</TableHead>
                      <TableHead className="text-xs h-8">Property Address</TableHead>
                      <TableHead className="text-xs h-8">Landlord</TableHead>
                      <TableHead className="text-xs h-8">Term</TableHead>
                      <TableHead className="text-xs text-right h-8">Monthly</TableHead>
                      <TableHead className="text-xs text-right h-8">Value</TableHead>
                    </>
                  )}
                  {activeTab === "property" && (
                    <>
                      <TableHead className="text-xs font-semibold h-8">Address</TableHead>
                      <TableHead className="text-xs h-8">Finance Co.</TableHead>
                      <TableHead className="text-xs text-right h-8">Escrow</TableHead>
                      <TableHead className="text-xs text-right h-8">Mortgage</TableHead>
                      <TableHead className="text-xs text-right h-8">Taxes</TableHead>
                    </>
                  )}
                  <TableHead className="w-10 h-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((a: any) => (
                  <TableRow key={a.id}>
                    {activeTab === "vehicle" && (
                      <>
                        <TableCell className="text-sm py-2 font-medium">{a.year || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.make || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.model || "—"}</TableCell>
                        <TableCell className="text-xs py-2 font-mono text-muted-foreground">{a.vin || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt(a.cost)}</TableCell>
                        <TableCell className="py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                            a.ownership_type === "financed" ? "bg-accent/50 text-accent-foreground" : "bg-primary/8 text-primary"
                          }`}>
                            {a.ownership_type || "owned"}
                          </span>
                        </TableCell>
                      </>
                    )}
                    {activeTab === "equipment" && (
                      <>
                        <TableCell className="text-sm py-2 font-medium">{a.year || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.make || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.model || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.manufacturer || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{a.running_hours != null ? a.running_hours : "—"}</TableCell>
                        <TableCell className="py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                            a.ownership_type === "leased" ? "bg-accent/50 text-accent-foreground" : "bg-primary/8 text-primary"
                          }`}>
                            {a.ownership_type === "leased" ? "Lease" : "Own"}
                          </span>
                        </TableCell>
                      </>
                    )}
                    {activeTab === "lease" && (
                      <>
                        <TableCell className="text-sm py-2 font-medium">{a.description}</TableCell>
                        <TableCell className="text-sm py-2">{a.address || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{(a as any).landlord_name || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{(a as any).lease_term || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt((a as any).monthly_payment)}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt(a.value)}</TableCell>
                      </>
                    )}
                    {activeTab === "property" && (
                      <>
                        <TableCell className="text-sm py-2 font-medium">{a.address || a.description || "—"}</TableCell>
                        <TableCell className="text-sm py-2">{a.finance_company || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt(a.escrow)}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt(a.mortgage)}</TableCell>
                        <TableCell className="text-right font-mono text-xs py-2">{fmt(a.taxes)}</TableCell>
                      </>
                    )}
                    <TableCell className="py-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(a)} className="h-6 w-6">
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteAsset.mutate(a.id)} className="h-6 w-6 text-destructive/50 hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
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
  );
}
