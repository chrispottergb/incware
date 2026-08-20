import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onPurged: () => void;
}

/**
 * Purges a company flagged as test data plus every record that hangs off it.
 *
 * Safety: the flag is re-read from the database immediately before the delete
 * runs, so a stale UI (or a hand-crafted call) can never purge a live company.
 * There is no override.
 */
export default function TestCompanyPurgeDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onPurged,
}: Props) {
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);

  const nameMatches = typedName.trim() === companyName.trim();

  const handlePurge = async () => {
    if (!nameMatches || busy) return;
    setBusy(true);
    try {
      // Re-read the flag: refuse on anything that is not a test company.
      const { data: fresh, error: readErr } = await supabase
        .from("companies")
        .select("id, is_test")
        .eq("id", companyId)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!fresh || (fresh as any).is_test !== true) {
        toast.error("This company is not marked as a test company. Purge refused.");
        return;
      }

      // These two FKs are ON DELETE SET NULL, so the rows would survive the
      // cascade as orphans. Remove them explicitly first.
      await supabase.from("user_address_book" as any).delete().eq("company_id", companyId);
      await supabase.from("tax_return_jobs" as any).delete().eq("company_id", companyId);

      const { error } = await supabase.from("companies").delete().eq("id", companyId);
      if (error) throw error;

      toast.success("Test company and all of its records were permanently deleted.");
      onOpenChange(false);
      onPurged();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete the test company. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTypedName("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent className="min-w-[600px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete test company "{companyName}" and all its records?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                This permanently removes the entity and everything filed under it — meetings and
                their minutes, financials, resolutions, members and shareholders, stock
                certificates and transactions, ownership snapshots, assets and leases, banking,
                counsel, documents, compliance records and address-book entries.
              </p>
              <p className="text-destructive font-medium">This cannot be undone.</p>
              <div className="space-y-1.5">
                <Label htmlFor="purge-confirm-name" className="text-xs">
                  Type the company name to confirm
                </Label>
                <Input
                  id="purge-confirm-name"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={companyName}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={!nameMatches || busy} onClick={handlePurge}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete test company
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
