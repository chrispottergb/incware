import { useState, useMemo } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, UserCheck, Shield } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
}

const OVERSIGHT_ROLES = [
  "Primary AI Oversight Officer",
  "Secondary AI Oversight Officer",
  "Delegated Reviewer",
] as const;

const ADD_NEW_VALUE = "__add_new__";

type PersonOption = {
  value: string; // `${source_type}:${source_id}`
  label: string;
  name: string;
  title: string;
  source_type: "officer" | "director" | "contact";
  source_id: string;
};

const emptyForm = {
  ai_system_id: "",
  selected_person: "",
  oversight_role: "",
  effective_date: "",
  notes: "",
  new_full_name: "",
  new_title: "",
  new_email: "",
};

export default function AIOversightPersons({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: systems = [] } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_systems").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: officersRow } = useQuery({
    queryKey: ["officers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("officers").select("*").eq("company_id", companyId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: directors = [] } = useQuery({
    queryKey: ["directors", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("directors").select("id, name").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["ai_oversight_contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_oversight_contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const personOptions = useMemo<PersonOption[]>(() => {
    const opts: PersonOption[] = [];
    if (officersRow) {
      const map: Array<[string, string]> = [
        ["president", "President"],
        ["vice_president", "Vice President"],
        ["secretary", "Secretary"],
        ["treasurer", "Treasurer"],
      ];
      for (const [key, title] of map) {
        const name = (officersRow as any)[key];
        if (name && String(name).trim()) {
          opts.push({
            value: `officer:${officersRow.id}:${key}`,
            label: `${name} — ${title}`,
            name: String(name).trim(),
            title,
            source_type: "officer",
            source_id: officersRow.id,
          });
        }
      }
    }
    for (const d of directors as any[]) {
      opts.push({
        value: `director:${d.id}`,
        label: `${d.name} — Director`,
        name: d.name,
        title: "Director",
        source_type: "director",
        source_id: d.id,
      });
    }
    for (const c of contacts as any[]) {
      opts.push({
        value: `contact:${c.id}`,
        label: `${c.full_name}${c.title ? ` — ${c.title}` : ""}`,
        name: c.full_name,
        title: c.title || "",
        source_type: "contact",
        source_id: c.id,
      });
    }
    return opts;
  }, [officersRow, directors, contacts]);

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ["ai_oversight_persons", companyId],
    queryFn: async () => {
      const sysIds = systems.map((s: any) => s.id);
      if (sysIds.length === 0) return [];
      const { data, error } = await supabase
        .from("ai_oversight_persons")
        .select("*")
        .in("ai_system_id", sysIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: systems.length > 0,
  });

  const add = useMutation({
    mutationFn: async () => {
      let snapshotName = "";
      let snapshotTitle = "";
      let source_type: "officer" | "director" | "contact" | null = null;
      let source_id: string | null = null;
      let contact_id: string | null = null;

      if (form.selected_person === ADD_NEW_VALUE) {
        if (!form.new_full_name.trim() || !form.new_title.trim()) {
          throw new Error("Full name and title are required");
        }
        const { data: contact, error: contactErr } = await supabase
          .from("ai_oversight_contacts")
          .insert({
            company_id: companyId,
            full_name: form.new_full_name.trim(),
            title: form.new_title.trim(),
            email: form.new_email.trim() || null,
          })
          .select()
          .single();
        if (contactErr) throw contactErr;
        snapshotName = contact.full_name;
        snapshotTitle = contact.title || "";
        source_type = "contact";
        source_id = contact.id;
        contact_id = contact.id;
      } else {
        const opt = personOptions.find((o) => o.value === form.selected_person);
        if (!opt) throw new Error("Please select a person");
        snapshotName = opt.name;
        snapshotTitle = opt.title;
        source_type = opt.source_type;
        source_id = opt.source_id;
        if (opt.source_type === "contact") contact_id = opt.source_id;
      }

      const { error } = await supabase.from("ai_oversight_persons").insert({
        ai_system_id: form.ai_system_id,
        person_name: snapshotName,
        title: snapshotTitle || null,
        oversight_role: form.oversight_role || null,
        effective_date: form.effective_date || null,
        assigned_date: form.effective_date || null,
        notes: form.notes || null,
        source_type,
        source_id,
        contact_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_oversight_persons", companyId] });
      qc.invalidateQueries({ queryKey: ["ai_oversight_contacts", companyId] });
      toast.success("Oversight person assigned");
      setOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_oversight_persons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_oversight_persons", companyId] });
      toast.success("Person removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getSystemName = (id: string) => systems.find((s: any) => s.id === id)?.system_name || "Unknown";
  const isAddNew = form.selected_person === ADD_NEW_VALUE;
  const canSubmit =
    !!form.ai_system_id &&
    !!form.oversight_role &&
    (isAddNew
      ? !!form.new_full_name.trim() && !!form.new_title.trim()
      : !!form.selected_person);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4" />
          Human Oversight Assignments (Art. 26.2)
        </h3>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...emptyForm }); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={systems.length === 0}>
              <Plus className="h-3.5 w-3.5 mr-1" />Assign Person
            </Button>
          </DialogTrigger>
          <DialogContent className="min-w-[600px]">
            <DialogHeader><DialogTitle>Assign Oversight Person</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <div>
                <Label className="text-xs">AI System *</Label>
                <Select value={form.ai_system_id} onValueChange={(v) => setForm((f) => ({ ...f, ai_system_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                  <SelectContent>
                    {systems.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.system_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Select Person *</Label>
                <Select
                  value={form.selected_person}
                  onValueChange={(v) => setForm((f) => ({ ...f, selected_person: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an officer, director, or contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {personOptions.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No officers or directors on file yet.
                      </div>
                    )}
                    {personOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                    <SelectItem value={ADD_NEW_VALUE}>+ Add Someone Else</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAddNew && (
                <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Full Name *</Label>
                      <Input
                        value={form.new_full_name}
                        onChange={(e) => setForm((f) => ({ ...f, new_full_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Title / Role *</Label>
                      <Input
                        value={form.new_title}
                        onChange={(e) => setForm((f) => ({ ...f, new_title: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Email (optional)</Label>
                    <Input
                      type="email"
                      value={form.new_email}
                      onChange={(e) => setForm((f) => ({ ...f, new_email: e.target.value }))}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Saved to your AI oversight contacts for future assignments.
                  </p>
                </div>
              )}

              <div>
                <Label className="text-xs">Oversight Role *</Label>
                <Select
                  value={form.oversight_role}
                  onValueChange={(v) => setForm((f) => ({ ...f, oversight_role: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    {OVERSIGHT_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Effective Date</Label>
                <DatePickerField
                  value={form.effective_date}
                  onChange={(v) => setForm((f) => ({ ...f, effective_date: v }))}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Date this oversight assignment takes effect
                </p>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <Button disabled={!canSubmit || add.isPending} onClick={() => add.mutate()}>
                {add.isPending ? "Saving…" : "Assign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {systems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          Register an AI system first to assign oversight persons.
        </p>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : persons.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No oversight persons assigned yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {persons.map((p: any) => (
            <Card key={p.id} className="relative">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-primary" />
                  {p.person_name}
                  <Badge
                    variant="outline"
                    className={`text-[10px] ml-auto ${
                      p.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {p.title && <p className="text-xs text-muted-foreground">{p.title}</p>}
                {p.oversight_role && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                    {p.oversight_role}
                  </Badge>
                )}
                <p className="text-[10px] text-muted-foreground">
                  System: <span className="font-medium text-foreground">{getSystemName(p.ai_system_id)}</span>
                </p>
                {p.effective_date && (
                  <p className="text-[10px] text-muted-foreground">
                    Effective: <span className="text-foreground">{p.effective_date}</span>
                  </p>
                )}
                {p.competence_description && (
                  <p className="text-[10px]">
                    <span className="text-muted-foreground">Competence:</span> {p.competence_description}
                  </p>
                )}
                {p.authority_scope && (
                  <p className="text-[10px]">
                    <span className="text-muted-foreground">Authority:</span> {p.authority_scope}
                  </p>
                )}
                {p.notes && (
                  <p className="text-[10px]">
                    <span className="text-muted-foreground">Notes:</span> {p.notes}
                  </p>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-6 w-6 text-destructive"
                  onClick={() => remove.mutate(p.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
