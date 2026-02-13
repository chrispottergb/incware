import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Handshake } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// Wisconsin statute-referenced sale types by entity
const SALE_TYPES_BY_ENTITY: Record<string, { label: string; statute: string }[]> = {
  Corporation: [
    { label: "Asset Sale", statute: "Wis. Stat. § 180.1202" },
    { label: "Stock Sale", statute: "Wis. Stat. Ch. 180" },
    { label: "Merger/Consolidation", statute: "Wis. Stat. § 180.1101" },
    { label: "Bulk Transfer", statute: "Wis. Stat. Ch. 406" },
  ],
  "S-Corp": [
    { label: "Asset Sale", statute: "Wis. Stat. § 180.1202" },
    { label: "Stock Sale", statute: "Wis. Stat. Ch. 180 / IRC Subch. S" },
    { label: "Merger/Consolidation", statute: "Wis. Stat. § 180.1101" },
    { label: "Bulk Transfer", statute: "Wis. Stat. Ch. 406" },
  ],
  LLC: [
    { label: "Membership Interest Sale", statute: "Wis. Stat. § 183.0706" },
    { label: "Asset Sale", statute: "Wis. Stat. Ch. 183" },
    { label: "Assignment of Interest", statute: "Wis. Stat. § 183.0503" },
  ],
};

const COMMON_SALE_TYPES = [
  { label: "Seller Financing", statute: "Wis. Stat. Ch. 409 (Secured Transaction)" },
  { label: "Real Property Conveyance", statute: "Wis. Stat. Ch. 706" },
  { label: "Exchange of Merchandise/Inventory", statute: "Wis. Stat. Ch. 402 (UCC)" },
  { label: "Vehicle/Equipment Exchange", statute: "Wis. Stat. Ch. 342" },
  { label: "Goodwill & Intangibles Sale", statute: "Wis. Stat. Ch. 402" },
  { label: "Installment Sale", statute: "Wis. Stat. Ch. 402 / Ch. 409" },
  { label: "Earn-Out Agreement", statute: "Common Law / Contract" },
];

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "seller_financing", label: "Seller Financing" },
  { value: "property_exchange", label: "Property Exchange" },
  { value: "merchandise", label: "Merchandise" },
  { value: "vehicle", label: "Vehicle/Equipment" },
  { value: "mixed", label: "Mixed Consideration" },
];

const STATUS_OPTIONS = ["pending", "completed", "cancelled"];

type SaleForm = {
  company_id: string;
  sale_type: string;
  statute_reference: string;
  buyer_name: string;
  seller_name: string;
  sale_date: string;
  total_price: string;
  consideration_type: string;
  financing_terms: string;
  property_description: string;
  notes: string;
  status: string;
};

const emptyForm: SaleForm = {
  company_id: "",
  sale_type: "",
  statute_reference: "",
  buyer_name: "",
  seller_name: "",
  sale_date: new Date().toISOString().split("T")[0],
  total_price: "",
  consideration_type: "cash",
  financing_terms: "",
  property_description: "",
  notes: "",
  status: "pending",
};

export default function BusinessSales() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SaleForm>(emptyForm);
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, entity_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["business_sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_sales" as any)
        .select("*")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedCompany = companies.find((c) => c.id === form.company_id);
  const entityType = selectedCompany?.entity_type || "Corporation";

  const availableSaleTypes = useMemo(() => {
    const entitySpecific = SALE_TYPES_BY_ENTITY[entityType] || SALE_TYPES_BY_ENTITY["Corporation"];
    return [...entitySpecific, ...COMMON_SALE_TYPES];
  }, [entityType]);

  const upsertMutation = useMutation({
    mutationFn: async (data: SaleForm) => {
      const payload = {
        company_id: data.company_id,
        sale_type: data.sale_type,
        statute_reference: data.statute_reference,
        buyer_name: data.buyer_name,
        seller_name: data.seller_name,
        sale_date: data.sale_date,
        total_price: data.total_price ? Number(data.total_price) : null,
        consideration_type: data.consideration_type,
        financing_terms: data.financing_terms || null,
        property_description: data.property_description || null,
        notes: data.notes || null,
        status: data.status,
      };
      if (editingId) {
        const { error } = await (supabase.from("business_sales" as any) as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("business_sales" as any) as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_sales"] });
      toast.success(editingId ? "Sale updated" : "Sale added");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("business_sales" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_sales"] });
      toast.success("Sale deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function openEdit(sale: any) {
    setEditingId(sale.id);
    setForm({
      company_id: sale.company_id,
      sale_type: sale.sale_type,
      statute_reference: sale.statute_reference || "",
      buyer_name: sale.buyer_name,
      seller_name: sale.seller_name,
      sale_date: sale.sale_date,
      total_price: sale.total_price?.toString() || "",
      consideration_type: sale.consideration_type || "cash",
      financing_terms: sale.financing_terms || "",
      property_description: sale.property_description || "",
      notes: sale.notes || "",
      status: sale.status || "pending",
    });
    setDialogOpen(true);
  }

  function handleSaleTypeChange(label: string) {
    const found = availableSaleTypes.find((t) => t.label === label);
    setForm((f) => ({ ...f, sale_type: label, statute_reference: found?.statute || "" }));
  }

  const filtered = useMemo(() => {
    return sales.filter((s: any) => {
      if (filterCompany !== "all" && s.company_id !== filterCompany) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      return true;
    });
  }, [sales, filterCompany, filterStatus]);

  const companyMap = useMemo(() => {
    const m: Record<string, string> = {};
    companies.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [companies]);

  const statusColor = (s: string) => {
    if (s === "completed") return "default";
    if (s === "cancelled") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="h-6 w-6 text-primary" />
            Business Sales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wisconsin commercial transactions — Wis. Stat. Ch. 180, 183, 402, 409, 706
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Sale
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={filterCompany} onValueChange={setFilterCompany}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Sale Type</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total Price</TableHead>
                <TableHead>Consideration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales found</TableCell></TableRow>
              ) : (
                filtered.map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium text-sm">{companyMap[sale.company_id] || "—"}</TableCell>
                    <TableCell>
                      <div className="text-sm">{sale.sale_type}</div>
                      {sale.statute_reference && (
                        <div className="text-[10px] text-muted-foreground">{sale.statute_reference}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{sale.buyer_name}</TableCell>
                    <TableCell className="text-sm">{sale.seller_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(sale.sale_date), "MM/dd/yyyy")}</TableCell>
                    <TableCell className="text-right text-sm">
                      {sale.total_price != null ? `$${Number(sale.total_price).toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{sale.consideration_type?.replace("_", " ")}</TableCell>
                    <TableCell><Badge variant={statusColor(sale.status)} className="capitalize text-[10px]">{sale.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sale)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(sale.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Sale" : "Add Business Sale"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Company */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Company *</label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v, sale_type: "", statute_reference: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.entity_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sale Type */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Sale Type *</label>
              <Select value={form.sale_type} onValueChange={handleSaleTypeChange} disabled={!form.company_id}>
                <SelectTrigger><SelectValue placeholder="Select sale type" /></SelectTrigger>
                <SelectContent>
                  {availableSaleTypes.map((t) => (
                    <SelectItem key={t.label} value={t.label}>
                      <span>{t.label}</span>
                      <span className="ml-2 text-[10px] text-muted-foreground">({t.statute})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.statute_reference && (
                <p className="text-[10px] text-muted-foreground mt-1">{form.statute_reference}</p>
              )}
            </div>

            {/* Buyer / Seller */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Buyer Name *</label>
              <Input value={form.buyer_name} onChange={(e) => setForm((f) => ({ ...f, buyer_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Seller Name *</label>
              <Input value={form.seller_name} onChange={(e) => setForm((f) => ({ ...f, seller_name: e.target.value }))} />
            </div>

            {/* Date / Price */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Sale Date *</label>
              <Input type="date" value={form.sale_date} onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Total Price</label>
              <Input type="number" value={form.total_price} onChange={(e) => setForm((f) => ({ ...f, total_price: e.target.value }))} placeholder="0.00" />
            </div>

            {/* Consideration / Status */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Consideration Type</label>
              <Select value={form.consideration_type} onValueChange={(v) => setForm((f) => ({ ...f, consideration_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONSIDERATION_TYPES.map((ct) => (
                    <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Financing Terms */}
            {(form.consideration_type === "seller_financing" || form.consideration_type === "mixed") && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Financing Terms</label>
                <Textarea value={form.financing_terms} onChange={(e) => setForm((f) => ({ ...f, financing_terms: e.target.value }))} placeholder="Interest rate, term, collateral…" rows={2} />
              </div>
            )}

            {/* Property Description */}
            {(form.consideration_type === "property_exchange" || form.consideration_type === "merchandise" || form.consideration_type === "vehicle") && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Property / Item Description</label>
                <Textarea value={form.property_description} onChange={(e) => setForm((f) => ({ ...f, property_description: e.target.value }))} placeholder="Describe the property, merchandise, or vehicle…" rows={2} />
              </div>
            )}

            {/* Notes */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              disabled={!form.company_id || !form.sale_type || !form.buyer_name || !form.seller_name}
              onClick={() => upsertMutation.mutate(form)}
            >
              {editingId ? "Update" : "Add Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
