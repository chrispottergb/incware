import { supabase } from "@/integrations/supabase/client";
import { matchKey } from "@/lib/name-normalize";

/**
 * Every table/column a saved person-or-entity name can land in from the
 * suggestion-fed forms. This is the auditable coverage list for the
 * "In use by N records" count shown on the Address Book cleanup screen.
 *
 * The count is INFORMATIONAL ONLY. No action on that screen is gated on it,
 * and no action on that screen writes to any table below — renaming a
 * suggestion never rewrites a saved record, and removal is a soft hide.
 */
export const NAME_REFERENCE_COLUMNS: { table: string; column: string; companyScoped: boolean }[] = [
  { table: "shareholders", column: "name", companyScoped: true },
  { table: "shareholders", column: "representative_name", companyScoped: true },
  { table: "shareholders", column: "trustee_name", companyScoped: true },
  { table: "directors", column: "name", companyScoped: true },
  // `officers` stores a name per role rather than a single name column.
  { table: "officers", column: "president", companyScoped: true },
  { table: "officers", column: "vice_president", companyScoped: true },
  { table: "officers", column: "secretary", companyScoped: true },
  { table: "officers", column: "treasurer", companyScoped: true },
  { table: "organizers", column: "organizer_name", companyScoped: true },
  { table: "llc_managers", column: "name", companyScoped: true },
  { table: "nonprofit_initial_directors", column: "full_name", companyScoped: true },
  { table: "bank_authorized_signers", column: "signer_name", companyScoped: false },
  { table: "company_banks", column: "contact_name", companyScoped: true },
  { table: "company_banks", column: "bank_name", companyScoped: true },
  { table: "company_assets", column: "landlord_name", companyScoped: true },
  { table: "bills_of_sale", column: "buyer_name", companyScoped: true },
  { table: "bills_of_sale", column: "seller_name", companyScoped: true },
  { table: "business_sales", column: "buyer_name", companyScoped: true },
  { table: "business_sales", column: "seller_name", companyScoped: true },
  { table: "share_transactions", column: "from_shareholder", companyScoped: true },
  { table: "share_transactions", column: "to_shareholder", companyScoped: true },
  { table: "attorneys", column: "attorney_name", companyScoped: true },
  { table: "accountants", column: "accountant_name", companyScoped: true },
  { table: "attorney_firms", column: "firm_name", companyScoped: true },
  { table: "accountant_firms", column: "firm_name", companyScoped: true },
  { table: "master_firms", column: "firm_name", companyScoped: false },
  { table: "master_firms", column: "contact_name", companyScoped: false },
  { table: "master_contacts", column: "contact_name", companyScoped: false },
  { table: "meeting_authorized_signers", column: "signer_name", companyScoped: false },
  { table: "meeting_shareholders", column: "shareholder_name", companyScoped: false },
  { table: "meeting_shareholders", column: "representative_name", companyScoped: false },
  { table: "meeting_officers", column: "name", companyScoped: false },
  { table: "meeting_counsel", column: "counsel_name", companyScoped: false },
  { table: "meeting_counsel", column: "attorney_name", companyScoped: false },
  { table: "meeting_counsel", column: "accountant_name", companyScoped: false },
  { table: "meeting_loans", column: "lender_name", companyScoped: false },
  { table: "meeting_loans", column: "borrower_name", companyScoped: false },
  { table: "meeting_vehicle_leases", column: "lessor_name", companyScoped: false },
  { table: "meeting_vehicle_purchases", column: "seller", companyScoped: false },
  { table: "meeting_vehicle_sales", column: "buyer_name", companyScoped: false },
];

export interface NameReferenceCount {
  records: number;
  companies: number;
}

/** Escape PostgREST LIKE wildcards so a literal name is matched. */
function escapeLike(value: string): string {
  return value.replace(/[%_]/g, (m) => `\\${m}`);
}

/**
 * Counts saved records still carrying `name` (case-insensitive), across every
 * column in NAME_REFERENCE_COLUMNS. Read-only. RLS scopes results to the
 * signed-in user's data.
 */
export async function countNameReferences(name: string): Promise<NameReferenceCount> {
  const target = matchKey(name);
  if (!target) return { records: 0, companies: 0 };

  const pattern = escapeLike(name.trim());
  const companies = new Set<string>();
  let records = 0;

  await Promise.all(
    NAME_REFERENCE_COLUMNS.map(async ({ table, column, companyScoped }) => {
      try {
        const select = companyScoped ? `id, company_id, ${column}` : `id, ${column}`;
        const { data, error } = await supabase
          .from(table as any)
          .select(select)
          .ilike(column, pattern)
          .limit(1000);
        if (error || !data) return;
        for (const row of data as any[]) {
          // Re-check on the normalized key so stray whitespace still counts.
          if (matchKey(row[column]) !== target) continue;
          records += 1;
          if (companyScoped && row.company_id) companies.add(row.company_id);
        }
      } catch {
        /* a table the user cannot read simply contributes nothing */
      }
    }),
  );

  return { records, companies: companies.size };
}
