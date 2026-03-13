import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Loader2, Pencil, CheckCircle2, AlertTriangle, Flag, Minus } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

type CompensationStatus = "reasonable" | "below_market" | "above_market" | "non_compensable";

const STATUS_CONFIG: Record<CompensationStatus, { label: string; icon: React.ElementType; color: string; badgeVariant: string }> = {
  reasonable: { label: "Reasonable", icon: CheckCircle2, color: "text-emerald-600", badgeVariant: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  below_market: { label: "Below Market", icon: AlertTriangle, color: "text-amber-500", badgeVariant: "bg-amber-100 text-amber-700 border-amber-200" },
  above_market: { label: "Above Market", icon: Flag, color: "text-orange-500", badgeVariant: "bg-orange-100 text-orange-700 border-orange-200" },
  non_compensable: { label: "Non-Compensable", icon: Minus, color: "text-muted-foreground", badgeVariant: "bg-muted text-muted-foreground border-border" },
};

function getDefaultNoteText(status: CompensationStatus, name: string, title: string, salary: number | null): string {
  const amt = salary != null ? `$${Number(salary).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "$[AMOUNT]";
  switch (status) {
    case "reasonable":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} is reasonable and commensurate with the services performed, consistent with IRC § 1366.`;
    case "below_market":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} is below prevailing market rates. The Board finds this level of compensation appropriate at this time for the following reason: [REASON]. The Board intends to review this compensation at the next annual meeting.`;
    case "above_market":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} exceeds prevailing market rates. The Board finds this level of compensation justified for the following reason: [REASON], and has documented its reasoning in support of this determination.`;
    case "non_compensable":
      return `The Board determined that the ${title} position is held in a limited, non-compensable capacity, as the duties performed do not constitute substantial services under IRC § 1366.`;
  }
}

interface Props {
  meetingId: string;
  titleOptions: string[];
}

export default function MeetingOfficersTable({ meetingId, titleOptions }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [compDialogOpen, setCompDialogOpen] = useState(false);
  const [compOfficer, setCompOfficer] = useState<any>(null);
  const [compStatus, setCompStatus] = useState<CompensationStatus | "">("");
  const [compNote, setCompNote] = useState("");

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

  // Validation: expose whether all officers have status set
  const missingStatus = rows.filter((r: any) => !r.compensation_status);
  const hasReasonIssue = rows.some((r: any) => {
    if (!r.compensation_status) return false;
    if ((r.compensation_status === "below_market" || r.compensation_status === "above_market") && r.compensation_note?.includes("[REASON]")) return true;
    return false;
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

  const saveComp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_officers")
        .update({
          compensation_status: compStatus || null,
          compensation_note: compNote || null,
        } as any)
        .eq("id", compOfficer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      setCompDialogOpen(false);
      setCompOfficer(null);
      toast.success("Compensation status saved!");
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

  const openCompDialog = (row: any) => {
    setCompOfficer(row);
    const existingStatus = row.compensation_status as CompensationStatus | null;
    const existingNote = row.compensation_note as string | null;

    if (existingStatus) {
      setCompStatus(existingStatus);
      setCompNote(existingNote || getDefaultNoteText(existingStatus, row.name || "Officer", row.title || "Officer", row.salary));
    } else {
      // Auto-suggest based on salary presence
      const noSalary = row.salary == null;
      const suggestedStatus: CompensationStatus = noSalary ? "non_compensable" : "reasonable";
      setCompStatus(suggestedStatus);
      setCompNote(getDefaultNoteText(suggestedStatus, row.name || "Officer", row.title || "Officer", row.salary));
    }
    setCompDialogOpen(true);
  };

  const handleStatusChange = (newStatus: CompensationStatus) => {
    setCompStatus(newStatus);
    // Re-generate default text for new status
    if (compOfficer) {
      setCompNote(getDefaultNoteText(newStatus, compOfficer.name || "Officer", compOfficer.title || "Officer", compOfficer.salary));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateRow.mutate();
    else addRow.mutate();
  };

  const isPending = addRow.isPending || updateRow.isPending;

  const getStatusOptions = (row: any) => {
    const noSalary = row.salary == null;
    const options: CompensationStatus[] = ["reasonable", "below_market", "above_market"];
    if (noSalary) options.push("non_compensable");
    return options;
  };

  const canSaveComp = () => {
    if (!compStatus) return false;
    if ((compStatus === "below_market" || compStatus === "above_market") && compNote.includes("[REASON]")) return false;
    return true;
  };

  return (
    <>
      {/* Validation warning banner */}
      {rows.length > 0 && (missingStatus.length > 0 || hasReasonIssue) && (
        <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-800 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {missingStatus.length > 0 && (
              <span>
                {missingStatus.length} officer{missingStatus.length > 1 ? "s" : ""} missing a Compensation Status.{" "}
              </span>
            )}
            {hasReasonIssue && (
              <span>Some officers have an unresolved [REASON] placeholder in their justification text. </span>
            )}
            <span className="font-medium">All statuses must be set before minutes can be generated.</span>
          </AlertDescription>
        </Alert>
      )}

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
                <DialogTitle className="font-display">{editingId ? "Edit Officer" : "Add Officer"}</DialogTitle>
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const status = row.compensation_status as CompensationStatus | null;
                    const cfg = status ? STATUS_CONFIG[status] : null;
                    const StatusIcon = cfg?.icon;
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
                        <TableCell className="text-center">
                          {cfg && StatusIcon ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className={`cursor-pointer text-[10px] gap-1 px-2 py-0.5 ${cfg.badgeVariant}`}
                                    onClick={() => openCompDialog(row)}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {cfg.label}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  {row.compensation_note ? row.compensation_note.substring(0, 120) + (row.compensation_note.length > 120 ? "…" : "") : "Click to edit"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px] text-muted-foreground/60 hover:text-foreground border border-dashed border-border"
                              onClick={() => openCompDialog(row)}
                            >
                              Set Status
                            </Button>
                          )}
                        </TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compensation Status Dialog */}
      <Dialog open={compDialogOpen} onOpenChange={(open) => { if (!open) { setCompDialogOpen(false); setCompOfficer(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Compensation Status — {compOfficer?.name} ({compOfficer?.title})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Compensation Status</Label>
              <Select value={compStatus} onValueChange={(v) => handleStatusChange(v as CompensationStatus)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {compOfficer && getStatusOptions(compOfficer).map((s) => {
                    const c = STATUS_CONFIG[s];
                    const Icon = c.icon;
                    return (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <Icon className={`h-3.5 w-3.5 ${c.color}`} />
                          {c.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {compStatus && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Justification Text</Label>
                <Textarea
                  value={compNote}
                  onChange={(e) => setCompNote(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
                {(compStatus === "below_market" || compStatus === "above_market") && compNote.includes("[REASON]") && (
                  <p className="text-xs text-destructive font-medium">
                    Replace [REASON] with the specific justification before saving.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => saveComp.mutate()}
                disabled={saveComp.isPending || !canSaveComp()}
              >
                {saveComp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              {compOfficer?.compensation_status && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCompStatus("");
                    setCompNote("");
                    saveComp.mutate();
                  }}
                  disabled={saveComp.isPending}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
