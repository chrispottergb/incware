import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import NameAutocomplete from "@/components/NameAutocomplete";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { isLLCType } from "@/lib/entity-terminology";

const leaseOptions = [
  "Home Office", "Office Space", "Shared / Coworking Space", "Storage Unit",
  "Warehouse Space", "Garage", "Shed / Outbuilding", "Small Workshop",
  "Parking Area", "Small Land Parcel",
];

interface Props {
  companyId: string;
  companyName?: string;
  entityType: string;
  meetingDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeaseCreated: (leaseId: string, propertyAddress: string) => void;
}

export default function LeaseTransactionDialog({
  companyId, companyName, entityType, meetingDate, open, onOpenChange, onLeaseCreated,
}: Props) {
  const { search: searchAddressBook, getCompanySplitIndex } = useAddressBookContext();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isLLC = isLLCType(entityType);

  const [form, setForm] = useState({
    description: "",
    address: "",
    landlord_name: "",
    landlord_address: "",
    lease_date: meetingDate || "",
    lease_start_date: "",
    lease_end_date: "",
    lease_term: "",
    monthly_payment: "",
    leasehold_improvement_amount: "",
    leasehold_improvement_description: "",
  });

  const resetForm = () => {
    setForm({
      description: "",
      address: "",
      landlord_name: "",
      landlord_address: "",
      lease_date: meetingDate || "",
      lease_start_date: "",
      lease_end_date: "",
      lease_term: "",
      monthly_payment: "",
      leasehold_improvement_amount: "",
      leasehold_improvement_description: "",
    });
  };

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        asset_type: "lease" as const,
        description: form.description || "Lease",
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

      const { data, error } = await supabase
        .from("company_assets")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["company_assets", companyId, "lease"] });
      toast.success("Lease record created!");
      onLeaseCreated(data.id, form.address);
      resetForm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Lease creation failed:", err);
      toast.error("Failed to create lease. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const approverLabel = isLLC ? "Members/Managers" : "Board of Directors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Complete Lease Transaction</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Create a lease record approved by the {approverLabel} of {companyName || "the entity"}.
          </p>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Property Description</Label>
            <Select value={form.description} onValueChange={(v) => handleChange("description", v)}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Select type..." /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {leaseOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Property Address</Label>
            <DbAddressAutocomplete value={form.address} onChange={(v) => handleChange("address", v)} onSelect={(addr) => { handleChange("address", addr.line1); handleChange("landlord_address", addr.line1); }} placeholder="Full address" source="companies" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Landlord Name</Label>
              <NameAutocomplete value={form.landlord_name} onChange={(v) => handleChange("landlord_name", v)} onSelect={(entry) => { handleChange("landlord_name", entry.full_name); if (entry.address) handleChange("landlord_address", entry.address); }} search={searchAddressBook} getCompanySplitIndex={getCompanySplitIndex} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Landlord Address</Label>
              <DbAddressAutocomplete value={form.landlord_address} onChange={(v) => handleChange("landlord_address", v)} onSelect={(addr) => { handleChange("landlord_address", addr.line1); }} placeholder="Landlord address" source="companies" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Lease Date</Label>
              <DatePickerField value={form.lease_date} onChange={(v) => handleChange("lease_date", v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
              <DatePickerField value={form.lease_start_date} onChange={(v) => handleChange("lease_start_date", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
              <DatePickerField value={form.lease_end_date} onChange={(v) => handleChange("lease_end_date", v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Lease Term</Label>
              <Input value={form.lease_term} onChange={(e) => handleChange("lease_term", e.target.value)} placeholder="e.g. 12 months" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Monthly Payment</Label>
            <Input type="number" step="0.01" value={form.monthly_payment} onChange={(e) => handleChange("monthly_payment", e.target.value)} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Leasehold Improvement Amount</Label>
              <Input type="number" step="0.01" value={form.leasehold_improvement_amount} onChange={(e) => handleChange("leasehold_improvement_amount", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Leasehold Improvement Description</Label>
              <Input value={form.leasehold_improvement_description} onChange={(e) => handleChange("leasehold_improvement_description", e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={saving || !form.description}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Lease Record
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
