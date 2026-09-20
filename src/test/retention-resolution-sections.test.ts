import { describe, it, expect } from "vitest";
import {
  RETENTION_RESOLUTION_LABEL,
  getResolutionTypesFor,
  resolveMeetingResolutionSections,
} from "@/lib/resolution-types";

const retention = { purpose: RETENTION_RESOLUTION_LABEL, resolution_text: "x" };
const other = { purpose: "Approve Budget", resolution_text: "y" };

describe("retention resolution sections", () => {
  it("prints the retention section with zero shareholder rows (no block dependency)", () => {
    const s = resolveMeetingResolutionSections([], true);
    expect(s.retentionSection).toBe(true);
    expect(s.orderedPurposes).toEqual([RETENTION_RESOLUTION_LABEL]);
  });

  it("renders it exactly once when a structured record exists", () => {
    const s = resolveMeetingResolutionSections([retention, other], true);
    expect(s.orderedPurposes.filter((p) => p === RETENTION_RESOLUTION_LABEL)).toHaveLength(1);
    expect(s.orderedPurposes).toEqual([RETENTION_RESOLUTION_LABEL, "Approve Budget"]);
  });

  it("still prints a free-text retention row (written consent) with no structured record", () => {
    const s = resolveMeetingResolutionSections([retention], false);
    expect(s.retentionSection).toBe(false);
    expect(s.orderedPurposes).toEqual([RETENTION_RESOLUTION_LABEL]);
  });

  it("section order does not shift with unrelated rows", () => {
    const s = resolveMeetingResolutionSections([other, retention], true);
    expect(s.orderedPurposes[0]).toBe(RETENTION_RESOLUTION_LABEL);
  });

  it("no adopted resolution is ever dropped from the ordered list", () => {
    const rows = [other, retention, { purpose: "Elect Officers" }];
    const s = resolveMeetingResolutionSections(rows, true);
    expect(s.orderedPurposes).toHaveLength(3);
  });

  it("is not offered on nonprofit entities", () => {
    const labels = getResolutionTypesFor("Non-Profit", false, true).map((r) => r.label);
    expect(labels).not.toContain(RETENTION_RESOLUTION_LABEL);
  });

  it("remains offered on for-profit entities", () => {
    for (const t of ["Corporation", "LLC", "Single Member LLC", "Partnership"]) {
      expect(getResolutionTypesFor(t, false).map((r) => r.label)).toContain(RETENTION_RESOLUTION_LABEL);
    }
  });

  it("an existing nonprofit record keeps the adopted resolution", () => {
    const s = resolveMeetingResolutionSections([retention], false);
    expect(s.orderedPurposes).toContain(RETENTION_RESOLUTION_LABEL);
  });
});
