import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MONTHS, DAYS_OF_WEEK } from "@/components/company/ScheduledMeetingPicker";

/**
 * READ-ONLY annual meeting due-date projection.
 *
 * Nothing here writes to the database. The due date is always DERIVED from
 * (a) the bylaw schedule columns on `companies` and (b) the most recent
 * `meetings.meeting_date` where meeting_type ILIKE 'Annual Meeting%'.
 * It replaces the retired `meetings.next_annual_mtg` field, which must never
 * be reintroduced as a user-entered value.
 */

export type DueSource = "schedule" | "anniversary" | "none";
export type DueStatus = "Overdue" | "Due now" | "Upcoming" | "Later" | "Not scheduled";

export interface AnnualMeetingDueRow {
  companyId: string;
  name: string;
  entityType: string | null;
  lastAnnual: Date | null;
  dueDate: Date | null;
  daysUntil: number | null;
  status: DueStatus;
  source: DueSource;
  sourceLabel: string;
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

  const n = { "1st": 1, "2nd": 2, "3rd": 3, "4th": 4 }[ord];
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

function parseDbDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function wholeDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export function bucketFor(daysUntil: number | null): DueStatus {
  if (daysUntil === null) return "Not scheduled";
  if (daysUntil < 0) return "Overdue";
  if (daysUntil <= 30) return "Due now";
  if (daysUntil <= 90) return "Upcoming";
  return "Later";
}

export function useAnnualMeetingsDue() {
  return useQuery({
    queryKey: ["annual-meetings-due"],
    queryFn: async (): Promise<AnnualMeetingDueRow[]> => {
      // Exactly two queries — never one per company.
      const [companiesRes, meetingsRes] = await Promise.all([
        supabase
          .from("companies")
          .select(
            "id, name, entity_type, status, scheduled_meeting_ordinal, scheduled_meeting_day_of_week, scheduled_meeting_month, scheduled_annual_meeting",
          )
          .order("name")
          .range(0, 999),
        supabase
          .from("meetings")
          .select("company_id, meeting_date, meeting_type")
          .ilike("meeting_type", "Annual Meeting%")
          .not("meeting_date", "is", null)
          .range(0, 9999),
      ]);
      if (companiesRes.error) throw companiesRes.error;
      if (meetingsRes.error) throw meetingsRes.error;

      // Reduce to a max meeting_date per company, plus the full set of annual dates
      // (used to skip forward past a schedule date that has already been met).
      const datesByCompany = new Map<string, string[]>();
      for (const m of meetingsRes.data || []) {
        if (!m.company_id || !m.meeting_date) continue;
        const list = datesByCompany.get(m.company_id) || [];
        list.push(m.meeting_date as string);
        datesByCompany.set(m.company_id, list);
      }

      const today = new Date();

      return (companiesRes.data || [])
        .filter((c) => c.status !== "inactive")
        .map((c) => {
          const dates = (datesByCompany.get(c.id) || []).slice().sort();
          const lastAnnualStr = dates.length ? dates[dates.length - 1] : null;
          const lastAnnual = lastAnnualStr ? parseDbDate(lastAnnualStr) : null;

          const hasSchedule = Boolean(
            c.scheduled_meeting_ordinal && c.scheduled_meeting_day_of_week && c.scheduled_meeting_month,
          );

          let dueDate: Date | null = null;
          let source: DueSource = "none";
          let sourceLabel = "No meeting schedule set";

          if (hasSchedule) {
            let year = lastAnnual ? lastAnnual.getFullYear() + 1 : today.getFullYear();
            let candidate = resolveScheduledDate(
              c.scheduled_meeting_ordinal,
              c.scheduled_meeting_day_of_week,
              c.scheduled_meeting_month,
              year,
            );
            for (let i = 0; i < 5 && candidate; i++) {
              const iso = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
              const alreadyHeld = dates.some((d) => d >= iso);
              if (!alreadyHeld) break;
              year += 1;
              candidate = resolveScheduledDate(
                c.scheduled_meeting_ordinal,
                c.scheduled_meeting_day_of_week,
                c.scheduled_meeting_month,
                year,
              );
            }
            if (candidate) {
              dueDate = candidate;
              source = "schedule";
              sourceLabel =
                c.scheduled_annual_meeting ||
                `${c.scheduled_meeting_ordinal} ${c.scheduled_meeting_day_of_week} in ${c.scheduled_meeting_month}`;
            }
          } else if (lastAnnual) {
            dueDate = addOneYear(lastAnnual);
            source = "anniversary";
            sourceLabel = "One year after last annual meeting";
          }

          const daysUntil = dueDate ? wholeDaysBetween(today, dueDate) : null;

          return {
            companyId: c.id,
            name: c.name,
            entityType: c.entity_type ?? null,
            lastAnnual,
            dueDate,
            daysUntil,
            status: bucketFor(daysUntil),
            source,
            sourceLabel,
          } satisfies AnnualMeetingDueRow;
        })
        .sort((a, b) => {
          if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.name.localeCompare(b.name);
        });
    },
  });
}
