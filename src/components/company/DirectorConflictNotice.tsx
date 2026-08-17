import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DirectorConflictNoticeProps {
  companyId: string;
  boardEliminated?: boolean;
}

export default function DirectorConflictNotice({
  companyId,
  boardEliminated,
}: DirectorConflictNoticeProps) {
  const { data: hasCompanyDirectors = false } = useQuery({
    queryKey: ["directors-exists", companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("directors")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!companyId,
  });

  const { data: hasMeetingDirectors = false } = useQuery({
    queryKey: ["meeting-directors-exists", companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("meeting_directors")
        .select("id, meetings!inner(company_id)", { count: "exact", head: true })
        .eq("meetings.company_id", companyId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!companyId,
  });

  const showNotice = useMemo(
    () => !!boardEliminated && (hasCompanyDirectors || hasMeetingDirectors),
    [boardEliminated, hasCompanyDirectors, hasMeetingDirectors]
  );

  if (!showNotice) return null;

  return (
    <Alert className="border-amber-400/40 bg-amber-50 dark:bg-amber-950/20">
      <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
        This corporation is recorded as having elected not to have a board of directors (Wis. Stat. s. 180.1821), but director records exist. Directors will not appear in generated minutes. If this corporation has a board, clear the election on the Incorporation tab.
      </AlertDescription>
    </Alert>
  );
}
