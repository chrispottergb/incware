import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { toast } from "sonner";

export interface ConsentSignatureRow {
  id: string;
  signer_name: string;
  signer_role: string | null;
  signer_title: string | null;
  representative_name: string | null;
  representative_title: string | null;
  signed_on: string | null;
  sort_order: number;
}

interface Props {
  signatures: ConsentSignatureRow[];
  onChanged: () => void;
}

/**
 * Records the date each signer actually signed a written consent. The parent
 * meeting's executed_date is derived by a database trigger (MAX(signed_on) once
 * every signer has a date), so it is never edited here.
 */
export default function ConsentSignatureList({ signatures, onChanged }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!signatures || signatures.length === 0) return null;

  const updateSignedOn = async (row: ConsentSignatureRow, value: string) => {
    setSavingId(row.id);
    try {
      const { error } = await supabase
        .from("meeting_signatures")
        .update({ signed_on: value ? value : null })
        .eq("id", row.id);
      if (error) throw error;
      onChanged();
    } catch (err: any) {
      console.error("Failed to update signature date:", err);
      toast.error("Could not save the signature date.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">Signatures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {signatures.map((row) => (
          <div key={row.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{row.signer_name}</p>
              <p className="text-[10px] text-muted-foreground">
                {[row.signer_role, row.signer_title].filter(Boolean).join(" & ") || "—"}
                {row.representative_name ? ` · rep. by ${row.representative_name}` : ""}
              </p>
            </div>
            <div className="w-[210px] shrink-0">
              <DatePickerField
                value={row.signed_on || ""}
                onChange={(v) => updateSignedOn(row, v || "")}
                placeholder="leave blank until signed"
                disabled={savingId === row.id}
              />
            </div>
            <Badge variant={row.signed_on ? "default" : "secondary"} className="text-[10px] shrink-0">
              {row.signed_on ? "Signed" : "Pending"}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
