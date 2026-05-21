import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { toast } from "sonner";

const NP_PREFIX = "__np_director__:";

export const NP_DIRECTOR_BENEFIT_PREFIX = NP_PREFIX;

type Option = { label: string; description: string };

const OPTIONS: Option[] = [
  {
    label: "Reimbursement of Expenses",
    description: "Travel, lodging, meals, and mileage for board service. Must be documented and tied to nonprofit business. Not considered compensation when reimbursed at actual cost.",
  },
  {
    label: "Insurance",
    description: "Directors & Officers (D&O) liability insurance, general liability coverage, and health insurance if directors are also employees.",
  },
  {
    label: "Modest Stipends or Honoraria",
    description: "Permitted if reasonable and approved by disinterested directors. Must be reported on Form 990.",
  },
  {
    label: "Indemnification",
    description: "Allowed under state nonprofit statutes. Typically included in bylaws.",
  },
  {
    label: "Compensation for Separate Services",
    description: "If a director also performs non-board work, they may be paid fair market value for those services only with a conflict-of-interest process, recusal from voting, and documentation of comparability data.",
  },
];

interface Props {
  meetingId: string;
}

export default function NonProfitDirectorBenefits({ meetingId }: Props) {
  const queryClient = useQueryClient();

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_benefits_np_director", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_benefits" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return ((data as any[]) || []).filter((r) =>
        (r.benefit_type || "").startsWith(NP_PREFIX)
      );
    },
  });

  const byOption = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of rows) {
      const opt = (r.benefit_type || "").slice(NP_PREFIX.length);
      map[opt] = r;
    }
    return map;
  }, [rows]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["meeting_benefits_np_director", meetingId] });
    queryClient.invalidateQueries({ queryKey: ["meeting_benefits", meetingId] });
  };

  const addOption = useMutation({
    mutationFn: async (label: string) => {
      const benefit_type = `${NP_PREFIX}${label}`;
      const { error } = await supabase.from("meeting_benefits" as any).insert({
        meeting_id: meetingId,
        benefit_type,
        benefit_description: benefit_type,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOption = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("meeting_benefits" as any).delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRow = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase
        .from("meeting_benefits" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (label: string, checked: boolean) => {
    const existing = byOption[label];
    if (checked && !existing) addOption.mutate(label);
    if (!checked && existing) removeOption.mutate(existing.id);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">Director Benefits & Compensation</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Benefits and compensation must be reasonable, documented, and approved by disinterested directors. Reportable items must be disclosed on Form 990.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          {OPTIONS.map((opt) => {
            const checked = !!byOption[opt.label];
            const id = `np-dir-bf-${opt.label}`;
            return (
              <div key={opt.label} className="flex items-start gap-2 rounded-sm px-2 py-1.5 hover:bg-accent/40 transition-colors">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(c) => toggle(opt.label, !!c)}
                  className="mt-0.5"
                />
                <Label htmlFor={id} className="flex-1 cursor-pointer text-sm font-normal">
                  <span className="font-medium">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{opt.description}</span>
                </Label>
              </div>
            );
          })}
        </div>

        {OPTIONS.filter((o) => byOption[o.label]).map((opt) => {
          const row = byOption[opt.label];
          return (
            <div key={opt.label} className="rounded-md border border-border p-3 space-y-3 bg-background">
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Date Approved</Label>
                  <DatePickerField
                    value={row.new_plan_effective_date || ""}
                    onChange={(v) =>
                      updateRow.mutate({ id: row.id, patch: { new_plan_effective_date: v || null } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Approved By</Label>
                  <Input
                    defaultValue={row.provider || ""}
                    onBlur={(e) =>
                      updateRow.mutate({ id: row.id, patch: { provider: e.target.value || null } })
                    }
                    placeholder="e.g., Board of Directors"
                    className="bg-background"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Notes / Details</Label>
                <Textarea
                  defaultValue={row.eligibility_comments || ""}
                  onBlur={(e) =>
                    updateRow.mutate({ id: row.id, patch: { eligibility_comments: e.target.value || null } })
                  }
                  rows={3}
                  className="bg-background"
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
