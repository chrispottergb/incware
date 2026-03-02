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
  const trust = { holderId: "trust-1", holderName: "Smith Family Trust" };

  // --- Initial Issuance ---
  it("initial issuance assigns C-001 with structured record", () => {
    const engine = new CertificateEngine();
    const result = engine.issueInitial({
      eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 1000,
      consideration: "$50,000 cash", statute: "§ 180.0601",
    });
    expect(result.certificates).toHaveLength(1);
    expect(result.certificates[0].certNumber).toBe("C-001");
    expect(result.certificates[0].status).toBe("active");
    expect(result.record.eventType).toBe("initial_issuance");
    expect(result.record.surrendered).toHaveLength(0);
    expect(result.record.issued).toHaveLength(1);
    expect(result.record.issued[0].purpose).toBe("issuance");
    expect(result.record.metadata.consideration).toBe("$50,000 cash");
    expect(result.record.metadata.statute).toBe("§ 180.0601");
  });

  // --- Partial Transfer ---
  it("partial transfer surrenders source and issues buyer + remainder certs", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 1000 });

    const result = engine.transfer({
      eventId: "evt-2", date: "2025-03-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 300,
      consideration: "$15,000 cash",
    });

    expect(result.record.eventType).toBe("partial_transfer");
    expect(result.record.surrendered).toHaveLength(1);
    expect(result.record.surrendered[0].certNumber).toBe("C-001");
    expect(result.record.issued).toHaveLength(2);
    expect(result.record.issued[0].purpose).toBe("transferee");
    expect(result.record.issued[0].units).toBe(300);
    expect(result.record.issued[1].purpose).toBe("remainder");
    expect(result.record.issued[1].units).toBe(700);

    expect(engine.findCertByNumber("C-001")?.status).toBe("surrendered");
    expect(engine.findCertByNumber("C-002")?.holderName).toBe("Bob Jones");
    expect(engine.findCertByNumber("C-003")?.units).toBe(700);
  });

  // --- Full Transfer ---
  it("full transfer produces no remainder cert", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...bob, unitClass: "Common", units: 300 });

    const result = engine.transfer({
      eventId: "evt-2", date: "2025-04-01",
      fromHolderId: "bob", fromHolderName: "Bob Jones",
      toHolderId: "charlie", toHolderName: "Charlie Doe",
      unitClass: "Common", units: 300,
    });

    expect(result.record.eventType).toBe("full_transfer");
    expect(result.record.issued).toHaveLength(1);
    expect(result.record.issued[0].purpose).toBe("transferee");
  });

  // --- Partial Redemption ---
  it("partial redemption surrenders cert and issues remainder", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 700 });

    const result = engine.redeem({
      eventId: "evt-2", date: "2025-05-01", ...alice, unitClass: "Common", units: 200,
      consideration: "$10,000 cash",
    });

    expect(result.record.eventType).toBe("partial_redemption");
    expect(result.record.surrendered).toHaveLength(1);
    expect(result.record.issued).toHaveLength(1);
    expect(result.record.issued[0].purpose).toBe("remainder");
    expect(result.record.issued[0].units).toBe(500);
  });

  // --- Full Redemption ---
  it("full redemption produces no remainder cert", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 500 });

    const result = engine.redeem({
      eventId: "evt-2", date: "2025-05-15", ...alice, unitClass: "Common", units: 500,
    });

    expect(result.record.eventType).toBe("full_redemption");
    expect(result.record.surrendered).toHaveLength(1);
    expect(result.record.issued).toHaveLength(0);
  });

  // --- Reclassification ---
  it("reclassification surrenders old class and issues new class + remainder", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "evt-1", date: "2025-01-15", ...alice, unitClass: "Common", units: 500 });

    const result = engine.reclassify({
      eventId: "evt-2", date: "2025-06-01", ...alice, fromClass: "Common", toClass: "Preferred", units: 100,
    });

    expect(result.record.eventType).toBe("reclassification");
    expect(result.record.surrendered).toHaveLength(1);
    expect(result.record.issued).toHaveLength(2);
    expect(result.record.issued[0].purpose).toBe("reclass");
    expect(result.record.issued[0].unitClass).toBe("Preferred");
    expect(result.record.issued[1].purpose).toBe("remainder");
    expect(result.record.issued[1].unitClass).toBe("Common");
  });

  // --- Trust/Entity Restructuring ---
  it("restructure moves all certs for given classes to new holder", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...charlie, unitClass: "Common", units: 200 });
    engine.issueInitial({ eventId: "e2", date: "2025-01-01", ...charlie, unitClass: "Preferred", units: 100 });

    const result = engine.restructure({
      eventId: "evt-3", date: "2025-07-01",
      fromHolderId: "charlie", fromHolderName: "Charlie Doe",
      toHolderId: "trust-1", toHolderName: "Smith Family Trust",
      classes: ["Common", "Preferred"],
      reason: "Transfer to Smith Family Trust per estate plan",
    });

    expect(result.record.eventType).toBe("restructure");
    expect(result.record.surrendered).toHaveLength(2);
    expect(result.record.issued).toHaveLength(2);
    expect(result.record.issued.every(i => i.holder === "Smith Family Trust")).toBe(true);
    expect(result.record.issued.every(i => i.purpose === "restructure")).toBe(true);

    // Charlie has no active certs
    expect(engine.findActiveCert("charlie", "Common")).toBeNull();
    expect(engine.findActiveCert("charlie", "Preferred")).toBeNull();
    // Trust has both
    expect(engine.findActiveCert("trust-1", "Common")?.units).toBe(200);
    expect(engine.findActiveCert("trust-1", "Preferred")?.units).toBe(100);
  });

  it("restructure throws if no active certs found", () => {
    const engine = new CertificateEngine();
    expect(() =>
      engine.restructure({
        eventId: "e1", date: "2025-01-01",
        fromHolderId: "nobody", fromHolderName: "Nobody",
        toHolderId: "trust-1", toHolderName: "Trust",
        classes: ["Common"],
        reason: "test",
      })
    ).toThrow("No active certificates");
  });

  // --- Certificate Consolidation ---
  it("consolidation merges multiple certs into one", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 200 });
    // Create a second cert via partial transfer
    engine.transfer({
      eventId: "e2", date: "2025-02-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 50,
    });
    // Now Alice has remainder C-003 (150) and Bob has C-002 (50)
    // Give Bob another issuance so he has 2 certs
    engine.issueInitial({ eventId: "e3", date: "2025-03-01", ...bob, unitClass: "Common", units: 100 });
    // Bob now has C-002 (50) + C-004 (100)

    const result = engine.consolidate({
      eventId: "evt-4", date: "2025-08-01", ...bob, unitClass: "Common",
    });

    expect(result.record.eventType).toBe("consolidation");
    expect(result.record.surrendered).toHaveLength(2);
    expect(result.record.issued).toHaveLength(1);
    expect(result.record.issued[0].units).toBe(150);
    expect(result.record.issued[0].purpose).toBe("consolidation");
  });

  it("consolidation throws with fewer than 2 certs", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100 });

    expect(() =>
      engine.consolidate({ eventId: "e2", date: "2025-01-01", ...alice, unitClass: "Common" })
    ).toThrow("at least 2");
  });

  // --- Certificate Split ---
  it("split divides one cert into specified amounts", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 250 });

    const result = engine.split({
      eventId: "evt-5", date: "2025-09-01", ...alice, unitClass: "Common",
      splitAmounts: [100, 100, 50],
    });

    expect(result.record.eventType).toBe("split");
    expect(result.record.surrendered).toHaveLength(1);
    expect(result.record.surrendered[0].units).toBe(250);
    expect(result.record.issued).toHaveLength(3);
    expect(result.record.issued.map(i => i.units)).toEqual([100, 100, 50]);
    expect(result.record.issued.every(i => i.purpose === "split")).toBe(true);
  });

  it("split throws if amounts don't sum to cert units", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 250 });

    expect(() =>
      engine.split({ eventId: "e2", date: "2025-01-01", ...alice, unitClass: "Common", splitAmounts: [100, 100] })
    ).toThrow("sum to 200");
  });

  it("split throws with fewer than 2 amounts", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100 });

    expect(() =>
      engine.split({ eventId: "e2", date: "2025-01-01", ...alice, unitClass: "Common", splitAmounts: [100] })
    ).toThrow("at least 2");
  });

  // --- Cross-cutting ---
  it("never reuses certificate numbers across all operations", () => {
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
  });

  it("multi-class certs are independent", () => {
    const engine = new CertificateEngine();
    engine.issueInitial({ eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 1000 });
    engine.issueInitial({ eventId: "e2", date: "2025-01-01", ...alice, unitClass: "Preferred", units: 500 });

    engine.transfer({
      eventId: "e3", date: "2025-02-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 200,
    });

    const prefCert = engine.findActiveCert("alice", "Preferred");
    expect(prefCert).not.toBeNull();
    expect(prefCert!.units).toBe(500);
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

  it("resumes numbering from existing certs", () => {
    const engine = new CertificateEngine([], 5);
    const result = engine.issueInitial({
      eventId: "e1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100,
    });
    expect(result.certificates[0].certNumber).toBe("C-006");
  });

  it("all records include transferId linking back to event", () => {
    const engine = new CertificateEngine();
    const r1 = engine.issueInitial({ eventId: "my-event-1", date: "2025-01-01", ...alice, unitClass: "Common", units: 100 });
    expect(r1.record.transferId).toBe("my-event-1");

    const r2 = engine.transfer({
      eventId: "my-event-2", date: "2025-02-01",
      fromHolderId: "alice", fromHolderName: "Alice Smith",
      toHolderId: "bob", toHolderName: "Bob Jones",
      unitClass: "Common", units: 50,
    });
    expect(r2.record.transferId).toBe("my-event-2");
  });
});
