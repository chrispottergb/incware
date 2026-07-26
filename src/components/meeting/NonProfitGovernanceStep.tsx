import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, BookOpen, Eye, FileText, DollarSign, Landmark, Users, Briefcase, Calendar, Plus, Trash2, Info } from "lucide-react";

// -----------------------------------------------------------------------------
// Nonprofit-exclusive data model. These structures never appear on C-Corp,
// S-Corp, or LLC annual meeting flows. Fund-accounting concepts here map to
// FASB net-asset classifications (with/without donor restrictions) and UPMIFA
// endowment rules and have no for-profit equivalent.
// -----------------------------------------------------------------------------

export interface NonProfitFundGroup {
  established: string[];
  establishedNone: boolean;
  donorRestricted: string[];
  donorRestrictedNone: boolean;
  endowment: string[];
  endowmentNone: boolean;
  restrictionsReleased: string[];
  restrictionsReleasedNone: boolean;
  boardDesignated: string[];
  boardDesignatedNone: boolean;
}

export interface NonProfitCompensationRow {
  name: string;
  title: string;
  amount: string;
  comparabilityNotes: string;
}

export interface NonProfitOfficerElection {
  role: string;
  name: string;
}

export interface NonProfitBankSigner {
  name: string;
  title: string;
}

export interface NonProfitGovernanceData {
  // Existing (retained)
  missionStatementReview: string;
  conflictOfInterestConfirmed: boolean;
  publicInspectionConfirmed: boolean;
  programServiceAccomplishments: string;

  // 1. Notice
  noticeType: "given" | "waived";

  // 2. Fund accounting (nonprofit-exclusive)
  funds: NonProfitFundGroup;

  // 3. Treasurer's report
  treasurerFiscalYearCurrent: string;
  treasurerFiscalYearPrior: string;
  treasurerSummary: string;

  // 4. Budget approval
  budgetFiscalYear: string;
  budgetApproved: boolean;

  // 5. Compensation review (structured; never rendered into PDF)
  compensationOfficers: NonProfitCompensationRow[];
  compensationReasonableApproved: boolean;
  compensationInterestedAbstained: boolean;

  // 6. Conflict of interest (extended)
  conflictDisclosures: string[];
  conflictDisclosuresNone: boolean;
  coiPolicyReaffirmed: boolean;

  // 7. Form 990
  form990ReviewedPriorToFiling: boolean;
  form990FiscalYear: string;

  // 8. Outside professionals
  outsideAttorneyName: string;
  outsideAccountantName: string;
  outsideEngagementChanged: boolean;
  outsideChangeDetails: string[];
  outsideChangeDetailsNone: boolean;

  // 9. Banking / signing authority
  bankNames: string[];
  bankCurrentSigners: NonProfitBankSigner[];
  bankPriorAuthorizationsRevoked: boolean;

  // 10. Next meeting
  nextMeetingDate: string;
  nextMeetingLocation: string;

  // 11. Elections
  electedDirectors: string[];
  electedOfficers: NonProfitOfficerElection[];
  chairpersonCombinedWithPresident: boolean;

  // Closing
  otherBusiness: string;
  adjournmentTime: string;
  certificationDate: string;
}

export const defaultNonProfitGovernance: NonProfitGovernanceData = {
  missionStatementReview: "",
  conflictOfInterestConfirmed: false,
  publicInspectionConfirmed: false,
  programServiceAccomplishments: "",
  noticeType: "given",
  funds: {
    established: [],
    establishedNone: true,
    donorRestricted: [],
    donorRestrictedNone: true,
    endowment: [],
    endowmentNone: true,
    restrictionsReleased: [],
    restrictionsReleasedNone: true,
    boardDesignated: [],
    boardDesignatedNone: true,
  },
  treasurerFiscalYearCurrent: "",
  treasurerFiscalYearPrior: "",
  treasurerSummary: "",
  budgetFiscalYear: "",
  budgetApproved: false,
  compensationOfficers: [],
  compensationReasonableApproved: false,
  compensationInterestedAbstained: false,
  conflictDisclosures: [],
  conflictDisclosuresNone: true,
  coiPolicyReaffirmed: false,
  form990ReviewedPriorToFiling: false,
  form990FiscalYear: "",
  outsideAttorneyName: "",
  outsideAccountantName: "",
  outsideEngagementChanged: false,
  outsideChangeDetails: [],
  outsideChangeDetailsNone: true,
  bankNames: [],
  bankCurrentSigners: [],
  bankPriorAuthorizationsRevoked: false,
  nextMeetingDate: "",
  nextMeetingLocation: "",
  electedDirectors: [],
  electedOfficers: [],
  chairpersonCombinedWithPresident: false,
  otherBusiness: "",
  adjournmentTime: "",
  certificationDate: "",
};

interface Props {
  data: NonProfitGovernanceData;
  onChange: (data: NonProfitGovernanceData) => void;
}

// ---- Reusable string-list editor with "None" collapse ----
function StringListField({
  label,
  values,
  none,
  onChangeValues,
  onChangeNone,
  placeholder,
}: {
  label: string;
  values: string[];
  none: boolean;
  onChangeValues: (v: string[]) => void;
  onChangeNone: (n: boolean) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
          <Checkbox
            checked={none}
            onCheckedChange={v => {
              const n = v === true;
              onChangeNone(n);
              if (n) onChangeValues([]);
            }}
          />
          None
        </label>
      </div>
      {!none && (
        <div className="space-y-1.5">
          {values.map((val, i) => (
            <div key={i} className="flex gap-1.5">
              <Input
                className="h-8 text-sm"
                value={val}
                placeholder={placeholder}
                onChange={e => {
                  const next = [...values];
                  next[i] = e.target.value;
                  onChangeValues(next);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() => onChangeValues(values.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onChangeValues([...values, ""])}
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}

export default function NonProfitGovernanceStep({ data, onChange }: Props) {
  const update = <K extends keyof NonProfitGovernanceData>(field: K, value: NonProfitGovernanceData[K]) => {
    onChange({ ...data, [field]: value });
  };
  const updateFunds = (patch: Partial<NonProfitFundGroup>) => {
    onChange({ ...data, funds: { ...data.funds, ...patch } });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Non-Profit Governance</h3>
      <p className="text-xs text-muted-foreground">
        Nonprofit-only sections. These do not apply to C-Corp, S-Corp, or LLC minutes.
      </p>

      {/* Notice of Meeting */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Notice of Meeting</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup
            value={data.noticeType}
            onValueChange={v => update("noticeType", v as "given" | "waived")}
            className="flex flex-col gap-1.5"
          >
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <RadioGroupItem value="given" /> Notice given per bylaws
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <RadioGroupItem value="waived" /> Notice waived in writing
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Mission */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Mission Statement Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            className="text-sm min-h-[70px]"
            value={data.missionStatementReview}
            onChange={e => update("missionStatementReview", e.target.value)}
            placeholder="Confirm or update the organization's primary exempt purpose..."
          />
        </CardContent>
      </Card>

      {/* Fund Accounting */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Fund Accounting</CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1 mt-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            Nonprofit-exclusive. Maps to FASB net-asset classification and UPMIFA endowment rules.
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <StringListField
            label="Funds established during the year"
            values={data.funds.established}
            none={data.funds.establishedNone}
            onChangeValues={v => updateFunds({ established: v })}
            onChangeNone={n => updateFunds({ establishedNone: n })}
            placeholder="Fund name / description"
          />
          <StringListField
            label="Donor-restricted funds received during the year"
            values={data.funds.donorRestricted}
            none={data.funds.donorRestrictedNone}
            onChangeValues={v => updateFunds({ donorRestricted: v })}
            onChangeNone={n => updateFunds({ donorRestrictedNone: n })}
          />
          <StringListField
            label="Endowment funds established or modified during the year"
            values={data.funds.endowment}
            none={data.funds.endowmentNone}
            onChangeValues={v => updateFunds({ endowment: v })}
            onChangeNone={n => updateFunds({ endowmentNone: n })}
          />
          <StringListField
            label="Restrictions satisfied or released during the year"
            values={data.funds.restrictionsReleased}
            none={data.funds.restrictionsReleasedNone}
            onChangeValues={v => updateFunds({ restrictionsReleased: v })}
            onChangeNone={n => updateFunds({ restrictionsReleasedNone: n })}
          />
          <StringListField
            label="Board-designated funds established, modified, or terminated"
            values={data.funds.boardDesignated}
            none={data.funds.boardDesignatedNone}
            onChangeValues={v => updateFunds({ boardDesignated: v })}
            onChangeNone={n => updateFunds({ boardDesignatedNone: n })}
          />
        </CardContent>
      </Card>

      {/* Treasurer's Report */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Treasurer's Report</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Current fiscal year</Label>
              <Input
                className="h-8 text-sm"
                value={data.treasurerFiscalYearCurrent}
                onChange={e => update("treasurerFiscalYearCurrent", e.target.value)}
                placeholder="e.g. 2025"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Prior fiscal year</Label>
              <Input
                className="h-8 text-sm"
                value={data.treasurerFiscalYearPrior}
                onChange={e => update("treasurerFiscalYearPrior", e.target.value)}
                placeholder="e.g. 2024"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Summary (internal record)</Label>
            <Textarea
              className="text-sm min-h-[70px]"
              value={data.treasurerSummary}
              onChange={e => update("treasurerSummary", e.target.value)}
              placeholder="Structured notes for internal use. Dollar figures will NOT appear in the generated minutes."
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget Approval */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Budget Approval</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Fiscal year</Label>
            <Input
              className="h-8 text-sm"
              value={data.budgetFiscalYear}
              onChange={e => update("budgetFiscalYear", e.target.value)}
              placeholder="e.g. 2026"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch checked={data.budgetApproved} onCheckedChange={v => update("budgetApproved", v)} />
            Approved
          </label>
        </CardContent>
      </Card>

      {/* Compensation Review */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Compensation Review</CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Structured data — retained for reports and Form 990 prep. Amounts will NOT appear in the generated minutes.
          </p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {data.compensationOfficers.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1.5fr_28px] gap-1.5 items-center">
              <Input
                className="h-8 text-sm"
                value={row.name}
                placeholder="Name"
                onChange={e => {
                  const next = [...data.compensationOfficers];
                  next[i] = { ...next[i], name: e.target.value };
                  update("compensationOfficers", next);
                }}
              />
              <Input
                className="h-8 text-sm"
                value={row.title}
                placeholder="Title"
                onChange={e => {
                  const next = [...data.compensationOfficers];
                  next[i] = { ...next[i], title: e.target.value };
                  update("compensationOfficers", next);
                }}
              />
              <Input
                className="h-8 text-sm"
                value={row.amount}
                placeholder="Amount"
                onChange={e => {
                  const next = [...data.compensationOfficers];
                  next[i] = { ...next[i], amount: e.target.value };
                  update("compensationOfficers", next);
                }}
              />
              <Input
                className="h-8 text-sm"
                value={row.comparabilityNotes}
                placeholder="Comparability data / source"
                onChange={e => {
                  const next = [...data.compensationOfficers];
                  next[i] = { ...next[i], comparabilityNotes: e.target.value };
                  update("compensationOfficers", next);
                }}
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() =>
                  update(
                    "compensationOfficers",
                    data.compensationOfficers.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() =>
              update("compensationOfficers", [
                ...data.compensationOfficers,
                { name: "", title: "", amount: "", comparabilityNotes: "" },
              ])
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Add officer / key employee
          </Button>
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={data.compensationReasonableApproved}
                onCheckedChange={v => update("compensationReasonableApproved", v)}
              />
              Board determined compensation reasonable and approved
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={data.compensationInterestedAbstained}
                onCheckedChange={v => update("compensationInterestedAbstained", v)}
              />
              Interested directors abstained
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Conflict of Interest */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Conflict of Interest</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <StringListField
            label="Disclosures made this year"
            values={data.conflictDisclosures}
            none={data.conflictDisclosuresNone}
            onChangeValues={v => update("conflictDisclosures", v)}
            onChangeNone={n => update("conflictDisclosuresNone", n)}
            placeholder="Director / nature of interest"
          />
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={data.coiPolicyReaffirmed}
                onCheckedChange={v => update("coiPolicyReaffirmed", v)}
              />
              Conflict of interest policy reaffirmed this year
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch
                checked={data.conflictOfInterestConfirmed}
                onCheckedChange={v => update("conflictOfInterestConfirmed", v)}
              />
              All board members signed annual COI disclosure
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Form 990 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Form 990 Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Fiscal year</Label>
            <Input
              className="h-8 text-sm"
              value={data.form990FiscalYear}
              onChange={e => update("form990FiscalYear", e.target.value)}
              placeholder="e.g. 2025"
            />
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={data.form990ReviewedPriorToFiling}
              onCheckedChange={v => update("form990ReviewedPriorToFiling", v)}
            />
            Reviewed prior to filing
          </label>
        </CardContent>
      </Card>

      {/* Public Inspection */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Public Inspection</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={data.publicInspectionConfirmed}
              onCheckedChange={v => update("publicInspectionConfirmed", v === true)}
              className="mt-0.5"
            />
            Form 990 and Form 1023/1023-EZ available for public inspection per IRC § 6104(d).
          </label>
        </CardContent>
      </Card>

      {/* Program Services */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Program Service Accomplishments</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            className="text-sm min-h-[80px]"
            value={data.programServiceAccomplishments}
            onChange={e => update("programServiceAccomplishments", e.target.value)}
            placeholder="Three largest program services and their expenses..."
          />
        </CardContent>
      </Card>

      {/* Outside Professionals */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Outside Professionals</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Law firm / attorney</Label>
              <Input
                className="h-8 text-sm"
                value={data.outsideAttorneyName}
                onChange={e => update("outsideAttorneyName", e.target.value)}
                placeholder="Current or newly engaged"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Accounting firm / accountant</Label>
              <Input
                className="h-8 text-sm"
                value={data.outsideAccountantName}
                onChange={e => update("outsideAccountantName", e.target.value)}
                placeholder="Current or newly engaged"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
            <Switch
              checked={data.outsideEngagementChanged}
              onCheckedChange={v => update("outsideEngagementChanged", v)}
            />
            Change in engagement this year
          </label>
          {data.outsideEngagementChanged && (
            <StringListField
              label="Details"
              values={data.outsideChangeDetails}
              none={data.outsideChangeDetailsNone}
              onChangeValues={v => update("outsideChangeDetails", v)}
              onChangeNone={n => update("outsideChangeDetailsNone", n)}
            />
          )}
        </CardContent>
      </Card>

      {/* Banking / signing authority */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Banking & Signing Authority</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <StringListField
            label="Bank name(s)"
            values={data.bankNames}
            none={false}
            onChangeValues={v => update("bankNames", v)}
            onChangeNone={() => {}}
            placeholder="Bank name"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Currently authorized signers</Label>
            {data.bankCurrentSigners.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
                <Input
                  className="h-8 text-sm"
                  value={s.name}
                  placeholder="Name"
                  onChange={e => {
                    const next = [...data.bankCurrentSigners];
                    next[i] = { ...next[i], name: e.target.value };
                    update("bankCurrentSigners", next);
                  }}
                />
                <Input
                  className="h-8 text-sm"
                  value={s.title}
                  placeholder="Officer title"
                  onChange={e => {
                    const next = [...data.bankCurrentSigners];
                    next[i] = { ...next[i], title: e.target.value };
                    update("bankCurrentSigners", next);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() =>
                    update(
                      "bankCurrentSigners",
                      data.bankCurrentSigners.filter((_, j) => j !== i)
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                update("bankCurrentSigners", [...data.bankCurrentSigners, { name: "", title: "" }])
              }
            >
              <Plus className="h-3 w-3 mr-1" /> Add signer
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={data.bankPriorAuthorizationsRevoked}
              onCheckedChange={v => update("bankPriorAuthorizationsRevoked", v)}
            />
            Prior authorizations revoked this year
          </label>
        </CardContent>
      </Card>

      {/* Elections */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Elections</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <StringListField
            label="Directors elected"
            values={data.electedDirectors}
            none={false}
            onChangeValues={v => update("electedDirectors", v)}
            onChangeNone={() => {}}
            placeholder="Director name"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Officers elected</Label>
            {data.electedOfficers.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
                <Input
                  className="h-8 text-sm"
                  value={o.role}
                  placeholder="Role (e.g. Chairperson, President, Secretary, Treasurer)"
                  onChange={e => {
                    const next = [...data.electedOfficers];
                    next[i] = { ...next[i], role: e.target.value };
                    update("electedOfficers", next);
                  }}
                />
                <Input
                  className="h-8 text-sm"
                  value={o.name}
                  placeholder="Name"
                  onChange={e => {
                    const next = [...data.electedOfficers];
                    next[i] = { ...next[i], name: e.target.value };
                    update("electedOfficers", next);
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive"
                  onClick={() =>
                    update(
                      "electedOfficers",
                      data.electedOfficers.filter((_, j) => j !== i)
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                update("electedOfficers", [...data.electedOfficers, { role: "", name: "" }])
              }
            >
              <Plus className="h-3 w-3 mr-1" /> Add officer
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Switch
              checked={data.chairpersonCombinedWithPresident}
              onCheckedChange={v => update("chairpersonCombinedWithPresident", v)}
            />
            Chairperson and President are the same office
          </label>
        </CardContent>
      </Card>

      {/* Next Meeting */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Next Annual Meeting</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={data.nextMeetingDate}
              onChange={e => update("nextMeetingDate", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Location</Label>
            <Input
              className="h-8 text-sm"
              value={data.nextMeetingLocation}
              onChange={e => update("nextMeetingLocation", e.target.value)}
              placeholder="Location or 'remote'"
            />
          </div>
        </CardContent>
      </Card>

      {/* Closing */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold">Closing</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Other business discussed</Label>
            <Textarea
              className="text-sm min-h-[60px]"
              value={data.otherBusiness}
              onChange={e => update("otherBusiness", e.target.value)}
              placeholder="Summary of any other business discussed"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Adjournment time</Label>
              <Input
                className="h-8 text-sm"
                value={data.adjournmentTime}
                onChange={e => update("adjournmentTime", e.target.value)}
                placeholder="e.g. 3:15 PM"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Minutes approval date</Label>
              <Input
                type="date"
                className="h-8 text-sm"
                value={data.certificationDate}
                onChange={e => update("certificationDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
