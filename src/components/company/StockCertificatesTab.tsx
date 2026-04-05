import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Award, XCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";

interface Props {
  companyId: string;
  entityType?: string;
}

export default function StockCertificatesTab({ companyId, entityType = "Corporation" }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const t = getTerminology(entityType);

  const { data: shareholders = [] } = useQuery({
    queryKey: ["stock-certificate-shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("shareholders").select("id, name, is_treasury, status").eq("company_id", companyId);
      if (error) throw error;
      return (data ?? [])
        .filter((s) => !s.is_treasury && (s.status ?? "active") === "active")
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!companyId,
  });

  const { data: certificates = [], isLoading } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("certificate_number");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const totalActiveUnits = certificates
    .filter((c: any) => c.status === "active")
    .reduce((sum: number, c: any) => sum + (c.num_shares || 0), 0);

  const [form, setForm] = useState({
    certificate_number: "",
    shareholder_id: "",
    share_class: t.defaultClass,
    num_shares: "",
    par_value: "",
    par_value_type: "par" as "par" | "no_par",
    issue_date: "",
  });

  const nextCertNum = certificates.length > 0
    ? Math.max(...certificates.map(c => c.certificate_number)) + 1
    : 1;

  const resetForm = () => {
    setForm({ certificate_number: "", shareholder_id: "", share_class: t.defaultClass, num_shares: "", par_value: "", par_value_type: "par", issue_date: "" });
    setEditId(null);
  };

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      certificate_number: String(c.certificate_number),
      shareholder_id: c.shareholder_id || "",
      share_class: c.share_class || t.defaultClass,
      num_shares: String(c.num_shares || ""),
      par_value: c.par_value != null ? String(c.par_value) : "",
      par_value_type: c.par_value == null ? "no_par" : "par",
      issue_date: c.issue_date || "",
    });
    setDialog(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.shareholder_id) {
        throw new Error(`Please select a ${t.shareholder.toLowerCase()} first.`);
      }

      const payload = {
        certificate_number: parseInt(form.certificate_number) || nextCertNum,
        shareholder_id: form.shareholder_id,
        share_class: form.share_class,
        num_shares: parseFloat(form.num_shares) || 0,
        par_value: t.isLLC ? null : (form.par_value_type === "no_par" ? null : (form.par_value ? parseInt(form.par_value) : null)),
        issue_date: form.issue_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("stock_certificates").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stock_certificates").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      setDialog(false);
      resetForm();
      toast.success(editId ? "Certificate updated!" : "Certificate issued!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_certificates").update({
        status: "cancelled",
        cancelled_date: new Date().toISOString().split("T")[0],
        cancelled_reason: cancelReason || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      setCancelDialog(null);
      setCancelReason("");
      toast.success("Certificate cancelled.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_certificates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      toast.success("Certificate deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">{t.certificates}</CardTitle>
            </div>
            <CardDescription className="text-[11px] mt-0.5">{t.certificateStatute}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <SectionPdfActions config={{
              title: t.certificates, companyName: "", statuteRef: t.certificateStatute,
              table: {
                headers: ["Cert #", t.shareholder, t.classLabel, t.shareUnit, ...(t.isLLC ? [] : [t.parValue]), "Issue Date", "Status", ...(t.isLLC ? ["Ownership %"] : [])],
                rows: certificates.map((c: any) => [
                  String(c.certificate_number), c.shareholders?.name ?? "—", c.share_class,
                  c.num_shares?.toLocaleString(), ...(t.isLLC ? [] : [c.par_value != null ? `$${Number(c.par_value).toFixed(0)}` : "No Par"]),
                  c.issue_date ? new Date(c.issue_date + "T00:00:00").toLocaleDateString() : "—", c.status ?? "—",
                  ...(t.isLLC ? [c.status === "active" && totalActiveUnits > 0 ? `${((c.num_shares / totalActiveUnits) * 100).toFixed(2)}%` : "—"] : []),
                ]),
              },
            }} />
            <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Issue Certificate
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display text-base">
                    {editId ? `Edit ${t.certificate}` : `Issue ${t.certificate}`}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">Certificate #</Label>
                      <Input className="h-8 text-sm" type="number" placeholder={String(nextCertNum)} value={form.certificate_number} onChange={(e) => setForm(p => ({ ...p, certificate_number: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <Label className="field-label">Issue Date</Label>
                      <DatePickerField value={form.issue_date} onChange={(v) => setForm(p => ({ ...p, issue_date: v }))} />
                    </div>
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{t.shareholder}</Label>
                    <Select
                      value={form.shareholder_id || "__none__"}
                      onValueChange={(v) => setForm((p) => ({ ...p, shareholder_id: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder={`Select ${t.shareholder.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select {t.shareholder.toLowerCase()}</SelectItem>
                        {shareholders.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {shareholders.length === 0 && (
                      <p className="text-xs text-muted-foreground">No active {t.shareholders.toLowerCase()} found. Add one in the registry first.</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
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
                      <Input className="h-8 text-sm" type="number" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
                    </div>
                  </div>
                  {t.isLLC && (
                    <div className="field-group">
                      <Label className="field-label">Membership Interest</Label>
                      <Input
                        className="h-8 text-sm bg-muted"
                        readOnly
                        value={
                          form.num_shares
                            ? `${(
                                (parseInt(form.num_shares) /
                                  (totalActiveUnits -
                                    (editId
                                      ? certificates.find((c: any) => c.id === editId)?.num_shares || 0
                                      : 0) +
                                    (parseInt(form.num_shares) || 0))) *
                                100
                              ).toFixed(2)}%`
                            : "—"
                        }
                      />
                    </div>
                  )}
                  {!t.isLLC && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="field-group">
                      <Label className="field-label">{t.parValue}</Label>
                      <Select value={form.par_value_type} onValueChange={(v) => setForm(p => ({ ...p, par_value_type: v as "par" | "no_par", par_value: v === "no_par" ? "" : p.par_value }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="par">Par Value</SelectItem>
                          <SelectItem value="no_par">No Par Value</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.par_value_type === "par" && (
                      <div className="field-group">
                        <Label className="field-label">Amount ($)</Label>
                        <Input className="h-8 text-sm" type="number" step="1" min="0" placeholder="0" value={form.par_value} onChange={(e) => setForm(p => ({ ...p, par_value: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  )}
                  <Button type="submit" className="w-full" size="sm" disabled={save.isPending}>
                    {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {editId ? "Save Changes" : "Issue Certificate"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : certificates.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No certificates issued yet.</p>
          ) : (
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Cert #</TableHead>
                    <TableHead className="text-[10px] uppercase">{t.shareholder}</TableHead>
                    <TableHead className="text-[10px] uppercase">{t.classLabel}</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">{t.shareUnit}</TableHead>
                    {!t.isLLC && <TableHead className="text-[10px] uppercase text-right">{t.parValue}</TableHead>}
                    <TableHead className="text-[10px] uppercase">Issue Date</TableHead>
                    <TableHead className="text-[10px] uppercase">Status</TableHead>
                    {t.isLLC && <TableHead className="text-[10px] uppercase text-right">Ownership %</TableHead>}
                    <TableHead className="text-[10px] uppercase w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono font-medium">{c.certificate_number}</TableCell>
                      <TableCell className="text-xs">{c.shareholders?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{c.share_class}</TableCell>
                      <TableCell className="text-xs text-right">{c.num_shares?.toLocaleString()}</TableCell>
                      {!t.isLLC && <TableCell className="text-xs text-right">{c.par_value != null ? `$${Number(c.par_value).toFixed(0)}` : "No Par"}</TableCell>}
                      <TableCell className="text-xs">{c.issue_date ? new Date(c.issue_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      {t.isLLC && (
                        <TableCell className="text-xs text-right font-semibold">
                          {c.status === "active" && totalActiveUnits > 0
                            ? `${((c.num_shares / totalActiveUnits) * 100).toFixed(2)}%`
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(c)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {c.status === "active" && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-warning" onClick={() => setCancelDialog(c.id)} title="Cancel certificate">
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(c.id)}>
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

      {/* Cancel dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(o) => { if (!o) { setCancelDialog(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-base">Cancel Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="field-group">
              <Label className="field-label">Reason for Cancellation</Label>
              <Input className="h-8 text-sm" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Transfer, redemption, error" />
            </div>
            <Button className="w-full" size="sm" variant="destructive" disabled={cancel.isPending} onClick={() => cancelDialog && cancel.mutate(cancelDialog)}>
              {cancel.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Cancel Certificate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
