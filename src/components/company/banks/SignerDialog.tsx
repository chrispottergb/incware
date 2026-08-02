import { useEffect, useState } from "react";
import NameAutocomplete from "@/components/NameAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const AUTHORITY_OPTIONS = [
  "Check Signing & Payments",
  "Deposits Only",
  "Deposits & Endorsements",
  "View-Only Access",
  "Full Banking Authority",
  "Wire/ACH Approval",
  "Limited Authority (Specify)",
];

export interface SignerForm {
  signer_name: string;
  title: string;
  limited_detail: string;
}

const emptySignerForm: SignerForm = { signer_name: "", title: "", limited_detail: "" };

/**
 * Add/edit dialog for an authorized signer. The parent bank account is implicit
 * (the dialog is always opened from a bank card), so there is no account picker.
 */
export default function SignerDialog({
  open,
  onOpenChange,
  editing,
  bankName,
  saving,
  onSave,
  search,
  getCompanySplitIndex,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: any | null;
  bankName: string;
  saving: boolean;
  onSave: (form: SignerForm) => void;
  search: any;
  getCompanySplitIndex: any;
}) {
  const [form, setForm] = useState<SignerForm>(emptySignerForm);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const rawTitle = editing.title || "";
      const isLimited = rawTitle.startsWith("Limited Authority");
      setForm({
        signer_name: editing.signer_name || "",
        title: isLimited ? "Limited Authority (Specify)" : rawTitle,
        limited_detail: isLimited ? rawTitle.replace(/^Limited Authority\s*[—–-]\s*/, "") : "",
      });
    } else {
      setForm(emptySignerForm);
    }
  }, [open, editing]);

  const disabled =
    !form.signer_name.trim() ||
    (form.title === "Limited Authority (Specify)" && !form.limited_detail.trim()) ||
    saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "Add"} Authorized Signer</DialogTitle>
          {bankName && <p className="text-xs text-muted-foreground">{bankName}</p>}
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <NameAutocomplete
                value={form.signer_name}
                onChange={(v) => setForm((p) => ({ ...p, signer_name: v }))}
                onSelect={(entry) => setForm((p) => ({ ...p, signer_name: entry.full_name }))}
                search={search}
                getCompanySplitIndex={getCompanySplitIndex}
              />
            </div>
            <div>
              <Label className="text-xs">Authority Type</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    title: e.target.value,
                    limited_detail: e.target.value === "Limited Authority (Specify)" ? p.limited_detail : "",
                  }))
                }
                placeholder="Select or type authority"
                list="bank-authority-type-options"
              />
              <datalist id="bank-authority-type-options">
                {AUTHORITY_OPTIONS.map((o) => <option key={o} value={o} />)}
              </datalist>
            </div>
          </div>
          {form.title === "Limited Authority (Specify)" && (
            <div>
              <Label className="text-xs">Specify Limitation *</Label>
              <Input
                value={form.limited_detail}
                onChange={(e) => setForm((p) => ({ ...p, limited_detail: e.target.value }))}
                placeholder="e.g. Checks under $500"
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={disabled}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Signer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
