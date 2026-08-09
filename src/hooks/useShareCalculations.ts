import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildOwnerAliasIndex,
  resolveOwnerIdByName,
  normalizeOwnerName,
  type NameHistoryRow,
} from "@/lib/owner-aliases";
import {
  ISSUANCE_TYPES,
  REDUCTION_TYPES,
  TRANSFER_TYPES,
} from "@/lib/transaction-types";

export interface ShareholderHoldings {
  [shareholderId: string]: number;
}

export interface ShareCalculations {
  authorizedShares: number | null;
  totalIssuedShares: number;
  availableShares: number | null;
  shareholderHoldings: ShareholderHoldings;
  isLoading: boolean;
}

export function useShareCalculations(companyId: string) {
  const { data: company } = useQuery({
    queryKey: ["company-authorized-shares", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("authorized_shares")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["share_transactions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders-for-holdings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select("id, name, is_treasury")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: nameHistory = [] } = useQuery({
    queryKey: ["shareholder_name_history", companyId],
    queryFn: async (): Promise<NameHistoryRow[]> => {
      const { data, error } = await supabase
        .from("shareholder_name_history" as any)
        .select("id, shareholder_id, previous_name, new_name, effective_date, reason, note, created_at")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data ?? []) as unknown as NameHistoryRow[];
    },
    enabled: !!companyId,
  });

  const today = new Date().toISOString().split("T")[0];

  // Historical transfers store owner names as free text. Resolve them through the
  // alias index so prior names (renames, corrections) still credit the same owner.
  const aliasIndex = buildOwnerAliasIndex(shareholders, nameHistory);

  // Calculate total issued shares and per-shareholder holdings from transactions
  // Transactions are the single source of truth for ownership
  const shareholderHoldings: ShareholderHoldings = {};
  shareholders.forEach((s) => {
    shareholderHoldings[s.id] = 0;
  });

  let totalIssuedShares = 0;

  transactions.forEach((t: any) => {
    // Skip corrected transactions
    if ((t as any).status === "corrected") return;
    // Skip future effective_date transactions
    const effectiveDate = (t as any).effective_date || t.transaction_date || "";
    if (effectiveDate > today) return;

    const shares = t.num_shares || 0;

    if (ISSUANCE_TYPES.includes(t.transaction_type)) {
      totalIssuedShares += shares;
      if (t.shareholder_id && shareholderHoldings[t.shareholder_id] !== undefined) {
        shareholderHoldings[t.shareholder_id] += shares;
      }
    } else if (REDUCTION_TYPES.includes(t.transaction_type)) {
      totalIssuedShares -= shares;
      if (t.shareholder_id && shareholderHoldings[t.shareholder_id] !== undefined) {
        shareholderHoldings[t.shareholder_id] -= shares;
      }
    } else if (TRANSFER_TYPES.includes(t.transaction_type)) {
      if (t.from_shareholder) {
        const senderId = resolveOwnerIdByName(t.from_shareholder, aliasIndex);
        if (senderId && shareholderHoldings[senderId] !== undefined) {
          shareholderHoldings[senderId] -= shares;
        }
      }
      if (t.to_shareholder) {
        const receiverId = resolveOwnerIdByName(t.to_shareholder, aliasIndex);
        if (receiverId && shareholderHoldings[receiverId] !== undefined) {
          shareholderHoldings[receiverId] += shares;
        }
      } else if (t.shareholder_id && shareholderHoldings[t.shareholder_id] !== undefined) {
        shareholderHoldings[t.shareholder_id] += shares;
      }
    }
  });


  // Ensure no negative holdings display
  Object.keys(shareholderHoldings).forEach(id => {
    if (shareholderHoldings[id] < 0) shareholderHoldings[id] = 0;
  });

  // Treasury units are issued but NOT outstanding. Every other surface in the
  // app (roster, cap table, meeting attendance, OA member schedules) already
  // excludes `is_treasury` holders; the cap-table math is the last place that
  // did not, which understated every real holder's percentage. Outstanding =
  // issued − treasury, so the denominator matches what the documents show.
  const treasuryHeld = shareholders
    .filter((s: any) => s.is_treasury)
    .reduce((sum, s: any) => sum + (shareholderHoldings[s.id] || 0), 0);
  totalIssuedShares = Math.max(0, totalIssuedShares - treasuryHeld);

  const authorizedShares = company?.authorized_shares ?? null;
  const availableShares = authorizedShares != null ? authorizedShares - totalIssuedShares : null;

  return {
    authorizedShares,
    totalIssuedShares,
    availableShares,
    shareholderHoldings,
    isLoading,
  };
}

/**
 * Get holdings for a specific shareholder by name (for validation in BuySellWorkflow).
 * Pass `nameHistory` so transfers recorded under a prior name still resolve to the
 * same owner after a legal name change or a corrected misspelling.
 */
export function getHoldingsByName(
  transactions: any[],
  shareholderName: string,
  shareholders: { id: string; name: string }[],
  nameHistory: NameHistoryRow[] = []
): number {
  let holdings = 0;
  const today = new Date().toISOString().split("T")[0];

  const aliasIndex = buildOwnerAliasIndex(shareholders, nameHistory);
  const targetId = resolveOwnerIdByName(shareholderName, aliasIndex);
  const nameNorm = normalizeOwnerName(shareholderName);
  const matchesTarget = (value?: string | null) => {
    if (!value) return false;
    const resolved = resolveOwnerIdByName(value, aliasIndex);
    if (targetId && resolved) return resolved === targetId;
    return normalizeOwnerName(value) === nameNorm;
  };
  const matchesLinked = (shareholderId?: string | null) => {
    if (!shareholderId) return false;
    if (targetId) return shareholderId === targetId;
    const linked = shareholders.find((s) => s.id === shareholderId);
    return !!linked && normalizeOwnerName(linked.name) === nameNorm;
  };

  transactions.forEach((t: any) => {
    // Skip corrected transactions
    if ((t as any).status === "corrected") return;
    // Skip future effective_date transactions
    const effectiveDate = (t as any).effective_date || t.transaction_date || "";
    if (effectiveDate > today) return;

    // Issuances to this shareholder
    if (ISSUANCE_TYPES.includes(t.transaction_type)) {
      if (matchesLinked(t.shareholder_id)) {
        holdings += t.num_shares || 0;
      }
    }

    // Redemptions from this shareholder
    if (REDUCTION_TYPES.includes(t.transaction_type)) {
      if (matchesLinked(t.shareholder_id)) {
        holdings -= t.num_shares || 0;
      }
    }

    // Transfers in
    if (TRANSFER_TYPES.includes(t.transaction_type)) {
      if (matchesTarget(t.to_shareholder)) {
        holdings += t.num_shares || 0;
      }
      else if (t.shareholder_id && !t.to_shareholder) {
        if (matchesLinked(t.shareholder_id)) {
          holdings += t.num_shares || 0;
        }
      }

      // Transfers out
      if (matchesTarget(t.from_shareholder)) {
        holdings -= t.num_shares || 0;
      }
    }
  });


  return Math.max(0, holdings);
}
