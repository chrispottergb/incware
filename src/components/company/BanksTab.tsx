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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Pencil, Trash2, Landmark, PenTool, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BanksTabProps {
  companyId: string;
}

const ACCOUNT_TYPES = ["checking", "savings", "money_market", "cd", "line_of_credit", "loan", "other"];

// ─── Authorized Signers Section ───
function AuthorizedSignersSection({ companyId, banks }: { companyId: string; banks: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ signer_name: "", title: "", bank_id: "", effective_date: new Date().toISOString().split("T")[0], end_date: "" });

  const { data: signers = [] } = useQuery({
    queryKey: ["bank_authorized_signers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_authorized_signers")
        .select("*, company_banks(bank_name)")
        .eq("company_id", companyId)
        .order("signer_name");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        signer_name: form.signer_name,
        title: form.title || null,
        bank_id: form.bank_id,
        effective_date: form.effective_date || null,
        end_date: form.end_date || null,
      };
      if (editingId) {
        const { error } = await supabase.from("bank_authorized_signers" as any).update(payload as any).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_authorized_signers" as any).insert({ ...payload, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      setOpen(false);
      resetSignerForm();
      toast.success(editingId ? "Signatory updated" : "Authorized signatory added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_authorized_signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      toast.success("Signatory removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetSignerForm = () => {
    setForm({ signer_name: "", title: "", bank_id: banks.length === 1 ? banks[0].id : "", effective_date: new Date().toISOString().split("T")[0], end_date: "" });
    setEditingId(null);
  };

  const openNew = () => {
    resetSignerForm();
    if (banks.length === 1) setForm(p => ({ ...p, bank_id: banks[0].id }));
    setOpen(true);
  };

  const openEditSigner = (s: any) => {
    setEditingId(s.id);
    setForm({
      signer_name: s.signer_name || "", title: s.title || "", bank_id: s.bank_id || "",
      effective_date: s.effective_date || "", end_date: s.end_date || "",
    });
    setOpen(true);
  };

  const isActive = (s: any) => {
    const today = new Date().toISOString().split("T")[0];
    const eff = s.effective_date;
    const end = s.end_date;
    if (!eff) return true;
    if (eff > today) return false;
    if (end && end < today) return false;
    return true;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PenTool className="h-4 w-4" /> Authorized Signatories
        </CardTitle>
        <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs" disabled={banks.length === 0}>
          <Plus className="h-3 w-3 mr-1" />Add Signatory
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Title</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="hidden md:table-cell">Effective</TableHead>
              <TableHead className="hidden md:table-cell">End</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {signers.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-xs">{s.signer_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{s.title}</TableCell>
                <TableCell className="text-xs">{s.company_banks?.bank_name}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{s.effective_date ? new Date(s.effective_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{s.end_date ? new Date(s.end_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <Badge variant={isActive(s) ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                    {isActive(s) ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditSigner(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(s.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {signers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                  {banks.length === 0 ? "Add a bank account first" : "No authorized signatories yet"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit" : "Add"} Authorized Signatory</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Bank Account *</Label>
              <Select value={form.bank_id} onValueChange={v => setForm(p => ({ ...p, bank_id: v }))}>
                <SelectTrigger className="bg-popover"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {banks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name} ({b.account_type?.replace(/_/g, " ")})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Signatory Name *</Label><Input value={form.signer_name} onChange={e => setForm(p => ({ ...p, signer_name: e.target.value }))} /></div>
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. President, Treasurer" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Effective Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !form.effective_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {form.effective_date ? format(new Date(form.effective_date + "T00:00:00"), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.effective_date ? new Date(form.effective_date + "T00:00:00") : undefined} onSelect={d => setForm(p => ({ ...p, effective_date: d ? d.toISOString().split("T")[0] : "" }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">End Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !form.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {form.end_date ? format(new Date(form.end_date + "T00:00:00"), "PPP") : "Still active"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.end_date ? new Date(form.end_date + "T00:00:00") : undefined} onSelect={d => setForm(p => ({ ...p, end_date: d ? d.toISOString().split("T")[0] : "" }))} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={!form.signer_name.trim() || !form.bank_id || save.isPending}>
              {save.isPending ? "Saving…" : editingId ? "Save Changes" : "Add Signatory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main BanksTab ───
export default function BanksTab({ companyId }: BanksTabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { bank_name: "", account_type: "checking", account_number: "", routing_number: "", contact_name: "", contact_title: "", phone: "", address: "", city: "", state: "", zip: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange } = useZipLookup(handleZipResult);

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
    <div className="space-y-5">
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
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Account #</TableHead>
                <TableHead className="hidden md:table-cell">Routing #</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {banks.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium text-xs">{b.bank_name}</TableCell>
                  <TableCell className="text-xs">{formatType(b.account_type || "")}</TableCell>
                  <TableCell className="hidden sm:table-cell text-xs font-mono">{b.account_number ? `••••${b.account_number.slice(-4)}` : ""}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs font-mono">{b.routing_number}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{[b.contact_name, b.contact_title].filter(Boolean).join(", ")}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{b.phone}</TableCell>
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
                    <SelectContent className="bg-popover z-50">
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
                <div><Label className="text-xs">Zip</Label><Input value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} /></div>
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            </div>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.bank_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>

      <AuthorizedSignersSection companyId={companyId} banks={banks} />
    </div>
  );
}
