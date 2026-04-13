import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface Props {
  companyId: string;
}

const severityColors: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  serious: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColors: Record<string, string> = {
  open: "bg-destructive/10 text-destructive border-destructive/20",
  investigating: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  resolved: "bg-success/10 text-success border-success/20",
};

const emptyForm = {
  ai_system_id: "",
  incident_date: "",
  severity: "low",
  description: "",
  actions_taken: "",
  provider_notified: false,
  authority_notified: false,
  reported_by: "",
  status: "open",
};

export default function AIRiskIncidents({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: systems = [] } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_systems").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["ai_risk_incidents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_risk_incidents").select("*").eq("company_id", companyId).order("incident_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_risk_incidents").insert({ ...form, company_id: companyId, incident_date: form.incident_date || new Date().toISOString().split("T")[0] });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_risk_incidents", companyId] });
      toast.success("Incident reported");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_risk_incidents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_risk_incidents", companyId] });
      toast.success("Incident removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSystemName = (id: string) => systems.find((s: any) => s.id === id)?.system_name || "Unknown";

  return (
<>
        <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />Risk & Incidents (Art. 26.5)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={systems.length === 0}><Plus className="h-3.5 w-3.5 mr-1" />Report Incident</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Report AI Incident</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">AI System *</Label>
                  <Select value={form.ai_system_id} onValueChange={v => setForm(f => ({ ...f, ai_system_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{systems.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Severity</Label>
                  <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="serious">Serious</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Incident Date</Label><DatePickerField value={form.incident_date} onChange={v => setForm(f => ({ ...f, incident_date: v }))} /></div>
                <div><Label className="text-xs">Reported By</Label><Input value={form.reported_by} onChange={e => setForm(f => ({ ...f, reported_by: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs">Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label className="text-xs">Actions Taken</Label><Textarea rows={2} value={form.actions_taken} onChange={e => setForm(f => ({ ...f, actions_taken: e.target.value }))} /></div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><Checkbox checked={form.provider_notified} onCheckedChange={v => setForm(f => ({ ...f, provider_notified: !!v }))} /><Label className="text-xs">Provider notified</Label></div>
                <div className="flex items-center gap-2"><Checkbox checked={form.authority_notified} onCheckedChange={v => setForm(f => ({ ...f, authority_notified: !!v }))} /><Label className="text-xs">Authority notified</Label></div>
              </div>
              <Button disabled={!form.ai_system_id || add.isPending} onClick={() => add.mutate()}>Report</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No incidents reported.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">System</TableHead>
                <TableHead className="text-xs">Severity</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Reported By</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">{new Date(i.incident_date + "T00:00:00").toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">{getSystemName(i.ai_system_id)}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${severityColors[i.severity] || ""}`}>{i.severity}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusColors[i.status] || ""}`}>{i.status}</Badge></TableCell>
                  <TableCell className="text-xs">{i.reported_by || "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(i.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }} title="Delete incident?" description="This will permanently remove this incident report." />
    </>
  );
}
