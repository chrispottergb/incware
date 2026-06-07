/**
 * Shared transaction validation utilities.
 * Pure TypeScript — no React hooks — usable in components and edge functions.
 */
import { supabase } from "@/integrations/supabase/client";
import { getHoldingsByName } from "@/hooks/useShareCalculations";
import type { EntityTerminology } from "@/lib/entity-terminology";

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates that an issuance does not exceed the available (authorized − issued) pool.
 * Returns valid: true if availableShares is null (no cap set).
 */
export function validateIssuanceLimit(
  numShares: number,
  availableShares: number | null,
  term: EntityTerminology
): ValidationResult {
  if (availableShares == null) return { valid: true };
  if (numShares > availableShares) {
    return {
      valid: false,
      message: `Only ${availableShares.toLocaleString()} ${term.shareUnit.toLowerCase()} available to issue.`,
    };
  }
  return { valid: true };
}

/**
 * Validates that the seller holds enough shares/units to complete a transfer.
 * Uses getHoldingsByName from useShareCalculations (pure function, no hooks).
 */
export function validateSellerHoldings(
  sellerName: string,
  numShares: number,
  transactions: any[],
  shareholders: { id: string; name: string }[],
  term: EntityTerminology
): ValidationResult {
  const holdings = getHoldingsByName(transactions, sellerName, shareholders);
  if (numShares > holdings) {
    return {
      valid: false,
      message: `${sellerName} only holds ${holdings.toLocaleString()} ${term.shareUnit.toLowerCase()}. Cannot transfer ${numShares.toLocaleString()}.`,
    };
  }
  return { valid: true };
}

/**
 * @deprecated Prefer `validateMembershipInterestSum` (decimal 0–1) for new code.
 * This function is percent-based (0–100) and remains for legacy LLC member forms.
 * Remove once all call sites migrate to the decimal API.
 *
 * Validates that adding numUnits to the current totalUnits does not exceed 100
 * (percentage-based membership interest tracking for LLCs).
 */
export function validateLLCTotalInterest(
  numUnits: number,
  totalUnits: number
): ValidationResult {
  if (numUnits + totalUnits > 100) {
    return {
      valid: false,
      message: `Total membership interest cannot exceed 100%. Current total: ${totalUnits}%, attempting to add ${numUnits}%.`,
    };
  }
  return { valid: true };
}

/**
 * Validates that a set of LLC member interests (stored as decimals, e.g. 0.50 = 50%)
 * sums to exactly 1.0, within a ±0.0001 floating-point tolerance.
 */
export function validateMembershipInterestSum(
  memberInterestsDecimal: number[]
): ValidationResult {
  const sum = memberInterestsDecimal.reduce((acc, v) => acc + (Number(v) || 0), 0);
  if (Math.abs(sum - 1) > 0.0001) {
    const pct = (sum * 100).toFixed(2);
    return {
      valid: false,
      message: `Member interests must total 100%. Current total: ${pct}%.`,
    };
  }
  return { valid: true };
}

/**
 * Queries the database for the next available certificate number for a company.
 * Always returns MAX(certificate_number) + 1, or 1 if no certificates exist.
 */
export async function getNextCertificateNumber(companyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("stock_certificates")
    .select("certificate_number")
    .eq("company_id", companyId)
    .order("certificate_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Failed to fetch max certificate number:", error);
    return 1;
  }

  const maxCert = data?.[0]?.certificate_number ?? 0;
  return maxCert + 1;
}
