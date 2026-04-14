import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, History, ArrowRight } from "lucide-react";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";

interface Props {
  entityType?: string;
  onRecordTransaction: () => void;
  onAddHistorical: () => void;
}

export default function ShareholderWorkflowCards({ entityType = "Corporation", onRecordTransaction, onAddHistorical }: Props) {
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  const holderLabel = term.shareholder.toLowerCase();
  const holderTableLabel = isLLC ? "Members table" : "Shareholders table";
  const historyTitle = isLLC ? "Build Full Interest Ledger History" : "Build Full Transfer Ledger History";

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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card
          className="cursor-pointer border-primary/25 bg-primary/5 transition-colors hover:border-primary/45"
          onClick={onRecordTransaction}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground">
                <Plus className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  Ongoing work
                </Badge>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Record Transaction</h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Primary action when the ledger already exists and you are recording new activity going forward.
                  </p>
                </div>

                <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  <li>• Enter one new issuance, transfer, gift, redemption, or similar event at a time.</li>
                  <li>• Date defaults to today and uses existing {holderLabel}s already on file.</li>
                  <li>
                    • Each entry updates the ledger row, certificate status, Balance Held, and the {holderTableLabel}.
                  </li>
                </ul>

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-primary"
                >
                  Record transaction <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer border-accent bg-accent/30 transition-colors hover:border-accent/80"
          onClick={onAddHistorical}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-lg bg-accent p-2 text-accent-foreground">
                <History className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Full history rebuild
                </Badge>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{historyTitle}</h3>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Use this for a client managed from the beginning, or any client where a complete, accurate chronological ledger is needed.
                  </p>
                </div>

                <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                  <li>
                    • Enter every original issuance, transfer, gift, and redemption one by one in true date order.
                  </li>
                  <li>
                    • Can create new {holderLabel}s on the fly and requires the actual historical date for each entry.
                  </li>
                  <li>
                    • Balance Held shows the running balance for that specific {isLLC ? "holder" : "certificate holder"} after each transaction — when {isLLC ? "units" : "shares"} leave that holder, the balance goes to 0.
                  </li>
                </ul>

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-foreground"
                >
                  Add historical entry <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
