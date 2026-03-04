import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, CheckCircle2 } from "lucide-react";

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
  shareholders: Shareholder[];
  directorLabel?: string;
  directorsLabel?: string;
  shareholdersLabel?: string;
}

export default function DirectorReElection({ directors, shareholders, directorLabel = "Director", directorsLabel = "Directors", shareholdersLabel = "Shareholders" }: Props) {
  if (directors.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <CardTitle className="font-display text-base">{directorLabel} Re-{directorLabel === "Director" ? "Election" : "Appointment"}</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Current {directorsLabel.toLowerCase()} nominated for re-{directorLabel === "Director" ? "election" : "appointment"} by {shareholdersLabel.toLowerCase()}
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
              <p className="text-xs font-semibold">{directorsLabel} Nominated for Re-{directorLabel === "Director" ? "Election" : "Appointment"}</p>
            </div>
            <div className="divide-y divide-border">
              {directors.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-medium">{d.name}</span>
                  <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approved
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground italic">
            All current {directorsLabel.toLowerCase()} have been nominated and approved for re-{directorLabel === "Director" ? "election" : "appointment"} to serve until the next annual meeting of {shareholdersLabel.toLowerCase()}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
