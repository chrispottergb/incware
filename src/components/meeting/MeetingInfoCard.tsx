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

  const { handleZipChange, isLoading: zipLoading, zipError } = useZipLookup(
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
      updateMeeting.mutate(updates);
    }
  };

  const getValue = (field: string) => {
    if (field in values) return values[field];
    return (meeting as any)[field] ?? "";
  };

  const getTaxYearValue = () => {
    if ("tax_year" in values) return values["tax_year"];
    return meeting.tax_year ?? "";
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
          <div className="grid gap-4 grid-cols-12">
            <div className="col-span-2">
              <DateFieldWrapper
                label="Meeting Date"
                value={meeting.meeting_date}
                onChange={(val) => handleDateChange("meeting_date", val)}
                icon={CalendarIcon}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Tax Year
              </Label>
              <Input
                type="number"
                value={getTaxYearValue()}
                onChange={(e) => handleChange("tax_year", e.target.value)}
                onBlur={(e) => handleNumericBlur("tax_year", e.target.value)}
                className="h-9 text-sm mt-1.5"
                placeholder="e.g. 2024"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Time
              </Label>
              <Input
                value={getValue("meeting_time")}
                onChange={(e) => handleChange("meeting_time", e.target.value)}
                onBlur={(e) => handleBlur("meeting_time", e.target.value)}
                className="h-9 text-sm mt-1.5"
              />
            </div>
            <div className="col-span-6">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </Label>
              <Input
                value={getValue("meeting_location")}
                onChange={(e) => handleChange("meeting_location", e.target.value)}
                onBlur={(e) => handleBlur("meeting_location", e.target.value)}
                className="h-9 text-sm mt-1.5"
              />
            </div>
          </div>
          {/* Row 2: Chairperson, Secretary, Others Present, Prior Meeting Date, Next Annual Meeting */}
          <div className="mt-4 flex gap-3">
            <div className="flex-1 min-w-[120px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Chairperson
              </Label>
              <Input
                value={getValue("chairperson")}
                onChange={(e) => handleChange("chairperson", e.target.value)}
                onBlur={(e) => handleBlur("chairperson", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Secretary
              </Label>
              <Input
                value={getValue("mtg_secretary")}
                onChange={(e) => handleChange("mtg_secretary", e.target.value)}
                onBlur={(e) => handleBlur("mtg_secretary", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[120px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Others Present
              </Label>
              <Input
                value={getValue("others_present")}
                onChange={(e) => handleChange("others_present", e.target.value)}
                onBlur={(e) => handleBlur("others_present", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[135px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Prior Meeting Date</Label>
              <DatePickerField
                value={meeting.prior_mtg_date ?? ""}
                onChange={(val) => handleDateChange("prior_mtg_date", val || null)}
                placeholder="Pick date"
                className="h-9"
              />
            </div>
            <div className="w-[145px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Next Annual Meeting</Label>
              <DatePickerField
                value={meeting.next_annual_mtg ?? ""}
                onChange={(val) => handleDateChange("next_annual_mtg", val || null)}
                placeholder="Pick date"
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Company at Time of Meeting</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {/* All five fields on single row */}
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
              <Input
                value={getValue("company_name_at_meeting")}
                onChange={(e) => handleChange("company_name_at_meeting", e.target.value)}
                onBlur={(e) => handleBlur("company_name_at_meeting", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Address</Label>
              <Input
                value={getValue("company_address_at_meeting")}
                onChange={(e) => handleChange("company_address_at_meeting", e.target.value)}
                onBlur={(e) => handleBlur("company_address_at_meeting", e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-[140px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">City</Label>
              <Input
                value={getValue("company_city_at_meeting")}
                onChange={(e) => handleChange("company_city_at_meeting", e.target.value)}
                onBlur={(e) => handleBlur("company_city_at_meeting", e.target.value)}
                className="h-9 text-sm"
                placeholder={zipLoading ? "Loading..." : ""}
              />
            </div>
            <div className="w-[60px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">State</Label>
              <Input
                value={getValue("company_state_at_meeting")}
                onChange={(e) => handleChange("company_state_at_meeting", e.target.value)}
                onBlur={(e) => handleBlur("company_state_at_meeting", e.target.value)}
                className="h-9 text-sm"
                placeholder={zipLoading ? "..." : ""}
              />
            </div>
            <div className="w-[100px] space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
              <Input
                value={getValue("company_zip_at_meeting")}
                onChange={(e) => {
                  handleChange("company_zip_at_meeting", e.target.value);
                  handleZipChange(e.target.value);
                }}
                onBlur={(e) => handleBlur("company_zip_at_meeting", e.target.value)}
                className="h-9 text-sm"
              />
              {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
            </div>
          </div>
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
