import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RETENTION_RESOLUTION_LABEL, resolveRetentionDisplayLabel } from "@/lib/resolution-types";

export const RETENTION_DECISION_OPTIONS = [
  { value: "retain_all", label: "Retain all earnings" },
  { value: "distribute_partial", label: "Distribute a portion and retain the remainder" },
  { value: "distribute_all", label: "Distribute all earnings" },
] as const;

export type RetentionDecision = (typeof RETENTION_DECISION_OPTIONS)[number]["value"];

export const RETENTION_REASON_CATEGORIES = [
  "Business expansion or plant/equipment replacement",
  "Acquisition of a business",
  "Debt retirement",
  "Working capital needs",
  "Loans to suppliers or customers",
  "Self-insurance or contingency reserve",
  "Other",
] as const;

export const REASON_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
] as const;

export interface RetentionReasonForm {
  id?: string;
  category: string;
  description: string;
  estimated_cost: string;
  target_date: string;
  status: string;
  status_note: string;
  carried_from_reason_id?: string | null;
  sort_order: number;
}

export interface RetentionResolutionForm {
  fiscal_year: string;
  decision: RetentionDecision | "";
  retained_earnings_reported: string;
  reported_by: string;
  reported_as_of: string;
  notes: string;
  reasons: RetentionReasonForm[];
}

interface Props {
  company: any;
  meetingId?: string;
  entityType: string;
  taxYear?: string | number | null;
  meetingDate?: string;
  shareholders?: any[];
  sElectedForMeeting?: boolean;
  onSaved?: () => void;
}

function emptyReason(sortOrder = 0): RetentionReasonForm {
  return {
    category: "",
    description: "",
    estimated_cost: "",
    target_date: "",
    status: "",
    status_note: "",
    sort_order: sortOrder,
  };
}

function initialForm(): RetentionResolutionForm {
  return {
    fiscal_year: "",
    decision: "",
    retained_earnings_reported: "",
    reported_by: "",
    reported_as_of: "",
    notes: "",
    reasons: [emptyReason(0)],
  };
}

function fmtMoney(value: string | number | null | undefined): string {
  if (value == null || value === "") return "";
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function composeCanonicalResolutionText(
  form: RetentionResolutionForm,
  entityType: string,
  companyName: string,
  sElectedForMeeting: boolean
): string {
  const isLLC = /LLC|Limited Liability Company/i.test(entityType || "");
  const label = resolveRetentionDisplayLabel(entityType, sElectedForMeeting);
  const fiscalYear = form.fiscal_year;
  const reported = parseMoney(form.retained_earnings_reported);
  const reportedBy = form.reported_by.trim() || null;
  const reportedAsOf = form.reported_as_of
    ? new Date(form.reported_as_of + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

  let whereas = `WHEREAS, the ${isLLC ? "members/managers" : "Board of Directors"} of ${companyName} considered the appropriate handling of earnings for the fiscal year ended ${fiscalYear}; and`;
  if (reported != null && reportedBy) {
    whereas = `WHEREAS, management reported retained earnings in the amount of $${fmtMoney(reported)}, as reported by ${reportedBy}${reportedAsOf ? ` as of ${reportedAsOf}` : ""}, for the fiscal year ended ${fiscalYear}; and`;
  } else if (reported != null) {
    whereas = `WHEREAS, management reported retained earnings in the amount of $${fmtMoney(reported)} for the fiscal year ended ${fiscalYear}; and`;
  }

  const decision = form.decision as "retain_all" | "distribute_partial" | "distribute_all";
  let resolved = "";
  if (decision === "retain_all") {
    resolved = `RESOLVED, that ${companyName} shall retain all earnings for the fiscal year ended ${fiscalYear} for the reasonable needs of the business, and no distribution shall be made at this time in respect of such earnings.`;
  } else if (decision === "distribute_all") {
    resolved = `RESOLVED, that all earnings for the fiscal year ended ${fiscalYear} shall be distributed to the ${isLLC ? "members" : "shareholders"} in accordance with their respective ${isLLC ? "membership interests" : "ownership interests"}.`;
  } else {
    resolved = `RESOLVED, that a portion of the earnings for the fiscal year ended ${fiscalYear} shall be distributed to the ${isLLC ? "members" : "shareholders"} as approved in the separate distribution resolution, and the remainder shall be retained for the reasonable needs of the business.`;
  }

  const reasons = form.reasons
    .filter((r) => r.description.trim())
    .map((r, i) => `${i + 1}. ${r.category ? `[${r.category}] ` : ""}${r.description.trim()}${r.estimated_cost ? ` (estimated cost $${fmtMoney(r.estimated_cost)}` : ""}${r.estimated_cost && r.target_date ? `, target ${new Date(r.target_date + "T12:00:00").toLocaleDateString("en-US")}` : r.estimated_cost ? ")" : ""}`)
    .join("\n");

  let text = `${label}\n\n${whereas}\n\n${resolved}`;
  if (reasons) {
    text += `\n\nThe following reasons support the retention decision:\n${reasons}`;
  }
  if (form.notes.trim()) {
    text += `\n\nNotes: ${form.notes.trim()}`;
  }
  return text;
}


export function distributionTotal(shareholders: any[] = []): number {
  return shareholders
    .filter((s) => s.distribution_amount != null && Number(s.distribution_amount) > 0)
    .reduce((sum, s) => sum + Number(s.distribution_amount), 0);
}

/**
 * Returns holders whose share of the distribution total deviates from their
 * ownership percentage by more than the given tolerance (default 0.5%).
 */
export function disproportionateDistributions(
  shareholders: any[] = [],
  tolerance = 0.005
): Array<{ name: string; expected: number; actual: number; diff: number }> {
  const positive = shareholders.filter(
    (s) => s.distribution_amount != null && Number(s.distribution_amount) > 0
  );
  const total = positive.reduce((sum, s) => sum + Number(s.distribution_amount), 0);
  if (total === 0) return [];

  return positive
    .map((s) => {
      const ownership = s.preferred_shares != null ? Number(s.preferred_shares) / 100 : 1 / positive.length;
      const actual = Number(s.distribution_amount) / total;
      const diff = actual - ownership;
      return {
        name: s.shareholder_name || s.name || "Holder",
        expected: ownership,
        actual,
        diff,
      };
    })
    .filter((r) => Math.abs(r.diff) > tolerance);
}

export default function RetentionResolutionPanel({
  company,
  meetingId,
  entityType,
  taxYear,
  meetingDate,
  shareholders = [],
  sElectedForMeeting,
  onSaved,
}: Props) {
  const queryClient = useQueryClient();
  const companyId = company?.id;

  const fiscalYearFromProps = useMemo(() => {
    if (taxYear != null && taxYear !== "") return String(taxYear);
    if (meetingDate) return String(new Date(meetingDate + "T00:00:00").getFullYear());
    return "";
  }, [taxYear, meetingDate]);

  const [form, setForm] = useState<RetentionResolutionForm>(() => ({
    ...initialForm(),
    fiscal_year: fiscalYearFromProps,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load an existing retention resolution for this meeting (primary) or for the
  // selected fiscal year (fallback). Meetings always have a meeting_id here, but
  // the column is nullable for written-consent records created outside a meeting.
  const { data: existing } = useQuery({
    queryKey: ["retained_earnings_resolution", companyId, meetingId, form.fiscal_year],
    queryFn: async () => {
      if (meetingId) {
        const { data, error } = await supabase
          .from("retained_earnings_resolutions")
          .select("*, retained_earnings_reasons(*)")
          .eq("company_id", companyId!)
          .eq("meeting_id", meetingId)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }
      if (!form.fiscal_year || !Number.isFinite(Number(form.fiscal_year))) return null;
      const { data, error } = await supabase
        .from("retained_earnings_resolutions")
        .select("*, retained_earnings_reasons(*)")
        .eq("company_id", companyId!)
        .eq("fiscal_year", Number(form.fiscal_year))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && (!!meetingId || (!!form.fiscal_year && Number.isFinite(Number(form.fiscal_year)))),
  });

  // Load prior-year reasons so they can be carried forward.
  const priorYear = useMemo(() => {
    const fy = Number(form.fiscal_year);
    return Number.isFinite(fy) ? fy - 1 : null;
  }, [form.fiscal_year]);

  const { data: priorResolution } = useQuery({
    queryKey: ["retained_earnings_resolution_prior", companyId, priorYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retained_earnings_resolutions")
        .select("*, retained_earnings_reasons(*)")
        .eq("company_id", companyId!)
        .eq("fiscal_year", priorYear!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!priorYear,
  });

  useEffect(() => {
    if (!existing) {
      setForm((prev) => ({ ...prev, fiscal_year: fiscalYearFromProps || prev.fiscal_year }));
      return;
    }
    const reasons: RetentionReasonForm[] =
      (existing.retained_earnings_reasons || [])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((r: any) => ({
          id: r.id,
          category: r.category || "",
          description: r.description || "",
          estimated_cost: r.estimated_cost != null ? String(r.estimated_cost) : "",
          target_date: r.target_date || "",
          status: r.status || "",
          status_note: r.status_note || "",
          carried_from_reason_id: r.carried_from_reason_id || null,
          sort_order: r.sort_order ?? 0,
        }));

    setForm({
      fiscal_year: String(existing.fiscal_year),
      decision: (existing.decision as RetentionDecision) || "",
      retained_earnings_reported: existing.retained_earnings_reported != null ? String(existing.retained_earnings_reported) : "",
      reported_by: existing.reported_by || "",
      reported_as_of: existing.reported_as_of || "",
      notes: existing.notes || "",
      reasons: reasons.length > 0 ? reasons : [emptyReason(0)],
    });
  }, [existing, fiscalYearFromProps]);

  const distTotal = useMemo(() => distributionTotal(shareholders), [shareholders]);
  const disproportionate = useMemo(
    () => disproportionateDistributions(shareholders),
    [shareholders]
  );

  const isMultiMemberLLC = entityType === "LLC" || entityType === "LLC-S" || entityType === "Partnership";
  const isSingleMemberLLC = entityType === "Single Member LLC";

  const warnings = useMemo(() => {
    const list: string[] = [];
    const reported = parseMoney(form.retained_earnings_reported) ?? 0;
    if (entityType === "Corporation" && !sElectedForMeeting && reported >= 200_000) {
      list.push(
        "Accumulated earnings beyond the reasonable needs of the business may be subject to the accumulated earnings tax under IRC § 531. The credit is $250,000, or $150,000 for personal service corporations. Specific, definite, and feasible plans support the reasonable-needs position."
      );
    }
    if (entityType === "Corporation" && sElectedForMeeting && distTotal > 0 && disproportionate.length > 0) {
      list.push(
        "Distributions appear disproportionate to ownership. Disproportionate distributions can jeopardize the S election under IRC § 1361."
      );
    }
    if (isMultiMemberLLC && form.decision === "retain_all") {
      list.push(
        "Members may owe tax on income they did not receive. Confirm whether the operating agreement requires tax distributions."
      );
    }
    return list;
  }, [entityType, sElectedForMeeting, form.retained_earnings_reported, form.decision, distTotal, disproportionate, isMultiMemberLLC]);

  const setField = (key: keyof RetentionResolutionForm, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const setReason = (index: number, key: keyof RetentionReasonForm, value: any) => {
    setForm((prev) => {
      const reasons = [...prev.reasons];
      reasons[index] = { ...reasons[index], [key]: value };
      return { ...prev, reasons };
    });
    setErrors((prev) => ({ ...prev, [`reason_${index}_${key}`]: "" }));
  };

  const addReason = () => {
    setForm((prev) => ({
      ...prev,
      reasons: [...prev.reasons, emptyReason(prev.reasons.length)],
    }));
  };

  const removeReason = (index: number) => {
    setForm((prev) => ({
      ...prev,
      reasons: prev.reasons.filter((_, i) => i !== index).map((r, i) => ({ ...r, sort_order: i })),
    }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.fiscal_year || !Number.isFinite(Number(form.fiscal_year))) {
      next.fiscal_year = "Set the meeting's tax year before recording a retention resolution.";
    }
    if (!form.decision) {
      next.decision = "Select a decision.";
    }
    form.reasons
      .filter((r) => r.description.trim())
      .forEach((r, i) => {
        if (r.carried_from_reason_id && !r.status) {
          next[`reason_${i}_status`] = "Select a status for the carried-forward reason.";
        }
      });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Company is required.");
      if (!form.fiscal_year || !Number.isFinite(Number(form.fiscal_year))) {
        throw new Error("Set the meeting's tax year before recording a retention resolution.");
      }

      const payload = {
        company_id: companyId,
        meeting_id: meetingId || null,
        fiscal_year: Number(form.fiscal_year),
        decision: form.decision,
        retained_earnings_reported: parseMoney(form.retained_earnings_reported),
        reported_by: form.reported_by.trim() || null,
        reported_as_of: form.reported_as_of || null,
        notes: form.notes.trim() || null,
      };

      const { data: resolution, error: upsertError } = await supabase
        .from("retained_earnings_resolutions")
        .upsert(payload, { onConflict: "company_id,fiscal_year" })
        .select("id")
        .single();
      if (upsertError) throw upsertError;

      const resolutionId = resolution!.id;

      // Ignore reason rows that have no description; they were added by mistake
      // or left blank and should not block saving or create empty records.
      const activeReasons = form.reasons.filter((r) => r.description.trim());

      // Delete existing reasons that are not in the current active list and were not
      // carried forward (i.e., have no id in the form).
      const keptIds = activeReasons.map((r) => r.id).filter(Boolean) as string[];
      if (keptIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("retained_earnings_reasons")
          .delete()
          .eq("resolution_id", resolutionId)
          .not("id", "in", `(${keptIds.join(",")})`);
        if (deleteError) throw deleteError;
      } else {
        const { error: deleteError } = await supabase
          .from("retained_earnings_reasons")
          .delete()
          .eq("resolution_id", resolutionId);
        if (deleteError) throw deleteError;
      }

      // Upsert current reasons.
      const reasonRows = activeReasons.map((r, i) => ({
        id: r.id && keptIds.includes(r.id) ? r.id : undefined,
        resolution_id: resolutionId,
        category: r.category || null,
        description: r.description.trim(),
        estimated_cost: parseMoney(r.estimated_cost),
        target_date: r.target_date || null,
        carried_from_reason_id: r.carried_from_reason_id || null,
        status: r.status || null,
        status_note: r.status_note.trim() || null,
        sort_order: i,
      }));

      if (reasonRows.length > 0) {
        const { error: insertError } = await supabase
          .from("retained_earnings_reasons")
          .upsert(reasonRows as any, { onConflict: "id" });
        if (insertError) throw insertError;
      }

      // Keep the canonical meeting_resolutions row in sync so it appears in the
      // resolutions list and can be exported independently.
      if (meetingId) {
        const canonicalText = composeCanonicalResolutionText(
          form,
          entityType,
          company?.name || "",
          sElectedForMeeting ?? false
        );
        const { data: existingRows, error: findError } = await supabase
          .from("meeting_resolutions")
          .select("id")
          .eq("meeting_id", meetingId)
          .eq("purpose", RETENTION_RESOLUTION_LABEL)
          .limit(1);
        if (findError) throw findError;

        if (existingRows && existingRows.length > 0) {
          const { error: updateError } = await supabase
            .from("meeting_resolutions")
            .update({ resolution_text: canonicalText })
            .eq("id", existingRows[0].id);
          if (updateError) throw updateError;
        } else {
          const { error: createError } = await supabase.from("meeting_resolutions").insert({
            meeting_id: meetingId,
            purpose: RETENTION_RESOLUTION_LABEL,
            resolution_text: canonicalText,
          });
          if (createError) throw createError;
        }
      }

      return resolutionId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retained_earnings_resolution", companyId, form.fiscal_year] });
      queryClient.invalidateQueries({ queryKey: ["retained_earnings_resolution_prior", companyId, priorYear] });
      toast.success("Retention resolution saved.");
      onSaved?.();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save retention resolution.");
    },
  });

  const handleSave = () => {
    if (!validate()) return;
    save.mutate();
  };

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Retention of Earnings Details</h4>
      </div>

      {!form.fiscal_year && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Set the meeting's tax year before recording a retention resolution.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Fiscal Year</Label>
          <Input
            type="number"
            value={form.fiscal_year}
            onChange={(e) => setField("fiscal_year", e.target.value)}
            placeholder="YYYY"
            className="bg-background"
            required
          />
          {errors.fiscal_year && <p className="text-[11px] text-destructive">{errors.fiscal_year}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Decision</Label>
          <Select value={form.decision} onValueChange={(v) => setField("decision", v)}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select decision..." />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {RETENTION_DECISION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.decision && <p className="text-[11px] text-destructive">{errors.decision}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Retained earnings as reported</Label>
          <Input
            value={form.retained_earnings_reported}
            onChange={(e) => setField("retained_earnings_reported", e.target.value)}
            placeholder="0.00"
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Reported by (accountant)</Label>
          <Input
            value={form.reported_by}
            onChange={(e) => setField("reported_by", e.target.value)}
            placeholder="Accountant / firm"
            className="bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">As of date</Label>
          <DatePickerField
            value={form.reported_as_of}
            onChange={(v) => setField("reported_as_of", v || "")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
          className="bg-background"
        />
      </div>

      {/* Distribution summary */}
      {distTotal > 0 && (
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs font-medium text-muted-foreground">Total distributions recorded for this meeting</p>
          <p className="text-sm font-semibold">${fmtMoney(distTotal)}</p>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <AlertDescription key={i} className="text-xs text-amber-900 dark:text-amber-200">
                {w}
              </AlertDescription>
            ))}
          </div>
        </Alert>
      )}

      {/* Prior-year carry-forward reasons */}
      {priorResolution && (priorResolution.retained_earnings_reasons || []).length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prior-year reasons ({priorResolution.fiscal_year}) — require status
          </h5>
          <div className="space-y-2">
            {(priorResolution.retained_earnings_reasons as any[])
              .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((r: any, i: number) => {
                const localIndex = form.reasons.findIndex((lr) => lr.carried_from_reason_id === r.id);
                const alreadyCarried = localIndex !== -1;
                return (
                  <div
                    key={r.id}
                    className="rounded-md border bg-background p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs">
                        <p className="font-medium">{r.category || "Uncategorized"}</p>
                        <p className="text-muted-foreground mt-0.5">{r.description}</p>
                        {r.estimated_cost != null && (
                          <p className="text-muted-foreground">Est. cost: ${fmtMoney(r.estimated_cost)}</p>
                        )}
                        {r.target_date && (
                          <p className="text-muted-foreground">Target date: {formatLongDate(r.target_date)}</p>
                        )}
                      </div>
                      {!alreadyCarried && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setForm((prev) => ({
                              ...prev,
                              reasons: [
                                ...prev.reasons,
                                {
                                  ...emptyReason(prev.reasons.length),
                                  category: r.category || "",
                                  description: "",
                                  estimated_cost: r.estimated_cost != null ? String(r.estimated_cost) : "",
                                  target_date: r.target_date || "",
                                  carried_from_reason_id: r.id,
                                },
                              ],
                            }));
                          }}
                        >
                          Add follow-up
                        </Button>
                      )}
                    </div>
                    {alreadyCarried && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[10px] font-medium text-muted-foreground">Status</Label>
                          <Select
                            value={form.reasons[localIndex].status}
                            onValueChange={(v) => setReason(localIndex, "status", v)}
                          >
                            <SelectTrigger className="bg-background h-8 text-xs">
                              <SelectValue placeholder="Select status..." />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              {REASON_STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] font-medium text-muted-foreground">Status note</Label>
                          <Input
                            value={form.reasons[localIndex].status_note}
                            onChange={(e) => setReason(localIndex, "status_note", e.target.value)}
                            className="bg-background h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Current reasons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reasons for retention
          </h5>
          <Button type="button" size="sm" variant="outline" onClick={addReason}>
            <Plus className="mr-1.5 h-3 w-3" /> Add reason
          </Button>
        </div>

        {form.reasons.map((reason, i) => (
          <div key={i} className="rounded-md border bg-background p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground">Category</Label>
                <Select value={reason.category} onValueChange={(v) => setReason(i, "category", v)}>
                  <SelectTrigger className="bg-background h-8 text-xs">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {RETENTION_REASON_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground">Estimated cost</Label>
                <Input
                  value={reason.estimated_cost}
                  onChange={(e) => setReason(i, "estimated_cost", e.target.value)}
                  placeholder="0.00"
                  className="bg-background h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Description</Label>
              <Textarea
                value={reason.description}
                onChange={(e) => setReason(i, "description", e.target.value)}
                rows={2}
                className="bg-background text-xs"
              />
              {errors[`reason_${i}_description`] && (
                <p className="text-[11px] text-destructive">{errors[`reason_${i}_description`]}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-medium text-muted-foreground">Target date</Label>
                <DatePickerField
                  value={reason.target_date}
                  onChange={(v) => setReason(i, "target_date", v || "")}
                />
              </div>
              {reason.carried_from_reason_id && (
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-muted-foreground">Status</Label>
                  <Select value={reason.status} onValueChange={(v) => setReason(i, "status", v)}>
                    <SelectTrigger className="bg-background h-8 text-xs">
                      <SelectValue placeholder="Select status..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {REASON_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors[`reason_${i}_status`] && (
                    <p className="text-[11px] text-destructive">{errors[`reason_${i}_status`]}</p>
                  )}
                </div>
              )}
            </div>
            {form.reasons.length > 1 && !reason.carried_from_reason_id && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive/60 hover:text-destructive h-7 text-xs"
                onClick={() => removeReason(i)}
              >
                <Trash2 className="mr-1.5 h-3 w-3" /> Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full" disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save Retention Resolution"}
      </Button>
    </form>
  );
}

function formatLongDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(String(value).slice(0, 10) + "T12:00:00");
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
