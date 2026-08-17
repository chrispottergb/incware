import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildCandidates,
  buildRelatedPartyIndex,
  partitionCandidates,
  defaultPeriod,
  INTERIM_CATEGORIES,
  type CandidateDescriptor,
  type InterimCategory,
} from "@/lib/interim-actions";

interface MeetingLike {
  id: string;
  company_id: string;
  meeting_date: string;
  prior_mtg_date?: string | null;
  tax_year?: number | null;
}

interface Props {
  open: boolean;
  meeting: MeetingLike;
  onCancel: () => void;
  /** Called after choices are saved; the caller then proceeds to the original print action. */
  onContinue: () => void;
}

interface RowState {
  key: string;
  actionId?: string;            // existing interim_actions row
  candidate?: CandidateDescriptor;
  action_date: string | null;
  description: string;
  amount: number | null;
  category: InterimCategory;
  is_related_party: boolean;
  source_table: string | null;
  source_id: string | null;
  checked: boolean;
  manual: boolean;
}

const badgeFor: Record<string, string> = {
  asset_transactions: "Assets",
  company_assets: "Leases",
  bank_authorized_signers: "Banking",
  meeting_loans: "Loans",
  agreements: "Agreements",
  meeting_benefits: "Benefits",
};

function fmtDate(d: string | null) {
  if (!d) return "During the year";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtMoney(a: number | null) {
  if (a === null || a === undefined) return "";
  return Number(a).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function RatificationSweep({ open, meeting, onCancel, onContinue }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState(() => defaultPeriod(meeting));
  const [editPeriod, setEditPeriod] = useState(false);
  const [rows, setRows] = useState<RowState[]>([]);
  const [documented, setDocumented] = useState<{ candidate: CandidateDescriptor; consentDate: string | null }[]>([]);
  const [showDocumented, setShowDocumented] = useState(false);
  const [newItem, setNewItem] = useState<{ date: string; description: string; amount: string; category: InterimCategory; related: boolean }>({
    date: "",
    description: "",
    amount: "",
    category: "Other",
    related: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = meeting.company_id;

      const [companyRes, shareholdersRes, meetingsRes, existingRes, savedRes, txRes, leasesRes, signersRes, banksRes] = await Promise.all([
        supabase.from("companies").select("address, city, state").eq("id", companyId).maybeSingle(),
        supabase.from("shareholders").select("name, address").eq("company_id", companyId),
        supabase.from("meetings").select("id, meeting_type, meeting_date").eq("company_id", companyId),
        supabase.from("interim_actions").select("*").eq("company_id", companyId),
        supabase.from("meeting_ratifications").select("*").eq("meeting_id", meeting.id),
        supabase.from("asset_transactions").select("*").eq("entity_id", companyId),
        supabase.from("company_assets").select("*").eq("company_id", companyId).eq("asset_type", "lease"),
        supabase.from("bank_authorized_signers").select("*").eq("company_id", companyId),
        supabase.from("company_banks").select("id, bank_name").eq("company_id", companyId),
      ]);

      const allMeetingIds = (meetingsRes.data ?? []).map((m: any) => m.id);
      const consentMeetings = (meetingsRes.data ?? []).filter((m: any) => (m.meeting_type || "").toLowerCase().includes("written consent"));
      const consentIds = new Set(consentMeetings.map((m: any) => m.id));
      const consentDateById: Record<string, string> = {};
      consentMeetings.forEach((m: any) => { consentDateById[m.id] = m.meeting_date; });

      // Meeting-scoped sources: query across ALL meetings for the company, not just this one.
      const [loansRes, agreementsRes, benefitsRes, resolutionsRes] = allMeetingIds.length
        ? await Promise.all([
            supabase.from("meeting_loans").select("*").in("meeting_id", allMeetingIds),
            supabase.from("agreements").select("*").in("meeting_id", allMeetingIds),
            supabase.from("meeting_benefits").select("*").in("meeting_id", allMeetingIds),
            supabase.from("meeting_resolutions").select("meeting_id, transaction_id, lease_id").in("meeting_id", Array.from(consentIds)),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }] as any;

      // Sources already documented by a written consent
      const consentedSources: Record<string, string | null> = {};
      for (const r of (resolutionsRes.data ?? [])) {
        const d = consentDateById[r.meeting_id] ?? null;
        if (r.transaction_id) consentedSources[`asset_transactions:${r.transaction_id}`] = d;
        if (r.lease_id) consentedSources[`company_assets:${r.lease_id}`] = d;
      }
      for (const r of (loansRes.data ?? [])) if (consentIds.has(r.meeting_id)) consentedSources[`meeting_loans:${r.id}`] = consentDateById[r.meeting_id] ?? null;
      for (const r of (agreementsRes.data ?? [])) if (consentIds.has(r.meeting_id)) consentedSources[`agreements:${r.id}`] = consentDateById[r.meeting_id] ?? null;
      for (const r of (benefitsRes.data ?? [])) if (consentIds.has(r.meeting_id)) consentedSources[`meeting_benefits:${r.id}`] = consentDateById[r.meeting_id] ?? null;

      const bankNamesById: Record<string, string> = {};
      (banksRes.data ?? []).forEach((b: any) => { bankNamesById[b.id] = b.bank_name; });

      const relatedIndex = buildRelatedPartyIndex(
        (shareholdersRes.data ?? []) as any,
        companyRes.data as any,
      );

      const all = buildCandidates(
        {
          assetTransactions: txRes.data ?? [],
          leases: leasesRes.data ?? [],
          loans: loansRes.data ?? [],
          agreements: agreementsRes.data ?? [],
          bankSigners: signersRes.data ?? [],
          benefits: benefitsRes.data ?? [],
          bankNamesById,
        },
        relatedIndex,
      );

      const existing = (existingRes.data ?? []) as any[];
      const saved = (savedRes.data ?? []) as any[];
      const savedByActionId: Record<string, any> = {};
      saved.forEach((s) => { savedByActionId[s.interim_action_id] = s; });

      const buckets = partitionCandidates(all, {
        start: period.start,
        end: period.end,
        existingActions: existing,
        consentedSources,
      });

      // Existing interim_actions already tied to this meeting (saved choices) come first.
      const savedRows: RowState[] = existing
        .filter((a) => savedByActionId[a.id])
        .map((a) => ({
          key: `action:${a.id}`,
          actionId: a.id,
          action_date: a.action_date,
          description: a.description,
          amount: a.amount === null ? null : Number(a.amount),
          category: (a.category || "Other") as InterimCategory,
          is_related_party: !!a.is_related_party,
          source_table: a.source_table,
          source_id: a.source_id,
          checked: savedByActionId[a.id].disposition === "ratified",
          manual: !a.source_table,
        }));

      // Manually added actions with no meeting decision yet (in-period or undated)
      const manualRows: RowState[] = existing
        .filter((a) => !a.source_table && !savedByActionId[a.id])
        .filter((a) => !a.action_date || (a.action_date >= period.start && a.action_date <= period.end))
        .map((a) => ({
          key: `action:${a.id}`,
          actionId: a.id,
          action_date: a.action_date,
          description: a.description,
          amount: a.amount === null ? null : Number(a.amount),
          category: (a.category || "Other") as InterimCategory,
          is_related_party: !!a.is_related_party,
          source_table: null,
          source_id: null,
          checked: true,
          manual: true,
        }));

      const candidateRows: RowState[] = [...buckets.candidates, ...buckets.relatedParty].map((c) => ({
        key: `cand:${c.sourceTable}:${c.sourceId}`,
        candidate: c,
        action_date: c.actionDate,
        description: c.description,
        amount: c.amount,
        category: c.category,
        is_related_party: c.isRelatedParty,
        source_table: c.sourceTable,
        source_id: c.sourceId,
        checked: true,
        manual: false,
      }));

      setRows([...savedRows, ...manualRows, ...candidateRows]);
      setDocumented(buckets.alreadyDocumented);
    } catch (err: any) {
      console.error("[RatificationSweep] load error", err);
      toast.error("Could not load this year's actions: " + (err?.message || "unknown error"));
    } finally {
      setLoading(false);
    }
  }, [meeting.id, meeting.company_id, period.start, period.end]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const setRow = (key: string, patch: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addManual = () => {
    if (!newItem.description.trim()) {
      toast.error("Describe the action in one sentence.");
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        key: `new:${crypto.randomUUID()}`,
        action_date: newItem.date || null,
        description: newItem.description.trim(),
        amount: newItem.amount ? Number(newItem.amount) : null,
        category: newItem.category,
        is_related_party: newItem.related,
        source_table: null,
        source_id: null,
        checked: true,
        manual: true,
      },
    ]);
    setNewItem({ date: "", description: "", amount: "", category: "Other", related: false });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ratifications: { meeting_id: string; interim_action_id: string; disposition: string; sort_order: number }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        let actionId = r.actionId;

        if (actionId) {
          await supabase
            .from("interim_actions")
            .update({
              action_date: r.action_date,
              description: r.description,
              amount: r.amount,
              category: r.category,
              is_related_party: r.is_related_party,
            })
            .eq("id", actionId);
        } else {
          const { data, error } = await supabase
            .from("interim_actions")
            .insert({
              company_id: meeting.company_id,
              action_date: r.action_date,
              description: r.description,
              amount: r.amount,
              category: r.category,
              is_related_party: r.is_related_party,
              source_table: r.source_table,
              source_id: r.source_id,
            })
            .select("id")
            .maybeSingle();
          if (error) {
            // Unique index hit: the source was already captured — reuse that row.
            const { data: found } = await supabase
              .from("interim_actions")
              .select("id")
              .eq("company_id", meeting.company_id)
              .eq("source_table", r.source_table ?? "")
              .eq("source_id", r.source_id ?? "")
              .maybeSingle();
            actionId = found?.id;
          } else {
            actionId = data?.id;
          }
        }

        if (actionId) {
          ratifications.push({
            meeting_id: meeting.id,
            interim_action_id: actionId,
            disposition: r.checked ? "ratified" : "excluded",
            sort_order: i,
          });
        }
      }

      if (ratifications.length > 0) {
        const { error } = await supabase
          .from("meeting_ratifications")
          .upsert(ratifications, { onConflict: "meeting_id,interim_action_id" });
        if (error) throw error;
      }

      onContinue();
    } catch (err: any) {
      console.error("[RatificationSweep] save error", err);
      toast.error("Could not save: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const found = rows.filter((r) => !r.manual && !r.is_related_party);
  const related = rows.filter((r) => !r.manual && r.is_related_party);
  const manual = rows.filter((r) => r.manual);
  const selectedCount = rows.filter((r) => r.checked).length;

  const renderRow = (r: RowState) => (
    <div key={r.key} className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
      <Checkbox checked={r.checked} onCheckedChange={(v) => setRow(r.key, { checked: !!v })} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground w-28 shrink-0">{fmtDate(r.action_date)}</span>
          <span className="text-sm">{r.description}</span>
          {r.source_table && <Badge variant="outline" className="text-[10px]">{badgeFor[r.source_table] || r.source_table}</Badge>}
          {r.amount !== null && <span className="text-xs text-muted-foreground">{fmtMoney(r.amount)}</span>}
        </div>
        <label className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox checked={r.is_related_party} onCheckedChange={(v) => setRow(r.key, { is_related_party: !!v })} className="h-3 w-3" />
          Related party
        </label>
      </div>
      {r.manual && !r.actionId && (
        <Button size="sm" variant="ghost" onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="min-w-[720px] max-w-3xl max-h-[85vh] overflow-y-auto bg-background/95">
        <DialogHeader>
          <DialogTitle className="font-display">What happened this year?</DialogTitle>
          <DialogDescription>
            {rows.length} found · {selectedCount} selected
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-muted-foreground">
          Period: {fmtDate(period.start)} – {fmtDate(period.end)}{" "}
          <button type="button" className="underline" onClick={() => setEditPeriod((v) => !v)}>change period</button>
        </div>
        {editPeriod && (
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={period.start} onChange={(e) => setPeriod((p) => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={period.end} onChange={(e) => setPeriod((p) => ({ ...p, end: e.target.value }))} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Found in your records</h4>
              {found.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing found in this period.</p>
              ) : found.map(renderRow)}
            </section>

            {related.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Needs separate treatment</h4>
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
                  {related.map(renderRow)}
                </div>
              </section>
            )}

            {manual.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added by you</h4>
                {manual.map(renderRow)}
              </section>
            )}

            <section className="space-y-2 rounded-md border border-dashed border-border p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add an action</h4>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <Label className="text-xs">Date (optional)</Label>
                  <Input type="date" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="min-w-[240px] flex-1">
                  <Label className="text-xs">What happened</Label>
                  <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="One sentence" />
                </div>
                <div className="w-32">
                  <Label className="text-xs">Amount</Label>
                  <Input type="number" step="0.01" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })} />
                </div>
                <div className="w-40">
                  <Label className="text-xs">Category</Label>
                  <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v as InterimCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[100] bg-background">
                      {INTERIM_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-1.5 pb-2 text-xs">
                  <Checkbox checked={newItem.related} onCheckedChange={(v) => setNewItem({ ...newItem, related: !!v })} />
                  Related party
                </label>
                <Button size="sm" variant="outline" onClick={addManual} className="mb-0.5">
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </section>

            {documented.length > 0 && (
              <section className="rounded-md border border-border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
                  onClick={() => setShowDocumented((v) => !v)}
                >
                  {showDocumented ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Already documented — {documented.length} item{documented.length === 1 ? "" : "s"} skipped
                </button>
                {showDocumented && (
                  <div className="space-y-1 border-t border-border px-3 py-2">
                    {documented.map((d) => (
                      <div key={`${d.candidate.sourceTable}:${d.candidate.sourceId}`} className="text-xs text-muted-foreground">
                        {fmtDate(d.candidate.actionDate)} — {d.candidate.description}
                        {d.consentDate ? ` (written consent dated ${fmtDate(d.consentDate)})` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        <DialogFooter className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Nothing happened this year? Uncheck everything — the minutes will say so.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
