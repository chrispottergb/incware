/**
 * Shared helpers for the new split-address lease fields.
 *
 * The Add Lease form was restructured to capture Street/City/State/ZIP
 * separately for property, landlord, and tenant addresses. For backwards
 * compatibility with existing rows and downstream consumers (PDF generators,
 * hosted annual review, meeting-flow dialog) the legacy single-string columns
 * (`address`, `landlord_address`, `tenant_address`) are kept and populated on
 * every save as the joined form of the split fields.
 */

export interface SplitAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export const EMPTY_SPLIT_ADDRESS: SplitAddress = {
  street: "",
  city: "",
  state: "",
  zip: "",
};

/**
 * Combine split fields into the legacy `"Street, City, State ZIP"` shape.
 * Returns an empty string when every part is blank so we don't write `", , "`.
 */
export function joinAddress(a: SplitAddress | null | undefined): string {
  if (!a) return "";
  const street = a.street?.trim() || "";
  const city = a.city?.trim() || "";
  const state = a.state?.trim() || "";
  const zip = a.zip?.trim() || "";
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ").trim()]
    .filter(Boolean)
    .join(", ");
  return [street, cityStateZip].filter(Boolean).join(", ");
}

/**
 * Rehydrate the form when opening a lease for edit.
 *
 * - If any split field on the row is populated, use the split values as-is
 *   (they are the source of truth going forward).
 * - Otherwise, if the legacy single string is populated, dump it into the
 *   `street` slot and leave city/state/zip blank. We agreed not to parse
 *   legacy strings (commas inside street lines make it unreliable); the user
 *   re-splits on next edit.
 */
export function splitAddressFallback(
  legacySingle: string | null | undefined,
  split: Partial<SplitAddress> | null | undefined
): SplitAddress {
  const s: SplitAddress = {
    street: split?.street ?? "",
    city: split?.city ?? "",
    state: split?.state ?? "",
    zip: split?.zip ?? "",
  };
  const hasAnySplit = !!(s.street || s.city || s.state || s.zip);
  if (hasAnySplit) return s;
  return { ...EMPTY_SPLIT_ADDRESS, street: legacySingle || "" };
}

/**
 * Tri-state leasehold improvements answer:
 * - "yes"  → company is paying for improvements; amount + description required.
 * - "no"   → company explicitly reports no improvements this period.
 * - null   → not yet answered (legacy rows, and new rows the user hasn't
 *            answered). This must NOT be treated as "no" in reports.
 */
export type LeaseholdStatus = "yes" | "no" | null;

/**
 * Back-compat inference for legacy rows that never got a status recorded.
 * Prefer the explicit `leasehold_improvements_status` when present; only fall
 * back to inferring "yes" from a non-null amount when the status is null AND
 * the row actually has improvement data. Never infer "no" — a blank row on a
 * pre-migration lease is "unanswered", not a No.
 */
export function resolveLeaseholdStatus(row: {
  leasehold_improvements_status?: string | null;
  leasehold_improvement_amount?: number | string | null;
  leasehold_improvement_description?: string | null;
}): LeaseholdStatus {
  const s = row.leasehold_improvements_status;
  if (s === "yes" || s === "no") return s;
  const hasData =
    (row.leasehold_improvement_amount != null && String(row.leasehold_improvement_amount) !== "") ||
    !!row.leasehold_improvement_description;
  return hasData ? "yes" : null;
}
