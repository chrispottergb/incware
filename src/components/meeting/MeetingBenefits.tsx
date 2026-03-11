import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
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
import { Plus, Trash2, Loader2, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

const BENEFIT_TYPE_OPTIONS = [
  // Health & Wellness
  "Health Insurance",
  "Dental Insurance",
  "Vision Insurance",
  "Life Insurance",
  "Disability Insurance (Short Term)",
  "Disability Insurance (Long Term)",
  "HSA / FSA Contributions",
  "Mental Health Benefits",
  // Retirement & Financial
  "401(k) / Retirement Plan",
  "Profit Sharing",
  "SEP IRA",
  "SIMPLE IRA",
  "Stock Options / Equity",
  "Bonuses (Performance, Signing, Annual)",
  "Expense Reimbursement",
  // Time Off
  "Paid Time Off (PTO)",
  "Sick Leave",
  "Parental / Family Leave",
  "Sabbatical",
  // Work Perks
  "Vehicle / Car Allowance",
  "Cell Phone / Technology Allowance",
  "Remote Work / Work From Home",
  "Mileage Reimbursement",
  "Meal / Per Diem Allowance",
  // Education & Development
  "Tuition Reimbursement",
  "Professional Development",
  "Certifications / Training",
  // Other
  "Child Care Assistance",
  "Gym / Wellness Stipend",
  "Employee Assistance Program (EAP)",
  "Other",
];

const RETIREMENT_TYPES = [
  "401(k) / Retirement Plan",
  "SEP IRA",
  "SIMPLE IRA",
  "Profit Sharing",
  "Stock Options / Equity",
];

const isRetirementType = (type: string) => {
  if (!type) return false;
  const lower = type.toLowerCase();
  return RETIREMENT_TYPES.some(rt => rt.toLowerCase() === lower) ||
    /\b(ira|401|403|pension|retirement|roth)\b/i.test(lower);
};

interface Props {
  meetingId: string;
}

interface BenefitForm {
  benefit_type: string;
  provider: string;
  agent_administrator: string;
  insurance_agency: string;
  transaction_type: string;
  plan_year: string;
  new_plan_effective_date: string;
  retirement_contribution: string;
  eligibility_comments: string;
  benefit_description: string;
}

const emptyForm: BenefitForm = {
  benefit_type: "",
  provider: "",
  agent_administrator: "",
  insurance_agency: "",
  transaction_type: "",
  plan_year: "",
  new_plan_effective_date: "",
  retirement_contribution: "",
  eligibility_comments: "",
  benefit_description: "",
};

export default function MeetingBenefits({ meetingId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BenefitForm>(emptyForm);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_benefits", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_benefits" as any)
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
        benefit_description: form.benefit_description || form.benefit_type || "—",
        benefit_type: form.benefit_type || null,
        provider: form.provider || null,
        agent_administrator: form.agent_administrator || null,
        insurance_agency: form.insurance_agency || null,
        transaction_type: form.transaction_type || null,
        plan_year: form.plan_year ? parseInt(form.plan_year) : null,
        new_plan_effective_date: form.new_plan_effective_date || null,
        retirement_contribution: form.retirement_contribution ? parseFloat(form.retirement_contribution) : null,
        eligibility_comments: form.eligibility_comments || null,
      };
      const { error } = await supabase.from("meeting_benefits" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_benefits", meetingId] });
      closeDialog();
      toast.success("Benefit added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const payload: any = {
        benefit_description: form.benefit_description || form.benefit_type || "—",
        benefit_type: form.benefit_type || null,
        provider: form.provider || null,
        agent_administrator: form.agent_administrator || null,
        insurance_agency: form.insurance_agency || null,
        transaction_type: form.transaction_type || null,
        plan_year: form.plan_year ? parseInt(form.plan_year) : null,
        new_plan_effective_date: form.new_plan_effective_date || null,
        retirement_contribution: form.retirement_contribution ? parseFloat(form.retirement_contribution) : null,
        eligibility_comments: form.eligibility_comments || null,
      };
      const { error } = await supabase
        .from("meeting_benefits" as any)
        .update(payload as any)
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_benefits", meetingId] });
      closeDialog();
      toast.success("Benefit updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_benefits" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_benefits", meetingId] });
      toast.success("Benefit removed.");
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
      benefit_type: row.benefit_type || "",
      provider: row.provider || "",
      agent_administrator: row.agent_administrator || "",
      insurance_agency: row.insurance_agency || "",
      transaction_type: row.transaction_type || "",
      plan_year: row.plan_year?.toString() || "",
      new_plan_effective_date: row.new_plan_effective_date || "",
      retirement_contribution: row.retirement_contribution?.toString() || "",
      eligibility_comments: row.eligibility_comments || "",
      benefit_description: row.benefit_description || "",
    });
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

  const updateField = (key: keyof BenefitForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Benefits</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Benefit" : "Add Benefit"}</DialogTitle>
              <DialogDescription>
                Enter the benefit plan details.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Benefit Type</Label>
                  <Select value={form.benefit_type} onValueChange={(v) => updateField("benefit_type", v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {BENEFIT_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Provider</Label>
                  <Input value={form.provider} onChange={(e) => updateField("provider", e.target.value)} placeholder="Plan provider" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Agent / Administrator</Label>
                  <Input value={form.agent_administrator} onChange={(e) => updateField("agent_administrator", e.target.value)} placeholder="Agent name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Insurance Agency</Label>
                  <Input value={form.insurance_agency} onChange={(e) => updateField("insurance_agency", e.target.value)} placeholder="Agency name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Transaction Type</Label>
                  <Input value={form.transaction_type} onChange={(e) => updateField("transaction_type", e.target.value)} placeholder="e.g., New, Renewal" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Plan Year</Label>
                  <Input type="number" value={form.plan_year} onChange={(e) => updateField("plan_year", e.target.value)} placeholder="e.g., 2024" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">New Plan Effective Date</Label>
                  <DatePickerField value={form.new_plan_effective_date || ""} onChange={(v) => updateField("new_plan_effective_date", v)} />
                </div>
                {isRetirementType(form.benefit_type) && (
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Contribution Amount</Label>
                    <Input type="number" step="0.01" value={form.retirement_contribution} onChange={(e) => updateField("retirement_contribution", e.target.value)} placeholder="$0.00" />
                  </div>
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Eligibility / Comments</Label>
                  <Textarea value={form.eligibility_comments} onChange={(e) => updateField("eligibility_comments", e.target.value)} rows={3} placeholder="Eligibility requirements, waiting periods, enrollment windows…" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !form.benefit_type}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Benefit"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No benefits recorded</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap">Benefit Type</TableHead>
                  <TableHead className="whitespace-nowrap">Provider</TableHead>
                  <TableHead className="whitespace-nowrap">Agent / Admin</TableHead>
                  <TableHead className="whitespace-nowrap">Insurance Agency</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => (
                  <>
                    <TableRow key={row.id} className="border-b-0">
                      <TableCell className="font-medium text-sm whitespace-nowrap pb-1">{row.benefit_type || row.benefit_description || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap pb-1">{row.provider || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap pb-1">{row.agent_administrator || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap pb-1">{row.insurance_agency || "—"}</TableCell>
                      <TableCell className="pb-1" rowSpan={2}>
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
                    <TableRow key={`${row.id}-row2`}>
                      <TableCell className="pt-0 text-sm text-muted-foreground" colSpan={4}>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                          <span><span className="font-medium">Plan Year:</span> {row.plan_year || "—"}</span>
                          {isRetirementType(row.benefit_type) && (
                            <span><span className="font-medium">Contribution:</span> {row.retirement_contribution != null ? `$${Number(row.retirement_contribution).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}</span>
                          )}
                          {row.new_plan_effective_date && (
                            <span><span className="font-medium">Effective:</span> {new Date(row.new_plan_effective_date + "T00:00:00").toLocaleDateString()}</span>
                          )}
                          {row.transaction_type && (
                            <span><span className="font-medium">Transaction:</span> {row.transaction_type}</span>
                          )}
                          {row.eligibility_comments && (
                            <span><span className="font-medium">Eligibility:</span> {row.eligibility_comments}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
