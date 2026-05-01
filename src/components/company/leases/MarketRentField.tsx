import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  justified: boolean;
  note: string;
  onJustifiedChange: (v: boolean) => void;
  onNoteChange: (v: string) => void;
  required?: boolean;
}

export function MarketRentField({ justified, note, onJustifiedChange, onNoteChange, required }: Props) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
      <div className="flex items-start gap-2">
        <Checkbox
          id="market-rent-justified"
          checked={justified}
          onCheckedChange={(v) => onJustifiedChange(!!v)}
        />
        <div className="flex-1">
          <Label htmlFor="market-rent-justified" className="text-xs font-semibold cursor-pointer">
            Market Rent Justification Provided
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <p className="text-[10px] text-muted-foreground">
            Confirm that the rent reflects market rates (comps, appraisal, or broker opinion on file).
          </p>
        </div>
      </div>
      <div className="field-group">
        <Label className="field-label text-[11px]">Supporting Note (optional)</Label>
        <Textarea
          className="text-sm min-h-[60px]"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="e.g. Based on 3 comparable commercial leases in the area averaging $X/sqft."
        />
      </div>
    </div>
  );
}
