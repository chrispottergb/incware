import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, UserCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface Props {
  companyId: string;
}

export default function AIOversightPersons({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ai_system_id: "", person_name: "", title: "", competence_description: "", authority_scope: "", assigned_date: "", status: "active" });

  const { data: systems = [] } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_systems").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["ai_oversight_persons", companyId],
    queryFn: async () => {
      const sysIds = systems.map((s: any) => s.id);
      if (sysIds.length === 0) return [];
      const { data, error } = await supabase.from("ai_oversight_persons").select("*").in("ai_system_id", sysIds).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: systems.length > 0,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_oversight_persons").insert({ ...form, assigned_date: form.assigned_date || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_oversight_persons", companyId] });
      toast.success("Oversight person assigned");
      setOpen(false);
      setForm({ ai_system_id: "", person_name: "", title: "", competence_description: "", authority_scope: "", assigned_date: "", status: "active" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_oversight_persons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_oversight_persons", companyId] });
      toast.success("Person removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSystemName = (id: string) => systems.find((s: any) => s.id === id)?.system_name || "Unknown";

  return (
<>
        <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Shield className="h-4 w-4" />Human Oversight Assignments (Art. 26.2)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={systems.length === 0}><Plus className="h-3.5 w-3.5 mr-1" />Assign Person</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Assign Oversight Person</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-xs">AI System *</Label>
                <Select value={form.ai_system_id} onValueChange={v => setForm(f => ({ ...f, ai_system_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                  <SelectContent>{systems.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Full Name *</Label><Input value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} /></div>
                <div><Label className="text-xs">Job Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Competence & Training</Label><Textarea rows={2} value={form.competence_description} onChange={e => setForm(f => ({ ...f, competence_description: e.target.value }))} /></div>
              <div><Label className="text-xs">Authority Scope</Label><Textarea rows={2} value={form.authority_scope} onChange={e => setForm(f => ({ ...f, authority_scope: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Assigned Date</Label><DatePickerField value={form.assigned_date || ""} onChange={v => setForm(f => ({ ...f, assigned_date: v }))} /></div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Button disabled={!form.ai_system_id || !form.person_name || add.isPending} onClick={() => add.mutate()}>Assign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {systems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Register an AI system first to assign oversight persons.</p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : persons.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No oversight persons assigned yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {persons.map((p: any) => (
            <Card key={p.id} className="relative">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  {p.person_name}
                  <Badge variant="outline" className={`text-[10px] ml-auto ${p.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>{p.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                <p className="text-[10px] text-muted-foreground">System: <span className="font-medium text-foreground">{getSystemName(p.ai_system_id)}</span></p>
                {p.competence_description && <p className="text-[10px]"><span className="text-muted-foreground">Competence:</span> {p.competence_description}</p>}
                {p.authority_scope && <p className="text-[10px]"><span className="text-muted-foreground">Authority:</span> {p.authority_scope}</p>}
                <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3 w-3" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }} title="Delete oversight person?" description="This will permanently remove this oversight person assignment." />
    </>
  );
}
