/**
 * Canonical share-transaction type classification.
 *
 * These lists were previously copy-pasted across several modules and had
 * drifted apart. They are consolidated here so snapshot-aware ownership work
 * cannot make one screen disagree with another.
 *
 * Each named export preserves the exact membership its call site had before
 * consolidation. Where a site deliberately narrows the canonical list, the
 * reason is documented on that export. Widening any of these is a behavior
 * change and must be a deliberate, separate decision — not a side effect of a
 * refactor.
 */

/** Canonical: every type that increases units/shares outstanding. */
export const ISSUANCE_TYPES = [
  "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
  "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
  "treasury_reissue", "Reissuance", "reissuance",
  "Capital Contribution", "Initial Contribution", "initial_contribution",
  "additional_contribution", "membership_issuance", "opening_balance",
];

/** Canonical: every type that decreases units/shares outstanding. */
export const REDUCTION_TYPES = [
  "Redemption", "redemption", "Cancellation", "cancellation", "Return of Capital",
  "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
];

/** Canonical: every type that moves units/shares between owners. */
export const TRANSFER_TYPES = [
  "transfer", "interest_transfer", "interest_assignment", "gift",
  "share_exchange", "Transfer In", "Transfer Out",
];

/**
 * Unified ledger view. Identical to canonical except it omits the capitalized
 * "Reissuance" spelling, which no row in this codebase writes — the writers all
 * emit the lowercase form. Kept narrow to preserve the view's current output.
 */
export const UNIFIED_LEDGER_ISSUANCE_TYPES = ISSUANCE_TYPES.filter(
  (t) => t !== "Reissuance"
);

/** Unified ledger view: canonical reductions. */
export const UNIFIED_LEDGER_REDUCTION_TYPES = REDUCTION_TYPES;

/**
 * Transfer ledger view. Omits both "Reissuance" spellings on purpose:
 * reissuance is a certificate-lifecycle step of a transfer already rendered as
 * part of that transfer, so counting it here would double-count the units.
 * See CERT_LIFECYCLE_TYPES in TransferLedgerTab.
 */
export const TRANSFER_LEDGER_ISSUANCE_TYPES = ISSUANCE_TYPES.filter(
  (t) => t !== "Reissuance" && t !== "reissuance"
);

/**
 * Transfer ledger view. Omits "Cancellation"/"cancellation" on purpose, for the
 * same reason: cancellation is the surrender half of a transfer, handled by
 * CERT_LIFECYCLE_TYPES rather than as a standalone reduction row.
 */
export const TRANSFER_LEDGER_REDUCTION_TYPES = REDUCTION_TYPES.filter(
  (t) => t !== "Cancellation" && t !== "cancellation"
);

/**
 * Lease related-party detection. Deliberately narrow: it only needs to know
 * whether a lease counterparty holds any equity at all, and it ignores
 * name-based transfers entirely (see lease-classification.ts). Widening it
 * would change compliance classifications, so it stays as-is until that module
 * gains full transfer support.
 */
export const LEASE_ISSUE_TYPES = new Set([
  "Issuance",
  "Capital Contribution",
  "Initial Contribution",
  "initial_issuance",
  "initial_contribution",
  "opening_balance",
]);

/** Lease related-party detection. Narrow counterpart to LEASE_ISSUE_TYPES. */
export const LEASE_REDEEM_TYPES = new Set([
  "Redemption",
  "Cancellation",
  "Return of Capital",
  "redemption",
]);
