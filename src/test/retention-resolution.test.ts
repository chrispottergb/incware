import { describe, it, expect } from "vitest";
import {
  getResolutionTypesFor,
  RETENTION_RESOLUTION_LABEL,
  resolveRetentionDisplayLabel,
} from "@/lib/resolution-types";
import {
  distributionTotal,
  disproportionateDistributions,
} from "@/components/meeting/RetentionResolutionPanel";

describe("Retention resolution canonical type", () => {
  it("is available for Corporation and inherited by derived S list", () => {
    const corp = getResolutionTypesFor("Corporation", false);
    expect(corp.some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);

    const sCorp = getResolutionTypesFor("S-Corp", true);
    expect(sCorp.some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);
  });

  it("is available for LLC, Single Member LLC, LLC-S, and Partnership", () => {
    expect(getResolutionTypesFor("LLC", false).some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);
    expect(getResolutionTypesFor("Single Member LLC", false).some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);
    expect(getResolutionTypesFor("LLC-S", true).some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);
    expect(getResolutionTypesFor("Partnership", false).some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(true);
  });

  it("is excluded from Non-Profit", () => {
    expect(getResolutionTypesFor("Non-Profit", false).some((r) => r.label === RETENTION_RESOLUTION_LABEL)).toBe(false);
  });
});

describe("resolveRetentionDisplayLabel", () => {
  it("uses Corporation-specific labels", () => {
    expect(resolveRetentionDisplayLabel("Corporation", false)).toBe("Retention of Earnings");
    expect(resolveRetentionDisplayLabel("Corporation", true)).toBe("Distributions and Retention of Earnings");
  });

  it("uses LLC/LLC-S/Partnership label", () => {
    expect(resolveRetentionDisplayLabel("LLC", false)).toBe("Distributions to Members");
    expect(resolveRetentionDisplayLabel("LLC-S", true)).toBe("Distributions to Members");
    expect(resolveRetentionDisplayLabel("Partnership", false)).toBe("Distributions to Members");
  });

  it("uses Single Member LLC label", () => {
    expect(resolveRetentionDisplayLabel("Single Member LLC", false)).toBe("Distributions to Member");
  });
});

describe("distributionTotal and disproportionateDistributions", () => {
  it("sums positive distribution_amount values", () => {
    expect(
      distributionTotal([
        { distribution_amount: 100 },
        { distribution_amount: 50 },
        { distribution_amount: 0 },
        { distribution_amount: null },
      ])
    ).toBe(150);
  });

  it("flags disproportionate distributions", () => {
    const holders = [
      { shareholder_name: "A", distribution_amount: 75, preferred_shares: 50 },
      { shareholder_name: "B", distribution_amount: 25, preferred_shares: 50 },
    ];
    const result = disproportionateDistributions(holders, 0.05);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.name)).toContain("A");
    expect(result.map((r) => r.name)).toContain("B");
  });
});
