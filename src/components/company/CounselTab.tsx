import { useState, useCallback } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
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
import { Plus, Pencil, Trash2, Building, Scale, Calculator } from "lucide-react";
import { toast } from "sonner";

interface CounselTabProps {
  companyId: string;
}

// ─── Attorney Firms Section ───
function AttorneyFirmsSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ firm_name: "", address: "", city: "", state: "", zip: "", phone: "", email: "", website: "" });

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange } = useZipLookup(handleZipResult);

  const { data: firms = [] } = useQuery({
    queryKey: ["attorney_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorney_firms").select("*").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("attorney_firms").update({ ...form }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attorney_firms").insert({ ...form, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorney_firms", companyId] }); setOpen(false); toast.success("Attorney firm saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("attorney_firms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorney_firms", companyId] }); toast.success("Firm deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ firm_name: "", address: "", city: "", state: "", zip: "", phone: "", email: "", website: "" }); setOpen(true); };
  const openEdit = (f: any) => { setEditing(f); setForm({ firm_name: f.firm_name, address: f.address || "", city: f.city || "", state: f.state || "", zip: f.zip || "", phone: f.phone || "", email: f.email || "", website: f.website || "" }); setOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Building className="h-4 w-4" /> Attorney Firms</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Firm</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Firm Name</TableHead><TableHead className="hidden sm:table-cell">City/State</TableHead><TableHead className="hidden md:table-cell">Phone</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {firms.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium text-xs">{f.firm_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{[f.city, f.state].filter(Boolean).join(", ")}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{f.phone}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{f.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(f.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {firms.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No attorney firms yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Attorney Firm</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Firm Name *</Label><Input value={form.firm_name} onChange={e => setForm(p => ({ ...p, firm_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
              <div><Label className="text-xs">Zip</Label><Input value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Website</Label><Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.firm_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Attorneys Section ───
function AttorneysSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ attorney_name: "", title: "", firm_id: "", bar_number: "", specialty: "", phone: "", email: "", notes: "" });

  const { data: attorneys = [] } = useQuery({
    queryKey: ["attorneys", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorneys").select("*, attorney_firms(firm_name)").eq("company_id", companyId).order("attorney_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["attorney_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorney_firms").select("id, firm_name").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, firm_id: form.firm_id || null };
      if (editing) {
        const { error } = await supabase.from("attorneys").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attorneys").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorneys", companyId] }); setOpen(false); toast.success("Attorney saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("attorneys").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorneys", companyId] }); toast.success("Attorney deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ attorney_name: "", title: "", firm_id: "", bar_number: "", specialty: "", phone: "", email: "", notes: "" }); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ attorney_name: a.attorney_name, title: a.title || "", firm_id: a.firm_id || "", bar_number: a.bar_number || "", specialty: a.specialty || "", phone: a.phone || "", email: a.email || "", notes: a.notes || "" }); setOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Scale className="h-4 w-4" /> Attorneys</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Attorney</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden sm:table-cell">Title</TableHead><TableHead className="hidden sm:table-cell">Firm</TableHead><TableHead className="hidden md:table-cell">Bar #</TableHead><TableHead className="hidden lg:table-cell">Phone</TableHead><TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {attorneys.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-xs">{a.attorney_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{a.title}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{a.attorney_firms?.firm_name}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{a.bar_number}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs">{a.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {attorneys.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">No attorneys yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Attorney</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Attorney Name *</Label><Input value={form.attorney_name} onChange={e => setForm(p => ({ ...p, attorney_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Partner, Associate" /></div>
            </div>
            <div>
              <Label className="text-xs">Firm</Label>
              <Select value={form.firm_id} onValueChange={v => setForm(p => ({ ...p, firm_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select firm (optional)" /></SelectTrigger>
                <SelectContent>
                  {firms.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.firm_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Bar Number</Label><Input value={form.bar_number} onChange={e => setForm(p => ({ ...p, bar_number: e.target.value }))} /></div>
              <div><Label className="text-xs">Specialty</Label><Input value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.attorney_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Accountant Firms Section ───
function AccountantFirmsSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ firm_name: "", address: "", city: "", state: "", zip: "", phone: "", email: "", website: "" });

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange } = useZipLookup(handleZipResult);

  const { data: firms = [] } = useQuery({
    queryKey: ["accountant_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountant_firms").select("*").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("accountant_firms").update({ ...form }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accountant_firms").insert({ ...form, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountant_firms", companyId] }); setOpen(false); toast.success("Accountant firm saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("accountant_firms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountant_firms", companyId] }); toast.success("Firm deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ firm_name: "", address: "", city: "", state: "", zip: "", phone: "", email: "", website: "" }); setOpen(true); };
  const openEdit = (f: any) => { setEditing(f); setForm({ firm_name: f.firm_name, address: f.address || "", city: f.city || "", state: f.state || "", zip: f.zip || "", phone: f.phone || "", email: f.email || "", website: f.website || "" }); setOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Building className="h-4 w-4" /> Accountant / CPA Firms</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Firm</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Firm Name</TableHead><TableHead className="hidden sm:table-cell">City/State</TableHead><TableHead className="hidden md:table-cell">Phone</TableHead><TableHead className="hidden md:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {firms.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium text-xs">{f.firm_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{[f.city, f.state].filter(Boolean).join(", ")}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{f.phone}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{f.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(f.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {firms.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">No accountant firms yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Accountant Firm</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Firm Name *</Label><Input value={form.firm_name} onChange={e => setForm(p => ({ ...p, firm_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">City</Label><Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
              <div><Label className="text-xs">State</Label><Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
              <div><Label className="text-xs">Zip</Label><Input value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Website</Label><Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.firm_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Accountants Section ───
function AccountantsSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ accountant_name: "", title: "", firm_id: "", cpa_number: "", specialty: "", phone: "", email: "", notes: "" });

  const { data: accountants = [] } = useQuery({
    queryKey: ["accountants", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountants").select("*, accountant_firms(firm_name)").eq("company_id", companyId).order("accountant_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: firms = [] } = useQuery({
    queryKey: ["accountant_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountant_firms").select("id, firm_name").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, firm_id: form.firm_id || null };
      if (editing) {
        const { error } = await supabase.from("accountants").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accountants").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountants", companyId] }); setOpen(false); toast.success("Accountant saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("accountants").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountants", companyId] }); toast.success("Accountant deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ accountant_name: "", title: "", firm_id: "", cpa_number: "", specialty: "", phone: "", email: "", notes: "" }); setOpen(true); };
  const openEdit = (a: any) => { setEditing(a); setForm({ accountant_name: a.accountant_name, title: a.title || "", firm_id: a.firm_id || "", cpa_number: a.cpa_number || "", specialty: a.specialty || "", phone: a.phone || "", email: a.email || "", notes: a.notes || "" }); setOpen(true); };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" /> Accountants / CPAs</CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Accountant</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden sm:table-cell">Title</TableHead><TableHead className="hidden sm:table-cell">Firm</TableHead><TableHead className="hidden md:table-cell">CPA #</TableHead><TableHead className="hidden lg:table-cell">Phone</TableHead><TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
          <TableBody>
            {accountants.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-xs">{a.accountant_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{a.title}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{a.accountant_firms?.firm_name}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{a.cpa_number}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs">{a.email}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {accountants.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">No accountants yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Accountant</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Accountant Name *</Label><Input value={form.accountant_name} onChange={e => setForm(p => ({ ...p, accountant_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Partner, Staff CPA" /></div>
            </div>
            <div>
              <Label className="text-xs">Firm</Label>
              <Select value={form.firm_id} onValueChange={v => setForm(p => ({ ...p, firm_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select firm (optional)" /></SelectTrigger>
                <SelectContent>
                  {firms.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.firm_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">CPA Number</Label><Input value={form.cpa_number} onChange={e => setForm(p => ({ ...p, cpa_number: e.target.value }))} /></div>
              <div><Label className="text-xs">Specialty</Label><Input value={form.specialty} onChange={e => setForm(p => ({ ...p, specialty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.accountant_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main CounselTab ───
export default function CounselTab({ companyId }: CounselTabProps) {
  return (
    <div className="space-y-5">
      <AttorneyFirmsSection companyId={companyId} />
      <AttorneysSection companyId={companyId} />
      <AccountantFirmsSection companyId={companyId} />
      <AccountantsSection companyId={companyId} />
    </div>
  );
}
