import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Calendar, MapPin, ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import TaxReturnUpload from "@/components/TaxReturnUpload";

const MEETING_TYPES = [
  "Annual Meeting",
  "Organizational Meeting",
  "Special Meeting of Board of Directors",
];

const SUB_TYPES: Record<string, string[]> = {
  "Special Meeting of Board of Directors": [
    "Approve Officer Bonuses",
    "Approve Issuance, Transfer, Sale of Shares",
    "Authorize a Line of Credit",
    "Adopt Regular Meeting Resolution",
    "Approve Distributions",
    "Other",
  ],
};

interface Props {
  companyId: string;
  company: Tables<"companies">;
}

export default function MeetingsTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    meeting_date: "",
    meeting_time: "10:00 AM",
    tax_year: new Date().getFullYear().toString(),
    meeting_type: "Annual Meeting",
    sub_type: "",
    meeting_location: company.address
      ? `${company.address}, ${company.city ?? ""}, ${company.state ?? ""}`
      : "",
    chairperson: "",
    mtg_secretary: "",
    others_present: "",
    prior_mtg_date: "",
    next_annual_mtg: "",
    company_name_at_meeting: company.name,
    company_address_at_meeting: company.address ?? "",
    company_city_at_meeting: company.city ?? "",
    company_state_at_meeting: company.state ?? "",
    company_zip_at_meeting: company.zip ?? "",
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meetings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("company_id", companyId)
        .order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").insert({
        company_id: companyId,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || null,
        tax_year: form.tax_year ? parseInt(form.tax_year) : null,
        meeting_type: form.meeting_type,
        sub_type: form.sub_type || null,
        meeting_location: form.meeting_location || null,
        chairperson: form.chairperson || null,
        mtg_secretary: form.mtg_secretary || null,
        others_present: form.others_present || null,
        prior_mtg_date: form.prior_mtg_date || null,
        next_annual_mtg: form.next_annual_mtg || null,
        company_name_at_meeting: form.company_name_at_meeting || null,
        company_address_at_meeting: form.company_address_at_meeting || null,
        company_city_at_meeting: form.company_city_at_meeting || null,
        company_state_at_meeting: form.company_state_at_meeting || null,
        company_zip_at_meeting: form.company_zip_at_meeting || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
      setDialogOpen(false);
      toast.success("Meeting created!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
      toast.success("Meeting deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const hasSubTypes = SUB_TYPES[form.meeting_type];
  const isOrgMeeting = form.meeting_type === "Organizational Meeting";

  const meetingTypeColor = (type: string) => {
    if (type === "Annual Meeting") return "bg-primary/10 text-primary";
    if (type === "Organizational Meeting") return "bg-accent/10 text-accent";
    return "bg-warning/10 text-warning";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Meetings</h3>
          <p className="text-sm text-muted-foreground">
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} on record
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TaxReturnUpload
            companyId={companyId}
            mode="populate"
            onExtracted={() => {
              queryClient.invalidateQueries({ queryKey: ["meetings", companyId] });
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Tax Return
              </Button>
            }
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">New Meeting</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMeeting.mutate();
              }}
              className="space-y-4"
            >
              {/* Meeting Info Section */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Date *</Label>
                  <Input
                    type="date"
                    value={form.meeting_date}
                    onChange={(e) => setForm((p) => ({ ...p, meeting_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Time</Label>
                  <Input
                    value={form.meeting_time}
                    onChange={(e) => setForm((p) => ({ ...p, meeting_time: e.target.value }))}
                    placeholder="10:00 AM"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tax Year</Label>
                  <Input
                    type="number"
                    value={form.tax_year}
                    onChange={(e) => setForm((p) => ({ ...p, tax_year: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Meeting Type</Label>
                  <Select
                    value={form.meeting_type}
                    onValueChange={(v) => setForm((p) => ({ ...p, meeting_type: v, sub_type: "" }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasSubTypes && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Sub Type</Label>
                    <Select value={form.sub_type} onValueChange={(v) => setForm((p) => ({ ...p, sub_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select sub type" /></SelectTrigger>
                      <SelectContent>
                        {SUB_TYPES[form.meeting_type].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Meeting Location</Label>
                <Input
                  value={form.meeting_location}
                  onChange={(e) => setForm((p) => ({ ...p, meeting_location: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Chairperson</Label>
                  <Input
                    value={form.chairperson}
                    onChange={(e) => setForm((p) => ({ ...p, chairperson: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Meeting Secretary</Label>
                  <Input
                    value={form.mtg_secretary}
                    onChange={(e) => setForm((p) => ({ ...p, mtg_secretary: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Others Present</Label>
                <Input
                  value={form.others_present}
                  onChange={(e) => setForm((p) => ({ ...p, others_present: e.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!isOrgMeeting && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Prior Meeting Date</Label>
                    <Input
                      type="date"
                      value={form.prior_mtg_date}
                      onChange={(e) => setForm((p) => ({ ...p, prior_mtg_date: e.target.value }))}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Next Annual Meeting</Label>
                  <Input
                    type="date"
                    value={form.next_annual_mtg}
                    onChange={(e) => setForm((p) => ({ ...p, next_annual_mtg: e.target.value }))}
                  />
                </div>
              </div>

              {/* Company info at time of meeting */}
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Company Name & Address on Day of Meeting
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                    <Input
                      value={form.company_name_at_meeting}
                      onChange={(e) => setForm((p) => ({ ...p, company_name_at_meeting: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                    <Input
                      value={form.company_address_at_meeting}
                      onChange={(e) => setForm((p) => ({ ...p, company_address_at_meeting: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">City</Label>
                    <Input
                      value={form.company_city_at_meeting}
                      onChange={(e) => setForm((p) => ({ ...p, company_city_at_meeting: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">State</Label>
                      <Input
                        value={form.company_state_at_meeting}
                        onChange={(e) => setForm((p) => ({ ...p, company_state_at_meeting: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Zip</Label>
                      <Input
                        value={form.company_zip_at_meeting}
                        onChange={(e) => setForm((p) => ({ ...p, company_zip_at_meeting: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMeeting.isPending}>
                {createMeeting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Meeting
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Meeting List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : meetings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <h3 className="font-display text-lg font-semibold">No meetings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first meeting to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card
              key={m.id}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
              onClick={() => navigate(`/company/${companyId}/meetings/${m.id}`)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={meetingTypeColor(m.meeting_type)}>
                      {m.meeting_type}
                    </Badge>
                    {m.sub_type && (
                      <span className="text-xs text-muted-foreground">· {m.sub_type}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(m.meeting_date + "T00:00:00").toLocaleDateString()}
                    </span>
                    {m.meeting_location && (
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {m.meeting_location}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/60 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMeeting.mutate(m.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
