import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardCheck,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Building2,
  AlertTriangle,
  Flag,
} from "lucide-react";
import { toast } from "sonner";

type Submission = {
  id: string;
  company_id: string;
  link_id: string;
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
  change_flags: Record<string, { flagged: boolean; note: string }>;
  new_entries: Record<string, any[]>;
  pre_populated_snapshot: any;
  created_at: string;
};

type ReviewLink = {
  id: string;
  company_id: string;
  review_year: number;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
};

const SECTION_LABELS: Record<string, string> = {
  vehicles: "Vehicle Purchases",
  equipment: "Equipment Purchases",
  loans: "New Loans",
  shares: "Share/Membership Transactions",
  leases: "New Lease Agreements",
  benefits: "Employee Benefits",
  investments: "Investment Transactions",
  charitable: "Charitable Contributions",
  meeting: "Annual Meeting",
  excess_earnings: "Anticipated Excess Earnings",
  other_notes: "Other Notes",
};

export default function PendingReviews() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Fetch all submissions
  const { data: submissions = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["annual_review_submissions"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annual_review_submissions")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Submission[];
    },
  });

  // Fetch all review links for metadata
  const { data: links = [] } = useQuery({
    queryKey: ["annual_review_links_all"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annual_review_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ReviewLink[];
    },
  });

  // Fetch companies for name resolution
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, entity_type")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const companyName = (companyId: string) =>
    companies.find((c) => c.id === companyId)?.name || "Unknown";

  const linkMeta = (linkId: string) => links.find((l) => l.id === linkId);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("annual_review_submissions")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          notes: reviewNotes || null,
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["annual_review_submissions"] });
      toast.success(`Review ${status === "approved" ? "approved" : "rejected"}.`);
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: () => toast.error("Failed to update review status."),
  });

  const statusBadge = (status: string) => {
    if (status === "approved")
      return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
    if (status === "rejected")
      return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
    if (status === "pending_review")
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Review</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const safeObj = (val: any): Record<string, any> => {
    if (!val) return {};
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return {}; }
    }
    if (typeof val === "object" && !Array.isArray(val)) return val;
    return {};
  };

  const safeArr = (val: any): any[] => {
    if (Array.isArray(val)) return val;
    return [];
  };

  const flaggedCount = (flags: any) =>
    Object.values(safeObj(flags)).filter((f: any) => f?.flagged).length;

  const newEntryCount = (entries: any) =>
    Object.values(safeObj(entries)).reduce((sum: number, arr: any) => sum + (safeArr(arr).length), 0);

  const openReview = (sub: Submission) => {
    setSelectedSubmission(sub);
    setReviewNotes(sub.notes || "");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          EntityIQ — Pending Reviews
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Review and approve client-submitted annual review worksheets.
        </p>
      </div>

      {/* Outstanding Links (not yet submitted) */}
      {(() => {
        const submittedLinkIds = new Set(submissions.map((s) => s.link_id));
        const pendingLinks = links.filter(
          (l) => l.status === "pending" && !submittedLinkIds.has(l.id)
        );
        if (pendingLinks.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Outstanding Links ({pendingLinks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Year</TableHead>
                    <TableHead className="text-xs">Generated</TableHead>
                    <TableHead className="text-xs">Expires</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {companyName(link.company_id)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{link.review_year}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(link.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(link.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                          Awaiting Client
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })()}

      {/* Submissions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Submitted Reviews ({submissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSubs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No reviews submitted yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Generate an EntityIQ link from the dashboard and send it to your client.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs">Entity</TableHead>
                  <TableHead className="text-xs">Year</TableHead>
                  <TableHead className="text-xs">Submitted</TableHead>
                  <TableHead className="text-xs">Changes Flagged</TableHead>
                  <TableHead className="text-xs">New Entries</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub) => {
                  const meta = linkMeta(sub.link_id);
                  return (
                    <TableRow key={sub.id} className="group">
                      <TableCell className="text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {companyName(sub.company_id)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {meta?.review_year || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {sub.submitted_at
                          ? new Date(sub.submitted_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {flaggedCount(sub.change_flags) > 0 ? (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                            <Flag className="h-3 w-3 mr-1" />
                            {flaggedCount(sub.change_flags)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {newEntryCount(sub.new_entries) > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            {newEntryCount(sub.new_entries)} items
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(sub.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openReview(sub)}
                          className="h-7 px-2"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Detail Dialog */}
      <Dialog
        open={!!selectedSubmission}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSubmission(null);
            setReviewNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Review Submission — {selectedSubmission && companyName(selectedSubmission.company_id)}
            </DialogTitle>
          </DialogHeader>

          {selectedSubmission && (
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              {/* Flagged Changes */}
              {flaggedCount(selectedSubmission.change_flags) > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Changes Flagged by Client ({flaggedCount(selectedSubmission.change_flags)})
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedSubmission.change_flags)
                      .filter(([, v]) => v.flagged)
                      .map(([key, val]) => (
                        <div
                          key={key}
                          className="rounded-md border border-amber-200 bg-amber-50 p-3"
                        >
                          <p className="text-xs font-semibold text-amber-800 mb-1">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-amber-900">{val.note || "No details provided"}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* New Entries */}
              {Object.entries(safeObj(selectedSubmission.new_entries)).map(([section, rawEntries]) => {
                const entries = safeArr(rawEntries);
                if (entries.length === 0) return null;
                return (
                  <div key={section} className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      {SECTION_LABELS[section] || section}
                    </h3>
                    {entries.map((entry: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-md border border-border bg-muted/50 p-3"
                      >
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {Object.entries(safeObj(entry)).map(([k, v]) => {
                            if (v === null || v === undefined || v === "") return null;
                            return (
                              <div key={k}>
                                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  {k.replace(/_/g, " ")}
                                </span>
                                <p className="text-sm">
                                  {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {flaggedCount(selectedSubmission.change_flags) === 0 &&
                newEntryCount(selectedSubmission.new_entries) === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Client submitted with no changes or new entries.
                  </div>
                )}

              {/* Review Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Review Notes</label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add internal notes about this review..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              {selectedSubmission.status === "pending_review" && (
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      updateStatus.mutate({
                        id: selectedSubmission.id,
                        status: "approved",
                      })
                    }
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      updateStatus.mutate({
                        id: selectedSubmission.id,
                        status: "rejected",
                      })
                    }
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}

              {selectedSubmission.status !== "pending_review" && (
                <div className="rounded-md border border-border bg-muted p-3 text-sm text-center">
                  This review was <strong>{selectedSubmission.status}</strong>
                  {selectedSubmission.reviewed_at &&
                    ` on ${new Date(selectedSubmission.reviewed_at).toLocaleDateString()}`}
                  .
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
