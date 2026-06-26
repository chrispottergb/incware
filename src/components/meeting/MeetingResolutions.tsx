import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText, Pencil, Link2, ArrowRightLeft, Layers, Building2 } from "lucide-react";
import { toast } from "sonner";

import { RESOLUTION_TYPES } from "@/lib/resolution-types";
import { isLLCType } from "@/lib/entity-terminology";
import BuySellWorkflow from "@/components/company/BuySellWorkflow";
import BatchTransferDialog from "@/components/meeting/BatchTransferDialog";
import LeaseTransactionDialog from "@/components/meeting/LeaseTransactionDialog";

const TRANSFER_RESOLUTION_PURPOSES = [
  "Approve Transfer/Sale of Shares",
  "Approve Transfer of Membership Interest",
];

const LEASE_RESOLUTION_PURPOSE = "Approve Lease Agreement";

interface Props {
  meetingId: string;
  entityType: string;
  meetingType?: string;
  companyId?: string;
  companyName?: string;
  availableShares?: number | null;
  meetingDate?: string;
  excludeResolutionIds?: string[];
}

export default function MeetingResolutions({ meetingId, entityType, meetingType, companyId, companyName, availableShares, meetingDate, excludeResolutionIds }: Props) {
  const isSpecialMeeting = meetingType === "Special Meeting of Board of Directors";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [customPurpose, setCustomPurpose] = useState("");
  const [resolutionText, setResolutionText] = useState("");

  // Transfer workflow state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferResolutionId, setTransferResolutionId] = useState<string | null>(null);

  // Batch transfer state
  const [batchOpen, setBatchOpen] = useState(false);

  // Lease workflow state
  const [leaseOpen, setLeaseOpen] = useState(false);
  const [leaseResolutionId, setLeaseResolutionId] = useState<string | null>(null);

  const resolutionOptions = RESOLUTION_TYPES[entityType] || RESOLUTION_TYPES["Corporation"];

  const { data: resolutions = [] } = useQuery({
    queryKey: ["meeting_resolutions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addResolution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_resolutions").insert({
        meeting_id: meetingId,
        purpose,
        resolution_text: resolutionText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      closeDialog();
      toast.success("Resolution added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateResolution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_resolutions").update({
        purpose,
        resolution_text: resolutionText,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      closeDialog();
      toast.success("Resolution updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteResolution = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_resolutions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      toast.success("Resolution removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setPurpose("");
    setCustomPurpose("");
    setResolutionText("");
  };

  const openEdit = (r: any) => {
    const matchedOption = resolutionOptions.find((o) => o.label === r.purpose);
    if (matchedOption) {
      setPurpose(r.purpose || "");
      setCustomPurpose("");
    } else {
      setPurpose("Other");
      setCustomPurpose(r.purpose || "");
    }
    setEditingId(r.id);
    setResolutionText(r.resolution_text || "");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateResolution.mutate();
    } else {
      addResolution.mutate();
    }
  };

  const handlePurposeChange = (value: string) => {
    setPurpose(value);
    if (!editingId) {
      const selected = resolutionOptions.find((o) => o.label === value);
      if (selected?.template) {
        let text = selected.template;
        // Substitute [YEAR] with meeting date year or current year
        if (text.includes("[YEAR]")) {
          const year = meetingDate
            ? new Date(meetingDate).getFullYear().toString()
            : new Date().getFullYear().toString();
          text = text.replace(/\[YEAR\]/g, year);
        }
        setResolutionText(text);
      } else {
        // "Other" or any type without a template — clear for custom input
        setResolutionText("");
      }
    }
  };

  const handleOpenTransfer = (resolutionId: string) => {
    setTransferResolutionId(resolutionId);
    setTransferOpen(true);
  };

  const handleTransactionComplete = async (txnId: string) => {
    if (!transferResolutionId) return;
    // Link transaction to the resolution
    const { error } = await supabase
      .from("meeting_resolutions")
      .update({ transaction_id: txnId } as any)
      .eq("id", transferResolutionId);
    if (error) {
      console.error("Failed to link transaction to resolution:", error);
    } else {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      toast.success("Transaction linked to resolution.");
    }
    setTransferResolutionId(null);
  };

  // Lease workflow handlers
  const handleOpenLease = (resolutionId: string) => {
    setLeaseResolutionId(resolutionId);
    setLeaseOpen(true);
  };

  const handleLeaseCreated = async (leaseId: string, propertyAddress: string) => {
    if (!leaseResolutionId) return;
    // Link lease to the resolution
    const { error } = await supabase
      .from("meeting_resolutions")
      .update({ lease_id: leaseId } as any)
      .eq("id", leaseResolutionId);
    if (error) {
      console.error("Failed to link lease to resolution:", error);
    } else {
      // Update resolution text to fill in address
      if (propertyAddress) {
        const res = resolutions.find((r) => r.id === leaseResolutionId);
        if (res?.resolution_text?.includes("______")) {
          const updatedText = res.resolution_text.replace("______", propertyAddress);
          await supabase
            .from("meeting_resolutions")
            .update({ resolution_text: updatedText })
            .eq("id", leaseResolutionId);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      toast.success("Lease linked to resolution.");
    }
    setLeaseResolutionId(null);
  };

  const isLeasePurpose = (p: string) => p === LEASE_RESOLUTION_PURPOSE;

  const isTransferPurpose = (p: string) => TRANSFER_RESOLUTION_PURPOSES.includes(p);

  // Batch detection: unlinked transfer resolutions
  const displayedResolutions = useMemo(() => {
    if (!excludeResolutionIds || excludeResolutionIds.length === 0) return resolutions;
    return resolutions.filter((r) => !excludeResolutionIds.includes(r.id));
  }, [resolutions, excludeResolutionIds]);

  const unlinkedTransferResolutions = useMemo(() => {
    return displayedResolutions.filter(
      (r) => isTransferPurpose(r.purpose || "") && !(r as any).transaction_id
    );
  }, [displayedResolutions]);

  const batchResolutionIds = useMemo(
    () => unlinkedTransferResolutions.map((r) => r.id),
    [unlinkedTransferResolutions]
  );
  const showBatchButton = unlinkedTransferResolutions.length >= 2 && companyId;

  const isPending = addResolution.isPending || updateResolution.isPending;
  const selectedOption = resolutionOptions.find((o) => o.label === purpose);

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="font-display text-base">Resolutions</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Select a resolution type for this <span className="font-semibold">{entityType}</span> entity, or create a custom one
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setPurpose(""); setResolutionText(""); }}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="font-display">{editingId ? "Edit Resolution" : "Add Resolution"}</DialogTitle>
                <DialogDescription>
                  {editingId ? "Update" : "Select"} the type of resolution for this <span className="font-semibold">{entityType}</span> entity.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Resolution Type</Label>
                  <Select value={purpose} onValueChange={handlePurposeChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select resolution type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50 max-h-[300px]">
                      {resolutionOptions.map((opt) => (
                        <SelectItem key={opt.label} value={opt.label}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOption?.statute && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Ref: {selectedOption.statute}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Resolution</Label>
                  <Textarea
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    rows={8}
                    required
                    className="font-mono text-sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground italic">
                  If resolutions involve complex issues, it is advised to have your final documentation reviewed by your attorney or tax advisor.
                </p>
                <Button type="submit" className="w-full" disabled={isPending || !purpose}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingId ? "Save Changes" : "Add Resolution"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {displayedResolutions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No resolutions yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedResolutions.map((r) => {
                const match = resolutionOptions.find((o) => o.label === r.purpose);
                const hasLinkedTransaction = !!(r as any).transaction_id;
                const hasLinkedLease = !!(r as any).lease_id;
                const hasAnyLink = hasLinkedTransaction || hasLinkedLease;
                // Only show individual "Complete Transaction" if there's exactly 1 unlinked transfer resolution
                const showTransferButton = isTransferPurpose(r.purpose || "") && !hasLinkedTransaction && companyId && unlinkedTransferResolutions.length === 1;
                // Show lease button for unlinked lease resolutions
                const showLeaseButton = isLeasePurpose(r.purpose || "") && !hasLinkedLease && companyId;
                return (
                  <div key={r.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {isSpecialMeeting && (
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                            {r.purpose}
                          </p>
                        )}
                        {match?.statute && (
                          <p className="text-[10px] text-muted-foreground mb-2">{match.statute}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.resolution_text}</p>

                        {/* Linked transaction indicator */}
                        {hasLinkedTransaction && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-primary font-medium">
                            <Link2 className="h-3.5 w-3.5" />
                            Transaction Linked
                          </div>
                        )}

                        {/* Linked lease indicator */}
                        {hasLinkedLease && (
                          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-primary font-medium">
                            <Building2 className="h-3.5 w-3.5" />
                            Lease Recorded
                          </div>
                        )}

                        {/* Complete Transaction button for transfer resolutions */}
                        {showTransferButton && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={() => handleOpenTransfer(r.id)}
                          >
                            <ArrowRightLeft className="mr-1.5 h-3 w-3" />
                            Complete Transaction
                          </Button>
                        )}

                        {/* Complete Transaction button for lease resolutions */}
                        {showLeaseButton && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs"
                            onClick={() => handleOpenLease(r.id)}
                          >
                            <Building2 className="mr-1.5 h-3 w-3" />
                            Complete Transaction
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(r)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteResolution.mutate(r.id)}
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Batch transfer button */}
          {showBatchButton && (
            <div className="mt-4 pt-3 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setBatchOpen(true)}
              >
                <Layers className="mr-2 h-4 w-4" />
                Execute Batch Transfer ({unlinkedTransferResolutions.length} transfers)
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Process all {unlinkedTransferResolutions.length} unlinked transfer resolutions in a single atomic operation
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline BuySellWorkflow dialog for transfer resolutions */}
      {companyId && (
        <BuySellWorkflow
          companyId={companyId}
          companyName={companyName}
          entityType={entityType}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          availableShares={availableShares}
          meetingId={meetingId}
          onTransactionComplete={handleTransactionComplete}
        />
      )}

      {/* Batch transfer dialog */}
      {companyId && batchResolutionIds.length >= 2 && (
        <BatchTransferDialog
          companyId={companyId}
          companyName={companyName}
          entityType={entityType}
          meetingId={meetingId}
          resolutionIds={batchResolutionIds}
          open={batchOpen}
          onOpenChange={setBatchOpen}
        />
      )}

      {/* Lease transaction dialog */}
      {companyId && (
        <LeaseTransactionDialog
          companyId={companyId}
          companyName={companyName}
          entityType={entityType}
          meetingDate={meetingDate}
          open={leaseOpen}
          onOpenChange={setLeaseOpen}
          onLeaseCreated={handleLeaseCreated}
        />
      )}
    </>
  );
}
