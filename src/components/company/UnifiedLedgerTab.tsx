import { useState } from "react";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ScrollText, Lock, Trash2, FileText, Award, Link2 } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";
import { downloadStockCertificatePdf } from "@/lib/stock-certificate-pdf";
import { downloadBillOfSalePdf } from "@/lib/bill-of-sale-pdf";

const ISSUANCE_TYPES = [
  "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
  "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
  "treasury_reissue", "reissuance", "Capital Contribution", "Initial Contribution", "initial_contribution",
  "additional_contribution", "membership_issuance",
];

const REDUCTION_TYPES = [
  "Redemption", "redemption", "Cancellation", "cancellation", "Return of Capital",
  "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
];

const TRANSFER_TYPES = [
  "transfer", "interest_transfer", "interest_assignment", "gift",
  "share_exchange", "Transfer In", "Transfer Out",
];

const LLC_TRANSACTION_TYPES = [
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
  authorizedShares?: number | null;
}

interface UnifiedEntry {
  entryNum: number;
  date: string;
  type: string;
  transferee: string;
  transferor: string;
  interestType: string;
  certIssued: string;
  certCancelled: string;
  unitsIssued: number;
  unitsCancelled: number;
  toTreasury: number;
  parValue: string;
  pricePerUnit: string;
  total: string;
  consideration: string;
  shBalance: number;
  ownershipPct: number | null;
  treasuryBalance: number;
  notes: string;
  id: string;
  raw: any;
}

export default function UnifiedLedgerTab({ companyId, entityType = "LLC", authorizedShares }: Props) {
  const queryClient = useQueryClient();
  const term = getTerminology(entityType);
  const [dialog, setDialog] = useState(false);

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
      const { data, error } = await supabase.from("companies").select("name, par_value, authorized_shares, state_of_incorporation").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_certificates").select("*, shareholders(name)").eq("company_id", companyId).order("certificate_number");
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
        .order("transaction_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Form state
  const [form, setForm] = useState({
    transaction_type: "initial_contribution",
    shareholder_id: "",
    share_class: "Membership",
    num_shares: "",
    price_per_share: "",
    total_consideration: "",
    consideration_type: "cash",
    transaction_date: new Date().toISOString().split("T")[0],
    from_shareholder: "",
    to_shareholder: "",
    notes: "",
    issued_certificate_number: "",
    surrendered_certificate_number: "",
  });

  const [assets, setAssets] = useState<{ description: string; value: string }[]>([]);

  const getNextCertNumber = async (): Promise<number> => {
    const { data } = await supabase
      .from("stock_certificates")
      .select("certificate_number")
      .eq("company_id", companyId)
      .order("certificate_number", { ascending: false })
      .limit(1);
    return ((data?.[0] as any)?.certificate_number || 0) + 1;
  };

  const createCertificate = async (certNumber: number, shareholderId: string | null, numShares: number, shareClass: string, issueDate: string) => {
    const { data, error } = await supabase.from("stock_certificates").insert({
      company_id: companyId,
      certificate_number: certNumber,
      shareholder_id: shareholderId,
      num_shares: numShares,
      share_class: shareClass,
      issue_date: issueDate,
      status: "active",
    }).select("id").single();
    if (error) throw error;
    return data;
  };

  const ISSUANCE_SET_LOCAL = new Set([
    "initial_contribution", "additional_contribution", "membership_issuance",
    "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
    "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
    "treasury_reissue", "reissuance", "Capital Contribution", "Initial Contribution",
  ]);
  const TRANSFER_SET_LOCAL = new Set(["transfer", "interest_transfer", "interest_assignment", "gift", "share_exchange"]);

  const add = useMutation({
    mutationFn: async () => {
      const txType = form.transaction_type;
      const numShares = parseFloat(form.num_shares) || 0;
      let issuedCertNum: number | null = form.issued_certificate_number ? parseInt(form.issued_certificate_number) : null;
      let surrenderedCertNum: number | null = form.surrendered_certificate_number ? parseInt(form.surrendered_certificate_number) : null;
      let certId: string | null = null;

      // Auto-issue certificate for issuance/transfer/reissuance types
      if (!issuedCertNum && (ISSUANCE_SET_LOCAL.has(txType) || TRANSFER_SET_LOCAL.has(txType))) {
        const nextNum = await getNextCertNumber();
        const shareholderId = TRANSFER_SET_LOCAL.has(txType)
          ? (shareholders.find(s => s.name === form.to_shareholder)?.id || form.shareholder_id || null)
          : (form.shareholder_id || null);
        const cert = await createCertificate(nextNum, shareholderId, numShares, form.share_class, form.transaction_date);
        issuedCertNum = nextNum;
        certId = cert.id;
      }

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
        notes: form.notes || null,
        par_value: null,
        issued_certificate_number: issuedCertNum,
        surrendered_certificate_number: surrenderedCertNum,
        certificate_id: certId,
      } as any).select("id").single();
      if (error) throw error;

      if (assets.length > 0 && txn) {
        const assetRows = assets.filter(a => a.description.trim()).map(a => ({
          transaction_id: txn.id, company_id: companyId, description: a.description, value: parseFloat(a.value) || 0,
        }));
        if (assetRows.length > 0) {
          await supabase.from("transaction_assets" as any).insert(assetRows as any);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active_certificates", companyId] });
      setDialog(false);
      resetForm();
      toast.success("Transaction recorded!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({
      transaction_type: "initial_contribution", shareholder_id: "", share_class: "Membership",
      num_shares: "", price_per_share: "", total_consideration: "",
      consideration_type: "cash", transaction_date: new Date().toISOString().split("T")[0],
      from_shareholder: "", to_shareholder: "", notes: "",
      issued_certificate_number: "", surrendered_certificate_number: "",
    });
    setAssets([]);
  };

  const isTransfer = ["transfer", "interest_transfer", "interest_assignment", "share_exchange"].includes(form.transaction_type);
  const showAssetGrid = ["property", "other", "services"].includes(form.consideration_type);
  const assetTotal = assets.reduce((sum, a) => sum + (parseFloat(a.value) || 0), 0);

  // Build unified entries
  const entries: UnifiedEntry[] = [];
  const holderBalances: Record<string, number> = {};
  let totalIssued = 0;

  const findCertIssued = (name: string, date: string) =>
    certificates.find((c: any) => c.issue_date === date && (c.shareholders?.name || "").toLowerCase().trim() === name.toLowerCase().trim() && c.status === "active");
  const findCertCancelled = (name: string, date: string) =>
    certificates.find((c: any) => c.cancelled_date === date && (c.shareholders?.name || "").toLowerCase().trim() === name.toLowerCase().trim() && c.status === "cancelled");

  const sorted = [...transactions].sort((a: any, b: any) =>
    (a.transaction_date || "").localeCompare(b.transaction_date || "") || (a.created_at || "").localeCompare(b.created_at || "")
  );

  sorted.forEach((t: any) => {
    const txType = t.transaction_type || "";
    const isIss = ISSUANCE_TYPES.includes(txType);
    const isRed = REDUCTION_TYPES.includes(txType);
    const isTx = TRANSFER_TYPES.includes(txType);
    const isCancellation = txType === "cancellation";
    const isReissuance = txType === "reissuance";

    const transfereeName = t.to_shareholder || t.shareholders?.name || "";
    const transferorName = t.from_shareholder || "";
    const holderKey = transfereeName.toLowerCase().trim();
    const fromKey = transferorName.toLowerCase().trim();

    let unitsIssued = 0;
    let unitsCancelled = 0;
    let toTreasury = 0;

    if (isCancellation) {
      unitsCancelled = t.num_shares || 0;
      const certRef = certificates.find((c: any) => c.id === t.transferred_certificate_id);
      const certIssuedRef = certificates.find((c: any) => c.id === t.certificate_id);
      const shKey = fromKey || holderKey;
      entries.push({
        entryNum: entries.length + 1, date: t.transaction_date || "", type: "Cancellation",
        transferee: "—", transferor: t.from_shareholder || transfereeName || "—",
        interestType: t.share_class || "—",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : "—",
        certCancelled: certRef ? `#${(certRef as any).certificate_number}` : "—",
        unitsIssued: 0, unitsCancelled, toTreasury: 0,
        parValue: "—", pricePerUnit: "—", total: "—", consideration: "—",
        shBalance: Math.max(0, holderBalances[shKey] || 0),
        ownershipPct: null,
        treasuryBalance: Math.max(0, (authorizedShares ?? 0) - totalIssued),
        notes: t.notes || "", id: t.id, raw: t,
      });
      return;
    }

    if (isReissuance) {
      unitsIssued = t.num_shares || 0;
      const certIssuedRef = certificates.find((c: any) => c.id === t.certificate_id);
      entries.push({
        entryNum: entries.length + 1, date: t.transaction_date || "", type: "Reissuance",
        transferee: transfereeName || "—", transferor: "—",
        interestType: t.share_class || "—",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : (() => {
          const c = certificates.find((c: any) => c.issue_date === t.transaction_date && (c.shareholders?.name || "").toLowerCase().trim() === holderKey && c.num_shares === unitsIssued);
          return c ? `#${(c as any).certificate_number}` : "—";
        })(),
        certCancelled: "—",
        unitsIssued, unitsCancelled: 0, toTreasury: 0,
        parValue: "—", pricePerUnit: "—", total: "—", consideration: "—",
        shBalance: Math.max(0, holderBalances[holderKey] || 0),
        ownershipPct: null,
        treasuryBalance: Math.max(0, (authorizedShares ?? 0) - totalIssued),
        notes: t.notes || "", id: t.id, raw: t,
      });
      return;
    }

    if (isIss) {
      unitsIssued = t.num_shares || 0;
      holderBalances[holderKey] = (holderBalances[holderKey] || 0) + unitsIssued;
      totalIssued += unitsIssued;
    } else if (isRed) {
      toTreasury = t.num_shares || 0;
      unitsCancelled = t.num_shares || 0;
      const redKey = holderKey || fromKey;
      holderBalances[redKey] = (holderBalances[redKey] || 0) - toTreasury;
      totalIssued -= toTreasury;
    } else if (isTx) {
      unitsIssued = t.num_shares || 0;
      unitsCancelled = t.num_shares || 0;
      if (fromKey) holderBalances[fromKey] = (holderBalances[fromKey] || 0) - (t.num_shares || 0);
      if (holderKey) holderBalances[holderKey] = (holderBalances[holderKey] || 0) + (t.num_shares || 0);
    }

    const certIssued = findCertIssued(transfereeName, t.transaction_date);
    const certCancelled = findCertCancelled(transferorName || transfereeName, t.transaction_date);
    const treasuryBal = (authorizedShares ?? 0) - Math.max(0, totalIssued);
    const shBal = Math.max(0, holderBalances[holderKey] || 0);
    const ownershipPct = totalIssued > 0 ? (shBal / totalIssued) * 100 : null;

    // Merge cert # from transaction record itself
    const certIssuedStr = (t as any).issued_certificate_number
      ? `#${(t as any).issued_certificate_number}`
      : certIssued ? `#${(certIssued as any).certificate_number}` : "—";
    const certCancelledStr = (t as any).surrendered_certificate_number
      ? `#${(t as any).surrendered_certificate_number}`
      : certCancelled ? `#${(certCancelled as any).certificate_number}` : "—";

    entries.push({
      entryNum: entries.length + 1,
      date: t.transaction_date || "",
      type: txType.replace(/_/g, " "),
      transferee: transfereeName || "—",
      transferor: isTx ? (transferorName || "—") : isRed ? (transferorName || transfereeName || "—") : "—",
      interestType: t.share_class || "—",
      certIssued: certIssuedStr,
      certCancelled: certCancelledStr,
      unitsIssued: isIss || isTx ? unitsIssued : 0,
      unitsCancelled: isRed || isTx ? unitsCancelled : 0,
      toTreasury: isRed ? toTreasury : 0,
      parValue: t.par_value != null ? `$${Number(t.par_value).toFixed(2)}` : "—",
      pricePerUnit: t.price_per_share != null ? `$${Number(t.price_per_share).toFixed(2)}` : "—",
      total: t.total_consideration != null ? `$${Number(t.total_consideration).toFixed(2)}` : "—",
      consideration: t.consideration_type ? t.consideration_type.replace(/_/g, " ") : "—",
      shBalance: shBal,
      ownershipPct,
      treasuryBalance: Math.max(0, treasuryBal),
      notes: t.notes || "",
      id: t.id,
      raw: t,
    });
  });

  const handlePrintCertificate = async (t: any) => {
    const certNum = t.issued_certificate_number;
    const cert = certNum ? certificates.find((c: any) => c.certificate_number === certNum) :
                 t.certificate_id ? certificates.find((c: any) => c.id === t.certificate_id) : null;
    if (!cert && !certNum) { toast.error("No certificate linked."); return; }
    await downloadStockCertificatePdf({
      companyName: company?.name || "",
      stateOfIncorporation: company?.state_of_incorporation || undefined,
      certificateNumber: certNum || (cert as any)?.certificate_number || 0,
      shareholderName: t.shareholders?.name || t.to_shareholder || "",
      numShares: t.num_shares || 0,
      shareClass: t.share_class || "Membership",
      parValue: null,
      issueDate: t.transaction_date || new Date().toISOString().split("T")[0],
      authorizedShares: company?.authorized_shares,
      isLLC: true,
      membershipInterest: (() => {
        const totalUnits = certificates.filter((c: any) => c.status === "active").reduce((s: number, c: any) => s + (c.num_shares || 0), 0);
        return t.num_shares && totalUnits ? (t.num_shares / totalUnits) * 100 : null;
      })(),
    });
  };

  const handlePrintBillOfSale = (t: any) => {
    downloadBillOfSalePdf({
      companyName: company?.name || "", sellerName: t.from_shareholder || t.shareholders?.name || "",
      buyerName: t.to_shareholder || "", numShares: t.num_shares || 0,
      shareClass: t.share_class || "Membership", pricePerShare: t.price_per_share,
      totalPrice: t.total_consideration, saleDate: t.transaction_date || new Date().toISOString().split("T")[0],
      considerationType: t.consideration_type, certificateNumber: t.issued_certificate_number,
    });
  };

  const HEADERS = ["#", "Date", "Type", "Member", "Transferor", "Cert Iss.", "Cert Canc.", "Iss. Units", "Canc. Units", "$/Unit", "Total", "Consid.", "SH Bal.", "Own. %", "Notes"];

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">Unified Membership Ledger</CardTitle>
            <span title="Permanent record"><Lock className="h-3 w-3 text-muted-foreground" /></span>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            Unified ledger — Wis. Stat. Ch. 183 — Permanent record, entries cannot be edited or deleted
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions config={{
            title: "Unified Membership Ledger",
            companyName: "",
            statuteRef: "Unified ledger — Wis. Stat. Ch. 183 — Permanent record, entries cannot be edited or deleted",
            landscape: true,
            table: {
              headers: HEADERS,
              rows: entries.map(e => [
                String(e.entryNum),
                e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—",
                e.type,
                e.transferee,
                e.transferor,
                e.certIssued,
                e.certCancelled,
                e.unitsIssued > 0 ? e.unitsIssued.toLocaleString() : "—",
                e.unitsCancelled > 0 ? e.unitsCancelled.toLocaleString() : "—",
                e.pricePerUnit,
                e.total,
                e.consideration,
                e.shBalance.toLocaleString(),
                e.ownershipPct != null ? `${e.ownershipPct.toFixed(2)}%` : "—",
                e.notes || "—",
              ]),
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
                <DialogTitle className="font-display text-base">Record Interest Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Transaction Type</Label>
                    <Select value={form.transaction_type} onValueChange={(v) => setForm(p => ({ ...p, transaction_type: v }))}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LLC_TRANSACTION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <span>{t.label}</span>
                            <span className="ml-1.5 text-muted-foreground text-[10px]">({t.statute})</span>
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
                  <Label className="field-label">Member</Label>
                  <Select value={form.shareholder_id} onValueChange={(v) => setForm(p => ({ ...p, shareholder_id: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select member" /></SelectTrigger>
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
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label"># Units</Label>
                    <Input className="h-8 text-sm" type="number" step="0.0001" value={form.num_shares} onChange={(e) => setForm(p => ({ ...p, num_shares: e.target.value }))} required />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Price/Unit</Label>
                    <Input className="h-8 text-sm" type="number" step="0.01" value={form.price_per_share} onChange={(e) => setForm(p => ({ ...p, price_per_share: e.target.value }))} />
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
                {showAssetGrid && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between">
                      <Label className="field-label font-semibold">Non-Cash Assets</Label>
                      <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setAssets(prev => [...prev, { description: "", value: "" }])}>
                        <Plus className="h-2.5 w-2.5 mr-1" /> Add Asset
                      </Button>
                    </div>
                    {assets.length === 0 && <p className="text-[10px] text-muted-foreground">Click "Add Asset" to list non-cash consideration items.</p>}
                    {assets.map((asset, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px_28px] gap-1.5 items-end">
                        <Input className="h-7 text-xs" placeholder="Description" value={asset.description} onChange={(e) => { const u = [...assets]; u[i] = { ...u[i], description: e.target.value }; setAssets(u); }} />
                        <Input className="h-7 text-xs" type="number" step="0.01" placeholder="Value" value={asset.value} onChange={(e) => { const u = [...assets]; u[i] = { ...u[i], value: e.target.value }; setAssets(u); }} />
                        <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setAssets(prev => prev.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {assets.length > 0 && <div className="text-right text-xs font-semibold text-foreground">Asset Total: ${assetTotal.toFixed(2)}</div>}
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
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No membership activity recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-foreground/5">
                  <TableHead className="text-[10px] uppercase whitespace-nowrap w-8">#</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Type</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Member</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Transferor</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Cert Iss.</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Cert Canc.</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right">Iss. Units</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right">Canc. Units</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right">$/Unit</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right">Total</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Consid.</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right bg-primary/5">SH Bal.</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap text-right bg-primary/5">Own. %</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap">Notes</TableHead>
                  <TableHead className="text-[10px] uppercase whitespace-nowrap w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.entryNum}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize whitespace-nowrap">{e.type}</Badge></TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap">{e.transferee}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{e.transferor}</TableCell>
                    <TableCell className="text-xs font-mono">{e.certIssued}</TableCell>
                    <TableCell className="text-xs font-mono">{e.certCancelled}</TableCell>
                    <TableCell className="text-xs text-right">{e.unitsIssued > 0 ? e.unitsIssued.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{e.unitsCancelled > 0 ? e.unitsCancelled.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{e.pricePerUnit}</TableCell>
                    <TableCell className="text-xs text-right">{e.total}</TableCell>
                    <TableCell className="text-xs capitalize">{e.consideration}</TableCell>
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">{e.shBalance.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">{e.ownershipPct != null ? `${e.ownershipPct.toFixed(2)}%` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={e.notes}>{e.notes || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {e.raw.bill_of_sale_id && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Print Bill of Sale" onClick={() => handlePrintBillOfSale(e.raw)}>
                            <FileText className="h-3 w-3 text-primary" />
                          </Button>
                        )}
                        {(e.raw.issued_certificate_number || e.raw.certificate_id) && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Print Certificate" onClick={() => handlePrintCertificate(e.raw)}>
                            <Award className="h-3 w-3 text-primary" />
                          </Button>
                        )}
                        {!e.raw.bill_of_sale_id && !e.raw.issued_certificate_number && !e.raw.certificate_id && (
                          <Link2 className="h-3 w-3 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          Permanent record. Corrections are made by adding new entries only.
        </p>
      </CardContent>
    </Card>
  );
}
