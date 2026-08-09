import { describe, it, expect } from "vitest";
import {
  certificateNumberFromLabel,
  emptyLot,
  normalizeShareClassKey,
  parsePastedLots,
  parseQuantity,
  reconcileSnapshot,
  suggestNextCertificateNumber,
  validateSnapshot,
  type SnapshotLotInput,
} from "@/lib/ownership-snapshot";

const ctx = {
  asOfDate: "2026-01-01",
  existingCertificateNumbers: [] as number[],
  authorized: null as number | null,
  unitLabel: "Units",
};

const lot = (over: Partial<SnapshotLotInput>): SnapshotLotInput => ({ ...emptyLot("o1"), ...over });

describe("quantity parsing", () => {
  it("tolerates separators and rounds to the ledger scale", () => {
    expect(parseQuantity("1,250")).toBe(1250);
    expect(parseQuantity(" 33.333333 ")).toBe(33.3333);
    expect(Number.isNaN(parseQuantity("abc"))).toBe(true);
  });
});

describe("share class keys", () => {
  it("normalizes casing, punctuation and spacing", () => {
    expect(normalizeShareClassKey(" Common ")).toBe("common");
    expect(normalizeShareClassKey("Class-A")).toBe(normalizeShareClassKey("class a"));
  });
});

describe("certificate labels", () => {
  it("derives an integer only from unambiguous labels", () => {
    expect(certificateNumberFromLabel("C-14")).toBe(14);
    expect(certificateNumberFromLabel("7")).toBe(7);
    expect(certificateNumberFromLabel("1998-14")).toBeNull();
    expect(certificateNumberFromLabel("A")).toBeNull();
  });

  it("continues the client's historical numbering", () => {
    expect(suggestNextCertificateNumber([3, 9], ["C-12", "A"])).toBe(13);
    expect(suggestNextCertificateNumber([], [])).toBe(1);
  });
});

describe("reconciliation", () => {
  it("rolls multiple certificates up per holder", () => {
    const r = reconcileSnapshot(
      [
        { ownerKey: "a", holderName: "Louise Trust", quantity: 40, status: "outstanding" },
        { ownerKey: "a", holderName: "Louise Trust", quantity: 20, status: "outstanding" },
        { ownerKey: "b", holderName: "Ken", quantity: 40, status: "outstanding" },
      ],
      "100"
    );
    expect(r.computedTotal).toBe(100);
    expect(r.balanced).toBe(true);
    expect(r.holders.find((h) => h.ownerKey === "a")!.quantity).toBe(60);
    expect(r.holders.find((h) => h.ownerKey === "a")!.percentage).toBe(60);
    expect(r.holders.find((h) => h.ownerKey === "a")!.lotCount).toBe(2);
  });

  it("excludes surrendered certificates from every total", () => {
    const r = reconcileSnapshot(
      [
        { ownerKey: "a", holderName: "A", quantity: 100, status: "outstanding" },
        { ownerKey: "b", holderName: "B", quantity: 50, status: "surrendered" },
      ],
      "100"
    );
    expect(r.computedTotal).toBe(100);
    expect(r.balanced).toBe(true);
    expect(r.surrenderedCount).toBe(1);
    expect(r.holders).toHaveLength(1);
  });

  it("reports the signed variance when out of balance", () => {
    const r = reconcileSnapshot(
      [{ ownerKey: "a", holderName: "A", quantity: 90, status: "outstanding" }],
      "100"
    );
    expect(r.variance).toBe(-10);
    expect(r.balanced).toBe(false);
  });

  it("treats sub-epsilon float drift as balanced", () => {
    const r = reconcileSnapshot(
      [
        { ownerKey: "a", holderName: "A", quantity: 33.3333, status: "outstanding" },
        { ownerKey: "b", holderName: "B", quantity: 33.3333, status: "outstanding" },
        { ownerKey: "c", holderName: "C", quantity: 33.3334, status: "outstanding" },
      ],
      "100"
    );
    expect(r.balanced).toBe(true);
  });
});

describe("validation", () => {
  it("blocks locking when holdings do not reconcile", () => {
    const lots = [lot({ quantity: "90" })];
    const r = reconcileSnapshot(
      [{ ownerKey: "o1", holderName: "A", quantity: 90, status: "outstanding" }],
      "100"
    );
    const v = validateSnapshot(lots, r, ctx);
    expect(v.errors.some((e) => e.includes("declared"))).toBe(true);
  });

  it("blocks dates after the as-of date and duplicate certificates", () => {
    const lots = [
      lot({ quantity: "50", certificateLabel: "C-1", certificateDate: "2026-06-01" }),
      lot({ quantity: "50", certificateLabel: "c-1" }),
    ];
    const r = reconcileSnapshot(
      [
        { ownerKey: "o1", holderName: "A", quantity: 50, status: "outstanding" },
        { ownerKey: "o1", holderName: "A", quantity: 50, status: "outstanding" },
      ],
      "100"
    );
    const v = validateSnapshot(lots, r, ctx);
    expect(v.errors.some((e) => e.includes("cannot be after"))).toBe(true);
    expect(v.errors.some((e) => e.includes("more than once"))).toBe(true);
  });

  it("blocks exceeding authorized units", () => {
    const lots = [lot({ quantity: "150", certificateLabel: "C-1" })];
    const r = reconcileSnapshot(
      [{ ownerKey: "o1", holderName: "A", quantity: 150, status: "outstanding" }],
      "150"
    );
    const v = validateSnapshot(lots, r, { ...ctx, authorized: 100 });
    expect(v.errors.some((e) => e.includes("authorized"))).toBe(true);
  });

  it("flags missing certificate details for review instead of blocking", () => {
    const lots = [lot({ quantity: "100" })];
    const r = reconcileSnapshot(
      [{ ownerKey: "o1", holderName: "A", quantity: 100, status: "outstanding" }],
      "100"
    );
    const v = validateSnapshot(lots, r, ctx);
    expect(v.errors).toHaveLength(0);
    expect(v.reviewRows[0]).toBeTruthy();
  });
});

describe("paste import", () => {
  it("parses tab and comma rows and reports unusable lines", () => {
    const { lots, skipped } = parsePastedLots(
      ["Member,Units,Cert,Date", "Louise Trust, 60, C-3, 3/14/1998", "Ken\t40\tC-4\t1998-03-14"].join("\n")
    );
    expect(lots).toHaveLength(2);
    expect(lots[0].certificateDate).toBe("1998-03-14");
    expect(lots[1].quantity).toBe("40");
    expect(skipped).toHaveLength(1);
  });
});
