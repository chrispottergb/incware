import { useState, useEffect } from "react";
import NameAutocomplete from "@/components/NameAutocomplete";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateBillOfSalePdf } from "@/lib/bill-of-sale-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Link2, ArrowRightLeft, AlertTriangle, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";

const TRANSACTION_TYPES_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  Corporation: [
    { value: "initial_issuance", label: "Initial Share Issuance" },
    { value: "transfer", label: "Share Transfer" },
    { value: "redemption", label: "Treasury Repurchase" },
    { value: "share_exchange", label: "Share Exchange" },
    { value: "gift", label: "Gift / Donation of Shares" },
  ],
  "S-Corp": [
    { value: "initial_issuance", label: "Initial Share Issuance" },
    { value: "transfer", label: "Share Transfer" },
    { value: "redemption", label: "Treasury Repurchase" },
    { value: "gift", label: "Gift / Donation of Shares" },
  ],
  LLC: [
    { value: "initial_contribution", label: "Initial Capital Contribution" },
    { value: "additional_contribution", label: "Additional Contribution" },
    { value: "interest_transfer", label: "Transfer of Membership Interest" },
    { value: "interest_assignment", label: "Assignment of Interest" },
    { value: "redemption", label: "Interest Redemption" },
    { value: "dissociation_buyout", label: "Dissociation Buyout" },
    { value: "gift", label: "Gift of Membership Interest" },
  ],
  "Single Member LLC": [
    { value: "initial_contribution", label: "Initial Capital Contribution" },
    { value: "additional_contribution", label: "Additional Contribution" },
    { value: "interest_transfer", label: "Transfer of Membership Interest" },
    { value: "interest_assignment", label: "Assignment of Interest" },
    { value: "redemption", label: "Interest Redemption" },
    { value: "dissociation_buyout", label: "Dissociation Buyout" },
    { value: "gift", label: "Gift of Membership Interest" },
  ],
  "LLC-S": [
    { value: "initial_contribution", label: "Initial Capital Contribution" },
    { value: "additional_contribution", label: "Additional Contribution" },
    { value: "interest_transfer", label: "Transfer of Membership Interest" },
    { value: "interest_assignment", label: "Assignment of Interest" },
    { value: "redemption", label: "Interest Redemption" },
    { value: "dissociation_buyout", label: "Dissociation Buyout" },
    { value: "gift", label: "Gift of Membership Interest" },
  ],
};

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableShares?: number | null;
  initialSeller?: { id: string; name: string };
  meetingId?: string;
  onTransactionComplete?: (txnId: string) => void;
}

export default function BuySellWorkflow({ companyId, companyName, entityType, open, onOpenChange, availableShares, initialSeller, meetingId, onTransactionComplete }: Props) {
  const { search: searchAddressBook, getCompanySplitIndex } = useAddressBookContext(companyId);
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  const transactionTypes = TRANSACTION_TYPES_BY_ENTITY[entityType] || TRANSACTION_TYPES_BY_ENTITY["Corporation"];
  const defaultTransactionType = isLLC ? "interest_transfer" : "transfer";
  const initialTransactionType = transactionTypes.some((t) => t.value === defaultTransactionType)
    ? defaultTransactionType
    : (transactionTypes[0]?.value || "transfer");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<{ transactionId: string; billId: string } | null>(null);
  const [certsSummary, setCertsSummary] = useState<string[]>([]);

  const [form, setForm] = useState({
    transaction_type: initialTransactionType,
    seller_name: "",
    seller_id: "",
    buyer_name: "",
    buyer_id: "",
    share_class: term.defaultClass,
    num_shares: "",
    price_per_share: "",
    total_consideration: "",
    consideration_type: "cash",
    transaction_date: new Date().toISOString().split("T")[0],
    effective_date: new Date().toISOString().split("T")[0],
  });

  const bswTodayStr = new Date().toISOString().split("T")[0];
  const bswEffectiveDateIsFuture = form.effective_date > bswTodayStr;

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });


  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("certificate_number");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const resetAll = () => {
    setStep(1);
    setSavedIds(null);
    setCertsSummary([]);
    setForm({
      transaction_type: initialTransactionType,
      seller_name: "", seller_id: "", buyer_name: "", buyer_id: "",
      share_class: term.defaultClass, num_shares: "", price_per_share: "",
      total_consideration: "", consideration_type: "cash",
      transaction_date: new Date().toISOString().split("T")[0],
      effective_date: new Date().toISOString().split("T")[0],
    });
  };

  // Pre-populate seller when initialSeller is provided and dialog opens
  useEffect(() => {
    if (open && initialSeller) {
      setForm(p => ({ ...p, seller_id: initialSeller.id, seller_name: initialSeller.name }));
    }
  }, [open, initialSeller]);

  // Auto-set gift defaults when gift transaction type is selected
  useEffect(() => {
    if (form.transaction_type === "gift") {
      setForm(p => ({
        ...p,
        price_per_share: "0",
        total_consideration: "0",
        consideration_type: "gift",
      }));
    }
  }, [form.transaction_type]);

  const numShares = parseFloat(form.num_shares) || 0;
  const pricePerShare = parseFloat(form.price_per_share) || 0;
  const autoTotal = numShares * pricePerShare;
  const totalConsideration = form.total_consideration ? parseFloat(form.total_consideration) : (autoTotal || null);

  const isIssuance = ["initial_issuance", "initial_contribution", "additional_contribution"].includes(form.transaction_type);
  const isTransfer = ["transfer", "share_exchange", "gift", "interest_transfer", "interest_assignment"].includes(form.transaction_type);
  const isRedemption = ["redemption", "dissociation_buyout"].includes(form.transaction_type);

  // For LLCs, buyer must be an existing member — buyerIsNew is always false
  const buyerIsNew = !isLLC && !isRedemption && form.buyer_name.trim().length > 0 && !shareholders.some(
    s => s.name.toLowerCase().trim() === form.buyer_name.toLowerCase().trim()
  );

  // Validation
  let validationError: string | null = null;
  if (isIssuance && availableShares != null && numShares > availableShares) {
    validationError = `Only ${availableShares.toLocaleString()} ${term.shareUnit.toLowerCase()} remain available to issue from the authorized pool.`;
  }
  if ((isTransfer || isRedemption) && form.seller_name && numShares > 0) {
    // Use certificate-based holdings (single source of truth) instead of transaction-based
    const sellerSh = shareholders.find(s => s.name.toLowerCase().trim() === form.seller_name.toLowerCase().trim());
    let sellerHoldings = 0;
    if (sellerSh) {
      const sellerActiveCerts = certificates.filter(
        (c: any) => c.shareholder_id === sellerSh.id && c.status === "active"
      );
      sellerHoldings = sellerActiveCerts.reduce((sum: number, c: any) => sum + (c.num_shares || 0), 0);
    }
    if (numShares > sellerHoldings) {
      validationError = `${form.seller_name} only holds ${sellerHoldings.toLocaleString()} ${term.shareUnit.toLowerCase()}. Cannot ${isRedemption ? "repurchase" : "transfer"} ${numShares.toLocaleString()}.`;
    }
  }

  const canProceedStep1 = form.seller_name && (isRedemption || form.buyer_name) && numShares > 0 && form.transaction_date && !validationError;




  const handleSave = async () => {
    setSaving(true);
    try {
      const effectiveBuyerName = isRedemption ? (companyName || "Treasury") : form.buyer_name;

      // Date guard: block transactions before opening_balance_date
      const { data: companyCheck } = await supabase
        .from("companies")
        .select("opening_balance_date")
        .eq("id", companyId)
        .maybeSingle();
      if (companyCheck?.opening_balance_date && form.transaction_date < companyCheck.opening_balance_date) {
        toast.error(`This entity has an opening balance established as of ${new Date(companyCheck.opening_balance_date + "T00:00:00").toLocaleDateString()}. Transactions cannot be dated before the opening balance date.`);
        setSaving(false);
        return;
      }

      // Call atomic edge function
      const { data: result, error: fnErr } = await supabase.functions.invoke("execute-share-transfer", {
        body: {
          company_id: companyId,
          company_name: companyName,
          entity_type: entityType,
          transaction_type: form.transaction_type,
          seller_name: form.seller_name,
          seller_id: form.seller_id || null,
          buyer_name: form.buyer_name,
          buyer_id: form.buyer_id || null,
          share_class: form.share_class,
          num_shares: numShares,
          price_per_share: pricePerShare || null,
          total_consideration: totalConsideration,
          consideration_type: form.consideration_type,
          transaction_date: form.transaction_date,
          effective_date: form.effective_date || form.transaction_date,
          meeting_id: meetingId || null,
        },
      });

      if (fnErr) throw new Error(fnErr.message || "Transaction failed");
      if (result?.error) throw new Error(result.error);

      const { transactionId, billId, certActions } = result;

      setCertsSummary(certActions || []);
      setSavedIds({ transactionId, billId });
      setStep(3);

      // Notify parent if this was triggered from a meeting resolution
      if (onTransactionComplete && transactionId) {
        onTransactionComplete(transactionId);
      }

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bills_of_sale", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });

      toast.success("Transaction recorded successfully!");

      // Auto-generate and archive Bill of Sale PDF (non-blocking)
      try {
        const sellerLast = form.seller_name.trim().split(/\s+/).pop() || "Seller";
        const buyerLast = effectiveBuyerName.trim().split(/\s+/).pop() || "Buyer";
        const pdfFilename = `Bill_of_Sale_${sellerLast}_to_${buyerLast}_${form.transaction_date}.pdf`;

        const doc = generateBillOfSalePdf({
          companyName: companyName || "",
          sellerName: form.seller_name,
          buyerName: effectiveBuyerName,
          numShares,
          shareClass: form.share_class,
          pricePerShare: pricePerShare || null,
          totalPrice: totalConsideration,
          saleDate: form.transaction_date,
          considerationType: form.consideration_type,
        });

        const pdfBlob = doc.output("blob");
        const filePath = `${companyId}/${pdfFilename}`;

        const { error: uploadErr } = await supabase.storage
          .from("generated-documents")
          .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

        if (uploadErr) {
          console.warn("Equity Transaction PDF upload failed:", uploadErr);
          toast.warning("Transaction saved. Equity Transaction PDF could not be archived — you can regenerate it from the Equity Transactions tab.");
        } else {
          // Get the public URL and insert into company_documents
          const { data: urlData } = supabase.storage
            .from("generated-documents")
            .getPublicUrl(filePath);

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("company_documents").insert({
              company_id: companyId,
              user_id: user.id,
              file_name: pdfFilename,
              file_path: urlData.publicUrl,
              file_type: "application/pdf",
              category: "Agreements",
              notes: `Auto-generated Bill of Sale: ${form.seller_name} → ${effectiveBuyerName}, ${numShares} ${form.share_class}`,
            });
          }
        }
      } catch (pdfErr) {
        console.warn("Bill of Sale PDF generation failed:", pdfErr);
      }
    } catch (err) {
      console.error("BuySellWorkflow save error:", err);
      toast.error("Failed to save transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetAll, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
            {isRedemption ? "Treasury Repurchase" : term.isLLC ? "Buy / Sell Membership Interest" : "Buy / Sell Shares"}
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

        {/* Step 1: Transaction Details */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="field-group">
                <Label className="field-label">Transaction Type</Label>
                <Select value={form.transaction_type} onValueChange={(v) => setForm(p => ({ ...p, transaction_type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {transactionTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">Date</Label>
                <DatePickerField value={form.transaction_date} onChange={(v) => setForm(p => ({ ...p, transaction_date: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field-group">
                <Label className="field-label">Effective Date</Label>
                <DatePickerField value={form.effective_date} onChange={(v) => setForm(p => ({ ...p, effective_date: v }))} />
              </div>
              <div className="field-group flex items-end pb-1">
                 {bswEffectiveDateIsFuture ? (
                   <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>
                 ) : (
                   <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">Effective</Badge>
                )}
              </div>
            </div>

            <div className={`grid ${isRedemption ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
              <div className="field-group">
                <Label className="field-label">{isIssuance ? "Issuing From (Company)" : isRedemption ? "Shareholder Selling Back" : "Seller"}</Label>
                <NameAutocomplete className="h-8 text-sm" value={form.seller_name} onChange={(v) => setForm(p => ({ ...p, seller_name: v, seller_id: "" }))} onSelect={(entry) => { setForm(p => ({ ...p, seller_name: entry.full_name, seller_id: "" })); }} search={searchAddressBook} getCompanySplitIndex={getCompanySplitIndex} placeholder="Name" />
                {shareholders.length > 0 && (
                  <Select value={form.seller_id} onValueChange={(v) => {
                    const sh = shareholders.find(s => s.id === v);
                    setForm(p => ({ ...p, seller_id: v, seller_name: sh?.name || p.seller_name }));
                  }}>
                    <SelectTrigger className="h-7 text-[11px] mt-1"><SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              {!isRedemption && (
                <div className="field-group">
                  <Label className="field-label">Buyer</Label>
                  {isLLC ? (
                    /* LLC: select-only from existing members */
                    <Select value={form.buyer_id} onValueChange={(v) => {
                      const sh = shareholders.find(s => s.id === v);
                      setForm(p => ({ ...p, buyer_id: v, buyer_name: sh?.name || "" }));
                    }}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select existing ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                      <SelectContent>{shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : (
                    /* Corporation: free-text + shareholder dropdown (matching Seller pattern) */
                    <>
                      <NameAutocomplete className="h-8 text-sm" value={form.buyer_name} onChange={(v) => setForm(p => ({ ...p, buyer_name: v, buyer_id: "" }))} onSelect={(entry) => { setForm(p => ({ ...p, buyer_name: entry.full_name, buyer_id: "" })); }} search={searchAddressBook} getCompanySplitIndex={getCompanySplitIndex} placeholder="Name" />
                      {shareholders.length > 0 && (
                        <Select value={form.buyer_id} onValueChange={(v) => {
                          const sh = shareholders.find(s => s.id === v);
                          setForm(p => ({ ...p, buyer_id: v, buyer_name: sh?.name || p.buyer_name }));
                        }}>
                          <SelectTrigger className="h-7 text-[11px] mt-1"><SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                          <SelectContent>{shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      {buyerIsNew && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-primary">
                          <UserPlus className="h-3 w-3" />
                          <span>New {term.shareholder.toLowerCase()} will be created</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {isRedemption && (
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                {isLLC 
                  ? "Membership interest will be returned to the company. The member's capital account will be reduced accordingly."
                  : "Shares will be returned to treasury. The corporation's available-to-issue pool will increase by the repurchased amount."}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2">
              <div className="field-group">
                <Label className="field-label">{term.classLabel}</Label>
                <Select value={form.share_class} onValueChange={(v) => setForm(p => ({ ...p, share_class: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {term.classOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">{term.numUnitsLabel}</Label>
                <Input className="h-8 text-sm" type="number" step="0.0001" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
              </div>
              <div className="field-group">
                <Label className="field-label">{term.pricePerUnit}</Label>
                <Input className="h-8 text-sm" type="number" step="0.01" value={form.price_per_share} onChange={(e) => setForm(p => ({ ...p, price_per_share: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="field-group">
                <Label className="field-label">{isRedemption ? "Consideration Paid by Corp" : "Total Consideration"}</Label>
                <Input className="h-8 text-sm" type="number" step="0.01"
                  value={form.total_consideration}
                  onChange={(e) => setForm(p => ({ ...p, total_consideration: e.target.value }))}
                  placeholder={autoTotal ? `$${autoTotal.toFixed(2)}` : ""}
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Consideration Type</Label>
                <Select value={form.consideration_type} onValueChange={(v) => setForm(p => ({ ...p, consideration_type: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONSIDERATION_TYPES.map(ct => <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {validationError && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                <AlertDescription className="text-xs">{validationError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button size="sm" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                Review <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Review & Confirm */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{form.transaction_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">Date:</span>
                <span>{new Date(form.transaction_date + "T00:00:00").toLocaleDateString()}</span>
                <span className="text-muted-foreground">{isRedemption ? "Shareholder:" : "Seller:"}</span>
                <span className="font-medium">{form.seller_name}</span>
                {!isRedemption && <>
                  <span className="text-muted-foreground">Buyer:</span>
                  <span className="font-medium">{form.buyer_name}</span>
                </>}
                {isRedemption && <>
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium">Treasury (Corporation)</span>
                </>}
                <span className="text-muted-foreground">{term.classLabel}:</span>
                <span>{form.share_class}</span>
                <span className="text-muted-foreground">{term.shareUnit}:</span>
                <span>{numShares.toLocaleString()}</span>
                {pricePerShare > 0 && <>
                  <span className="text-muted-foreground">{term.pricePerUnit}:</span>
                  <span>${pricePerShare.toFixed(2)}</span>
                </>}
                <span className="text-muted-foreground">Total:</span>
                <span className="font-semibold">{totalConsideration ? `$${totalConsideration.toFixed(2)}` : "—"}</span>
                <span className="text-muted-foreground">Consideration:</span>
                <span className="capitalize">{form.consideration_type.replace(/_/g, " ")}</span>
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">This will create:</p>
              <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> 1 {term.ledgerTitle} entry</p>
              <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> 1 Bill of Sale record</p>
              {(isTransfer || isIssuance) && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> Auto-generated {term.certificate.toLowerCase()}(s)</p>}
              {isRedemption && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> Certificate cancellation + {term.shareUnit.toLowerCase()} returned to treasury</p>}
              {isLLC && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> Updated ownership percentages &amp; capital accounts</p>}
              {buyerIsNew && <p className="flex items-center gap-1.5"><UserPlus className="h-3 w-3 text-primary" /> New {term.shareholder.toLowerCase()} record created</p>}
              <p className="text-muted-foreground mt-1">All records will be linked for audit integrity.</p>
            </div>

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Confirm & Save
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Success + Certificate Summary */}
        {step === 3 && (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="text-sm font-medium">Transaction Recorded Successfully</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ledger entry and bill of sale have been created and linked.
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

            <Button size="sm" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
