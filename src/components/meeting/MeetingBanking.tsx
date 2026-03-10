import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Landmark } from "lucide-react";
import { toast } from "sonner";

interface Props {
  meetingId: string;
}

export default function MeetingBanking({ meetingId }: Props) {
  const queryClient = useQueryClient();

  const { data: counselRows = [], isLoading } = useQuery({
    queryKey: ["meeting_counsel", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_counsel" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const row = counselRows[0] || null;

  const [bankName, setBankName] = useState("");
  const [locEnabled, setLocEnabled] = useState(false);
  const [locAmount, setLocAmount] = useState("");
  const [locRate, setLocRate] = useState("");

  useEffect(() => {
    if (row) {
      setBankName(row.bank_name || "");
      setLocEnabled(row.loc_enabled || false);
      setLocAmount(row.loc_amount != null ? String(row.loc_amount) : "");
      setLocRate(row.loc_interest_rate != null ? String(row.loc_interest_rate) : "");
    }
  }, [row]);

  const upsert = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      if (row?.id) {
        const { error } = await supabase
          .from("meeting_counsel" as any)
          .update(updates)
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("meeting_counsel" as any)
          .insert({ meeting_id: meetingId, ...updates } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_counsel", meetingId] });
    },
    onError: () => toast.error("Failed to save banking info"),
  });

  const handleBlur = (field: string, value: any) => {
    upsert.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4" /> Banking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6">
            <Label className="text-xs font-medium text-muted-foreground">Bank Name</Label>
            <Input
              className="h-7 text-sm"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              onBlur={() => handleBlur("bank_name", bankName || null)}
              placeholder="Enter bank name"
            />
          </div>
          <div className="col-span-6 flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={locEnabled}
                onCheckedChange={(checked) => {
                  setLocEnabled(checked);
                  const updates: any = { loc_enabled: checked };
                  if (!checked) {
                    updates.loc_amount = null;
                    updates.loc_interest_rate = null;
                    setLocAmount("");
                    setLocRate("");
                  }
                  upsert.mutate(updates);
                }}
              />
              <Label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Line of Credit (LOC)</Label>
            </div>
          </div>
        </div>

        {locEnabled && (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <Label className="text-xs font-medium text-muted-foreground">LOC Amount</Label>
              <Input
                className="h-7 text-sm"
                type="number"
                step="0.01"
                min="0"
                value={locAmount}
                onChange={(e) => setLocAmount(e.target.value)}
                onBlur={() => handleBlur("loc_amount", locAmount ? parseFloat(locAmount) : null)}
                placeholder="$0.00"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs font-medium text-muted-foreground">Interest Rate (%)</Label>
              <Input
                className="h-7 text-sm"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={locRate}
                onChange={(e) => setLocRate(e.target.value)}
                onBlur={() => handleBlur("loc_interest_rate", locRate ? parseFloat(locRate) : null)}
                placeholder="0.00%"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
