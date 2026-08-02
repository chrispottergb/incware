import { useCallback, useState } from "react";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { useZipLookup } from "@/hooks/useZipLookup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookOpen } from "lucide-react";
import { formatPhone } from "@/lib/phone-format";
import type { CounselConfig, FirmForm } from "./config";

/**
 * Firm add/edit dialog. Behaviour is unchanged from the original CounselTab:
 * master-directory autocomplete on the firm name, address + ZIP lookup, phone, website.
 * The firm type (Law firm / Accounting firm) is fixed by the category the firm was
 * created under and is therefore displayed, never edited.
 */
export default function FirmDialog({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  onSave,
  isPending,
  config,
  masterFirms,
  onSelectMaster,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any;
  form: FirmForm;
  setForm: (fn: (prev: FirmForm) => FirmForm) => void;
  onSave: () => void;
  isPending: boolean;
  config: CounselConfig;
  masterFirms: any[];
  onSelectMaster: (f: any) => void;
}) {
  const handleZipResult = useCallback(
    (result: { city: string; state: string }) => {
      setForm((prev) => ({ ...prev, city: result.city, state: result.state }));
    },
    [setForm]
  );
  const { handleZipChange, isLoading: zipLoading, zipError } = useZipLookup(handleZipResult);

  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = masterFirms.filter((f: any) =>
    (f.firm_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSearch("");
          setShowDropdown(false);
        }
      }}
    >
      <DialogContent className="min-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit" : "Add"} {config.firmTypeLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="relative">
            <Label className="text-xs">Firm Name *</Label>
            <Input
              value={form.firm_name}
              onChange={(e) => {
                setForm((p) => ({ ...p, firm_name: e.target.value }));
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (masterFirms.length > 0 && !editing) setShowDropdown(true);
              }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder={!editing && masterFirms.length > 0 ? "Type or select from directory" : "Firm name"}
            />
            {showDropdown && !editing && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1">
                  <BookOpen className="h-2.5 w-2.5" /> Master Directory
                </div>
                {filtered.map((f: any) => (
                  <button
                    key={f.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelectMaster(f);
                      setShowDropdown(false);
                      setSearch("");
                    }}
                  >
                    {f.firm_name}
                    {f.city && f.state && (
                      <span className="text-muted-foreground ml-2">
                        — {f.city}, {f.state}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-12 gap-x-2 gap-y-2">
            <div className="col-span-7">
              <Label className="text-xs">Address</Label>
              <DbAddressAutocomplete
                className="h-7 text-sm"
                value={form.address}
                onChange={(v) => setForm((p) => ({ ...p, address: v }))}
                onSelect={(addr) => {
                  setForm((p) => ({
                    ...p,
                    address: addr.line1,
                    address_2: addr.line2,
                    city: addr.city,
                    state: addr.state,
                    zip: addr.zip,
                  }));
                }}
                source="companies"
              />
            </div>
            <div className="col-span-5">
              <Label className="text-xs">Address 2</Label>
              <Input
                className="h-7 text-sm"
                value={form.address_2}
                onChange={(e) => setForm((p) => ({ ...p, address_2: e.target.value }))}
                placeholder="Suite, Unit"
              />
            </div>
            <div className="col-span-5">
              <Label className="text-xs">City</Label>
              <Input
                className="h-7 text-sm"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder={zipLoading ? "Loading..." : ""}
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">State</Label>
              <Input
                className="h-7 text-sm"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                placeholder={zipLoading ? "..." : ""}
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs">Zip</Label>
              <Input
                className="h-7 text-sm"
                value={form.zip}
                onChange={(e) => {
                  setForm((p) => ({ ...p, zip: e.target.value }));
                  handleZipChange(e.target.value);
                }}
              />
              {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
            </div>
            <div className="col-span-12">
              <Label className="text-xs">Phone</Label>
              <Input
                type="tel"
                className="h-7 text-sm"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input
              className="h-7 text-sm"
              value={form.website}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!form.firm_name.trim() || isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
