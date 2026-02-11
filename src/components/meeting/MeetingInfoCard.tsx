import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, User, Users } from "lucide-react";

type Meeting = Tables<"meetings">;

interface Props {
  meeting: Meeting;
}

export default function MeetingInfoCard({ meeting }: Props) {
  const infoItems = [
    { icon: Calendar, label: "Date", value: new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString() },
    { icon: Clock, label: "Time", value: meeting.meeting_time },
    { icon: MapPin, label: "Location", value: meeting.meeting_location },
    { icon: User, label: "Chairperson", value: meeting.chairperson },
    { icon: Users, label: "Secretary", value: meeting.mtg_secretary },
    { icon: Users, label: "Others Present", value: meeting.others_present },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Meeting Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <item.icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="text-sm">{item.value || "—"}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 border-t pt-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prior Meeting Date</p>
              <p className="text-sm">
                {meeting.prior_mtg_date
                  ? new Date(meeting.prior_mtg_date + "T00:00:00").toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Next Annual Meeting</p>
              <p className="text-sm">
                {meeting.next_annual_mtg
                  ? new Date(meeting.next_annual_mtg + "T00:00:00").toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company info at time of meeting */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base">Company at Time of Meeting</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Company Name</p>
            <p className="text-sm">{meeting.company_name_at_meeting || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Address</p>
            <p className="text-sm">
              {[meeting.company_address_at_meeting, meeting.company_city_at_meeting, meeting.company_state_at_meeting, meeting.company_zip_at_meeting]
                .filter(Boolean)
                .join(", ") || "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
