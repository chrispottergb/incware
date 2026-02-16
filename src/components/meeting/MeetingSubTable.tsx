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
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Column {
  key: string;
  label: string;
  type?: "number" | "text" | "select";
  options?: string[];
  required?: boolean;
  wide?: boolean;
}

interface Props {
  meetingId: string;
  tableName: string;
  title: string;
  columns: Column[];
}

export default function MeetingSubTable({ meetingId, tableName, title, columns }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: rows = [] } = useQuery({
    queryKey: [tableName, meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const buildPayload = () => {
    const payload: Record<string, any> = { meeting_id: meetingId };
    columns.forEach((col) => {
      const val = form[col.key] || "";
      if (col.type === "number") {
        payload[col.key] = val ? parseFloat(val) : null;
      } else {
        payload[col.key] = val || null;
      }
    });
    return payload;
  };

  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(tableName as any).insert(buildPayload() as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      closeDialog();
      toast.success("Added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      delete payload.meeting_id;
      const { error } = await supabase.from(tableName as any).update(payload as any).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      closeDialog();
      toast.success("Updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      toast.success("Removed.");
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
    const f: Record<string, string> = {};
    columns.forEach((col) => {
      f[col.key] = row[col.key] != null ? String(row[col.key]) : "";
    });
    setForm(f);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateRow.mutate();
    } else {
      addRow.mutate();
    }
  };

  const isPending = addRow.isPending || updateRow.isPending;

  const renderField = (col: Column) => {
    if (col.type === "select" && col.options) {
      return (
        <Select value={form[col.key] ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, [col.key]: v }))}>
          <SelectTrigger className="bg-background"><SelectValue placeholder={`Select ${col.label}...`} /></SelectTrigger>
          <SelectContent className="bg-popover z-50 max-h-[300px]">
            {col.options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (col.wide) {
      return (
        <Textarea
          value={form[col.key] ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, [col.key]: e.target.value }))}
          required={col.required}
          rows={3}
        />
      );
    }
    return (
      <Input
        type={col.type === "number" ? "number" : "text"}
        step={col.type === "number" ? "0.01" : undefined}
        value={form[col.key] ?? ""}
        onChange={(e) => setForm((p) => ({ ...p, [col.key]: e.target.value }))}
        required={col.required}
      />
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">{title}</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm({}); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {columns.map((col) => (
                <div key={col.key} className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">{col.label}</Label>
                  {renderField(col)}
                </div>
              ))}
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
                  {columns.map((col) => (
                    <TableHead key={col.key} className={col.type === "number" ? "text-right" : ""}>
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.type === "number" ? "text-right font-mono text-sm" : ""}>
                        {col.type === "number" && row[col.key] != null
                          ? Number(row[col.key]).toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : row[col.key] ?? "—"}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-1">
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
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
