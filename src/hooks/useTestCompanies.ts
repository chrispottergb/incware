import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ids of companies flagged as test data. Records belonging to these companies
 * are kept out of every typeahead / suggestion list, while staying fully
 * visible and editable inside the company itself.
 */
export function useTestCompanyIds() {
  const { data = [] } = useQuery({
    queryKey: ["test_company_ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id")
        .eq("is_test", true);
      if (error) throw error;
      return (data || []).map((c: any) => c.id as string);
    },
    staleTime: 60_000,
  });

  return useMemo(() => new Set<string>(data), [data]);
}
