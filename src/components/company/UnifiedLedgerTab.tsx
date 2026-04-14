import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Lock, FileText, Award, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";
import { downloadStockCertificatePdf } from "@/lib/stock-certificate-pdf";
import { downloadBillOfSalePdf } from "@/lib/bill-of-sale-pdf";

const ISSUANCE_TYPES = [
  "Issuance", "initial_issuance", "authorized_issuance", "subscription_issuance",
  "consideration_issuance", "share_dividend", "fractional_shares", "preemptive_rights",
  "treasury_reissue", "reissuance", "Capital Contribution", "Initial Contribution", "initial_contribution",
  "additional_contribution", "membership_issuance", "opening_balance",
];

const REDUCTION_TYPES = [
  "Redemption", "redemption", "Cancellation", "cancellation", "Return of Capital",
  "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
];

const TRANSFER_TYPES = [
  "transfer", "interest_transfer", "interest_assignment", "gift",
  "share_exchange", "Transfer In", "Transfer Out",
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

  // Build unified entries
  const entries: UnifiedEntry[] = [];
  const holderBalances: Record<string, number> = {};
  let totalIssued = 0;

  const findCertIssued = (name: string, date: string) =>
    certificates.find((c: any) => c.issue_date === date && (c.shareholders?.name || "").toLowerCase().trim() === name.toLowerCase().trim() && c.status === "active");
  const findCertCancelled = (name: string, date: string) =>
    certificates.find((c: any) => c.cancelled_date === date && (c.shareholders?.name || "").toLowerCase().trim() === name.toLowerCase().trim() && c.status === "cancelled");

  const sorted = [...transactions].sort((a: any, b: any) =>
    (a.transaction_date || "").localeCompare(b.transaction_date || "") ||
    ((b as any).entry_type === "opening_balance" ? 1 : 0) - ((a as any).entry_type === "opening_balance" ? 1 : 0) ||
    (a.created_at || "").localeCompare(b.created_at || "")
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
      const cancCertStr = (t as any).surrendered_certificate_number
        ? `#${(t as any).surrendered_certificate_number}`
        : certRef ? `#${(certRef as any).certificate_number}` : "—";
      entries.push({
        entryNum: entries.length + 1, date: t.transaction_date || "", type: "Cancellation",
        transferee: "—", transferor: t.from_shareholder || transfereeName || "—",
        interestType: t.share_class || "—",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : "—",
        certCancelled: cancCertStr,
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
      const reissueCertCancelled = (t as any).surrendered_certificate_number
        ? `#${(t as any).surrendered_certificate_number}`
        : (() => {
            const cancRef = t.transferred_certificate_id ? certificates.find((c: any) => c.id === t.transferred_certificate_id) : null;
            return cancRef ? `#${(cancRef as any).certificate_number}` : "—";
          })();
      entries.push({
        entryNum: entries.length + 1, date: t.transaction_date || "", type: "Reissuance",
        transferee: transfereeName || "—", transferor: "—",
        interestType: t.share_class || "—",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : (() => {
          const c = certificates.find((c: any) => c.issue_date === t.transaction_date && (c.shareholders?.name || "").toLowerCase().trim() === holderKey && c.num_shares === unitsIssued);
          return c ? `#${(c as any).certificate_number}` : "—";
        })(),
        certCancelled: reissueCertCancelled,
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

    const certIssuedStr = (t as any).issued_certificate_number
      ? `Cert #${(t as any).issued_certificate_number}`
      : certIssued ? `Cert #${(certIssued as any).certificate_number}` : "—";
    const certCancelledStr = (t as any).surrendered_certificate_number
      ? `Cancels #${(t as any).surrendered_certificate_number}`
      : certCancelled ? `Cancels #${(certCancelled as any).certificate_number}` : "—";

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
                {entries.map((e) => {
                  const isOpeningBalance = e.raw && (e.raw as any).entry_type === "opening_balance";
                  return (
                  <TableRow key={e.id} className={isOpeningBalance ? "italic bg-muted/30" : ""}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.entryNum}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize whitespace-nowrap">
                      {isOpeningBalance ? `Opening Balance (as of ${e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"})` : e.type}
                    </Badge></TableCell>
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
                  );
                })}
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
