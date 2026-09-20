import { describe, it, expect } from "vitest";
import {
  isNonprofit,
  getFormVisibility,
  computeRatios,
  runReconciliation,
  buildStatementHeader,
  derivePeriod,
  resolvePeriod,
  sourceConsistencyNote,
  isManualReviewDate,
  MANUAL_REVIEW_DATE_NOTE,
  suggestFiscalYear,
  yoyPercent,
  entityTypeChangeWarning,
  type NonprofitStatement,
} from "@/lib/nonprofit-financials";

const base = (over: Partial<NonprofitStatement> = {}): NonprofitStatement =>
  ({
    id: "s1",
    company_id: "c1",
    fiscal_year: 2025,
    fiscal_year_label: "FY2025",
    ...over,
  }) as NonprofitStatement;

describe("isNonprofit", () => {
  it("matches case-insensitively and trims", () => {
    expect(isNonprofit({ entity_type: "Non-Profit" })).toBe(true);
    expect(isNonprofit({ entity_type: "  non-profit " })).toBe(true);
  });
  it("rejects everything else", () => {
    for (const t of ["Corporation", "LLC", "LLC-S", "Partnership", "", null, undefined]) {
      expect(isNonprofit({ entity_type: t as any })).toBe(false);
    }
    expect(isNonprofit(null)).toBe(false);
  });
});

describe("getFormVisibility", () => {
  it("990 shows everything", () => {
    const v = getFormVisibility("990");
    expect(v.showStatement && v.showFunctionalSplit && v.showChart && v.showRatios).toBe(true);
  });
  it("990-EZ hides the functional split and chart", () => {
    const v = getFormVisibility("990-EZ");
    expect(v.showFunctionalSplit).toBe(false);
    expect(v.showChart).toBe(false);
    expect(v.showStatement).toBe(true);
  });
  it("990-N shows only the confirmation block", () => {
    const v = getFormVisibility("990-N");
    expect(v.showStatement).toBe(false);
    expect(v.showConfirmationBlock).toBe(true);
  });
  it("990-PF is explicitly unsupported", () => {
    expect(getFormVisibility("990-PF").unsupportedMessage).toBeTruthy();
  });
});

describe("fiscal year", () => {
  it("uses the year the period ends in", () => {
    expect(suggestFiscalYear("06-30", new Date(Date.UTC(2025, 7, 1)))).toBe(2025);
    expect(suggestFiscalYear("06-30", new Date(Date.UTC(2025, 2, 1)))).toBe(2024);
  });
});

describe("ratios", () => {
  it("computes the program expense ratio", () => {
    const cards = computeRatios(base({ program_services_expense: 80, total_expenses: 100 } as any));
    expect(cards.find((c) => c.key === "program_expense_ratio")?.display).toBe("80.0%");
  });
  it("omits ratios whose inputs are missing", () => {
    expect(computeRatios(base())).toHaveLength(0);
  });
});

describe("reconciliation", () => {
  it("flags a broken roll-forward", () => {
    const w = runReconciliation(
      base({ net_assets_beginning: 100, change_in_net_assets: 50, net_assets_ending: 200 } as any),
      "990",
    );
    expect(w.some((x) => x.code === "A")).toBe(true);
  });
  it("stays silent within tolerance", () => {
    const w = runReconciliation(
      base({ net_assets_beginning: 100, change_in_net_assets: 50, net_assets_ending: 150 } as any),
      "990",
    );
    expect(w.some((x) => x.code === "A")).toBe(false);
  });
  it("skips the continuity check silently when there is no prior year", () => {
    const w = runReconciliation(base({ net_assets_beginning: 100, net_assets_ending: 100 } as any), "990", null);
    expect(w.some((x) => x.code === "G")).toBe(false);
  });
  it("flags a continuity break against the prior year", () => {
    const w = runReconciliation(
      base({ net_assets_beginning: 100, net_assets_ending: 100 } as any),
      "990",
      base({ fiscal_year: 2024, net_assets_ending: 900 } as any),
    );
    expect(w.find((x) => x.code === "G")?.prominent).toBe(true);
  });
});

describe("statement header wording", () => {
  it("uses pre-filing wording when review precedes filing", () => {
    const h = buildStatementHeader(base({ board_reviewed_date: "2025-05-01", return_filed_date: "2025-06-01" } as any));
    expect(h.sourceLine).toContain("Reviewed by the governing body prior to filing on");
    expect(h.postFilingNote).toBeNull();
  });
  it("uses ratification wording when review follows filing", () => {
    const h = buildStatementHeader(base({ board_reviewed_date: "2025-07-01", return_filed_date: "2025-06-01" } as any));
    expect(h.sourceLine).toContain("Ratified and adopted as filed");
    expect(h.postFilingNote).toBeTruthy();
  });
  it("shows Pending Review when no review date is recorded", () => {
    expect(buildStatementHeader(base()).boardReviewedLine).toContain("Pending Review");
  });
});

describe("period derivation", () => {
  it("derives the period from the company fiscal year end", () => {
    const p = derivePeriod("06-30", 2025);
    expect(p).toEqual({ start: "2024-07-01", end: "2025-06-30", usedCalendarFallback: false });
  });
  it("falls back to the calendar year when no fiscal year end is set", () => {
    const p = derivePeriod(null, 2025);
    expect(p).toEqual({ start: "2025-01-01", end: "2025-12-31", usedCalendarFallback: true });
  });
  it("uses typed dates only for an irregular period", () => {
    const s = { fiscal_year: 2025, has_irregular_period: true, period_start: "2025-03-01", period_end: "2025-12-31" };
    expect(resolvePeriod(s, "06-30")).toEqual({ start: "2025-03-01", end: "2025-12-31" });
    expect(resolvePeriod({ ...s, has_irregular_period: false }, "06-30")).toEqual({
      start: "2024-07-01",
      end: "2025-06-30",
    });
  });
});

describe("source consistency", () => {
  it("nudges when the source and filing date disagree", () => {
    expect(sourceConsistencyNote("tax_return", null)).toContain("No filing date entered.");
    expect(sourceConsistencyNote("internal", "2025-06-01")).toContain("A filing date is recorded.");
    expect(sourceConsistencyNote("audited_financials", null)).toBeNull();
    expect(sourceConsistencyNote("tax_return", "2025-06-01")).toBeNull();
  });
});

describe("board review provenance", () => {
  it("notes a legacy manually entered review date", () => {
    const s = base({ board_reviewed_date: "2025-05-01" } as any);
    expect(isManualReviewDate(s)).toBe(true);
    expect(buildStatementHeader(s).boardReviewedLine).toContain(MANUAL_REVIEW_DATE_NOTE);
  });
  it("stays clean when the review date comes from a meeting", () => {
    const s = base({ board_reviewed_date: "2025-05-01", board_review_meeting_id: "m1" } as any);
    expect(isManualReviewDate(s)).toBe(false);
    expect(buildStatementHeader(s).boardReviewedLine).not.toContain(MANUAL_REVIEW_DATE_NOTE);
  });
  it("uses the selected source rather than the retired audited flag", () => {
    const h = buildStatementHeader(
      base({ is_audited: false, source_tags: { total_revenue: "audited_financials" } } as any),
    );
    expect(h.sourceLine).toBe("Source: Audited Financial Statements");
  });
});

describe("misc", () => {
  it("computes year-over-year percentages and guards divide by zero", () => {
    expect(yoyPercent(150, 100)).toBeCloseTo(50);
    expect(yoyPercent(150, 0)).toBeNull();
  });
  it("pluralizes the entity-type warning", () => {
    expect(entityTypeChangeWarning(1)).toContain("1 saved financial statement.");
    expect(entityTypeChangeWarning(3)).toContain("3 saved financial statements");
  });
});
