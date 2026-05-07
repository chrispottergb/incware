import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { isLLCType } from "@/lib/entity-terminology";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any | null;
  companyId: string;
  entityType?: string;
  entryNum?: number;
}

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "promissory_note", label: "Promissory Note" },
  { value: "other", label: "Other" },
];

export default function EditTransactionModal({
  open,
  onOpenChange,
  transaction,
  companyId,
  entityType = "Corporation",
  entryNum,
}: Props) {
  const queryClient = useQueryClient();
  const isLLC = isLLCType(entityType);

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const [form, setForm] = useState({
    transaction_type: "",
    transaction_date: "",
    effective_date: "",
    shareholder_id: "",
    from_shareholder: "",
    to_shareholder: "",
    share_class: "",
    num_shares: "",
    par_value: "",
    price_per_share: "",
    total_consideration: "",
    consideration_type: "cash",
    issued_certificate_number: "",
    surrendered_certificate_number: "",
    notes: "",
  });

  useEffect(() => {
    if (!transaction) return;
    setForm({
      transaction_type: transaction.transaction_type ?? "",
      transaction_date: transaction.transaction_date ?? "",
      effective_date: transaction.effective_date ?? transaction.transaction_date ?? "",
      shareholder_id: transaction.shareholder_id ?? "",
      from_shareholder: transaction.from_shareholder ?? "",
      to_shareholder: transaction.to_shareholder ?? "",
      share_class: transaction.share_class ?? "",
      num_shares: transaction.num_shares?.toString() ?? "",
      par_value: transaction.par_value?.toString() ?? "",
      price_per_share: transaction.price_per_share?.toString() ?? "",
      total_consideration: transaction.total_consideration?.toString() ?? "",
      consideration_type: transaction.consideration_type ?? "cash",
      issued_certificate_number: transaction.issued_certificate_number?.toString() ?? "",
      surrendered_certificate_number: transaction.surrendered_certificate_number?.toString() ?? "",
      notes: transaction.notes ?? "",
    });
  }, [transaction]);

  const save = useMutation({
    mutationFn: async () => {
      if (!transaction) throw new Error("No transaction");
      const payload: Record<string, any> = {
        transaction_type: form.transaction_type,
        transaction_date: form.transaction_date || null,
        effective_date: form.effective_date || form.transaction_date || null,
        shareholder_id: form.shareholder_id || null,
        from_shareholder: form.from_shareholder || null,
        to_shareholder: form.to_shareholder || null,
        share_class: form.share_class || null,
        num_shares: form.num_shares === "" ? null : Number(form.num_shares),
        par_value: form.par_value === "" ? null : Number(form.par_value),
        price_per_share: form.price_per_share === "" ? null : Number(form.price_per_share),
        total_consideration: form.total_consideration === "" ? null : Number(form.total_consideration),
        consideration_type: form.consideration_type || null,
        issued_certificate_number:
          form.issued_certificate_number === "" ? null : Number(form.issued_certificate_number),
        surrendered_certificate_number:
          form.surrendered_certificate_number === "" ? null : Number(form.surrendered_certificate_number),
        notes: form.notes || null,
      };
      const { error } = await supabase
        .from("share_transactions")
        .update(payload)
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["share_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      toast.success("Transaction updated");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95">
        <DialogHeader>
          <DialogTitle className="font-display text-base">
            Edit Transaction {entryNum ? `#${entryNum}` : ""}
          </DialogTitle>
          <DialogDescription className="text-xs flex items-start gap-1.5 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Admin-only direct edit. This overwrites the original record and bypasses the immutable-ledger
              audit trail. Use only for typo or data-entry corrections.
            </span>
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="field-group">
              <Label className="field-label">Transaction Type</Label>
              <Input
                className="h-8 text-sm"
                value={form.transaction_type}
                onChange={(e) => setForm((p) => ({ ...p, transaction_type: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">Transaction Date</Label>
              <DatePickerField
                value={form.transaction_date}
                onChange={(v) => setForm((p) => ({ ...p, transaction_date: v }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field-group">
              <Label className="field-label">Effective Date</Label>
              <DatePickerField
                value={form.effective_date}
                onChange={(v) => setForm((p) => ({ ...p, effective_date: v }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">Shareholder</Label>
              <Select
                value={form.shareholder_id}
                onValueChange={(v) => setForm((p) => ({ ...p, shareholder_id: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {shareholders.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field-group">
              <Label className="field-label">From</Label>
              <Input
                className="h-8 text-sm"
                value={form.from_shareholder}
                onChange={(e) => setForm((p) => ({ ...p, from_shareholder: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">To</Label>
              <Input
                className="h-8 text-sm"
                value={form.to_shareholder}
                onChange={(e) => setForm((p) => ({ ...p, to_shareholder: e.target.value }))}
              />
            </div>
          </div>

          <div className={`grid gap-2 ${isLLC ? "grid-cols-3" : "grid-cols-4"}`}>
            <div className="field-group">
              <Label className="field-label">Class</Label>
              <Input
                className="h-8 text-sm"
                value={form.share_class}
                onChange={(e) => setForm((p) => ({ ...p, share_class: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">{isLLC ? "Units" : "Shares"}</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                step="0.0001"
                value={form.num_shares}
                onChange={(e) => setForm((p) => ({ ...p, num_shares: e.target.value }))}
              />
            </div>
            {!isLLC && (
              <div className="field-group">
                <Label className="field-label">Par Value</Label>
                <Input
                  className="h-8 text-sm"
                  type="number"
                  step="0.0001"
                  value={form.par_value}
                  onChange={(e) => setForm((p) => ({ ...p, par_value: e.target.value }))}
                />
              </div>
            )}
            <div className="field-group">
              <Label className="field-label">Price / Unit</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                step="0.01"
                value={form.price_per_share}
                onChange={(e) => setForm((p) => ({ ...p, price_per_share: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field-group">
              <Label className="field-label">Total Consideration</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                step="0.01"
                value={form.total_consideration}
                onChange={(e) => setForm((p) => ({ ...p, total_consideration: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">Consideration Type</Label>
              <Select
                value={form.consideration_type}
                onValueChange={(v) => setForm((p) => ({ ...p, consideration_type: v }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONSIDERATION_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>
                      {ct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="field-group">
              <Label className="field-label">Issued Cert #</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                value={form.issued_certificate_number}
                onChange={(e) => setForm((p) => ({ ...p, issued_certificate_number: e.target.value }))}
              />
            </div>
            <div className="field-group">
              <Label className="field-label">Surrendered Cert #</Label>
              <Input
                className="h-8 text-sm"
                type="number"
                value={form.surrendered_certificate_number}
                onChange={(e) => setForm((p) => ({ ...p, surrendered_certificate_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="field-group">
            <Label className="field-label">Notes</Label>
            <Textarea
              className="text-sm min-h-[60px]"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
