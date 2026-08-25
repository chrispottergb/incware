import { describe, it, expect } from "vitest";
import { getAnnualMeetingStatus, resolveScheduledDate } from "@/hooks/useAnnualMeetingsDue";

const scheduled = {
  statutory_close_corporation: false,
  scheduled_meeting_ordinal: "3rd",
  scheduled_meeting_day_of_week: "Thursday",
  scheduled_meeting_month: "May",
};

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("getAnnualMeetingStatus", () => {
  it("marks a missed scheduled meeting as overdue", () => {
    // last held May 2024 -> next due 3rd Thursday of May 2025 (2025-05-15), today after that
    const r = getAnnualMeetingStatus(scheduled, d("2024-05-16"), d("2025-08-01"));
    expect(r.status).toBe("OVERDUE");
    expect(r.tone).toBe("red");
    expect(r.label).toMatch(/^Overdue \d+d$/);
  });

  it("marks a meeting within 60 days as due soon", () => {
    const r = getAnnualMeetingStatus(scheduled, d("2024-05-16"), d("2025-04-20"));
    expect(r.status).toBe("DUE_SOON");
    expect(r.tone).toBe("amber");
    expect(r.label).toBe("Due May 15");
  });

  it("marks a distant meeting as scheduled", () => {
    const r = getAnnualMeetingStatus(scheduled, d("2024-05-16"), d("2025-01-05"));
    expect(r.status).toBe("SCHEDULED");
    expect(r.tone).toBe("neutral");
    expect(r.dueDate && r.dueDate.getFullYear()).toBe(2025);
  });

  it("reports unscheduled when any schedule column is missing", () => {
    const r = getAnnualMeetingStatus(
      { ...scheduled, scheduled_meeting_month: null },
      d("2024-05-16"),
      d("2025-01-05"),
    );
    expect(r.status).toBe("UNSCHEDULED");
    expect(r.label).toBe("No schedule set");
  });

  it("reports never held with a future due date when no annual meeting exists", () => {
    const r = getAnnualMeetingStatus(scheduled, null, d("2025-01-05"));
    expect(r.status).toBe("NEVER_HELD");
    expect(r.label).toBe("No annual meeting on record");
    expect(r.dueDate!.getTime()).toBeGreaterThan(d("2025-01-05").getTime());
  });

  it("exempts statutory close corporations and never shows red", () => {
    const r = getAnnualMeetingStatus(
      { ...scheduled, statutory_close_corporation: true },
      d("2010-05-20"),
      d("2025-08-01"),
    );
    expect(r.status).toBe("NOT_REQUIRED");
    expect(r.tone).toBe("muted");
    expect(r.dueDate).toBeNull();
  });

  it("falls back to the last matching weekday when a month has no 5th occurrence", () => {
    // February 2025 has only 4 Thursdays; 5th Thursday must clamp to Feb 27.
    const date = resolveScheduledDate("5th", "Thursday", "February", 2025);
    expect(date!.getMonth()).toBe(1);
    expect(date!.getDate()).toBe(27);
  });
});
