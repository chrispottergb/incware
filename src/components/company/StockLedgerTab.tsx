import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, BookOpen, Pencil } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";

// Wisconsin statutory stock transaction types by entity type
const TRANSACTION_TYPES_BY_ENTITY: Record<string, { value: string; label: string; statute: string }[]> = {
  Corporation: [
    { value: "initial_issuance", label: "Initial Share Issuance", statute: "§ 180.0601" },
    { value: "authorized_issuance", label: "Authorized Share Issuance", statute: "§ 180.0602" },
    { value: "subscription_issuance", label: "Share Subscription", statute: "§ 180.0620" },
    { value: "consideration_issuance", label: "Issuance for Consideration", statute: "§ 180.0621" },
    { value: "share_dividend", label: "Share Dividend / Stock Split", statute: "§ 180.0623" },
    { value: "fractional_shares", label: "Fractional Shares", statute: "§ 180.0604" },
    { value: "transfer", label: "Share Transfer", statute: "§ 180.0627" },
    { value: "share_exchange", label: "Share Exchange", statute: "§ 180.1102" },
    { value: "redemption", label: "Share Redemption", statute: "§ 180.0631" },
    { value: "reacquisition", label: "Corporation Reacquisition", statute: "§ 180.0631" },
    { value: "cancellation", label: "Share Cancellation", statute: "§ 180.0631" },
    { value: "conversion", label: "Share Conversion", statute: "§ 180.0604" },
    { value: "treasury_acquisition", label: "Treasury Share Acquisition", statute: "§ 180.0631" },
    { value: "treasury_reissue", label: "Treasury Share Reissue", statute: "§ 180.0631" },
    { value: "preemptive_rights", label: "Preemptive Rights Issuance", statute: "§ 180.0630" },
    { value: "gift", label: "Gift / Donation of Shares", statute: "§ 180.0621" },
  ],
  "S-Corp": [
    { value: "initial_issuance", label: "Initial Share Issuance", statute: "§ 180.0601 / IRC § 1361" },
    { value: "authorized_issuance", label: "Authorized Share Issuance", statute: "§ 180.0602 / IRC § 1361(b)" },
    { value: "subscription_issuance", label: "Share Subscription", statute: "§ 180.0620" },
    { value: "consideration_issuance", label: "Issuance for Consideration", statute: "§ 180.0621" },
    { value: "transfer", label: "Share Transfer", statute: "§ 180.0627 / IRC § 1361(b)(1)" },
    { value: "redemption", label: "Share Redemption", statute: "§ 180.0631 / IRC § 302" },
    { value: "reacquisition", label: "Corporation Reacquisition", statute: "§ 180.0631 / IRC § 302" },
    { value: "cancellation", label: "Share Cancellation", statute: "§ 180.0631" },
    { value: "distribution", label: "S-Corp Distribution", statute: "IRC § 1368" },
    { value: "gift", label: "Gift / Donation of Shares", statute: "§ 180.0621 / IRC § 1361(b)(1)" },
  ],
  LLC: [
    { value: "initial_contribution", label: "Initial Capital Contribution", statute: "§ 183.0401" },
    { value: "additional_contribution", label: "Additional Contribution", statute: "§ 183.0401" },
    { value: "membership_issuance", label: "Membership Interest Issuance", statute: "§ 183.0501" },
    { value: "interest_transfer", label: "Transfer of Membership Interest", statute: "§ 183.0706" },
    { value: "interest_assignment", label: "Assignment of Interest", statute: "§ 183.0706" },
    { value: "distribution", label: "Distribution to Members", statute: "§ 183.0404" },
    { value: "interim_distribution", label: "Interim Distribution", statute: "§ 183.0404" },
    { value: "withdrawal_distribution", label: "Withdrawal Distribution", statute: "§ 183.0602" },
    { value: "redemption", label: "Interest Redemption", statute: "§ 183.0602" },
    { value: "dissociation_buyout", label: "Dissociation Buyout", statute: "§ 183.0701" },
    { value: "gift", label: "Gift of Membership Interest", statute: "§ 183.0706" },
  ],
};

// Fallback for other entity types (Non-Profit, Partnership, etc.)
const DEFAULT_TRANSACTION_TYPES = [
  { value: "issuance", label: "Issuance", statute: "" },
  { value: "transfer", label: "Transfer", statute: "" },
  { value: "redemption", label: "Redemption", statute: "" },
  { value: "cancellation", label: "Cancellation", statute: "" },
  { value: "distribution", label: "Distribution", statute: "" },
  { value: "gift", label: "Gift", statute: "" },
];

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "promissory_note", label: "Promissory Note" },
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  entityType?: string;
}

export default function StockLedgerTab({ companyId, entityType = "Corporation" }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const transactionTypes = TRANSACTION_TYPES_BY_ENTITY[entityType] || DEFAULT_TRANSACTION_TYPES;
  const term = getTerminology(entityType);

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["share_transactions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    transaction_type: "issuance",
    shareholder_id: "",
    share_class: "Common",
    num_shares: "",
    price_per_share: "",
    total_consideration: "",
    consideration_type: "cash",
    transaction_date: new Date().toISOString().split("T")[0],
    from_shareholder: "",
    to_shareholder: "",
    notes: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("share_transactions").insert({
        company_id: companyId,
        transaction_type: form.transaction_type,
        shareholder_id: form.shareholder_id || null,
        share_class: form.share_class,
        num_shares: parseInt(form.num_shares) || 0,
        price_per_share: form.price_per_share ? parseFloat(form.price_per_share) : null,
        total_consideration: form.total_consideration ? parseFloat(form.total_consideration) : null,
        consideration_type: form.consideration_type,
        transaction_date: form.transaction_date,
        from_shareholder: form.from_shareholder || null,
        to_shareholder: form.to_shareholder || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      setDialog(false);
      resetForm();
      toast.success("Transaction recorded!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase.from("share_transactions").update({
        transaction_type: form.transaction_type,
        shareholder_id: form.shareholder_id || null,
        share_class: form.share_class,
        num_shares: parseInt(form.num_shares) || 0,
        price_per_share: form.price_per_share ? parseFloat(form.price_per_share) : null,
        total_consideration: form.total_consideration ? parseFloat(form.total_consideration) : null,
        consideration_type: form.consideration_type,
        transaction_date: form.transaction_date,
        from_shareholder: form.from_shareholder || null,
        to_shareholder: form.to_shareholder || null,
        notes: form.notes || null,
      }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      setDialog(false);
      setEditingId(null);
      resetForm();
      toast.success("Transaction updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("share_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      toast.success("Transaction removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => setForm({
    transaction_type: "issuance", shareholder_id: "", share_class: "Common",
    num_shares: "", price_per_share: "", total_consideration: "",
    consideration_type: "cash", transaction_date: new Date().toISOString().split("T")[0],
    from_shareholder: "", to_shareholder: "", notes: "",
  });

  const openEdit = (t: any) => {
    setForm({
      transaction_type: t.transaction_type || "issuance",
      shareholder_id: t.shareholder_id || "",
      share_class: t.share_class || "Common",
      num_shares: t.num_shares?.toString() || "",
      price_per_share: t.price_per_share?.toString() || "",
      total_consideration: t.total_consideration?.toString() || "",
      consideration_type: t.consideration_type || "cash",
      transaction_date: t.transaction_date || new Date().toISOString().split("T")[0],
      from_shareholder: t.from_shareholder || "",
      to_shareholder: t.to_shareholder || "",
      notes: t.notes || "",
    });
    setEditingId(t.id);
    setDialog(true);
  };

  const isTransfer = ["transfer", "interest_transfer", "interest_assignment", "share_exchange"].includes(form.transaction_type);

  const statuteDescription = entityType === "LLC"
    ? "Wis. Stat. Ch. 183 — Uniform Limited Liability Company Law"
    : entityType === "S-Corp"
    ? "Wis. Stat. Ch. 180 / IRC Subchapter S — S-Corporation share transactions"
    : "Wis. Stat. § 180.0601 / § 180.0621 — Shares may not be issued until articles filed; consideration must be received";

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">
              {term.ledgerTitle}
            </CardTitle>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            {statuteDescription}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions config={{
            title: term.ledgerTitle,
            companyName: "",
            statuteRef: statuteDescription,
            landscape: true,
            table: {
              headers: ["Date", "Type", term.shareholder, term.classLabel, term.shareUnit, term.pricePerUnit, "Total", "Consideration"],
              rows: transactions.map((t: any) => [
                t.transaction_date ? new Date(t.transaction_date + "T00:00:00").toLocaleDateString() : "—",
                t.transaction_type?.replace("_", " ") ?? "—",
                t.shareholders?.name ?? "—",
                t.share_class,
                t.num_shares?.toLocaleString(),
                t.price_per_share != null ? `$${Number(t.price_per_share).toFixed(2)}` : "—",
                t.total_consideration != null ? `$${Number(t.total_consideration).toFixed(2)}` : "—",
                t.consideration_type ?? "—",
              ]),
            },
          }} />
          <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) { setEditingId(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingId(null); resetForm(); }}>
                <Plus className="mr-1 h-3 w-3" /> Record Transaction
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-base">{editingId ? "Edit Transaction" : term.isLLC ? "Record Interest Transaction" : "Record Share Transaction"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); editingId ? update.mutate() : add.mutate(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">Transaction Type</Label>
                  <Select value={form.transaction_type} onValueChange={(v) => setForm(p => ({ ...p, transaction_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span>{t.label}</span>
                          {t.statute && <span className="ml-1.5 text-muted-foreground text-[10px]">({t.statute})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Date</Label>
                  <Input className="h-8 text-sm" type="date" value={form.transaction_date} onChange={(e) => setForm(p => ({ ...p, transaction_date: e.target.value }))} required />
                </div>
              </div>
              <div className="field-group">
                  <Label className="field-label">{term.shareholder}</Label>
                  <Select value={form.shareholder_id} onValueChange={(v) => setForm(p => ({ ...p, shareholder_id: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>
                    {shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isTransfer && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">From</Label>
                    <Input className="h-8 text-sm" value={form.from_shareholder} onChange={(e) => setForm(p => ({ ...p, from_shareholder: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">To</Label>
                    <Input className="h-8 text-sm" value={form.to_shareholder} onChange={(e) => setForm(p => ({ ...p, to_shareholder: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div className="field-group">
                  <Label className="field-label">{term.classLabel}</Label>
                  <Select value={form.share_class} onValueChange={(v) => setForm(p => ({ ...p, share_class: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {term.classOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.numUnitsLabel}</Label>
                  <Input className="h-8 text-sm" type="number" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.pricePerUnit}</Label>
                  <Input className="h-8 text-sm" type="number" step="0.01" value={form.price_per_share} onChange={(e) => setForm(p => ({ ...p, price_per_share: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">Total Consideration</Label>
                  <Input className="h-8 text-sm" type="number" step="0.01" value={form.total_consideration} onChange={(e) => setForm(p => ({ ...p, total_consideration: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">Consideration Type</Label>
                  <Select value={form.consideration_type} onValueChange={(v) => setForm(p => ({ ...p, consideration_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSIDERATION_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="field-group">
                <Label className="field-label">Notes</Label>
                <Textarea className="text-sm min-h-[50px]" rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" size="sm" disabled={add.isPending || update.isPending}>
                {(add.isPending || update.isPending) && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editingId ? "Update Transaction" : "Record Transaction"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No transactions recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Date</TableHead>
                  <TableHead className="text-[10px] uppercase">Type</TableHead>
                  <TableHead className="text-[10px] uppercase">{term.shareholder}</TableHead>
                  <TableHead className="text-[10px] uppercase">{term.classLabel}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.shareUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.dollarPerUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Total</TableHead>
                  <TableHead className="text-[10px] uppercase">Consideration</TableHead>
                  <TableHead className="text-[10px] uppercase text-right bg-primary/5">Running Balance</TableHead>
                  <TableHead className="text-[10px] uppercase w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Compute running balance per shareholder chronologically
                  const sorted = [...transactions].sort((a, b) =>
                    (a.transaction_date || "").localeCompare(b.transaction_date || "") || (a.created_at || "").localeCompare(b.created_at || "")
                  );
                  const balances: Record<string, number> = {};
                  const balanceMap = new Map<string, number>();

                  sorted.forEach((t: any) => {
                    const holderId = t.shareholder_id || t.to_shareholder || "unknown";
                    const isReduction = ["redemption", "reacquisition", "cancellation", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout"].includes(t.transaction_type);
                    const isTransferOut = ["transfer", "interest_transfer", "interest_assignment", "share_exchange"].includes(t.transaction_type);

                    if (isTransferOut && t.from_shareholder) {
                      const fromId = t.from_shareholder;
                      balances[fromId] = (balances[fromId] || 0) - (t.num_shares || 0);
                    }

                    if (isReduction) {
                      balances[holderId] = (balances[holderId] || 0) - (t.num_shares || 0);
                    } else {
                      balances[holderId] = (balances[holderId] || 0) + (t.num_shares || 0);
                    }

                    const totalShares = Object.values(balances).reduce((sum, v) => sum + Math.max(0, v), 0);
                    balanceMap.set(t.id, totalShares);
                  });

                  // Display in reverse chronological order (original order)
                  return transactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{t.transaction_date ? new Date(t.transaction_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{t.transaction_type?.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{t.shareholders?.name ?? t.to_shareholder ?? "—"}</TableCell>
                      <TableCell className="text-xs">{t.share_class}</TableCell>
                      <TableCell className="text-xs text-right">{t.num_shares?.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right">{t.price_per_share != null ? `$${Number(t.price_per_share).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs text-right">{t.total_consideration != null ? `$${Number(t.total_consideration).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{t.consideration_type?.replace("_", " ") ?? "—"}</TableCell>
                      <TableCell className="text-xs text-right font-semibold bg-primary/5">{balanceMap.get(t.id)?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(t)} title="Edit transaction">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(t.id)} title="Delete transaction">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
