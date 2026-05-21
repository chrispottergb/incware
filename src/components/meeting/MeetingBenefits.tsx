import { useState, useEffect } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil, Info, X } from "lucide-react";
import { toast } from "sonner";

type BenefitItem = { label: string; tooltip: string };

const BENEFIT_CATALOG: Record<string, BenefitItem[]> = {
  "Health Coverage": [
    { label: "Health Insurance (Medical)", tooltip: "Core medical coverage for doctor visits, hospital care, and treatment." },
    { label: "Dental Insurance", tooltip: "Covers routine dental care like cleanings and fillings." },
    { label: "Vision Insurance", tooltip: "Covers eye exams, glasses, and contacts." },
    { label: "Prescription Drug Coverage", tooltip: "Helps pay for medications." },
    { label: "Other", tooltip: "Any additional health coverage." },
  ],
  "Life & Disability": [
    { label: "Life Insurance", tooltip: "Provides financial support to beneficiaries upon death." },
    { label: "Key Employee Life Insurance", tooltip: "Protects the business if a key employee passes away." },
    { label: "Short-Term Disability", tooltip: "Temporary income replacement if unable to work." },
    { label: "Long-Term Disability", tooltip: "Extended income replacement for serious disability." },
    { label: "Accidental Death & Injury Coverage", tooltip: "Benefits for accidental death or injury." },
    { label: "Other", tooltip: "Additional protection benefits." },
  ],
  "Retirement": [
    { label: "401(k) Plan", tooltip: "Employer-sponsored retirement savings." },
    { label: "Roth 401(k)", tooltip: "After-tax retirement savings with tax-free withdrawals." },
    { label: "SEP IRA", tooltip: "Retirement plan for small business owners." },
    { label: "SIMPLE IRA", tooltip: "Simplified retirement plan for small employers." },
    { label: "Pension Plan", tooltip: "Employer-funded retirement income." },
    { label: "Profit Sharing Plan", tooltip: "Employer contributions based on profits." },
    { label: "Other", tooltip: "Additional retirement plans." },
  ],
  "Time Off & Leave": [
    { label: "Paid Time Off", tooltip: "Vacation or personal leave." },
    { label: "Paid Holidays", tooltip: "Company-paid holidays." },
    { label: "Sick Leave", tooltip: "Paid time off when ill." },
    { label: "Family or Medical Leave", tooltip: "Extended leave for family or medical reasons." },
    { label: "Other", tooltip: "Additional leave benefits." },
  ],
  "Additional Benefits": [
    { label: "Health Savings Account (HSA)", tooltip: "Tax-advantaged medical savings." },
    { label: "Flexible Spending Account (FSA)", tooltip: "Pre-tax healthcare or dependent care funds." },
    { label: "Dependent Care Account", tooltip: "Childcare or elder care savings." },
    { label: "Accident Insurance", tooltip: "Coverage for accidental injuries." },
    { label: "Critical Illness Coverage", tooltip: "Lump sum payment for serious illness." },
    { label: "Hospital Coverage", tooltip: "Pays benefits for hospital stays." },
    { label: "Long-Term Care Insurance", tooltip: "Covers extended care services." },
    { label: "Employee Assistance Program", tooltip: "Confidential counseling and support." },
    { label: "Wellness Programs", tooltip: "Health and wellness initiatives." },
    { label: "Tuition Assistance", tooltip: "Education support." },
    { label: "Childcare Assistance", tooltip: "Help with childcare costs." },
    { label: "Commuting Benefits", tooltip: "Transportation support." },
    { label: "Other", tooltip: "Additional benefits." },
  ],
  "Owner/Executive Only": [
    { label: "Deferred Compensation Plan", tooltip: "Income paid later for tax planning." },
    { label: "Executive Bonus Plan", tooltip: "Employer-funded executive benefit." },
    { label: "Buy-Sell Agreement Funding", tooltip: "Life insurance for ownership transfer." },
    { label: "Other", tooltip: "Additional executive arrangements." },
  ],
};

const CATEGORIES = Object.keys(BENEFIT_CATALOG);

const isRetirementType = (type: string) => {
  if (!type) return false;
  return /\b(ira|401|403|pension|retirement|roth|profit sharing)\b/i.test(type);
};

// Find category for a stored benefit_type label (used to rehydrate edit dialog)
function findCategoryForLabel(label: string): { category: string; itemLabel: string } | null {
  if (!label) return null;
  for (const [cat, items] of Object.entries(BENEFIT_CATALOG)) {
    const match = items.find((i) => i.label.toLowerCase() === label.toLowerCase());
    if (match) return { category: cat, itemLabel: match.label };
  }
  // Match "Category — Other: foo" pattern
  const otherMatch = label.match(/^(.+?)\s+—\s+Other(?::\s*(.+))?$/);
  if (otherMatch && BENEFIT_CATALOG[otherMatch[1]]) {
    return { category: otherMatch[1], itemLabel: "Other" };
  }
  return null;
}

interface Props {
  meetingId: string;
  entityType?: string;
}


interface BenefitForm {
  provider: string;
  agent_administrator: string;
  insurance_agency: string;
  transaction_type: string;
  plan_year: string;
  new_plan_effective_date: string;
  retirement_contribution: string;
  eligibility_comments: string;
}

const emptyForm: BenefitForm = {
  provider: "",
  agent_administrator: "",
  insurance_agency: "",
  transaction_type: "",
  plan_year: "",
  new_plan_effective_date: "",
  retirement_contribution: "",
  eligibility_comments: "",
};

export default function MeetingBenefits({ meetingId, entityType }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BenefitForm>(emptyForm);
  const [category, setCategory] = useState<string>("");
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [otherText, setOtherText] = useState<string>("");

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_benefits", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_benefits" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) || []).filter(
        (r) => !(r.benefit_type || "").startsWith("__np_director__:")
      );
    },
  });


  const buildBenefitTypeLabel = (item: string): string => {
    if (item === "Other") {
      const trimmed = otherText.trim();
      return trimmed ? `${category} — Other: ${trimmed}` : `${category} — Other`;
    }
    return item;
  };

  const addRow = useMutation({
    mutationFn: async () => {
      const basePayload: any = {
        meeting_id: meetingId,
        provider: form.provider || null,
        agent_administrator: form.agent_administrator || null,
        insurance_agency: form.insurance_agency || null,
        transaction_type: form.transaction_type || null,
        plan_year: form.plan_year ? parseInt(form.plan_year) : null,
        new_plan_effective_date: form.new_plan_effective_date || null,
        retirement_contribution: form.retirement_contribution ? parseFloat(form.retirement_contribution) : null,
        eligibility_comments: form.eligibility_comments || null,
      };
      const payloads = selectedBenefits.map((item) => {
        const benefitType = buildBenefitTypeLabel(item);
        return {
          ...basePayload,
          benefit_type: benefitType,
          benefit_description: benefitType,
        };
      });
      const { error } = await supabase.from("meeting_benefits" as any).insert(payloads as any);
      if (error) throw error;
      return payloads.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["meeting_benefits", meetingId] });
      closeDialog();
      toast.success(`Added ${count} benefit${count === 1 ? "" : "s"}!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const item = selectedBenefits[0] || "";
      const benefitType = buildBenefitTypeLabel(item);
      const payload: any = {
        benefit_type: benefitType,
        benefit_description: benefitType,
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
    setCategory("");
    setSelectedBenefits([]);
    setOtherText("");
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setForm({
      provider: row.provider || "",
      agent_administrator: row.agent_administrator || "",
      insurance_agency: row.insurance_agency || "",
      transaction_type: row.transaction_type || "",
      plan_year: row.plan_year?.toString() || "",
      new_plan_effective_date: row.new_plan_effective_date || "",
      retirement_contribution: row.retirement_contribution?.toString() || "",
      eligibility_comments: row.eligibility_comments || "",
    });
    const stored = row.benefit_type || row.benefit_description || "";
    const matched = findCategoryForLabel(stored);
    if (matched) {
      setCategory(matched.category);
      setSelectedBenefits([matched.itemLabel]);
      if (matched.itemLabel === "Other") {
        const m = stored.match(/^.+?\s+—\s+Other(?::\s*(.+))?$/);
        setOtherText(m?.[1] || "");
      } else {
        setOtherText("");
      }
    } else {
      setCategory("");
      setSelectedBenefits([]);
      setOtherText(stored);
    }
    setDialogOpen(true);
  };

  // When category changes, reset selected items
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    setSelectedBenefits([]);
    setOtherText("");
  };

  const toggleBenefit = (label: string, checked: boolean) => {
    setSelectedBenefits((prev) => {
      if (checked) return prev.includes(label) ? prev : [...prev, label];
      return prev.filter((l) => l !== label);
    });
    if (label === "Other" && !checked) setOtherText("");
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

  const otherSelected = selectedBenefits.includes("Other");
  const submitDisabled =
    isPending ||
    !category ||
    selectedBenefits.length === 0 ||
    (otherSelected && !otherText.trim());

  // Show retirement contribution if category is Retirement OR any selected benefit looks retirement-related
  const showContribution =
    category === "Retirement" || selectedBenefits.some((b) => isRetirementType(b));

  return (
    <div className="space-y-5">
      {entityType === "Non-Profit" && <NonProfitDirectorBenefits meetingId={meetingId} />}
      <Card>

      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Benefits</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); setCategory(""); setSelectedBenefits([]); setOtherText(""); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-background/95">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Benefit" : "Add Benefit"}</DialogTitle>
              <DialogDescription>
                Choose a benefit category, then select one or more specific benefits.
              </DialogDescription>
            </DialogHeader>
            <TooltipProvider delayDuration={150}>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Step 1: Category */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Benefit Category</Label>
                  <Select value={category} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select a category…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Step 2: Benefits multi-select */}
                {category && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Benefits in {category} <span className="text-muted-foreground/70">(select all that apply)</span>
                    </Label>
                    <div className="rounded-md border bg-muted/20 p-3">
                      <ScrollArea className="max-h-64">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-2">
                          {BENEFIT_CATALOG[category].map((item) => {
                            const id = `bf-${category}-${item.label}`;
                            const checked = selectedBenefits.includes(item.label);
                            return (
                              <div key={item.label} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent/40 transition-colors">
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={(c) => toggleBenefit(item.label, !!c)}
                                />
                                <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
                                  {item.label}
                                </Label>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`About ${item.label}`}>
                                      <Info className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    {item.tooltip}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    {otherSelected && (
                      <div className="space-y-1.5 pt-2">
                        <Label className="text-xs font-medium text-muted-foreground">Describe other benefit</Label>
                        <Input
                          value={otherText}
                          onChange={(e) => setOtherText(e.target.value)}
                          placeholder="e.g., Wellness rebate program"
                          className="bg-background"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Selected summary */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Selected</Label>
                  {selectedBenefits.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No benefits selected yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBenefits.map((b) => (
                        <Badge key={b} variant="secondary" className="gap-1 pr-1">
                          {b === "Other" ? `Other${otherText.trim() ? `: ${otherText.trim()}` : ""}` : b}
                          <button
                            type="button"
                            onClick={() => toggleBenefit(b, false)}
                            className="rounded-sm hover:bg-background/60 p-0.5"
                            aria-label={`Remove ${b}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Common plan-detail fields */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
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
                  {showContribution && (
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

                <Button type="submit" className="w-full" disabled={submitDisabled}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId
                    ? "Save Changes"
                    : selectedBenefits.length > 1
                      ? `Add ${selectedBenefits.length} Benefits`
                      : "Add Benefit"}
                </Button>
              </form>
            </TooltipProvider>
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
                    <TableRow key={row.id} className="border-b border-border">
                      <TableCell className="font-medium text-sm whitespace-nowrap">{row.benefit_type || row.benefit_description || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{row.provider || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{row.agent_administrator || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{row.insurance_agency || "—"}</TableCell>
                      <TableCell rowSpan={3}>
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
                    {/* Sub-header row */}
                    <TableRow key={`${row.id}-subhead`} className="border-b border-border bg-muted/30">
                      <TableCell className="py-1 text-xs font-medium text-muted-foreground border-r border-border">
                        Plan Year
                      </TableCell>
                      <TableCell className="py-1 text-xs font-medium text-muted-foreground border-r border-border">
                        Contribution
                      </TableCell>
                      <TableCell className="py-1 text-xs font-medium text-muted-foreground" colSpan={2}>
                        Eligibility / Comments
                      </TableCell>
                    </TableRow>
                    {/* Sub-data row */}
                    <TableRow key={`${row.id}-subdata`} className="border-b border-border">
                      <TableCell className="py-1.5 text-xs border-r border-border">
                        {row.plan_year || "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs border-r border-border">
                        {isRetirementType(row.benefit_type) && row.retirement_contribution != null
                          ? `$${Number(row.retirement_contribution).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs" colSpan={2}>
                        {row.eligibility_comments || "—"}
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
    </div>
  );
}

