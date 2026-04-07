import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdminDeleteButtonProps {
  transaction: any;
  companyId: string;
}

export default function AdminDeleteButton({ transaction, companyId }: AdminDeleteButtonProps) {
  const { isAdmin } = useUserRole();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  if (!isAdmin) return null;

  const createdAt = new Date(transaction.created_at);
  const isWithin24h = (Date.now() - createdAt.getTime()) < 24 * 60 * 60 * 1000;

  const { data: hasDependents = true } = useQuery({
    queryKey: ["tx-dependents", transaction.id],
    queryFn: async () => {
      const { data: deps } = await supabase
        .from("share_transactions")
        .select("id")
        .eq("company_id", companyId)
        .or(`corrects_id.eq.${transaction.id},transferred_certificate_id.eq.${transaction.id}`)
        .limit(1);

      return (deps?.length || 0) > 0;
    },
    enabled: !!transaction.id,
  });

  const canDelete = isWithin24h && !hasDependents && (transaction.status === "active" || !transaction.status);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("share_transactions")
        .delete()
        .eq("id", transaction.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-authorized-shares", companyId] });
      toast.success("Transaction permanently deleted.");
      setConfirmOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClick = () => {
    if (!canDelete) {
      const reasons: string[] = [];
      if (!isWithin24h) reasons.push("This transaction is older than 24 hours.");
      if (hasDependents) reasons.push("Other transactions reference this entry.");
      toast.error(
        `Cannot delete: ${reasons.join(" ")} Use the Correct flow instead.`
      );
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        title={canDelete ? "Delete transaction (admin)" : "Deletion unavailable — use Correct flow"}
        onClick={handleClick}
      >
        <Trash2 className={`h-3 w-3 ${canDelete ? "text-destructive" : "text-muted-foreground/40"}`} />
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this entry from the ledger. This action cannot be undone and will affect all balance calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting…</> : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
