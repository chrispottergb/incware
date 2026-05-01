import { describe, it, expect } from "vitest";
import {
  buildOwnershipMap,
  classifyLease,
  type ShareTxn,
  type CompanyRelationship,
} from "@/lib/lease-classification";

const txns = (rows: Partial<ShareTxn>[]): ShareTxn[] =>
  rows.map((r) => ({
    company_id: r.company_id!,
    shareholder_id: r.shareholder_id ?? null,
    transaction_type: r.transaction_type ?? "Issuance",
    num_shares: r.num_shares ?? 100,
    effective_date: r.effective_date ?? "2024-01-01",
    status: r.status ?? "active",
  }));

describe("classifyLease", () => {
  it("returns standard when one party is external", () => {
    const r = classifyLease({
      landlord: { kind: "external", name: "Some LLC" },
      tenant: { kind: "company", companyId: "co1" },
      ownership: {},
      relationships: [],
    });
    expect(r.classification).toBe("standard");
  });

  it("detects self-rental when individual owns the tenant company", () => {
    const ownership = buildOwnershipMap(
      txns([{ company_id: "acme", shareholder_id: "john", num_shares: 100 }]),
    );
    const r = classifyLease({
      landlord: { kind: "individual", shareholderId: "john" },
      tenant: { kind: "company", companyId: "acme" },
      ownership,
      relationships: [],
      shareholderNames: { john: "John Smith" },
      companyNames: { acme: "Acme LLC" },
    });
    expect(r.classification).toBe("self_rental");
    expect(r.reason).toMatch(/John Smith/);
    expect(r.reason).toMatch(/100%/);
  });

  it("detects intercompany via explicit relationship", () => {
    const rels: CompanyRelationship[] = [
      { parent_company_id: "parent", child_company_id: "sub", ownership_percentage: 100 },
    ];
    const r = classifyLease({
      landlord: { kind: "company", companyId: "parent" },
      tenant: { kind: "company", companyId: "sub" },
      ownership: {},
      relationships: rels,
    });
    expect(r.classification).toBe("intercompany");
  });

  it("detects intercompany via common controlling owner", () => {
    const ownership = buildOwnershipMap(
      txns([
        { company_id: "co1", shareholder_id: "owner", num_shares: 100 },
        { company_id: "co2", shareholder_id: "owner", num_shares: 100 },
      ]),
    );
    const r = classifyLease({
      landlord: { kind: "company", companyId: "co1" },
      tenant: { kind: "company", companyId: "co2" },
      ownership,
      relationships: [],
    });
    expect(r.classification).toBe("intercompany");
  });

  it("returns standard when no ownership overlap", () => {
    const ownership = buildOwnershipMap(
      txns([
        { company_id: "co1", shareholder_id: "a", num_shares: 100 },
        { company_id: "co2", shareholder_id: "b", num_shares: 100 },
      ]),
    );
    const r = classifyLease({
      landlord: { kind: "company", companyId: "co1" },
      tenant: { kind: "company", companyId: "co2" },
      ownership,
      relationships: [],
    });
    expect(r.classification).toBe("standard");
  });
});
