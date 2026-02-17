import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, RefreshCw, PenTool } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
  companyId: string;
  meetingDate: string;
}

export default function MeetingAuthorizedSigners({ meetingId, companyId, meetingDate }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ signer_name: "", title: "", bank_name: "" });

  // Fetch snapshot signers for this meeting
  const { data: signers = [] } = useQuery({
    queryKey: ["meeting_authorized_signers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_authorized_signers" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  // Auto-populate from bank_authorized_signers based on date ranges
  const autoPopulate = useMutation({
    mutationFn: async () => {
      // Fetch active signers for this meeting date
      const { data: activeSigners, error: fetchErr } = await supabase
        .from("bank_authorized_signers" as any)
        .select("*, company_banks(bank_name)")
        .eq("company_id", companyId)
        .lte("effective_date", meetingDate)
        .or(`end_date.is.null,end_date.gte.${meetingDate}`);
      if (fetchErr) throw fetchErr;

      if (!activeSigners || activeSigners.length === 0) {
        toast.info("No active signatories found for this meeting date");
        return;
      }

      // Get existing signer_ids to skip duplicates
      const existingIds = new Set(signers.filter((s: any) => s.signer_id).map((s: any) => s.signer_id));

      const newRows = (activeSigners as any[])
        .filter(s => !existingIds.has(s.id))
        .map(s => ({
          meeting_id: meetingId,
          signer_id: s.id,
          signer_name: s.signer_name,
          title: s.title || null,
          bank_name: s.company_banks?.bank_name || null,
        }));

      if (newRows.length === 0) {
        toast.info("All active signatories are already added");
        return;
      }

      const { error } = await supabase.from("meeting_authorized_signers" as any).insert(newRows as any);
      if (error) throw error;

      toast.success(`Added ${newRows.length} signator${newRows.length === 1 ? "y" : "ies"}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting_authorized_signers", meetingId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Manual add
  const manualAdd = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_authorized_signers" as any).insert({
        meeting_id: meetingId,
        signer_name: form.signer_name,
        title: form.title || null,
        bank_name: form.bank_name || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_authorized_signers", meetingId] });
      setAddOpen(false);
      setForm({ signer_name: "", title: "", bank_name: "" });
      toast.success("Signatory added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_authorized_signers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting_authorized_signers", meetingId] });
      toast.success("Signatory removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PenTool className="h-4 w-4" /> Authorized Signatories
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => autoPopulate.mutate()} disabled={autoPopulate.isPending} className="h-7 text-xs">
            <RefreshCw className={`h-3 w-3 mr-1 ${autoPopulate.isPending ? "animate-spin" : ""}`} />
            Auto-populate
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Add Manual
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Title</TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {signers.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-xs">{s.signer_name}</TableCell>
                <TableCell className="hidden sm:table-cell text-xs">{s.title || "—"}</TableCell>
                <TableCell className="text-xs">{s.bank_name || "—"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {signers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                  No authorized signatories recorded. Use "Auto-populate" to pull from bank records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Signatory Manually</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Signatory Name *</Label><Input value={form.signer_name} onChange={e => setForm(p => ({ ...p, signer_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div><Label className="text-xs">Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => manualAdd.mutate()} disabled={!form.signer_name.trim() || manualAdd.isPending}>
              {manualAdd.isPending ? "Saving…" : "Add Signatory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
