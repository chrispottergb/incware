import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Link2, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";

const TRANSACTION_TYPES_BY_ENTITY: Record<string, { value: string; label: string }[]> = {
  Corporation: [
    { value: "transfer", label: "Share Transfer" },
    { value: "redemption", label: "Share Redemption" },
    { value: "share_exchange", label: "Share Exchange" },
    { value: "gift", label: "Gift / Donation of Shares" },
  ],
  "S-Corp": [
    { value: "transfer", label: "Share Transfer" },
    { value: "redemption", label: "Share Redemption" },
    { value: "gift", label: "Gift / Donation of Shares" },
  ],
  LLC: [
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
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  entityType: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BuySellWorkflow({ companyId, entityType, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const isLLC = isLLCType(entityType);
  const transactionTypes = TRANSACTION_TYPES_BY_ENTITY[entityType] || TRANSACTION_TYPES_BY_ENTITY["Corporation"];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<{ transactionId: string; billId: string } | null>(null);

  const [form, setForm] = useState({
    transaction_type: transactionTypes[0]?.value || "transfer",
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
  });

  const resetAll = () => {
    setStep(1);
    setSavedIds(null);
    setForm({
      transaction_type: transactionTypes[0]?.value || "transfer",
      seller_name: "", seller_id: "", buyer_name: "", buyer_id: "",
      share_class: term.defaultClass, num_shares: "", price_per_share: "",
      total_consideration: "", consideration_type: "cash",
      transaction_date: new Date().toISOString().split("T")[0],
    });
  };

  const numShares = parseInt(form.num_shares) || 0;
  const pricePerShare = parseFloat(form.price_per_share) || 0;
  const autoTotal = numShares * pricePerShare;
  const totalConsideration = form.total_consideration ? parseFloat(form.total_consideration) : (autoTotal || null);

  const canProceedStep1 = form.seller_name && form.buyer_name && numShares > 0 && form.transaction_date;

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Insert share_transaction
      const { data: txn, error: txnErr } = await supabase.from("share_transactions").insert({
        company_id: companyId,
        transaction_type: form.transaction_type,
        shareholder_id: form.buyer_id || null,
        share_class: form.share_class,
        num_shares: numShares,
        price_per_share: pricePerShare || null,
        total_consideration: totalConsideration,
        consideration_type: form.consideration_type,
        transaction_date: form.transaction_date,
        from_shareholder: form.seller_name,
        to_shareholder: form.buyer_name,
      }).select("id").single();
      if (txnErr) throw txnErr;

      // 2. Insert bill_of_sale with transaction link
      const { data: bill, error: billErr } = await supabase.from("bills_of_sale").insert({
        company_id: companyId,
        seller_name: form.seller_name,
        buyer_name: form.buyer_name,
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

      // 4. For LLCs, recalculate ownership percentages
      if (isLLC) {
        await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
      }

      setSavedIds({ transactionId: txn.id, billId: bill.id });
      setStep(3);

      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["bills_of_sale", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });

      toast.success("Transaction and bill of sale recorded successfully!");
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
            {term.isLLC ? "Buy / Sell Membership Interest" : "Buy / Sell Shares"}
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
                <Label className="field-label">Seller</Label>
                <Input className="h-8 text-sm" value={form.seller_name} onChange={(e) => setForm(p => ({ ...p, seller_name: e.target.value }))} placeholder="Name" required />
                {shareholders.length > 0 && (
                  <Select value={form.seller_id} onValueChange={(v) => {
                    const sh = shareholders.find(s => s.id === v);
                    setForm(p => ({ ...p, seller_id: v, seller_name: sh?.name || p.seller_name }));
                  }}>
                    <SelectTrigger className="h-7 text-[11px] mt-1"><SelectValue placeholder={`Link ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="field-group">
                <Label className="field-label">Buyer</Label>
                <Input className="h-8 text-sm" value={form.buyer_name} onChange={(e) => setForm(p => ({ ...p, buyer_name: e.target.value }))} placeholder="Name" required />
                {shareholders.length > 0 && (
                  <Select value={form.buyer_id} onValueChange={(v) => {
                    const sh = shareholders.find(s => s.id === v);
                    setForm(p => ({ ...p, buyer_id: v, buyer_name: sh?.name || p.buyer_name }));
                  }}>
                    <SelectTrigger className="h-7 text-[11px] mt-1"><SelectValue placeholder={`Link ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>{shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>

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
                <Label className="field-label">Total Consideration</Label>
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
                <span className="text-muted-foreground">Seller:</span>
                <span className="font-medium">{form.seller_name}</span>
                <span className="text-muted-foreground">Buyer:</span>
                <span className="font-medium">{form.buyer_name}</span>
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
              {isLLC && <p className="flex items-center gap-1.5"><Link2 className="h-3 w-3 text-primary" /> Updated ownership percentages</p>}
              <p className="text-muted-foreground mt-1">Both records will be linked to each other for audit integrity.</p>
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

        {/* Step 3: Success + Certificate Prompt */}
        {step === 3 && (
          <div className="space-y-4 text-center py-2">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="text-sm font-medium">Transaction Recorded Successfully</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ledger entry and bill of sale have been created and linked.
              </p>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs text-left">
              <p className="font-medium mb-1">Would you like to update certificates?</p>
              <p className="text-muted-foreground">
                You may want to cancel the seller's certificate and issue a new one to the buyer.
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={handleClose}>
                Skip for Now
              </Button>
              <Button size="sm" onClick={() => {
                handleClose();
                // Navigate to certificates section by scrolling
                setTimeout(() => {
                  const certSection = document.querySelector('[data-section="certificates"]');
                  certSection?.scrollIntoView({ behavior: "smooth" });
                }, 400);
              }}>
                Update Certificates
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
