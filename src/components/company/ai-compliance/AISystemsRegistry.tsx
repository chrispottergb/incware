import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
}

const riskColors: Record<string, string> = {
  minimal: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  limited: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  unacceptable: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  suspended: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  decommissioned: "bg-muted text-muted-foreground border-muted",
};

const emptyForm = {
  system_name: "",
  provider: "",
  risk_level: "minimal",
  purpose: "",
  deployment_date: "",
  status: "active",
  instructions_for_use: "",
  data_categories: "",
};

export default function AISystemsRegistry({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_systems")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = { ...form, company_id: companyId, deployment_date: form.deployment_date || null };
      if (editId) {
        const { error } = await supabase.from("ai_systems").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_systems").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_systems", companyId] });
      toast.success(editId ? "System updated" : "System registered");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_systems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_systems", companyId] });
      toast.success("System removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      system_name: s.system_name,
      provider: s.provider || "",
      risk_level: s.risk_level,
      purpose: s.purpose || "",
      deployment_date: s.deployment_date || "",
      status: s.status,
      instructions_for_use: s.instructions_for_use || "",
      data_categories: s.data_categories || "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Systems Registry</h3>
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Register System</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Register"} AI System</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">System Name *</Label><Input value={form.system_name} onChange={e => setForm(f => ({ ...f, system_name: e.target.value }))} /></div>
                <div><Label className="text-xs">Provider</Label><Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Risk Level</Label>
                  <Select value={form.risk_level} onValueChange={v => setForm(f => ({ ...f, risk_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="unacceptable">Unacceptable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="decommissioned">Decommissioned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Deployment Date</Label><Input type="date" value={form.deployment_date} onChange={e => setForm(f => ({ ...f, deployment_date: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Purpose</Label><Textarea rows={2} value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} /></div>
              <div><Label className="text-xs">Data Categories</Label><Input value={form.data_categories} onChange={e => setForm(f => ({ ...f, data_categories: e.target.value }))} /></div>
              <div><Label className="text-xs">Instructions for Use</Label><Textarea rows={2} value={form.instructions_for_use} onChange={e => setForm(f => ({ ...f, instructions_for_use: e.target.value }))} /></div>
              <Button disabled={!form.system_name || upsert.isPending} onClick={() => upsert.mutate()}>
                {editId ? "Update" : "Register"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : systems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No AI systems registered yet.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">System</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Deployed</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-medium">{s.system_name}</TableCell>
                  <TableCell className="text-xs">{s.provider || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${riskColors[s.risk_level] || ""}`}>{s.risk_level}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusColors[s.status] || ""}`}>{s.status}</Badge></TableCell>
                  <TableCell className="text-xs">{s.deployment_date ? new Date(s.deployment_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
