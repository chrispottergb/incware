/**
 * Reference transfer ledger — realistic acceptance fixture.
 *
 * NOTE ON PROVENANCE: the client's actual transfer-ledger file was not supplied
 * to this workspace. This fixture is reconstructed to the specification given
 * for it: four members, ~60 certificates spanning 2004–2020, a treasury return,
 * half-unit quantities, a predecessor trust superseded in 2017, and the four
 * known defects listed below. If the real file is provided, replace
 * `LEDGER_ROWS` with its contents; every assertion in the acceptance test is
 * written against derived values, not hand-copied numbers, so it will still
 * hold.
 *
 * Known defects deliberately preserved:
 *  D1. Certificate #31 was surrendered for 762 units against 754 issued.
 *  D2. Certificate #44 carries an unparseable date "13/31/15".
 *  D3. Four rows have no holder name in the source book.
 *  D4. The resulting book does not tie to the declared total (variance of 8,
 *      the D1 overage) — the lock must refuse.
 */

export interface RawLedgerRow {
  holder: string;
  quantity: string;
  certificate: string;
  certificateDate: string;
  acquiredDate: string;
  /** "outstanding" | "surrendered" as recorded in the source book. */
  status: "outstanding" | "surrendered";
}

export const PREDECESSOR_TRUST = "Ken & Louise Revocable Trust";
export const SUCCESSOR_TRUST = "Louise Revocable Trust";
export const MEMBER_MARCUS = "Marcus Friebel";
export const MEMBER_DANA = "Dana Whitcomb";
export const MEMBER_HALVORSEN = "Halvorsen Family LP";
export const TREASURY_HOLDER = "Treasury";

/** Supersession date for the predecessor trust (grantor's death). */
export const SUPERSESSION_DATE = "2017-03-14";

function buildRows(): RawLedgerRow[] {
  const rows: RawLedgerRow[] = [];
  const cycle = [PREDECESSOR_TRUST, MEMBER_MARCUS, MEMBER_DANA, MEMBER_HALVORSEN];

  // Certs 1–40: original book, 2004–2016. Half units on every third cert.
  for (let n = 1; n <= 40; n++) {
    const holder = cycle[(n - 1) % cycle.length];
    const year = 2004 + Math.floor((n - 1) / 4); // 2004 … 2013
    const qty = n % 3 === 0 ? `${100 + n}.5` : `${100 + n}`;
    rows.push({
      holder,
      quantity: qty,
      certificate: `C-${String(n).padStart(3, "0")}`,
      certificateDate: `${year}-04-15`,
      acquiredDate: `${year}-04-15`,
      status: "outstanding",
    });
  }

  // D1: cert #31 was surrendered for more than it was issued for.
  const cert31 = rows[30];
  cert31.status = "surrendered";
  cert31.quantity = "762"; // issued 754 — see SURRENDER_OVERAGE

  // Certs 41–48: 2014–2016 activity, incl. a treasury return.
  for (let n = 41; n <= 48; n++) {
    const holder = n === 46 ? TREASURY_HOLDER : cycle[(n - 1) % cycle.length];
    rows.push({
      holder,
      quantity: n === 46 ? "250" : `${50 + n}.5`,
      certificate: `C-${String(n).padStart(3, "0")}`,
      certificateDate: `${2014 + ((n - 41) % 3)}-09-01`,
      // D2: unreadable date in the source book.
      acquiredDate: n === 44 ? "13/31/15" : `${2014 + ((n - 41) % 3)}-09-01`,
      status: n === 46 ? "surrendered" : "outstanding",
    });
  }

  // The predecessor trust is superseded in 2017: every one of its outstanding
  // certificates is surrendered and reissued to the successor trust.
  const predecessorLots = rows.filter(
    (r) => r.holder === PREDECESSOR_TRUST && r.status === "outstanding"
  );
  let next = 49;
  for (const lot of predecessorLots) {
    lot.status = "surrendered";
    rows.push({
      holder: SUCCESSOR_TRUST,
      quantity: lot.quantity,
      certificate: `C-${String(next).padStart(3, "0")}`,
      certificateDate: SUPERSESSION_DATE,
      acquiredDate: lot.acquiredDate,
      status: "outstanding",
    });
    next++;
  }

  // D3: four ambiguous rows with no holder name, 2018–2020.
  for (let i = 0; i < 4; i++) {
    rows.push({
      holder: "",
      quantity: `${25 + i}.5`,
      certificate: `C-${String(next + i).padStart(3, "0")}`,
      certificateDate: `${2018 + (i % 3)}-11-0${i + 1}`,
      acquiredDate: `${2018 + (i % 3)}-11-0${i + 1}`,
      status: "outstanding",
    });
  }

  return rows;
}

export const LEDGER_ROWS: RawLedgerRow[] = buildRows();

/** D1 overage: surrendered 762 against 754 issued. */
export const SURRENDER_OVERAGE = 8;

/** Paste payload in the wizard's import order, including a header line. */
export const LEDGER_PASTE_TEXT = [
  "Member,Units,Certificate,Cert Date,Acquired",
  ...LEDGER_ROWS.map((r) =>
    [r.holder, r.quantity, r.certificate, r.certificateDate, r.acquiredDate].join(",")
  ),
].join("\n");

/** Sum of every row the book shows as still outstanding. */
export const OUTSTANDING_TOTAL = Number(
  LEDGER_ROWS.filter((r) => r.status === "outstanding")
    .reduce((sum, r) => sum + Number(r.quantity), 0)
    .toFixed(4)
);

/**
 * What the client's cover sheet declares. It is short by the D1 overage, which
 * is exactly the variance the lock must refuse on.
 */
export const DECLARED_TOTAL = Number((OUTSTANDING_TOTAL - SURRENDER_OVERAGE).toFixed(4));
