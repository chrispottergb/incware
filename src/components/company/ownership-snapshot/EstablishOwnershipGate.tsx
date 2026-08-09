import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EstablishOwnershipDialog from "@/components/company/EstablishOwnershipDialog";
import OwnershipSnapshotWizard from "@/components/company/ownership-snapshot/OwnershipSnapshotWizard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, Clipboard } from "lucide-react";

interface Props {
  companyId: string;
  entityType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Chooses between the legacy "Establish Current Ownership" dialog and the new
 * guided Opening Ownership Snapshot, per entity.
 *
 * Phase 1 ships behind `companies.ownership_snapshot_enabled` (default false) so
 * entities already onboarded through the legacy path keep their exact existing
 * behaviour until someone deliberately opts them in.
 */
export default function EstablishOwnershipGate({ companyId, entityType, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [chooserOpen, setChooserOpen] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company-snapshot-flag", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("ownership_snapshot_enabled, opening_balance_date")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId,
  });

  const enable = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({ ownership_snapshot_enabled: true } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-snapshot-flag", companyId] });
      setChooserOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Could not switch to the guided snapshot"),
  });

  const enabled = !!company?.ownership_snapshot_enabled;
  const alreadyEstablished = !!company?.opening_balance_date;

  if (isLoading) return null;

  if (enabled) {
    return (
      <OwnershipSnapshotWizard
        companyId={companyId}
        entityType={entityType}
        open={open}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <>
      <EstablishOwnershipDialog
        companyId={companyId}
        entityType={entityType}
        open={open}
        onOpenChange={onOpenChange}
        onUseSnapshotWizard={alreadyEstablished ? undefined : () => setChooserOpen(true)}
      />

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="min-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-display text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Switch to the guided snapshot?
            </DialogTitle>
            <DialogDescription className="text-xs">
              The guided Opening Ownership Snapshot reconciles what you enter against the client's declared
              total, keeps each certificate's original date and how it was acquired, archives surrendered
              certificates, and then locks the result as a permanent, auditable record.
            </DialogDescription>
          </DialogHeader>
          <p className="text-[11px] text-muted-foreground">
            It writes the same opening-balance ledger entries as the current form, so nothing downstream
            changes. This entity keeps the guided flow from now on.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setChooserOpen(false)}>
              <Clipboard className="mr-2 h-3 w-3" /> Keep the simple form
            </Button>
            <Button size="sm" onClick={() => enable.mutate()} disabled={enable.isPending}>
              {enable.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Use the guided snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
