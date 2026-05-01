import { Info, AlertTriangle, Building2, User, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLASSIFICATION_LABELS, type LeaseClassification } from "@/lib/lease-classification";
import { Button } from "@/components/ui/button";

interface Props {
  classification: LeaseClassification;
  reason: string;
  overridden: boolean;
  onOverride: (next: LeaseClassification | null) => void;
}

const STYLE: Record<LeaseClassification, { bg: string; icon: any }> = {
  standard: { bg: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400", icon: Shield },
  related_party: { bg: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400", icon: AlertTriangle },
  self_rental: { bg: "bg-purple-500/10 text-purple-700 border-purple-500/30 dark:text-purple-400", icon: User },
  intercompany: { bg: "bg-sky-500/10 text-sky-700 border-sky-500/30 dark:text-sky-400", icon: Building2 },
};

export function ClassificationBanner({ classification, reason, overridden, onOverride }: Props) {
  const s = STYLE[classification];
  const Icon = s.icon;
  return (
    <div className={`rounded-md border px-3 py-2 ${s.bg}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-semibold truncate">
            Detected: {CLASSIFICATION_LABELS[classification]}
            {overridden && <span className="ml-1 opacity-70">(overridden)</span>}
          </span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                <Info className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs" side="bottom">
              <p className="font-semibold mb-1">Why this classification?</p>
              <p className="text-muted-foreground">{reason}</p>
            </PopoverContent>
          </Popover>
        </div>
        <Select
          value={overridden ? classification : "__auto"}
          onValueChange={(v) => onOverride(v === "__auto" ? null : (v as LeaseClassification))}
        >
          <SelectTrigger className="h-6 w-32 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto">Auto-detect</SelectItem>
            {(Object.keys(CLASSIFICATION_LABELS) as LeaseClassification[]).map((k) => (
              <SelectItem key={k} value={k}>{CLASSIFICATION_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
