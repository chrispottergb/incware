import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, Trash2, Loader2, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

const AGREEMENT_TYPE_OPTIONS = [
  "Operating Agreement",
  "Buy-Sell Agreement",
  "Employment Agreement",
  "Non-Compete Agreement",
  "Independent Contractor Agreement",
  "NDA/Confidentiality Agreement",
  "Asset Purchase Agreement",
  "Stock/Membership Purchase Agreement",
  "Commercial Lease",
  "Equipment Lease",
  "Loan/Promissory Note",
  "Personal Guarantee",
  "Line of Credit Agreement",
  "Service Agreement",
  "Vendor/Supplier Agreement",
  "License Agreement",
  "Franchise Agreement",
  "IP Assignment",
  "Other",
];

const STATUS_OPTIONS = ["Active", "Expired", "Terminated", "Pending"];

interface Props {
  meetingId: string;
  meetingDate?: string;
}

interface AgreementForm {
  agreement_type: string;
  agreement_date: string;
  agreement_with: string;
  agreement_purpose: string;
  amount: string;
  expiration_date: string;
  status: string;
  notes: string;
}

const emptyForm: AgreementForm = {
  agreement_type: "",
  agreement_date: "",
  agreement_with: "",
  agreement_purpose: "",
  amount: "",
  expiration_date: "",
  status: "Active",
  notes: "",
};

function isExpiringSoon(expirationDate: string | null, meetingDate?: string): boolean {
  if (!expirationDate) return false;
  const expDate = new Date(expirationDate + "T00:00:00");
  const refDate = meetingDate ? new Date(meetingDate + "T00:00:00") : new Date();
  const diffMs = expDate.getTime() - refDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 90;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Active": return "default";
    case "Pending": return "outline";
    case "Expired": return "secondary";
    case "Terminated": return "destructive";
    default: return "outline";
  }
}

export default function MeetingAgreements({ meetingId, meetingDate }: Props) {
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
        amount: form.amount ? parseFloat(form.amount) : null,
        expiration_date: form.expiration_date || null,
        status: form.status || "Active",
        notes: form.notes || null,
        is_carried_forward: false,
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
        amount: form.amount ? parseFloat(form.amount) : null,
        expiration_date: form.expiration_date || null,
        status: form.status || "Active",
        notes: form.notes || null,
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

  const [deleteId, setDeleteId] = useState<string | null>(null);
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
      amount: row.amount != null ? String(row.amount) : "",
      expiration_date: row.expiration_date || "",
      status: row.status || "Active",
      notes: row.notes || "",
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

  const formatCurrency = (val: number | null) => {
    if (val == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);
  };

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
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                    <SelectContent className="bg-popover z-50 max-h-60">
                      {AGREEMENT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Date Executed</Label>
                    <DatePickerField value={form.agreement_date || ""} onChange={(v) => updateField("agreement_date", v)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                    <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select status…" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Counterparty Name</Label>
                  <Input value={form.agreement_with} onChange={(e) => updateField("agreement_with", e.target.value)} placeholder="Name of the other party" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Amount (if applicable)</Label>
                    <Input type="number" step="0.01" value={form.amount} onChange={(e) => updateField("amount", e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Expiration / Renewal Date</Label>
                    <DatePickerField value={form.expiration_date || ""} onChange={(v) => updateField("expiration_date", v)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Purpose / Key Terms</Label>
                  <Textarea value={form.agreement_purpose} onChange={(e) => updateField("agreement_purpose", e.target.value)} rows={2} placeholder="Describe the agreement purpose…" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Notes / Description</Label>
                  <Textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} placeholder="Additional notes or context…" />
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Type</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row: any) => {
                    const expiring = isExpiringSoon(row.expiration_date, meetingDate);
                    return (
                      <TableRow key={row.id} className={expiring ? "bg-yellow-500/10" : ""}>
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            {row.agreement_type}
                            {row.is_carried_forward && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0">Carried</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{row.agreement_with || "—"}</TableCell>
                        <TableCell className="text-sm">{row.agreement_date ? new Date(row.agreement_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(row.amount)}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            {row.expiration_date ? new Date(row.expiration_date + "T00:00:00").toLocaleDateString() : "—"}
                            {expiring && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>Expires within 90 days of meeting date</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(row.status || "Active")} className="text-[10px]">
                            {row.status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)} className="h-8 w-8 text-destructive/60 hover:text-destructive">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
