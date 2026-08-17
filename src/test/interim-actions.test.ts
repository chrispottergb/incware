import { describe, it, expect } from "vitest";
import {
  isAlreadyRatified,
  normalizeDescription,
  defaultPeriod,
  inPeriod,
  buildCandidates,
  buildRelatedPartyIndex,
  partitionCandidates,
  sortForPrint,
} from "@/lib/interim-actions";

const cand = (over: Partial<any> = {}) => ({
  sourceTable: "meeting_loans",
  sourceId: "src-1",
  actionDate: "2025-04-01",
  description: "Entered loan with Acme Bank in the amount of $50,000.00",
  ...over,
});

describe("normalizeDescription", () => {
  it("trims, collapses whitespace, lowercases and strips trailing punctuation", () => {
    expect(normalizeDescription("  Entered   Loan with  Acme.  ")).toBe("entered loan with acme");
  });
});

describe("isAlreadyRatified", () => {
  const existing = [{ action_date: "2025-04-01", description: "Entered loan with Acme Bank in the amount of $50,000.00", source_table: "meeting_loans", source_id: "src-1" }];

  it("suppresses identical date + description (cloned row, different source id)", () => {
    expect(isAlreadyRatified(cand({ sourceId: "cloned-2" }), existing)).toBe(true);
  });

  it("does not suppress the same description on a different date", () => {
    expect(isAlreadyRatified(cand({ sourceId: "other", actionDate: "2026-04-01" }), existing)).toBe(false);
  });

  it("suppresses when both dates are NULL and descriptions match", () => {
    const nullExisting = [{ action_date: null, description: "Adopted 401(k) plan with Fidelity", source_table: null, source_id: null }];
    expect(isAlreadyRatified(cand({ sourceTable: "meeting_benefits", sourceId: "b1", actionDate: null, description: "Adopted 401(k) plan with Fidelity" }), nullExisting)).toBe(true);
  });

  it("does not treat a NULL date as matching a real date", () => {
    const nullExisting = [{ action_date: null, description: "Adopted 401(k) plan with Fidelity" }];
    expect(isAlreadyRatified(cand({ actionDate: "2025-01-01", description: "Adopted 401(k) plan with Fidelity" }), nullExisting)).toBe(false);
  });

  it("suppresses when description differs only by case, spacing or a trailing period", () => {
    expect(isAlreadyRatified(cand({ sourceId: "x", description: "entered   loan with ACME bank in the amount of $50,000.00." }), existing)).toBe(true);
  });

  it("suppresses on source identity even if the sentence changed", () => {
    expect(isAlreadyRatified(cand({ description: "Totally different wording" }), existing)).toBe(true);
  });
});

describe("defaultPeriod", () => {
  it("starts the day after the prior annual meeting", () => {
    expect(defaultPeriod({ meeting_date: "2026-05-15", prior_mtg_date: "2025-05-14" })).toEqual({ start: "2025-05-15", end: "2026-05-15" });
  });
  it("falls back to Jan 1 of the tax year", () => {
    expect(defaultPeriod({ meeting_date: "2026-05-15", prior_mtg_date: null, tax_year: 2025 })).toEqual({ start: "2025-01-01", end: "2026-05-15" });
  });
});

describe("inPeriod", () => {
  it("is inclusive of both ends and false for null", () => {
    expect(inPeriod("2025-01-01", "2025-01-01", "2025-12-31")).toBe(true);
    expect(inPeriod("2025-12-31", "2025-01-01", "2025-12-31")).toBe(true);
    expect(inPeriod("2026-01-01", "2025-01-01", "2025-12-31")).toBe(false);
    expect(inPeriod(null, "2025-01-01", "2025-12-31")).toBe(false);
  });
});

describe("buildCandidates", () => {
  const index = buildRelatedPartyIndex([{ name: "John Smith", address: "10 Elm St" }], { address: "1 Main St" });

  it("generates sentences per source table and flags related-party leases", () => {
    const out = buildCandidates(
      {
        assetTransactions: [{ id: "a1", date: "2025-03-02", type: "purchase", description: "2024 Ford F-150", amount: 45000 }],
        leases: [{ id: "l1", lease_start_date: "2025-02-01", description: "Shop building", address_street: "10 Elm St", landlord_name: "John Smith", lease_amount: 2000 }],
        loans: [{ id: "n1", loan_date: "2025-06-01", lender_name: "Acme Bank", loan_amount: 50000 }],
        agreements: [{ id: "g1", agreement_date: "2025-07-04", agreement_type: "Service Agreement", agreement_with: "Vendor Co" }],
        bankSigners: [{ id: "s1", effective_date: "2025-08-01", signer_name: "Jane Doe", bank_id: "b1" }],
        benefits: [{ id: "e1", new_plan_effective_date: "2025-09-01", benefit_type: "401(k)", provider: "Fidelity" }],
        bankNamesById: { b1: "First National" },
      },
      index,
    );
    expect(out.map((c) => c.description)).toEqual([
      "Purchased 2024 Ford F-150",
      "Leased Shop building at 10 Elm St from John Smith",
      "Entered loan with Acme Bank in the amount of $50,000.00",
      "Executed Service Agreement with Vendor Co",
      "Added Jane Doe as authorized signer on First National",
      "Adopted 401(k) plan with Fidelity",
    ]);
    expect(out[1].isRelatedParty).toBe(true);
    expect(out[0].isRelatedParty).toBe(false);
  });

  it("branches asset transaction wording on type", () => {
    const out = buildCandidates(
      { assetTransactions: [
        { id: "1", type: "vehicle_sale", description: "2019 Ram 1500", date: "2025-01-01" },
        { id: "2", type: "lease", description: "Excavator", date: "2025-01-02" },
        { id: "3", type: "lease_termination", description: "Excavator", date: "2025-01-03" },
      ] },
      index,
    );
    expect(out.map((c) => c.description)).toEqual([
      "Sold 2019 Ram 1500",
      "Entered lease for Excavator",
      "Terminated lease for Excavator",
    ]);
  });
});

describe("partitionCandidates", () => {
  const base = [
    { sourceTable: "meeting_loans", sourceId: "n1", actionDate: "2025-06-01", description: "Entered loan with Acme Bank", amount: 1, category: "Loan" as const, isRelatedParty: false },
    { sourceTable: "meeting_loans", sourceId: "cloned-n1", actionDate: "2025-06-01", description: "Entered loan with Acme Bank", amount: 1, category: "Loan" as const, isRelatedParty: false },
    { sourceTable: "agreements", sourceId: "g1", actionDate: "2027-01-01", description: "Executed X with Y", amount: null, category: "Agreement" as const, isRelatedParty: false },
    { sourceTable: "company_assets", sourceId: "l1", actionDate: "2025-02-01", description: "Leased shop from owner", amount: null, category: "Lease" as const, isRelatedParty: true },
    { sourceTable: "asset_transactions", sourceId: "a1", actionDate: "2025-03-01", description: "Purchased truck", amount: null, category: "Asset" as const, isRelatedParty: false },
  ];

  it("filters by period, dedupes clones, splits related party and consented items", () => {
    const res = partitionCandidates(base, {
      start: "2025-01-01",
      end: "2025-12-31",
      existingActions: [],
      consentedSources: { "asset_transactions:a1": "2025-03-05" },
    });
    expect(res.candidates.map((c) => c.sourceId)).toEqual(["n1"]);
    expect(res.relatedParty.map((c) => c.sourceId)).toEqual(["l1"]);
    expect(res.alreadyDocumented).toEqual([{ candidate: base[4], consentDate: "2025-03-05" }]);
  });

  it("suppresses a cloned meeting-scoped row already captured in a prior year", () => {
    const res = partitionCandidates(base, {
      start: "2025-01-01",
      end: "2027-12-31",
      existingActions: [{ action_date: "2025-06-01", description: "entered loan with acme bank." }],
    });
    expect(res.candidates.map((c) => c.sourceId)).toEqual(["a1", "g1"]);
  });
});

describe("sortForPrint", () => {
  it("sorts ascending with undated last", () => {
    const rows = [{ action_date: null }, { action_date: "2025-05-01" }, { action_date: "2025-01-01" }];
    expect(sortForPrint(rows).map((r) => r.action_date)).toEqual(["2025-01-01", "2025-05-01", null]);
  });
});
