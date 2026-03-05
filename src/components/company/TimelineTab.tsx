import { useState, useMemo } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Loader2, Clock, Building2, CalendarDays, Gavel,
  Users, Award, BookOpen, FileText, DollarSign, Flag, Pencil, Car, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";

type Company = Tables<"companies">;

interface Props {
  companyId: string;
  company: Company;
}

interface TimelineEntry {
  id: string;
  date: string;
  sortDate: number;
  title: string;
  description?: string;
  type: string;
  source: "auto" | "manual";
  icon: React.ElementType;
  color: string;
}

const EVENT_TYPES = [
  { value: "general", label: "General" },
  { value: "filing", label: "Filing / Legal" },
  { value: "compliance", label: "Compliance" },
  { value: "financial", label: "Financial" },
  { value: "shareholder", label: "Shareholder" },
  { value: "officer", label: "Officer / Director" },
  { value: "annual_review", label: "Annual Review" },
  { value: "other", label: "Other" },
];

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  incorporation: { icon: Building2, color: "bg-primary/10 text-primary border-primary/20" },
  filing: { icon: Gavel, color: "bg-accent/10 text-accent border-accent/20" },
  meeting: { icon: CalendarDays, color: "bg-success/10 text-success border-success/20" },
  s_election: { icon: FileText, color: "bg-warning/10 text-warning border-warning/20" },
  shareholder: { icon: Users, color: "bg-primary/10 text-primary border-primary/20" },
  certificate: { icon: Award, color: "bg-accent/10 text-accent border-accent/20" },
  transaction: { icon: BookOpen, color: "bg-success/10 text-success border-success/20" },
  financial: { icon: DollarSign, color: "bg-warning/10 text-warning border-warning/20" },
  compliance: { icon: Flag, color: "bg-destructive/10 text-destructive border-destructive/20" },
  annual_review: { icon: CalendarDays, color: "bg-primary/10 text-primary border-primary/20" },
  officer: { icon: Users, color: "bg-accent/10 text-accent border-accent/20" },
  vehicle: { icon: Car, color: "bg-warning/10 text-warning border-warning/20" },
  equipment: { icon: Wrench, color: "bg-accent/10 text-accent border-accent/20" },
  general: { icon: Clock, color: "bg-muted text-muted-foreground border-border" },
  other: { icon: Clock, color: "bg-muted text-muted-foreground border-border" },
};

export default function TimelineTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    event_date: new Date().toISOString().split("T")[0],
    event_type: "general",
    title: "",
    description: "",
  });

  const resetForm = () => {
    setForm({ event_date: new Date().toISOString().split("T")[0], event_type: "general", title: "", description: "" });
    setEditId(null);
  };

  const openEditEvent = (entry: TimelineEntry) => {
    setEditId(entry.id);
    setForm({ event_date: entry.date, event_type: entry.type, title: entry.title, description: entry.description || "" });
    setDialog(true);
  };

  // Fetch all related data for auto-generation
  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings").select("id, meeting_type, meeting_date, sub_type, tax_year, chairperson")
        .eq("company_id", companyId).order("meeting_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates").select("id, certificate_number, share_class, num_shares, issue_date, cancelled_date, status, shareholders(name)")
        .eq("company_id", companyId).order("issue_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["share_transactions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions").select("id, transaction_type, share_class, num_shares, transaction_date, shareholders(name), from_shareholder, to_shareholder")
        .eq("company_id", companyId).order("transaction_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: companyAssets = [] } = useQuery({
    queryKey: ["company_assets", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_assets").select("*")
        .eq("company_id", companyId)
        .in("asset_type", ["vehicle", "equipment"])
        .order("purchase_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: manualEvents = [], isLoading } = useQuery({
    queryKey: ["timeline_events", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timeline_events").select("*")
        .eq("company_id", companyId).order("event_date");
      if (error) throw error;
      return data;
    },
  });

  const saveEvent = useMutation({
    mutationFn: async () => {
      const payload = {
        event_date: form.event_date,
        event_type: form.event_type,
        title: form.title,
        description: form.description || null,
      };
      if (editId) {
        const { error } = await supabase.from("timeline_events").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("timeline_events").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_events", companyId] });
      setDialog(false);
      resetForm();
      toast.success(editId ? "Event updated!" : "Event added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timeline_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline_events", companyId] });
      toast.success("Event removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Build auto-generated timeline
  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = [];

    // Incorporation date
    if (company.incorporation_date) {
      entries.push({
        id: "inc_date",
        date: company.incorporation_date,
        sortDate: new Date(company.incorporation_date + "T00:00:00").getTime(),
        title: "Corporation Incorporated",
        description: `${company.name} incorporated in ${company.state_of_incorporation || "state"} as a ${company.entity_type}`,
        type: "incorporation",
        source: "auto",
        icon: typeConfig.incorporation.icon,
        color: typeConfig.incorporation.color,
      });
    }

    // Filing date
    if (company.filing_date) {
      entries.push({
        id: "filing_date",
        date: company.filing_date,
        sortDate: new Date(company.filing_date + "T00:00:00").getTime(),
        title: "Articles Filed",
        description: "Articles of incorporation filed with the state",
        type: "filing",
        source: "auto",
        icon: typeConfig.filing.icon,
        color: typeConfig.filing.color,
      });
    }

    // S-Election date
    if (company.s_election_date) {
      entries.push({
        id: "s_election",
        date: company.s_election_date,
        sortDate: new Date(company.s_election_date + "T00:00:00").getTime(),
        title: "S-Corporation Election Filed",
        description: "IRS Form 2553 filed for S-Corp election",
        type: "s_election",
        source: "auto",
        icon: typeConfig.s_election.icon,
        color: typeConfig.s_election.color,
      });
    }

    // Verification date
    if (company.verification_date) {
      entries.push({
        id: "verification",
        date: company.verification_date,
        sortDate: new Date(company.verification_date + "T00:00:00").getTime(),
        title: "Corporate Status Verified",
        description: `Status verified with WI DFI — ${company.corporate_status || "current"}`,
        type: "compliance",
        source: "auto",
        icon: typeConfig.compliance.icon,
        color: typeConfig.compliance.color,
      });
    }

    // Meetings
    meetings.forEach((m) => {
      entries.push({
        id: `meeting_${m.id}`,
        date: m.meeting_date,
        sortDate: new Date(m.meeting_date + "T00:00:00").getTime(),
        title: `${m.meeting_type}${m.sub_type ? ` (${m.sub_type})` : ""}`,
        description: `${m.meeting_type} held${m.tax_year ? ` for tax year ${m.tax_year}` : ""}${m.chairperson ? `, chaired by ${m.chairperson}` : ""}`,
        type: "meeting",
        source: "auto",
        icon: typeConfig.meeting.icon,
        color: typeConfig.meeting.color,
      });
    });

    // Certificates issued
    certificates.forEach((c: any) => {
      if (c.issue_date) {
        entries.push({
          id: `cert_issue_${c.id}`,
          date: c.issue_date,
          sortDate: new Date(c.issue_date + "T00:00:00").getTime(),
          title: `Certificate #${c.certificate_number} Issued`,
          description: `${c.num_shares?.toLocaleString()} ${c.share_class} shares to ${c.shareholders?.name || "unknown"}`,
          type: "certificate",
          source: "auto",
          icon: typeConfig.certificate.icon,
          color: typeConfig.certificate.color,
        });
      }
      if (c.cancelled_date) {
        entries.push({
          id: `cert_cancel_${c.id}`,
          date: c.cancelled_date,
          sortDate: new Date(c.cancelled_date + "T00:00:00").getTime(),
          title: `Certificate #${c.certificate_number} Cancelled`,
          description: `${c.num_shares?.toLocaleString()} ${c.share_class} shares cancelled`,
          type: "certificate",
          source: "auto",
          icon: typeConfig.certificate.icon,
          color: typeConfig.compliance.color,
        });
      }
    });

    // Transactions
    transactions.forEach((t: any) => {
      entries.push({
        id: `txn_${t.id}`,
        date: t.transaction_date,
        sortDate: new Date(t.transaction_date + "T00:00:00").getTime(),
        title: `Share ${t.transaction_type?.replace("_", " ")} — ${t.num_shares?.toLocaleString()} ${t.share_class}`,
        description: t.transaction_type === "transfer"
          ? `From ${t.from_shareholder || "—"} to ${t.to_shareholder || "—"}`
          : `${t.shareholders?.name || ""}`,
        type: "transaction",
        source: "auto",
        icon: typeConfig.transaction.icon,
        color: typeConfig.transaction.color,
      });
    });

    // Vehicles & Equipment
    companyAssets.forEach((a) => {
      const eventDate = a.purchase_date || a.created_at?.split("T")[0];
      if (!eventDate) return;
      const isVehicle = a.asset_type === "vehicle";
      const typeCfg = typeConfig[isVehicle ? "vehicle" : "equipment"];
      const fmt = (v: number | null | undefined) =>
        v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : null;
      const parts: string[] = [];
      if (isVehicle && a.vin) parts.push(`VIN: ${a.vin}`);
      if (a.purchase_amount) parts.push(`Purchase price: ${fmt(a.purchase_amount)}`);
      if (!isVehicle && a.manufacturer) parts.push(`Mfr: ${a.manufacturer}`);

      entries.push({
        id: `asset_${a.id}`,
        date: eventDate,
        sortDate: new Date(eventDate + "T00:00:00").getTime(),
        title: `${isVehicle ? "Vehicle" : "Equipment"} — ${a.description || "Unknown"}`,
        description: parts.length > 0 ? parts.join(" · ") : undefined,
        type: isVehicle ? "vehicle" : "equipment",
        source: "auto",
        icon: typeCfg.icon,
        color: typeCfg.color,
      });
    });

    // Manual events
    manualEvents.forEach((e) => {
      const cfg = typeConfig[e.event_type] || typeConfig.general;
      entries.push({
        id: e.id,
        date: e.event_date,
        sortDate: new Date(e.event_date + "T00:00:00").getTime(),
        title: e.title,
        description: e.description ?? undefined,
        type: e.event_type,
        source: "manual",
        icon: cfg.icon,
        color: cfg.color,
      });
    });

    return entries.sort((a, b) => a.sortDate - b.sortDate);
  }, [company, meetings, certificates, transactions, companyAssets, manualEvents]);

  // Group by year
  const groupedByYear = useMemo(() => {
    const groups: Record<string, TimelineEntry[]> = {};
    timeline.forEach((e) => {
      const year = new Date(e.date + "T00:00:00").getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
  }, [timeline]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="card-section-title">Corporate Timeline</CardTitle>
            </div>
            <CardDescription className="text-[11px] mt-0.5">
              Auto-generated from corporate records + manual entries · {timeline.length} events
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <SectionPdfActions
              config={{
                title: "Corporate Timeline",
                companyName: company.name,
                table: {
                  headers: ["Date", "Type", "Event", "Description"],
                  rows: timeline.map((e) => [
                    new Date(e.date + "T00:00:00").toLocaleDateString(),
                    e.type.replace("_", " "),
                    e.title,
                    e.description || "—",
                  ]),
                },
              }}
            />
            <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" /> Add Event
                </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-base">{editId ? "Edit Timeline Event" : "Add Timeline Event"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveEvent.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Date</Label>
                    <DatePickerField value={form.event_date} onChange={(v) => setForm(p => ({ ...p, event_date: v }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Type</Label>
                    <Select value={form.event_type} onValueChange={(v) => setForm(p => ({ ...p, event_type: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="field-group">
                  <Label className="field-label">Title</Label>
                  <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required placeholder="e.g. Annual Report Filed" />
                </div>
                <div className="field-group">
                  <Label className="field-label">Description (optional)</Label>
                  <Textarea className="text-sm min-h-[50px]" rows={2} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={saveEvent.isPending}>
                  {saveEvent.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editId ? "Save Changes" : "Add Event"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-10">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">No events yet. Add incorporation details or create a manual event.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByYear.map(([year, events]) => (
                <div key={year}>
                  <div className="sticky top-0 z-10 bg-card pb-2 mb-3 border-b border-border">
                    <h3 className="font-display text-sm font-bold text-foreground">{year}</h3>
                    <p className="text-[10px] text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="relative ml-3">
                    {/* Timeline line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                    <div className="space-y-3">
                      {events.map((entry) => {
                        const Icon = entry.icon;
                        return (
                          <div key={entry.id} className="relative flex gap-3 group">
                            {/* Dot */}
                            <div className={`relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${entry.color}`}>
                              <Icon className="h-2.5 w-2.5" />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 pb-1">
                              <div className="flex items-start gap-2 flex-wrap">
                                <p className="text-xs font-medium text-foreground leading-tight">{entry.title}</p>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">
                                    {entry.type.replace("_", " ")}
                                  </Badge>
                                  {entry.source === "manual" && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-accent/10 text-accent border-accent/20">
                                      manual
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                              </p>
                              {entry.description && (
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{entry.description}</p>
                              )}
                            </div>

                            {/* Edit/Delete manual events */}
                            {entry.source === "manual" && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => openEditEvent(entry)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive"
                                  onClick={() => removeEvent.mutate(entry.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
