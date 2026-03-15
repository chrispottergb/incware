import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, BookOpen, Eye, FileText } from "lucide-react";

export interface NonProfitGovernanceData {
  missionStatementReview: string;
  conflictOfInterestConfirmed: boolean;
  publicInspectionConfirmed: boolean;
  programServiceAccomplishments: string;
}

interface Props {
  data: NonProfitGovernanceData;
  onChange: (data: NonProfitGovernanceData) => void;
}

export default function NonProfitGovernanceStep({ data, onChange }: Props) {
  const update = (field: keyof NonProfitGovernanceData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Non-Profit Governance</h3>
      <p className="text-xs text-muted-foreground">
        Annual governance review required for tax-exempt organizations under IRC § 501(c)(3).
      </p>

      {/* Mission Statement Review */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Mission Statement Review</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Label className="text-xs text-muted-foreground">
            Confirm or update the organization's primary exempt purpose.
          </Label>
          <Textarea
            className="text-sm min-h-[80px] mt-1.5"
            value={data.missionStatementReview}
            onChange={e => update("missionStatementReview", e.target.value)}
            placeholder="Enter the organization's current mission statement and any proposed updates..."
          />
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
        <CardContent className="pt-0">
          <div className="flex items-center gap-3">
            <Switch
              checked={data.conflictOfInterestConfirmed}
              onCheckedChange={v => update("conflictOfInterestConfirmed", v)}
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Confirm all board members have signed the annual Conflict of Interest disclosure.
            </Label>
          </div>
          {!data.conflictOfInterestConfirmed && (
            <p className="text-[11px] text-destructive mt-1.5 ml-12">
              ⚠ IRS Form 990 Schedule O requires annual disclosure. Ensure all board members sign before filing.
            </p>
          )}
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
          <div className="flex items-start gap-3">
            <Checkbox
              checked={data.publicInspectionConfirmed}
              onCheckedChange={v => update("publicInspectionConfirmed", v === true)}
              className="mt-0.5"
            />
            <Label className="text-xs text-muted-foreground cursor-pointer">
              Confirm that the organization's Form 990 and application for exemption (Form 1023/1023-EZ) are available for public inspection as required under IRC § 6104(d).
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Program Service Accomplishments */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold">Program Service Accomplishments</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Label className="text-xs text-muted-foreground">
            Briefly describe the organization's three largest program services and their expenses for the year.
          </Label>
          <Textarea
            className="text-sm min-h-[100px] mt-1.5"
            value={data.programServiceAccomplishments}
            onChange={e => update("programServiceAccomplishments", e.target.value)}
            placeholder={"1. Program Name — Description of accomplishments and impact. Expenses: $XX,XXX\n2. Program Name — Description of accomplishments and impact. Expenses: $XX,XXX\n3. Program Name — Description of accomplishments and impact. Expenses: $XX,XXX"}
          />
        </CardContent>
      </Card>
    </div>
  );
}
