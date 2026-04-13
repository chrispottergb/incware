import { useState, useCallback, useRef } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText, Pencil, Eye, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { previewLeaseAgreement, downloadLeaseAgreement } from "@/lib/lease-agreement-pdf";

interface Props {
  companyId: string;
  companyName?: string;
  companyAddress?: string;
}

const leaseOptions = ["Home Office", "Office Space", "Shared / Coworking Space", "Storage Unit", "Warehouse Space", "Garage", "Shed / Outbuilding", "Small Workshop", "Parking Area", "Small Land Parcel"];

const emptyForm = {
  description: "",
  value: "",
  address: "",
  landlord_name: "",
  landlord_address: "",
  lease_date: "",
  lease_start_date: "",
  lease_end_date: "",
  lease_term: "",
  monthly_payment: "",
  purpose: "",
  security_deposit: "",
  leasehold_improvement_amount: "",
  leasehold_improvement_description: "",
};

export default function LeasesTab({ companyId, companyName = "", companyAddress = "" }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const savingRef = useRef(false);

  const { search: searchAddressBook, getCompanySplitIndex, upsert: upsertAddressBook } = useAddressBookContext(companyId);

  const handleLandlordSelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setForm(prev => ({
      ...prev,
      landlord_name: entry.full_name,
      landlord_address: [entry.address, entry.city, entry.state, entry.zip].filter(Boolean).join(", "),
    }));
  }, []);

  const handlePropertySelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setForm(prev => ({
      ...prev,
      address: [entry.address, entry.city, entry.state, entry.zip].filter(Boolean).join(", "),
    }));
  }, []);

  const handleLandlordAddressSelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setForm(prev => ({
      ...prev,
      landlord_address: [entry.address, entry.city, entry.state, entry.zip].filter(Boolean).join(", "),
    }));
  }, []);

  const { data: leases = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["company_assets", companyId, "lease"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_assets")
        .select("*")
        .eq("company_id", companyId)
        .eq("asset_type", "lease")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const saveLease = useMutation({
    mutationFn: async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const payload: any = {
          asset_type: "lease",
          description: form.description || "Lease",
          value: form.value ? parseFloat(form.value) : null,
          address: form.address || null,
          landlord_name: form.landlord_name || null,
          landlord_address: form.landlord_address || null,
          lease_date: form.lease_date || null,
          lease_start_date: form.lease_start_date || null,
          lease_end_date: form.lease_end_date || null,
          lease_term: form.lease_term || null,
          monthly_payment: form.monthly_payment ? parseFloat(form.monthly_payment) : null,
          leasehold_improvement_amount: form.leasehold_improvement_amount ? parseFloat(form.leasehold_improvement_amount) : null,
          leasehold_improvement_description: form.leasehold_improvement_description || null,
        };
        if (editId) {
          const { error } = await supabase.from("company_assets").update(payload).eq("id", editId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("company_assets").insert({ ...payload, company_id: companyId });
          if (error) throw error;
        }
      } finally {
        savingRef.current = false;
      }
    },
    onSuccess: () => {
      if (form.landlord_name.trim()) {
        upsertAddressBook.mutate({ full_name: form.landlord_name.trim(), company_id: companyId });
      }
      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId, "lease"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editId ? "Lease updated!" : "Lease added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteLease = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId, "lease"] });
      toast.success("Lease removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditId(null);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      description: a.description || "",
      value: a.value != null ? String(a.value) : "",
      address: a.address || "",
      landlord_name: a.landlord_name || "",
      landlord_address: a.landlord_address || "",
      lease_date: a.lease_date || "",
      lease_start_date: a.lease_start_date || "",
      lease_end_date: a.lease_end_date || "",
      lease_term: a.lease_term || "",
      monthly_payment: a.monthly_payment != null ? String(a.monthly_payment) : "",
      purpose: "",
      security_deposit: "",
      leasehold_improvement_amount: a.leasehold_improvement_amount != null ? String(a.leasehold_improvement_amount) : "",
      leasehold_improvement_description: a.leasehold_improvement_description || "",
    });
    setDialogOpen(true);
  };

  const fmt = (v: number | null | undefined) =>
    v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const generateAgreement = (lease: any, mode: "preview" | "download") => {
    const data = {
      landlordName: lease.landlord_name || "",
      landlordAddress: lease.landlord_address || "",
      tenantName: companyName,
      tenantAddress: companyAddress,
      propertyAddress: lease.address || "",
      leaseDate: lease.lease_date || "",
      leaseStartDate: lease.lease_start_date || "",
      leaseEndDate: lease.lease_end_date || "",
      monthlyRent: lease.monthly_payment != null ? String(lease.monthly_payment) : "",
      leaseTerm: lease.lease_term || "",
      securityDeposit: "",
      purpose: "business operations",
      leaseholdImprovementAmount: lease.leasehold_improvement_amount != null ? String(lease.leasehold_improvement_amount) : "",
      leaseholdImprovementDescription: lease.leasehold_improvement_description || "",
    };
    if (mode === "preview") previewLeaseAgreement(data);
    else downloadLeaseAgreement(data);
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <CardTitle className="card-section-title">Leases</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions
            config={{
              title: "Leases",
              companyName,
              table: {
                headers: ["Property Description", "Property Address", "Landlord", "Landlord Address", "Monthly Payment"],
                rows: leases.map((a: any) => [
                  a.description || "—",
                  a.address || "—",
                  a.landlord_name || "—",
                  a.landlord_address || "—",
                  fmt(a.monthly_payment),
                ]),
              },
            }}
          />
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Add Lease
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-base">
                  {editId ? "Edit" : "Add"} Lease
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (!savingRef.current) saveLease.mutate(); }} className="space-y-3">
                <div className="field-group">
                  <Label className="field-label">Property Description</Label>
                  <Select value={leaseOptions.includes(form.description) ? form.description : "__custom"} onValueChange={(v) => setForm((p) => ({ ...p, description: v === "__custom" ? "" : v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select lease type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaseOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="__custom">Other (type your own)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!leaseOptions.includes(form.description) && (
                    <Input className="h-8 text-sm mt-1" placeholder="Enter custom description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                  )}
                </div>
                <div className="field-group">
                  <Label className="field-label">Property Address</Label>
                  <AddressAutocomplete
                    value={form.address}
                    onChange={(v) => setForm((p) => ({ ...p, address: v }))}
                    onSelect={handlePropertySelect}
                    search={searchAddressBook}
                    getCompanySplitIndex={getCompanySplitIndex}
                    className="h-8 text-sm"
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Landlord Name</Label>
                    <AddressAutocomplete
                      value={form.landlord_name}
                      onChange={(v) => setForm((p) => ({ ...p, landlord_name: v }))}
                      onSelect={handleLandlordSelect}
                      search={searchAddressBook}
                      getCompanySplitIndex={getCompanySplitIndex}
                      className="h-8 text-sm"
                      placeholder="Landlord name"
                    />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Landlord Address</Label>
                    <AddressAutocomplete
                      value={form.landlord_address}
                      onChange={(v) => setForm((p) => ({ ...p, landlord_address: v }))}
                      onSelect={handleLandlordAddressSelect}
                      search={searchAddressBook}
                      getCompanySplitIndex={getCompanySplitIndex}
                      className="h-8 text-sm"
                      placeholder="Landlord address"
                    />
                  </div>
                </div>
                <div className="field-group">
                  <Label className="field-label">Lease Date (Signed)</Label>
                  <DatePickerField value={form.lease_date} onChange={(v) => setForm((p) => ({ ...p, lease_date: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Lease Start Date</Label>
                    <DatePickerField value={form.lease_start_date} onChange={(v) => setForm((p) => ({ ...p, lease_start_date: v }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Lease End Date</Label>
                    <DatePickerField value={form.lease_end_date} onChange={(v) => setForm((p) => ({ ...p, lease_end_date: v }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Lease Term</Label>
                    <Input className="h-8 text-sm" value={form.lease_term} onChange={(e) => setForm((p) => ({ ...p, lease_term: e.target.value }))} placeholder="e.g. 12 months" />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Monthly Payment ($)</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={form.monthly_payment} onChange={(e) => setForm((p) => ({ ...p, monthly_payment: e.target.value }))} />
                  </div>
                </div>
                {/* Leasehold Improvements */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Leasehold Improvements</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Amount ($)</Label>
                      <Input type="number" step="0.01" className="h-8 text-sm" value={form.leasehold_improvement_amount} onChange={(e) => setForm((p) => ({ ...p, leasehold_improvement_amount: e.target.value }))} placeholder="0.00" />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Description</Label>
                      <Input className="h-8 text-sm" value={form.leasehold_improvement_description} onChange={(e) => setForm((p) => ({ ...p, leasehold_improvement_description: e.target.value }))} placeholder="e.g. Office buildout" />
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={saveLease.isPending}>
                  {saveLease.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editId ? "Save Changes" : "Add Lease"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {leases.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-6 text-center">
            <FileText className="mx-auto mb-1.5 h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No leases added yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leases.map((a: any) => {
              const hasEndDate = !!a.lease_end_date;
              const isExpired = hasEndDate && new Date(a.lease_end_date) < new Date();
              const statusLabel = isExpired ? "Expired" : "Active";
              const statusClass = isExpired
                ? "bg-destructive/15 text-destructive border-destructive/30"
                : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";

              const hasImprovements = a.leasehold_improvement_amount != null && Number(a.leasehold_improvement_amount) > 0;

              return (
                <div key={a.id} className="rounded-lg border border-border overflow-hidden">
                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(210,33%,89%)]">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-[hsl(210,59%,30%)]/80" />
                      <span className="text-sm font-semibold text-[hsl(210,59%,30%)]">Lease Agreement</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] px-2 py-0.5 font-semibold ${statusClass}`}>
                        {statusLabel}
                      </Badge>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(210,59%,30%)]/70 hover:text-[hsl(210,59%,30%)] hover:bg-[hsl(210,59%,30%)]/10" title="Preview Lease Agreement" onClick={() => generateAgreement(a, "preview")}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(210,59%,30%)]/70 hover:text-[hsl(210,59%,30%)] hover:bg-[hsl(210,59%,30%)]/10" title="Download Lease Agreement" onClick={() => generateAgreement(a, "download")}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(210,59%,30%)]/70 hover:text-[hsl(210,59%,30%)] hover:bg-[hsl(210,59%,30%)]/10" onClick={() => openEdit(a)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-[hsl(210,59%,30%)]/70 hover:text-destructive hover:bg-[hsl(210,59%,30%)]/10" onClick={() => deleteLease.mutate(a.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="bg-card divide-y divide-border">
                    {/* Row 1: Description & Lease Date */}
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Property Description</p>
                        <p className="text-sm text-foreground">{a.description || "—"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Lease Date</p>
                        <p className="text-sm text-foreground">{fmtDate(a.lease_date)}</p>
                      </div>
                    </div>

                    {/* Row 2: Property Address & Landlord */}
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Property Address</p>
                        <p className="text-sm text-foreground leading-relaxed">{a.address || "—"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Landlord</p>
                        <p className="text-sm text-foreground">{a.landlord_name || "—"}</p>
                      </div>
                    </div>

                    {/* Row 3: Landlord Address (full width) */}
                    <div className="px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Landlord Address</p>
                      <p className="text-sm text-foreground leading-relaxed">{a.landlord_address || "—"}</p>
                    </div>

                    {/* Row 4: Start Date & End Date */}
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Lease Start Date</p>
                        <p className="text-sm text-foreground">{fmtDate(a.lease_start_date)}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Lease End Date</p>
                        <p className="text-sm text-foreground">{fmtDate(a.lease_end_date)}</p>
                      </div>
                    </div>

                    {/* Row 5: Term & Monthly Payment */}
                    <div className="grid grid-cols-2 divide-x divide-border">
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Lease Term</p>
                        <p className="text-sm text-foreground">{a.lease_term || "Ongoing"}</p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Monthly Payment</p>
                        <p className="text-base font-bold text-foreground font-mono">{fmt(a.monthly_payment)}</p>
                      </div>
                    </div>

                    {/* Row 6: Leasehold Improvements (only if amount > 0) */}
                    {hasImprovements && (
                      <div className="grid grid-cols-2 divide-x divide-border">
                        <div className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Leasehold Improvements</p>
                          <p className="text-base font-bold text-foreground font-mono">{fmt(a.leasehold_improvement_amount)}</p>
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Improvement Description</p>
                          <p className="text-sm text-foreground">{a.leasehold_improvement_description || "—"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
