import { useState, useCallback } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
import { format, parseISO } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Clock, MapPin, User, Users, Loader2, Hash, Calendar as CalendarIcon, Heart, Car, FileText } from "lucide-react";
import { toast } from "sonner";

type Meeting = Tables<"meetings">;

interface Props {
  meeting: Meeting;
}

function DateFieldWrapper({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </Label>
      <DatePickerField
        value={value ?? ""}
        onChange={(val) => onChange(val || null)}
        placeholder="Pick a date"
        className="h-9"
      />
    </div>
  );
}

export default function MeetingInfoCard({ meeting }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { handleZipChange } = useZipLookup(
    useCallback(({ city, state }: { city: string; state: string }) => {
      setValues((prev) => ({ ...prev, company_city_at_meeting: city, company_state_at_meeting: state }));
      updateMeeting.mutate({ company_city_at_meeting: city, company_state_at_meeting: state } as any);
    }, [])
  );

  const updateMeeting = useMutation({
    mutationFn: async (updates: Partial<Meeting>) => {
      const { error } = await supabase
        .from("meetings")
        .update(updates)
        .eq("id", meeting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meeting.id] });
      toast.success("Meeting info updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleBlur = (field: string, value: string) => {
    const original = (meeting as any)[field] ?? "";
    if (value !== original) {
      updateMeeting.mutate({ [field]: value || null } as any);
    }
  };

  const handleNumericBlur = (field: string, value: string) => {
    const original = (meeting as any)[field];
    const numVal = value ? parseInt(value) : null;
    if (numVal !== original) {
      updateMeeting.mutate({ [field]: numVal } as any);
    }
  };

  const handleDateChange = (field: string, value: string | null) => {
    const original = (meeting as any)[field] ?? null;
    if (value !== original) {
      const updates: Partial<Meeting> = { [field]: value } as any;
      // When meeting date changes, always auto-set tax_year = year - 1
      if (field === "meeting_date" && value) {
        const year = parseISO(value).getFullYear() - 1;
        (updates as any).tax_year = year;
        setValues((prev) => ({ ...prev, tax_year: String(year) }));
      }
      updateMeeting.mutate(updates);
    }
  };

  // Compute default tax year = meeting year - 1
  const defaultTaxYear = meeting.meeting_date
    ? parseISO(meeting.meeting_date).getFullYear() - 1
    : null;

  const getValue = (field: string) => {
    if (field in values) return values[field];
    return (meeting as any)[field] ?? "";
  };

  const getTaxYearValue = () => {
    if ("tax_year" in values) return values["tax_year"];
    return meeting.tax_year ?? defaultTaxYear ?? "";
  };

  const handleChange = (field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const textFields = [
    { icon: Clock, label: "Time", field: "meeting_time" },
    { icon: MapPin, label: "Location", field: "meeting_location" },
    { icon: User, label: "Chairperson", field: "chairperson" },
    { icon: Users, label: "Secretary", field: "mtg_secretary" },
    { icon: Users, label: "Others Present", field: "others_present" },
  ];

  const companyFields = [
    { label: "Company Name", field: "company_name_at_meeting" },
    { label: "Address", field: "company_address_at_meeting" },
    { label: "City", field: "company_city_at_meeting" },
    { label: "State", field: "company_state_at_meeting" },
    { label: "Zip", field: "company_zip_at_meeting" },
  ];

  const isWrittenConsent = meeting.meeting_type === "Written Consent";
  const isSpecialMeeting = meeting.meeting_type === "Special Meeting";
  const showPurpose = isWrittenConsent || isSpecialMeeting;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-base">Meeting Information</CardTitle>
            {updateMeeting.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          {showPurpose && (
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Purpose of Meeting
              </Label>
              <Textarea
                value={getValue("purpose")}
                onChange={(e) => handleChange("purpose", e.target.value)}
                onBlur={(e) => handleBlur("purpose", e.target.value)}
                className="text-sm"
                rows={3}
                placeholder="State the purpose for this meeting (e.g., To authorize the purchase of real property at...)"
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DateFieldWrapper
              label="Meeting Date"
              value={meeting.meeting_date}
              onChange={(val) => handleDateChange("meeting_date", val)}
              icon={CalendarIcon}
            />
            {/* Tax Year - editable, defaults shown but overridable */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Tax Year
              </Label>
              <Input
                type="number"
                value={getTaxYearValue()}
                onChange={(e) => handleChange("tax_year", e.target.value)}
                onBlur={(e) => handleNumericBlur("tax_year", e.target.value)}
                className="h-9 text-sm"
                placeholder="e.g. 2024"
              />
              {defaultTaxYear && !meeting.tax_year && (
                <p className="text-[10px] text-muted-foreground">Auto: meeting year − 1. Edit to override.</p>
              )}
            </div>
            {textFields.map((item) => (
              <div key={item.field} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Label>
                <Input
                  value={getValue(item.field)}
                  onChange={(e) => handleChange(item.field, e.target.value)}
                  onBlur={(e) => handleBlur(item.field, e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t pt-4">
            <DateFieldWrapper
              label="Prior Meeting Date"
              value={meeting.prior_mtg_date}
              onChange={(val) => handleDateChange("prior_mtg_date", val)}
            />
            <DateFieldWrapper
              label="Next Annual Meeting"
              value={meeting.next_annual_mtg}
              onChange={(val) => handleDateChange("next_annual_mtg", val)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Company at Time of Meeting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companyFields.map((item) => (
            <div key={item.field} className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{item.label}</Label>
              <Input
                value={getValue(item.field)}
                onChange={(e) => {
                  handleChange(item.field, e.target.value);
                  if (item.field === "company_zip_at_meeting") {
                    handleZipChange(e.target.value);
                  }
                }}
                onBlur={(e) => handleBlur(item.field, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Annual Meeting Extras */}
      {meeting.meeting_type === "Annual Meeting" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Charitable Contributions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Contribution Amount</Label>
                <Input
                  type="number"
                  value={getValue("charitable_contribution_amount")}
                  onChange={(e) => handleChange("charitable_contribution_amount", e.target.value)}
                  onBlur={(e) => {
                    const val = e.target.value;
                    const numVal = val ? parseFloat(val) : null;
                    const original = (meeting as any).charitable_contribution_amount;
                    if (numVal !== original) {
                      updateMeeting.mutate({ charitable_contribution_amount: numVal } as any);
                    }
                  }}
                  className="h-9 text-sm"
                  placeholder="e.g. 1000"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Organization / Description</Label>
                <Input
                  value={getValue("charitable_contribution_org")}
                  onChange={(e) => handleChange("charitable_contribution_org", e.target.value)}
                  onBlur={(e) => handleBlur("charitable_contribution_org", e.target.value)}
                  className="h-9 text-sm"
                  placeholder="e.g. a recognized charitable organization"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Car className="h-4 w-4" />
                Vehicle Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Vehicle Usage Policy Text</Label>
                <Textarea
                  value={getValue("vehicle_policy_text")}
                  onChange={(e) => handleChange("vehicle_policy_text", e.target.value)}
                  onBlur={(e) => handleBlur("vehicle_policy_text", e.target.value)}
                  className="text-sm min-h-[80px]"
                  placeholder="Company-owned vehicles are to be used only for business activities and not for personal use..."
                />
                <p className="text-[10px] text-muted-foreground">This text will appear in the meeting minutes before the vehicle transactions section. Leave blank to omit.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Other Business
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Old Business</Label>
                <Textarea
                  value={getValue("old_business")}
                  onChange={(e) => handleChange("old_business", e.target.value)}
                  onBlur={(e) => handleBlur("old_business", e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Discussion of old business from prior meetings..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Other</Label>
                <Textarea
                  value={getValue("other_business")}
                  onChange={(e) => handleChange("other_business", e.target.value)}
                  onBlur={(e) => handleBlur("other_business", e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Other business reported by the chairperson..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Profit Improvement Plan</Label>
                <Textarea
                  value={getValue("profit_improvement_plan")}
                  onChange={(e) => handleChange("profit_improvement_plan", e.target.value)}
                  onBlur={(e) => handleBlur("profit_improvement_plan", e.target.value)}
                  className="text-sm min-h-[60px]"
                  placeholder="Profit improvement strategies and plans..."
                />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
