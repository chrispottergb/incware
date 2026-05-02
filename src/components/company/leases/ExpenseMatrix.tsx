import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEASE_STRUCTURE_LABELS, EXPENSE_PARTY_LABELS } from "@/lib/lease-risk";

interface Props {
  structure: string;
  taxes: string;
  insurance: string;
  maintenance: string;
  percentageRentPct?: string;
  percentageRentBasis?: string;
  fullServiceInclusions?: string;
  onChange: (
    patch: Partial<{
      structure: string;
      taxes: string;
      insurance: string;
      maintenance: string;
      percentageRentPct: string;
      percentageRentBasis: string;
      fullServiceInclusions: string;
    }>,
  ) => void;
}

export function ExpenseMatrix({
  structure,
  taxes,
  insurance,
  maintenance,
  percentageRentPct,
  percentageRentBasis,
  fullServiceInclusions,
  onChange,
}: Props) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Lease Structure & Expense Responsibility
      </p>
      <div className="field-group">
        <Label className="field-label">Lease Structure</Label>
        <Select value={structure} onValueChange={(v) => onChange({ structure: v })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(LEASE_STRUCTURE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground mt-1">
          Default is Modified Gross — landlord covers taxes/insurance, tenant covers utilities/interior maintenance.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          ["taxes", "Property Taxes", taxes],
          ["insurance", "Insurance", insurance],
          ["maintenance", "Maintenance", maintenance],
        ] as const).map(([key, label, val]) => (
          <div key={key} className="field-group">
            <Label className="field-label text-[11px]">{label}</Label>
            <Select value={val} onValueChange={(v) => onChange({ [key]: v } as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(EXPENSE_PARTY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {structure === "percentage" && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="field-group">
            <Label className="field-label text-[11px]">Percentage Rent (%)</Label>
            <Input
              type="number"
              step="0.01"
              className="h-8 text-xs"
              value={percentageRentPct || ""}
              onChange={(e) => onChange({ percentageRentPct: e.target.value })}
              placeholder="e.g. 6.0"
            />
          </div>
          <div className="field-group col-span-2">
            <Label className="field-label text-[11px]">Basis</Label>
            <Input
              className="h-8 text-xs"
              value={percentageRentBasis || ""}
              onChange={(e) => onChange({ percentageRentBasis: e.target.value })}
              placeholder="e.g. gross sales over $250,000 annually"
            />
          </div>
        </div>
      )}

      {structure === "full_service" && (
        <div className="pt-2 border-t border-border field-group">
          <Label className="field-label text-[11px]">Included Services</Label>
          <Textarea
            className="text-xs min-h-[60px]"
            value={fullServiceInclusions || ""}
            onChange={(e) => onChange({ fullServiceInclusions: e.target.value })}
            placeholder="electricity, water, gas, HVAC, janitorial, common-area maintenance, security, trash removal"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            List all services included in the base rent. Comma-separated.
          </p>
        </div>
      )}
    </div>
  );
}
