import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateBillOfSalePdf } from "@/lib/bill-of-sale-pdf";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2, ArrowRight, ArrowLeft, CheckCircle2, Link2,
  ArrowRightLeft, AlertTriangle, FileText, UserPlus,
} from "lucide-react";
import { toast } from "sonner";

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "gift", label: "Gift" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "promissory_note", label: "Promissory Note" },
  { value: "no_consideration", label: "No Consideration" },
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  companyName?: string;
  entityType: string;
  meetingId: string;
  resolutionIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TransferRow {
  resolutionId: string;
  buyer_name: string;
  buyer_id: string;
  num_shares: string;
  price_per_share: string;
  total_consideration: string;
  consideration_type: string;
  transaction_type: string;
}

export default function BatchTransferDialog({
  companyId, companyName, entityType, meetingId, resolutionIds, open, onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  const defaultTxnType = isLLC ? "interest_transfer" : "transfer";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [certsSummary, setCertsSummary] = useState<string[]>([]);

  // Shared fields
  const [sellerId, setSellerId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [shareClass, setShareClass] = useState(term.defaultClass);
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Per-resolution rows
  const [rows, setRows] = useState<TransferRow[]>(() =>
    resolutionIds.map((id) => ({
      resolutionId: id,
      buyer_name: "",
      buyer_id: "",
      num_shares: "",
      price_per_share: "",
      total_consideration: "",
      consideration_type: "cash",
      transaction_type: defaultTxnType,
    }))
  );

  // Reset rows when resolutionIds change (dialog re-opened with different set)
  const resKey = resolutionIds.join(",");
  const [prevResKey, setPrevResKey] = useState(resKey);
  if (resKey !== prevResKey) {
    setPrevResKey(resKey);
    setRows(
      resolutionIds.map((id) => ({
        resolutionId: id,
        buyer_name: "",
        buyer_id: "",
        num_shares: "",
        price_per_share: "",
        total_consideration: "",
        consideration_type: "cash",
        transaction_type: defaultTxnType,
      }))
    );
    setStep(1);
    setSellerId("");
    setSellerName("");
    setCertsSummary([]);
  }

  // Fetch resolutions for context display
  const { data: resolutions = [] } = useQuery({
    queryKey: ["batch_resolutions", ...resolutionIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("id, purpose, resolution_text")
        .in("id", resolutionIds);
      if (error) throw error;
      return data;
    },
    enabled: open && resolutionIds.length > 0,
  });

  // Fetch shareholders
  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("id, name, status").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch certificates for validation
  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("id, certificate_number, shareholder_id, share_class, num_shares, status")
        .eq("company_id", companyId)
        .order("certificate_number");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const activeShareholders = shareholders.filter((s) => s.status === "active");

  // Seller holdings for validation
  const sellerHoldings = useMemo(() => {
    if (!sellerId) return 0;
    return certificates
      .filter((c: any) => c.shareholder_id === sellerId && c.share_class === shareClass && c.status === "active")
      .reduce((sum: number, c: any) => sum + Number(c.num_shares || 0), 0);
  }, [sellerId, shareClass, certificates]);

  const totalBatchShares = rows.reduce((sum, r) => sum + (parseFloat(r.num_shares) || 0), 0);

  // Validation
  let validationError: string | null = null;
  if (!sellerName) {
    validationError = "Select a seller";
  } else if (totalBatchShares <= 0) {
    validationError = "Enter share amounts for at least one buyer";
  } else if (totalBatchShares > sellerHoldings + 0.0001) {
    validationError = `Total of ${totalBatchShares.toLocaleString()} exceeds ${sellerName}'s holdings of ${sellerHoldings.toLocaleString()} ${term.shareUnit.toLowerCase()}.`;
  } else if (rows.some((r) => !r.buyer_name.trim())) {
    validationError = "All buyer names are required";
  } else if (rows.some((r) => !(parseFloat(r.num_shares) > 0))) {
    validationError = "All share amounts must be greater than zero";
  }

  const canProceed = !validationError;

  const updateRow = (idx: number, field: keyof TransferRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const transfers = rows.map((r) => {
        const numShares = parseFloat(r.num_shares) || 0;
        const pps = parseFloat(r.price_per_share) || 0;
        const autoTotal = numShares * pps;
        const totalConsideration = r.total_consideration ? parseFloat(r.total_consideration) : (autoTotal || null);
        return {
          buyer_name: r.buyer_name.trim(),
          buyer_id: r.buyer_id || null,
          num_shares: numShares,
          price_per_share: pps || null,
          total_consideration: totalConsideration,
          consideration_type: r.consideration_type,
          transaction_type: r.transaction_type,
          resolution_id: r.resolutionId,
        };
      });

      const { data: result, error: fnErr } = await supabase.functions.invoke("execute-batch-transfer", {
        body: {
          company_id: companyId,
          company_name: companyName,
          entity_type: entityType,
          seller_name: sellerName,
          seller_id: sellerId || null,
          share_class: shareClass,
          transaction_date: transactionDate,
          meeting_id: meetingId,
          transfers,
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Batch transfer failed");
      if (result?.error) throw new Error(result.error);

      setCertsSummary(result.certActions || []);
      setStep(3);

      // Invalidate all related queries
      const keys = [
        "share_transactions", "bills_of_sale", "shareholders",
        "stock_certificates", "active_certificates", "company",
        "meeting_resolutions",
      ];
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k, companyId] }));
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });

      toast.success(`Batch transfer complete — ${transfers.length} transactions recorded!`);

      // Generate and archive individual Bill of Sale PDFs (non-blocking)
      archiveBillsOfSale(result.results, transfers);
    } catch (err: any) {
      console.error("Batch transfer error:", err);
      toast.error(err.message || "Batch transfer failed — all changes rolled back.");
    } finally {
      setSaving(false);
    }
  };

  const archiveBillsOfSale = async (
    results: { transactionId: string; billId: string; buyerName: string }[],
    transfers: { buyer_name: string; num_shares: number; price_per_share: number | null; total_consideration: number | null; consideration_type: string }[]
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sellerLast = sellerName.trim().split(/\s+/).pop() || "Seller";
      const dateStr = transactionDate;

      // Check for existing docs with similar names for dedup
      const { data: existingDocs = [] } = await supabase
        .from("company_documents")
        .select("file_name")
        .eq("company_id", companyId)
        .like("file_name", `Bill_of_Sale_${sellerLast}_%_${dateStr}%`);
      const existingNames = new Set((existingDocs || []).map((d: any) => d.file_name));

      for (let i = 0; i < results.length; i++) {
        try {
          const r = results[i];
          const t = transfers[i];
          const buyerLast = r.buyerName.trim().split(/\s+/).pop() || "Buyer";

          let baseName = `Bill_of_Sale_${sellerLast}_to_${buyerLast}_${dateStr}`;
          let pdfFilename = `${baseName}.pdf`;
          let seq = 2;
          while (existingNames.has(pdfFilename)) {
            pdfFilename = `${baseName}_${seq}.pdf`;
            seq++;
          }
          existingNames.add(pdfFilename);

          const doc = generateBillOfSalePdf({
            companyName: companyName || "",
            sellerName,
            buyerName: r.buyerName,
            numShares: t.num_shares,
            shareClass,
            pricePerShare: t.price_per_share,
            totalPrice: t.total_consideration,
            saleDate: transactionDate,
            considerationType: t.consideration_type,
          });

          const pdfBlob = doc.output("blob");
          const filePath = `${companyId}/${pdfFilename}`;

          const { error: uploadErr } = await supabase.storage
            .from("generated-documents")
            .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

          if (uploadErr) {
            console.warn(`Bill of Sale PDF upload failed for ${r.buyerName}:`, uploadErr);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("generated-documents")
            .getPublicUrl(filePath);

          await supabase.from("company_documents").insert({
            company_id: companyId,
            user_id: user.id,
            file_name: pdfFilename,
            file_path: urlData.publicUrl,
            file_type: "application/pdf",
            category: "Agreements",
            notes: `Auto-generated Bill of Sale: ${sellerName} → ${r.buyerName}, ${t.num_shares} ${shareClass}`,
          });
        } catch (pdfErr) {
          console.warn(`Bill of Sale PDF generation failed for buyer ${i}:`, pdfErr);
        }
      }
    } catch (err) {
      console.warn("Bill of Sale archival failed:", err);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep(1);
      setSellerId("");
      setSellerName("");
      setCertsSummary([]);
      setRows(
        resolutionIds.map((id) => ({
          resolutionId: id,
          buyer_name: "",
          buyer_id: "",
          num_shares: "",
          price_per_share: "",
          total_consideration: "",
          consideration_type: "cash",
          transaction_type: defaultTxnType,
        }))
      );
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            Execute Batch Transfer — {resolutionIds.length} Transfers
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          <span className={step >= 1 ? "text-primary font-semibold" : ""}>1. Details</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step >= 2 ? "text-primary font-semibold" : ""}>2. Review</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step >= 3 ? "text-primary font-semibold" : ""}>3. Done</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {/* Shared fields */}
            <div className="grid grid-cols-3 gap-2">
              <div className="field-group">
                <Label className="field-label">Seller ({term.shareholder})</Label>
                <Select value={sellerId} onValueChange={(v) => {
                  const sh = activeShareholders.find((s) => s.id === v);
                  setSellerId(v);
                  setSellerName(sh?.name || "");
                }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeShareholders.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">{term.classLabel}</Label>
                <Select value={shareClass} onValueChange={setShareClass}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {term.classOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">Transaction Date</Label>
                <DatePickerField value={transactionDate} onChange={setTransactionDate} />
              </div>
            </div>

            {sellerName && (
              <p className="text-xs text-muted-foreground">
                {sellerName} holds <span className="font-semibold">{sellerHoldings.toLocaleString()}</span> {term.shareUnit.toLowerCase()} in {shareClass}
              </p>
            )}

            {/* Per-resolution rows */}
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const resolution = resolutions.find((r) => r.id === row.resolutionId);
                const numShares = parseFloat(row.num_shares) || 0;
                const pps = parseFloat(row.price_per_share) || 0;
                const autoTotal = numShares * pps;

                return (
                  <div key={row.resolutionId} className="rounded-lg border border-border p-3 space-y-2">
                    {/* Resolution context */}
                    {resolution && (
                      <div className="flex items-start gap-2 mb-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">{resolution.purpose}</span>
                          <p className="line-clamp-2 mt-0.5">{resolution.resolution_text}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="field-group">
                        <Label className="field-label">Buyer {idx + 1}</Label>
                        {isLLC ? (
                          <Select value={row.buyer_id} onValueChange={(v) => {
                            const sh = shareholders.find((s) => s.id === v);
                            updateRow(idx, "buyer_id", v);
                            updateRow(idx, "buyer_name", sh?.name || "");
                          }}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {shareholders.filter((s) => s.id !== sellerId).map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <>
                            <Input
                              className="h-8 text-sm"
                              value={row.buyer_name}
                              onChange={(e) => {
                                updateRow(idx, "buyer_name", e.target.value);
                                updateRow(idx, "buyer_id", "");
                              }}
                              placeholder="Buyer name"
                            />
                            {shareholders.length > 0 && (
                              <Select value={row.buyer_id} onValueChange={(v) => {
                                const sh = shareholders.find((s) => s.id === v);
                                updateRow(idx, "buyer_id", v);
                                updateRow(idx, "buyer_name", sh?.name || row.buyer_name);
                              }}>
                                <SelectTrigger className="h-7 text-[11px] mt-1">
                                  <SelectValue placeholder={`Link ${term.shareholder.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {shareholders.filter((s) => s.id !== sellerId).map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {row.buyer_name.trim() && !shareholders.some(
                              (s) => s.name.toLowerCase().trim() === row.buyer_name.toLowerCase().trim()
                            ) && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                                <UserPlus className="h-3 w-3" />
                                <span>New {term.shareholder.toLowerCase()} will be created</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="field-group">
                        <Label className="field-label">{term.numUnitsLabel}</Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.0001"
                          value={row.num_shares}
                          onChange={(e) => updateRow(idx, "num_shares", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="field-group">
                        <Label className="field-label">{term.pricePerUnit}</Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.01"
                          value={row.price_per_share}
                          onChange={(e) => updateRow(idx, "price_per_share", e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <Label className="field-label">Total Consideration</Label>
                        <Input
                          className="h-8 text-sm"
                          type="number"
                          step="0.01"
                          value={row.total_consideration}
                          onChange={(e) => updateRow(idx, "total_consideration", e.target.value)}
                          placeholder={autoTotal ? `$${autoTotal.toFixed(2)}` : ""}
                        />
                      </div>
                      <div className="field-group">
                        <Label className="field-label">Type</Label>
                        <Select value={row.consideration_type} onValueChange={(v) => updateRow(idx, "consideration_type", v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONSIDERATION_TYPES.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Batch total summary */}
            {totalBatchShares > 0 && (
              <div className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalBatchShares.toLocaleString()}</span> {term.shareUnit.toLowerCase()} across {rows.length} transfers
                {sellerHoldings > 0 && (
                  <span> — remainder to seller: <span className="font-semibold text-foreground">{(sellerHoldings - totalBatchShares).toLocaleString()}</span></span>
                )}
              </div>
            )}

            {validationError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">{validationError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button size="sm" onClick={() => setStep(2)} disabled={!canProceed}>
                Review <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Seller:</span>
                <span className="font-medium">{sellerName}</span>
                <span className="text-muted-foreground">{term.classLabel}:</span>
                <span>{shareClass}</span>
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(transactionDate + "T00:00:00").toLocaleDateString()}</span>
                <span className="text-muted-foreground">Total {term.shareUnit}:</span>
                <span className="font-semibold">{totalBatchShares.toLocaleString()}</span>
              </div>

              <div className="border-t border-border pt-2 mt-2 space-y-1.5">
                {rows.map((r, idx) => {
                  const numShares = parseFloat(r.num_shares) || 0;
                  const pps = parseFloat(r.price_per_share) || 0;
                  const total = r.total_consideration ? parseFloat(r.total_consideration) : (numShares * pps || null);
                  return (
                    <div key={r.resolutionId} className="flex items-center justify-between">
                      <span>→ <span className="font-medium">{r.buyer_name}</span></span>
                      <span>{numShares.toLocaleString()} {term.shareUnit.toLowerCase()} {total ? `($${total.toFixed(2)})` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">This batch will create:</p>
              <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> {rows.length} {term.ledgerTitle} entries</p>
              <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> {rows.length} Bills of Sale (individually named PDFs)</p>
              <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> 1 certificate cancellation (seller) + {rows.length} buyer certificate(s)</p>
              {sellerHoldings - totalBatchShares > 0.0001 && (
                <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> 1 remainder certificate to {sellerName}</p>
              )}
              {isLLC && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> Updated ownership percentages &amp; capital accounts</p>}
              <p className="text-muted-foreground mt-1">All records linked atomically — all succeed or all roll back.</p>
            </div>

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm & Execute All
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="text-sm font-medium">Batch Transfer Complete</p>
              <p className="text-xs text-muted-foreground mt-1">
                {rows.length} transactions recorded, certificates updated, and Bills of Sale archived.
              </p>
            </div>

            {certsSummary.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-left space-y-1">
                <p className="font-medium text-foreground mb-1">Certificate Actions:</p>
                {certsSummary.map((action, i) => (
                  <p key={i} className="flex items-center gap-1.5">
                    <Link2 className="h-3 w-3 text-primary shrink-0" />
                    {action}
                  </p>
                ))}
              </div>
            )}

            <Button size="sm" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
