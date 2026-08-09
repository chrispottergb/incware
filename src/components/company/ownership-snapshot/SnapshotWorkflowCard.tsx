import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Lock } from "lucide-react";
import OwnershipSnapshotWizard from "@/components/company/ownership-snapshot/OwnershipSnapshotWizard";

interface Props {
  companyId: string;
  entityType?: string;
}

/**
 * Ownership-tab entry point for the guided Opening Ownership Snapshot.
 *
 * Renders ONLY when `companies.ownership_snapshot_enabled` is true for this
 * company. The default onboarding path (Establish Current Ownership → legacy
 * dialog) is untouched; this card is an additional, flag-gated surface.
 */
export default function SnapshotWorkflowCard({ companyId, entityType }: Props) {
  const [open, setOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-snapshot-flag", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("ownership_snapshot_enabled")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId,
  });

  if (!company?.ownership_snapshot_enabled) return null;

  return (
    <>
      <Card
        className="cursor-pointer border-primary/40 bg-card transition-colors hover:border-primary"
        onClick={() => setOpen(true)}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg border border-border bg-muted/40 p-2 text-foreground">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Guided snapshot
              </Badge>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Opening Ownership Snapshot</h3>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Enter each certificate as held at pickup, reconcile against the client's declared total,
                  archive surrendered certificates, then lock the result as a permanent audit record.
                </p>
              </div>
              <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-foreground">
                Open snapshot wizard <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <OwnershipSnapshotWizard
        companyId={companyId}
        entityType={entityType}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
