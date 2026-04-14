import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Loader2, Plus, Trash2, Clipboard } from "lucide-react";
import { toast } from "sonner";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { Checkbox } from "@/components/ui/checkbox";

interface OwnerRow {
  name: string;
  share_class: string;
  num_shares: string;
  certificate_number: string;
}

interface Props {
  companyId: string;
  entityType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EstablishOwnershipDialog({ companyId, entityType = "Corporation", open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);

  const [balanceDate, setBalanceDate] = useState("");
  const [owners, setOwners] = useState<OwnerRow[]>([
    { name: "", share_class: "Common", num_shares: "", certificate_number: "" },
  ]);
  const [confirm, setConfirm] = useState(false);

  const { data: company } = useQuery({
    queryKey: ["company-establish", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("name, opening_balance_date, par_value, par_value_type").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  const hasExistingBalance = !!company?.opening_balance_date;

  const addRow = () => setOwners(p => [...p, { name: "", share_class: "Common", num_shares: "", certificate_number: "" }]);
  const removeRow = (i: number) => setOwners(p => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof OwnerRow, val: string) =>
    setOwners(p => p.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const save = useMutation({
    mutationFn: async () => {
      if (!balanceDate) throw new Error("Please select an opening balance date.");
      const validOwners = owners.filter(o => o.name.trim() && parseFloat(o.num_shares) > 0);
      if (validOwners.length === 0) throw new Error(`Add at least one ${term.shareholder.toLowerCase()}.`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Set opening_balance_date on company
      const { error: compErr } = await supabase.from("companies")
        .update({ opening_balance_date: balanceDate } as any)
        .eq("id", companyId);
      if (compErr) throw compErr;

      // 2. For each owner, create shareholder + certificate + transaction
      for (const owner of validOwners) {
        const numShares = parseFloat(owner.num_shares);
        const certNum = owner.certificate_number ? parseInt(owner.certificate_number) : null;

        // Create or find shareholder
        const { data: existingSh } = await supabase.from("shareholders")
          .select("id").eq("company_id", companyId).ilike("name", owner.name.trim()).maybeSingle();

        let shId: string;
        if (existingSh) {
          shId = existingSh.id;
          await supabase.from("shareholders").update({
            num_shares: numShares,
            share_class: owner.share_class,
          }).eq("id", shId);
        } else {
          const { data: newSh, error: shErr } = await supabase.from("shareholders").insert({
            company_id: companyId,
            name: owner.name.trim(),
            num_shares: numShares,
            share_class: owner.share_class,
          }).select("id").single();
          if (shErr) throw shErr;
          shId = newSh.id;
        }

        // Create certificate
        const certInsert: any = {
          company_id: companyId,
          shareholder_id: shId,
          share_class: owner.share_class,
          num_shares: numShares,
          status: "active",
          issue_date: balanceDate,
        };
        if (certNum) certInsert.certificate_number = certNum;
        const { data: cert, error: certErr } = await supabase.from("stock_certificates")
          .insert(certInsert).select("id, certificate_number").single();
        if (certErr) throw certErr;

        // Create opening_balance transaction
        const parValue = company?.par_value_type === "par" ? company.par_value : null;
        await supabase.from("share_transactions").insert({
          company_id: companyId,
          shareholder_id: shId,
          transaction_type: isLLC ? "membership_issuance" : "initial_issuance",
          entry_type: "opening_balance",
          share_class: owner.share_class,
          num_shares: numShares,
          transaction_date: balanceDate,
          effective_date: balanceDate,
          to_shareholder: owner.name.trim(),
          from_shareholder: "Pre-existing Ownership",
          certificate_id: cert.id,
          issued_certificate_number: cert.certificate_number,
          par_value: parValue,
          notes: `Opening balance established as of ${balanceDate}`,
        } as any);
      }

      // Invalidate all related queries
      await queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company-establish", companyId] });
    },
    onSuccess: () => {
      toast.success("Opening balances established successfully!");
      onOpenChange(false);
      setOwners([{ name: "", share_class: "Common", num_shares: "", certificate_number: "" }]);
      setBalanceDate("");
      setConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to establish ownership");
    },
  });

  const unitLabel = isLLC ? "Units" : "Shares";

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirm(false); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <Clipboard className="h-4 w-4" /> Establish Current Ownership
          </DialogTitle>
          <DialogDescription className="text-xs">
            Set ownership as of a specific date. This creates "Opening Balance" entries and locks the ledger from any earlier dates.
          </DialogDescription>
        </DialogHeader>

        {hasExistingBalance ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Opening balance already established</p>
            <p className="text-xs text-muted-foreground mt-1">
              This entity already has an opening balance date of{" "}
              <strong>{new Date(company!.opening_balance_date + "T00:00:00").toLocaleDateString()}</strong>.
              To modify ownership, use "Record Transaction" instead.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Opening Balance Date</Label>
              <DatePickerField
                value={balanceDate}
                onChange={setBalanceDate}
                placeholder="Select the date ownership is established as of"
              />
              <p className="text-[10px] text-muted-foreground">
                Typically the date of the first meeting you are creating. No transactions can be dated before this date.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Current {term.shareholders}</Label>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addRow}>
                  <Plus className="mr-1 h-3 w-3" /> Add {term.shareholder}
                </Button>
              </div>

              <div className="rounded-md border border-border">
                <div className="grid grid-cols-[1fr_100px_100px_80px_32px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
                  <span>Name</span>
                  <span>{isLLC ? "Class" : "Share Class"}</span>
                  <span>{unitLabel}</span>
                  <span>Cert #</span>
                  <span></span>
                </div>
                {owners.map((row, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_80px_32px] gap-2 px-3 py-1.5 border-b last:border-b-0 items-center">
                    <Input
                      className="h-7 text-xs"
                      placeholder={`${term.shareholder} name`}
                      value={row.name}
                      onChange={(e) => updateRow(i, "name", e.target.value)}
                    />
                    <Input
                      className="h-7 text-xs"
                      value={row.share_class}
                      onChange={(e) => updateRow(i, "share_class", e.target.value)}
                    />
                    <Input
                      className="h-7 text-xs"
                      type="number"
                      step="0.0001"
                      placeholder="0"
                      value={row.num_shares}
                      onChange={(e) => updateRow(i, "num_shares", e.target.value)}
                    />
                    <Input
                      className="h-7 text-xs"
                      type="number"
                      placeholder="Auto"
                      value={row.certificate_number}
                      onChange={(e) => updateRow(i, "certificate_number", e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => removeRow(i)}
                      disabled={owners.length === 1}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="confirm-ownership"
                checked={confirm}
                onCheckedChange={(v) => setConfirm(!!v)}
              />
              <label htmlFor="confirm-ownership" className="text-[11px] leading-relaxed cursor-pointer text-muted-foreground">
                I confirm this represents the current ownership state as of{" "}
                {balanceDate ? new Date(balanceDate + "T00:00:00").toLocaleDateString() : "the selected date"}.
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!hasExistingBalance && (
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !confirm || !balanceDate}
            >
              {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Establish Opening Balances
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}