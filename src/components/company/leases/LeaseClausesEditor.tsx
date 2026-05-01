import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  leaseId: string;
}

export function LeaseClausesEditor({ leaseId }: Props) {
  const qc = useQueryClient();
  const { data: clauses = [] } = useQuery({
    queryKey: ["lease_clauses", leaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lease_clauses")
        .select("*")
        .eq("lease_id", leaseId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!leaseId,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lease_clauses").insert({
        lease_id: leaseId,
        clause_type: "custom",
        clause_title: "Custom Clause",
        clause_text: "",
        sort_order: clauses.length,
        is_auto_generated: false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lease_clauses", leaseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("lease_clauses").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lease_clauses", leaseId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lease_clauses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lease_clauses", leaseId] }),
  });

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Custom Clauses</p>
        <Button type="button" size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => add.mutate()}>
          <Plus className="h-3 w-3 mr-1" /> Add Clause
        </Button>
      </div>
      {clauses.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">No custom clauses. Disclosure clauses are auto-injected based on classification.</p>
      )}
      {clauses.map((c: any) => (
        <div key={c.id} className="rounded border border-border p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{c.clause_type}</Badge>
            <Input
              className="h-7 text-xs flex-1"
              defaultValue={c.clause_title || ""}
              onBlur={(e) => update.mutate({ id: c.id, patch: { clause_title: e.target.value } })}
              placeholder="Clause title"
            />
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove.mutate(c.id)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
          <Textarea
            className="text-xs min-h-[60px]"
            defaultValue={c.clause_text || ""}
            onBlur={(e) => update.mutate({ id: c.id, patch: { clause_text: e.target.value } })}
            placeholder="Clause text..."
          />
        </div>
      ))}
    </div>
  );
}
