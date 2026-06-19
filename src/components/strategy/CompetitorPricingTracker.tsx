import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, History, Download, Plus, ExternalLink, Image as ImageIcon, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

type Entry = {
  id: string;
  competitor_name: string;
  plan_name: string;
  price_amount: number | null;
  price_display: string;
  billing_cycle: string;
  features: string[];
  notes: string | null;
  our_positioning: string | null;
  source_url: string | null;
  screenshot_path: string | null;
  verified_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type HistoryRow = {
  id: string;
  entry_id: string;
  change_type: string;
  previous_price_display: string | null;
  new_price_display: string | null;
  changed_at: string;
  diff: any;
};

const BUCKET = "competitor-pricing-screenshots";

const emptyForm = {
  competitor_name: "",
  plan_name: "",
  price_amount: "",
  price_display: "",
  billing_cycle: "monthly",
  features: "",
  notes: "",
  our_positioning: "",
  source_url: "",
  verified_date: format(new Date(), "yyyy-MM-dd"),
  is_active: true,
};

export function CompetitorPricingTracker() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [historyEntry, setHistoryEntry] = useState<Entry | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["competitor_pricing_entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competitor_pricing_entries")
        .select("*")
        .order("competitor_name", { ascending: true })
        .order("plan_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["competitor_pricing_history", historyEntry?.id],
    queryFn: async () => {
      if (!historyEntry) return [];
      const { data, error } = await supabase
        .from("competitor_pricing_history")
        .select("*")
        .eq("entry_id", historyEntry.id)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
    enabled: !!historyEntry,
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setScreenshotFile(null);
    setEditing(null);
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      competitor_name: e.competitor_name,
      plan_name: e.plan_name,
      price_amount: e.price_amount?.toString() ?? "",
      price_display: e.price_display,
      billing_cycle: e.billing_cycle,
      features: e.features.join("\n"),
      notes: e.notes ?? "",
      our_positioning: e.our_positioning ?? "",
      source_url: e.source_url ?? "",
      verified_date: e.verified_date,
      is_active: e.is_active,
    });
    setOpen(true);
  };

  const uploadScreenshot = async (entryId: string): Promise<string | null> => {
    if (!screenshotFile) return null;
    const ext = screenshotFile.name.split(".").pop() ?? "png";
    const path = `${entryId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, screenshotFile, { upsert: true });
    if (error) throw error;
    return path;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!form.competitor_name.trim() || !form.plan_name.trim() || !form.price_display.trim()) {
        throw new Error("Competitor, plan, and price are required");
      }
      const payload = {
        competitor_name: form.competitor_name.trim(),
        plan_name: form.plan_name.trim(),
        price_amount: form.price_amount ? Number(form.price_amount) : null,
        price_display: form.price_display.trim(),
        billing_cycle: form.billing_cycle,
        features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
        notes: form.notes.trim() || null,
        our_positioning: form.our_positioning.trim() || null,
        source_url: form.source_url.trim() || null,
        verified_date: form.verified_date,
        is_active: form.is_active,
      };

      let entryId: string;
      if (editing) {
        const { error } = await supabase
          .from("competitor_pricing_entries")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        entryId = editing.id;
      } else {
        const { data, error } = await supabase
          .from("competitor_pricing_entries")
          .insert({ ...payload, created_by: userData.user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        entryId = data.id;
      }

      if (screenshotFile) {
        const path = await uploadScreenshot(entryId);
        if (path) {
          await supabase.from("competitor_pricing_entries").update({ screenshot_path: path }).eq("id", entryId);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitor_pricing_entries"] });
      toast.success(editing ? "Pricing entry updated" : "Pricing entry added");
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("competitor_pricing_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["competitor_pricing_entries"] });
      toast.success("Entry deleted");
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    entries.filter((e) => e.is_active).forEach((e) => {
      const arr = map.get(e.competitor_name) ?? [];
      arr.push(e);
      map.set(e.competitor_name, arr);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  const openScreenshot = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) {
      toast.error("Could not load screenshot");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("entityIQ — Competitor Pricing Comparison", 40, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Verified snapshot generated ${format(new Date(), "MMM d, yyyy")}`, 40, 68);
    doc.text("Internal & confidential — admin compiled from verified public sources", 40, 82);

    const rows = entries
      .filter((e) => e.is_active)
      .map((e) => [
        e.competitor_name,
        e.plan_name,
        e.price_display,
        e.billing_cycle,
        e.features.slice(0, 6).join("\n• "),
        e.our_positioning ?? "",
        format(new Date(e.verified_date), "MMM d, yyyy"),
      ]);

    autoTable(doc, {
      startY: 100,
      head: [["Competitor", "Plan", "Price", "Billing", "Key Features", "Our Positioning", "Verified"]],
      body: rows.map((r) => [r[0], r[1], r[2], r[3], (r[4] ? "• " + r[4] : ""), r[5], r[6]]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 6, valign: "top" },
      headStyles: { fillColor: [214, 228, 240], textColor: 30, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 95, fontStyle: "bold" },
        1: { cellWidth: 90 },
        2: { cellWidth: 70 },
        3: { cellWidth: 55 },
        4: { cellWidth: 200 },
        5: { cellWidth: 170 },
        6: { cellWidth: 65 },
      },
      didDrawPage: (data) => {
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `entityIQ Competitor Pricing — page ${doc.getNumberOfPages()}`,
          pageWidth - 40,
          doc.internal.pageSize.getHeight() - 20,
          { align: "right" }
        );
      },
    });

    // Sources page
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.text("Sources & Verification", 40, 50);
    let y = 80;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    entries.filter((e) => e.is_active).forEach((e) => {
      if (y > 540) {
        doc.addPage();
        y = 50;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${e.competitor_name} — ${e.plan_name}`, 40, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Verified ${format(new Date(e.verified_date), "MMM d, yyyy")} · ${e.price_display} · ${e.billing_cycle}`, 40, y + 14);
      if (e.source_url) {
        doc.setTextColor(0, 102, 204);
        doc.textWithLink(e.source_url, 40, y + 28, { url: e.source_url });
      }
      if (e.notes) {
        doc.setTextColor(60);
        const wrapped = doc.splitTextToSize(`Notes: ${e.notes}`, pageWidth - 80);
        doc.text(wrapped, 40, y + 42);
        y += 14 * wrapped.length;
      }
      doc.setTextColor(30);
      y += 60;
    });

    doc.save(`entityIQ-competitor-pricing-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Competitor Pricing Tracker</CardTitle>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Verified pricing pulled by an admin from public sources. Every change is logged for audit.
            Use the export to drop a snapshot into the GTM playbook.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={entries.length === 0}>
            <FileDown className="h-4 w-4 mr-1.5" /> Export comparison PDF
          </Button>
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Add entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[680px] bg-background/95">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit pricing entry" : "Record competitor pricing"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <Label>Competitor *</Label>
                  <Input value={form.competitor_name} onChange={(e) => setForm({ ...form, competitor_name: e.target.value })} placeholder="e.g. LegalZoom" />
                </div>
                <div className="col-span-1">
                  <Label>Plan name *</Label>
                  <Input value={form.plan_name} onChange={(e) => setForm({ ...form, plan_name: e.target.value })} placeholder="e.g. Business Advisory Plan" />
                </div>
                <div className="col-span-1">
                  <Label>Price (display) *</Label>
                  <Input value={form.price_display} onChange={(e) => setForm({ ...form, price_display: e.target.value })} placeholder="$39 / mo" />
                </div>
                <div className="col-span-1">
                  <Label>Price (numeric, for sorting)</Label>
                  <Input type="number" step="0.01" value={form.price_amount} onChange={(e) => setForm({ ...form, price_amount: e.target.value })} placeholder="39" />
                </div>
                <div className="col-span-1">
                  <Label>Billing cycle</Label>
                  <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="per-entity">Per entity</SelectItem>
                      <SelectItem value="per-user">Per user</SelectItem>
                      <SelectItem value="custom">Custom / quote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Label>Verified date</Label>
                  <Input type="date" value={form.verified_date} onChange={(e) => setForm({ ...form, verified_date: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Source URL</Label>
                  <Input value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <Label>Features (one per line)</Label>
                  <Textarea rows={4} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder={"Unlimited entities\nDocument templates\nCompliance alerts"} />
                </div>
                <div className="col-span-2">
                  <Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label>Our positioning vs. this plan</Label>
                  <Textarea rows={2} value={form.our_positioning} onChange={(e) => setForm({ ...form, our_positioning: e.target.value })} placeholder="How entityIQ wins / loses against this plan" />
                </div>
                <div className="col-span-2">
                  <Label>Screenshot evidence (optional)</Label>
                  <Input type="file" accept="image/*" onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)} />
                  {editing?.screenshot_path && !screenshotFile && (
                    <button type="button" className="text-[11px] text-primary underline mt-1" onClick={() => openScreenshot(editing.screenshot_path!)}>
                      View existing screenshot
                    </button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save entry"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6">Loading…</p>
        ) : entries.length === 0 ? (
          <div className="border border-dashed rounded-lg py-10 text-center text-sm text-muted-foreground">
            No pricing entries yet. Click <b>Add entry</b> to record your first verified competitor price.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([competitor, rows]) => (
              <div key={competitor}>
                <div className="flex items-baseline justify-between mb-2">
                  <h4 className="font-semibold text-sm">{competitor}</h4>
                  <span className="text-[11px] text-muted-foreground">{rows.length} plan{rows.length === 1 ? "" : "s"}</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Features</TableHead>
                      <TableHead>Our positioning</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead className="w-[140px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.plan_name}</TableCell>
                        <TableCell><Badge variant="secondary">{e.price_display}</Badge></TableCell>
                        <TableCell className="text-xs capitalize">{e.billing_cycle}</TableCell>
                        <TableCell className="text-[12px] max-w-[260px]">
                          <ul className="list-disc pl-4 space-y-0.5">
                            {e.features.slice(0, 4).map((f) => <li key={f}>{f}</li>)}
                            {e.features.length > 4 && <li className="text-muted-foreground">+{e.features.length - 4} more</li>}
                          </ul>
                        </TableCell>
                        <TableCell className="text-[12px] max-w-[220px]">{e.our_positioning ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">{format(new Date(e.verified_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {e.source_url && (
                              <Button size="icon" variant="ghost" asChild title="Open source">
                                <a href={e.source_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                              </Button>
                            )}
                            {e.screenshot_path && (
                              <Button size="icon" variant="ghost" title="View screenshot" onClick={() => openScreenshot(e.screenshot_path!)}>
                                <ImageIcon className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="History" onClick={() => setHistoryEntry(e)}>
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Delete"
                              onClick={() => {
                                if (confirm(`Delete ${e.competitor_name} — ${e.plan_name}? This is permanent.`)) {
                                  deleteMutation.mutate(e.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}

        {/* History dialog */}
        <Dialog open={!!historyEntry} onOpenChange={(o) => !o && setHistoryEntry(null)}>
          <DialogContent className="max-w-[640px] bg-background/95">
            <DialogHeader>
              <DialogTitle>
                Change log — {historyEntry?.competitor_name} · {historyEntry?.plan_name}
              </DialogTitle>
            </DialogHeader>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No history yet.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="border rounded-md p-3 text-[12px]">
                    <div className="flex justify-between mb-1">
                      <Badge variant={h.change_type === "created" ? "default" : "secondary"}>{h.change_type}</Badge>
                      <span className="text-muted-foreground">{format(new Date(h.changed_at), "MMM d, yyyy h:mm a")}</span>
                    </div>
                    {h.change_type === "updated" && (
                      <div>
                        Price: <span className="line-through text-muted-foreground">{h.previous_price_display ?? "—"}</span>
                        {" → "}
                        <b>{h.new_price_display ?? "—"}</b>
                      </div>
                    )}
                    {h.change_type === "created" && <div>Initial price: <b>{h.new_price_display}</b></div>}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
