import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History } from "lucide-react";

interface LogRow {
  id: string;
  action: "rename" | "hide" | "delete";
  target_table: string;
  target_column: string;
  old_value: string | null;
  new_value: string | null;
  affected_row_count: number;
  performed_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  rename: "Renamed",
  hide: "Hidden",
  delete: "Deleted",
};

/**
 * Read-only view of `name_cleanup_log`. The table is insert-only at the
 * database level (no UPDATE or DELETE policy), and this list offers no
 * controls — it is the audit trail for suggestion-list cleanup actions.
 */
export default function NameCleanupLogList() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["name_cleanup_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("name_cleanup_log" as any)
        .select("id, action, target_table, target_column, old_value, new_value, affected_row_count, performed_at")
        .order("performed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) as LogRow[];
    },
  });

  if (isLoading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" />
        Cleanup History
      </div>
      <p className="text-xs text-muted-foreground">
        A permanent, read-only record of every rename and hide performed here. Entries cannot be edited or
        removed.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No cleanup actions recorded yet.</p>
      ) : (
        <div className="rounded-md border border-border max-h-[260px] overflow-y-auto">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[14%]">Action</TableHead>
                <TableHead className="w-[30%]">From</TableHead>
                <TableHead className="w-[30%]">To</TableHead>
                <TableHead className="w-[10%] text-right">In use</TableHead>
                <TableHead className="w-[16%] text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-medium">{ACTION_LABEL[r.action] ?? r.action}</TableCell>
                  <TableCell className="text-xs truncate" title={r.old_value ?? ""}>
                    {r.old_value || "—"}
                  </TableCell>
                  <TableCell className="text-xs truncate" title={r.new_value ?? ""}>
                    {r.new_value || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right">{r.affected_row_count}</TableCell>
                  <TableCell className="text-xs text-right text-muted-foreground whitespace-nowrap">
                    {new Date(r.performed_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
