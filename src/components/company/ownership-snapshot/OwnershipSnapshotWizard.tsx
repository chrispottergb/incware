import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ClipboardPaste, Lock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import {
  ACQUISITION_TYPES, analyzePreExistingLedger, emptyLot, parsePastedLots, parseQuantity,
  reconcileSnapshot, suggestNextCertificateNumber, validateSnapshot,

  type EntryTier, type SnapshotLotInput,
} from "@/lib/ownership-snapshot";
import { useOwnershipSnapshot } from "@/hooks/useOwnershipSnapshot";

interface Props {
  companyId: string;
  entityType?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NEW_OWNER = "__new_owner__";

/**
 * Opening Ownership Snapshot wizard — Phase 1, unit/share basis only.
 * Percentage and capital-account bases are deferred to Phase 2; the schema
 * accepts them but the UI intentionally does not offer them yet.
 */
export default function OwnershipSnapshotWizard({ companyId, entityType = "Corporation", open, onOpenChange }: Props) {
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  const unitLabel = term.shareUnit;
  const holderLabel = term.shareholder;

  const [step, setStep] = useState(1);
  const [asOfDate, setAsOfDate] = useState("");
  const [entryTier, setEntryTier] = useState<EntryTier>("position_lots");
  const [shareClassLabel, setShareClassLabel] = useState(term.defaultClass);
  const [declaredTotal, setDeclaredTotal] = useState("");
  const [highestCert, setHighestCert] = useState("");
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [notes, setNotes] = useState("");
  const [lots, setLots] = useState<SnapshotLotInput[]>([emptyLot()]);
  const [newOwnerNames, setNewOwnerNames] = useState<Record<string, string>>({});
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const { lockedSnapshot, lockedLots, lock } = useOwnershipSnapshot(companyId, open);

  const { data: company } = useQuery({
    queryKey: ["company-snapshot-meta", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name, opening_balance_date, authorized_shares, par_value, par_value_type")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId && open,
  });

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

  // Pre-existing ledger activity decides whether this snapshot may lock at all.
  const { data: existingLedger = [] } = useQuery({
    queryKey: ["share_transactions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("transaction_type, entry_type, effective_date, transaction_date, num_shares, status")
        .eq("company_id", companyId);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId && open,
  });

  const priorLedger = useMemo(
    () => analyzePreExistingLedger(existingLedger as any[], asOfDate),
    [existingLedger, asOfDate]
  );


  const ownerName = (key: string) => {
    if (!key) return "";
    if (key.startsWith("new:")) return newOwnerNames[key] || "";
    return existingOwners.find((o) => o.id === key)?.name || "";
  };

  const updateLot = (i: number, patch: Partial<SnapshotLotInput>) =>
    setLots((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const handleOwnerSelect = (i: number, value: string) => {
    if (value === NEW_OWNER) {
      const key = `new:${Date.now()}-${i}`;
      setNewOwnerNames((p) => ({ ...p, [key]: "" }));
      updateLot(i, { ownerKey: key, holderName: "" });
    } else {
      updateLot(i, { ownerKey: value, holderName: ownerName(value) });
    }
  };

  const reconciliation = useMemo(
    () =>
      reconcileSnapshot(
        lots
          .filter((l) => l.ownerKey && parseQuantity(l.quantity) > 0)
          .map((l) => ({
            ownerKey: l.ownerKey,
            holderName: ownerName(l.ownerKey) || l.holderName,
            quantity: parseQuantity(l.quantity),
            status: l.status,
          })),
        declaredTotal
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lots, declaredTotal, newOwnerNames, existingOwners]
  );

  const validation = useMemo(
    () =>
      validateSnapshot(
        lots.map((l) => ({ ...l, holderName: ownerName(l.ownerKey) || l.holderName })),
        reconciliation,
        {
          asOfDate,
          existingCertificateNumbers: existingCertNumbers,
          authorized: company?.authorized_shares ?? null,
          unitLabel,
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lots, reconciliation, asOfDate, existingCertNumbers, company, unitLabel, newOwnerNames, existingOwners]
  );

  const applyPaste = () => {
    const { lots: parsed, skipped } = parsePastedLots(pasteText);
    if (!parsed.length) {
      toast.error("Nothing could be read from that text.");
      return;
    }
    const mapped = parsed.map((lot, n) => {
      const match = existingOwners.find(
        (o) => o.name.trim().toLowerCase() === lot.holderName.trim().toLowerCase()
      );
      if (match) return { ...lot, ownerKey: match.id, holderName: match.name };
      const key = `new:${Date.now()}-p${n}`;
      setNewOwnerNames((p) => ({ ...p, [key]: lot.holderName }));
      return { ...lot, ownerKey: key };
    });
    setLots(mapped);
    setPasteText("");
    setShowPaste(false);
    toast.success(
      `${mapped.length} holding(s) imported${skipped.length ? ` — ${skipped.length} line(s) skipped` : ""}.`
    );
  };

  const handleLock = () => {
    lock.mutate(
      {
        header: {
          asOfDate,
          quantityBasis: isLLC ? "units" : "shares",
          entryTier,
          shareClassLabel,
          declaredTotal: reconciliation.declaredTotal,
          highestCertificateNumberIssued: highestCert,
          reconciliationNote,
          notes,
        },
        lots: lots.map((l) => ({ ...l, holderName: ownerName(l.ownerKey) || l.holderName })),
        reconciliation,
        newOwnerNames,
        existingCertificateNumbers: existingCertNumbers,
        ctx: {
          isLLC,
          parValue: company?.par_value_type === "par" ? company?.par_value ?? null : null,
          reviewRows: validation.reviewRows,
        },
      },
      {
        onSuccess: (res) => {
          toast.success(
            `Snapshot locked. Next certificate number: ${res.suggestedNext}.`
          );
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err.message || "Failed to lock snapshot"),
      }
    );
  };

  const nextCert = suggestNextCertificateNumber(existingCertNumbers, lots.map((l) => l.certificateLabel));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto min-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Opening Ownership Snapshot
          </DialogTitle>
          <DialogDescription className="text-xs">
            Capture this entity's ownership exactly as it stands at pickup, reconcile it against the client's
            declared total, then lock it as the entity's opening balance.
          </DialogDescription>
        </DialogHeader>

        {lockedSnapshot ? (
          <LockedView
            snapshot={lockedSnapshot}
            lots={lockedLots}
            unitLabel={unitLabel}
            holderLabel={holderLabel}
          />
        ) : (
          <div className="space-y-4">
            <StepBar step={step} />

            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">"As Of" Date</Label>
                    <DatePickerField value={asOfDate} onChange={setAsOfDate} placeholder="Pickup date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">{term.classLabel}</Label>
                    <Select value={shareClassLabel} onValueChange={setShareClassLabel}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="z-[100] bg-popover">
                        {term.classOptions.map((c) => (
                          <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Basis</Label>
                    <Input value={`${unitLabel} (count)`} disabled className="h-9 text-xs" />
                    <p className="text-[10px] text-muted-foreground">
                      Percentage-only entities are handled in a later release.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">How much history is available?</Label>
                  <Select value={entryTier} onValueChange={(v) => setEntryTier(v as EntryTier)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      <SelectItem value="declared_total" className="text-xs">
                        Totals only — client knows balances, not certificates
                      </SelectItem>
                      <SelectItem value="position_lots" className="text-xs">
                        Current positions — one row per certificate held today
                      </SelectItem>
                      <SelectItem value="full_history" className="text-xs">
                        Full history — including surrendered certificates
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">
                      Declared total {unitLabel.toLowerCase()} outstanding
                    </Label>
                    <Input
                      value={declaredTotal}
                      onChange={(e) => setDeclaredTotal(e.target.value)}
                      placeholder="e.g. 100"
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      What the client says is outstanding. Entered holdings must reconcile to this.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Highest certificate number ever issued</Label>
                    <Input
                      value={highestCert}
                      onChange={(e) => setHighestCert(e.target.value)}
                      placeholder="Optional"
                      className="h-9 text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Keeps future numbering continuous with the client's original book.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Holdings as of {asOfDate || "—"}</Label>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]"
                      onClick={() => setShowPaste((s) => !s)}>
                      <ClipboardPaste className="mr-1 h-3 w-3" /> Paste list
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]"
                      onClick={() => setLots((p) => [...p, emptyLot()])}>
                      <Plus className="mr-1 h-3 w-3" /> Add holding
                    </Button>
                  </div>
                </div>

                {showPaste && (
                  <div className="rounded-md border border-border p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground">
                      One row per certificate: Holder, Quantity, Certificate, Certificate Date, Acquired Date.
                      Tab- or comma-separated. Unreadable rows are reported, never guessed.
                    </p>
                    <Textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={5}
                      className="text-xs font-mono"
                      placeholder={"Louise Revocable Trust, 60, C-3, 3/14/1998\nKen Smith, 40, C-4, 3/14/1998"}
                    />
                    <Button type="button" size="sm" className="h-7 text-[10px]" onClick={applyPaste}>
                      Import rows
                    </Button>
                  </div>
                )}

                <div className="rounded-md border border-border">
                  <div className="grid grid-cols-[minmax(160px,1.3fr)_90px_90px_110px_110px_130px_90px_40px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
                    <span>{holderLabel}</span>
                    <span>{unitLabel}</span>
                    <span>Cert</span>
                    <span>Cert Date</span>
                    <span>Acquired</span>
                    <span>How Acquired</span>
                    <span>Status</span>
                    <span />
                  </div>
                  {lots.map((lot, i) => (
                    <div key={i} className="grid grid-cols-[minmax(160px,1.3fr)_90px_90px_110px_110px_130px_90px_40px] gap-2 px-3 py-1.5 border-b last:border-b-0 items-center">
                      <div className="space-y-1">
                        <Select value={lot.ownerKey || undefined} onValueChange={(v) => handleOwnerSelect(i, v)}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder={`Select ${holderLabel.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent className="z-[100] bg-popover">
                            {existingOwners.map((o) => (
                              <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                            ))}
                            <SelectItem value={NEW_OWNER} className="text-xs">+ New {holderLabel.toLowerCase()}</SelectItem>
                          </SelectContent>
                        </Select>
                        {lot.ownerKey.startsWith("new:") && (
                          <Input
                            value={newOwnerNames[lot.ownerKey] || ""}
                            onChange={(e) =>
                              setNewOwnerNames((p) => ({ ...p, [lot.ownerKey]: e.target.value }))
                            }
                            placeholder={`${holderLabel} name`}
                            className="h-7 text-xs"
                          />
                        )}
                      </div>
                      <Input value={lot.quantity} onChange={(e) => updateLot(i, { quantity: e.target.value })}
                        className="h-7 text-xs" placeholder="0" />
                      <Input value={lot.certificateLabel} onChange={(e) => updateLot(i, { certificateLabel: e.target.value })}
                        className="h-7 text-xs" placeholder="C-1" />
                      <DatePickerField value={lot.certificateDate} onChange={(v) => updateLot(i, { certificateDate: v })} />
                      <DatePickerField value={lot.acquiredDate} onChange={(v) => updateLot(i, { acquiredDate: v })} />
                      <Select value={lot.acquisitionType} onValueChange={(v) => updateLot(i, { acquisitionType: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          {ACQUISITION_TYPES.map((a) => (
                            <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={lot.status} onValueChange={(v) => updateLot(i, { status: v as any })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[100] bg-popover">
                          <SelectItem value="outstanding" className="text-xs">Outstanding</SelectItem>
                          <SelectItem value="surrendered" className="text-xs">Surrendered</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setLots((p) => p.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground">Declared:</span>{" "}
                    <span className="font-semibold">
                      {reconciliation.declaredTotal?.toLocaleString() ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Entered:</span>{" "}
                    <span className="font-semibold">{reconciliation.computedTotal.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Variance:</span>{" "}
                    <span className={`font-semibold ${reconciliation.balanced ? "text-primary" : "text-destructive"}`}>
                      {reconciliation.variance === null ? "—" : reconciliation.variance.toLocaleString()}
                    </span>
                  </div>
                  <div className="ml-auto">
                    {reconciliation.balanced ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Reconciled
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">Out of balance</Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-md border border-border">
                  <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
                    <span>{holderLabel}</span>
                    <span>{unitLabel}</span>
                    <span>Ownership %</span>
                    <span>Certs</span>
                  </div>
                  {reconciliation.holders.map((h) => (
                    <div key={h.ownerKey} className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-3 py-1.5 border-b last:border-b-0 text-xs">
                      <span>{h.holderName}</span>
                      <span>{h.quantity.toLocaleString()}</span>
                      <span>{h.percentage === null ? "—" : `${h.percentage.toFixed(2)}%`}</span>
                      <span>{h.lotCount}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground">
                  Next certificate number after locking: <strong>{nextCert}</strong>
                  {reconciliation.surrenderedCount > 0 && (
                    <> · {reconciliation.surrenderedCount} surrendered certificate(s) archived, excluded from all totals.</>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Reconciliation note (source documents, who confirmed)</Label>
                  <Textarea value={reconciliationNote} onChange={(e) => setReconciliationNote(e.target.value)}
                    rows={2} className="text-xs" placeholder="e.g. Reconciled to the 2019 stock ledger provided by client counsel." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs" />
                </div>

                {validation.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    <p className="text-xs font-medium text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Resolve before locking
                    </p>
                    {validation.errors.map((e, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">{e}</p>
                    ))}
                  </div>
                )}
                {validation.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">{w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {!lockedSnapshot && (
          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !asOfDate}>
                Continue
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={handleLock}
                disabled={validation.errors.length > 0 || lock.isPending}>
                {lock.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Lock snapshot
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepBar({ step }: { step: number }) {
  const labels = ["Configure", "Enter holdings", "Reconcile & lock"];
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 ${
              step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}. {l}
          </span>
          {i < labels.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}

function LockedView({ snapshot, lots, unitLabel, holderLabel }: {
  snapshot: any; lots: any[]; unitLabel: string; holderLabel: string;
}) {
  const outstanding = lots.filter((l) => l.status === "outstanding");
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-3 w-3" /> Locked</Badge>
          <span className="text-muted-foreground">
            As of {new Date(snapshot.as_of_date + "T00:00:00").toLocaleDateString()} ·{" "}
            {Number(snapshot.declared_total ?? 0).toLocaleString()} {unitLabel.toLowerCase()} declared
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          This snapshot is immutable. Later ownership changes belong in the ledger as transactions; to restate the
          snapshot itself, record an amendment.
        </p>
      </div>
      <div className="rounded-md border border-border">
        <div className="grid grid-cols-[1fr_100px_90px_110px_90px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
          <span>{holderLabel}</span>
          <span>{unitLabel}</span>
          <span>Cert</span>
          <span>Cert Date</span>
          <span>Status</span>
        </div>
        {outstanding.map((l) => (
          <div key={l.id} className="grid grid-cols-[1fr_100px_90px_110px_90px] gap-2 px-3 py-1.5 border-b last:border-b-0 text-xs">
            <span>{l.holder_name_as_entered}</span>
            <span>{Number(l.entered_quantity).toLocaleString()}</span>
            <span>{l.certificate_label || l.certificate_number || "—"}</span>
            <span>{l.certificate_date || "—"}</span>
            <span>{l.needs_review ? "Needs review" : "Recorded"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
