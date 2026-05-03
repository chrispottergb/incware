import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2, XCircle } from "lucide-react";

interface Director {
  id: string;
  name: string;
  added_date?: string | null;
}

interface Shareholder {
  id: string;
  name: string;
}

interface Props {
  directors: Director[];
  meetingDirectorNames: string[];
  shareholders: Shareholder[];
  directorLabel?: string;
  directorsLabel?: string;
  shareholdersLabel?: string;
}

export default function DirectorReElection({ directors, meetingDirectorNames, shareholders, directorLabel = "Director", directorsLabel = "Directors", shareholdersLabel = "Shareholders" }: Props) {
  if (directors.length === 0) return null;

  const normalizedMeetingNames = meetingDirectorNames.map(n => n.trim().toLowerCase());

  const approvedDirectors = directors.filter(d =>
    normalizedMeetingNames.includes(d.name.trim().toLowerCase())
  );
  const notReElectedDirectors = directors.filter(d =>
    !normalizedMeetingNames.includes(d.name.trim().toLowerCase())
  );

  const allApproved = notReElectedDirectors.length === 0 && approvedDirectors.length > 0;
  const actionWord = directorLabel === "Director" ? "election" : "appointment";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <CardTitle className="font-display text-base">{directorLabel} Re-{directorLabel === "Director" ? "Election" : "Appointment"}</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Current {directorsLabel.toLowerCase()} nominated for re-{actionWord} by {shareholdersLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {shareholders.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{shareholdersLabel} Present for Vote</p>
              <div className="flex flex-wrap gap-1.5">
                {shareholders.map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border border-border">
            <div className="px-3 py-2 bg-muted/40 border-b border-border">
              <p className="text-xs font-semibold">{directorsLabel} — Re-{directorLabel === "Director" ? "Election" : "Appointment"} Status</p>
            </div>
            <div className="divide-y divide-border">
              {approvedDirectors.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-medium">{d.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved
                  </div>
                </div>
              ))}
              {notReElectedDirectors.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5 opacity-60">
                  <span className="text-sm font-medium text-muted-foreground">{d.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5" />
                    Not Re-elected
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            {allApproved
              ? `All current ${directorsLabel.toLowerCase()} have been nominated and approved for re-${actionWord} to serve until the next annual meeting of ${shareholdersLabel.toLowerCase()}.`
              : `Selected ${directorsLabel.toLowerCase()} have been approved for re-${actionWord} at this meeting.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
