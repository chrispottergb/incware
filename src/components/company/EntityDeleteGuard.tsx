import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface EntityDeleteGuardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onDelete: () => Promise<void>;
  deleting: boolean;
}

export default function EntityDeleteGuard({
  open,
  onOpenChange,
  companyId,
  companyName,
  onDelete,
  deleting,
}: EntityDeleteGuardProps) {
  const [typedName, setTypedName] = useState("");

  const { data: recordCounts } = useQuery({
    queryKey: ["entity-delete-guard", companyId],
    queryFn: async () => {
      const [txRes, certRes, docRes] = await Promise.all([
        supabase.from("share_transactions").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("stock_certificates").select("id", { count: "exact", head: true }).eq("company_id", companyId),
        supabase.from("document_registry").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      ]);
      return {
        transactions: txRes.count || 0,
        certificates: certRes.count || 0,
        documents: docRes.count || 0,
      };
    },
    enabled: open && !!companyId,
  });

  const hasRecords = recordCounts && (recordCounts.transactions > 0 || recordCounts.certificates > 0 || recordCounts.documents > 0);
  const nameMatches = typedName.trim() === companyName.trim();

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) setTypedName(""); onOpenChange(o); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {hasRecords && <AlertTriangle className="h-5 w-5 text-destructive" />}
            Delete "{companyName}"?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This will permanently delete this entity and all associated records including meetings, financials, shareholders, stock certificates, assets, and documents.
              </p>

              {hasRecords && recordCounts && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                  <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Warning: This entity has existing records
                  </p>
                  <ul className="text-xs text-destructive space-y-0.5 ml-5 list-disc">
                    {recordCounts.transactions > 0 && (
                      <li>{recordCounts.transactions} transaction{recordCounts.transactions !== 1 ? "s" : ""}</li>
                    )}
                    {recordCounts.certificates > 0 && (
                      <li>{recordCounts.certificates} certificate{recordCounts.certificates !== 1 ? "s" : ""}</li>
                    )}
                    {recordCounts.documents > 0 && (
                      <li>{recordCounts.documents} document{recordCounts.documents !== 1 ? "s" : ""}</li>
                    )}
                  </ul>
                  <p className="text-xs text-destructive font-medium">
                    All records will be permanently destroyed and cannot be recovered.
                  </p>
                </div>
              )}

              {hasRecords && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Type <span className="font-semibold text-foreground">"{companyName}"</span> to confirm
                  </Label>
                  <Input
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder={companyName}
                    className="text-sm"
                    autoFocus
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting} onClick={() => setTypedName("")}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onDelete(); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting || (hasRecords && !nameMatches)}
          >
            {deleting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting…</>
            ) : (
              "Yes, Delete Permanently"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
