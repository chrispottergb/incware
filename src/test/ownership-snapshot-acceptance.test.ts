import { describe, it, expect } from "vitest";
import {
  analyzePreExistingLedger,
  parsePastedLots,
  reconcileSnapshot,
  validateSnapshot,
  normalizeDateCell,
  parseQuantity,
  type SnapshotLotInput,
} from "@/lib/ownership-snapshot";
import {
  LEDGER_PASTE_TEXT,
  LEDGER_ROWS,
  OUTSTANDING_TOTAL,
  DECLARED_TOTAL,
  SURRENDER_OVERAGE,
  PREDECESSOR_TRUST,
  SUCCESSOR_TRUST,
  TREASURY_HOLDER,
} from "./fixtures/reference-transfer-ledger";

const AS_OF = "2020-12-31";

/** Import the book the way the wizard does, then apply the source book's status column. */
function importLedger() {
  const { lots, skipped } = parsePastedLots(LEDGER_PASTE_TEXT);
  const withStatus: SnapshotLotInput[] = lots.map((lot, i) => ({
    ...lot,
    ownerKey: lot.holderName ? `owner:${lot.holderName}` : "",
    status: LEDGER_ROWS[i].status,
  }));
  return { lots: withStatus, skipped };
}

describe("pre-existing ledger policy", () => {
  it("allows a snapshot when the ledger is empty", () => {
    const a = analyzePreExistingLedger([], AS_OF);
    expect(a.blocked).toBe(false);
    expect(a.message).toBe("");
  });

  it("blocks when transactions already exist on the as-of date (Friebel case)", () => {
    // Friebel Real Estate, LLC as it stands today.
    const friebel = [
      {
        transaction_type: "initial_contribution",
        entry_type: null,
        effective_date: "2026-06-30",
        transaction_date: "2026-06-30",
        num_shares: 100,
        status: "active",
      },
    ];
    const a = analyzePreExistingLedger(friebel, "2026-06-30");
    expect(a.blocked).toBe(true);
    expect(a.priorCount).toBe(1);
    expect(a.priorNet).toBe(100);
    expect(a.message).toContain("double-count");
  });

  it("blocks when transactions exist before the as-of date", () => {
    const a = analyzePreExistingLedger(
      [{ transaction_type: "initial_contribution", effective_date: "2026-06-30", num_shares: 100 }],
      "2026-12-31"
    );
    expect(a.blocked).toBe(true);
  });

  it("warns, but does not block, when all activity is after the as-of date", () => {
    const a = analyzePreExistingLedger(
      [{ transaction_type: "initial_contribution", effective_date: "2026-06-30", num_shares: 100 }],
      "2026-01-01"
    );
    expect(a.blocked).toBe(false);
    expect(a.laterCount).toBe(1);
    expect(a.message).toContain("after 2026-01-01");
  });

  it("ignores corrected rows", () => {
    const a = analyzePreExistingLedger(
      [
        {
          transaction_type: "initial_contribution",
          effective_date: "2026-06-30",
          num_shares: 100,
          status: "corrected",
        },
      ],
      "2026-06-30"
    );
    expect(a.blocked).toBe(false);
  });

  it("nets reductions against issuances in the reported prior position", () => {
    const a = analyzePreExistingLedger(
      [
        { transaction_type: "initial_contribution", effective_date: "2020-01-01", num_shares: 100 },
        { transaction_type: "redemption", effective_date: "2021-01-01", num_shares: 25 },
      ],
      "2021-06-30"
    );
    expect(a.priorNet).toBe(75);
  });

  it("surfaces the block as a hard validation error", () => {
    const lots: SnapshotLotInput[] = [
      {
        ownerKey: "o1",
        holderName: "A",
        quantity: "100",
        certificateLabel: "1",
        certificateDate: "2026-06-30",
        acquiredDate: "2026-06-30",
        acquisitionType: "original_issue",
        transferorDescription: "",
        status: "outstanding",
        notes: "",
      },
    ];
    const rec = reconcileSnapshot(
      lots.map((l) => ({ ownerKey: l.ownerKey, holderName: l.holderName, quantity: 100, status: l.status })),
      100
    );
    const v = validateSnapshot(lots, rec, {
      asOfDate: "2026-06-30",
      existingCertificateNumbers: [],
      authorized: null,
      unitLabel: "Units",
      priorLedger: analyzePreExistingLedger(
        [{ transaction_type: "initial_contribution", effective_date: "2026-06-30", num_shares: 100 }],
        "2026-06-30"
      ),
    });
    expect(v.errors.some((e) => e.includes("double-count"))).toBe(true);
  });
});

describe("date normalization of legacy cells", () => {
  it("rejects 13/31/15 rather than guessing", () => {
    expect(normalizeDateCell("13/31/15")).toBe("");
  });
  it("rejects calendar impossibilities with a four-digit year", () => {
    expect(normalizeDateCell("13/31/2015")).toBe("");
    expect(normalizeDateCell("02/30/2019")).toBe("");
  });
  it("still accepts the good formats", () => {
    expect(normalizeDateCell("6/9/2004")).toBe("2004-06-09");
    expect(normalizeDateCell("2004-06-09")).toBe("2004-06-09");
  });
});

describe("reference transfer ledger — acceptance", () => {
  const { lots, skipped } = importLedger();

  it("imports the whole book, skipping only the header line", () => {
    expect(skipped).toEqual(["Member,Units,Certificate,Cert Date,Acquired"]);
    expect(lots.length).toBe(LEDGER_ROWS.length);
    expect(lots.length).toBeGreaterThanOrEqual(60);
  });

  it("preserves half-unit quantities exactly", () => {
    const halves = lots.filter((l) => !Number.isInteger(parseQuantity(l.quantity)));
    expect(halves.length).toBeGreaterThan(0);
    for (const l of halves) expect(parseQuantity(l.quantity) % 0.5).toBe(0);
  });

  it("derives outstanding lots and excludes every surrendered certificate", () => {
    const rec = reconcileSnapshot(
      lots.map((l) => ({
        ownerKey: l.ownerKey,
        holderName: l.holderName,
        quantity: parseQuantity(l.quantity),
        status: l.status,
      })),
      DECLARED_TOTAL
    );
    expect(rec.computedTotal).toBe(OUTSTANDING_TOTAL);
    expect(rec.surrenderedCount).toBe(
      LEDGER_ROWS.filter((r) => r.status === "surrendered").length
    );
  });

  it("archives the predecessor trust and carries the position to the successor", () => {
    const predecessor = lots.filter((l) => l.holderName === PREDECESSOR_TRUST);
    const successor = lots.filter((l) => l.holderName === SUCCESSOR_TRUST);
    expect(predecessor.length).toBeGreaterThan(0);
    // Every predecessor lot is retired…
    expect(predecessor.every((l) => l.status === "surrendered")).toBe(true);
    // …and the same units are outstanding under the successor.
    const retired = predecessor
      .filter((l) => l.certificateLabel !== "C-031")
      .reduce((s, l) => s + parseQuantity(l.quantity), 0);
    const carried = successor.reduce((s, l) => s + parseQuantity(l.quantity), 0);
    expect(Number(carried.toFixed(4))).toBe(Number(retired.toFixed(4)));
  });

  it("keeps the treasury return out of outstanding ownership", () => {
    const treasury = lots.filter((l) => l.holderName === TREASURY_HOLDER);
    expect(treasury.length).toBe(1);
    expect(treasury[0].status).toBe("surrendered");
  });

  it("flags the malformed rows needs_review instead of dropping them", () => {
    const rec = reconcileSnapshot(
      lots.map((l) => ({
        ownerKey: l.ownerKey,
        holderName: l.holderName,
        quantity: parseQuantity(l.quantity),
        status: l.status,
      })),
      DECLARED_TOTAL
    );
    const v = validateSnapshot(lots, rec, {
      asOfDate: AS_OF,
      existingCertificateNumbers: [],
      authorized: null,
      unitLabel: "Units",
    });

    // D2 — unreadable date kept as evidence on its row.
    const badDateIndex = lots.findIndex((l) => l.certificateLabel === "C-044");
    expect(v.reviewRows[badDateIndex]).toContain("13/31/15");

    // D3 — all four blank-name rows flagged.
    const blankIndexes = lots
      .map((l, i) => (l.holderName ? -1 : i))
      .filter((i) => i >= 0);
    expect(blankIndexes.length).toBe(4);
    for (const i of blankIndexes) expect(v.reviewRows[i]).toContain("Holder name blank");

    // Non-numeric certificate labels ("C-031") still get a review note, not a drop.
    expect(Object.keys(v.reviewRows).length).toBeGreaterThanOrEqual(4);
  });

  it("blocks the lock on the declared-total variance", () => {
    const rec = reconcileSnapshot(
      lots.map((l) => ({
        ownerKey: l.ownerKey,
        holderName: l.holderName,
        quantity: parseQuantity(l.quantity),
        status: l.status,
      })),
      DECLARED_TOTAL
    );
    expect(rec.balanced).toBe(false);
    expect(rec.variance).toBe(SURRENDER_OVERAGE);

    const v = validateSnapshot(lots, rec, {
      asOfDate: AS_OF,
      existingCertificateNumbers: [],
      authorized: null,
      unitLabel: "Units",
    });
    expect(v.errors.some((e) => e.includes("Resolve the variance"))).toBe(true);
    // Unassigned blank-name rows also block until an owner is chosen.
    expect(v.errors.some((e) => e.includes("choose or name a holder"))).toBe(true);
  });
});
