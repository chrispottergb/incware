import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buildOwnershipMap,
  classifyLease,
  type ClassifyResult,
  type LeaseParty,
} from "@/lib/lease-classification";

interface Args {
  landlord: LeaseParty;
  tenant: LeaseParty;
  /** Current company id used to scope relationships query */
  currentCompanyId: string;
  /** Optional manual override classification */
  override?: ClassifyResult["classification"] | null;
}

export function useLeaseClassification({ landlord, tenant, currentCompanyId, override }: Args) {
  // Threshold from app_settings
  const { data: threshold = 25 } = useQuery({
    queryKey: ["app_settings", "related_party_threshold_pct"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "related_party_threshold_pct")
        .maybeSingle();
      return data?.value ? Number(data.value) : 25;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Pull share transactions for any company referenced by either party
  const companyIds = useMemo(
    () => Array.from(new Set([landlord.companyId, tenant.companyId, currentCompanyId].filter(Boolean) as string[])),
    [landlord.companyId, tenant.companyId, currentCompanyId],
  );

  const { data: shareTxns = [] } = useQuery({
    queryKey: ["share_transactions_for_classification", companyIds.sort().join(",")],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data } = await supabase
        .from("share_transactions")
        .select("company_id, shareholder_id, transaction_type, num_shares, effective_date, status")
        .in("company_id", companyIds);
      return data || [];
    },
    enabled: companyIds.length > 0,
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ["company_relationships_for_classification", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_relationships")
        .select("parent_company_id, child_company_id, ownership_percentage");
      return data || [];
    },
  });

  const { data: shareholderNames = {} } = useQuery({
    queryKey: ["shareholder_names", companyIds.sort().join(",")],
    queryFn: async () => {
      if (companyIds.length === 0) return {};
      const { data } = await supabase
        .from("shareholders")
        .select("id, name")
        .in("company_id", companyIds);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => (map[s.id] = s.name));
      return map;
    },
    enabled: companyIds.length > 0,
  });

  const { data: companyNames = {} } = useQuery({
    queryKey: ["company_names", companyIds.sort().join(",")],
    queryFn: async () => {
      if (companyIds.length === 0) return {};
      const { data } = await supabase.from("companies").select("id, name").in("id", companyIds);
      const map: Record<string, string> = {};
      (data || []).forEach((c: any) => (map[c.id] = c.name));
      return map;
    },
    enabled: companyIds.length > 0,
  });

  const result = useMemo<ClassifyResult>(() => {
    const ownership = buildOwnershipMap(
      (shareTxns as any[]).map((t) => ({
        ...t,
        num_shares: Number(t.num_shares || 0),
      })),
    );
    const auto = classifyLease({
      landlord,
      tenant,
      ownership,
      relationships: relationships as any,
      shareholderNames,
      companyNames,
      threshold,
    });
    if (override && override !== auto.classification) {
      return {
        classification: override,
        reason: `Manually overridden. Auto-detected: ${auto.classification}. ${auto.reason}`,
      };
    }
    return auto;
  }, [landlord, tenant, shareTxns, relationships, shareholderNames, companyNames, threshold, override]);

  return { ...result, threshold };
}
