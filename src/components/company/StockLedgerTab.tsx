import React, { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, BookOpen, Link2, Lock, Trash2, FileText, Award, RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CorrectionModal from "./CorrectionModal";
import AdminDeleteButton from "./AdminDeleteButton";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { downloadStockCertificatePdf } from "@/lib/stock-certificate-pdf";
import { downloadBillOfSalePdf } from "@/lib/bill-of-sale-pdf";

// Wisconsin statutory stock transaction types by entity type
const TRANSACTION_TYPES_BY_ENTITY: Record<string, { value: string; label: string; statute: string }[]> = {
  Corporation: [
    { value: "initial_issuance", label: "Initial Share Issuance", statute: "§ 180.0601" },
    { value: "authorized_issuance", label: "Authorized Share Issuance", statute: "§ 180.0602" },
    { value: "subscription_issuance", label: "Share Subscription", statute: "§ 180.0620" },
    { value: "consideration_issuance", label: "Issuance for Consideration", statute: "§ 180.0621" },
    { value: "share_dividend", label: "Share Dividend / Stock Split", statute: "§ 180.0623" },
    { value: "fractional_shares", label: "Fractional Shares", statute: "§ 180.0604" },
    { value: "transfer", label: "Share Transfer", statute: "§ 180.0627" },
    { value: "share_exchange", label: "Share Exchange", statute: "§ 180.1102" },
    { value: "redemption", label: "Share Redemption", statute: "§ 180.0631" },
    { value: "reacquisition", label: "Corporation Reacquisition", statute: "§ 180.0631" },
    { value: "cancellation", label: "Share Cancellation", statute: "§ 180.0631" },
    { value: "conversion", label: "Share Conversion", statute: "§ 180.0604" },
    { value: "treasury_acquisition", label: "Treasury Share Acquisition", statute: "§ 180.0631" },
    { value: "treasury_reissue", label: "Treasury Share Reissue", statute: "§ 180.0631" },
    { value: "preemptive_rights", label: "Preemptive Rights Issuance", statute: "§ 180.0630" },
    { value: "gift", label: "Gift / Donation of Shares", statute: "§ 180.0621" },
  ],
  "S-Corp": [
    { value: "initial_issuance", label: "Initial Share Issuance", statute: "§ 180.0601 / IRC § 1361" },
    { value: "authorized_issuance", label: "Authorized Share Issuance", statute: "§ 180.0602 / IRC § 1361(b)" },
    { value: "subscription_issuance", label: "Share Subscription", statute: "§ 180.0620" },
    { value: "consideration_issuance", label: "Issuance for Consideration", statute: "§ 180.0621" },
    { value: "transfer", label: "Share Transfer", statute: "§ 180.0627 / IRC § 1361(b)(1)" },
    { value: "redemption", label: "Share Redemption", statute: "§ 180.0631 / IRC § 302" },
    { value: "reacquisition", label: "Corporation Reacquisition", statute: "§ 180.0631 / IRC § 302" },
    { value: "cancellation", label: "Share Cancellation", statute: "§ 180.0631" },
    { value: "distribution", label: "S-Corp Distribution", statute: "IRC § 1368" },
    { value: "gift", label: "Gift / Donation of Shares", statute: "§ 180.0621 / IRC § 1361(b)(1)" },
  ],
  LLC: [
    { value: "initial_contribution", label: "Initial Capital Contribution", statute: "§ 183.0401" },
    { value: "additional_contribution", label: "Additional Contribution", statute: "§ 183.0401" },
    { value: "membership_issuance", label: "Membership Interest Issuance", statute: "§ 183.0501" },
    { value: "interest_transfer", label: "Transfer of Membership Interest", statute: "§ 183.0706" },
    { value: "interest_assignment", label: "Assignment of Interest", statute: "§ 183.0706" },
    { value: "distribution", label: "Distribution to Members", statute: "§ 183.0404" },
    { value: "interim_distribution", label: "Interim Distribution", statute: "§ 183.0404" },
    { value: "withdrawal_distribution", label: "Withdrawal Distribution", statute: "§ 183.0602" },
    { value: "redemption", label: "Interest Redemption", statute: "§ 183.0602" },
    { value: "dissociation_buyout", label: "Dissociation Buyout", statute: "§ 183.0701" },
    { value: "gift", label: "Gift of Membership Interest", statute: "§ 183.0706" },
  ],
  "Single Member LLC": [
    { value: "initial_contribution", label: "Initial Capital Contribution", statute: "§ 183.0401" },
    { value: "additional_contribution", label: "Additional Contribution", statute: "§ 183.0401" },
    { value: "membership_issuance", label: "Membership Interest Issuance", statute: "§ 183.0501" },
    { value: "interest_transfer", label: "Transfer of Membership Interest", statute: "§ 183.0706" },
    { value: "interest_assignment", label: "Assignment of Interest", statute: "§ 183.0706" },
    { value: "distribution", label: "Distribution to Members", statute: "§ 183.0404" },
    { value: "interim_distribution", label: "Interim Distribution", statute: "§ 183.0404" },
    { value: "withdrawal_distribution", label: "Withdrawal Distribution", statute: "§ 183.0602" },
    { value: "redemption", label: "Interest Redemption", statute: "§ 183.0602" },
    { value: "dissociation_buyout", label: "Dissociation Buyout", statute: "§ 183.0701" },
    { value: "gift", label: "Gift of Membership Interest", statute: "§ 183.0706" },
  ],
  "LLC-S": [
    { value: "initial_contribution", label: "Initial Capital Contribution", statute: "§ 183.0401 / IRC § 1361" },
    { value: "additional_contribution", label: "Additional Contribution", statute: "§ 183.0401" },
    { value: "membership_issuance", label: "Membership Interest Issuance", statute: "§ 183.0501" },
    { value: "interest_transfer", label: "Transfer of Membership Interest", statute: "§ 183.0706 / IRC § 1361(b)" },
    { value: "interest_assignment", label: "Assignment of Interest", statute: "§ 183.0706" },
    { value: "distribution", label: "S-Corp Distribution to Members", statute: "§ 183.0404 / IRC § 1368" },
    { value: "interim_distribution", label: "Interim Distribution", statute: "§ 183.0404" },
    { value: "withdrawal_distribution", label: "Withdrawal Distribution", statute: "§ 183.0602" },
    { value: "redemption", label: "Interest Redemption", statute: "§ 183.0602 / IRC § 302" },
    { value: "dissociation_buyout", label: "Dissociation Buyout", statute: "§ 183.0701" },
    { value: "gift", label: "Gift of Membership Interest", statute: "§ 183.0706 / IRC § 1361(b)(1)" },
  ],
};

const DEFAULT_TRANSACTION_TYPES = [
  { value: "issuance", label: "Issuance", statute: "" },
  { value: "transfer", label: "Transfer", statute: "" },
  { value: "redemption", label: "Redemption", statute: "" },
  { value: "cancellation", label: "Cancellation", statute: "" },
  { value: "distribution", label: "Distribution", statute: "" },
  { value: "gift", label: "Gift", statute: "" },
];

const CONSIDERATION_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "property", label: "Property" },
  { value: "services", label: "Services" },
  { value: "promissory_note", label: "Promissory Note" },
  { value: "other", label: "Other" },
];

interface Props {
  companyId: string;
  entityType?: string;
}

export default function StockLedgerTab({ companyId, entityType = "Corporation" }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<any>(null);
  const [correctionEntryNum, setCorrectionEntryNum] = useState<number | undefined>();
  const transactionTypes = TRANSACTION_TYPES_BY_ENTITY[entityType] || DEFAULT_TRANSACTION_TYPES;
  const term = getTerminology(entityType);

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: company } = useQuery({
    queryKey: ["company-ledger", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("name, par_value, par_value_type, authorized_shares, state_of_incorporation").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates_ledger", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_certificates").select("*").eq("company_id", companyId).order("certificate_number");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["share_transactions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const defaultTxType = transactionTypes[0]?.value || "issuance";

  const [form, setForm] = useState({
    transaction_type: defaultTxType,
    shareholder_id: "",
    share_class: "Common",
    num_shares: "",
    price_per_share: "",
    total_consideration: "",
    consideration_type: "cash",
    transaction_date: new Date().toISOString().split("T")[0],
    from_shareholder: "",
    to_shareholder: "",
    notes: "",
    par_value: "",
    issued_certificate_number: "",
    surrendered_certificate_number: "",
  });

  // Auto-calculate total consideration when shares or price changes
  const updateTotal = (numShares: string, pricePerShare: string) => {
    const shares = parseFloat(numShares);
    const price = parseFloat(pricePerShare);
    if (!isNaN(shares) && !isNaN(price)) {
      return (shares * price).toFixed(2);
    }
    return "";
  };

  const [assets, setAssets] = useState<{ description: string; value: string }[]>([]);

  const ISSUANCE_SET = new Set([
    "initial_issuance", "authorized_issuance", "subscription_issuance",
    "consideration_issuance", "share_dividend", "fractional_shares",
    "preemptive_rights", "treasury_reissue", "reissuance",
    "Capital Contribution", "Initial Contribution", "initial_contribution",
    "additional_contribution", "membership_issuance", "Issuance",
  ]);
  const TRANSFER_SET_LOCAL = new Set(["transfer", "interest_transfer", "interest_assignment", "gift", "share_exchange"]);

  const add = useMutation({
    mutationFn: async () => {
      const txType = form.transaction_type;
      const numShares = parseFloat(form.num_shares) || 0;
      const parValText = form.par_value?.trim().toLowerCase();
      const isNoParValue = parValText && isNaN(parseFloat(parValText));
      const parVal = isNoParValue ? null : (form.par_value ? parseFloat(form.par_value) : null);
      const issuedCertNum: number | null = form.issued_certificate_number ? parseInt(form.issued_certificate_number) : null;
      const surrenderedCertNum: number | null = form.surrendered_certificate_number ? parseInt(form.surrendered_certificate_number) : null;

      const { data: txn, error } = await supabase.from("share_transactions").insert({
        company_id: companyId,
        transaction_type: txType,
        shareholder_id: form.shareholder_id || null,
        share_class: form.share_class,
        num_shares: numShares,
        price_per_share: form.price_per_share ? parseFloat(form.price_per_share) : null,
        total_consideration: form.total_consideration ? parseFloat(form.total_consideration) : null,
        consideration_type: form.consideration_type,
        transaction_date: form.transaction_date,
        from_shareholder: form.from_shareholder || null,
        to_shareholder: form.to_shareholder || null,
        notes: isNoParValue 
          ? [form.notes, `Par Value: ${form.par_value.trim()}`].filter(Boolean).join(" | ") 
          : (form.notes || null),
        par_value: parVal,
        issued_certificate_number: issuedCertNum,
        surrendered_certificate_number: surrenderedCertNum,
        certificate_id: null,
      } as any).select("id").single();
      if (error) throw error;

      // Save transaction assets if any
      if (assets.length > 0 && txn) {
        const assetRows = assets
          .filter(a => a.description.trim())
          .map(a => ({
            transaction_id: txn.id,
            company_id: companyId,
            description: a.description,
            value: parseFloat(a.value) || 0,
          }));
        if (assetRows.length > 0) {
          const { error: assetErr } = await supabase.from("transaction_assets" as any).insert(assetRows as any);
          if (assetErr) console.error("Failed to save assets:", assetErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates_ledger", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-authorized-shares", companyId] });
      setDialog(false);
      resetForm();
      toast.success("Transaction recorded!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({
      transaction_type: defaultTxType, shareholder_id: "", share_class: "Common",
      num_shares: "", price_per_share: "", total_consideration: "",
      consideration_type: "cash", transaction_date: new Date().toISOString().split("T")[0],
      from_shareholder: "", to_shareholder: "", notes: "",
      par_value: "", issued_certificate_number: "", surrendered_certificate_number: "",
    });
    setAssets([]);
  };

  const isTransfer = ["transfer", "interest_transfer", "interest_assignment", "share_exchange"].includes(form.transaction_type);
  const showAssetGrid = ["property", "other", "services"].includes(form.consideration_type);
  const assetTotal = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);

  const handlePrintCertificate = async (t: any) => {
    const certNum = (t as any).issued_certificate_number;
    const cert = certNum ? certificates.find((c: any) => c.certificate_number === certNum) : 
                 t.certificate_id ? certificates.find((c: any) => c.id === t.certificate_id) : null;
    if (!cert && !certNum) { toast.error("No certificate linked to this transaction."); return; }
    await downloadStockCertificatePdf({
      companyName: company?.name || "",
      stateOfIncorporation: company?.state_of_incorporation || undefined,
      certificateNumber: certNum || (cert as any)?.certificate_number || 0,
      shareholderName: t.shareholders?.name || t.to_shareholder || "",
      numShares: t.num_shares || 0,
      shareClass: t.share_class || "Common",
      parValue: (t as any).par_value || (cert as any)?.par_value || company?.par_value,
      issueDate: t.transaction_date || new Date().toISOString().split("T")[0],
      authorizedShares: company?.authorized_shares,
    });
  };

  const handlePrintBillOfSale = (t: any) => {
    downloadBillOfSalePdf({
      companyName: company?.name || "",
      sellerName: t.from_shareholder || t.shareholders?.name || "",
      buyerName: t.to_shareholder || "",
      numShares: t.num_shares || 0,
      shareClass: t.share_class || "Common",
      pricePerShare: t.price_per_share,
      totalPrice: t.total_consideration,
      saleDate: t.transaction_date || new Date().toISOString().split("T")[0],
      considerationType: t.consideration_type,
      certificateNumber: (t as any).issued_certificate_number,
    });
  };

  const statuteDescription = isLLCType(entityType)
    ? "Wis. Stat. Ch. 183 — Uniform Limited Liability Company Law"
    : entityType === "S-Corp"
    ? "Wis. Stat. Ch. 180 / IRC Subchapter S — S-Corporation share transactions"
    : "Wis. Stat. § 180.0601 / § 180.0621 — Shares may not be issued until articles filed; consideration must be received";

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">
              {term.ledgerTitle}
            </CardTitle>
            <span title="Permanent record — entries cannot be edited or deleted"><Lock className="h-3 w-3 text-muted-foreground" /></span>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            {statuteDescription}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions config={{
            title: term.ledgerTitle,
            companyName: "",
            statuteRef: statuteDescription,
            landscape: true,
            table: {
              headers: ["#", "Date", "Type", term.shareholder, term.classLabel, term.shareUnit, "Par Value", term.pricePerUnit, "Total", "Consideration", "Cert #", "Notes"],
              rows: (() => {
                const sorted = [...transactions].sort((a, b) =>
                  (a.transaction_date || "").localeCompare(b.transaction_date || "") || (a.created_at || "").localeCompare(b.created_at || "")
                );
                return sorted.map((t: any, i: number) => [
                  String(i + 1),
                  t.transaction_date ? new Date(t.transaction_date + "T00:00:00").toLocaleDateString() : "—",
                  t.transaction_type?.replace("_", " ") ?? "—",
                  t.shareholders?.name ?? "—",
                  t.share_class,
                  t.num_shares?.toLocaleString(),
                  t.par_value != null ? `$${Number(t.par_value).toFixed(2)}` : (company?.par_value_type === "no_par" ? "No Par Value" : "—"),
                  t.price_per_share != null ? `$${Number(t.price_per_share).toFixed(2)}` : "—",
                  t.total_consideration != null ? `$${Number(t.total_consideration).toFixed(2)}` : "—",
                  t.consideration_type ?? "—",
                  [t.issued_certificate_number ? `Issued #${t.issued_certificate_number}` : "", t.surrendered_certificate_number ? `Surr #${t.surrendered_certificate_number}` : ""].filter(Boolean).join(", ") || "—",
                  t.notes ?? "",
                ]);
              })(),
              noteRows: (() => {
                const sorted = [...transactions].sort((a, b) =>
                  (a.transaction_date || "").localeCompare(b.transaction_date || "") || (a.created_at || "").localeCompare(b.created_at || "")
                );
                const notes: Record<number, string> = {};
                sorted.forEach((t: any, i: number) => {
                  if (t.transaction_type === "correction" && (t as any).correction_memo) {
                    notes[i] = (t as any).correction_memo;
                  }
                });
                return notes;
              })(),
            },
          }} />
          <Dialog open={dialog} onOpenChange={(open) => { setDialog(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resetForm()}>
                <Plus className="mr-1 h-3 w-3" /> Record Transaction
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-base">{term.isLLC ? "Record Interest Transaction" : "Record Share Transaction"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">Transaction Type</Label>
                  <Select value={form.transaction_type} onValueChange={(v) => setForm(p => ({ ...p, transaction_type: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <span>{t.label}</span>
                          {t.statute && <span className="ml-1.5 text-muted-foreground text-[10px]">({t.statute})</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Date</Label>
                  <DatePickerField value={form.transaction_date} onChange={(v) => setForm(p => ({ ...p, transaction_date: v }))} />
                </div>
              </div>
              <div className="field-group">
                  <Label className="field-label">{term.shareholder}</Label>
                  <Select value={form.shareholder_id} onValueChange={(v) => setForm(p => ({ ...p, shareholder_id: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={`Select ${term.shareholder.toLowerCase()}`} /></SelectTrigger>
                  <SelectContent>
                    {shareholders.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isTransfer && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">From</Label>
                    <Input className="h-8 text-sm" value={form.from_shareholder} onChange={(e) => setForm(p => ({ ...p, from_shareholder: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">To</Label>
                    <Input className="h-8 text-sm" value={form.to_shareholder} onChange={(e) => setForm(p => ({ ...p, to_shareholder: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 gap-2">
                <div className="field-group">
                  <Label className="field-label">{term.classLabel}</Label>
                  <Select value={form.share_class} onValueChange={(v) => setForm(p => ({ ...p, share_class: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {term.classOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.numUnitsLabel}</Label>
                  <Input className="h-8 text-sm" type="number" step="0.0001" value={form.num_shares} onChange={(e) => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, num_shares: val, total_consideration: updateTotal(val, p.price_per_share) || p.total_consideration }));
                  }} required />
                </div>
                <div className="field-group">
                  <Label className="field-label">Par Value</Label>
                  <Input className="h-8 text-sm" type="text" value={form.par_value} onChange={(e) => setForm(p => ({ ...p, par_value: e.target.value }))} placeholder={company?.par_value ? `$${company.par_value}` : "e.g. 1.00 or No Par Value"} />
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.pricePerUnit}</Label>
                  <Input className="h-8 text-sm" type="number" step="0.01" value={form.price_per_share} onChange={(e) => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, price_per_share: val, total_consideration: updateTotal(p.num_shares, val) || p.total_consideration }));
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">Total Consideration</Label>
                  <Input className="h-8 text-sm" type="number" step="0.01" value={form.total_consideration} onChange={(e) => setForm(p => ({ ...p, total_consideration: e.target.value }))} />
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

              {/* Certificate Number Fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="field-group">
                  <Label className="field-label">Issued Cert #</Label>
                  <Input className="h-8 text-sm" type="number" value={form.issued_certificate_number} onChange={(e) => setForm(p => ({ ...p, issued_certificate_number: e.target.value }))} placeholder="Auto or manual" />
                </div>
                <div className="field-group">
                  <Label className="field-label">Surrendered Cert #</Label>
                  <Input className="h-8 text-sm" type="number" value={form.surrendered_certificate_number} onChange={(e) => setForm(p => ({ ...p, surrendered_certificate_number: e.target.value }))} placeholder="If applicable" />
                </div>
              </div>

              {/* Asset Grid for Property / Other consideration */}
              {showAssetGrid && (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="field-label font-semibold">Non-Cash Assets</Label>
                    <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAssets(prev => [...prev, { description: "", value: "" }])}>
                      <Plus className="h-2.5 w-2.5 mr-1" /> Add Asset
                    </Button>
                  </div>
                  {assets.length === 0 && (
                    <p className="text-[10px] text-muted-foreground">Click "Add Asset" to list non-cash consideration items.</p>
                  )}
                  {assets.map((asset, i) => (
                    <div key={i} className="grid grid-cols-[1fr_100px_28px] gap-1.5 items-end">
                      <Input className="h-7 text-xs" placeholder="Description" value={asset.description} onChange={(e) => {
                        const updated = [...assets];
                        updated[i] = { ...updated[i], description: e.target.value };
                        setAssets(updated);
                      }} />
                      <Input className="h-7 text-xs" type="number" step="0.01" placeholder="Value" value={asset.value} onChange={(e) => {
                        const updated = [...assets];
                        updated[i] = { ...updated[i], value: e.target.value };
                        setAssets(updated);
                      }} />
                      <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAssets(prev => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {assets.length > 0 && (
                    <div className="text-right text-xs font-semibold text-foreground">
                      Asset Total: ${assetTotal.toFixed(2)}
                    </div>
                  )}
                </div>
              )}

              <div className="field-group">
                <Label className="field-label">Notes</Label>
                <Textarea className="text-sm min-h-[50px]" rows={2} value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <Button type="submit" className="w-full" size="sm" disabled={add.isPending}>
                {add.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Record Transaction
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No transactions recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase w-10">#</TableHead>
                  <TableHead className="text-[10px] uppercase">Date</TableHead>
                  <TableHead className="text-[10px] uppercase">Type</TableHead>
                  <TableHead className="text-[10px] uppercase">{term.shareholder}</TableHead>
                  <TableHead className="text-[10px] uppercase">{term.classLabel}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.shareUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Par</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.dollarPerUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Total</TableHead>
                  <TableHead className="text-[10px] uppercase">Consideration</TableHead>
                  <TableHead className="text-[10px] uppercase text-center">Cert #</TableHead>
                  <TableHead className="text-[10px] uppercase text-right bg-primary/5">Running Balance</TableHead>
                  <TableHead className="text-[10px] uppercase w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Compute per-shareholder running balance chronologically
                  const sorted = [...transactions].sort((a, b) =>
                    (a.transaction_date || "").localeCompare(b.transaction_date || "") || (a.created_at || "").localeCompare(b.created_at || "")
                  );
                  const balances: Record<string, number> = {};
                  const balanceMap = new Map<string, number>();
                  const entryNumMap = new Map<string, number>();

                  const TRANSFER_SET = new Set(["transfer", "interest_transfer", "interest_assignment", "share_exchange", "gift"]);
                  const REDUCTION_SET = new Set(["redemption", "reacquisition", "cancellation", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout"]);

                  // Map corrected_by_id to correction entry number for cross-referencing
                  const correctedByMap = new Map<string, string>();

                  sorted.forEach((t: any, idx: number) => {
                    entryNumMap.set(t.id, idx + 1);
                  });

                  // Build correction cross-reference maps
                  sorted.forEach((t: any) => {
                    if ((t as any).corrected_by_id) {
                      correctedByMap.set(t.id, String(entryNumMap.get((t as any).corrected_by_id) || "?"));
                    }
                  });

                  sorted.forEach((t: any) => {
                    const shName = (t.shareholders?.name || "").toLowerCase().trim();

                    // Skip corrected entries from balance accumulation
                    if ((t as any).status === "corrected") {
                      balanceMap.set(t.id, balances[shName || (t.to_shareholder || "unknown").toLowerCase().trim()] || 0);
                      return;
                    }

                    if (REDUCTION_SET.has(t.transaction_type)) {
                      const key = shName || (t.from_shareholder || "unknown").toLowerCase().trim();
                      balances[key] = (balances[key] || 0) - (t.num_shares || 0);
                      balanceMap.set(t.id, Math.max(0, balances[key]));
                    } else if (t.transaction_type === "correction") {
                      // Correction entries reverse the original — treat as reduction from the original holder
                      const key = (t.from_shareholder || shName || "unknown").toLowerCase().trim();
                      balances[key] = (balances[key] || 0) - (t.num_shares || 0);
                      balanceMap.set(t.id, Math.max(0, balances[key]));
                    } else if (t.transaction_type === "reissuance") {
                      const key = shName || (t.to_shareholder || "unknown").toLowerCase().trim();
                      balances[key] = (balances[key] || 0) + (t.num_shares || 0);
                      balanceMap.set(t.id, Math.max(0, balances[key]));
                    } else if (TRANSFER_SET.has(t.transaction_type)) {
                      const buyerKey = (t.to_shareholder || shName || "unknown").toLowerCase().trim();
                      balances[buyerKey] = (balances[buyerKey] || 0) + (t.num_shares || 0);
                      balanceMap.set(t.id, Math.max(0, balances[buyerKey]));
                    } else {
                      const key = shName || (t.to_shareholder || "unknown").toLowerCase().trim();
                      balances[key] = (balances[key] || 0) + (t.num_shares || 0);
                      balanceMap.set(t.id, Math.max(0, balances[key]));
                    }
                  });

                  // Display in reverse chronological order (original order)
                  return transactions.map((t: any) => {
                    const txStatus = (t as any).status || "active";
                    const isCorrected = txStatus === "corrected";
                    const isCorrection = t.transaction_type === "correction";
                    const correctsEntryNum = isCorrection && (t as any).corrects_id ? entryNumMap.get((t as any).corrects_id) : null;
                    const correctedByEntryNum = isCorrected ? correctedByMap.get(t.id) : null;
                    const correctionMemo = (t as any).correction_memo || null;

                    return (
                    <React.Fragment key={t.id}>
                    <TableRow className={isCorrected ? "opacity-50" : ""}>
                      <TableCell className="text-xs font-mono text-muted-foreground">{entryNumMap.get(t.id)}</TableCell>
                      <TableCell className={`text-xs ${isCorrected ? "line-through" : ""}`}>{t.transaction_date ? new Date(t.transaction_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${isCorrected ? "line-through" : ""}`}>{t.transaction_type?.replace(/_/g, " ")}</Badge>
                          {isCorrected && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">Corrected</Badge>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">See entry #{correctedByEntryNum || "?"}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {isCorrection && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge className="text-[9px] px-1 py-0 bg-accent text-accent-foreground">Correction</Badge>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Corrects entry #{correctsEntryNum || "?"}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`text-xs ${isCorrected ? "line-through" : ""}`}>{t.shareholders?.name ?? t.to_shareholder ?? "—"}</TableCell>
                      <TableCell className={`text-xs ${isCorrected ? "line-through" : ""}`}>{t.share_class}</TableCell>
                      <TableCell className={`text-xs text-right ${isCorrected ? "line-through" : ""}`}>{t.num_shares?.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right">{(t as any).par_value != null ? `$${Number((t as any).par_value).toFixed(2)}` : (company?.par_value_type === "no_par" ? "No Par Value" : "—")}</TableCell>
                      <TableCell className="text-xs text-right">{t.price_per_share != null ? `$${Number(t.price_per_share).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs text-right">{t.total_consideration != null ? `$${Number(t.total_consideration).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{t.consideration_type?.replace("_", " ") ?? "—"}</TableCell>
                      <TableCell className="text-xs text-center">
                        {(t as any).issued_certificate_number && <span className="text-primary">#{(t as any).issued_certificate_number}</span>}
                        {(t as any).surrendered_certificate_number && <span className="text-destructive ml-1">✕#{(t as any).surrendered_certificate_number}</span>}
                        {!(t as any).issued_certificate_number && !(t as any).surrendered_certificate_number && "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold bg-primary/5">{balanceMap.get(t.id)?.toLocaleString() ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {txStatus === "active" && !isCorrection && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Correct this transaction"
                              onClick={() => { setCorrectionTarget(t); setCorrectionEntryNum(entryNumMap.get(t.id)); }}>
                              <RotateCcw className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </Button>
                          )}
                          <AdminDeleteButton transaction={t} companyId={companyId} />
                          {t.bill_of_sale_id && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Print Bill of Sale" onClick={() => handlePrintBillOfSale(t)}>
                              <FileText className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                          {((t as any).issued_certificate_number || t.certificate_id) && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Print Certificate" onClick={() => handlePrintCertificate(t)}>
                              <Award className="h-3 w-3 text-primary" />
                            </Button>
                          )}
                          {txStatus === "active" && !isCorrection && !t.bill_of_sale_id && !(t as any).issued_certificate_number && !t.certificate_id && (
                            <span aria-label="No linked documents">
                              <Link2 className="h-3 w-3 text-muted-foreground/40" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {isCorrection && correctionMemo && (
                      <TableRow className="border-t-0 hover:bg-transparent">
                        <TableCell colSpan={14} className="py-1 px-4 pl-12 border-t-0">
                          <p className="text-[10px] italic text-muted-foreground">
                            Correction Note: {correctionMemo}
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          This is a permanent record. Entries cannot be edited or deleted. Corrections are made by adding new entries.
        </p>
      </CardContent>

      <CorrectionModal
        open={!!correctionTarget}
        onOpenChange={(o) => { if (!o) { setCorrectionTarget(null); setCorrectionEntryNum(undefined); } }}
        transaction={correctionTarget}
        companyId={companyId}
        entryNum={correctionEntryNum}
      />
    </Card>
  );
}
