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
    queryKey: ["company", companyId],
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
    queryKey: ["shareholders", companyId],
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

  // Fetch active certificates to derive current holdings
  const { data: activeCertificates = [] } = useQuery({
    queryKey: ["active_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("shareholder_id, num_shares")
        .eq("company_id", companyId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Calculate total issued shares from active certificates
  // This equals the sum of all shares on non-cancelled certificates
  const totalIssuedShares = activeCertificates.reduce(
    (sum: number, cert: any) => sum + (cert.num_shares || 0), 0
  );

  const authorizedShares = company?.authorized_shares ?? null;
  const availableShares = authorizedShares != null ? authorizedShares - totalIssuedShares : null;

  // Calculate per-shareholder holdings from active certificates (single source of truth)
  // A shareholder's balance = sum of shares on their active (non-cancelled) certificates
  const shareholderHoldings: ShareholderHoldings = {};
  shareholders.forEach((s) => {
    shareholderHoldings[s.id] = 0;
  });

  activeCertificates.forEach((cert: any) => {
    if (cert.shareholder_id && shareholderHoldings[cert.shareholder_id] !== undefined) {
      shareholderHoldings[cert.shareholder_id] += (cert.num_shares || 0);
    }
  });

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
