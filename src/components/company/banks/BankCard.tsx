import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronRight, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SignerRow from "./SignerRow";

export const formatAccountType = (t: string) =>
  (t || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** A bank account card with its authorized signers nested underneath. */
export default function BankCard({
  bank,
  signers,
  expanded,
  onToggle,
  onEditBank,
  onDeleteBank,
  onAddSigner,
  onEditSigner,
  onDeleteSigner,
}: {
  bank: any;
  signers: any[];
  expanded: boolean;
  onToggle: () => void;
  onEditBank: () => void;
  onDeleteBank: () => void;
  onAddSigner: () => void;
  onEditSigner: (s: any) => void;
  onDeleteSigner: (s: any) => void;
}) {
  const location = [bank.city, bank.state].filter(Boolean).join(", ");

  return (
    <Card className="border border-border bg-card shadow-none p-4">
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={expanded ? `Collapse ${bank.bank_name}` : `Expand ${bank.bank_name}`}
              >
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
              </Button>
            </CollapsibleTrigger>
            <Landmark className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold truncate">{bank.bank_name}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {formatAccountType(bank.account_type || "")}
                </Badge>
                {signers.length === 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 shrink-0 border-destructive/40 text-destructive"
                  >
                    <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                    No signer added
                  </Badge>
                )}
              </div>
              {location && <p className="text-xs text-muted-foreground truncate">{location}</p>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEditBank}
              aria-label={`Edit ${bank.bank_name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={onDeleteBank}
              aria-label={`Delete ${bank.bank_name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <CollapsibleContent>
          <div className="mt-3 ml-3 border-l border-border pl-3">
            <p className="text-xs font-medium text-muted-foreground">Authorized signers</p>
            {signers.length > 0 && (
              <div className="mt-1 divide-y divide-border/60">
                {signers.map((s) => (
                  <SignerRow
                    key={s.id}
                    signer={s}
                    onEdit={() => onEditSigner(s)}
                    onDelete={() => onDeleteSigner(s)}
                  />
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="mt-1 h-7 px-2 text-xs" onClick={onAddSigner}>
              <Plus className="h-3 w-3 mr-1" />
              Add signer to this account
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
