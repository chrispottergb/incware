import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowRight, Clipboard } from "lucide-react";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";

interface Props {
  entityType?: string;
  onRecordTransaction: () => void;
  onEstablishOwnership: () => void;
}

export default function ShareholderWorkflowCards({
  entityType = "Corporation",
  onRecordTransaction,
  onEstablishOwnership,
}: Props) {
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);

  return (
    <section className="space-y-3" aria-label="Ownership entry workflows">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">
          Choose how you want to enter ownership history
        </h2>
        <p className="text-xs text-muted-foreground">
          These workflows serve different situations, even though both update the same ledgers and ownership records.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card
          className="cursor-pointer border-border bg-card transition-colors hover:border-primary/40"
          onClick={onRecordTransaction}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg border border-border bg-muted/40 p-2 text-foreground">
                <Plus className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Record entry
                </Badge>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Record a Transaction</h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Log an issuance, transfer, gift, or redemption. Date defaults to today — choose a past date to backdate it.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-foreground"
                >
                  Record transaction <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-border bg-card transition-colors hover:border-primary/40"
          onClick={onEstablishOwnership}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg border border-border bg-muted/40 p-2 text-foreground">
                <Clipboard className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Snapshot / New client pickup
                </Badge>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Establish Current Ownership</h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Set ownership as of a date without entering the full history that led there. Locks the ledger before that date. Use this when picking up an existing entity mid-stream.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-foreground"
                >
                  Establish ownership <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
