import { useState, useRef } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DialogDescription,
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
import { Plus, Trash2, Loader2, Pencil, FileText, Upload, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { generatePromissoryNotePDF } from "@/lib/promissory-note-pdf";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  meetingId: string;
  companyName?: string;
}

interface LoanForm {
  loan_type: string;
  loan_direction: string;
  loan_rate: string;
  loan_amount: string;
  loan_date: string;
  lender_name: string;
  borrower_name: string;
  loan_duration: string;
  start_date: string;
  end_date: string;
  repayment_terms: string;
  notes: string;
  promissory_note_required: boolean;
}

const emptyForm: LoanForm = {
  loan_type: "",
  loan_direction: "from_company",
  loan_rate: "",
  loan_amount: "",
  loan_date: "",
  lender_name: "",
  borrower_name: "",
  loan_duration: "",
  start_date: "",
  end_date: "",
  repayment_terms: "",
  notes: "",
  promissory_note_required: false,
};

export default function MeetingLoans({ meetingId, companyName }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LoanForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_loans", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_loans" as any)
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
        loan_type: form.loan_type || null,
        loan_direction: form.loan_direction || "from_company",
        loan_rate: form.loan_rate ? parseFloat(form.loan_rate) : null,
        loan_amount: form.loan_amount ? parseFloat(form.loan_amount) : null,
        loan_date: form.loan_date || null,
        lender_name: form.lender_name || null,
        borrower_name: form.borrower_name || null,
        loan_duration: form.loan_duration || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        repayment_terms: form.repayment_terms || null,
        notes: form.notes || null,
        promissory_note_required: form.promissory_note_required,
      };
      const { error } = await supabase.from("meeting_loans" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });
      closeDialog();
      toast.success("Loan added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload: any = {
        loan_type: form.loan_type || null,
        loan_direction: form.loan_direction || "from_company",
        loan_rate: form.loan_rate ? parseFloat(form.loan_rate) : null,
        loan_amount: form.loan_amount ? parseFloat(form.loan_amount) : null,
        loan_date: form.loan_date || null,
        lender_name: form.lender_name || null,
        borrower_name: form.borrower_name || null,
        loan_duration: form.loan_duration || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        repayment_terms: form.repayment_terms || null,
        notes: form.notes || null,
        promissory_note_required: form.promissory_note_required,
      };
      const { error } = await supabase
        .from("meeting_loans" as any)
        .update(payload as any)
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });
      closeDialog();
      toast.success("Loan updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_loans" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });
      toast.success("Loan removed.");
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
      loan_type: row.loan_type || "",
      loan_direction: row.loan_direction || "from_company",
      loan_rate: row.loan_rate?.toString() || "",
      loan_amount: row.loan_amount?.toString() || "",
      loan_date: row.loan_date || "",
      lender_name: row.lender_name || "",
      borrower_name: row.borrower_name || "",
      loan_duration: row.loan_duration || "",
      start_date: row.start_date || "",
      end_date: row.end_date || "",
      repayment_terms: row.repayment_terms || "",
      notes: row.notes || "",
      promissory_note_required: row.promissory_note_required || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) updateRow.mutate();
    else addRow.mutate();
  };

  const handlePromissoryNote = (row: any) => {
    const doc = generatePromissoryNotePDF({
      lenderName: row.lender_name || "",
      borrowerName: row.borrower_name || "",
      loanAmount: row.loan_amount,
      interestRate: row.loan_rate,
      loanDuration: row.loan_duration || "",
      startDate: row.start_date || row.loan_date || "",
      endDate: row.end_date || "",
      repaymentTerms: row.repayment_terms || "",
      companyName: companyName || "",
    });
    doc.save(`promissory-note-${row.lender_name || "loan"}.pdf`.replace(/\s+/g, "-").toLowerCase());
  };

  const handleUploadNote = async (rowId: string, file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const filePath = `${user.id}/promissory-notes/${rowId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("generated-documents")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("meeting_loans" as any)
        .update({
          promissory_note_file_url: filePath,
          promissory_note_file_name: file.name,
          promissory_note_required: true,
        } as any)
        .eq("id", rowId);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });
      toast.success("Promissory note uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadNote = async (row: any) => {
    if (!row.promissory_note_file_url) return;
    const { data, error } = await supabase.storage
      .from("generated-documents")
      .download(row.promissory_note_file_url);
    if (error) {
      toast.error("Failed to download file");
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = row.promissory_note_file_name || "promissory-note.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPending = addRow.isPending || updateRow.isPending;
  const updateField = (key: keyof LoanForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const fmt = (v: any) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";

  const directionLabel = (d: string) => {
    if (d === "to_shareholder") return "To Shareholder/Member";
    if (d === "from_shareholder") return "From Shareholder/Member";
    return "From Company";
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Loans to/from Shareholders, Members & Related Parties</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Loan" : "Add Loan"}</DialogTitle>
              <DialogDescription>Enter the loan details for shareholders, members, or related parties.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Direction</Label>
                  <Select value={form.loan_direction} onValueChange={(v) => updateField("loan_direction", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to_shareholder">Loan TO Shareholder/Member</SelectItem>
                      <SelectItem value="from_shareholder">Loan FROM Shareholder/Member</SelectItem>
                      <SelectItem value="from_company">Company Loan (from Bank/Lender)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Lender Name</Label>
                  <Input value={form.lender_name} onChange={(e) => updateField("lender_name", e.target.value)} placeholder="Who is lending?" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Borrower Name</Label>
                  <Input value={form.borrower_name} onChange={(e) => updateField("borrower_name", e.target.value)} placeholder="Who is borrowing?" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Loan Type</Label>
                  <Input value={form.loan_type} onChange={(e) => updateField("loan_type", e.target.value)} placeholder="e.g., Line of Credit, Term Loan, Promissory Note" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Principal Amount ($)</Label>
                  <Input type="number" step="0.01" value={form.loan_amount} onChange={(e) => updateField("loan_amount", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Interest Rate (%)</Label>
                  <Input type="number" step="0.01" value={form.loan_rate} onChange={(e) => updateField("loan_rate", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Loan Duration</Label>
                  <Input value={form.loan_duration} onChange={(e) => updateField("loan_duration", e.target.value)} placeholder="e.g., 5 years, 60 months" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Loan Date</Label>
                  <DatePickerField value={form.loan_date || ""} onChange={(v) => updateField("loan_date", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <DatePickerField value={form.start_date || ""} onChange={(v) => updateField("start_date", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <DatePickerField value={form.end_date || ""} onChange={(v) => updateField("end_date", v)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Repayment Terms</Label>
                  <Textarea value={form.repayment_terms} onChange={(e) => updateField("repayment_terms", e.target.value)} rows={2} placeholder="Monthly payments of $X, balloon payment, etc." />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} rows={2} placeholder="Additional details…" />
                </div>
              </div>

              {/* Promissory Note Section */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.promissory_note_required}
                    onCheckedChange={(checked) => updateField("promissory_note_required", checked)}
                  />
                  <Label className="text-sm font-medium">Promissory Note Required</Label>
                </div>
                {form.promissory_note_required && (
                  <p className="text-xs text-muted-foreground">
                    After saving, use the table actions to generate a pre-filled promissory note or upload an existing document.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isPending || !form.loan_type}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Loan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No loans recorded</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Direction</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Note</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{directionLabel(row.loan_direction || "from_company")}</TableCell>
                    <TableCell className="font-medium text-sm">{row.loan_type || "—"}</TableCell>
                    <TableCell className="text-sm">{row.lender_name || "—"}</TableCell>
                    <TableCell className="text-sm">{row.borrower_name || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{row.loan_rate != null ? `${Number(row.loan_rate).toFixed(2)}%` : "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{fmt(row.loan_amount)}</TableCell>
                    <TableCell className="text-sm">{row.loan_date ? new Date(row.loan_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-center">
                      {row.promissory_note_file_url ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> On File
                        </span>
                      ) : row.promissory_note_required ? (
                        <span className="text-xs text-amber-600 font-medium">Required</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Generate promissory note */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePromissoryNote(row)}
                          className="h-8 w-8 text-primary/60 hover:text-primary"
                          title="Generate Promissory Note"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        {/* Upload promissory note */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleUploadNote(row.id, file);
                            };
                            input.click();
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Upload Promissory Note"
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        {/* Download uploaded note */}
                        {row.promissory_note_file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadNote(row)}
                            className="h-8 w-8 text-green-600/60 hover:text-green-700"
                            title={`Download: ${row.promissory_note_file_name || "Promissory Note"}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
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
