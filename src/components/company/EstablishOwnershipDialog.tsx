import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Clipboard, CopyPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Each row is ONE certificate — an owner may appear on multiple rows.
 * `ownerKey` is either an existing shareholder id, or "new:<n>" referring to
 * an owner created inside this dialog session (resolved to a single insert on
 * save). Owner is never matched by name string, so typos or formatting
 * differences can never merge or duplicate owner records.
 */
interface CertRow {
  ownerKey: string;
  share_class: string;
  num_shares: string;
  certificate_number: string;
  issue_date: string;
  status: "active" | "cancelled";
  cancelled_date: string;
  notes: string;
}

interface NewOwner {
  key: string;
  name: string;
}

interface Props {
  companyId: string;
  entityType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NEW_OWNER_ACTION = "__new_owner__";

const emptyRow = (ownerKey = "", issue_date = ""): CertRow => ({
  ownerKey,
  share_class: "Common",
  num_shares: "",
  certificate_number: "",
  issue_date,
  status: "active",
  cancelled_date: "",
  notes: "",
});

export default function EstablishOwnershipDialog({ companyId, entityType = "Corporation", open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  // Certificate wording follows the same entity-type terminology helper used for
  // owner / unit / interest-type labels — never hardcode "Certificate" below.
  const certLabel = term.certificate;              // "Membership Unit Certificate" | "Stock Certificate"
  const certsLabel = term.certificates;            // plural form
  const certLower = certLabel.toLowerCase();
  const certsLower = certsLabel.toLowerCase();

  const [balanceDate, setBalanceDate] = useState("");
  const [rows, setRows] = useState<CertRow[]>([emptyRow()]);
  const [newOwners, setNewOwners] = useState<NewOwner[]>([]);
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

  // Existing owner records for this entity (owner picker source)
  const { data: existingOwners = [] } = useQuery({
    queryKey: ["shareholders-establish", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && open,
  });

  // Existing certificate numbers — uniqueness is scoped to THIS company only.
  const { data: existingCertNumbers = [] } = useQuery({
    queryKey: ["stock_certificates_numbers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates").select("certificate_number").eq("company_id", companyId);
      if (error) throw error;
      return (data || []).map((c: any) => Number(c.certificate_number));
    },
    enabled: !!companyId && open,
  });

  const hasExistingBalance = !!company?.opening_balance_date;

  const ownerLabel = (key: string) => {
    if (!key) return "";
    const existing = existingOwners.find((o) => o.id === key);
    if (existing) return existing.name;
    return newOwners.find((o) => o.key === key)?.name || "";
  };

  const addRow = () => setRows((p) => [...p, emptyRow("", balanceDate)]);
  const addCertForOwner = (ownerKey: string) =>
    setRows((p) => [...p, emptyRow(ownerKey, balanceDate)]);
  const removeRow = (i: number) => setRows((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<CertRow>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleOwnerSelect = (i: number, value: string) => {
    if (value === NEW_OWNER_ACTION) {
      const key = `new:${Date.now()}-${i}`;
      setNewOwners((p) => [...p, { key, name: "" }]);
      updateRow(i, { ownerKey: key });
    } else {
      updateRow(i, { ownerKey: value });
    }
  };

  const renameNewOwner = (key: string, name: string) =>
    setNewOwners((p) => p.map((o) => (o.key === key ? { ...o, name } : o)));

  // ---- Live totals -------------------------------------------------------
  const { perOwner, entityTotal } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    rows.forEach((r) => {
      if (r.status !== "active") return;
      const n = parseFloat(r.num_shares);
      if (!r.ownerKey || !(n > 0)) return;
      map.set(r.ownerKey, (map.get(r.ownerKey) || 0) + n);
      total += n;
    });
    return { perOwner: map, entityTotal: total };
  }, [rows]);

  // ---- Validation --------------------------------------------------------
  const validation = useMemo(() => {
    const errors: string[] = [];
    const dupCertRows = new Set<number>();
    const seen = new Map<number, number>();

    const usable = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.ownerKey && parseFloat(r.num_shares) > 0);

    usable.forEach(({ r, i }) => {
      const owner = ownerLabel(r.ownerKey).trim();
      if (!owner) errors.push(`Row ${i + 1}: enter a name for the new ${term.shareholder.toLowerCase()}.`);
      if (balanceDate && r.issue_date && r.issue_date > balanceDate) {
        errors.push(`Row ${i + 1}: issue date cannot be after the "as of" date.`);
      }
      if (r.status === "cancelled" && r.cancelled_date && r.issue_date && r.cancelled_date < r.issue_date) {
        errors.push(`Row ${i + 1}: cancellation date cannot be before the issue date.`);
      }
      if (r.certificate_number.trim()) {
        const num = parseInt(r.certificate_number, 10);
        if (Number.isNaN(num)) {
          errors.push(`Row ${i + 1}: certificate number must be a number.`);
        } else {
          if (existingCertNumbers.includes(num)) {
            errors.push(`Certificate #${num} already exists for this entity.`);
            dupCertRows.add(i);
          }
          if (seen.has(num)) {
            errors.push(`Certificate #${num} is entered more than once.`);
            dupCertRows.add(i);
            dupCertRows.add(seen.get(num)!);
          } else {
            seen.set(num, i);
          }
        }
      }
    });

    if (usable.length === 0) {
      errors.push(`Add at least one certificate.`);
    } else if (entityTotal <= 0) {
      errors.push(`At least one active certificate is required for the entity.`);
    }

    return { errors: Array.from(new Set(errors)), dupCertRows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, newOwners, existingOwners, existingCertNumbers, balanceDate, entityTotal]);

  const save = useMutation({
    mutationFn: async () => {
      if (!balanceDate) throw new Error("Please select an opening balance date.");
      if (validation.errors.length) throw new Error(validation.errors[0]);

      const usable = rows.filter((r) => r.ownerKey && parseFloat(r.num_shares) > 0);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 1. Set opening_balance_date ("as of" pickup date / back-dating lock)
      const { error: compErr } = await supabase.from("companies")
        .update({ opening_balance_date: balanceDate } as any)
        .eq("id", companyId);
      if (compErr) throw compErr;

      // 2. Resolve owner keys → shareholder ids (one insert per new owner)
      const ownerIdByKey = new Map<string, string>();
      const usedKeys = Array.from(new Set(usable.map((r) => r.ownerKey)));
      for (const key of usedKeys) {
        if (!key.startsWith("new:")) {
          ownerIdByKey.set(key, key);
          continue;
        }
        const name = (newOwners.find((o) => o.key === key)?.name || "").trim();
        const { data: newSh, error: shErr } = await supabase.from("shareholders").insert({
          company_id: companyId,
          name,
          num_shares: 0,
          share_class: usable.find((r) => r.ownerKey === key)?.share_class || "Common",
        }).select("id").single();
        if (shErr) throw shErr;
        ownerIdByKey.set(key, newSh.id);
      }

      // 3. Auto-assign certificate numbers for blank fields (per-entity scope)
      const taken = new Set<number>([
        ...existingCertNumbers,
        ...usable.map((r) => parseInt(r.certificate_number, 10)).filter((n) => !Number.isNaN(n)),
      ]);
      let nextCert = 1;
      const nextFree = () => {
        while (taken.has(nextCert)) nextCert++;
        taken.add(nextCert);
        return nextCert;
      };

      const parValue = company?.par_value_type === "par" ? company.par_value : null;
      const activeTotals = new Map<string, number>();

      // 4. Certificates + paired opening-balance ledger entries
      for (const row of usable) {
        const shId = ownerIdByKey.get(row.ownerKey)!;
        const ownerName = ownerLabel(row.ownerKey).trim();
        const numShares = parseFloat(row.num_shares);
        const issueDate = row.issue_date || balanceDate;
        const certNum = row.certificate_number.trim()
          ? parseInt(row.certificate_number, 10)
          : nextFree();
        const isCancelled = row.status === "cancelled";

        const certInsert: any = {
          company_id: companyId,
          shareholder_id: shId,
          share_class: row.share_class,
          num_shares: numShares,
          status: isCancelled ? "cancelled" : "active",
          issue_date: issueDate,
          certificate_number: certNum,
          par_value: parValue,
        };
        if (isCancelled) {
          certInsert.cancelled_date = row.cancelled_date || issueDate;
          certInsert.cancelled_reason = row.notes.trim() || "Historical certificate — cancelled prior to onboarding";
        }
        const { data: cert, error: certErr } = await supabase.from("stock_certificates")
          .insert(certInsert).select("id, certificate_number").single();
        if (certErr) throw certErr;

        // Cancelled certificates are history only — they do not contribute to
        // opening holdings, so no ledger transaction is written for them.
        if (isCancelled) continue;

        activeTotals.set(shId, (activeTotals.get(shId) || 0) + numShares);

        await supabase.from("share_transactions").insert({
          company_id: companyId,
          shareholder_id: shId,
          transaction_type: isLLC ? "membership_issuance" : "initial_issuance",
          entry_type: "opening_balance",
          share_class: row.share_class,
          num_shares: numShares,
          transaction_date: issueDate,
          effective_date: issueDate,
          to_shareholder: ownerName,
          from_shareholder: "Pre-existing Ownership",
          certificate_id: cert.id,
          issued_certificate_number: cert.certificate_number,
          par_value: parValue,
          notes: row.notes.trim()
            ? row.notes.trim()
            : `Opening balance established as of ${balanceDate} (certificate issued ${issueDate})`,
        } as any);
      }

      // 5. Sync owner share totals (divested owners land at 0)
      for (const key of usedKeys) {
        const shId = ownerIdByKey.get(key)!;
        await supabase.from("shareholders")
          .update({ num_shares: activeTotals.get(shId) || 0 })
          .eq("id", shId);
      }

      await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });

      await queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["shareholders-establish", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["stock_certificates_numbers", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company-establish", companyId] });
    },
    onSuccess: () => {
      toast.success("Opening balances established successfully!");
      onOpenChange(false);
      setRows([emptyRow()]);
      setNewOwners([]);
      setBalanceDate("");
      setConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to establish ownership");
    },
  });

  const unitLabel = isLLC ? "Units" : "Shares";
  const ownerOptions = [
    ...existingOwners.map((o) => ({ key: o.id, name: o.name })),
    ...newOwners.filter((o) => o.name.trim()).map((o) => ({ key: o.key, name: o.name })),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirm(false); } }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <Clipboard className="h-4 w-4" /> Establish Current Ownership
          </DialogTitle>
          <DialogDescription className="text-xs">
            Record ownership as of a pickup date. Each row is one certificate — an owner may hold several,
            each keeping its own original issue date.
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
            <div className="space-y-1.5 max-w-sm">
              <Label className="text-xs font-medium">Opening Balance ("As Of") Date</Label>
              <DatePickerField
                value={balanceDate}
                onChange={setBalanceDate}
                placeholder="Select the date ownership is established as of"
              />
              <p className="text-[10px] text-muted-foreground">
                The pickup date. Later transactions cannot be dated before it; individual certificates may
                still carry earlier, original issue dates.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Certificates</Label>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addRow}>
                  <Plus className="mr-1 h-3 w-3" /> Add Certificate
                </Button>
              </div>

              <div className="rounded-md border border-border">
                <div className="grid grid-cols-[minmax(180px,1.4fr)_90px_90px_70px_120px_100px_120px_1fr_56px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
                  <span>{term.shareholder}</span>
                  <span>{isLLC ? "Class" : "Share Class"}</span>
                  <span>{unitLabel}</span>
                  <span>Cert #</span>
                  <span>Issue Date</span>
                  <span>Status</span>
                  <span>Cancelled</span>
                  <span>Notes / Memo</span>
                  <span></span>
                </div>
                {rows.map((row, i) => {
                  const isNewOwner = row.ownerKey.startsWith("new:");
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[minmax(180px,1.4fr)_90px_90px_70px_120px_100px_120px_1fr_56px] gap-2 px-3 py-1.5 border-b last:border-b-0 items-center"
                    >
                      <div className="space-y-1">
                        <Select value={row.ownerKey || undefined} onValueChange={(v) => handleOwnerSelect(i, v)}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent className="z-[100] bg-popover">
                            {ownerOptions.map((o) => (
                              <SelectItem key={o.key} value={o.key} className="text-xs">{o.name}</SelectItem>
                            ))}
                            {isNewOwner && !ownerOptions.some((o) => o.key === row.ownerKey) && (
                              <SelectItem value={row.ownerKey} className="text-xs">
                                {ownerLabel(row.ownerKey) || "(new)"}
                              </SelectItem>
                            )}
                            <SelectItem value={NEW_OWNER_ACTION} className="text-xs font-medium">
                              + New {term.shareholder.toLowerCase()}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {isNewOwner && (
                          <Input
                            className="h-7 text-xs"
                            placeholder={`New ${term.shareholder.toLowerCase()} name`}
                            value={ownerLabel(row.ownerKey)}
                            onChange={(e) => renameNewOwner(row.ownerKey, e.target.value)}
                          />
                        )}
                      </div>
                      <Input
                        className="h-7 text-xs"
                        value={row.share_class}
                        onChange={(e) => updateRow(i, { share_class: e.target.value })}
                      />
                      <Input
                        className="h-7 text-xs"
                        type="number"
                        step="0.0001"
                        placeholder="0"
                        value={row.num_shares}
                        onChange={(e) => updateRow(i, { num_shares: e.target.value })}
                      />
                      <Input
                        className={`h-7 text-xs ${validation.dupCertRows.has(i) ? "border-destructive" : ""}`}
                        type="number"
                        placeholder="Auto"
                        value={row.certificate_number}
                        onChange={(e) => updateRow(i, { certificate_number: e.target.value })}
                      />
                      <DatePickerField
                        className="h-7 text-xs"
                        value={row.issue_date}
                        onChange={(v) => updateRow(i, { issue_date: v })}
                        placeholder="Issue date"
                      />
                      <Select
                        value={row.status}
                        onValueChange={(v) => updateRow(i, { status: v as CertRow["status"] })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="active" className="text-xs">Active</SelectItem>
                          <SelectItem value="cancelled" className="text-xs">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      {row.status === "cancelled" ? (
                        <DatePickerField
                          className="h-7 text-xs"
                          value={row.cancelled_date}
                          onChange={(v) => updateRow(i, { cancelled_date: v })}
                          placeholder="Cancelled"
                        />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                      <Input
                        className="h-7 text-xs"
                        placeholder="Optional notes"
                        value={row.notes}
                        onChange={(e) => updateRow(i, { notes: e.target.value })}
                      />
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title={`Add another certificate for this ${term.shareholder.toLowerCase()}`}
                          disabled={!row.ownerKey}
                          onClick={() => addCertForOwner(row.ownerKey)}
                        >
                          <CopyPlus className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => removeRow(i)}
                          disabled={rows.length === 1}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live totals */}
              {perOwner.size > 0 && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 space-y-1">
                  {Array.from(perOwner.entries()).map(([key, total]) => (
                    <div key={key} className="flex justify-between text-[11px]">
                      <span className="text-muted-foreground">{ownerLabel(key) || "(unnamed)"}</span>
                      <span className="font-mono">
                        {total.toLocaleString()} {unitLabel.toLowerCase()}
                        {entityTotal > 0 && (
                          <span className="text-muted-foreground ml-2">
                            ({((total / entityTotal) * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[11px] font-medium border-t pt-1">
                    <span>Total active {unitLabel.toLowerCase()}</span>
                    <span className="font-mono">{entityTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {validation.errors.length > 0 && rows.some(r => r.ownerKey) && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 space-y-0.5">
                  {validation.errors.map((e, idx) => (
                    <p key={idx} className="text-[11px] text-destructive flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {e}
                    </p>
                  ))}
                </div>
              )}
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
              disabled={save.isPending || !confirm || !balanceDate || validation.errors.length > 0}
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
