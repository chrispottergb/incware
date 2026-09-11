import { describe, it, expect } from "vitest";
import { isSElectedOn, isSElectedForTaxYear } from "@/lib/entity-terminology";
import { RESOLUTION_TYPES, getResolutionTypesFor } from "@/lib/resolution-types";

const corp = {
  entity_type: "Corporation",
  s_election_date: "2015-01-01",
  s_revocation_date: "2022-12-31",
  fiscal_year_end: "December 31",
};

describe("isSElectedOn", () => {
  it("is false before the election", () => {
    expect(isSElectedOn(corp, "2014-06-01")).toBe(false);
  });
  it("is true during the election", () => {
    expect(isSElectedOn(corp, "2018-06-01")).toBe(true);
  });
  it("is false on and after the end date", () => {
    expect(isSElectedOn(corp, "2022-12-31")).toBe(false);
    expect(isSElectedOn(corp, "2024-01-15")).toBe(false);
  });
  it("treats LLC-S as always S-taxed", () => {
    expect(isSElectedOn({ entity_type: "LLC-S" }, "1999-01-01")).toBe(true);
  });
  it("is false with no election date", () => {
    expect(isSElectedOn({ entity_type: "LLC" }, "2020-01-01")).toBe(false);
  });
});

describe("isSElectedForTaxYear", () => {
  it("covers a year inside the election window", () => {
    expect(isSElectedForTaxYear(corp, 2018)).toBe(true);
  });
  it("excludes a year before the election", () => {
    expect(isSElectedForTaxYear(corp, 2014)).toBe(false);
  });
  it("excludes a year fully after the election ended", () => {
    expect(isSElectedForTaxYear(corp, 2024)).toBe(false);
  });
  it("respects a non-December fiscal year end", () => {
    const oct = { ...corp, fiscal_year_end: "October 31", s_election_date: "2020-11-15", s_revocation_date: null };
    // FY2020 ends 2020-10-31, before the election
    expect(isSElectedForTaxYear(oct, 2020)).toBe(false);
    expect(isSElectedForTaxYear(oct, 2021)).toBe(true);
  });
});

describe("derived S resolution lists", () => {
  it("S Corporation inherits base Corporation entries that had been dropped", () => {
    const labels = RESOLUTION_TYPES["S Corporation"].map((r) => r.label);
    expect(labels).toContain("Approve Amendments to Bylaws");
    expect(labels).toContain("Approve Merger or Consolidation");
    expect(labels).toContain("Name Directors to Committees");
    expect(labels).toContain("Approve Officer Bonuses (Reasonable Compensation)");
    expect(labels).toContain("Approve Distributions");
    expect(labels).toContain("Revoke S-Election");
    expect(labels).not.toContain("Approve Distributions/Dividends");
  });
  it("LLC-S inherits Adopt Regular Meeting Resolution", () => {
    const labels = RESOLUTION_TYPES["LLC-S"].map((r) => r.label);
    expect(labels).toContain("Adopt Regular Meeting Resolution");
    expect(labels).toContain("Approve Reasonable Compensation");
    expect(labels).toContain("Revoke S-Election");
  });
  it("picks lists by meeting-scoped S status", () => {
    expect(getResolutionTypesFor("Corporation", true)).toBe(RESOLUTION_TYPES["S Corporation"]);
    expect(getResolutionTypesFor("Corporation", false)).toBe(RESOLUTION_TYPES.Corporation);
    expect(getResolutionTypesFor("LLC", true)).toBe(RESOLUTION_TYPES["LLC-S"]);
    expect(getResolutionTypesFor("Single Member LLC", true)).toBe(RESOLUTION_TYPES["Single Member LLC"]);
  });
});
