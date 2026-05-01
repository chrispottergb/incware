// Pure TS lease classification engine.
// Determines lease type from ownership relationships between landlord & tenant.

export type PartyKind = "individual" | "company" | "external";
export type LeaseClassification = "standard" | "related_party" | "self_rental" | "intercompany";

export interface LeaseParty {
  kind: PartyKind;
  /** companies.id when kind='company' */
  companyId?: string | null;
  /** shareholders.id when kind='individual' */
  shareholderId?: string | null;
  /** Display name for explanation strings */
  name?: string | null;
}

/** Minimal share_transactions shape required for ownership calc */
export interface ShareTxn {
  company_id: string;
  shareholder_id: string | null;
  /** lowercased shareholder display name (for transfer-by-name fallback) */
  shareholder_name?: string | null;
  transaction_type: string;
  num_shares: number;
  effective_date: string; // ISO yyyy-mm-dd
  status?: string | null;
}

export interface CompanyRelationship {
  parent_company_id: string;
  child_company_id: string;
  ownership_percentage: number | null;
}

/** A lookup of {companyId -> {shareholderId -> percent}} computed from share_transactions */
export type OwnershipMap = Record<string, Record<string, number>>;

const ISSUE_TYPES = new Set([
  "Issuance",
  "Capital Contribution",
  "Initial Contribution",
  "initial_issuance",
  "initial_contribution",
  "opening_balance",
]);
const REDEEM_TYPES = new Set([
  "Redemption",
  "Cancellation",
  "Return of Capital",
  "redemption",
]);

/**
 * Build an ownership map from share_transactions.
 * Mirrors the SQL recalculate_ownership_percentages logic at a high level
 * (only direct issuance/redemption — name-based transfers are out of scope here
 * for client-side classification; a future improvement can add them).
 */
export function buildOwnershipMap(
  transactions: ShareTxn[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
): OwnershipMap {
  const byCompany: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};

  for (const t of transactions) {
    if (t.status === "corrected") continue;
    if (t.effective_date > asOfDate) continue;
    if (!t.shareholder_id) continue;

    const sign = ISSUE_TYPES.has(t.transaction_type)
      ? 1
      : REDEEM_TYPES.has(t.transaction_type)
        ? -1
        : 0;
    if (sign === 0) continue;

    const units = sign * Number(t.num_shares || 0);
    byCompany[t.company_id] = byCompany[t.company_id] || {};
    byCompany[t.company_id][t.shareholder_id] =
      (byCompany[t.company_id][t.shareholder_id] || 0) + units;
    totals[t.company_id] = (totals[t.company_id] || 0) + units;
  }

  const result: OwnershipMap = {};
  for (const cid of Object.keys(byCompany)) {
    const total = totals[cid] || 0;
    if (total <= 0) continue;
    result[cid] = {};
    for (const sid of Object.keys(byCompany[cid])) {
      const units = byCompany[cid][sid];
      if (units > 0) {
        result[cid][sid] = (units / total) * 100;
      }
    }
  }
  return result;
}

export interface ClassifyInput {
  landlord: LeaseParty;
  tenant: LeaseParty;
  ownership: OwnershipMap;
  relationships: CompanyRelationship[];
  /** Map of shareholder.id -> display name (used for reasons) */
  shareholderNames?: Record<string, string>;
  /** Map of company.id -> display name (used for reasons) */
  companyNames?: Record<string, string>;
  /** Threshold % for related-party detection (default 25) */
  threshold?: number;
}

export interface ClassifyResult {
  classification: LeaseClassification;
  reason: string;
}

const fmtPct = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 2)}%`;

export function classifyLease(input: ClassifyInput): ClassifyResult {
  const {
    landlord,
    tenant,
    ownership,
    relationships,
    shareholderNames = {},
    companyNames = {},
    threshold = 25,
  } = input;

  // Any external party → Standard
  if (landlord.kind === "external" || tenant.kind === "external") {
    return {
      classification: "standard",
      reason:
        "One or both parties are external (not tracked in this system). Treated as a standard arm's-length lease.",
    };
  }

  const lName = landlord.name || (landlord.kind === "individual"
    ? shareholderNames[landlord.shareholderId || ""] || "Landlord"
    : companyNames[landlord.companyId || ""] || "Landlord");
  const tName = tenant.name || (tenant.kind === "individual"
    ? shareholderNames[tenant.shareholderId || ""] || "Tenant"
    : companyNames[tenant.companyId || ""] || "Tenant");

  // Self-Rental: individual <-> company they control
  const indParty = landlord.kind === "individual" ? landlord : tenant.kind === "individual" ? tenant : null;
  const coParty = landlord.kind === "company" ? landlord : tenant.kind === "company" ? tenant : null;

  if (indParty && coParty && indParty.shareholderId && coParty.companyId) {
    const pct = ownership[coParty.companyId]?.[indParty.shareholderId] || 0;
    if (pct >= threshold) {
      const indName = shareholderNames[indParty.shareholderId] || indParty.name || "Individual";
      const coName = companyNames[coParty.companyId] || coParty.name || "Company";
      return {
        classification: "self_rental",
        reason: `${indName} owns ${fmtPct(pct)} of ${coName} per the share ledger. Self-rental rules may apply (IRC §469).`,
      };
    }
  }

  // Intercompany: company <-> company with common control or relationship
  if (landlord.kind === "company" && tenant.kind === "company" && landlord.companyId && tenant.companyId) {
    // (a) explicit relationship
    const rel = relationships.find(
      (r) =>
        (r.parent_company_id === landlord.companyId && r.child_company_id === tenant.companyId) ||
        (r.parent_company_id === tenant.companyId && r.child_company_id === landlord.companyId),
    );
    if (rel) {
      const pct = rel.ownership_percentage != null ? ` (${fmtPct(Number(rel.ownership_percentage))})` : "";
      return {
        classification: "intercompany",
        reason: `${companyNames[landlord.companyId] || lName} and ${companyNames[tenant.companyId] || tName} are linked as parent/subsidiary in the corporate relationships registry${pct}.`,
      };
    }

    // (b) shared controlling owner
    const lOwners = ownership[landlord.companyId] || {};
    const tOwners = ownership[tenant.companyId] || {};
    for (const sid of Object.keys(lOwners)) {
      const lp = lOwners[sid];
      const tp = tOwners[sid] || 0;
      if (lp >= threshold && tp >= threshold) {
        const owner = shareholderNames[sid] || "A common owner";
        return {
          classification: "intercompany",
          reason: `${owner} controls both entities (${fmtPct(lp)} of ${companyNames[landlord.companyId] || lName} and ${fmtPct(tp)} of ${companyNames[tenant.companyId] || tName}).`,
        };
      }
    }
  }

  // Related-Party: any ownership overlap ≥ threshold not already caught
  // (e.g., individual <-> company with sub-threshold ownership but still meaningful,
  //  or shared minority owner across two companies)
  if (landlord.kind === "company" && tenant.kind === "company" && landlord.companyId && tenant.companyId) {
    const lOwners = ownership[landlord.companyId] || {};
    const tOwners = ownership[tenant.companyId] || {};
    for (const sid of Object.keys(lOwners)) {
      const overlap = Math.min(lOwners[sid], tOwners[sid] || 0);
      if (overlap >= threshold) {
        const owner = shareholderNames[sid] || "A shared owner";
        return {
          classification: "related_party",
          reason: `${owner} holds at least ${fmtPct(threshold)} in both ${companyNames[landlord.companyId] || lName} and ${companyNames[tenant.companyId] || tName}.`,
        };
      }
    }
  }

  if (indParty && coParty && indParty.shareholderId && coParty.companyId) {
    const pct = ownership[coParty.companyId]?.[indParty.shareholderId] || 0;
    if (pct >= threshold) {
      // Already caught above as self_rental, but defensive.
      return {
        classification: "related_party",
        reason: `Ownership overlap of ${fmtPct(pct)} detected.`,
      };
    }
  }

  return {
    classification: "standard",
    reason: `No ownership overlap of ${fmtPct(threshold)} or greater detected between ${lName} and ${tName}. Treated as a standard arm's-length lease.`,
  };
}

export const CLASSIFICATION_LABELS: Record<LeaseClassification, string> = {
  standard: "Standard Lease",
  related_party: "Related-Party Lease",
  self_rental: "Self-Rental Lease",
  intercompany: "Intercompany Lease",
};

export const CLASSIFICATION_DISCLOSURES: Record<LeaseClassification, string | null> = {
  standard: null,
  related_party:
    "This lease is between parties with common ownership or controlling interest. The parties acknowledge the potential for non-arm's-length considerations.",
  self_rental:
    "This lease involves property rented between an individual and an entity under common ownership. The parties acknowledge potential tax reporting implications under applicable IRS rules.",
  intercompany:
    "This lease is between entities under common ownership or control. The parties agree to maintain documentation supporting intercompany transaction terms.",
};
