import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEASE_STRUCTURE_LABELS, EXPENSE_PARTY_LABELS } from "@/lib/lease-risk";

interface Props {
  structure: string;
  taxes: string;
  insurance: string;
  maintenance: string;
  onChange: (patch: Partial<{ structure: string; taxes: string; insurance: string; maintenance: string }>) => void;
}

export function ExpenseMatrix({ structure, taxes, insurance, maintenance, onChange }: Props) {
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
    </div>
  );
}
