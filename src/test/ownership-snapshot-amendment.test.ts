import { describe, it, expect } from "vitest";
import {
  analyzePreExistingLedger,
  type PriorLedgerRow,
} from "@/lib/ownership-snapshot";

/**
 * Client-side half of the amendment work.
 *
 * The transactional core lives in the `amend_ownership_snapshot` Postgres
 * function; its rollback, chaining and post-amendment behavior are exercised
 * against the real database (see scripts under /tmp/browser during
 * verification) because those guarantees are transactional and cannot be
 * meaningfully simulated in-process. What is testable here is the guard that
 * decides whether an amendment is allowed to proceed at all.
 */
const PRIOR_ROWS: PriorLedgerRow[] = [
  {
    id: "tx-old-1",
    transaction_type: "membership_issuance",
    entry_type: "opening_balance",
    effective_date: "2020-12-31",
    num_shares: 55,
    status: "active",
  },
  {
    id: "tx-old-2",
    transaction_type: "membership_issuance",
    entry_type: "opening_balance",
    effective_date: "2020-12-31",
    num_shares: 45,
    status: "active",
  },
];

describe("analyzePreExistingLedger — amendment mode", () => {
  it("blocks a plain re-lock over the prior snapshot's rows", () => {
    const a = analyzePreExistingLedger(PRIOR_ROWS, "2026-01-02");
    expect(a.blocked).toBe(true);
    expect(a.priorCount).toBe(2);
    expect(a.priorNet).toBe(100);
  });

  it("does not block when those same rows belong to the snapshot being superseded", () => {
    const a = analyzePreExistingLedger(PRIOR_ROWS, "2026-01-02", {
      supersededTransactionIds: ["tx-old-1", "tx-old-2"],
    });
    expect(a.blocked).toBe(false);
    expect(a.priorCount).toBe(0);
    expect(a.message).toBe("");
  });

  it("still blocks on unrelated live activity during an amendment", () => {
    const rows: PriorLedgerRow[] = [
      ...PRIOR_ROWS,
      {
        id: "tx-transfer",
        transaction_type: "transfer",
        effective_date: "2024-05-01",
        num_shares: 10,
        status: "active",
      },
    ];
    const a = analyzePreExistingLedger(rows, "2026-01-02", {
      supersededTransactionIds: ["tx-old-1", "tx-old-2"],
    });
    expect(a.blocked).toBe(true);
    expect(a.priorCount).toBe(1);
    expect(a.message).toContain("double-count");
  });

  it("still ignores corrected rows regardless of mode", () => {
    const rows = PRIOR_ROWS.map((r) => ({ ...r, status: "corrected" }));
    expect(analyzePreExistingLedger(rows, "2026-01-02").blocked).toBe(false);
  });

  it("warns without blocking on activity dated after the amendment", () => {
    const rows: PriorLedgerRow[] = [
      ...PRIOR_ROWS,
      { id: "tx-later", transaction_type: "transfer", effective_date: "2026-06-01", num_shares: 5 },
    ];
    const a = analyzePreExistingLedger(rows, "2026-01-02", {
      supersededTransactionIds: ["tx-old-1", "tx-old-2"],
    });
    expect(a.blocked).toBe(false);
    expect(a.laterCount).toBe(1);
    expect(a.message).toContain("after 2026-01-02");
  });
});
