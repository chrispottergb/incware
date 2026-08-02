import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { isLLCType } from "@/lib/entity-terminology";

export const CHARITABLE_RESOLUTION_LABEL = "Approve Charitable Contributions";

/** Fallback recipient wording when the optional Recipient(s) field is left blank. */
export const DEFAULT_DEDUCTIBLE_RECIPIENTS = "a qualified charitable organization(s)";
export const DEFAULT_NONDEDUCTIBLE_RECIPIENTS =
  "one or more recipients as determined by the officers/managers of the entity";

export const TAX_TREATMENT_NOTE =
  "Tax Treatment Note: The contributions were recorded as expenses for financial reporting purposes. They were not deducted as charitable contributions on the federal income tax return and were reflected on Schedule M-1 as expenses recorded on books but not otherwise deducted under Section 170.";

export type TaxTreatment = "deductible" | "nondeductible";

export interface CharitableState {
  taxYear: string;
  amount: string;
  /** Optional. Comma-separated recipient name(s); blank yields a general approval. */
  recipients: string;
  taxTreatment: TaxTreatment;
}

export function initialCharitableState(meetingDate?: string): CharitableState {
  const year = meetingDate
    ? new Date(meetingDate).getFullYear().toString()
    : new Date().getFullYear().toString();
  return {
    taxYear: year,
    amount: "",
    recipients: "",
    taxTreatment: "deductible",
  };
}

export interface ApprovingBody {
  /** e.g. "Shareholders", "Board of Directors", "Members", "Managing Member" */
  label: string;
  /** false → singular verb agreement ("confirms, approves, and ratifies") */
  plural: boolean;
  /** "corporation" | "company" */
  entityNoun: string;
}

/**
 * Resolves the approving body from the meeting/entity type already stored for the
 * meeting. Mirrors the convention used by the meeting PDF exporter
 * (src/lib/meeting-pdf-export.ts governingLabel): shareholder meeting → Shareholders;
 * LLC → Members (Managing Member for a single-member LLC); everything else
 * (annual, organizational, board meetings) → Board of Directors.
 * When no meeting type is given (e.g. Written Consent) the entity type alone decides.
 */
export function resolveApprovingBody(
  entityType?: string,
  meetingType?: string
): ApprovingBody {
  // Normalize so LLC variants that isLLCType() doesn't cover (e.g. "LLC-S",
  // "Single Member LLC-S") still resolve to LLC wording/approving body.
  const normalizedEntity = (entityType || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isLLC = isLLCType(entityType) || /(^|\s)llc(\s|$)/.test(normalizedEntity);
  const isSMLLC = normalizedEntity === "single member llc" || normalizedEntity === "single member llc s";
  const entityNoun = isLLC ? "company" : "corporation";
  const mType = (meetingType || "").toLowerCase();

  if (mType.includes("shareholder")) {
    return { label: "Shareholders", plural: true, entityNoun };
  }
  if (isSMLLC) {
    return { label: "Managing Member", plural: false, entityNoun };
  }
  if (isLLC) {
    // LLC meetings (annual, member, written consent) are approved by the Members.
    return { label: "Members", plural: true, entityNoun };
  }
  if (!mType) {
    // No meeting type (Written Consent) — corporations default to Shareholders.
    return { label: "Shareholders", plural: true, entityNoun };
  }
  return { label: "Board of Directors", plural: true, entityNoun };
}

/** Builds the resolution text from the tax treatment and the resolved approving body. */
export function composeCharitableText(s: CharitableState, body: ApprovingBody): string {
  const taxYear = s.taxYear.trim() || "[TaxYear]";
  const amount = s.amount.trim() || "[Amount]";
  const recipients = s.recipients.trim();
  const verbs = body.plural
    ? "confirm, approve, and ratify"
    : "confirms, approves, and ratifies";
  const noun = body.entityNoun;

  if (s.taxTreatment === "nondeductible") {
    const to = recipients || DEFAULT_NONDEDUCTIBLE_RECIPIENTS;
    return (
      `WHEREAS, during the tax year ending ${taxYear}, the ${noun} made contributions in the aggregate amount of $${amount} to ${to}, ` +
      `which contributions were made for business purposes, including community relations and goodwill benefiting the ${noun}, ` +
      `rather than as charitable contributions to a qualified charitable organization under Section 170(c) of the Internal Revenue Code;` +
      `\n\nRESOLVED, that the ${body.label} hereby ${verbs} the contributions described above as ordinary and necessary business expenditures ` +
      `made in the best interests of the ${noun}, to be treated as deductible business expenses rather than charitable contributions for federal income tax purposes.` +
      `\n\n${TAX_TREATMENT_NOTE}`
    );
  }

  const to = recipients || DEFAULT_DEDUCTIBLE_RECIPIENTS;
  return (
    `WHEREAS, during the tax year ending ${taxYear}, the ${noun} made charitable contributions in the total amount of $${amount} to ${to};` +
    `\n\nRESOLVED, that the ${body.label} hereby ${verbs} the charitable contributions as expenditures made in the best interests of the ${noun}.`
  );
}

/** Validates the current values at submit time. Returns field -> message. */
export function validateCharitable(s: CharitableState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!s.taxYear.trim()) errors.taxYear = "Tax year is required.";
  if (!s.amount.trim()) errors.amount = "Amount is required.";
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
        <Label htmlFor="charitable-recipients">Recipient(s)</Label>
        <Input
          id="charitable-recipients"
          value={value.recipients}
          onChange={(e) => set({ recipients: e.target.value })}
          placeholder="Red Cross, United Way"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for a general approval, or list recipient name(s) comma-separated
          (e.g., "Red Cross, United Way").
        </p>
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
                The contribution was recorded as an expense but not deducted, including
                contributions to unqualified organizations.
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
