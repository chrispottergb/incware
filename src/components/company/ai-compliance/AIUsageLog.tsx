import { useState } from "react";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
}

const decisionColors: Record<string, string> = {
  approved: "bg-success/10 text-success border-success/20",
  modified: "bg-warning/10 text-warning border-warning/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
};

const emptyForm = {
  ai_system_id: "",
  usage_type: "general",
  description: "",
  input_summary: "",
  output_summary: "",
  human_reviewer: "",
  review_decision: "",
  review_notes: "",
  affected_persons_notified: false,
};

export default function AIUsageLog({ companyId }: Props) {
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

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["ai_usage_logs", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_usage_logs").select("*").eq("company_id", companyId).order("usage_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_usage_logs").insert({ ...form, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_usage_logs", companyId] });
      toast.success("Usage logged");
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_usage_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_usage_logs", companyId] });
      toast.success("Log entry removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSystemName = (id: string) => systems.find((s: any) => s.id === id)?.system_name || "Unknown";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Usage Log (Art. 26.6)</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={systems.length === 0}><Plus className="h-3.5 w-3.5 mr-1" />Log Usage</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log AI Usage</DialogTitle></DialogHeader>
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
                  <Label className="text-xs">Usage Type</Label>
                  <Select value={form.usage_type} onValueChange={v => setForm(f => ({ ...f, usage_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="decision-support">Decision Support</SelectItem>
                      <SelectItem value="content-generation">Content Generation</SelectItem>
                      <SelectItem value="data-analysis">Data Analysis</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label className="text-xs">Input Summary</Label><Textarea rows={2} value={form.input_summary} onChange={e => setForm(f => ({ ...f, input_summary: e.target.value }))} /></div>
              <div><Label className="text-xs">Output Summary</Label><Textarea rows={2} value={form.output_summary} onChange={e => setForm(f => ({ ...f, output_summary: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Human Reviewer</Label><Input value={form.human_reviewer} onChange={e => setForm(f => ({ ...f, human_reviewer: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">Review Decision</Label>
                  <Select value={form.review_decision} onValueChange={v => setForm(f => ({ ...f, review_decision: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="modified">Modified</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs">Review Notes</Label><Textarea rows={2} value={form.review_notes} onChange={e => setForm(f => ({ ...f, review_notes: e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.affected_persons_notified} onCheckedChange={v => setForm(f => ({ ...f, affected_persons_notified: !!v }))} />
                <Label className="text-xs">Affected persons notified (Art. 26.11)</Label>
              </div>
              <Button disabled={!form.ai_system_id || add.isPending} onClick={() => add.mutate()}>Log Entry</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No usage logged yet.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">System</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Reviewer</TableHead>
                <TableHead className="text-xs">Decision</TableHead>
                <TableHead className="text-xs">Notified</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.usage_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-xs">{getSystemName(l.ai_system_id)}</TableCell>
                  <TableCell className="text-xs">{l.usage_type}</TableCell>
                  <TableCell className="text-xs">{l.human_reviewer || "—"}</TableCell>
                  <TableCell>{l.review_decision ? <Badge variant="outline" className={`text-[10px] ${decisionColors[l.review_decision] || ""}`}>{l.review_decision}</Badge> : "—"}</TableCell>
                  <TableCell className="text-xs">{l.affected_persons_notified ? "✓" : "—"}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(l.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
