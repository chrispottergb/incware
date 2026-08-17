/**
 * Interim actions — candidate discovery for the annual-meeting ratification sweep.
 *
 * Pure functions only (no React, no Supabase client) so this file is unit-testable.
 *
 * Only tables carrying a REAL event date are used as sources. `created_at` is never
 * used as an action date — that is when the row was typed, not when the thing happened,
 * and a false date in a legal document is worse than no suggestion at all.
 */

export type InterimCategory =
  | "Asset"
  | "Lease"
  | "Banking"
  | "Loan"
  | "Agreement"
  | "Compensation"
  | "Distribution"
  | "Personnel"
  | "Other";

export const INTERIM_CATEGORIES: InterimCategory[] = [
  "Asset",
  "Lease",
  "Banking",
  "Loan",
  "Agreement",
  "Compensation",
  "Distribution",
  "Personnel",
  "Other",
];

export interface CandidateDescriptor {
  sourceTable: string;
  sourceId: string;
  actionDate: string | null; // yyyy-MM-dd
  description: string;
  amount: number | null;
  category: InterimCategory;
  isRelatedParty: boolean;
}

/** Shape of an already-materialized public.interim_actions row (subset we need). */
export interface ExistingInterimAction {
  id?: string;
  action_date: string | null;
  description: string;
  source_table?: string | null;
  source_id?: string | null;
}

// ---------------------------------------------------------------------------
// Normalization + suppression
// ---------------------------------------------------------------------------

/** trim → collapse internal whitespace → lowercase → strip trailing punctuation. */
export function normalizeDescription(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?\s]+$/g, "");
}

function sameDate(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = a ?? null;
  const nb = b ?? null;
  return na === nb;
}

/**
 * True when this candidate has already been captured as an interim action.
 *
 * Two independent checks:
 *  1. Source identity — same (source_table, source_id).
 *  2. Content identity — same action_date (NULL matches NULL) AND normalized-equal
 *     description. This is what catches meeting-scoped rows that `cloneSubTables`
 *     copies forward into a new annual meeting with a fresh id: the generated
 *     sentence is deterministic, so the clone produces an identical description
 *     and date even though its source_id differs.
 */
export function isAlreadyRatified(
  candidate: Pick<CandidateDescriptor, "sourceTable" | "sourceId" | "actionDate" | "description">,
  existingActions: ExistingInterimAction[],
): boolean {
  const normCandidate = normalizeDescription(candidate.description);
  return (existingActions || []).some((a) => {
    if (a.source_table && a.source_id && a.source_table === candidate.sourceTable && a.source_id === candidate.sourceId) {
      return true;
    }
    return sameDate(a.action_date, candidate.actionDate) && normalizeDescription(a.description) === normCandidate;
  });
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Default sweep period: day after the prior annual meeting through this meeting's date.
 * When prior_mtg_date is null, fall back to January 1 of the meeting's tax year
 * (and failing that, January 1 of the meeting date's year).
 */
export function defaultPeriod(meeting: {
  meeting_date: string;
  prior_mtg_date?: string | null;
  tax_year?: number | null;
}): { start: string; end: string } {
  const end = meeting.meeting_date;
  if (meeting.prior_mtg_date) {
    return { start: addDays(meeting.prior_mtg_date, 1), end };
  }
  const year = meeting.tax_year || Number((meeting.meeting_date || "").slice(0, 4));
  return { start: `${year}-01-01`, end };
}

export function inPeriod(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= start && d <= end;
}

// ---------------------------------------------------------------------------
// Related-party matching
// ---------------------------------------------------------------------------

function normKey(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface RelatedPartyIndex {
  names: Set<string>;
  addresses: Set<string>;
}

export function buildRelatedPartyIndex(
  shareholders: { name?: string | null; address?: string | null }[] = [],
  company?: { address?: string | null; address_street?: string | null } | null,
): RelatedPartyIndex {
  const names = new Set<string>();
  const addresses = new Set<string>();
  for (const s of shareholders) {
    const n = normKey(s.name);
    if (n) names.add(n);
    const a = normKey(s.address);
    if (a) addresses.add(a);
  }
  const ca = normKey(company?.address || (company as any)?.address_street);
  if (ca) addresses.add(ca);
  return { names, addresses };
}

export function looksRelatedParty(
  landlordName: string | null | undefined,
  landlordAddress: string | null | undefined,
  index: RelatedPartyIndex,
): boolean {
  const n = normKey(landlordName);
  const a = normKey(landlordAddress);
  return (!!n && index.names.has(n)) || (!!a && index.addresses.has(a));
}

// ---------------------------------------------------------------------------
// Sentence generation per source table
// ---------------------------------------------------------------------------

function money(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return "";
  return Number(amount).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function clean(...parts: (string | null | undefined)[]): string {
  return parts.map((p) => (p ?? "").toString().trim()).filter(Boolean).join(" ");
}

export interface SourceRows {
  assetTransactions?: any[];   // public.asset_transactions (company-scoped via entity_id)
  leases?: any[];              // public.company_assets where asset_type = 'lease'
  loans?: any[];               // public.meeting_loans (meeting-scoped, cloned forward)
  agreements?: any[];          // public.agreements (meeting-scoped, cloned forward)
  bankSigners?: any[];         // public.bank_authorized_signers (company-scoped)
  benefits?: any[];            // public.meeting_benefits (meeting-scoped, cloned forward)
  bankNamesById?: Record<string, string>;
}

function assetTransactionSentence(row: any): string {
  const vehicle = clean(row.year, row.make, row.model) || (row.description ?? "").trim();
  const desc = (row.description ?? "").trim() || vehicle;
  const type = (row.type || "").toLowerCase();
  if (type.includes("lease_termination") || type.includes("termination")) return `Terminated lease for ${desc || "asset"}`;
  if (type.includes("lease")) return `Entered lease for ${desc || "asset"}`;
  if (type.includes("sale") || type.includes("sold")) return `Sold ${desc || "asset"}`;
  return `Purchased ${desc || "asset"}`;
}

/** Builds all candidates from raw source rows, before period/suppression filtering. */
export function buildCandidates(rows: SourceRows, relatedIndex: RelatedPartyIndex): CandidateDescriptor[] {
  const out: CandidateDescriptor[] = [];

  for (const r of rows.assetTransactions ?? []) {
    out.push({
      sourceTable: "asset_transactions",
      sourceId: r.id,
      actionDate: r.date ?? null,
      description: assetTransactionSentence(r),
      amount: r.amount ?? null,
      category: "Asset",
      isRelatedParty: false,
    });
  }

  for (const r of rows.leases ?? []) {
    const address = clean(r.address_street || r.address, r.address_city, r.address_state);
    const landlord = (r.landlord_name ?? "").trim();
    const landlordAddress = clean(r.landlord_address_street || r.landlord_address, r.landlord_address_city, r.landlord_address_state);
    out.push({
      sourceTable: "company_assets",
      sourceId: r.id,
      actionDate: r.lease_date ?? r.lease_start_date ?? null,
      description: `Leased ${(r.description ?? "property").trim()}${address ? ` at ${address}` : ""}${landlord ? ` from ${landlord}` : ""}`,
      amount: r.lease_amount ?? r.monthly_payment ?? null,
      category: "Lease",
      isRelatedParty: looksRelatedParty(landlord, landlordAddress, relatedIndex),
    });
  }

  for (const r of rows.loans ?? []) {
    const amt = money(r.loan_amount);
    out.push({
      sourceTable: "meeting_loans",
      sourceId: r.id,
      actionDate: r.loan_date ?? r.start_date ?? null,
      description: `Entered loan with ${(r.lender_name ?? "lender").trim()}${amt ? ` in the amount of ${amt}` : ""}`,
      amount: r.loan_amount ?? null,
      category: "Loan",
      isRelatedParty: false,
    });
  }

  for (const r of rows.agreements ?? []) {
    out.push({
      sourceTable: "agreements",
      sourceId: r.id,
      actionDate: r.agreement_date ?? null,
      description: `Executed ${(r.agreement_type ?? "agreement").trim()} with ${(r.agreement_with ?? "counterparty").trim()}`,
      amount: r.amount ?? null,
      category: "Agreement",
      isRelatedParty: false,
    });
  }

  for (const r of rows.bankSigners ?? []) {
    const bankName = rows.bankNamesById?.[r.bank_id] || "the company's bank account";
    out.push({
      sourceTable: "bank_authorized_signers",
      sourceId: r.id,
      actionDate: r.effective_date ?? null,
      description: `Added ${(r.signer_name ?? "signer").trim()} as authorized signer on ${bankName}`,
      amount: null,
      category: "Banking",
      isRelatedParty: false,
    });
  }

  for (const r of rows.benefits ?? []) {
    out.push({
      sourceTable: "meeting_benefits",
      sourceId: r.id,
      actionDate: r.new_plan_effective_date ?? null,
      description: `Adopted ${(r.benefit_type || r.benefit_description || "benefit").trim()} plan${r.provider ? ` with ${r.provider.trim()}` : ""}`,
      amount: null,
      category: "Other",
      isRelatedParty: false,
    });
  }

  return out;
}

export interface CandidateBuckets {
  candidates: CandidateDescriptor[];
  relatedParty: CandidateDescriptor[];
  alreadyDocumented: { candidate: CandidateDescriptor; consentDate: string | null }[];
}

/**
 * Filters raw candidates into what the sweep dialog shows.
 * `consentedSources` maps `${sourceTable}:${sourceId}` → written consent date.
 */
export function partitionCandidates(
  all: CandidateDescriptor[],
  opts: {
    start: string;
    end: string;
    existingActions: ExistingInterimAction[];
    consentedSources?: Record<string, string | null>;
  },
): CandidateBuckets {
  const buckets: CandidateBuckets = { candidates: [], relatedParty: [], alreadyDocumented: [] };
  const seen = new Set<string>();

  for (const c of all) {
    if (!inPeriod(c.actionDate, opts.start, opts.end)) continue;

    const consentKey = `${c.sourceTable}:${c.sourceId}`;
    if (opts.consentedSources && consentKey in opts.consentedSources) {
      buckets.alreadyDocumented.push({ candidate: c, consentDate: opts.consentedSources[consentKey] ?? null });
      continue;
    }

    if (isAlreadyRatified(c, opts.existingActions)) continue;

    // Guard against two identical sentences on the same date inside one sweep
    // (e.g. a loan cloned twice within the period).
    const dedupKey = `${c.actionDate ?? "null"}|${normalizeDescription(c.description)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    if (c.isRelatedParty) buckets.relatedParty.push(c);
    else buckets.candidates.push(c);
  }

  const byDate = (a: CandidateDescriptor, b: CandidateDescriptor) => (a.actionDate ?? "9999").localeCompare(b.actionDate ?? "9999");
  buckets.candidates.sort(byDate);
  buckets.relatedParty.sort(byDate);
  return buckets;
}

/** Sort helper for printed output: ascending by date, undated items last. */
export function sortForPrint<T extends { action_date: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (!a.action_date && !b.action_date) return 0;
    if (!a.action_date) return 1;
    if (!b.action_date) return -1;
    return a.action_date.localeCompare(b.action_date);
  });
}
