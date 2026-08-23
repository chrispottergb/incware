import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Loader2, Settings2 } from "lucide-react";
import { useAnnualMeetingsDue, type DueStatus } from "@/hooks/useAnnualMeetingsDue";

const STATUS_CLASS: Record<DueStatus, string> = {
  Overdue: "bg-destructive/10 text-destructive border-destructive/20",
  "Due now": "bg-warning/10 text-warning border-warning/20",
  Upcoming: "bg-primary/10 text-primary border-primary/20",
  Later: "bg-muted text-muted-foreground border-border",
  "Not scheduled": "bg-muted text-muted-foreground border-border",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Read-only projection of upcoming annual meetings. Computes only — never writes. */
export default function AnnualMeetingsDueCard() {
  const { data: rows = [], isLoading } = useAnnualMeetingsDue();
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();

  const overdue = rows.filter((r) => r.status === "Overdue").length;
  const dueNow = rows.filter((r) => r.status === "Due now").length;
  const upcoming = rows.filter((r) => r.status === "Upcoming").length;

  const visible = showAll ? rows : rows.slice(0, 10);
  const nothingSoon = !isLoading && overdue === 0 && dueNow === 0 && upcoming === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Annual Meetings Due
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {overdue} overdue · {dueNow} due in 30 days
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : nothingSoon ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No annual meetings due in the next 90 days.
          </p>
        ) : (
          <>
            <div className="divide-y divide-border rounded-lg border border-border">
              {visible.map((r) => (
                <div
                  key={r.companyId}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/company/${r.companyId}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/company/${r.companyId}`);
                  }}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50 focus:outline-none focus:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.entityType || "—"} · {r.sourceLabel}
                    </p>
                  </div>
                  <div className="w-36 shrink-0 text-right">
                    <p className="text-[11px] text-muted-foreground">
                      Last: {r.lastAnnual ? fmt(r.lastAnnual) : "None on record"}
                    </p>
                    <p className="text-xs font-medium">Due: {fmt(r.dueDate)}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-[10px] ${STATUS_CLASS[r.status]}`}>
                    {r.status}
                  </Badge>
                  {r.status === "Not scheduled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/company/${r.companyId}#incorporation`);
                      }}
                    >
                      <Settings2 className="mr-1 h-3 w-3" /> Set schedule
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {rows.length > 10 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show less" : `Show all (${rows.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
