import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, FileText, Pencil, Link2 } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";

interface Props {
  companyId: string;
  entityType?: string;
}

export default function BillsOfSaleTab({ companyId, entityType = "Corporation" }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const t = getTerminology(entityType);

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: bills = [], isLoading } = useQuery({
    queryKey: ["bills_of_sale", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_of_sale").select("*").eq("company_id", companyId).order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const emptyForm = {
    seller_name: "", buyer_name: "", num_shares: "", share_class: t.defaultClass,
    price_per_share: "", total_price: "", sale_date: new Date().toISOString().split("T")[0],
    description: "", shareholder_id: "",
  };
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => { setForm(emptyForm); setEditId(null); };

  const openEdit = (b: any) => {
    setEditId(b.id);
    setForm({
      seller_name: b.seller_name || "", buyer_name: b.buyer_name || "",
      num_shares: String(b.num_shares || ""), share_class: b.share_class || t.defaultClass,
      price_per_share: b.price_per_share != null ? String(b.price_per_share) : "",
      total_price: b.total_price != null ? String(b.total_price) : "",
      sale_date: b.sale_date || "", description: b.description || "",
      shareholder_id: b.shareholder_id || "",
    });
    setDialog(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        seller_name: form.seller_name, buyer_name: form.buyer_name,
        num_shares: parseFloat(form.num_shares) || 0, share_class: form.share_class,
        price_per_share: form.price_per_share ? parseFloat(form.price_per_share) : null,
        total_price: form.total_price ? parseFloat(form.total_price) : null,
        sale_date: form.sale_date, description: form.description || null,
        shareholder_id: form.shareholder_id || null,
      };
      if (editId) {
        const { error } = await supabase.from("bills_of_sale").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bills_of_sale").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills_of_sale", companyId] });
      setDialog(false); resetForm();
      toast.success(editId ? "Bill of sale updated!" : "Bill of sale recorded!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills_of_sale").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills_of_sale", companyId] });
      toast.success("Bill of sale removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">{t.billsTitle}</CardTitle>
          </div>
          <CardDescription className="text-[11px] mt-0.5">{t.billsStatute}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions config={{
            title: t.billsTitle, companyName: "", statuteRef: t.billsStatute,
            table: {
              headers: ["Date", "Seller", "Buyer", t.classLabel, t.shareUnit, t.dollarPerUnit, "Total"],
              rows: bills.map((b) => [
                b.sale_date ? new Date(b.sale_date + "T00:00:00").toLocaleDateString() : "—",
                b.seller_name, b.buyer_name, b.share_class, b.num_shares?.toLocaleString(),
                b.price_per_share != null ? `$${Number(b.price_per_share).toFixed(2)}` : "—",
                b.total_price != null ? `$${Number(b.total_price).toFixed(2)}` : "—",
              ]),
            },
          }} />
          <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Record Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-base">
                  {editId ? "Edit Bill of Sale" : (t.isLLC ? "Record Interest Transfer / Bill of Sale" : "Record Bill of Sale")}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Seller</Label>
                    <Input className="h-8 text-sm" value={form.seller_name} onChange={(e) => setForm(p => ({ ...p, seller_name: e.target.value }))} required />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Buyer</Label>
                    <Input className="h-8 text-sm" value={form.buyer_name} onChange={(e) => setForm(p => ({ ...p, buyer_name: e.target.value }))} required />
                  </div>
                </div>
                <div className="field-group">
                  <Label className="field-label">Linked {t.shareholder} (optional)</Label>
                  <Select value={form.shareholder_id} onValueChange={(v) => setForm(p => ({ ...p, shareholder_id: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select if applicable" /></SelectTrigger>
                    <SelectContent>
                      {shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="field-group">
                    <Label className="field-label">{t.classLabel}</Label>
                    <Select value={form.share_class} onValueChange={(v) => setForm(p => ({ ...p, share_class: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {t.classOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{t.numUnitsLabel}</Label>
                    <Input className="h-8 text-sm" type="number" step="0.0001" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{t.dollarPerUnit}</Label>
                    <Input className="h-8 text-sm" type="number" step="0.01" value={form.price_per_share} onChange={(e) => setForm(p => ({ ...p, price_per_share: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Total</Label>
                    <Input className="h-8 text-sm" type="number" step="0.01" value={form.total_price} onChange={(e) => setForm(p => ({ ...p, total_price: e.target.value }))} />
                  </div>
                </div>
                <div className="field-group">
                  <Label className="field-label">Sale Date</Label>
                  <DatePickerField value={form.sale_date} onChange={(v) => setForm(p => ({ ...p, sale_date: v }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">Description / Terms</Label>
                  <Textarea className="text-sm min-h-[50px]" rows={2} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editId ? "Save Changes" : "Record Bill of Sale"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : bills.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No bills of sale recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Date</TableHead>
                  <TableHead className="text-[10px] uppercase">Seller</TableHead>
                  <TableHead className="text-[10px] uppercase">Buyer</TableHead>
                  <TableHead className="text-[10px] uppercase">{t.classLabel}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{t.shareUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{t.dollarPerUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Total</TableHead>
                  <TableHead className="text-[10px] uppercase w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-xs">{b.sale_date ? new Date(b.sale_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-xs font-medium">{b.seller_name}</TableCell>
                    <TableCell className="text-xs font-medium">{b.buyer_name}</TableCell>
                    <TableCell className="text-xs">{b.share_class}</TableCell>
                    <TableCell className="text-xs text-right">{b.num_shares?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">{b.price_per_share != null ? `$${Number(b.price_per_share).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{b.total_price != null ? `$${Number(b.total_price).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(b as any).transaction_id && (
                          <span className="mt-1.5 mr-0.5" aria-label="Linked to ledger entry">
                            <Link2 className="h-3 w-3 text-primary" />
                          </span>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(b)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(b.id)}>
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
