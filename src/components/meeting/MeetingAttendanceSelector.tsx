import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PersonRecord {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  isTreasury?: boolean;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  commonShares?: number | string | null;
  preferredShares?: number | string | null;
}

interface Props {
  meetingId: string;
  meetingDate: string;           // yyyy-MM-dd
  /** Company-level roster records */
  roster: PersonRecord[];
  /** Already-added meeting records (to prevent duplicates) */
  existingNames: string[];
  /** Display config */
  roleLabel: string;             // "Shareholder" | "Director" | "Member"
  roleLabelPlural: string;
  /** Target meeting sub-table and name column */
  tableName: string;
  nameColumn: string;
}

export default function MeetingAttendanceSelector({
  meetingId,
  meetingDate,
  roster,
  existingNames,
  roleLabel,
  roleLabelPlural,
  tableName,
  nameColumn,
}: Props) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filter roster by meeting date
  // CRITICAL: Compare dates as YYYY-MM-DD strings only (no Date/UTC conversion)
  // to prevent timezone-shift bugs that exclude valid records.
  const eligible = useMemo(() => {
    const meetingDateStr = (meetingDate || "").slice(0, 10);
    const todayStr = new Date().toISOString().slice(0, 10);
    const normalizeDate = (d: string | null | undefined) =>
      d ? String(d).slice(0, 10) : null;

    return roster.filter((p) => {
      if (p.isTreasury) return false;
      if (p.status && p.status !== "active") return false;
      const start = normalizeDate(p.startDate);
      const end = normalizeDate(p.endDate);
      // Only enforce the start-date filter when the start date is a confirmed
      // historical date (on or before today). If the start date equals or is
      // after today, it likely reflects "record created today" rather than the
      // person's actual tenure start, so don't exclude them from prior meetings.
      if (start && start <= todayStr && meetingDateStr && start > meetingDateStr) {
        return false;
      }
      // End date: must be on or after the meeting date (inclusive).
      if (end && meetingDateStr && end < meetingDateStr) return false;
      return true;
    });
  }, [roster, meetingDate]);

  // Filter out already-added
  const existingNamesLower = useMemo(
    () => new Set(existingNames.map((n) => n.toLowerCase().trim())),
    [existingNames]
  );

  const available = useMemo(
    () => eligible.filter((p) => !existingNamesLower.has(p.name.toLowerCase().trim())),
    [eligible, existingNamesLower]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === available.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(available.map((p) => p.id)));
    }
  };

  const addSelected = useMutation({
    mutationFn: async () => {
      const people = available.filter((p) => selected.has(p.id));
      if (people.length === 0) return;

      const rows = people.map((p) => ({
        meeting_id: meetingId,
        [nameColumn]: p.name,
        ...(tableName === "meeting_shareholders" ? {
          address: p.address || null,
          city: p.city || null,
          state: p.state || null,
          zip: p.zip || null,
          common_shares: p.commonShares != null && p.commonShares !== "" ? Number(p.commonShares) : 0,
          preferred_shares: p.preferredShares != null && p.preferredShares !== "" ? Number(p.preferredShares) : 0,
        } : {}),
      }));

      const { error } = await supabase.from(tableName as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [tableName, meetingId] });
      setSelected(new Set());
      toast.success(`${roleLabelPlural} added to meeting.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Determine how many from the eligible list are already in the meeting
  const alreadyAdded = eligible.filter((p) =>
    existingNamesLower.has(p.name.toLowerCase().trim())
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <CardTitle className="font-display text-base">
            Add {roleLabelPlural} from Company Roster
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Showing active {roleLabelPlural.toLowerCase()} as of{" "}
          {new Date(meetingDate + "T00:00:00").toLocaleDateString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {eligible.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border py-6 px-4 justify-center">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No active {roleLabelPlural.toLowerCase()} found for this meeting date.
            </p>
          </div>
        ) : available.length === 0 ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-dashed border-border py-6 text-center">
              <p className="text-sm text-muted-foreground">
                All eligible {roleLabelPlural.toLowerCase()} have already been added.
              </p>
            </div>
            {alreadyAdded.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium mr-1">
                  Already added:
                </span>
                {alreadyAdded.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">
                    {p.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={selectAll}
              >
                {selected.size === available.length ? "Deselect All" : "Select All"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={selected.size === 0 || addSelected.isPending}
                onClick={() => addSelected.mutate()}
              >
                {addSelected.isPending && (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                )}
                Add {selected.size > 0 ? `(${selected.size})` : ""} to Meeting
              </Button>
            </div>

            <div className="rounded-md border border-border divide-y divide-border">
              {available.map((person) => (
                <label
                  key={person.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(person.id)}
                    onCheckedChange={() => toggle(person.id)}
                  />
                  <span className="text-sm font-medium flex-1">{person.name}</span>
                  {person.startDate && (
                    <span className="text-[10px] text-muted-foreground">
                      Since {new Date(person.startDate + "T00:00:00").toLocaleDateString()}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {alreadyAdded.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium mr-1">
                  Already added:
                </span>
                {alreadyAdded.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-[10px]">
                    {p.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
