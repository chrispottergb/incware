import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  company: any;
  /** Called when the user clicks "Regenerate". Should switch to and scroll the OA section into view. */
  onRegenerate: () => void;
}

/**
 * Shown at the top of the Operating Agreement tab when a Single Member LLC has an
 * active S-election but the current OA on file predates it or was generated from
 * the non-S-corp template.
 */
export default function SCorpOAWarningBanner({ company, onRegenerate }: Props) {
  const isSMLLC = company?.entity_type === "Single Member LLC";
  const sElectionDate = company?.s_election_date || null;
  const enabled = !!(isSMLLC && sElectionDate && company?.id);

  const { data: latest, isLoading } = useQuery({
    queryKey: ["scorp-oa-check", company?.id, sElectionDate],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_registry")
        .select("id, document_type, status, created_at")
        .eq("company_id", company.id)
        .in("document_type", [
          "Sole Member Operating Agreement",
          "Operating Agreement (S-Corp Election)",
        ])
        .neq("status", "superseded")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    },
  });

  if (!enabled || isLoading) return null;

  const isMissing = !latest;
  const isWrongTemplate =
    !!latest && latest.document_type !== "Operating Agreement (S-Corp Election)";
  const isStale =
    !!latest &&
    latest.document_type === "Operating Agreement (S-Corp Election)" &&
    new Date(latest.created_at) < new Date(`${sElectionDate}T00:00:00`);

  if (!isMissing && !isWrongTemplate && !isStale) return null;

  return (
    <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm text-amber-900 dark:text-amber-200">
            This entity's Operating Agreement may not reflect its S-corp election.
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-800/90 dark:text-amber-100/80 mt-1">
            {isMissing
              ? "No Operating Agreement is on file. Generate an S-corp-compliant version now."
              : isWrongTemplate
              ? "The current Operating Agreement uses the default single-member template. Regenerate it to include the S-corp tax treatment, reasonable-compensation, transfer-restriction, and single-class-of-stock provisions."
              : "The current S-corp Operating Agreement predates this entity's S-election effective date. Regenerate to align."}
          </AlertDescription>
        </div>
        <Button size="sm" onClick={onRegenerate} className="shrink-0">
          Regenerate now
        </Button>
      </div>
    </Alert>
  );
}
