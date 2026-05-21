import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/hooks/use-toast";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const TERM_LENGTHS = ["1 year", "2 years", "3 years"];

type InitialDirector = {
  id: string;
  company_id: string;
  full_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  email: string | null;
  phone: string | null;
  term_length: string | null;
  term_start_date: string | null;
  sort_order: number;
};

interface Props {
  companyId: string;
}

export function NonProfitGovernanceTab({ companyId }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<InitialDirector[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["nonprofit_initial_directors", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("nonprofit_initial_directors")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as InitialDirector[];
    },
  });

  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["nonprofit_initial_directors", companyId] });

  const addDirector = async () => {
    const sort = rows.length;
    const { error } = await (supabase as any)
      .from("nonprofit_initial_directors")
      .insert({ company_id: companyId, sort_order: sort });
    if (error) {
      toast({ title: "Failed to add director", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  const updateRow = (id: string, patch: Partial<InitialDirector>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const persistRow = async (id: string, patch: Partial<InitialDirector>) => {
    const { error } = await (supabase as any)
      .from("nonprofit_initial_directors")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  };

  const deleteRow = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any)
      .from("nonprofit_initial_directors")
      .delete()
      .eq("id", deleteId);
    setDeleteId(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    refresh();
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Initial Directors */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Initial Directors</h2>
          <p className="text-xs text-muted-foreground">
            Directors proposed prior to the Organizational Meeting.
          </p>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium whitespace-nowrap">Full Name</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Address</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">City</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">State</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Zip</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Email</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Phone</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Term Length</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Term Start</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-4 text-center text-muted-foreground">
                    No initial directors yet. Click "Add Director" to begin.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="px-1 py-1 min-w-[140px]">
                    <Input
                      className="h-7 text-xs"
                      value={r.full_name ?? ""}
                      onChange={(e) => updateRow(r.id, { full_name: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { full_name: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 min-w-[160px]">
                    <Input
                      className="h-7 text-xs"
                      value={r.address ?? ""}
                      onChange={(e) => updateRow(r.id, { address: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { address: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 min-w-[110px]">
                    <Input
                      className="h-7 text-xs"
                      value={r.city ?? ""}
                      onChange={(e) => updateRow(r.id, { city: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { city: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 w-[70px]">
                    <Select
                      value={r.state ?? ""}
                      onValueChange={(v) => {
                        updateRow(r.id, { state: v });
                        persistRow(r.id, { state: v });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="ST" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1 w-[80px]">
                    <Input
                      className="h-7 text-xs"
                      value={r.zip ?? ""}
                      onChange={(e) => updateRow(r.id, { zip: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { zip: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 min-w-[160px]">
                    <Input
                      className="h-7 text-xs"
                      type="email"
                      value={r.email ?? ""}
                      onChange={(e) => updateRow(r.id, { email: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { email: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 min-w-[120px]">
                    <Input
                      className="h-7 text-xs"
                      value={r.phone ?? ""}
                      onChange={(e) => updateRow(r.id, { phone: e.target.value })}
                      onBlur={(e) => persistRow(r.id, { phone: e.target.value })}
                    />
                  </td>
                  <td className="px-1 py-1 w-[100px]">
                    <Select
                      value={r.term_length ?? ""}
                      onValueChange={(v) => {
                        updateRow(r.id, { term_length: v });
                        persistRow(r.id, { term_length: v });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Term" />
                      </SelectTrigger>
                      <SelectContent>
                        {TERM_LENGTHS.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1 w-[130px]">
                    <DatePickerField
                      value={r.term_start_date ?? ""}
                      onChange={(v) => {
                        updateRow(r.id, { term_start_date: v });
                        persistRow(r.id, { term_start_date: v || null });
                      }}
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteId(r.id)}
                      aria-label="Remove director"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button variant="outline" size="sm" onClick={addDirector}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Director
        </Button>
      </section>

      <Separator />

      {/* SECTION 2 — Board of Directors */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Board of Directors</h2>
          <p className="text-xs text-muted-foreground">
            Elected at the Organizational Meeting. Populated after the Organizational Meeting is completed.
          </p>
        </div>

        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-2 py-2 font-medium whitespace-nowrap">Full Name</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Address</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">City</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">State</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Zip</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Email</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Phone</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Officer Role</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Term Start</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Term End</th>
                <th className="px-2 py-2 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={11} className="px-2 py-6 text-center text-muted-foreground italic">
                  Will populate after the Organizational Meeting is completed.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={deleteRow}
        title="Remove Director"
        description="Remove this initial director? This cannot be undone."
      />
    </div>
  );
}
