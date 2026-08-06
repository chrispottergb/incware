import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NameHistoryRow } from "@/lib/owner-aliases";

/** All owner name-change records for a company (used to alias historical names). */
export function useShareholderNameHistory(companyId?: string) {
  return useQuery({
    queryKey: ["shareholder_name_history", companyId],
    queryFn: async (): Promise<NameHistoryRow[]> => {
      const { data, error } = await supabase
        .from("shareholder_name_history" as any)
        .select("id, shareholder_id, previous_name, new_name, effective_date, reason, note, created_at")
        .eq("company_id", companyId as string)
        .order("effective_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as NameHistoryRow[];
    },
    enabled: !!companyId,
  });
}
