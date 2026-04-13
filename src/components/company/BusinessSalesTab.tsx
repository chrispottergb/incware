import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";

interface Props {
  companyId: string;
}

interface SaleForm {
  buyer_name: string;
  seller_name: string;
  sale_type: string;
  consideration_type: string;
  total_price: string;
  financing_terms: string;
  sale_date: string;
  status: string;
  property_description: string;
  statute_reference: string;
  notes: string;
}

const empty: SaleForm = {
  buyer_name: "", seller_name: "", sale_type: "asset_sale",
  consideration_type: "cash", total_price: "", financing_terms: "",
  sale_date: "", status: "pending", property_description: "",
  statute_reference: "", notes: "",
};

const SALE_TYPES = [
  { value: "asset_sale", label: "Asset Sale" },
  { value: "stock_transfer", label: "Stock/Membership Transfer" },
  { value: "merger", label: "Merger" },
];

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "seller_financing", label: "Seller Financing (Ch. 409)" },
  { value: "real_property", label: "Real Property (Ch. 706)" },
  { value: "ucc_merchandise", label: "UCC Merchandise (Ch. 402)" },
  { value: "vehicle_exchange", label: "Vehicle Exchange (Ch. 342)" },
  { value: "mixed", label: "Mixed Consideration" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function BusinessSalesTab({ companyId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SaleForm>(empty);

  const { data: sales = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["business_sales", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_sales")
        .select("*")
        .eq("company_id", companyId)
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const closeDialog = () => { setOpen(false); setEditingId(null); setForm(empty); };
  const f = (key: keyof SaleForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_sales").insert({
        company_id: companyId,
        buyer_name: form.buyer_name,
        seller_name: form.seller_name,
        sale_type: form.sale_type,
        consideration_type: form.consideration_type,
        total_price: form.total_price ? parseFloat(form.total_price) : null,
        financing_terms: form.financing_terms || null,
        sale_date: form.sale_date || new Date().toISOString().split("T")[0],
        status: form.status,
        property_description: form.property_description || null,
        statute_reference: form.statute_reference || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_sales", companyId] });
      closeDialog();
      toast.success("Business sale added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("business_sales").update({
        buyer_name: form.buyer_name,
        seller_name: form.seller_name,
        sale_type: form.sale_type,
        consideration_type: form.consideration_type,
        total_price: form.total_price ? parseFloat(form.total_price) : null,
        financing_terms: form.financing_terms || null,
        sale_date: form.sale_date || new Date().toISOString().split("T")[0],
        status: form.status,
        property_description: form.property_description || null,
        statute_reference: form.statute_reference || null,
        notes: form.notes || null,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_sales", companyId] });
      closeDialog();
      toast.success("Business sale updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_sales", companyId] });
      toast.success("Business sale removed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      buyer_name: row.buyer_name || "",
      seller_name: row.seller_name || "",
      sale_type: row.sale_type || "asset_sale",
      consideration_type: row.consideration_type || "cash",
      total_price: row.total_price?.toString() || "",
      financing_terms: row.financing_terms || "",
      sale_date: row.sale_date || "",
      status: row.status || "pending",
      property_description: row.property_description || "",
      statute_reference: row.statute_reference || "",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const fmt = (v: any) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";
  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString() : "—";

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Business Sales & Transfers</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(empty); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Business Sale" : "Add Business Sale"}</DialogTitle>
              <DialogDescription>Record an asset sale, stock transfer, or merger transaction.</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); editingId ? updateMutation.mutate() : addMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Seller Name</Label>
                  <Input value={form.seller_name} onChange={(e) => f("seller_name", e.target.value)} placeholder="Seller" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Buyer Name</Label>
                  <Input value={form.buyer_name} onChange={(e) => f("buyer_name", e.target.value)} placeholder="Buyer" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Sale Type</Label>
                  <Select value={form.sale_type} onValueChange={(v) => f("sale_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SALE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Consideration Type</Label>
                  <Select value={form.consideration_type} onValueChange={(v) => f("consideration_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSIDERATION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Total Price ($)</Label>
                  <Input type="number" step="0.01" value={form.total_price} onChange={(e) => f("total_price", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Sale Date</Label>
                  <DatePickerField value={form.sale_date} onChange={(v) => f("sale_date", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                  <Select value={form.status} onValueChange={(v) => f("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Statute Reference</Label>
                  <Input value={form.statute_reference} onChange={(e) => f("statute_reference", e.target.value)} placeholder="e.g., Wis. Stat. § 409" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Property Description</Label>
                  <Textarea value={form.property_description} onChange={(e) => f("property_description", e.target.value)} rows={2} placeholder="Describe the property or assets being sold…" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Financing Terms</Label>
                  <Textarea value={form.financing_terms} onChange={(e) => f("financing_terms", e.target.value)} rows={2} placeholder="Financing terms if applicable…" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => f("notes", e.target.value)} rows={2} placeholder="Additional notes…" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={addMutation.isPending || updateMutation.isPending || !form.buyer_name || !form.seller_name}>
                {(addMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Sale"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isError ? (
          <QueryErrorBanner message="Failed to load business sales." onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sales.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No business sales recorded</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Seller</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-sm">{row.seller_name}</TableCell>
                    <TableCell className="text-sm">{row.buyer_name}</TableCell>
                    <TableCell className="text-sm capitalize">{(row.sale_type || "").replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(row.sale_date)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(row.total_price)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusColors[row.status] || ""}`}>
                        {(row.status || "pending").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
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
