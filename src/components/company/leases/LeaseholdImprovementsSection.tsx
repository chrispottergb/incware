import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/currency-format";

interface Props {
  status: "" | "yes" | "no";
  amount: string;
  description: string;
  leaseStructure: string;
  sectionOpen: boolean;
  focused: Set<string>;
  onFocus: (key: string) => void;
  onBlur: (key: string) => void;
  onOpen: () => void;
  onStatusChange: (v: "yes" | "no") => void;
  onAmountChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
}

/**
 * Conditional "Leasehold Improvements" reporting block.
 *
 * - Auto-expands whenever `leaseStructure === "triple_net"`.
 * - For other lease types, hidden behind an "add improvements reporting" link
 *   until the user opts in via `onOpen()`.
 * - Tri-state: user must explicitly answer Yes or No — an unanswered lease
 *   ("") is preserved as null in the database so the annual-review summary
 *   can distinguish "not yet answered" from an affirmative "No".
 */
export function LeaseholdImprovementsSection({
  status,
  amount,
  description,
  leaseStructure,
  sectionOpen,
  focused,
  onFocus,
  onBlur,
  onOpen,
  onStatusChange,
  onAmountChange,
  onDescriptionChange,
}: Props) {
  const forcedOpen = leaseStructure === "triple_net";
  const visible = forcedOpen || sectionOpen;

  if (!visible) {
    return (
      <div className="pt-1">
        <button
          type="button"
          onClick={onOpen}
          className="text-xs text-primary underline underline-offset-2 hover:no-underline"
        >
          + add improvements reporting
        </button>
      </div>
    );
  }

  return (
    <fieldset className="space-y-2.5 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Leasehold Improvements
        {forcedOpen && (
          <span className="ml-1 normal-case font-normal text-[10px] text-muted-foreground">
            (required for Triple Net)
          </span>
        )}
      </legend>

      <div className="space-y-1.5">
        <Label className="field-label">
          Is your company paying for improvements to this space?
        </Label>
        <RadioGroup
          value={status || ""}
          onValueChange={(v) => onStatusChange(v as "yes" | "no")}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="leasehold-yes" />
            <Label htmlFor="leasehold-yes" className="text-sm font-normal cursor-pointer">Yes</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="leasehold-no" />
            <Label htmlFor="leasehold-no" className="text-sm font-normal cursor-pointer">No</Label>
          </div>
        </RadioGroup>
      </div>

      {status === "yes" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="field-group">
            <Label className="field-label">Amount ($) *</Label>
            <Input
              type="text"
              inputMode="decimal"
              className="h-8 text-sm"
              value={focused.has("leasehold_improvement_amount") ? amount : formatCurrencyDisplay(amount)}
              onFocus={() => onFocus("leasehold_improvement_amount")}
              onBlur={() => onBlur("leasehold_improvement_amount")}
              onChange={(e) => onAmountChange(sanitizeCurrencyInput(e.target.value))}
              placeholder="$0.00"
            />
          </div>
          <div className="field-group">
            <Label className="field-label">Description *</Label>
            <Input
              className="h-8 text-sm"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="e.g. Office buildout"
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
