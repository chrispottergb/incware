import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CorrectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  companyId: string;
  entryNum?: number;
}

export default function CorrectionModal({
  open,
  onOpenChange,
  transaction,
  companyId,
  entryNum,
}: CorrectionModalProps) {
  const [memo, setMemo] = useState("");
  const queryClient = useQueryClient();

  const correction = useMutation({
    mutationFn: async () => {
      if (!memo.trim()) throw new Error("A correction memo is required.");
      const t = transaction;
      const today = new Date().toISOString().split("T")[0];

      // Insert the reversing correction entry
      const { data: newRow, error: insertErr } = await supabase
        .from("share_transactions")
        .insert({
          company_id: companyId,
          transaction_type: "correction",
          shareholder_id: t.shareholder_id || null,
          share_class: t.share_class,
          num_shares: t.num_shares || 0,
          price_per_share: t.price_per_share || null,
          total_consideration: t.total_consideration || null,
          consideration_type: t.consideration_type || null,
          transaction_date: today,
          from_shareholder: t.to_shareholder || t.shareholders?.name || null,
          to_shareholder: t.from_shareholder || null,
          notes: `Correction of entry #${entryNum || "?"} dated ${t.transaction_date || "N/A"}. ${memo.trim()}`,
          par_value: (t as any).par_value || null,
          corrects_id: t.id,
          correction_memo: memo.trim(),
          status: "active",
        } as any)
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // Update the original transaction
      const { error: updateErr } = await supabase
        .from("share_transactions")
        .update({
          status: "corrected",
          corrected_by_id: newRow.id,
        } as any)
        .eq("id", t.id);

      if (updateErr) throw updateErr;

      // Insert amended resolution into document registry
      await supabase.from("document_registry").insert({
        company_id: companyId,
        document_type: "Amended Resolution",
        document_category: "Resolution",
        title: `Amended Resolution — Correction of Entry #${entryNum || "?"}`,
        description: `Original entry #${entryNum || "?"} has been corrected. Reason: ${memo.trim()}`,
        status: "final",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-authorized-shares", companyId] });
      toast.success("Transaction corrected. Reversing entry and amended resolution created.");
      setMemo("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!transaction) return null;

  const t = transaction;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setMemo(""); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Correct Transaction #{entryNum || "?"}
          </DialogTitle>
          <DialogDescription>
            This will create a reversing entry and mark the original as corrected. The original entry remains in the permanent ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Read-only summary */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Date</span>
              <span className="text-xs font-medium">
                {t.transaction_date ? new Date(t.transaction_date + "T00:00:00").toLocaleDateString() : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {t.transaction_type?.replace(/_/g, " ")}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Shareholder</span>
              <span className="text-xs font-medium">{t.shareholders?.name || t.to_shareholder || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Shares/Units</span>
              <span className="text-xs font-medium">{t.num_shares?.toLocaleString() || "—"}</span>
            </div>
            {t.total_consideration != null && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Consideration</span>
                <span className="text-xs font-medium">${Number(t.total_consideration).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Mandatory memo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Correction Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Explain why this transaction is being corrected..."
              className="min-h-[80px] text-sm"
              required
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={correction.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => correction.mutate()}
            disabled={correction.isPending || !memo.trim()}
          >
            {correction.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            Create Correction Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
