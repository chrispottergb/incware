import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ISSUANCE_TYPES = [
  "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
  "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
  "treasury_reissue", "Capital Contribution", "Initial Contribution", "initial_contribution",
  "additional_contribution", "membership_issuance",
];

const REDUCTION_TYPES = [
  "Redemption", "redemption", "Cancellation", "cancellation", "Return of Capital",
  "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
];

const TRANSFER_TYPES = [
  "transfer", "interest_transfer", "interest_assignment", "gift",
  "share_exchange", "Transfer In", "Transfer Out",
];

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
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Calculate total issued shares and per-shareholder holdings from transactions
  // Transactions are the single source of truth for ownership
  const shareholderHoldings: ShareholderHoldings = {};
  shareholders.forEach((s) => {
    shareholderHoldings[s.id] = 0;
  });

  let totalIssuedShares = 0;

  transactions.forEach((t: any) => {
    const shares = t.num_shares || 0;

    if (ISSUANCE_TYPES.includes(t.transaction_type)) {
      // Issuance: add to total and to the shareholder
      totalIssuedShares += shares;
      if (t.shareholder_id && shareholderHoldings[t.shareholder_id] !== undefined) {
        shareholderHoldings[t.shareholder_id] += shares;
      }
    } else if (REDUCTION_TYPES.includes(t.transaction_type)) {
      // Reduction: subtract from total and from the shareholder
      totalIssuedShares -= shares;
      if (t.shareholder_id && shareholderHoldings[t.shareholder_id] !== undefined) {
        shareholderHoldings[t.shareholder_id] -= shares;
      }
    } else if (TRANSFER_TYPES.includes(t.transaction_type)) {
      // Transfers are neutral for total issued, but move shares between holders
      // Deduct from sender (by name match)
      if (t.from_shareholder) {
        const fromNorm = t.from_shareholder.toLowerCase().trim();
        const sender = shareholders.find(s => s.name.toLowerCase().trim() === fromNorm);
        if (sender) {
          shareholderHoldings[sender.id] -= shares;
        }
      }
      // Add to receiver: check shareholder_id first, then name match
      if (t.to_shareholder) {
        const toNorm = t.to_shareholder.toLowerCase().trim();
        const receiver = shareholders.find(s => s.name.toLowerCase().trim() === toNorm);
        if (receiver) {
          shareholderHoldings[receiver.id] += shares;
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

/** Get holdings for a specific shareholder by name (for validation in BuySellWorkflow) */
export function getHoldingsByName(
  transactions: any[],
  shareholderName: string,
  shareholders: { id: string; name: string }[]
): number {
  let holdings = 0;
  const nameNorm = shareholderName.toLowerCase().trim();

  transactions.forEach((t: any) => {
    // Issuances to this shareholder
    if (ISSUANCE_TYPES.includes(t.transaction_type)) {
      const linked = shareholders.find((s) => s.id === t.shareholder_id);
      if (linked && linked.name.toLowerCase().trim() === nameNorm) {
        holdings += t.num_shares || 0;
      }
    }

    // Redemptions from this shareholder
    if (REDUCTION_TYPES.includes(t.transaction_type)) {
      const linked = shareholders.find((s) => s.id === t.shareholder_id);
      if (linked && linked.name.toLowerCase().trim() === nameNorm) {
        holdings -= t.num_shares || 0;
      }
    }

    // Transfers in
    if (TRANSFER_TYPES.includes(t.transaction_type)) {
      if (t.to_shareholder && t.to_shareholder.toLowerCase().trim() === nameNorm) {
        holdings += t.num_shares || 0;
      }
      // Also check shareholder_id
      else if (t.shareholder_id) {
        const linked = shareholders.find((s) => s.id === t.shareholder_id);
        if (linked && linked.name.toLowerCase().trim() === nameNorm) {
          holdings += t.num_shares || 0;
        }
      }

      // Transfers out
      if (t.from_shareholder && t.from_shareholder.toLowerCase().trim() === nameNorm) {
        holdings -= t.num_shares || 0;
      }
    }
  });

  return Math.max(0, holdings);
}
