import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, Users, Edit2, Save } from "lucide-react";
import { toast } from "sonner";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

interface Props {
  companyId: string;
}

export default function ShareholdersTab({ companyId }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", zip: "", ssn_ein: "", status: "active",
  });

  const { data: shareholders = [], isLoading } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders")
        .select("*")
        .eq("company_id", companyId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setForm({ name: "", address: "", city: "", state: "", zip: "", ssn_ein: "", status: "active" });
    setEditId(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from("shareholders").update({
          name: form.name,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          ssn_ein: form.ssn_ein || null,
          status: form.status,
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shareholders").insert({
          company_id: companyId,
          name: form.name,
          address: form.address || null,
          city: form.city || null,
          state: form.state || null,
          zip: form.zip || null,
          ssn_ein: form.ssn_ein || null,
          status: form.status,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      setDialog(false);
      resetForm();
      toast.success(editId ? "Shareholder updated!" : "Shareholder added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shareholders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      toast.success("Shareholder removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (s: typeof shareholders[0]) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      address: s.address ?? "",
      city: s.city ?? "",
      state: s.state ?? "",
      zip: s.zip ?? "",
      ssn_ein: s.ssn_ein ?? "",
      status: s.status ?? "active",
    });
    setDialog(true);
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">Shareholders</CardTitle>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            Wis. Stat. § 180.1601(3) — Record of shareholders by name, address, and shares held
          </CardDescription>
        </div>
        <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="mr-1 h-3 w-3" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-base">
                {editId ? "Edit Shareholder" : "Add Shareholder"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
              <div className="field-group">
                <Label className="field-label">Shareholder Name</Label>
                <Input className="h-8 text-sm" value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="field-group">
                <Label className="field-label">Address</Label>
                <Input className="h-8 text-sm" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="field-group">
                  <Label className="field-label">City</Label>
                  <Input className="h-8 text-sm" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Select value={form.state} onValueChange={(v) => setForm(p => ({ ...p, state: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Zip</Label>
                  <Input className="h-8 text-sm" value={form.zip} onChange={(e) => setForm(p => ({ ...p, zip: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">SSN / EIN</Label>
                  <Input className="h-8 text-sm" value={form.ssn_ein} onChange={(e) => setForm(p => ({ ...p, ssn_ein: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" size="sm" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {editId ? "Save Changes" : "Add Shareholder"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : shareholders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No shareholders recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase">Name</TableHead>
                  <TableHead className="text-[10px] uppercase">Address</TableHead>
                  <TableHead className="text-[10px] uppercase">City/State/Zip</TableHead>
                  <TableHead className="text-[10px] uppercase">SSN/EIN</TableHead>
                  <TableHead className="text-[10px] uppercase">Status</TableHead>
                  <TableHead className="text-[10px] uppercase w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareholders.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs">{s.address ?? "—"}</TableCell>
                    <TableCell className="text-xs">{[s.city, s.state, s.zip].filter(Boolean).join(", ") || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{s.ssn_ein ? "••••" + s.ssn_ein.slice(-4) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(s)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(s.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
