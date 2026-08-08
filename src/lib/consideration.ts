/**
 * Shared consideration-type helpers.
 *
 * Rule (applies to every entity type and every form that pairs a
 * "Consideration Type" select with a "Consideration Amount ($)" input):
 *  - Gift  -> amount is forced to "0.00", the input is disabled, and the
 *             standard "required" validation is skipped.
 *  - Away from Gift -> amount is cleared (empty, not "0.00") and re-enabled.
 *  - Any other switch leaves the current amount untouched.
 */

/** True when the given consideration type represents a gift (case/format insensitive). */
export function isGiftConsideration(type?: string | null): boolean {
  return (type || "").trim().toLowerCase() === "gift";
}

/**
 * Returns the consideration amount that should be shown after the type changes
 * from `prevType` to `nextType`.
 */
export function considerationAmountForTypeChange(
  nextType: string,
  prevType: string | null | undefined,
  currentAmount: string
): string {
  if (isGiftConsideration(nextType)) return "0.00";
  if (isGiftConsideration(prevType)) return "";
  return currentAmount;
}
