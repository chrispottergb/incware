import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, TrendingUp } from "lucide-react";
import { toast } from "sonner";
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

  const toNum = (s: string) => (s ? parseFloat(s) : null);

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

  const fields = [
    { key: "total_sales", label: "Total Sales" },
    { key: "gross_profit", label: "Gross Profit" },
    { key: "cog", label: "COG" },
    { key: "cog_ratio", label: "COG Ratio (%)" },
    { key: "net_income", label: "Net Income" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Financial Comparison</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div></div>
              <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Current Year</p>
              <p className="text-xs font-semibold text-center text-muted-foreground uppercase tracking-wider">Previous Year</p>
            </div>
            {fields.map((f) => (
              <div key={f.key} className="grid grid-cols-3 gap-4 mb-3 items-center">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={(form as any)[`current_${f.key}`]}
                  onChange={(e) => setForm((p) => ({ ...p, [`current_${f.key}`]: e.target.value }))}
                  className="text-right font-mono text-sm"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={(form as any)[`previous_${f.key}`]}
                  onChange={(e) => setForm((p) => ({ ...p, [`previous_${f.key}`]: e.target.value }))}
                  className="text-right font-mono text-sm"
                />
              </div>
            ))}
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
