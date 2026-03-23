import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardCheck, Eye, CheckCircle2, XCircle, Loader2, Calendar, Building2,
  AlertTriangle, Flag, Copy, Check, Trash2, Clock, ExternalLink, Send,
  MoreHorizontal,
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
  const { isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedLink, setSelectedLink] = useState<ReviewLink | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "link" | "submission"; id: string; name: string } | null>(null);

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

  // Fetch companies for name resolution + contact email
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, entity_type, contact_email, salutation_name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const companyName = (companyId: string) =>
    companies.find((c) => c.id === companyId)?.name || "Unknown";

  const companyData = (companyId: string) =>
    companies.find((c) => c.id === companyId);

  const linkMeta = (linkId: string) => links.find((l) => l.id === linkId);

  const buildUrl = (token: string) => `${window.location.origin}/annual-review/${token}`;

  // --- Mutations ---

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

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("annual_review_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["annual_review_links_all"] });
      toast.success("Link deleted.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete link."),
  });

  const deleteSubmission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("annual_review_submissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["annual_review_submissions"] });
      toast.success("Submission deleted.");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete submission."),
  });

  const extendExpiry = useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const link = links.find((l) => l.id === id);
      if (!link) throw new Error("Link not found");
      const current = new Date(link.expires_at);
      current.setDate(current.getDate() + days);
      const { error } = await supabase
        .from("annual_review_links")
        .update({ expires_at: current.toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { days }) => {
      qc.invalidateQueries({ queryKey: ["annual_review_links_all"] });
      toast.success(`Expiration extended by ${days} days.`);
    },
    onError: () => toast.error("Failed to extend expiration."),
  });

  // --- Helpers ---

  const safeObj = (val: any): Record<string, any> => {
    if (!val) return {};
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return {}; }
    }
    if (typeof val === "object" && !Array.isArray(val)) return val;
    return {};
  };

  const safeArr = (val: any): any[] => Array.isArray(val) ? val : [];

  const flaggedCount = (flags: any) =>
    Object.values(safeObj(flags)).filter((f: any) => f?.flagged).length;

  const newEntryCount = (entries: any) =>
    Object.values(safeObj(entries)).reduce((sum: number, arr: any) => sum + (safeArr(arr).length), 0);

  const statusBadge = (status: string) => {
    if (status === "approved")
      return <Badge className="bg-green-100 text-green-700 border-green-200">Approved</Badge>;
    if (status === "rejected")
      return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
    if (status === "pending_review")
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Review</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const openReview = (sub: Submission) => {
    setSelectedSubmission(sub);
    setReviewNotes(sub.notes || "");
  };

  // Compute outstanding links
  const submittedLinkIds = new Set(submissions.map((s) => s.link_id));
  const pendingLinks = links.filter(
    (l) => l.status === "pending" && !submittedLinkIds.has(l.id)
  );

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

      {/* Outstanding Links */}
      {pendingLinks.length > 0 && (
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
                  <TableHead className="text-xs w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLinks.map((link) => {
                  const url = buildUrl(link.token);
                  const isCopied = copiedId === `link-${link.id}`;
                  const isExpired = new Date(link.expires_at) < new Date();
                  return (
                    <TableRow
                      key={link.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedLink(link)}
                    >
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
                      <TableCell className={`text-xs ${isExpired ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                        {new Date(link.expires_at).toLocaleDateString()}
                        {isExpired && <span className="ml-1 text-[10px]">(expired)</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${isExpired ? "bg-red-50 text-red-600 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200"}`}>
                          {isExpired ? "Expired" : "Awaiting Client"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => handleCopy(url, `link-${link.id}`)}
                            title="Copy link"
                          >
                            {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 px-2">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => extendExpiry.mutate({ id: link.id, days: 30 })}>
                                <Clock className="mr-2 h-3.5 w-3.5" /> Extend 30 days
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => extendExpiry.mutate({ id: link.id, days: 60 })}>
                                <Clock className="mr-2 h-3.5 w-3.5" /> Extend 60 days
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => extendExpiry.mutate({ id: link.id, days: 90 })}>
                                <Clock className="mr-2 h-3.5 w-3.5" /> Extend 90 days
                              </DropdownMenuItem>
                              {isAdmin && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setDeleteTarget({ type: "link", id: link.id, name: companyName(link.company_id) })}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  <TableHead className="text-xs w-24">Actions</TableHead>
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
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openReview(sub)}
                            className="h-7 px-2"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget({ type: "submission", id: sub.id, name: companyName(sub.company_id) })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Link Detail Dialog */}
      <Dialog open={!!selectedLink} onOpenChange={(open) => { if (!open) setSelectedLink(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Review Link Details
            </DialogTitle>
          </DialogHeader>
          {selectedLink && (() => {
            const url = buildUrl(selectedLink.token);
            const company = companyData(selectedLink.company_id);
            const isExpired = new Date(selectedLink.expires_at) < new Date();
            const isCopied = copiedId === `detail-${selectedLink.id}`;
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Entity</span>
                    <p className="text-sm font-medium">{company?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Review Year</span>
                    <p className="text-sm font-medium">{selectedLink.review_year}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Generated</span>
                    <p className="text-sm">{new Date(selectedLink.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Expires</span>
                    <p className={`text-sm ${isExpired ? "text-destructive font-medium" : ""}`}>
                      {new Date(selectedLink.expires_at).toLocaleDateString()}
                      {isExpired && " (expired)"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Secure URL</span>
                  <div className="flex gap-2">
                    <Input readOnly value={url} className="h-7 text-xs font-mono" />
                    <Button size="sm" variant="outline" onClick={() => handleCopy(url, `detail-${selectedLink.id}`)}>
                      {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => window.open(url, "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleCopy(url, `detail-${selectedLink.id}`)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {isCopied ? "Copied!" : "Copy Link"}
                  </Button>
                </div>

                {company?.contact_email && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const subject = encodeURIComponent(`Action Required: ${selectedLink.review_year} Annual Review — ${company.name}`);
                      const salutation = company.salutation_name || "there";
                      const body = encodeURIComponent(
                        `Hi ${salutation},\n\nPlease complete your ${selectedLink.review_year} annual review for ${company.name} using the secure link below:\n\n${url}\n\nThis link will expire on ${new Date(selectedLink.expires_at).toLocaleDateString()}.\n\nThank you!`
                      );
                      window.open(`mailto:${company.contact_email}?subject=${subject}&body=${body}`, "_blank");
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Send Reminder to {company.contact_email}
                  </Button>
                )}

                {/* Extend Expiration */}
                <div className="flex gap-2">
                  {[30, 60, 90].map((days) => (
                    <Button
                      key={days}
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        extendExpiry.mutate({ id: selectedLink.id, days });
                        // Update local state to reflect change
                        const updated = { ...selectedLink };
                        const d = new Date(updated.expires_at);
                        d.setDate(d.getDate() + days);
                        updated.expires_at = d.toISOString();
                        setSelectedLink(updated);
                      }}
                      disabled={extendExpiry.isPending}
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      +{days} days
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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
                    {Object.entries(safeObj(selectedSubmission.change_flags))
                      .filter(([, v]: [string, any]) => v?.flagged)
                      .map(([key, val]: [string, any]) => (
                        <div key={key} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-semibold text-amber-800 mb-1">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </p>
                          <p className="text-sm text-amber-900">{val?.note || "No details provided"}</p>
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
                      <div key={i} className="rounded-md border border-border bg-muted/50 p-3">
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
                    onClick={() => updateStatus.mutate({ id: selectedSubmission.id, status: "approved" })}
                    disabled={updateStatus.isPending}
                    className="flex-1"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus.mutate({ id: selectedSubmission.id, status: "rejected" })}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "submission"
                ? `This will permanently delete the submitted review for "${deleteTarget?.name}". Client-submitted data cannot be recovered.`
                : `This will permanently delete the review link for "${deleteTarget?.name}". The client will no longer be able to access it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "link") {
                  deleteLink.mutate(deleteTarget.id);
                } else {
                  deleteSubmission.mutate(deleteTarget.id);
                }
              }}
            >
              {(deleteLink.isPending || deleteSubmission.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
