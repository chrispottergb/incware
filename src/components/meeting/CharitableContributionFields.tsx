import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const CHARITABLE_RESOLUTION_LABEL = "Approve Charitable Contributions";
export const DEFAULT_ORGANIZATION_NAME = "a qualified charitable organization(s)";

export const TAX_TREATMENT_NOTE =
  "Tax Treatment Note: The contributions were recorded as expenses for financial reporting purposes. They were not deducted on the federal income tax return and were reflected on Schedule M-1 as expenses recorded on books but not deducted on the return.";

export type TaxTreatment = "deductible" | "nondeductible" | "";

export interface CharitableState {
  taxYear: string;
  amount: string;
  organizationName: string;
  taxTreatment: TaxTreatment;
}

export function initialCharitableState(meetingDate?: string): CharitableState {
  const year = meetingDate
    ? new Date(meetingDate).getFullYear().toString()
    : new Date().getFullYear().toString();
  return {
    taxYear: year,
    amount: "",
    organizationName: DEFAULT_ORGANIZATION_NAME,
    taxTreatment: "",
  };
}

/** Fills the template placeholders and appends the Schedule M-1 note when applicable. */
export function composeCharitableText(template: string, s: CharitableState): string {
  let text = template
    .replace(/\[TaxYear\]/g, s.taxYear || "[TaxYear]")
    .replace(/\[Amount\]/g, s.amount || "[Amount]")
    .replace(/\[OrganizationName\]/g, s.organizationName || DEFAULT_ORGANIZATION_NAME);
  if (s.taxTreatment === "nondeductible") {
    text = `${text}\n\n${TAX_TREATMENT_NOTE}`;
  }
  return text;
}

/** Validates the current values at submit time. Returns field -> message. */
export function validateCharitable(s: CharitableState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!s.taxYear.trim()) errors.taxYear = "Tax year is required.";
  if (!s.amount.trim()) errors.amount = "Amount is required.";
  if (!s.taxTreatment) errors.taxTreatment = "Please select a tax treatment.";
  if (
    s.taxTreatment === "deductible" &&
    s.organizationName.trim() === DEFAULT_ORGANIZATION_NAME
  ) {
    errors.organizationName =
      "Please enter the name of the qualified charitable organization(s).";
  }
  return errors;
}

interface Props {
  value: CharitableState;
  onChange: (next: CharitableState) => void;
  errors: Record<string, string>;
}

export default function CharitableContributionFields({ value, onChange, errors }: Props) {
  const set = (patch: Partial<CharitableState>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="charitable-tax-year">Tax Year *</Label>
          <Input
            id="charitable-tax-year"
            value={value.taxYear}
            onChange={(e) => set({ taxYear: e.target.value })}
            placeholder="2025"
          />
          {errors.taxYear && (
            <p className="text-sm text-destructive">{errors.taxYear}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="charitable-amount">Amount *</Label>
          <Input
            id="charitable-amount"
            inputMode="decimal"
            value={value.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="5,000.00"
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="charitable-org">Organization Name *</Label>
        <Input
          id="charitable-org"
          value={value.organizationName}
          onChange={(e) => set({ organizationName: e.target.value })}
          placeholder={DEFAULT_ORGANIZATION_NAME}
        />
        <p className="text-xs text-muted-foreground">
          For multiple organizations, enter a comma-separated list (e.g., "Red Cross, United Way").
        </p>
        {errors.organizationName && (
          <p className="text-sm text-destructive">{errors.organizationName}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Tax Treatment *</Label>
        <RadioGroup
          value={value.taxTreatment}
          onValueChange={(v) => set({ taxTreatment: v as TaxTreatment })}
          className="space-y-2"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="deductible" id="tt-deductible" className="mt-1" />
            <div>
              <Label htmlFor="tt-deductible" className="font-normal">
                Deductible charitable contribution
              </Label>
              <p className="text-xs text-muted-foreground">
                The organization was a qualified charity and the corporation claimed the deduction.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="nondeductible" id="tt-nondeductible" className="mt-1" />
            <div>
              <Label htmlFor="tt-nondeductible" className="font-normal">
                Not deductible / book expense only
              </Label>
              <p className="text-xs text-muted-foreground">
                The contribution was recorded as an expense but not deducted (includes
                contributions to unqualified organizations).
              </p>
            </div>
          </div>
        </RadioGroup>
        {errors.taxTreatment && (
          <p className="text-sm text-destructive">{errors.taxTreatment}</p>
        )}
      </div>
    </div>
  );
}
