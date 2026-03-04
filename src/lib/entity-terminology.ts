/**
 * Centralized entity terminology configuration.
 * Returns the correct label set based on entity type so all components
 * pull from one source of truth rather than hardcoding strings.
 */

export interface EntityTerminology {
  // Person labels
  shareholder: string;        // "Shareholder" | "Member"
  shareholders: string;       // "Shareholders" | "Members"
  
  // Director / Authorized Binder labels
  director: string;           // "Director" | "Authorized Binder"
  directors: string;          // "Directors" | "Authorized Binders"
  directorName: string;       // "Director Name" | "Authorized Binder Name"
  
  // Equity labels
  share: string;              // "Share" | "Membership Interest"
  shares: string;             // "Shares" | "Membership Interests"
  shareUnit: string;          // "Shares" | "Units"
  shareUnits: string;         // "Shares" | "Units"
  stock: string;              // "Stock" | "Membership Interest"
  
  // Certificate labels
  certificate: string;        // "Stock Certificate" | "Membership Interest Certificate"
  certificates: string;       // "Stock Certificates" | "Membership Interest Certificates"
  
  // Class labels
  classLabel: string;          // "Class" | "Interest Type"
  classOptions: { value: string; label: string }[];
  defaultClass: string;
  
  // Value labels
  parValue: string;            // "Par Value" | "Value/Unit"
  pricePerUnit: string;        // "Price/Share" | "Price/Unit"
  dollarPerUnit: string;       // "$/Share" | "$/Unit"
  numUnitsLabel: string;       // "# Shares" | "# Units"
  issuedLabel: string;         // "Issued Shares" | "Issued Membership Interests"
  
  // Agreement labels
  agreement: string;           // "Shareholder Agreement" | "Operating Agreement"
  equity: string;              // "Shareholder Equity" | "Member's Equity"
  
  // Action labels  
  elected: string;             // "elected" | "appointed"
  election: string;            // "Election" | "Appointment"
  
  // Section labels
  shareholdersTab: string;     // "Shareholders & Stock" | "Members & Interest"
  shareholdersSubTab: string;  // "Shareholders/Members" | "Members"
  ledgerTitle: string;         // "Stock Ledger / Transactions" | "Capital & Interest Ledger"
  billsTitle: string;          // "Bills of Sale" | "Bills of Sale / Interest Transfers"
  
  // Statute references
  shareholderStatute: string;
  certificateStatute: string;
  billsStatute: string;
  
  // Boolean flags
  isLLC: boolean;
}

/** Returns true for LLC variants (e.g., "LLC", "Single Member LLC", "Single-Member LLC"). */
export function isLLCType(entityType?: string): boolean {
  const normalized = (entityType || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized === "llc" || normalized === "single member llc";
}

export function getTerminology(entityType?: string): EntityTerminology {
  const isLLC = isLLCType(entityType);

  if (isLLC) {
    return {
      shareholder: "Member",
      shareholders: "Members",
      director: "Authorized Binder",
      directors: "Authorized Binders",
      directorName: "Authorized Binder Name",
      share: "Membership Interest",
      shares: "Membership Interests",
      shareUnit: "Units",
      shareUnits: "Units",
      stock: "Membership Interest",
      certificate: "Membership Unit Certificate",
      certificates: "Membership Unit Certificates",
      classLabel: "Interest Type",
      classOptions: [
        { value: "Membership", label: "Membership" },
        { value: "Profits", label: "Profits Interest" },
      ],
      defaultClass: "Membership",
      parValue: "Value/Unit",
      pricePerUnit: "Price/Unit",
      dollarPerUnit: "$/Unit",
      numUnitsLabel: "# Units",
      issuedLabel: "Issued Membership Interests",
      agreement: "Operating Agreement",
      equity: "Member's Equity",
      elected: "appointed",
      election: "Appointment",
      shareholdersTab: "Membership Interest/Units",
      shareholdersSubTab: "Members",
      ledgerTitle: "Capital & Interest Ledger",
      billsTitle: "Bills of Sale / Interest Transfers",
      shareholderStatute: "Wis. Stat. § 183.0405 — Record of members by name, address, and interest held",
      certificateStatute: "Wis. Stat. § 183.0501 — Membership interest certificates",
      billsStatute: "Record membership interest transfers between parties — supports Wis. Stat. § 183.0706",
      isLLC: true,
    };
  }

  return {
    shareholder: "Shareholder",
    shareholders: "Shareholders",
    director: "Director",
    directors: "Directors",
    directorName: "Director Name",
    share: "Share",
    shares: "Shares",
    shareUnit: "Shares",
    shareUnits: "Shares",
    stock: "Stock",
    certificate: "Stock Certificate",
    certificates: "Stock Certificates",
    classLabel: "Class",
    classOptions: [
      { value: "Common", label: "Common" },
      { value: "Preferred", label: "Preferred" },
    ],
    defaultClass: "Common",
    parValue: "Par Value",
    pricePerUnit: "Price/Share",
    dollarPerUnit: "$/Share",
    numUnitsLabel: "# Shares",
    issuedLabel: "Issued Shares",
    agreement: "Shareholder Agreement",
    equity: "Shareholder Equity",
    elected: "elected",
    election: "Election",
    shareholdersTab: "Shareholders & Stock",
    shareholdersSubTab: "Shareholders/Members",
    ledgerTitle: "Transactions",
    billsTitle: "Bills of Sale",
    shareholderStatute: "Wis. Stat. § 180.1601(3) — Record of shareholders by name, address, and shares held",
    certificateStatute: "Wis. Stat. § 180.0625 — Share certificates must state corporate name, shares represented, class & par value",
    billsStatute: "Record share sales between parties — supports Wis. Stat. § 180.0627 share transfer restrictions",
    isLLC: false,
  };
}
