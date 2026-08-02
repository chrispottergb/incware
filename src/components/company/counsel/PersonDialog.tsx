import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookOpen } from "lucide-react";
import { formatPhone } from "@/lib/phone-format";
import type { CounselConfig, PersonForm } from "./config";

const ADD_NEW_FIRM = "__add_new_firm__";

function ScopeCombobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((s) => s.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearch(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || "Select or type engagement scope"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
                setSearch("");
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared add/edit dialog for attorneys and accountants.
 * A person is either firm-affiliated or a solo practitioner — never both, never neither.
 */
export default function PersonDialog({
  open,
  onOpenChange,
  config,
  editing,
  firms,
  form,
  setForm,
  firmId,
  setFirmId,
  initialMode,
  onRequestNewFirm,
  onSave,
  isPending,
  masterContacts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  config: CounselConfig;
  editing: any;
  firms: any[];
  form: PersonForm;
  setForm: (fn: (prev: PersonForm) => PersonForm) => void;
  firmId: string | null;
  setFirmId: (id: string | null) => void;
  initialMode: "firm" | "solo";
  onRequestNewFirm: () => void;
  onSave: () => void;
  isPending: boolean;
  masterContacts: any[];
}) {
  const [mode, setMode] = useState<"firm" | "solo">(initialMode);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Re-seed the tab each time the dialog is opened.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setContactSearch("");
      setShowContactDropdown(false);
    }
  }, [open, initialMode]);

  // Selecting a newly created firm from the stacked FirmDialog implies the firm tab.
  useEffect(() => {
    if (firmId) setMode("firm");
  }, [firmId]);

  const filteredMasterContacts = masterContacts.filter((c: any) =>
    (c.contact_name || "").toLowerCase().includes(contactSearch.toLowerCase())
  );

  const selectMasterContact = (c: any) => {
    setForm(() => ({
      name: c.contact_name || "",
      title: c.title || "",
      license: c[config.licenseColumn] || "",
      email: c.email || "",
      phone: c.phone || "",
      specialty: c.specialty || "",
      notes: c.notes || "",
    }));
    setShowContactDropdown(false);
    setContactSearch("");
  };

  const switchToSolo = () => {
    // Only warn when firm-only data would actually be discarded.
    if (firmId || form.title.trim()) {
      setConfirmClearOpen(true);
      return;
    }
    setMode("solo");
  };

  const confirmSwitchToSolo = () => {
    setFirmId(null);
    setForm((p) => ({ ...p, title: "" }));
    setMode("solo");
    setConfirmClearOpen(false);
  };

  const canSave = form.name.trim().length > 0 && form.email.trim().length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="min-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} {config.personLabelTitle}
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (v === "solo") switchToSolo();
              else setMode("firm");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="firm">Firm affiliated</TabsTrigger>
              <TabsTrigger value="solo">Solo practitioner</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-3">
            {mode === "firm" && (
              <div>
                <Label className="text-xs">Firm</Label>
                <Select
                  value={firmId || ""}
                  onValueChange={(v) => {
                    if (v === ADD_NEW_FIRM) {
                      onRequestNewFirm();
                      return;
                    }
                    setFirmId(v || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select firm" />
                  </SelectTrigger>
                  <SelectContent>
                    {firms.map((f: any) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.firm_name}
                      </SelectItem>
                    ))}
                    <SelectItem value={ADD_NEW_FIRM}>Add new firm…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="relative">
              <Label className="text-xs">Full name *</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((p) => ({ ...p, name: e.target.value }));
                  setContactSearch(e.target.value);
                  setShowContactDropdown(true);
                }}
                onFocus={() => {
                  if (masterContacts.length > 0 && !editing) setShowContactDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                placeholder={!editing && masterContacts.length > 0 ? "Type or select from directory" : ""}
              />
              {showContactDropdown && !editing && filteredMasterContacts.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1">
                    <BookOpen className="h-2.5 w-2.5" /> Directory
                  </div>
                  {filteredMasterContacts.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectMasterContact(c);
                      }}
                    >
                      {c.contact_name}
                      {c.specialty && <span className="text-muted-foreground ml-2">— {c.specialty}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode === "firm" && (
              <div>
                <Label className="text-xs">Role at firm</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Partner, Associate, …"
                />
              </div>
            )}

            <div>
              <Label className="text-xs">{config.licenseLabel} (optional)</Label>
              <Input
                value={form.license}
                onChange={(e) => setForm((p) => ({ ...p, license: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: formatPhone(e.target.value) }))}
                placeholder="(555) 555-5555"
              />
            </div>

            <div>
              <Label className="text-xs">Scope of engagement</Label>
              <ScopeCombobox
                value={form.specialty}
                onChange={(v) => setForm((p) => ({ ...p, specialty: v }))}
                options={config.serviceOptions}
                placeholder={`Select or type ${config.key === "attorney" ? "legal" : "accounting"} service`}
              />
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={!canSave || isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to solo practitioner?</AlertDialogTitle>
            <AlertDialogDescription>
              The firm and role you entered will be cleared. Name, license number, email and the other
              details you've entered are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep firm details</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToSolo}>Switch and clear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
