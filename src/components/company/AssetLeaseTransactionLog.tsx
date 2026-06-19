import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/currency-format";
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

type EntryType = "purchase" | "lease" | "vehicle_sale" | "lease_termination";

interface Props {
  entityId: string;
}

interface AssetTransaction {
  id: string;
  entity_id: string;
  type: string;
  description: string;
  date: string | null;
  amount: string | number | null;
  monthly_payment: string | number | null;
  vendor: string | null;
  lessor: string | null;
  buyer: string | null;
  financing: string | null;
  term: string | null;
  end_date: string | null;
  reason: string | null;
  resolution: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<EntryType, { label: string; badge: string }> = {
  purchase: {
    label: "Purchase",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  },
  lease: {
    label: "Lease",
    badge: "bg-blue-500/10 text-blue-700 border-blue-500/25",
  },
  vehicle_sale: {
    label: "Vehicle Disposition",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  },
  lease_termination: {
    label: "Lease ended",
    badge: "bg-rose-500/10 text-rose-700 border-rose-500/25",
  },
};

const FILTERS: { value: "all" | EntryType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "purchase", label: "Purchases" },
  { value: "lease", label: "Leases" },
  { value: "vehicle_sale", label: "Vehicle dispositions" },
  { value: "lease_termination", label: "Lease terminations" },
];

interface FormState {
  description: string;
  date: string;
  amount: string;
  monthly_payment: string;
  vendor: string;
  lessor: string;
  buyer: string;
  financing: string;
  term: string;
  end_date: string;
  reason: string;
  resolution: string;
}

const emptyForm: FormState = {
  description: "",
  date: "",
  amount: "",
  monthly_payment: "",
  vendor: "",
  lessor: "",
  buyer: "",
  financing: "",
  term: "",
  end_date: "",
  reason: "",
  resolution: "",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString();
}

function toNumeric(v: string): number | null {
  const n = parseFloat(sanitizeCurrencyInput(v));
  return isFinite(n) ? n : null;
}

export default function AssetLeaseTransactionLog({ entityId }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | EntryType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeType, setActiveType] = useState<EntryType>("purchase");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AssetTransaction | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["asset_transactions", entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_transactions")
        .select("*")
        .eq("entity_id", entityId)
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AssetTransaction[];
    },
    enabled: !!entityId,
  });

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.type === filter)),
    [entries, filter],
  );

  const set = (field: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setActiveType("purchase");
    setDialogOpen(true);
  };

  const openEdit = (entry: AssetTransaction) => {
    setEditingId(entry.id);
    setActiveType(entry.type as EntryType);
    setForm({
      description: entry.description || "",
      date: entry.date || "",
      amount: entry.amount != null ? String(entry.amount) : "",
      monthly_payment: entry.monthly_payment != null ? String(entry.monthly_payment) : "",
      vendor: entry.vendor || "",
      lessor: entry.lessor || "",
      buyer: entry.buyer || "",
      financing: entry.financing || "",
      term: entry.term || "",
      end_date: entry.end_date || "",
      reason: entry.reason || "",
      resolution: entry.resolution || "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.description.trim()) throw new Error("Description is required.");

      const base: Record<string, any> = {
        entity_id: entityId,
        type: activeType,
        description: form.description.trim(),
        date: form.date || null,
        resolution: null,
        amount: null,
        monthly_payment: null,
        vendor: null,
        lessor: null,
        buyer: null,
        financing: null,
        term: null,
        end_date: null,
        reason: null,
      };

      if (activeType === "purchase") {
        base.amount = toNumeric(form.amount);
        base.vendor = form.vendor.trim() || null;
        base.financing = form.financing.trim() || null;
      } else if (activeType === "lease") {
        base.lessor = form.lessor.trim() || null;
        base.term = form.term.trim() || null;
        base.monthly_payment = toNumeric(form.monthly_payment);
        base.end_date = form.end_date || null;
      } else if (activeType === "vehicle_sale") {
        if (!form.financing.trim()) throw new Error("Disposition Type is required.");
        base.amount = toNumeric(form.amount);
        base.end_date = form.end_date || null;
        base.financing = form.financing.trim() || null;
        base.reason = form.reason.trim() || null;
      } else if (activeType === "lease_termination") {
        base.lessor = form.lessor.trim() || null;
        base.reason = form.reason.trim() || null;
      }

      if (editingId) {
        const { error } = await supabase
          .from("asset_transactions")
          .update(base as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asset_transactions").insert(base as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset_transactions", entityId] });
      toast.success(editingId ? "Entry updated." : "Entry added.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save entry."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase.from("asset_transactions").delete().eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset_transactions", entityId] });
      toast.success("Entry deleted.");
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete entry."),
  });

  // ── Card field rendering per type ──
  const metaFields = (e: AssetTransaction): { label: string; value: string }[] => {
    switch (e.type) {
      case "purchase":
        return [];
      case "lease":
        return [
          { label: "Lessor", value: e.lessor || "—" },
          { label: "Term", value: e.term || "—" },
          { label: "Ends", value: fmtDate(e.end_date) },
        ];
      case "vehicle_sale":
        return [{ label: "Acquired", value: fmtDate(e.end_date) }];
      case "lease_termination":
        return [
          { label: "Lessor", value: e.lessor || "—" },
          { label: "Reason", value: e.reason || "—" },
        ];
      default:
        return [];
    }
  };

  const amountDisplay = (e: AssetTransaction): string | null => {
    if (e.type === "lease") {
      return e.monthly_payment != null
        ? `${formatCurrencyDisplay(e.monthly_payment)}/mo`
        : null;
    }
    if (e.type === "purchase" || e.type === "vehicle_sale") {
      return e.amount != null ? formatCurrencyDisplay(e.amount) : null;
    }
    return null;
  };

  // ── Shared form field helpers ──
  const DescriptionField = (
    <div className="space-y-1.5">
      <Label className="text-xs">Asset Description *</Label>
      <Input
        value={form.description}
        onChange={(ev) => set("description")(ev.target.value)}
        placeholder="e.g. 2024 Ford F-150 XLT"
      />
    </div>
  );

  

  const currencyInput = (field: "amount" | "monthly_payment", placeholder: string) => (
    <Input
      value={form[field]}
      onChange={(ev) => set(field)(sanitizeCurrencyInput(ev.target.value))}
      placeholder={placeholder}
      inputMode="decimal"
    />
  );

  return (
    <div className="space-y-4">
      {/* Header + filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-full px-3 text-xs shadow-none"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add entry
        </Button>
      </div>

      {/* Unified list */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border py-12 flex flex-col items-center gap-2">
          <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "No asset or lease transactions recorded yet."
              : "No entries of this type."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const cfg = TYPE_CONFIG[e.type as EntryType] ?? {
              label: e.type,
              badge: "bg-muted text-muted-foreground border-border",
            };
            const amt = amountDisplay(e);
            return (
              <div
                key={e.id}
                className="group rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      {e.description}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-xs text-muted-foreground">
                    <span>{fmtDate(e.date)}</span>
                    {metaFields(e).map((m) => (
                      <span key={m.label} className="whitespace-nowrap">
                        <span className="text-muted-foreground/70">{m.label}:</span>{" "}
                        {m.value}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {amt && (
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {amt}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(e)}
                    title="Edit entry"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(e)}
                    title="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="min-w-[640px] max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Entry" : "Add Entry"}</DialogTitle>
            <DialogDescription>
              Record a board-authorized asset or lease transaction for the corporate records.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeType} onValueChange={(v) => !editingId && setActiveType(v as EntryType)}>
            <TabsList className="grid w-full grid-cols-4">
              {(Object.keys(TYPE_CONFIG) as EntryType[]).map((t) => (
                <TabsTrigger key={t} value={t} disabled={!!editingId && t !== activeType} className="text-xs">
                  {TYPE_CONFIG[t].label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="purchase" className="mt-4 space-y-3">
              {DescriptionField}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Acquired</Label>
                  <DatePickerField value={form.date} onChange={set("date")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase Price</Label>
                  {currencyInput("amount", "0.00")}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lease" className="mt-4 space-y-3">
              {DescriptionField}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Entered</Label>
                  <DatePickerField value={form.date} onChange={set("date")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lessor Name</Label>
                  <Input
                    value={form.lessor}
                    onChange={(ev) => set("lessor")(ev.target.value)}
                    placeholder="Lessor name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Lease Term</Label>
                  <Input
                    value={form.term}
                    onChange={(ev) => set("term")(ev.target.value)}
                    placeholder="e.g. 36 months"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Monthly Payment</Label>
                  {currencyInput("monthly_payment", "0.00")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lease End Date</Label>
                  <DatePickerField value={form.end_date} onChange={set("end_date")} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="vehicle_sale" className="mt-4 space-y-3">
              {DescriptionField}
              <div className="space-y-1.5">
                <Label className="text-xs">Disposition Type *</Label>
                <Select value={form.financing} onValueChange={set("financing")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select disposition type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sold">Sold</SelectItem>
                    <SelectItem value="Totaled (Insurance Payout)">Totaled (Insurance Payout)</SelectItem>
                    <SelectItem value="Trade-In">Trade-In</SelectItem>
                    <SelectItem value="Donated">Donated</SelectItem>
                    <SelectItem value="Stolen">Stolen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Sale</Label>
                  <DatePickerField value={form.date} onChange={set("date")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Proceeds Received</Label>
                  {currencyInput("amount", "0.00")}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Originally Acquired</Label>
                  <DatePickerField value={form.end_date} onChange={set("end_date")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={form.reason}
                  onChange={(ev) => set("reason")(ev.target.value)}
                  placeholder="e.g. Insurance claim no. 12345, or buyer information."
                  rows={3}
                />
              </div>
            </TabsContent>


            <TabsContent value="lease_termination" className="mt-4 space-y-3">
              {DescriptionField}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date Ended</Label>
                  <DatePickerField value={form.date} onChange={set("date")} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lessor Name</Label>
                  <Input
                    value={form.lessor}
                    onChange={(ev) => set("lessor")(ev.target.value)}
                    placeholder="Lessor name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason / Notes</Label>
                <Textarea
                  value={form.reason}
                  onChange={(ev) => set("reason")(ev.target.value)}
                  placeholder="Reason for termination, surrender terms, etc."
                  rows={3}
                />
              </div>
              
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingId ? "Save Changes" : "Add Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete this entry?"
        description={`This will permanently remove "${deleteTarget?.description ?? ""}" from the asset & lease transaction log.`}
      />
    </div>
  );
}
