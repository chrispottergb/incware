import { useEffect, useMemo, useState } from "react";
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
import { AlertTriangle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { parseQuantity, roundQuantity } from "@/lib/ownership-snapshot";
import { useOwnershipSnapshot } from "@/hooks/useOwnershipSnapshot";

interface Props {
  companyId: string;
  snapshot: any;
  lots: any[];
  unitLabel: string;
  holderLabel: string;
  isLLC: boolean;
  parValue: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Row {
  shareholderId: string | null;
  holderName: string;
  quantity: string;
  certificateLabel: string;
}

/**
 * Amend (supersede) a locked opening ownership snapshot.
 *
 * Everything below submits as ONE `amend_ownership_snapshot` RPC call, which
 * runs as a single Postgres transaction. Nothing here writes to the ledger
 * directly, so a dropped connection can never leave the entity with corrected
 * opening balances and no replacements.
 *
 * Option (A) stand-in: a corporate action the ledger has no event type for
 * (e.g. a stock split) is entered as post-split quantities. The required reason
 * and linked source document are what explain the resulting jump in the ledger.
 * A real `stock_split` transaction type is queued as its own Phase 2 item.
 */
export default function AmendSnapshotDialog({
  companyId, snapshot, lots, unitLabel, holderLabel, isLLC, parValue, open, onOpenChange,
}: Props) {
  const { amend } = useOwnershipSnapshot(companyId, open);

  const [asOfDate, setAsOfDate] = useState("");
  const [reason, setReason] = useState("");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  const { data: documents = [] } = useQuery({
    queryKey: ["document_registry", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_registry")
        .select("id, title, document_type, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId && open,
  });

  useEffect(() => {
    if (!open) return;
    setAsOfDate("");
    setReason("");
    setSourceDocumentId("");
    setRows(
      (lots || [])
        .filter((l) => l.status === "outstanding")
        .map((l) => ({
          shareholderId: l.shareholder_id ?? null,
          holderName: l.holder_name_as_entered,
          quantity: String(Number(l.entered_quantity)),
          certificateLabel: l.certificate_label || (l.certificate_number ? String(l.certificate_number) : ""),
        }))
    );
  }, [open, lots]);

  const total = useMemo(
    () => roundQuantity(rows.reduce((s, r) => s + parseQuantity(r.quantity), 0)),
    [rows]
  );

  const priorTotal = useMemo(
    () =>
      roundQuantity(
        (lots || [])
          .filter((l) => l.status === "outstanding")
          .reduce((s, l) => s + Number(l.entered_quantity || 0), 0)
      ),
    [lots]
  );

  const errors: string[] = [];
  if (!asOfDate) errors.push("Choose the effective date of the amendment.");
  if (asOfDate && snapshot?.as_of_date && asOfDate < snapshot.as_of_date) {
    errors.push("The amendment date cannot precede the snapshot it supersedes.");
  }
  if (!reason.trim()) errors.push("Describe the corporate action that caused the change.");
  if (!sourceDocumentId) errors.push("Link the source document that evidences the change.");
  if (total <= 0) errors.push(`Enter at least one outstanding ${unitLabel.toLowerCase()} position.`);

  const submit = () => {
    amend.mutate(
      {
        priorSnapshotId: snapshot.id,
        asOfDate,
        shareClassLabel: snapshot.share_class_label,
        quantityBasis: snapshot.quantity_basis,
        entryTier: snapshot.entry_tier,
        declaredTotal: total,
        amendmentReason: reason,
        sourceDocumentId,
        isLLC,
        parValue,
        lots: rows
          .filter((r) => parseQuantity(r.quantity) > 0)
          .map((r) => ({
            shareholder_id: r.shareholderId,
            new_holder_name: r.shareholderId ? null : r.holderName,
            quantity: parseQuantity(r.quantity),
            certificate_label: r.certificateLabel || null,
            certificate_date: asOfDate,
            acquired_date: asOfDate,
            acquisition_type: "other",
            status: "outstanding" as const,
          })),
      },
      {
        onSuccess: () => {
          toast.success("Snapshot amended. The prior snapshot is preserved as history.");
          onOpenChange(false);
        },
        onError: (err: any) => toast.error(err.message || "Failed to amend snapshot"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto min-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Amend Ownership Snapshot
          </DialogTitle>
          <DialogDescription className="text-xs">
            Supersede the locked snapshot with a restated position. The prior snapshot is kept as history and its
            ledger entries are marked corrected — all in one database transaction, so partial states are impossible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amendment effective date</Label>
              <DatePickerField value={asOfDate} onChange={setAsOfDate} placeholder="Effective date" />
              <p className="text-[10px] text-muted-foreground">
                Prior snapshot as of {snapshot?.as_of_date}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Source document (required)</Label>
              <Select value={sourceDocumentId} onValueChange={setSourceDocumentId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select document" /></SelectTrigger>
                <SelectContent className="z-[100] bg-popover">
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {documents.length === 0 && (
                <p className="text-[10px] text-destructive">
                  No documents on file. Add the evidencing document first.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason for amendment (required, permanent record)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. 11.375-for-1 stock split effective January 2, 2026, approved by unanimous written consent."
              className="text-xs min-h-[72px]"
            />
            <p className="text-[10px] text-muted-foreground">
              This is the only place the record will state what caused the change in {unitLabel.toLowerCase()}s. It is
              stored with the snapshot and rendered next to the ledger discontinuity.
            </p>
          </div>

          <div className="rounded-md border border-border">
            <div className="grid grid-cols-[1fr_140px_120px] gap-2 px-3 py-1.5 bg-muted/50 border-b text-[10px] font-medium uppercase text-muted-foreground">
              <span>{holderLabel}</span>
              <span>{unitLabel} (restated)</span>
              <span>Cert</span>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_120px] gap-2 px-3 py-1.5 border-b last:border-b-0 items-center">
                <span className="text-xs">{r.holderName}</span>
                <Input
                  value={r.quantity}
                  onChange={(e) =>
                    setRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, quantity: e.target.value } : row)))
                  }
                  className="h-8 text-xs"
                />
                <Input
                  value={r.certificateLabel}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((row, idx) => (idx === i ? { ...row, certificateLabel: e.target.value } : row))
                    )
                  }
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">
              Prior total {priorTotal.toLocaleString()} {unitLabel.toLowerCase()}
            </span>
            <span className="font-medium">
              Restated total {total.toLocaleString()} {unitLabel.toLowerCase()}
            </span>
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
              {errors.map((e) => (
                <p key={e} className="flex items-start gap-2 text-[11px] text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={errors.length > 0 || amend.isPending}
            onClick={submit}
          >
            {amend.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Amend and lock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
