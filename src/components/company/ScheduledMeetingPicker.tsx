import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ORDINALS = ["1st", "2nd", "3rd", "4th", "Last"] as const;
export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export type Ordinal = (typeof ORDINALS)[number];
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export type Month = (typeof MONTHS)[number];

/** Builds the display string the DB generated column produces, for UI previews. */
export function formatScheduledMeeting(
  ordinal?: string | null,
  dayOfWeek?: string | null,
  month?: string | null,
): string {
  if (ordinal && dayOfWeek && month) return `${ordinal} ${dayOfWeek} in ${month}`;
  return "";
}

interface Props {
  ordinal: string;
  dayOfWeek: string;
  month: string;
  onChange: (next: { ordinal: string; dayOfWeek: string; month: string }) => void;
  triggerClassName?: string;
}

/**
 * Three-select picker for the structured scheduled annual meeting date.
 * Writes the structured fields only — the display column (`scheduled_annual_meeting`)
 * is a generated column in the DB and must never be written directly.
 */
export function ScheduledMeetingPicker({ ordinal, dayOfWeek, month, onChange, triggerClassName = "h-7 text-sm" }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1">
      <Select value={ordinal || undefined} onValueChange={(v) => onChange({ ordinal: v, dayOfWeek, month })}>
        <SelectTrigger className={triggerClassName}><SelectValue placeholder="Ordinal" /></SelectTrigger>
        <SelectContent>
          {ORDINALS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={dayOfWeek || undefined} onValueChange={(v) => onChange({ ordinal, dayOfWeek: v, month })}>
        <SelectTrigger className={triggerClassName}><SelectValue placeholder="Day" /></SelectTrigger>
        <SelectContent>
          {DAYS_OF_WEEK.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={month || undefined} onValueChange={(v) => onChange({ ordinal, dayOfWeek, month: v })}>
        <SelectTrigger className={triggerClassName}><SelectValue placeholder="Month" /></SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
