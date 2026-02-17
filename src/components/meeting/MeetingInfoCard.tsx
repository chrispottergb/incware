import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, User, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Meeting = Tables<"meetings">;

interface Props {
  meeting: Meeting;
}

export default function MeetingInfoCard({ meeting }: Props) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

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

  const getValue = (field: string) => {
    if (field in values) return values[field];
    return (meeting as any)[field] ?? "";
  };

  const handleChange = (field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const infoFields = [
    { icon: Calendar, label: "Meeting Date", field: "meeting_date", type: "date" },
    { icon: Clock, label: "Time", field: "meeting_time" },
    { icon: MapPin, label: "Location", field: "meeting_location" },
    { icon: User, label: "Chairperson", field: "chairperson" },
    { icon: Users, label: "Secretary", field: "mtg_secretary" },
    { icon: Users, label: "Others Present", field: "others_present" },
  ];

  const dateFields = [
    { label: "Prior Meeting Date", field: "prior_mtg_date", type: "date" },
    { label: "Next Annual Meeting", field: "next_annual_mtg", type: "date" },
  ];

  const companyFields = [
    { label: "Company Name", field: "company_name_at_meeting" },
    { label: "Address", field: "company_address_at_meeting" },
    { label: "City", field: "company_city_at_meeting" },
    { label: "State", field: "company_state_at_meeting" },
    { label: "Zip", field: "company_zip_at_meeting" },
  ];

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {infoFields.map((item) => (
              <div key={item.field} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Label>
                <Input
                  type={item.type || "text"}
                  value={getValue(item.field)}
                  onChange={(e) => handleChange(item.field, e.target.value)}
                  onBlur={(e) => handleBlur(item.field, e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t pt-4">
            {dateFields.map((item) => (
              <div key={item.field} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{item.label}</Label>
                <Input
                  type="date"
                  value={getValue(item.field)}
                  onChange={(e) => handleChange(item.field, e.target.value)}
                  onBlur={(e) => handleBlur(item.field, e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            ))}
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
                onChange={(e) => handleChange(item.field, e.target.value)}
                onBlur={(e) => handleBlur(item.field, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
