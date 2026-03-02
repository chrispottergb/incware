import { describe, it, expect } from "vitest";
import {
  CertificateEngine,
  formatCertNumber,
} from "@/lib/certificate-engine";

describe("formatCertNumber", () => {
  it("pads to 3 digits", () => {
    expect(formatCertNumber(1)).toBe("C-001");
    expect(formatCertNumber(42)).toBe("C-042");
    expect(formatCertNumber(999)).toBe("C-999");
    expect(formatCertNumber(1000)).toBe("C-1000");
  });
});

describe("CertificateEngine", () => {
  const alice = { holderId: "alice", holderName: "Alice Smith" };
  const bob = { holderId: "bob", holderName: "Bob Jones" };
  const charlie = { holderId: "charlie", holderName: "Charlie Doe" };

  it("initial issuance assigns C-001", () => {
    const engine = new CertificateEngine();
    const result = engine.issueInitial({
      eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 1000,
    });
    expect(result.certificates).toHaveLength(1);
    expect(result.certificates[0].certNumber).toBe("C-001");
    expect(result.certificates[0].status).toBe("active");
    expect(result.certificates[0].units).toBe(1000);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].eventType).toBe("initial_issuance");
  });

  it("partial transfer surrenders source and issues buyer + remainder certs", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 1000 });

    const result = engine.transfer({
      eventId: "evt-2", date: "2025-03-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 300,
    });

    // 3 events: surrender + transfer_issue + remainder_issue
    expect(result.events).toHaveLength(3);
    expect(result.events[0].eventType).toBe("surrender");
    expect(result.events[0].certNumber).toBe("C-001");
    expect(result.events[1].eventType).toBe("transfer_issue");
    expect(result.events[1].certNumber).toBe("C-002");
    expect(result.events[1].units).toBe(300);
    expect(result.events[2].eventType).toBe("remainder_issue");
    expect(result.events[2].certNumber).toBe("C-003");
    expect(result.events[2].units).toBe(700);

    // C-001 surrendered
    expect(engine.findCertByNumber("C-001")?.status).toBe("surrendered");
    // C-002 active for Bob
    expect(engine.findCertByNumber("C-002")?.status).toBe("active");
    expect(engine.findCertByNumber("C-002")?.holderName).toBe("Bob Jones");
    // C-003 active for Alice remainder
    expect(engine.findCertByNumber("C-003")?.status).toBe("active");
    expect(engine.findCertByNumber("C-003")?.units).toBe(700);
  });

  it("full transfer produces no remainder cert", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...bob, unitClass: "Common", units: 300 });

    const result = engine.transfer({
      eventId: "evt-2", date: "2025-04-01",
      fromHolderId: "bob", fromHolderName: "Bob Jones",
      toHolderId: "charlie", toHolderName: "Charlie Doe",
      unitClass: "Common", units: 300,
    });

    expect(result.events).toHaveLength(2); // surrender + transfer_issue, no remainder
    expect(result.events.find(e => e.eventType === "remainder_issue")).toBeUndefined();
  });

  it("redemption surrenders cert and issues remainder", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 700 });

    const result = engine.redeem({
      eventId: "evt-2", date: "2025-05-01", ...alice, unitClass: "Common", units: 200,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0].eventType).toBe("redemption_surrender");
    expect(result.events[1].eventType).toBe("remainder_issue");
    expect(result.events[1].units).toBe(500);
  });

  it("reclassification surrenders old class and issues new class + remainder", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 500 });

    const result = engine.reclassify({
      eventId: "evt-2", date: "2025-06-01", ...alice, fromClass: "Common", toClass: "Preferred", units: 100,
    });

    expect(result.events).toHaveLength(3);
    expect(result.events[0].eventType).toBe("reclassification_surrender");
    expect(result.events[1].eventType).toBe("reclassification_issue");
    expect(result.events[1].unitClass).toBe("Preferred");
    expect(result.events[1].units).toBe(100);
    expect(result.events[2].eventType).toBe("remainder_issue");
    expect(result.events[2].unitClass).toBe("Common");
    expect(result.events[2].units).toBe(400);
  });

  it("never reuses certificate numbers", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100 });
    engine.issueInitial({ eventId: "e2", date: "2025-01-01", ...bob, unitClass: "Preferred", units: 50 });
    engine.transfer({
      eventId: "e3", date: "2025-02-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "charlie", toHolderName: "Charlie Doe",
      unitClass: "Common", units: 50,
    });

    const allNums = engine.getCertificates().map(c => c.certNumber);
    const unique = new Set(allNums);
    expect(unique.size).toBe(allNums.length);
    // C-001 (alice Common), C-002 (bob Preferred), C-003 (alice surrendered), C-004 (charlie buyer), C-005 (alice remainder)
    // Wait — 50/100 partial: surrender C-001, issue C-003 (charlie 50), C-004 (alice remainder 50)
    // Total: C-001, C-002, C-003, C-004
    expect(allNums).toEqual(["C-001", "C-002", "C-003", "C-004"]);
  });

  it("multi-class certs are independent", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 1000 });
    engine.issueInitial({ eventId: "e2", date: "2025-01-01", ...alice, unitClass: "Preferred", units: 500 });

    // Transfer Common only — Preferred cert unaffected
    engine.transfer({
      eventId: "e3", date: "2025-02-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 200,
    });

    const prefCert = engine.findActiveCert("alice", "Preferred");
    expect(prefCert).not.toBeNull();
    expect(prefCert!.units).toBe(500); // unchanged
    expect(prefCert!.certNumber).toBe("C-002");
  });

  it("throws when transferring more units than cert holds", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100 });

    expect(() =>
      engine.transfer({
        eventId: "e2", date: "2025-02-01",
        fromHolderId: "alice", fromHolderName: "Alice Smith",
        toHolderId: "bob", toHolderName: "Bob Jones",
        unitClass: "Common", units: 150,
      })
    ).toThrow("Cannot transfer 150 units");
  });

  it("links events to certificates via linkedEventId", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 1000 });

    const cert = engine.findCertByNumber("C-001")!;
    expect(cert.linkedEventId).toBe("evt-1");
  });

  it("resumes numbering from existing certs", () => {
    const engine = new CertificateEngine([], 5); // highest existing is 5
    const result = engine.issueInitial({
      eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100,
    });
    expect(result.certificates[0].certNumber).toBe("C-006");
  });
});
