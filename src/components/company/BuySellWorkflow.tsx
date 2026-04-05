import { useState, useEffect } from "react";
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
  });

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
    });
  };

  // Pre-populate seller when initialSeller is provided and dialog opens
  useEffect(() => {
    if (open && initialSeller) {
      setForm(p => ({ ...p, seller_id: initialSeller.id, seller_name: initialSeller.name }));
    }
  }, [open, initialSeller]);

  const numShares = parseInt(form.num_shares) || 0;
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

  // Helper to get next cert number accounting for certs we'll create during this save
  const getNextCertNum = (offset = 0) => {
    const maxExisting = certificates.length > 0
      ? Math.max(...certificates.map((c: any) => c.certificate_number))
      : 0;
    return maxExisting + 1 + offset;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // For redemption, buyer is "Treasury"
      const effectiveBuyerName = isRedemption ? (companyName || "Treasury") : form.buyer_name;

      // 1. Insert share_transaction
      const { data: txn, error: txnErr } = await supabase.from("share_transactions").insert({
        company_id: companyId,
        transaction_type: form.transaction_type,
        shareholder_id: form.seller_id || null, // For redemption, link to the seller
        share_class: form.share_class,
        num_shares: numShares,
        price_per_share: pricePerShare || null,
        total_consideration: totalConsideration,
        consideration_type: form.consideration_type,
        transaction_date: form.transaction_date,
        from_shareholder: form.seller_name,
        to_shareholder: isRedemption ? "Treasury" : form.buyer_name,
        par_value: null as any, // will be updated below after certs are created
      }).select("id").single();
      if (txnErr) throw txnErr;

      // 2. Insert bill_of_sale with transaction link
      const { data: bill, error: billErr } = await supabase.from("bills_of_sale").insert({
        company_id: companyId,
        seller_name: form.seller_name,
        buyer_name: effectiveBuyerName,
        share_class: form.share_class,
        num_shares: numShares,
        price_per_share: pricePerShare || null,
        total_price: totalConsideration,
        sale_date: form.transaction_date,
        shareholder_id: form.seller_id || null,
        transaction_id: txn.id,
      }).select("id").single();
      if (billErr) throw billErr;

      // 3. Update transaction with bill_of_sale_id reverse link
      await supabase.from("share_transactions")
        .update({ bill_of_sale_id: bill.id })
        .eq("id", txn.id);

      // 4. Auto-create buyer as shareholder if they don't exist (not for redemption)
      let buyerShId = form.buyer_id || null;
      let buyerSh = !isRedemption ? shareholders.find(s => s.name.toLowerCase().trim() === form.buyer_name.toLowerCase().trim()) : null;
      if (!isRedemption && !buyerSh && form.buyer_name.trim()) {
        const { data: newSh, error: newShErr } = await supabase.from("shareholders").insert({
          company_id: companyId,
          name: form.buyer_name.trim(),
          status: "active",
        }).select("id, name").single();
        if (newShErr) {
          console.error("Failed to auto-create buyer shareholder:", newShErr);
        } else {
          buyerSh = newSh;
          buyerShId = newSh.id;
        }
      } else if (buyerSh) {
        buyerShId = buyerSh.id;
      }

      // 5. For transfers/issuances, update transaction to link shareholder_id to buyer
      if (!isRedemption && buyerShId) {
        await supabase.from("share_transactions")
          .update({ shareholder_id: buyerShId })
          .eq("id", txn.id);
      }

      // 6. For LLCs, recalculate ownership percentages
      if (isLLC) {
        await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
      }

      // 7. Certificate lifecycle (applies to both corps AND LLCs — cancel-and-reissue pattern)
      const certActions: string[] = [];
      let certOffset = 0;

      {
        // Find seller's active cert for this share class
        const sellerSh = shareholders.find(s => s.name.toLowerCase().trim() === form.seller_name.toLowerCase().trim());

        if (isTransfer || isRedemption) {
          if (sellerSh) {
            const sellerCert = certificates.find(
              (c: any) => c.shareholder_id === sellerSh.id && c.share_class === form.share_class && c.status === "active"
            );
            if (sellerCert) {
              // Cancel seller's active certificate
              await supabase.from("stock_certificates").update({
                status: "cancelled",
                cancelled_date: form.transaction_date,
                cancelled_reason: isRedemption
                  ? `Treasury repurchase of ${numShares} shares`
                  : `Transfer of ${numShares} shares to ${form.buyer_name}`,
              }).eq("id", (sellerCert as any).id);
              certActions.push(`Cancelled Cert #${(sellerCert as any).certificate_number} (${form.seller_name})`);

              // Create a Cancellation ledger entry for the seller's old cert
              await supabase.from("share_transactions").insert({
                company_id: companyId,
                transaction_type: "cancellation",
                shareholder_id: sellerSh.id,
                share_class: form.share_class,
                num_shares: (sellerCert as any).num_shares || 0,
                transaction_date: form.transaction_date,
                from_shareholder: form.seller_name,
                to_shareholder: null,
                certificate_id: null,
                transferred_certificate_id: (sellerCert as any).id,
                notes: `Cancelled Cert #${(sellerCert as any).certificate_number} — ${isRedemption ? 'treasury repurchase' : `partial transfer to ${form.buyer_name}`}`,
              });

              // Issue new cert with reduced shares if seller retains any
              const sellerHoldings = (sellerCert as any).num_shares || 0;
              const remainingShares = sellerHoldings - numShares;
              if (remainingShares > 0) {
                const newCertNum = getNextCertNum(certOffset);
                certOffset++;
                const { data: sellerNewCert } = await supabase.from("stock_certificates").insert({
                  company_id: companyId,
                  certificate_number: newCertNum,
                  shareholder_id: sellerSh.id,
                  share_class: form.share_class,
                  num_shares: remainingShares,
                  issue_date: form.transaction_date,
                  par_value: (sellerCert as any).par_value,
                }).select("id").single();

                // Create a reissuance ledger entry for the seller's new cert
                await supabase.from("share_transactions").insert({
                  company_id: companyId,
                  transaction_type: "reissuance",
                  shareholder_id: sellerSh.id,
                  share_class: form.share_class,
                  num_shares: remainingShares,
                  transaction_date: form.transaction_date,
                  from_shareholder: null,
                  to_shareholder: form.seller_name,
                  certificate_id: sellerNewCert?.id || null,
                  notes: `Reissued Cert #${newCertNum} to ${form.seller_name} for remaining ${remainingShares} shares after transfer`,
                });

                certActions.push(`Issued Cert #${newCertNum} to ${form.seller_name} for ${remainingShares} shares`);
              } else {
                // Mark shareholder as inactive if they transferred all shares
                await supabase.from("shareholders").update({ status: "inactive" }).eq("id", sellerSh.id);
                certActions.push(`${form.seller_name} marked as former shareholder (0 shares)`);
              }
            }
          }

          // Issue new cert to buyer (only for transfers, not redemptions)
          if (isTransfer && buyerSh) {
            // Cancel any existing active cert for buyer in this share class (one active cert rule)
            const buyerExistingCert = certificates.find(
              (c: any) => c.shareholder_id === buyerSh!.id && c.share_class === form.share_class && c.status === "active"
            );
            let buyerExistingShares = 0;
            if (buyerExistingCert) {
              buyerExistingShares = (buyerExistingCert as any).num_shares || 0;
              await supabase.from("stock_certificates").update({
                status: "cancelled",
                cancelled_date: form.transaction_date,
                cancelled_reason: `Consolidated — received ${numShares} shares from ${form.seller_name}`,
              }).eq("id", (buyerExistingCert as any).id);
              certActions.push(`Cancelled Cert #${(buyerExistingCert as any).certificate_number} (${form.buyer_name}) for consolidation`);
            }

            const buyerCertNum = getNextCertNum(certOffset);
            certOffset++;
            await supabase.from("stock_certificates").insert({
              company_id: companyId,
              certificate_number: buyerCertNum,
              shareholder_id: buyerSh.id,
              share_class: form.share_class,
              num_shares: numShares + buyerExistingShares,
              issue_date: form.transaction_date,
            });
            certActions.push(`Issued Cert #${buyerCertNum} to ${form.buyer_name} for ${(numShares + buyerExistingShares).toLocaleString()} shares`);
          }

          // Redemption: shares return to treasury, no cert issued to treasury
          if (isRedemption) {
            certActions.push(`${numShares.toLocaleString()} ${term.shareUnit.toLowerCase()} returned to treasury`);
          }
        }

        // For initial issuance / contribution, auto-create certificate
        if (isIssuance && buyerSh) {
          // Cancel any existing active cert for buyer in this share class (one active cert rule)
          const buyerExistingCert = certificates.find(
            (c: any) => c.shareholder_id === buyerSh!.id && c.share_class === form.share_class && c.status === "active"
          );
          let existingShares = 0;
          if (buyerExistingCert) {
            existingShares = (buyerExistingCert as any).num_shares || 0;
            await supabase.from("stock_certificates").update({
              status: "cancelled",
              cancelled_date: form.transaction_date,
              cancelled_reason: `Consolidated — additional issuance of ${numShares} shares`,
            }).eq("id", (buyerExistingCert as any).id);
            certActions.push(`Cancelled Cert #${(buyerExistingCert as any).certificate_number} for consolidation`);
          }

          const issueCertNum = getNextCertNum(certOffset);
          certOffset++;
          await supabase.from("stock_certificates").insert({
            company_id: companyId,
            certificate_number: issueCertNum,
            shareholder_id: buyerSh.id,
            share_class: form.share_class,
            num_shares: numShares + existingShares,
            issue_date: form.transaction_date,
          });
          certActions.push(`Issued Cert #${issueCertNum} to ${form.buyer_name} for ${(numShares + existingShares).toLocaleString()} ${term.shareUnit.toLowerCase()}`);
        }
      }

      // 8. Update capital account balance for LLC members
      if (isLLC) {
        const capitalDelta = totalConsideration || 0;
        if (isIssuance && buyerShId && capitalDelta > 0) {
          // Contribution increases capital account
          const { data: sh } = await supabase.from("shareholders").select("capital_account_balance").eq("id", buyerShId).single();
          const currentBalance = Number((sh as any)?.capital_account_balance || 0);
          await supabase.from("shareholders").update({ capital_account_balance: currentBalance + capitalDelta } as any).eq("id", buyerShId);
        }
        if (isRedemption && form.seller_id && capitalDelta > 0) {
          // Redemption decreases capital account
          const { data: sh } = await supabase.from("shareholders").select("capital_account_balance").eq("id", form.seller_id).single();
          const currentBalance = Number((sh as any)?.capital_account_balance || 0);
          await supabase.from("shareholders").update({ capital_account_balance: currentBalance - capitalDelta } as any).eq("id", form.seller_id);
        }
      }

      // Update transaction with denormalized cert numbers for display
      const issuedCertNum = certActions.find(a => a.includes("Issued Cert #"))?.match(/#(\d+)/)?.[1];
      const surrenderedCertNum = certActions.find(a => a.includes("Cancelled Cert #"))?.match(/#(\d+)/)?.[1];
      if (issuedCertNum || surrenderedCertNum) {
        await supabase.from("share_transactions").update({
          issued_certificate_number: issuedCertNum ? parseInt(issuedCertNum) : null,
          surrendered_certificate_number: surrenderedCertNum ? parseInt(surrenderedCertNum) : null,
        } as any).eq("id", txn.id);
      }

      // Treasury logic: flag buyer shareholder as treasury for redemptions
      if (isRedemption) {
        const treasurySh = shareholders.find(s => s.name.toLowerCase().trim() === (companyName || "treasury").toLowerCase().trim());
        if (treasurySh) {
          await supabase.from("shareholders").update({ is_treasury: true } as any).eq("id", treasurySh.id);
        }
      }

      setCertsSummary(certActions);
      setSavedIds({ transactionId: txn.id, billId: bill.id });
      setStep(3);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bills_of_sale", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });

      toast.success("Transaction recorded successfully!");
    } catch (err: any) {
      console.error("BuySellWorkflow save error:", err);
      toast.error(err.message || "Failed to save transaction");
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

            <div className={`grid ${isRedemption ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
              <div className="field-group">
                <Label className="field-label">{isIssuance ? "Issuing From (Company)" : isRedemption ? "Shareholder Selling Back" : "Seller"}</Label>
                <Input className="h-8 text-sm" value={form.seller_name} onChange={(e) => setForm(p => ({ ...p, seller_name: e.target.value, seller_id: "" }))} placeholder="Name" required />
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
                    /* Corporation: free-text + optional select */
                    <>
                      <Input className="h-8 text-sm" value={form.buyer_name} onChange={(e) => setForm(p => ({ ...p, buyer_name: e.target.value, buyer_id: "" }))} placeholder="Name" required />
                      {shareholders.length > 0 && (
                        <Select value={form.buyer_id} onValueChange={(v) => {
                          const sh = shareholders.find(s => s.id === v);
                          setForm(p => ({ ...p, buyer_id: v, buyer_name: sh?.name || p.buyer_name }));
                        }}>
                          <SelectTrigger className="h-7 text-[11px] mt-1"><SelectValue placeholder={`Link ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
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
                <Input className="h-8 text-sm" type="number" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
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
