/**
 * Opening Ownership Snapshot — Phase 1 (unit basis only).
 *
 * Pure TypeScript. No React, no Supabase — so the same math can be exercised by
 * the golden-master tests and reused by edge functions later.
 *
 * Model recap (see the approved Phase 0 plan):
 *  - `share_transactions` rows with `entry_type = 'opening_balance'` stay the
 *    single authoritative source of ownership. A snapshot NEVER becomes a second
 *    source of truth; it is the audited *entry event* that produced those rows.
 *  - `ownership_snapshot_lots` retains exactly what the operator typed
 *    (certificate label, historical dates, acquisition type) so the reconciliation
 *    can be re-audited years later even after the ledger evolves.
 */

/** Precision of `share_transactions.num_shares` / `ownership_snapshot_lots.entered_quantity`. */
export const QUANTITY_SCALE = 4;
/** Anything at or below this is floating-point noise, not a real variance. */
export const QUANTITY_EPSILON = 0.00005;

export type QuantityBasis = "units" | "shares";
export type EntryTier = "declared_total" | "position_lots" | "full_history";
export type SnapshotStatus = "draft" | "locked" | "amended";
export type LotStatus = "outstanding" | "surrendered";

export const ACQUISITION_TYPES = [
  { value: "original_issue", label: "Original issue" },
  { value: "purchase", label: "Purchase" },
  { value: "transfer", label: "Transfer" },
  { value: "gift", label: "Gift" },
  { value: "inheritance", label: "Inheritance" },
  { value: "contribution", label: "Capital contribution" },
  { value: "conversion", label: "Conversion" },
  { value: "reissue_on_consolidation", label: "Reissue on consolidation" },
  { value: "other", label: "Other" },
] as const;

export interface SnapshotLotInput {
  /** Existing shareholder id, or `new:<key>` for an owner created in this session. */
  ownerKey: string;
  holderName: string;
  /** Raw text as typed; parsed with `parseQuantity`. */
  quantity: string;
  certificateLabel: string;
  certificateDate: string;
  acquiredDate: string;
  acquisitionType: string;
  transferorDescription: string;
  status: LotStatus;
  notes: string;
}

export const emptyLot = (ownerKey = ""): SnapshotLotInput => ({
  ownerKey,
  holderName: "",
  quantity: "",
  certificateLabel: "",
  certificateDate: "",
  acquiredDate: "",
  acquisitionType: "original_issue",
  transferorDescription: "",
  status: "outstanding",
  notes: "",
});

/** Round to the ledger's stored scale so UI sums can never drift from the DB. */
export function roundQuantity(value: number): number {
  const f = 10 ** QUANTITY_SCALE;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Tolerates thousands separators and stray whitespace; returns NaN for junk. */
export function parseQuantity(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return roundQuantity(raw);
  const cleaned = String(raw ?? "").replace(/[,\s]/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? roundQuantity(n) : NaN;
}

/**
 * Share/interest class comparison key. Snapshots and ledger rows are typed by
 * different people at different times ("Common", " common ", "Class A"), so all
 * comparisons go through this — never raw string equality.
 */
export function normalizeShareClassKey(raw?: string | null): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * Certificate numbering is integer-authoritative in `stock_certificates`, but
 * legacy books use labels like "C-014" or "7A". Keep the label verbatim and
 * derive the integer only when the label is unambiguously numeric.
 */
export function certificateNumberFromLabel(label?: string | null): number | null {
  const raw = String(label ?? "").trim();
  if (!raw) return null;
  const digits = raw.match(/\d+/g);
  if (!digits || digits.length !== 1) return null;
  const n = parseInt(digits[0], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface ReconciliationLot {
  ownerKey: string;
  holderName: string;
  quantity: number;
  status: LotStatus;
}

export interface HolderRollup {
  ownerKey: string;
  holderName: string;
  quantity: number;
  /** Percentage of outstanding, 0–100, rounded to 4 dp. Null when total is 0. */
  percentage: number | null;
  lotCount: number;
}

export interface Reconciliation {
  computedTotal: number;
  declaredTotal: number | null;
  /** computed − declared. Positive means the lots add up to more than declared. */
  variance: number | null;
  balanced: boolean;
  holders: HolderRollup[];
  surrenderedCount: number;
}

/**
 * Roll lots up per holder and compare against the operator's declared total.
 * Surrendered lots are evidence only — they never enter any total, mirroring how
 * cancelled certificates are excluded from opening balances elsewhere in the app.
 */
export function reconcileSnapshot(
  lots: ReconciliationLot[],
  declaredTotalRaw: string | number | null | undefined
): Reconciliation {
  const outstanding = lots.filter((l) => l.status === "outstanding" && l.quantity > 0);

  const byOwner = new Map<string, HolderRollup>();
  for (const lot of outstanding) {
    const existing = byOwner.get(lot.ownerKey);
    if (existing) {
      existing.quantity = roundQuantity(existing.quantity + lot.quantity);
      existing.lotCount += 1;
    } else {
      byOwner.set(lot.ownerKey, {
        ownerKey: lot.ownerKey,
        holderName: lot.holderName,
        quantity: roundQuantity(lot.quantity),
        percentage: null,
        lotCount: 1,
      });
    }
  }

  const computedTotal = roundQuantity(
    Array.from(byOwner.values()).reduce((sum, h) => sum + h.quantity, 0)
  );

  const holders = Array.from(byOwner.values()).map((h) => ({
    ...h,
    percentage: computedTotal > 0 ? roundQuantity((h.quantity / computedTotal) * 100) : null,
  }));

  const declaredParsed =
    declaredTotalRaw === null || declaredTotalRaw === undefined || declaredTotalRaw === ""
      ? null
      : parseQuantity(declaredTotalRaw);
  const declaredTotal = declaredParsed !== null && Number.isNaN(declaredParsed) ? null : declaredParsed;

  const variance = declaredTotal === null ? null : roundQuantity(computedTotal - declaredTotal);
  const balanced = variance !== null && Math.abs(variance) <= QUANTITY_EPSILON;

  return {
    computedTotal,
    declaredTotal,
    variance,
    balanced,
    holders,
    surrenderedCount: lots.filter((l) => l.status === "surrendered").length,
  };
}

export interface SnapshotValidationContext {
  asOfDate: string;
  /** Certificate integers already used by this entity. */
  existingCertificateNumbers: number[];
  /** Authorized units/shares, when the entity has a cap set. */
  authorized: number | null;
  /** "Units" | "Shares" — from entity terminology. */
  unitLabel: string;
}

export interface SnapshotValidation {
  errors: string[];
  warnings: string[];
  /** Row indexes flagged for operator review rather than hard-blocked. */
  reviewRows: Record<number, string>;
}

/**
 * Hard errors block the lock. Warnings are recorded on the lot as
 * `needs_review` so an imperfect legacy book can still be captured faithfully
 * instead of forcing the operator to invent clean data.
 */
export function validateSnapshot(
  lots: SnapshotLotInput[],
  reconciliation: Reconciliation,
  ctx: SnapshotValidationContext
): SnapshotValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const reviewRows: Record<number, string> = {};
  const unit = ctx.unitLabel.toLowerCase();

  if (!ctx.asOfDate) errors.push('Select the "as of" date for this snapshot.');

  const usable = lots
    .map((lot, index) => ({ lot, index }))
    .filter(({ lot }) => lot.ownerKey || lot.quantity.trim());

  if (usable.length === 0) errors.push("Add at least one holding.");

  const seenLabels = new Map<string, number>();

  usable.forEach(({ lot, index }) => {
    const row = index + 1;
    if (!lot.ownerKey) errors.push(`Row ${row}: choose or name a holder.`);
    if (lot.ownerKey.startsWith("new:") && !lot.holderName.trim()) {
      errors.push(`Row ${row}: enter the new holder's name.`);
    }

    const qty = parseQuantity(lot.quantity);
    if (Number.isNaN(qty)) errors.push(`Row ${row}: enter a numeric quantity.`);
    else if (qty <= 0) errors.push(`Row ${row}: quantity must be greater than zero.`);

    if (ctx.asOfDate && lot.certificateDate && lot.certificateDate > ctx.asOfDate) {
      errors.push(`Row ${row}: certificate date cannot be after the "as of" date.`);
    }
    if (ctx.asOfDate && lot.acquiredDate && lot.acquiredDate > ctx.asOfDate) {
      errors.push(`Row ${row}: acquisition date cannot be after the "as of" date.`);
    }

    const label = lot.certificateLabel.trim();
    if (label) {
      const key = label.toLowerCase();
      if (seenLabels.has(key)) {
        errors.push(`Certificate "${label}" is entered more than once.`);
      } else {
        seenLabels.set(key, index);
      }
      const asNumber = certificateNumberFromLabel(label);
      if (asNumber !== null && ctx.existingCertificateNumbers.includes(asNumber)) {
        errors.push(`Certificate #${asNumber} already exists for this entity.`);
      }
      if (asNumber === null) {
        reviewRows[index] = "Non-numeric certificate label — kept as text, no ledger number assigned.";
      }
    } else {
      reviewRows[index] = "No certificate number on record — one will be assigned at lock.";
    }

    if (!lot.certificateDate && !lot.acquiredDate) {
      reviewRows[index] = "No original date on record — the snapshot date will be used.";
    }
  });

  if (reconciliation.declaredTotal === null) {
    errors.push(`Enter the declared total ${unit} outstanding so the snapshot can be reconciled.`);
  } else if (!reconciliation.balanced) {
    const diff = reconciliation.variance ?? 0;
    errors.push(
      `Holdings total ${reconciliation.computedTotal.toLocaleString()} ${unit} but ${reconciliation.declaredTotal.toLocaleString()} ${unit} were declared (${diff > 0 ? "+" : ""}${diff.toLocaleString()}). Resolve the variance before locking.`
    );
  }

  if (ctx.authorized != null && reconciliation.computedTotal > ctx.authorized) {
    errors.push(
      `Outstanding ${unit} (${reconciliation.computedTotal.toLocaleString()}) exceed the ${ctx.authorized.toLocaleString()} authorized ${unit}. Increase the authorized amount first.`
    );
  }

  if (Object.keys(reviewRows).length) {
    warnings.push(
      `${Object.keys(reviewRows).length} holding(s) are missing certificate details and will be flagged for review.`
    );
  }

  return { errors: Array.from(new Set(errors)), warnings, reviewRows };
}

/**
 * Next certificate number to hand out after the snapshot, so post-pickup
 * issuances continue the client's historical book instead of restarting at 1.
 */
export function suggestNextCertificateNumber(
  existingCertificateNumbers: number[],
  snapshotLabels: string[]
): number {
  const fromLabels = snapshotLabels
    .map((l) => certificateNumberFromLabel(l))
    .filter((n): n is number => n !== null);
  const all = [...existingCertificateNumbers, ...fromLabels].filter((n) => Number.isFinite(n));
  return all.length ? Math.max(...all) + 1 : 1;
}

/**
 * Paste-and-map for legacy books. Accepts tab- or comma-separated rows in the
 * order: Holder, Quantity, Certificate, Certificate Date, Acquired Date.
 * Unparseable rows are returned as `skipped` rather than silently dropped.
 */
export function parsePastedLots(text: string): { lots: SnapshotLotInput[]; skipped: string[] } {
  const lots: SnapshotLotInput[] = [];
  const skipped: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.includes("\t") ? line.split("\t") : line.split(",");
    const [name, qty, cert, certDate, acqDate] = cells.map((c) => (c ?? "").trim());

    if (!name || !qty || Number.isNaN(parseQuantity(qty))) {
      skipped.push(line);
      continue;
    }
    // Header rows ("Member, Units, ...") never parse as a quantity, so they land
    // in `skipped` above — no special-casing needed.
    lots.push({
      ...emptyLot(""),
      holderName: name,
      quantity: String(parseQuantity(qty)),
      certificateLabel: cert || "",
      certificateDate: normalizeDateCell(certDate),
      acquiredDate: normalizeDateCell(acqDate),
    });
  }

  return { lots, skipped };
}

/** Accepts yyyy-mm-dd and m/d/yyyy; anything else is dropped rather than guessed. */
export function normalizeDateCell(raw?: string): string {
  const value = (raw || "").trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return "";
}
