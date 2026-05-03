import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, TrendingUp, Lock, Info, Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAutoSave } from "@/hooks/useAutoSave";
import SaveStatusIndicator from "@/components/SaveStatusIndicator";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface Props {
  meetingId: string;
}

interface NonRecurringItem {
  id?: string;
  description: string;
  amount: string;
}

export default function MeetingFinancials({ meetingId }: Props) {
  const queryClient = useQueryClient();

  const { data: financials } = useQuery({
    queryKey: ["meeting_financials", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_financials")
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: nonRecurringItems = [] } = useQuery({
    queryKey: ["meeting_non_recurring_items", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_non_recurring_items" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: meeting } = useQuery({
    queryKey: ["meeting_for_financials", meetingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meetings")
        .select("id, company_id, meeting_date, meeting_type")
        .eq("id", meetingId)
        .maybeSingle();
      return data;
    },
  });

  const { data: priorMeetingFinancials } = useQuery({
    queryKey: ["prior_meeting_financials_for_autofill", meeting?.company_id, meetingId, meeting?.meeting_date],
    queryFn: async () => {
      const { data: priorMeetings } = await supabase
        .from("meetings")
        .select("id, meeting_date, document_status")
        .eq("company_id", meeting!.company_id)
        .neq("id", meetingId)
        .order("meeting_date", { ascending: false })
        .limit(20);

      if (!priorMeetings?.length) return null;

      // Exclude canceled meetings from source resolution
      const eligible = priorMeetings.filter(
        (pm: any) => (pm.document_status ?? "").toLowerCase() !== "cancelled",
      );

      for (const pm of eligible) {
        const { data: fin } = await supabase
          .from("meeting_financials")
          .select("*")
          .eq("meeting_id", pm.id)
          .maybeSingle();

        if (fin && (fin.current_total_sales != null || fin.current_cog != null || fin.current_net_income != null)) {
          return { financials: fin, meetingDate: pm.meeting_date };
        }
      }
      return null;
    },
    enabled: !!meeting?.company_id,
    staleTime: 0,
  });

  const isAutoFilled = !!(
    priorMeetingFinancials?.financials &&
    (!financials || (
      financials.previous_total_sales == null &&
      financials.previous_cog == null &&
      financials.previous_net_income == null
    ))
  );

  const hasSavedPreviousData = !!(
    financials &&
    (financials.previous_total_sales != null ||
     financials.previous_cog != null ||
     financials.previous_net_income != null)
  );

  // Prior-year fields are now editable. Override status is derived per-field.
  const sourceFin = priorMeetingFinancials?.financials;
  const sourceValueFor = (key: string): number | null => {
    if (!sourceFin) return null;
    const map: Record<string, any> = {
      total_sales: sourceFin.current_total_sales,
      cog: sourceFin.current_cog,
      gross_profit: sourceFin.current_gross_profit,
      cog_ratio: sourceFin.current_cog_ratio,
      net_income: sourceFin.current_net_income,
    };
    const v = map[key];
    return v == null ? null : Number(v);
  };
  const isFieldOverridden = (key: string): boolean => {
    const src = sourceValueFor(key);
    const cur = (form as any)[`previous_${key}`];
    if (src == null) return false;
    if (cur === "" || cur == null) return false;
    return Number(cur) !== src;
  };

  const sourceLabel = priorMeetingFinancials?.meetingDate
    ? `Auto-filled from meeting on ${format(new Date(priorMeetingFinancials.meetingDate + "T12:00:00"), "MMM d, yyyy")}`
    : null;

  const [form, setForm] = useState({
    current_total_sales: "",
    current_gross_profit: "",
    current_cog: "",
    current_cog_ratio: "",
    current_net_income: "",
    previous_total_sales: "",
    previous_gross_profit: "",
    previous_cog: "",
    previous_cog_ratio: "",
    previous_net_income: "",
  });

  const [focusedFields, setFocusedFields] = useState<Set<string>>(new Set());

  const sanitizeCurrencyInput = (raw: string): string => {
    // strip everything except digits, decimal point, and leading minus
    let s = raw.replace(/[^0-9.\-]/g, "");
    // keep only first leading minus
    s = s.replace(/(?!^)-/g, "");
    // keep only first decimal
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    return s;
  };

  const formatCurrencyDisplay = (raw: string): string => {
    if (raw === "" || raw == null) return "";
    const n = parseFloat(raw);
    if (!isFinite(n)) return raw;
    const abs = Math.abs(n);
    const formatted = `$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return n < 0 ? `-${formatted}` : formatted;
  };

  const getDisplayValue = (fieldId: string, raw: string, computed?: boolean): string => {
    if (focusedFields.has(fieldId)) return raw;
    if (computed) {
      // computed fields: gross_profit shown as currency, cog_ratio as percent
      if (fieldId.endsWith("cog_ratio")) {
        if (raw === "" || raw == null) return "";
        const n = parseFloat(raw);
        return isFinite(n) ? `${n.toFixed(2)}%` : raw;
      }
      return formatCurrencyDisplay(raw);
    }
    return formatCurrencyDisplay(raw);
  };

  const setFocused = (id: string, focused: boolean) => {
    setFocusedFields((prev) => {
      const next = new Set(prev);
      if (focused) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const [nrItems, setNrItems] = useState<NonRecurringItem[]>([]);
  const [excludeNrFromYoy, setExcludeNrFromYoy] = useState(false);
  const [lastFinancials, setLastFinancials] = useState<typeof financials>(undefined);
  const [autoFillApplied, setAutoFillApplied] = useState(false);
  const [nrInitialized, setNrInitialized] = useState(false);

  // Sync NR items from DB
  useEffect(() => {
    if (!nrInitialized && nonRecurringItems.length > 0) {
      setNrItems(nonRecurringItems.map((item: any) => ({
        id: item.id,
        description: item.description || "",
        amount: item.amount?.toString() || "",
      })));
      setNrInitialized(true);
    }
  }, [nonRecurringItems, nrInitialized]);

  // Sync form from saved financials
  if (financials !== lastFinancials) {
    setLastFinancials(financials);
    if (financials) {
      setForm({
        current_total_sales: financials.current_total_sales?.toString() ?? "",
        current_gross_profit: financials.current_gross_profit?.toString() ?? "",
        current_cog: financials.current_cog?.toString() ?? "",
        current_cog_ratio: financials.current_cog_ratio?.toString() ?? "",
        current_net_income: financials.current_net_income?.toString() ?? "",
        previous_total_sales: financials.previous_total_sales?.toString() ?? "",
        previous_gross_profit: financials.previous_gross_profit?.toString() ?? "",
        previous_cog: financials.previous_cog?.toString() ?? "",
        previous_cog_ratio: financials.previous_cog_ratio?.toString() ?? "",
        previous_net_income: financials.previous_net_income?.toString() ?? "",
      });
    }
  }

  useEffect(() => {
    if (
      !autoFillApplied &&
      priorMeetingFinancials?.financials &&
      !hasSavedPreviousData
    ) {
      const pf = priorMeetingFinancials.financials;
      setForm((prev) => ({
        ...prev,
        previous_total_sales: pf.current_total_sales?.toString() ?? "",
        previous_cog: pf.current_cog?.toString() ?? "",
        previous_gross_profit: pf.current_gross_profit?.toString() ?? "",
        previous_cog_ratio: pf.current_cog_ratio?.toString() ?? "",
        previous_net_income: pf.current_net_income?.toString() ?? "",
      }));
      setAutoFillApplied(true);
    }
  }, [priorMeetingFinancials, hasSavedPreviousData, autoFillApplied]);

  const toNum = (s: string) => (s ? parseFloat(s) : null);

  const handleFieldChange = (prefix: "current" | "previous", key: string, value: string) => {
    const clean = sanitizeCurrencyInput(value);
    setForm((prev) => {
      const updated = { ...prev, [`${prefix}_${key}`]: clean };

      const sales = toNum(key === "total_sales" ? clean : updated[`${prefix}_total_sales`]);
      const cog = toNum(key === "cog" ? clean : updated[`${prefix}_cog`]);

      if (sales != null && cog != null) {
        updated[`${prefix}_gross_profit`] = (sales - cog).toFixed(2);
        updated[`${prefix}_cog_ratio`] = sales > 0 ? ((cog / sales) * 100).toFixed(2) : "0";
      }

      return updated;
    });
  };

  // Non-recurring items helpers
  const totalNrCurrent = nrItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const currentNetIncome = toNum(form.current_net_income) ?? 0;
  const previousNetIncome = toNum(form.previous_net_income) ?? 0;
  const adjustedCurrentNetIncome = currentNetIncome - totalNrCurrent;
  const adjustedPreviousNetIncome = previousNetIncome; // Previous year NR items not tracked separately

  const addNrItem = () => setNrItems(prev => [...prev, { description: "", amount: "" }]);
  const removeNrItem = (idx: number) => setNrItems(prev => prev.filter((_, i) => i !== idx));
  const updateNrItem = (idx: number, key: "description" | "amount", value: string) => {
    setNrItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        meeting_id: meetingId,
        current_total_sales: toNum(form.current_total_sales),
        current_gross_profit: toNum(form.current_gross_profit),
        current_cog: toNum(form.current_cog),
        current_cog_ratio: toNum(form.current_cog_ratio),
        current_net_income: toNum(form.current_net_income),
        previous_total_sales: toNum(form.previous_total_sales),
        previous_gross_profit: toNum(form.previous_gross_profit),
        previous_cog: toNum(form.previous_cog),
        previous_cog_ratio: toNum(form.previous_cog_ratio),
        previous_net_income: toNum(form.previous_net_income),
      };
      if (financials) {
        const { error } = await supabase
          .from("meeting_financials")
          .update(payload)
          .eq("id", financials.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meeting_financials").insert(payload);
        if (error) throw error;
      }

      // Save non-recurring items: delete existing, insert new
      await supabase.from("meeting_non_recurring_items" as any).delete().eq("meeting_id", meetingId);
      const nrToSave = nrItems.filter(item => item.description || item.amount);
      if (nrToSave.length > 0) {
        const { error: nrError } = await supabase.from("meeting_non_recurring_items" as any).insert(
          nrToSave.map(item => ({
            meeting_id: meetingId,
            description: item.description,
            amount: parseFloat(item.amount) || 0,
          }))
        );
        if (nrError) throw nrError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_financials", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting_non_recurring_items", meetingId] });
      toast.success("Financial data saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Auto-save for financials (covers both form and NR items)
  const financialsAutoSave = useAutoSave({
    data: { form, nrItems },
    onSave: async () => { await save.mutateAsync(); },
    enabled: !!meetingId,
  });

  const yoyChange = (currentKey: string, previousKey: string) => {
    const cur = toNum((form as any)[currentKey]);
    const prev = toNum((form as any)[previousKey]);
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const adjustedYoyNetIncome = () => {
    if (adjustedPreviousNetIncome === 0) return null;
    return ((adjustedCurrentNetIncome - adjustedPreviousNetIncome) / Math.abs(adjustedPreviousNetIncome)) * 100;
  };

  const getDisplayedYoyNetIncome = () => {
    if (excludeNrFromYoy && totalNrCurrent !== 0) {
      return adjustedYoyNetIncome();
    }
    return yoyChange("current_net_income", "previous_net_income");
  };

  const fields: { key: string; label: string; computed?: boolean }[] = [
    { key: "total_sales", label: "Total Sales" },
    { key: "cog", label: "Cost of Goods" },
    { key: "gross_profit", label: "Gross Profit", computed: true },
    { key: "cog_ratio", label: "COG Ratio (%)", computed: true },
    { key: "net_income", label: "Net Income" },
  ];

  const noPriorData = !priorMeetingFinancials?.financials && !hasSavedPreviousData;

  const fmtDollar = (v: number) => {
    if (!v) return "";
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  // Chart data
  const chartData = [
    { name: "Total Sales", "Current Year": toNum(form.current_total_sales) ?? 0, "Previous Year": toNum(form.previous_total_sales) ?? 0 },
    { name: "Gross Profit", "Current Year": toNum(form.current_gross_profit) ?? 0, "Previous Year": toNum(form.previous_gross_profit) ?? 0 },
    { name: "COG", "Current Year": toNum(form.current_cog) ?? 0, "Previous Year": toNum(form.previous_cog) ?? 0 },
    { name: "Net Income", "Current Year": toNum(form.current_net_income) ?? 0, "Previous Year": toNum(form.previous_net_income) ?? 0 },
  ];

  if (totalNrCurrent !== 0) {
    chartData.push({
      name: "Adj. Net Income",
      "Current Year": adjustedCurrentNetIncome,
      "Previous Year": adjustedPreviousNetIncome,
    });
  }

  const cogChartData = [
    { name: "COG Ratio", "Current Year": toNum(form.current_cog_ratio) ?? 0, "Previous Year": toNum(form.previous_cog_ratio) ?? 0 },
  ];

  const hasData = chartData.some((d) => d["Current Year"] > 0 || d["Previous Year"] > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Financial Comparison</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {sourceLabel && (
                <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                  <Info className="h-3 w-3" />
                  {sourceLabel}
                </Badge>
              )}
              {sourceFin && (
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      previous_total_sales: sourceFin.current_total_sales?.toString() ?? "",
                      previous_cog: sourceFin.current_cog?.toString() ?? "",
                      previous_gross_profit: sourceFin.current_gross_profit?.toString() ?? "",
                      previous_cog_ratio: sourceFin.current_cog_ratio?.toString() ?? "",
                      previous_net_income: sourceFin.current_net_income?.toString() ?? "",
                    }));
                    financialsAutoSave.triggerSave();
                  }}
                  className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
                  title="Discard manual overrides and re-pull all prior-year values from the source meeting"
                >
                  <RotateCcw className="h-3 w-3" />
                  Re-sync all from source
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => e.preventDefault()}
            onBlur={financialsAutoSave.handleBlur}
          >
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-4">
              <div></div>
              <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Current Year</p>
              <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Previous Year</p>
              <p className="w-16 text-xs font-semibold text-right text-muted-foreground uppercase tracking-wider">YoY</p>
            </div>
            {fields.map((f) => {
              const isNetIncome = f.key === "net_income";
              const change = isNetIncome ? getDisplayedYoyNetIncome() : yoyChange(`current_${f.key}`, `previous_${f.key}`);
              const prevValue = (form as any)[`previous_${f.key}`];
              const overridden = !f.computed && isFieldOverridden(f.key);
              const srcVal = sourceValueFor(f.key);
              const canResync = !f.computed && srcVal != null && (
                prevValue === "" || prevValue == null || Number(prevValue) !== srcVal
              );
              const resyncField = () => {
                setForm((prev) => {
                  const updated = { ...prev, [`previous_${f.key}`]: srcVal != null ? srcVal.toString() : "" };
                  // Recompute derived prev fields if total_sales or cog changes
                  if (f.key === "total_sales" || f.key === "cog") {
                    const sales = toNum(f.key === "total_sales" ? (srcVal?.toString() ?? "") : updated.previous_total_sales);
                    const cog = toNum(f.key === "cog" ? (srcVal?.toString() ?? "") : updated.previous_cog);
                    if (sales != null && cog != null) {
                      updated.previous_gross_profit = (sales - cog).toFixed(2);
                      updated.previous_cog_ratio = sales > 0 ? ((cog / sales) * 100).toFixed(2) : "0";
                    }
                  }
                  return updated;
                });
                financialsAutoSave.triggerSave();
              };
              return (
                <div key={f.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-3 items-center">
                  <Label className="text-sm">{f.label}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={getDisplayValue(`current_${f.key}`, (form as any)[`current_${f.key}`], f.computed)}
                    onChange={(e) => handleFieldChange("current", f.key, e.target.value)}
                    onFocus={() => setFocused(`current_${f.key}`, true)}
                    onBlur={() => setFocused(`current_${f.key}`, false)}
                    readOnly={f.computed}
                    className={`text-right font-mono text-sm ${f.computed ? "bg-muted/50 text-muted-foreground" : ""}`}
                  />
                  {noPriorData && !prevValue ? (
                    <div className="text-xs text-muted-foreground italic text-center py-2">
                      No previous data available
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={getDisplayValue(`previous_${f.key}`, prevValue, f.computed)}
                        onChange={(e) => handleFieldChange("previous", f.key, e.target.value)}
                        onFocus={() => setFocused(`previous_${f.key}`, true)}
                        onBlur={() => setFocused(`previous_${f.key}`, false)}
                        readOnly={f.computed}
                        className={`text-right font-mono text-sm ${
                          f.computed ? "bg-muted/50 text-muted-foreground" : ""
                        } ${overridden ? "italic" : ""}`}
                      />
                      {overridden && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 italic font-normal">
                          Edited
                        </Badge>
                      )}
                      {canResync && !f.computed && (
                        <button
                          type="button"
                          onClick={resyncField}
                          className="text-muted-foreground hover:text-primary p-0.5"
                          title={`Re-sync from source: ${srcVal}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="w-16 text-right">
                    {change != null && (
                      <span className={`text-[11px] font-mono font-medium ${change >= 0 ? "text-success" : "text-destructive"}`}>
                        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Non-Recurring Items Section */}
            <div className="border-t border-border mt-4 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Non-Recurring Items</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addNrItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              {nrItems.length === 0 && (
                <p className="text-xs text-muted-foreground italic mb-3">No non-recurring items. Click "Add Item" to record one-time transactions.</p>
              )}
              {nrItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[2fr_1fr_auto] gap-2 mb-2 items-center">
                  <Input
                    className="text-sm h-8"
                    placeholder="Description (e.g., Sale of assets)"
                    value={item.description}
                    onChange={(e) => updateNrItem(idx, "description", e.target.value)}
                  />
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="text-right font-mono text-sm h-8"
                    placeholder="Amount"
                    value={focusedFields.has(`nr_${idx}`) ? item.amount : formatCurrencyDisplay(item.amount)}
                    onChange={(e) => updateNrItem(idx, "amount", sanitizeCurrencyInput(e.target.value))}
                    onFocus={() => setFocused(`nr_${idx}`, true)}
                    onBlur={() => setFocused(`nr_${idx}`, false)}
                  />
                  <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeNrItem(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {/* Adjusted Net Income */}
              {totalNrCurrent !== 0 && (
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mt-3 items-center bg-muted/30 rounded p-2">
                  <Label className="text-sm font-semibold">Adjusted Net Income</Label>
                  <div className="text-right font-mono text-sm font-semibold">
                    ${adjustedCurrentNetIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-right font-mono text-sm text-muted-foreground">
                    ${adjustedPreviousNetIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="w-16 text-right">
                    {adjustedYoyNetIncome() != null && (
                      <span className={`text-[11px] font-mono font-medium ${adjustedYoyNetIncome()! >= 0 ? "text-success" : "text-destructive"}`}>
                        {adjustedYoyNetIncome()! >= 0 ? "▲" : "▼"} {Math.abs(adjustedYoyNetIncome()!).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* YOY Toggle */}
              {totalNrCurrent !== 0 && (
                <div className="flex items-center gap-3 mt-3">
                  <Switch
                    checked={excludeNrFromYoy}
                    onCheckedChange={setExcludeNrFromYoy}
                  />
                  <Label className="text-xs text-muted-foreground cursor-pointer">
                    Exclude Non-Recurring Items from YoY
                  </Label>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <SaveStatusIndicator status={financialsAutoSave.status} lastSavedAt={financialsAutoSave.lastSavedAt} />
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Charts */}
      {hasData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-sm">Annual Financial Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "75%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Current Year" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}><LabelList dataKey="Current Year" position="top" style={{ fontSize: 9 }} formatter={(v: number) => { const abs = Math.abs(v); const formatted = abs >= 1000000 ? `$${(abs/1000000).toFixed(1)}M` : abs >= 1000 ? `$${(abs/1000).toFixed(0)}K` : `$${abs}`; return v < 0 ? `-${formatted}` : formatted; }} /></Bar>
                  <Bar dataKey="Previous Year" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]}><LabelList dataKey="Previous Year" position="top" style={{ fontSize: 9 }} formatter={(v: number) => { const abs = Math.abs(v); const formatted = abs >= 1000000 ? `$${(abs/1000000).toFixed(1)}M` : abs >= 1000 ? `$${(abs/1000).toFixed(0)}K` : `$${abs}`; return v < 0 ? `-${formatted}` : formatted; }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-sm">Annual Cost of Goods Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: "75%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cogChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Current Year" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]}><LabelList dataKey="Current Year" position="top" style={{ fontSize: 9 }} formatter={(v: number) => `${v.toFixed(2)}%`} /></Bar>
                  <Bar dataKey="Previous Year" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]}><LabelList dataKey="Previous Year" position="top" style={{ fontSize: 9 }} formatter={(v: number) => `${v.toFixed(2)}%`} /></Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
