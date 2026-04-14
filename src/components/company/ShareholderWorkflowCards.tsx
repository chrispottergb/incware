import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Record a New Transaction */}
      <Card className="border-primary/20 bg-primary/[0.03] hover:border-primary/40 transition-colors cursor-pointer group" onClick={onRecordTransaction}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Record New Transaction
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Record a current {isLLC ? "interest" : "share"} transaction — issuance, transfer, redemption, etc. Date defaults to today.
                Requires an existing {term.shareholder.toLowerCase()} on file.
              </p>
              <Button variant="link" size="sm" className="h-auto p-0 mt-1.5 text-xs text-primary gap-1 group-hover:gap-2 transition-all">
                Open form <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Historical Transaction */}
      <Card className="border-indigo-500/20 bg-indigo-500/[0.03] hover:border-indigo-500/40 transition-colors cursor-pointer group" onClick={onAddHistorical}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-indigo-500/10 p-2 shrink-0">
              <History className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Add Historical Transaction
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Back-date a past {isLLC ? "interest" : "share"} event to build ownership history.
                Can create new {term.shareholder.toLowerCase()}s on the fly. You must enter the date.
              </p>
              <Button variant="link" size="sm" className="h-auto p-0 mt-1.5 text-xs text-indigo-500 gap-1 group-hover:gap-2 transition-all">
                Open form <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
