import { MONTHS, DAYS_OF_WEEK } from "@/components/company/ScheduledMeetingPicker";

/**
 * READ-ONLY annual meeting due-date projection helpers.
 *
 * Nothing here writes to the database. The due date is always DERIVED from
 * (a) the bylaw schedule columns on `companies` and (b) the most recent
 * `meetings.meeting_date` where meeting_type ILIKE 'Annual Meeting%'.
 * It replaces the retired `meetings.next_annual_mtg` field, which must never
 * be reintroduced as a user-entered value.
 *
 * `getAnnualMeetingStatus` is the SINGLE definition of "due" used by the UI.
 */

export type AnnualMeetingStatus =
  | "NOT_REQUIRED"
  | "UNSCHEDULED"
  | "NEVER_HELD"
  | "OVERDUE"
  | "DUE_SOON"
  | "SCHEDULED";

export type StatusTone = "muted" | "neutral" | "amber" | "red";

export interface AnnualMeetingStatusResult {
  status: AnnualMeetingStatus;
  dueDate: Date | null;
  label: string;
  tone: StatusTone;
}

export interface ScheduleCompany {
  statutory_close_corporation?: boolean | null;
  scheduled_meeting_ordinal?: string | null;
  scheduled_meeting_day_of_week?: string | null;
  scheduled_meeting_month?: string | null;
}

const MONTH_INDEX = new Map(MONTHS.map((m, i) => [m.toLowerCase(), i]));
// JS getDay(): 0 = Sunday .. 6 = Saturday
const DAY_INDEX = new Map<string, number>(
  DAYS_OF_WEEK.map((d) => [d.toLowerCase(), (DAYS_OF_WEEK.indexOf(d) + 1) % 7]),
);

/** Builds a local-noon date so no result is ever off by one day (same convention as annual-meeting-pdf.ts). */
function atNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Resolves e.g. ("3rd", "Thursday", "May", 2026) to the third Thursday of May 2026.
 * Returns null when any input is missing or unrecognized.
 */
export function resolveScheduledDate(
  ordinal: string | null | undefined,
  dayOfWeek: string | null | undefined,
  month: string | null | undefined,
  year: number,
): Date | null {
  if (!ordinal || !dayOfWeek || !month) return null;
  const monthIndex = MONTH_INDEX.get(month.trim().toLowerCase());
  const weekday = DAY_INDEX.get(dayOfWeek.trim().toLowerCase());
  if (monthIndex === undefined || weekday === undefined) return null;

  const ord = ordinal.trim().toLowerCase();
  const last = daysInMonth(year, monthIndex);

  if (ord === "last") {
    for (let day = last; day >= 1; day--) {
      const d = atNoon(year, monthIndex, day);
      if (d.getDay() === weekday) return d;
    }
    return null;
  }

  const n = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5 }[ord];
  if (!n) return null;

  // First matching weekday of the month.
  let firstDay = 1;
  while (firstDay <= 7 && atNoon(year, monthIndex, firstDay).getDay() !== weekday) firstDay++;
  if (firstDay > 7) return null;

  let target = firstDay + (n - 1) * 7;
  // Never spill into the next month — fall back to the last matching weekday.
  while (target > last) target -= 7;
  return atNoon(year, monthIndex, target);
}

/** Same month/day one year later; clamps to the last day of the month (e.g. Feb 29 -> Feb 28). */
export function addOneYear(date: Date): Date {
  const year = date.getFullYear() + 1;
  const monthIndex = date.getMonth();
  const day = Math.min(date.getDate(), daysInMonth(year, monthIndex));
  return atNoon(year, monthIndex, day);
}

export function wholeDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtFull(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The one and only definition of annual-meeting "due" status.
 *
 * Precedence:
 *  1. Statutory close corporations are exempt (Wis. Stat. s. 180.1827) — never overdue.
 *  2. No bylaw schedule -> unscheduled.
 *  3. Scheduled but never held -> next occurrence after today.
 *  4. Otherwise -> match the last meeting to the nearest scheduled occurrence
 *     (the one it satisfied, even across a year boundary) and take the
 *     occurrence one year after that.

 */
export function getAnnualMeetingStatus(
  company: ScheduleCompany,
  lastAnnualMeetingDate: Date | null,
  today: Date = new Date(),
): AnnualMeetingStatusResult {
  if (company.statutory_close_corporation) {
    return { status: "NOT_REQUIRED", dueDate: null, label: "Not required (close corp)", tone: "muted" };
  }

  const ordinal = company.scheduled_meeting_ordinal;
  const dayOfWeek = company.scheduled_meeting_day_of_week;
  const month = company.scheduled_meeting_month;
  if (!ordinal || !dayOfWeek || !month) {
    return { status: "UNSCHEDULED", dueDate: null, label: "No schedule set", tone: "neutral" };
  }

  const nextAfter = (anchor: Date): Date | null => {
    let year = anchor.getFullYear();
    for (let i = 0; i < 6; i++) {
      const candidate = resolveScheduledDate(ordinal, dayOfWeek, month, year + i);
      if (candidate && candidate.getTime() > anchor.getTime()) return candidate;
    }
    return null;
  };

  if (!lastAnnualMeetingDate) {
    const dueDate = nextAfter(today);
    return {
      status: "NEVER_HELD",
      dueDate,
      label: "No annual meeting on record",
      tone: "amber",
    };
  }

  // Match the last meeting to the scheduled occurrence it actually satisfied
  // (nearest occurrence in year-1 / year / year+1; ties prefer the earlier one),
  // then the next deadline is the occurrence one year after that.
  const lastYear = lastAnnualMeetingDate.getFullYear();
  let satisfiedYear: number | null = null;
  let bestDelta = Infinity;
  for (const y of [lastYear - 1, lastYear, lastYear + 1]) {
    const candidate = resolveScheduledDate(ordinal, dayOfWeek, month, y);
    if (!candidate) continue;
    const delta = Math.abs(wholeDaysBetween(candidate, lastAnnualMeetingDate));
    if (delta < bestDelta) {
      bestDelta = delta;
      satisfiedYear = y;
    }
  }

  const dueDate =
    satisfiedYear === null
      ? null
      : resolveScheduledDate(ordinal, dayOfWeek, month, satisfiedYear + 1);
  if (!dueDate) {
    return { status: "UNSCHEDULED", dueDate: null, label: "No schedule set", tone: "neutral" };
  }


  const daysUntil = wholeDaysBetween(today, dueDate);
  if (daysUntil < 0) {
    return { status: "OVERDUE", dueDate, label: `Overdue ${Math.abs(daysUntil)}d`, tone: "red" };
  }
  if (daysUntil <= 60) {
    return { status: "DUE_SOON", dueDate, label: `Due ${fmtShort(dueDate)}`, tone: "amber" };
  }
  return { status: "SCHEDULED", dueDate, label: fmtFull(dueDate), tone: "neutral" };
}
