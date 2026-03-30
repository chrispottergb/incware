import { useState, useCallback, useMemo } from "react";
import { useAutoSave } from "@/hooks/useAutoSave";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";
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
import { Plus, Trash2, Loader2, Pencil, FileText, Upload, Download, CheckCircle2, ArrowLeft, DollarSign } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { generatePromissoryNotePDF } from "@/lib/promissory-note-pdf";
import { useAuth } from "@/hooks/useAuth";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  meetingId: string;
  companyName?: string;
}

interface BalanceEntry {
  id: string;
  meeting_id: string;
  direction: string;
  party_name: string;
  relationship: string;
  beginning_balance: number;
  advances: number;
  repayments: number;
  ending_balance: number;
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

interface NoteForm {
  lenderName: string;
  borrowerName: string;
  loanAmount: string;
  interestRate: string;
  loanDuration: string;
  startDate: string;
  endDate: string;
  repaymentTerms: string;
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

  // Balance entries queries
  const { data: balanceEntries = [] } = useQuery({
    queryKey: ["meeting-balance-entries", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_balance_entries")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as BalanceEntry[];
    },
    enabled: !!meetingId,
  });

  const toEntries = useMemo(() => balanceEntries.filter(e => e.direction === "to"), [balanceEntries]);
  const fromEntries = useMemo(() => balanceEntries.filter(e => e.direction === "from"), [balanceEntries]);

  const addBalanceEntry = useCallback(async (direction: string) => {
    const { error } = await supabase.from("meeting_balance_entries").insert({
      meeting_id: meetingId,
      direction,
      party_name: "",
      relationship: "",
      beginning_balance: 0,
      advances: 0,
      repayments: 0,
      ending_balance: 0,
    } as any);
    if (error) { toast.error("Failed to add row"); return; }
    queryClient.invalidateQueries({ queryKey: ["meeting-balance-entries", meetingId] });
  }, [meetingId, queryClient]);

  const updateBalanceEntry = useCallback(async (id: string, field: string, value: string) => {
    const numFields = ["beginning_balance", "advances", "repayments", "ending_balance"];
    const updateVal = numFields.includes(field) ? (value ? parseFloat(value) : 0) : value;
    const { error } = await supabase.from("meeting_balance_entries").update({ [field]: updateVal } as any).eq("id", id);
    if (error) { toast.error("Failed to save"); return; }
    queryClient.invalidateQueries({ queryKey: ["meeting-balance-entries", meetingId] });
  }, [meetingId, queryClient]);

  const deleteBalanceEntry = useCallback(async (id: string) => {
    const { error } = await supabase.from("meeting_balance_entries").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    queryClient.invalidateQueries({ queryKey: ["meeting-balance-entries", meetingId] });
  }, [meetingId, queryClient]);
  // Promissory note wizard state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<NoteForm>({
    lenderName: "", borrowerName: "", loanAmount: "", interestRate: "",
    loanDuration: "", startDate: "", endDate: "", repaymentTerms: "",
  });
  const [noteStep, setNoteStep] = useState<"edit" | "preview">("edit");
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentPdfBytes, setCurrentPdfBytes] = useState<Uint8Array | null>(null);
  const [editingNoteRowId, setEditingNoteRowId] = useState<string | null>(null);

  // Auto-save promissory note form fields back to meeting_loans row
  const { status: noteSaveStatus, lastSavedAt: noteLastSaved, handleBlur: noteHandleBlur, triggerSave: noteTriggerSave } = useAutoSave({
    data: noteForm,
    onSave: async (d) => {
      if (!editingNoteRowId) return;
      const { error } = await supabase
        .from("meeting_loans" as any)
        .update({
          lender_name: d.lenderName || null,
          borrower_name: d.borrowerName || null,
          loan_amount: d.loanAmount ? parseFloat(d.loanAmount) : null,
          loan_rate: d.interestRate ? parseFloat(d.interestRate) : null,
          loan_duration: d.loanDuration || null,
          start_date: d.startDate || null,
          end_date: d.endDate || null,
          repayment_terms: d.repaymentTerms || null,
        } as any)
        .eq("id", editingNoteRowId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });
    },
    enabled: noteDialogOpen && !!editingNoteRowId,
    debounceMs: 1500,
  });

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

  const handleSaveStandaloneBalance = async () => {
    balanceTriggerSave();
  };

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

  // --- Promissory Note Wizard ---
  const openNoteWizard = (row: any) => {
    setEditingNoteRowId(row.id);
    setNoteForm({
      lenderName: row.lender_name || "",
      borrowerName: row.borrower_name || "",
      loanAmount: row.loan_amount?.toString() || "",
      interestRate: row.loan_rate?.toString() || "",
      loanDuration: row.loan_duration || "",
      startDate: row.start_date || row.loan_date || "",
      endDate: row.end_date || "",
      repaymentTerms: row.repayment_terms || "",
    });
    setNoteStep("edit");
    setPreviewPages([]);
    setCurrentPdfBytes(null);
    setNoteDialogOpen(true);
  };

  const renderPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const doc = generatePromissoryNotePDF({
        lenderName: noteForm.lenderName,
        borrowerName: noteForm.borrowerName,
        loanAmount: noteForm.loanAmount ? parseFloat(noteForm.loanAmount) : null,
        interestRate: noteForm.interestRate ? parseFloat(noteForm.interestRate) : null,
        loanDuration: noteForm.loanDuration,
        startDate: noteForm.startDate,
        endDate: noteForm.endDate,
        repaymentTerms: noteForm.repaymentTerms,
        companyName: companyName || "",
      });
      const bytes = doc.output("arraybuffer");
      setCurrentPdfBytes(new Uint8Array(bytes));

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL("image/png"));
      }
      setPreviewPages(pages);
      setNoteStep("preview");
    } catch (err: any) {
      toast.error("Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [noteForm, companyName]);

  const [savingPdf, setSavingPdf] = useState(false);

  const handleSavePdf = async () => {
    if (!currentPdfBytes || !user?.id || !editingNoteRowId) return;
    setSavingPdf(true);
    try {
      const filename = `promissory-note-${noteForm.borrowerName || "loan"}.pdf`.replace(/\s+/g, "-").toLowerCase();
      const blob = new Blob([currentPdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const filePath = `${user.id}/promissory-notes/${editingNoteRowId}/${Date.now()}-${filename}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("generated-documents")
        .upload(filePath, blob, { upsert: true, contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      // Get persistent public URL
      const { data: publicUrlData } = supabase.storage
        .from("generated-documents")
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData?.publicUrl;
      if (!publicUrl) throw new Error("Failed to generate public URL.");

      // Update DB record with the public URL
      const { error: updateError } = await supabase
        .from("meeting_loans" as any)
        .update({
          promissory_note_file_url: publicUrl,
          promissory_note_file_name: filename,
          promissory_note_required: true,
        } as any)
        .eq("id", editingNoteRowId);
      if (updateError) throw updateError;

      // Invalidate cache so "On File" badge appears
      queryClient.invalidateQueries({ queryKey: ["meeting_loans", meetingId] });

      // Also trigger local download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      setNoteDialogOpen(false);
      toast.success("Promissory note saved and uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save promissory note");
    } finally {
      setSavingPdf(false);
    }
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
    // If it's a full public URL, open directly
    if (row.promissory_note_file_url.startsWith("http://") || row.promissory_note_file_url.startsWith("https://")) {
      window.open(row.promissory_note_file_url, "_blank");
      return;
    }
    // Otherwise download from storage using relative path
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
  const updateNoteField = (key: keyof NoteForm, value: string) =>
    setNoteForm((prev) => ({ ...prev, [key]: value }));

  const fmt = (v: any) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—";

  const directionLabel = (d: string) => {
    if (d === "to_shareholder") return "To Shareholder/Member";
    if (d === "from_shareholder") return "From Shareholder/Member";
    return "From Company";
  };

  return (
    <>
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Loans & Notes Payable</CardTitle>
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
                  <TableHead className="w-[300px]" />
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
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Create promissory note — labeled button */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openNoteWizard(row)}
                          className="h-7 text-xs gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Create Promissory Note
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
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Upload Promissory Note"
                          disabled={uploading}
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </Button>
                        {/* Download uploaded note */}
                        {row.promissory_note_file_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadNote(row)}
                            className="h-7 w-7 text-green-600/60 hover:text-green-700"
                            title={`Download: ${row.promissory_note_file_name || "Promissory Note"}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteRow.mutate(row.id)} className="h-7 w-7 text-destructive/60 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Promissory Note Wizard Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={(open) => { if (!open) { setNoteDialogOpen(false); setNoteStep("edit"); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {noteStep === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Create Promissory Note
                </DialogTitle>
                <DialogDescription>Review and edit the details below, then click Preview to see the formatted document.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-2" onBlur={noteHandleBlur}>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Lender Name</Label>
                  <Input value={noteForm.lenderName} onChange={(e) => updateNoteField("lenderName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Borrower Name</Label>
                  <Input value={noteForm.borrowerName} onChange={(e) => updateNoteField("borrowerName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Principal Amount ($)</Label>
                  <Input type="number" step="0.01" value={noteForm.loanAmount} onChange={(e) => updateNoteField("loanAmount", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Interest Rate (%)</Label>
                  <Input type="number" step="0.01" value={noteForm.interestRate} onChange={(e) => updateNoteField("interestRate", e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Loan Duration</Label>
                  <Input value={noteForm.loanDuration} onChange={(e) => updateNoteField("loanDuration", e.target.value)} placeholder="e.g., 5 years" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <DatePickerField value={noteForm.startDate} onChange={(v) => { updateNoteField("startDate", v); noteTriggerSave(); }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <DatePickerField value={noteForm.endDate} onChange={(v) => { updateNoteField("endDate", v); noteTriggerSave(); }} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Repayment Terms</Label>
                  <Textarea value={noteForm.repaymentTerms} onChange={(e) => updateNoteField("repaymentTerms", e.target.value)} rows={3} placeholder="Monthly payments, balloon payment, etc." />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <SaveStatusIndicator status={noteSaveStatus} lastSavedAt={noteLastSaved} />
                <Button onClick={renderPreview} disabled={previewLoading}>
                  {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Preview
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Promissory Note Preview</DialogTitle>
                <DialogDescription>Review the document below. You can go back to edit or save as PDF.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                {previewPages.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Page ${i + 1}`}
                    className="w-full rounded border border-border shadow-sm"
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <Button variant="outline" onClick={() => setNoteStep("edit")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back / Edit
                </Button>
                <Button onClick={handleSavePdf} disabled={savingPdf}>
                  {savingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {savingPdf ? "Saving…" : "Save as PDF"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>

      {/* Annual Balance Reporting — two stacked tables */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Annual Balance Reporting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Loans TO table */}
          <BalanceTable
            title="Loans TO Shareholders / Members / Related Parties"
            entries={toEntries}
            onAdd={() => addBalanceEntry("to")}
            onUpdate={updateBalanceEntry}
            onDelete={deleteBalanceEntry}
          />
          {/* Loans FROM table */}
          <BalanceTable
            title="Loans FROM Shareholders / Members / Related Parties"
            entries={fromEntries}
            onAdd={() => addBalanceEntry("from")}
            onUpdate={updateBalanceEntry}
            onDelete={deleteBalanceEntry}
          />
        </CardContent>
      </Card>
    </>
  );
}

/* ---- Balance Table sub-component ---- */
function BalanceTable({ title, entries, onAdd, onUpdate, onDelete }: {
  title: string;
  entries: BalanceEntry[];
  onAdd: () => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name / Party</TableHead>
              <TableHead className="text-xs">Relationship</TableHead>
              <TableHead className="text-xs text-right">Beg. Balance</TableHead>
              <TableHead className="text-xs text-right">Advances</TableHead>
              <TableHead className="text-xs text-right">Repayments</TableHead>
              <TableHead className="text-xs text-right">End. Balance</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-4">
                  No entries yet
                </TableCell>
              </TableRow>
            )}
            {entries.map((entry) => (
              <BalanceRow key={entry.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Row
      </Button>
    </div>
  );
}

/* ---- Individual row — saves on blur ---- */
function BalanceRow({ entry, onUpdate, onDelete }: {
  entry: BalanceEntry;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState({
    party_name: entry.party_name || "",
    relationship: entry.relationship || "",
    beginning_balance: entry.beginning_balance?.toString() || "0",
    advances: entry.advances?.toString() || "0",
    repayments: entry.repayments?.toString() || "0",
    ending_balance: entry.ending_balance?.toString() || "0",
  });

  const handleBlur = (field: string) => {
    const val = (local as any)[field];
    const orig = field === "party_name" || field === "relationship"
      ? ((entry as any)[field] || "")
      : ((entry as any)[field]?.toString() || "0");
    if (val !== orig) {
      onUpdate(entry.id, field, val);
    }
  };

  return (
    <TableRow>
      <TableCell className="p-1">
        <Input className="h-8 text-sm" value={local.party_name} onChange={(e) => setLocal(p => ({ ...p, party_name: e.target.value }))} onBlur={() => handleBlur("party_name")} placeholder="Name" />
      </TableCell>
      <TableCell className="p-1">
        <Input className="h-8 text-sm" value={local.relationship} onChange={(e) => setLocal(p => ({ ...p, relationship: e.target.value }))} onBlur={() => handleBlur("relationship")} placeholder="Relationship" />
      </TableCell>
      <TableCell className="p-1">
        <Input className="h-8 text-sm text-right" type="number" step="0.01" value={local.beginning_balance} onChange={(e) => setLocal(p => ({ ...p, beginning_balance: e.target.value }))} onBlur={() => handleBlur("beginning_balance")} />
      </TableCell>
      <TableCell className="p-1">
        <Input className="h-8 text-sm text-right" type="number" step="0.01" value={local.advances} onChange={(e) => setLocal(p => ({ ...p, advances: e.target.value }))} onBlur={() => handleBlur("advances")} />
      </TableCell>
      <TableCell className="p-1">
        <Input className="h-8 text-sm text-right" type="number" step="0.01" value={local.repayments} onChange={(e) => setLocal(p => ({ ...p, repayments: e.target.value }))} onBlur={() => handleBlur("repayments")} />
      </TableCell>
      <TableCell className="p-1">
        <Input className="h-8 text-sm text-right" type="number" step="0.01" value={local.ending_balance} onChange={(e) => setLocal(p => ({ ...p, ending_balance: e.target.value }))} onBlur={() => handleBlur("ending_balance")} />
      </TableCell>
      <TableCell className="p-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(entry.id)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
