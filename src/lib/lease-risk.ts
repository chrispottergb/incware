import type { LeaseClassification } from "@/lib/lease-classification";

export type LeaseRiskLevel = "green" | "yellow" | "red";

export interface RiskInput {
  classification: LeaseClassification;
  marketRentJustified: boolean;
}

export interface RiskResult {
  level: LeaseRiskLevel;
  label: string;
  reason: string;
}

export function computeLeaseRisk({ classification, marketRentJustified }: RiskInput): RiskResult {
  if (classification === "standard") {
    return {
      level: "green",
      label: "Low Risk",
      reason: "Standard arm's-length lease with no related ownership.",
    };
  }
  if (classification === "self_rental" || classification === "intercompany") {
    if (marketRentJustified) {
      return {
        level: "yellow",
        label: "Documented",
        reason: `${classification === "self_rental" ? "Self-rental" : "Intercompany"} lease with market-rent justification on file.`,
      };
    }
    return {
      level: "red",
      label: "Action Needed",
      reason: `${classification === "self_rental" ? "Self-rental" : "Intercompany"} lease without market-rent justification. CPA documentation recommended.`,
    };
  }
  // related_party
  if (marketRentJustified) {
    return {
      level: "yellow",
      label: "Documented",
      reason: "Related-party lease with market-rent justification on file.",
    };
  }
  return {
    level: "yellow",
    label: "Review",
    reason: "Related-party lease — confirm terms reflect market conditions and add justification.",
  };
}

export const RISK_BADGE_CLASS: Record<LeaseRiskLevel, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  red: "bg-destructive/15 text-destructive border-destructive/30",
};

export const LEASE_STRUCTURE_LABELS: Record<string, string> = {
  modified_gross: "Modified Gross",
  gross: "Gross",
  triple_net: "NNN (Triple Net)",
  double_net: "Double Net (NN)",
  single_net: "Single Net (N)",
  absolute_net: "Absolute Net",
  percentage: "Percentage",
  full_service: "Full Service",
};

export const EXPENSE_PARTY_LABELS: Record<string, string> = {
  landlord: "Landlord",
  tenant: "Tenant",
  shared: "Shared",
};

/** Maps Part 1 lease type → defaults for lease_structure + expense responsibility. */
export type LeaseTypeChoice =
  | "gross"
  | "modified_gross"
  | "triple_net"
  | "percentage"
  | "full_service"
  | "auto";

export interface LeaseTypeDefaults {
  lease_structure: string;
  expense_taxes_party: string;
  expense_insurance_party: string;
  expense_maintenance_party: string;
}

export function getLeaseTypeDefaults(choice: LeaseTypeChoice): LeaseTypeDefaults {
  switch (choice) {
    case "gross":
      return { lease_structure: "gross", expense_taxes_party: "landlord", expense_insurance_party: "landlord", expense_maintenance_party: "landlord" };
    case "triple_net":
      return { lease_structure: "triple_net", expense_taxes_party: "tenant", expense_insurance_party: "tenant", expense_maintenance_party: "tenant" };
    case "percentage":
      return { lease_structure: "percentage", expense_taxes_party: "landlord", expense_insurance_party: "landlord", expense_maintenance_party: "shared" };
    case "full_service":
      return { lease_structure: "full_service", expense_taxes_party: "landlord", expense_insurance_party: "landlord", expense_maintenance_party: "landlord" };
    case "auto":
    case "modified_gross":
    default:
      return { lease_structure: "modified_gross", expense_taxes_party: "landlord", expense_insurance_party: "shared", expense_maintenance_party: "shared" };
  }
}
