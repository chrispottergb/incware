import { useState } from "react";
import { format, parseISO } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Clock, MapPin, User, Users, Loader2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Meeting = Tables<"meetings">;

interface Props {
  meeting: Meeting;
}

function DateField({
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
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-9 justify-start text-left text-sm font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? format(date, "PPP") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white text-black" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : null);
              setOpen(false);
            }}
            initialFocus
            className="p-3 pointer-events-auto"
            classNames={{
              day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
              day_today: "bg-gray-100 text-black",
              head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
              nav_button: cn(
                "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-gray-200 rounded-md inline-flex items-center justify-center"
              ),
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-gray-100 inline-flex items-center justify-center",
              day_outside: "day-outside text-gray-400 opacity-50",
              caption_label: "text-sm font-medium text-black",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
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
            <DateField
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
            <DateField
              label="Prior Meeting Date"
              value={meeting.prior_mtg_date}
              onChange={(val) => handleDateChange("prior_mtg_date", val)}
            />
            <DateField
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
