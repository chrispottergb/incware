import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  meetingId: string;
  titleOptions: string[];
}

export default function MeetingOfficersTable({ meetingId, titleOptions }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteOfficer, setNoteOfficer] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_officers", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_officers")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const buildPayload = () => ({
    meeting_id: meetingId,
    title: form.title || null,
    name: form.name || null,
    salary: form.salary ? parseFloat(form.salary) : null,
    bonus: form.bonus ? parseFloat(form.bonus) : null,
  });

  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_officers").insert(buildPayload() as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      closeDialog();
      toast.success("Added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      delete (payload as any).meeting_id;
      const { error } = await supabase.from("meeting_officers").update(payload as any).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      closeDialog();
      toast.success("Updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_officers").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      toast.success("Removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_officers")
        .update({ compensation_note: noteText || null } as any)
        .eq("id", noteOfficer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      setNoteDialogOpen(false);
      setNoteOfficer(null);
      toast.success("Note saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm({});
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      title: row.title ?? "",
      name: row.name ?? "",
      salary: row.salary != null ? String(row.salary) : "",
      bonus: row.bonus != null ? String(row.bonus) : "",
    });
    setDialogOpen(true);
  };

  const openNote = (row: any) => {
    setNoteOfficer(row);
    const existingNote = row.compensation_note;
    if (existingNote) {
      setNoteText(existingNote);
    } else {
      const title = row.title || "Officer";
      setNoteText(
        `The Board determined that the ${title} position is held in a limited, non-compensable capacity, as the duties performed do not constitute substantial services under IRC § 1366.`
      );
    }
    setNoteDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateRow.mutate();
    else addRow.mutate();
  };

  const isPending = addRow.isPending || updateRow.isPending;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-display text-base">Officers</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm({}); }}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">{editingId ? "Edit Officers" : "Add Officers"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Title</Label>
                  <Select value={form.title ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, title: v }))}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder="Select Title..." /></SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-[300px]">
                      {titleOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Name</Label>
                  <Input value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Salary</Label>
                  <Input type="number" step="0.01" value={form.salary ?? ""} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Bonus</Label>
                  <Input type="number" step="0.01" value={form.bonus ?? ""} onChange={(e) => setForm((p) => ({ ...p, bonus: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Save Changes" : "Add"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <p className="text-sm text-muted-foreground">No entries yet</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Title</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const hasNote = !!row.compensation_note;
                    const noSalary = row.salary == null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell>{row.title ?? "—"}</TableCell>
                        <TableCell>{row.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.salary != null ? Number(row.salary).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.bonus != null ? Number(row.bonus).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openNote(row)}
                                    className={`h-8 w-8 ${hasNote ? "text-primary" : noSalary ? "text-amber-500/70 hover:text-amber-600" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                  >
                                    <FileText className="h-4 w-4" />
                                    {hasNote && (
                                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasNote ? "Edit compensation note" : "Add compensation note"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(row)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRow.mutate(row.id)}
                              className="h-8 w-8 text-destructive/60 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compensation Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => { if (!open) { setNoteDialogOpen(false); setNoteOfficer(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Compensation Note — {noteOfficer?.name} ({noteOfficer?.title})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              placeholder="Enter compensation note..."
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => saveNote.mutate()}
                disabled={saveNote.isPending}
              >
                {saveNote.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Note
              </Button>
              {noteOfficer?.compensation_note && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNoteText("");
                    saveNote.mutate();
                  }}
                  disabled={saveNote.isPending}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
