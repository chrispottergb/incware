import { useEffect, useState, useCallback } from "react";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useZipLookup } from "@/hooks/useZipLookup";
import { formatAccountType } from "./BankCard";

export const ACCOUNT_TYPES = ["checking", "savings", "money_market", "other"];

export interface BankForm {
  bank_name: string;
  account_type: string;
  contact_name: string;
  contact_title: string;
  phone: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

export const emptyBankForm: BankForm = {
  bank_name: "",
  account_type: "checking",
  contact_name: "",
  contact_title: "",
  phone: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  zip: "",
  notes: "",
};

/**
 * Add/edit dialog for a bank account.
 * Account and routing numbers are intentionally absent from this form — the
 * columns remain in the database but are no longer surfaced anywhere in the UI.
 */
export default function BankDialog({
  open,
  onOpenChange,
  editing,
  masterBanks,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: any | null;
  masterBanks: any[];
  saving: boolean;
  onSave: (form: BankForm) => void;
}) {
  const [form, setForm] = useState<BankForm>(emptyBankForm);
  const [bankNameSearch, setBankNameSearch] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm((prev) => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange, isLoading: zipLoading, zipError } = useZipLookup(handleZipResult);

  useEffect(() => {
    if (!open) return;
    setBankNameSearch("");
    setShowBankDropdown(false);
    if (editing) {
      setForm({
        bank_name: editing.bank_name || "",
        account_type: editing.account_type || "checking",
        contact_name: editing.contact_name || "",
        contact_title: editing.contact_title || "",
        phone: editing.phone || "",
        address: editing.address || "",
        address_2: editing.address_2 || "",
        city: editing.city || "",
        state: editing.state || "",
        zip: editing.zip || "",
        notes: editing.notes || "",
      });
    } else {
      setForm(emptyBankForm);
    }
  }, [open, editing]);

  const filteredBankNames = masterBanks.filter((b: any) =>
    (b.firm_name || b.bank_name || "").toLowerCase().includes(bankNameSearch.toLowerCase())
  );

  const selectExistingBank = (b: any) => {
    setForm((p) => ({
      ...p,
      bank_name: b.firm_name || b.bank_name,
      address: b.address || p.address,
      address_2: b.address_2 || p.address_2,
      city: b.city || p.city,
      state: b.state || p.state,
      zip: b.zip || p.zip,
      phone: b.phone || p.phone,
      contact_name: b.contact_name || p.contact_name,
      contact_title: b.contact_title || p.contact_title,
    }));
    setShowBankDropdown(false);
    setBankNameSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto min-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Bank Account</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-20 gap-2">
            <div className="col-span-12 relative">
              <Label className="text-xs">Bank Name *</Label>
              <Input
                value={form.bank_name}
                onChange={(e) => {
                  setForm((p) => ({ ...p, bank_name: e.target.value }));
                  setBankNameSearch(e.target.value);
                  setShowBankDropdown(true);
                }}
                onFocus={() => { if (masterBanks.length > 0) setShowBankDropdown(true); }}
                onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                placeholder="Type or select from existing banks"
              />
              {showBankDropdown && filteredBankNames.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b">Master Directory</div>
                  {filteredBankNames.map((b: any, i: number) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); selectExistingBank(b); }}
                    >
                      {b.firm_name || b.bank_name}
                      {b.city && b.state && <span className="text-muted-foreground ml-2">— {b.city}, {b.state}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-8">
              <Label className="text-xs">Account Type</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm((p) => ({ ...p, account_type: v }))}>
                <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{formatAccountType(t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-20 gap-2">
            <div className="col-span-13">
              <Label className="text-xs">Address</Label>
              <DbAddressAutocomplete
                className="h-7 text-sm"
                value={form.address}
                onChange={(v) => setForm((p) => ({ ...p, address: v }))}
                onSelect={(addr) => setForm((p) => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip }))}
                source="companies"
              />
            </div>
            <div className="col-span-7">
              <Label className="text-xs">Address 2</Label>
              <Input className="h-7 text-sm" value={form.address_2} onChange={(e) => setForm((p) => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit" />
            </div>
          </div>

          <div className="grid grid-cols-20 gap-2">
            <div className="col-span-10">
              <Label className="text-xs">City</Label>
              <Input className="h-7 text-sm" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder={zipLoading ? "Loading..." : ""} />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">State</Label>
              <Input className="h-7 text-sm min-w-[60px]" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} placeholder={zipLoading ? "..." : ""} />
            </div>
            <div className="col-span-6">
              <Label className="text-xs">Zip</Label>
              <Input className="h-7 text-sm" value={form.zip} onChange={(e) => { setForm((p) => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} />
              {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
            </div>
          </div>

          <div className="grid grid-cols-20 gap-2">
            <div className="col-span-8">
              <Label className="text-xs">Contact Name</Label>
              <Input className="h-7 text-sm" value={form.contact_name} onChange={(e) => setForm((p) => ({ ...p, contact_name: e.target.value }))} />
            </div>
            <div className="col-span-6">
              <Label className="text-xs">Contact Title</Label>
              <Input className="h-7 text-sm" value={form.contact_title} onChange={(e) => setForm((p) => ({ ...p, contact_title: e.target.value }))} />
            </div>
            <div className="col-span-6">
              <Label className="text-xs">Phone</Label>
              <Input className="h-7 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea className="text-sm min-h-[50px]" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.bank_name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
