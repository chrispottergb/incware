import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, TrendingUp, Lock, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  meetingId: string;
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

  // Fetch the meeting to find its company_id
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

  // Fetch the most recent prior meeting with current year financial data
  const { data: priorMeetingFinancials } = useQuery({
    queryKey: ["prior_meeting_financials_for_autofill", meeting?.company_id, meetingId],
    queryFn: async () => {
      // Find the most recent meeting before this one that has financials with current year data
      const { data: priorMeetings } = await supabase
        .from("meetings")
        .select("id, meeting_date")
        .eq("company_id", meeting!.company_id)
        .neq("id", meetingId)
        .order("meeting_date", { ascending: false })
        .limit(10);

      if (!priorMeetings?.length) return null;

      for (const pm of priorMeetings) {
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
  });

  // Determine if previous year fields were auto-populated
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

  // Previous year fields are locked when they have data (either saved or auto-filled)
  const previousYearLocked = hasSavedPreviousData || isAutoFilled;

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

  const [lastFinancials, setLastFinancials] = useState<typeof financials>(undefined);
  const [autoFillApplied, setAutoFillApplied] = useState(false);

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

  // Auto-fill previous year from prior meeting when no saved previous data exists
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
    if (prefix === "previous" && previousYearLocked) return;
    setForm((prev) => {
      const updated = { ...prev, [`${prefix}_${key}`]: value };

      const sales = toNum(key === "total_sales" ? value : updated[`${prefix}_total_sales`]);
      const cog = toNum(key === "cog" ? value : updated[`${prefix}_cog`]);

      if (sales != null && cog != null) {
        updated[`${prefix}_gross_profit`] = (sales - cog).toFixed(2);
        updated[`${prefix}_cog_ratio`] = sales > 0 ? ((cog / sales) * 100).toFixed(2) : "0";
      }

      return updated;
    });
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_financials", meetingId] });
      toast.success("Financial data saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Chart data
  const chartData = [
    {
      name: "Total Sales",
      "Current Year": toNum(form.current_total_sales) ?? 0,
      "Previous Year": toNum(form.previous_total_sales) ?? 0,
    },
    {
      name: "Gross Profit",
      "Current Year": toNum(form.current_gross_profit) ?? 0,
      "Previous Year": toNum(form.previous_gross_profit) ?? 0,
    },
    {
      name: "COG",
      "Current Year": toNum(form.current_cog) ?? 0,
      "Previous Year": toNum(form.previous_cog) ?? 0,
    },
    {
      name: "Net Income",
      "Current Year": toNum(form.current_net_income) ?? 0,
      "Previous Year": toNum(form.previous_net_income) ?? 0,
    },
  ];

  const cogChartData = [
    {
      name: "COG Ratio",
      "Current Year": toNum(form.current_cog_ratio) ?? 0,
      "Previous Year": toNum(form.previous_cog_ratio) ?? 0,
    },
  ];

  const hasData = chartData.some((d) => d["Current Year"] > 0 || d["Previous Year"] > 0);

  const yoyChange = (currentKey: string, previousKey: string) => {
    const cur = toNum((form as any)[currentKey]);
    const prev = toNum((form as any)[previousKey]);
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  };

  const fields: { key: string; label: string; computed?: boolean }[] = [
    { key: "total_sales", label: "Total Sales" },
    { key: "cog", label: "Cost of Goods" },
    { key: "gross_profit", label: "Gross Profit", computed: true },
    { key: "cog_ratio", label: "COG Ratio (%)", computed: true },
    { key: "net_income", label: "Net Income" },
  ];

  const noPriorData = !priorMeetingFinancials?.financials && !hasSavedPreviousData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Financial Comparison</CardTitle>
            </div>
            {previousYearLocked && sourceLabel && (
              <Badge variant="secondary" className="text-[10px] font-normal gap-1">
                <Info className="h-3 w-3" />
                {sourceLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-4">
              <div></div>
              <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Current Year</p>
              <div className="flex items-center justify-center gap-1">
                <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Previous Year</p>
                {previousYearLocked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
              <p className="w-16 text-xs font-semibold text-right text-muted-foreground uppercase tracking-wider">YoY</p>
            </div>
            {fields.map((f) => {
              const change = yoyChange(`current_${f.key}`, `previous_${f.key}`);
              const prevValue = (form as any)[`previous_${f.key}`];
              const isPrevLocked = previousYearLocked || f.computed;
              return (
                <div key={f.key} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-4 mb-3 items-center">
                  <Label className="text-sm">{f.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(form as any)[`current_${f.key}`]}
                    onChange={(e) => handleFieldChange("current", f.key, e.target.value)}
                    readOnly={f.computed}
                    className={`text-right font-mono text-sm ${f.computed ? "bg-muted/50 text-muted-foreground" : ""}`}
                  />
                  {noPriorData && !prevValue ? (
                    <div className="text-xs text-muted-foreground italic text-center py-2">
                      No previous data available
                    </div>
                  ) : (
                    <Input
                      type="number"
                      step="0.01"
                      value={prevValue}
                      onChange={(e) => handleFieldChange("previous", f.key, e.target.value)}
                      readOnly={isPrevLocked}
                      tabIndex={isPrevLocked ? -1 : undefined}
                      className={`text-right font-mono text-sm ${
                        isPrevLocked
                          ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                          : ""
                      }`}
                    />
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
            <div className="flex justify-end mt-4">
              <Button type="submit" disabled={save.isPending} size="sm">
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Financials
              </Button>
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
              <ResponsiveContainer width="100%" height={280}>
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
                  <Bar dataKey="Current Year" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Previous Year" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-sm">Annual Cost of Goods Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
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
                  <Bar dataKey="Current Year" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Previous Year" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
