import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
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
import { Plus, Trash2, Loader2, Pencil, CheckCircle2, AlertTriangle, Flag, Minus, Link2, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";

type CompensationStatus = "pending_approval" | "reasonable" | "below_market" | "above_market" | "included_in_primary" | "non_compensable";
type DualRoleType = "primary" | "secondary" | null;

const TITLE_RANK: Record<string, number> = {
  "President": 1, "Managing Member": 1,
  "Vice President": 2,
  "Treasurer": 3,
  "Secretary": 4,
};

const STATUS_CONFIG: Record<CompensationStatus, { label: string; icon: React.ElementType; color: string; badgeVariant: string }> = {
  pending_approval: { label: "Pending Approval", icon: Clock, color: "text-violet-500", badgeVariant: "bg-violet-100 text-violet-700 border-violet-200" },
  reasonable: { label: "Reasonable", icon: CheckCircle2, color: "text-emerald-600", badgeVariant: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  below_market: { label: "Below Market", icon: AlertTriangle, color: "text-amber-500", badgeVariant: "bg-amber-100 text-amber-700 border-amber-200" },
  above_market: { label: "Above Market", icon: Flag, color: "text-orange-500", badgeVariant: "bg-orange-100 text-orange-700 border-orange-200" },
  included_in_primary: { label: "Included in Primary", icon: Link2, color: "text-blue-500", badgeVariant: "bg-blue-100 text-blue-700 border-blue-200" },
  non_compensable: { label: "Non-Compensable", icon: Minus, color: "text-muted-foreground", badgeVariant: "bg-muted text-muted-foreground border-border" },
};

function getDefaultNoteText(
  status: CompensationStatus,
  name: string,
  title: string,
  salary: number | null,
  primaryTitle?: string,
  secondaryTitle?: string,
): string {
  const amt = salary != null ? `$${Number(salary).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "$[AMOUNT]";
  switch (status) {
    case "pending_approval":
      return `Compensation for ${name} as ${title} has not yet been established. Compensation to be determined and approved by Board or Member Resolution at a future meeting.`;
    case "reasonable":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} is reasonable and commensurate with the services performed, consistent with IRC § 1366.`;
    case "below_market":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} is below prevailing market rates. The Board finds this level of compensation appropriate at this time for the following reason: [REASON]. The Board intends to review this compensation at the next annual meeting.`;
    case "above_market":
      return `The Board has reviewed the compensation of ${name} as ${title} and determined that the salary of ${amt} exceeds prevailing market rates. The Board finds this level of compensation justified for the following reason: [REASON], and has documented its reasoning in support of this determination.`;
    case "included_in_primary":
      return `${name} serves as both ${primaryTitle || "[PRIMARY TITLE]"} and ${secondaryTitle || "[SECONDARY TITLE]"} of the corporation. Compensation is reported under the ${primaryTitle || "[PRIMARY TITLE]"} title. The Board determined that no separate compensation is assigned to the ${secondaryTitle || "[SECONDARY TITLE]"} role, as it is fulfilled by the same individual in conjunction with their primary duties.`;
    case "non_compensable":
      return `The Board determined that the ${title} position is held in a limited, non-compensable capacity, as the duties performed do not constitute substantial services under IRC § 1366.`;
  }
}

function getTitleRank(title: string): number {
  return TITLE_RANK[title] ?? 99;
}

interface DualRoleGroup {
  name: string;
  rows: any[];
  primaryId: string | null;
  secondaryIds: string[];
  needsDesignation: boolean;
}

interface Props {
  meetingId: string;
  titleOptions: string[];
}

export default function MeetingOfficersTable({ meetingId, titleOptions }: Props) {
  const queryClient = useQueryClient();
  const { upsert: upsertAddressBook } = useAddressBookContext();
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

  // --- Dual-role detection ---
  const dualRoleGroups = useMemo<Map<string, DualRoleGroup>>(() => {
    const groups = new Map<string, DualRoleGroup>();
    const byName = new Map<string, any[]>();
    rows.forEach((r: any) => {
      const key = (r.name || "").trim().toLowerCase();
      if (!key) return;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(r);
    });
    byName.forEach((rowsForName, key) => {
      if (rowsForName.length < 2) return;
      const primaryRow = rowsForName.find((r: any) => r.dual_role_type === "primary");
      const secondaryRows = rowsForName.filter((r: any) => r.dual_role_type === "secondary");
      // Auto-detect best primary by title rank if none set
      let detectedPrimaryId = primaryRow?.id || null;
      if (!detectedPrimaryId) {
        const sorted = [...rowsForName].sort((a, b) => getTitleRank(a.title || "") - getTitleRank(b.title || ""));
        detectedPrimaryId = sorted[0]?.id || null;
      }
      groups.set(key, {
        name: rowsForName[0].name,
        rows: rowsForName,
        primaryId: primaryRow?.id || null,
        secondaryIds: secondaryRows.map((r: any) => r.id),
        needsDesignation: !primaryRow,
      });
    });
    return groups;
  }, [rows]);

  // Auto-persist primary/secondary designations when dual roles are detected
  const autoPersistedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const autoPersist = async () => {
      for (const [key, group] of dualRoleGroups) {
        if (!group.needsDesignation || autoPersistedRef.current.has(key)) continue;
        autoPersistedRef.current.add(key);
        const sorted = [...group.rows].sort((a, b) => getTitleRank(a.title || "") - getTitleRank(b.title || ""));
        const primaryRow = sorted[0];
        if (!primaryRow) continue;
        const primaryTitle = primaryRow.title || "Officer";
        await supabase.from("meeting_officers").update({ dual_role_type: "primary" } as any).eq("id", primaryRow.id);
        for (const other of sorted.slice(1)) {
          const noteText = getDefaultNoteText(
            "included_in_primary",
            other.name || "Officer",
            other.title || "Officer",
            other.salary,
            primaryTitle,
            other.title || "Officer",
          );
          await supabase.from("meeting_officers").update({
            dual_role_type: "secondary",
            compensation_status: "included_in_primary",
            compensation_note: noteText,
          } as any).eq("id", other.id);
        }
        queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      }
    };
    autoPersist();
  }, [dualRoleGroups, meetingId, queryClient]);

  const getDualRoleGroup = (row: any): DualRoleGroup | null => {
    const key = (row.name || "").trim().toLowerCase();
    return dualRoleGroups.get(key) || null;
  };

  const isDualRole = (row: any) => getDualRoleGroup(row) !== null;
  const isPrimary = (row: any) => {
    const g = getDualRoleGroup(row);
    if (!g) return false;
    return row.dual_role_type === "primary" || (g.needsDesignation && g.rows.sort((a: any, b: any) => getTitleRank(a.title || "") - getTitleRank(b.title || ""))[0]?.id === row.id);
  };
  const isSecondary = (row: any) => isDualRole(row) && !isPrimary(row);

  // Unresolved dual-role groups (no explicit primary set)
  const unresolvedDualRoles = useMemo(() => {
    const unresolved: DualRoleGroup[] = [];
    dualRoleGroups.forEach((g) => {
      if (g.needsDesignation) unresolved.push(g);
    });
    return unresolved;
  }, [dualRoleGroups]);

  // Validation
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
      if (form.name?.trim()) upsertAddressBook.mutate({ full_name: form.name.trim() });
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
      if (form.name?.trim()) upsertAddressBook.mutate({ full_name: form.name.trim() });
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

  const setDualRole = useMutation({
    mutationFn: async ({ rowId, roleType }: { rowId: string; roleType: DualRoleType }) => {
      const row = rows.find((r: any) => r.id === rowId);
      if (!row) return;
      const group = getDualRoleGroup(row);
      if (!group) return;

      // If setting as primary, set all others in group as secondary and auto-set their status
      if (roleType === "primary") {
        // Set this row as primary
        await supabase.from("meeting_officers").update({ dual_role_type: "primary" } as any).eq("id", rowId);
        // Set all other rows in group as secondary with "included_in_primary" status
        const primaryTitle = row.title || "Officer";
        for (const other of group.rows) {
          if (other.id === rowId) continue;
          const noteText = getDefaultNoteText(
            "included_in_primary",
            other.name || "Officer",
            other.title || "Officer",
            other.salary,
            primaryTitle,
            other.title || "Officer",
          );
          await supabase.from("meeting_officers").update({
            dual_role_type: "secondary",
            compensation_status: "included_in_primary",
            compensation_note: noteText,
          } as any).eq("id", other.id);
        }
      } else {
        await supabase.from("meeting_officers").update({ dual_role_type: roleType } as any).eq("id", rowId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_officers", meetingId] });
      toast.success("Dual role updated!");
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
      setCompNote(existingNote || "");
    } else {
      // Auto-suggest
      if (isSecondary(row)) {
        const group = getDualRoleGroup(row)!;
        const primaryRow = group.rows.find((r: any) => r.id === group.primaryId || isPrimary(r));
        setCompStatus("included_in_primary");
        setCompNote(getDefaultNoteText("included_in_primary", row.name || "Officer", row.title || "Officer", row.salary, primaryRow?.title || "Officer", row.title || "Officer"));
      } else {
        const noSalary = row.salary == null;
        const suggestedStatus: CompensationStatus = noSalary ? "non_compensable" : "reasonable";
        setCompStatus(suggestedStatus);
        setCompNote(getDefaultNoteText(suggestedStatus, row.name || "Officer", row.title || "Officer", row.salary));
      }
    }
    setCompDialogOpen(true);
  };

  const handleStatusChange = (newStatus: CompensationStatus) => {
    setCompStatus(newStatus);
    if (compOfficer) {
      if (newStatus === "included_in_primary") {
        const group = getDualRoleGroup(compOfficer);
        const primaryRow = group?.rows.find((r: any) => isPrimary(r));
        setCompNote(getDefaultNoteText(newStatus, compOfficer.name || "Officer", compOfficer.title || "Officer", compOfficer.salary, primaryRow?.title || "Officer", compOfficer.title || "Officer"));
      } else {
        setCompNote(getDefaultNoteText(newStatus, compOfficer.name || "Officer", compOfficer.title || "Officer", compOfficer.salary));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateRow.mutate();
    else addRow.mutate();
  };

  const isPending = addRow.isPending || updateRow.isPending;

  const getStatusOptions = (row: any): CompensationStatus[] => {
    const options: CompensationStatus[] = ["pending_approval", "reasonable", "below_market", "above_market"];
    if (isDualRole(row)) options.push("included_in_primary");
    options.push("non_compensable");
    return options;
  };

  const canSaveComp = () => {
    if (!compStatus) return false;
    if ((compStatus === "below_market" || compStatus === "above_market") && compNote.includes("[REASON]")) return false;
    return true;
  };

  return (
    <>
      {/* Validation warnings */}
      {rows.length > 0 && (missingStatus.length > 0 || hasReasonIssue || unresolvedDualRoles.length > 0) && (
        <Alert variant="destructive" className="border-amber-500/20 bg-amber-500/10 text-amber-500 [&>svg]:text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs space-y-1">
            {unresolvedDualRoles.length > 0 && (
              <p className="font-medium">
                {unresolvedDualRoles.map(g => g.name).join(", ")} hold{unresolvedDualRoles.length === 1 ? "s" : ""} multiple titles. Please designate a Primary Role before generating minutes.
              </p>
            )}
            {missingStatus.length > 0 && (
              <p>
                {missingStatus.length} officer{missingStatus.length > 1 ? "s" : ""} missing a Compensation Status.
              </p>
            )}
            {hasReasonIssue && (
              <p>Some officers have an unresolved [REASON] placeholder in their justification text.</p>
            )}
            <p className="font-medium">All statuses must be set before minutes can be generated.</p>
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
                  <Input
                    list="officer-title-options"
                    value={form.title ?? ""}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Select or type a title..."
                  />
                  <datalist id="officer-title-options">
                    {titleOptions.map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
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
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const status = row.compensation_status as CompensationStatus | null;
                    const cfg = status ? STATUS_CONFIG[status] : null;
                    const StatusIcon = cfg?.icon;
                    const dual = isDualRole(row);
                    const primary = isPrimary(row);
                    const secondary = isSecondary(row);
                    const group = getDualRoleGroup(row);

                    return (
                      <TableRow key={row.id} className={dual ? "bg-blue-500/5" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span>{row.title ?? "—"}</span>
                            {dual && (
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1.5 py-0 ${
                                  primary
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                <Users className="h-2.5 w-2.5 mr-0.5" />
                                {primary ? "Primary" : "Secondary"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{row.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.salary != null ? `$${Number(row.salary).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.bonus != null ? `$${Number(row.bonus).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
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
                            {dual && group?.needsDesignation && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDualRole.mutate({ rowId: row.id, roleType: "primary" })}
                                      className="h-8 w-8 text-blue-500 hover:text-blue-700"
                                    >
                                      <Users className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Set as Primary Role</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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
            {compOfficer && isDualRole(compOfficer) && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  <Users className="h-3.5 w-3.5" />
                  Dual Role Detected
                </div>
                <p>
                  {compOfficer.name} holds multiple officer titles.{" "}
                  {isPrimary(compOfficer) ? "This is the Primary Role (compensated)." : "This is a Secondary Role."}
                </p>
              </div>
            )}

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
                {compStatus === "pending_approval" && (
                  <p className="text-xs text-violet-600 italic">
                    Compensation to be established by Board or Member Resolution at a future meeting.
                  </p>
                )}
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
