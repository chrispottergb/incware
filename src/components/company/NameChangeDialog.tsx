import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Info } from "lucide-react";
import { getTerminology } from "@/lib/entity-terminology";
import {
  NAME_CHANGE_REASONS_ENTITY,
  NAME_CHANGE_REASONS_INDIVIDUAL,
  normalizeOwnerName,
} from "@/lib/owner-aliases";

export interface NameChangeOwner {
  id: string;
  name: string;
  owner_kind?: string | null;
  representative_name?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  entityType?: string;
  owner: NameChangeOwner | null;
  /** Called when the user says this is a different legal owner (routes to a transfer). */
  onSuccessorHolder?: (owner: NameChangeOwner) => void;
}

type Fork = "rename" | "successor";

export default function NameChangeDialog({
  open, onOpenChange, companyId, entityType, owner, onSuccessorHolder,
}: Props) {
  const queryClient = useQueryClient();
  const t = getTerminology(entityType);
  const isEntityOwner = owner?.owner_kind === "entity";

  const [fork, setFork] = useState<Fork>("rename");
  const [newName, setNewName] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [trusteeName, setTrusteeName] = useState("");

  useEffect(() => {
    if (open) {
      setFork("rename");
      setNewName("");
      setEffectiveDate(new Date().toISOString().split("T")[0]);
      setReason("");
      setNote("");
      setTrusteeName(owner?.representative_name ?? "");
    }
  }, [open, owner?.id, owner?.representative_name]);

  const reasons = isEntityOwner ? NAME_CHANGE_REASONS_ENTITY : NAME_CHANGE_REASONS_INDIVIDUAL;

  const examples = useMemo(() => (
    isEntityOwner
      ? "For example: a trust was restated or amended, a successor trustee took over on the grantor's death without changing the trust itself, or a company changed its legal name."
      : "For example: a name change following marriage or divorce, or a court-ordered name change."
  ), [isEntityOwner]);

  const trimmedNew = newName.trim();
  const sameAsCurrent = !!owner && normalizeOwnerName(trimmedNew) === normalizeOwnerName(owner.name);
  const canSave = !!owner && trimmedNew.length > 0 && !sameAsCurrent && !!effectiveDate;

  const save = useMutation({
    mutationFn: async () => {
      if (!owner) throw new Error("No owner selected");
      const { data: userRes } = await supabase.auth.getUser();

      const { error: historyError } = await supabase
        .from("shareholder_name_history" as any)
        .insert({
          shareholder_id: owner.id,
          company_id: companyId,
          previous_name: owner.name,
          new_name: trimmedNew,
          effective_date: effectiveDate || null,
          reason: reason || null,
          note: note.trim() || null,
          created_by: userRes?.user?.id ?? null,
        } as any);
      if (historyError) throw historyError;

      const updates: Record<string, unknown> = { name: trimmedNew };
      if (isEntityOwner && trusteeName.trim() !== (owner.representative_name ?? "")) {
        updates.representative_name = trusteeName.trim() || null;
      }

      const { error: updateError } = await supabase
        .from("shareholders")
        .update(updates as any)
        .eq("id", owner.id);
      if (updateError) throw updateError;

      // Ownership percentages are alias-aware server-side; refresh them.
      await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });

      try {
        await supabase.from("timeline_events").insert({
          company_id: companyId,
          event_type: "owner_name_change",
          event_date: effectiveDate || new Date().toISOString().split("T")[0],
          title: `${t.shareholder} name change`,
          description: `${owner.name} renamed to ${trimmedNew}${reason ? ` (${reason.replace(/_/g, " ")})` : ""}. Same ${t.shareholder.toLowerCase()} record — no transfer of interest.`,
        } as any);
      } catch {
        // Timeline is informational; never block the rename on it.
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shareholder_name_history", companyId] }),
        queryClient.refetchQueries({ queryKey: ["shareholders", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["timeline_events", companyId] }),
      ]);
      toast.success("Name change recorded. Holdings and history are unchanged.");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[600px] max-w-[640px] max-h-[90vh] overflow-y-auto bg-background/95">
        <DialogHeader>
          <DialogTitle>Record a name change</DialogTitle>
          <DialogDescription>
            {owner ? `Current name: ${owner.name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-3">
            <Label>Is this the same owner under a new name, or a different legal owner taking over the interest?</Label>
            <RadioGroup value={fork} onValueChange={(v) => setFork(v as Fork)} className="space-y-3">
              <div className="flex gap-3 rounded-md border p-3">
                <RadioGroupItem value="rename" id="fork-rename" className="mt-1" />
                <Label htmlFor="fork-rename" className="font-normal cursor-pointer">
                  <span className="font-medium">Same owner, new legal name</span>
                  <span className="block text-sm text-muted-foreground mt-1">{examples}</span>
                  <span className="block text-sm text-muted-foreground mt-1">
                    One continuous record is kept — holdings, certificates and history stay attached.
                  </span>
                </Label>
              </div>
              <div className="flex gap-3 rounded-md border p-3">
                <RadioGroupItem value="successor" id="fork-successor" className="mt-1" />
                <Label htmlFor="fork-successor" className="font-normal cursor-pointer">
                  <span className="font-medium">Different legal owner</span>
                  <span className="block text-sm text-muted-foreground mt-1">
                    The interest passed to a different legal holder — for example a revocable trust that became
                    irrevocable and is treated as a new taxpayer, a split into survivor's/bypass sub-trusts, or an
                    interest passing to an estate or heir. This is recorded as a transfer to a new owner record.
                  </span>
                </Label>
              </div>
            </RadioGroup>

            <p className="flex gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                The app records this determination — it does not make it. Whether an event is a name change or a
                change of legal holder is the client's attorney's or accountant's call.
              </span>
            </p>
          </div>

          {fork === "rename" ? (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="nc-new-name">New legal name *</Label>
                <Input
                  id="nc-new-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter the new legal name..."
                />
                {sameAsCurrent && trimmedNew.length > 0 && (
                  <p className="text-xs text-destructive">The new name matches the current name.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nc-date">Effective date *</Label>
                  <Input
                    id="nc-date"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger>
                    <SelectContent className="bg-background/95 z-[100]">
                      {reasons.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isEntityOwner && (
                <div className="space-y-2">
                  <Label htmlFor="nc-trustee">Trustee / representative (optional)</Label>
                  <Input
                    id="nc-trustee"
                    value={trusteeName}
                    onChange={(e) => setTrusteeName(e.target.value)}
                    placeholder="Update if a successor trustee is now acting..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="nc-note">Note (optional)</Label>
                <Textarea
                  id="nc-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Context for the record book..."
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Existing {t.certificates.toLowerCase()} keep the name they were issued in and are not rewritten. They
                stay attached to this record, and lists show the current name alongside the issued name. Issue a
                replacement {t.certificate.toLowerCase()} from the {t.certificates} tab if the paper should match.
              </p>
            </div>
          ) : (
            <div className="space-y-3 border-t pt-4 text-sm text-muted-foreground">
              <p>
                This will open the transfer flow with {owner?.name} as the outgoing {t.shareholder.toLowerCase()} so
                the interest can be recorded as passing to a new owner record. The predecessor stays on file with its
                full history.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {fork === "rename" ? (
            <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record name change
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (owner) onSuccessorHolder?.(owner);
                onOpenChange(false);
              }}
            >
              Continue to transfer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
