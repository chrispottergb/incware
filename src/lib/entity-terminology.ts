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
  billsTitle: string;          // "Equity Transactions"
  billsSubtitle: string;       // "Issuances, Transfers, and Other Ownership Changes"
  
  // Statute references
  shareholderStatute: string;
  certificateStatute: string;
  billsStatute: string;
  
  // Boolean flags
  isLLC: boolean;
}

/** Returns true for LLC variants (e.g., "LLC", "Single Member LLC"). */
export function isLLCType(entityType?: string): boolean {
  const normalized = (entityType || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized === "llc" || normalized === "single member llc";
}

/** Returns true if the company has an S-Corporation election (date set). */
export function isSElected(company?: { s_election_date?: string | null } | null): boolean {
  return !!company?.s_election_date;
}

export interface SStatusCompany {
  s_election_date?: string | null;
  s_revocation_date?: string | null;
  entity_type?: string | null;
  fiscal_year_end?: string | null;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Parses a "YYYY-MM-DD" (or ISO) date string into a local Date, or null. */
function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  if (!/^\d{1,4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Was the S election in effect on a specific date?
 * "LLC-S" is always treated as S-taxed (there is no election date to compare).
 * The election must have started on or before the date, and any revocation must
 * take effect after it.
 */
export function isSElectedOn(
  company: SStatusCompany | null | undefined,
  date: string | Date | null | undefined
): boolean {
  if (!company) return false;
  if (company.entity_type === "LLC-S") return true;
  const election = parseDateOnly(company.s_election_date);
  if (!election) return false;

  const asOf = date instanceof Date ? date : parseDateOnly(date);
  if (!asOf) return true; // no date context — fall back to current status

  if (asOf < election) return false;
  const revocation = parseDateOnly(company.s_revocation_date);
  if (revocation && asOf >= revocation) return false;
  return true;
}

/**
 * Was the S election in effect during a given tax year? The tax year is the
 * fiscal year ENDING on the company's fiscal year end within that calendar year
 * (December 31 when not set). An election counts if it was in effect at any point
 * during that fiscal year.
 */
export function isSElectedForTaxYear(
  company: SStatusCompany | null | undefined,
  taxYear: number | string | null | undefined
): boolean {
  if (!company) return false;
  if (company.entity_type === "LLC-S") return true;

  const year = typeof taxYear === "string" ? parseInt(taxYear, 10) : taxYear;
  if (!year || isNaN(year)) return isSElected(company);

  const election = parseDateOnly(company.s_election_date);
  if (!election) return false;

  // Resolve the fiscal year end (month/day) for this company.
  let endMonth = 11; // December
  let endDay = 31;
  const fye = (company.fiscal_year_end || "").trim().toLowerCase();
  if (fye) {
    const monthName = MONTHS.findIndex((m) => fye.startsWith(m));
    const dayMatch = fye.match(/(\d{1,2})/);
    if (monthName >= 0 && dayMatch) {
      endMonth = monthName;
      endDay = parseInt(dayMatch[1], 10);
    }
  }

  const fiscalEnd = new Date(year, endMonth, endDay);
  const fiscalStart = new Date(fiscalEnd);
  fiscalStart.setDate(fiscalStart.getDate() + 1);
  fiscalStart.setFullYear(fiscalStart.getFullYear() - 1);

  if (election > fiscalEnd) return false;
  const revocation = parseDateOnly(company.s_revocation_date);
  if (revocation && revocation <= fiscalStart) return false;
  return true;
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
      ledgerTitle: "Transactions",
      billsTitle: "Equity Transactions",
      billsSubtitle: "Issuances, Transfers, and Other Ownership Changes",
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
    billsTitle: "Equity Transactions",
    billsSubtitle: "Issuances, Transfers, and Other Ownership Changes",
    shareholderStatute: "Wis. Stat. § 180.1601(3) — Record of shareholders by name, address, and shares held",
    certificateStatute: "Wis. Stat. § 180.0625 — Share certificates must state corporate name, shares represented, class & par value",
    billsStatute: "Record share sales between parties — supports Wis. Stat. § 180.0627 share transfer restrictions",
    isLLC: false,
  };
}
