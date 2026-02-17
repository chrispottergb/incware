import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { toast } from "sonner";

interface BanksTabProps {
  companyId: string;
}

const ACCOUNT_TYPES = ["checking", "savings", "money_market", "cd", "line_of_credit", "loan", "other"];

export default function BanksTab({ companyId }: BanksTabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { bank_name: "", account_type: "checking", account_number: "", routing_number: "", contact_name: "", contact_title: "", phone: "", address: "", city: "", state: "", zip: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const { data: banks = [] } = useQuery({
    queryKey: ["company_banks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_banks").select("*").eq("company_id", companyId).order("bank_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("company_banks").update({ ...form }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_banks").insert({ ...form, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_banks", companyId] }); setOpen(false); toast.success("Bank saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("company_banks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_banks", companyId] }); toast.success("Bank deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      bank_name: b.bank_name, account_type: b.account_type || "checking", account_number: b.account_number || "",
      routing_number: b.routing_number || "", contact_name: b.contact_name || "", contact_title: b.contact_title || "",
      phone: b.phone || "", address: b.address || "", city: b.city || "", state: b.state || "", zip: b.zip || "", notes: b.notes || "",
    });
    setOpen(true);
  };

  const formatType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank Accounts</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Bank</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank Name</TableHead>
              <TableHead>Account Type</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead>Routing #</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-xs">{b.bank_name}</TableCell>
                <TableCell className="text-xs">{formatType(b.account_type || "")}</TableCell>
                <TableCell className="text-xs font-mono">{b.account_number ? `••••${b.account_number.slice(-4)}` : ""}</TableCell>
                <TableCell className="text-xs font-mono">{b.routing_number}</TableCell>
                <TableCell className="text-xs">{[b.contact_name, b.contact_title].filter(Boolean).join(", ")}</TableCell>
                <TableCell className="text-xs">{b.phone}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(b)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(b.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {banks.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">No bank accounts yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Bank Account</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Bank Name *</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Account Type</Label>
                <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Account #</Label><Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
              <div><Label className="text-xs">Routing #</Label><Input value={form.routing_number} onChange={e => setForm(p => ({ ...p, routing_number: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Contact Title</Label><Input value={form.contact_title} onChange={e => setForm(p => ({ ...p, contact_title: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
              <div><Label className="text-xs">Zip</Label><Input value={form.zip} onChange={e => setForm(p => ({ ...p, zip: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.bank_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
