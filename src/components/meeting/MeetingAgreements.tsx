import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

const AGREEMENT_TYPE_OPTIONS = [
  "Buy-Sell Agreement",
  "Employment Contract",
  "Non-Compete Agreement",
  "Lease Agreement",
  "Service Agreement",
  "Partnership Agreement",
  "Other",
];

interface Props {
  meetingId: string;
}

interface AgreementForm {
  agreement_type: string;
  agreement_date: string;
  agreement_with: string;
  agreement_purpose: string;
}

const emptyForm: AgreementForm = {
  agreement_type: "",
  agreement_date: "",
  agreement_with: "",
  agreement_purpose: "",
};

export default function MeetingAgreements({ meetingId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AgreementForm>(emptyForm);

  const { data: rows = [] } = useQuery({
    queryKey: ["agreements", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const addRow = useMutation({
    mutationFn: async () => {
      const payload: any = {
        meeting_id: meetingId,
        agreement_type: form.agreement_type,
        agreement_date: form.agreement_date || null,
        agreement_with: form.agreement_with || null,
        agreement_purpose: form.agreement_purpose || null,
      };
      const { error } = await supabase.from("agreements" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements", meetingId] });
      closeDialog();
      toast.success("Agreement added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload: any = {
        agreement_type: form.agreement_type,
        agreement_date: form.agreement_date || null,
        agreement_with: form.agreement_with || null,
        agreement_purpose: form.agreement_purpose || null,
      };
      const { error } = await supabase
        .from("agreements" as any)
        .update(payload as any)
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements", meetingId] });
      closeDialog();
      toast.success("Agreement updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("agreements" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agreements", meetingId] });
      toast.success("Agreement removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      agreement_type: row.agreement_type || "",
      agreement_date: row.agreement_date || "",
      agreement_with: row.agreement_with || "",
      agreement_purpose: row.agreement_purpose || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateRow.mutate();
    else addRow.mutate();
  };

  const isPending = addRow.isPending || updateRow.isPending;
  const updateField = (key: keyof AgreementForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Agreements</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Agreement" : "Add Agreement"}</DialogTitle>
              <DialogDescription>Enter the agreement details.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Agreement Type</Label>
                  <Select value={form.agreement_type} onValueChange={(v) => updateField("agreement_type", v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {AGREEMENT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Date</Label>
                  <Input type="date" value={form.agreement_date} onChange={(e) => updateField("agreement_date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">With (Party Name)</Label>
                  <Input value={form.agreement_with} onChange={(e) => updateField("agreement_with", e.target.value)} placeholder="Party name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Purpose</Label>
                  <Textarea value={form.agreement_purpose} onChange={(e) => updateField("agreement_purpose", e.target.value)} rows={3} placeholder="Describe the agreement purpose…" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !form.agreement_type}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Agreement"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No agreements recorded</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>With</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium text-sm">{row.agreement_type}</TableCell>
                    <TableCell className="text-sm">{row.agreement_date ? new Date(row.agreement_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-sm">{row.agreement_with || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{row.agreement_purpose || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteRow.mutate(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
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
  );
}
