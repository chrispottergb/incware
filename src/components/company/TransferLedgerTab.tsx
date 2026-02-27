import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, Link2, Lock } from "lucide-react";
import { getTerminology } from "@/lib/entity-terminology";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SectionPdfActions from "./SectionPdfActions";

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

interface Props {
  companyId: string;
  entityType?: string;
  authorizedShares?: number | null;
}

interface LedgerEntry {
  entryNum: number;
  date: string;
  type: string;
  certIssued: string;
  certCancelled: string;
  transferee: string;
  transferor: string;
  classLabel: string;
  sharesIssued: number;
  sharesCancelled: number;
  sharesToTreasury: number;
  consideration: number | null;
  shareholderBalance: number;
  treasuryBalance: number;
  notes: string;
  source: "ledger" | "bill" | "certificate";
  linked: boolean;
  id: string;
}

export default function TransferLedgerTab({ companyId, entityType = "Corporation", authorizedShares }: Props) {
  const term = getTerminology(entityType);

  const { data: transactions = [] } = useQuery({
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

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const isLoading = !transactions && !certificates;

  // Build unified entries sorted chronologically
  // Use transactions as the primary source, enrich with cert data
  const entries: LedgerEntry[] = [];

  // Track running balances
  const holderBalances: Record<string, number> = {};
  let totalIssued = 0;

  // Helper to find cert by shareholder + date
  const findCertIssued = (shareholderName: string, date: string) => {
    return certificates.find((c: any) =>
      c.issue_date === date &&
      (c.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim() &&
      c.status === "active"
    );
  };

  const findCertCancelled = (shareholderName: string, date: string) => {
    return certificates.find((c: any) =>
      c.cancelled_date === date &&
      (c.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim() &&
      c.status === "cancelled"
    );
  };

  // Process transactions chronologically
  const sorted = [...transactions].sort((a: any, b: any) =>
    (a.transaction_date || "").localeCompare(b.transaction_date || "") ||
    (a.created_at || "").localeCompare(b.created_at || "")
  );

  sorted.forEach((t: any, idx: number) => {
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

    let sharesIssued = 0;
    let sharesCancelled = 0;
    let sharesToTreasury = 0;

    // Cancellation and reissuance are cert lifecycle entries — they don't change net balances
    // (the actual share movement is handled by the transfer entry)
    if (isCancellation) {
      sharesCancelled = t.num_shares || 0;
      // Don't change balances — this is a cert lifecycle event
      const certRef = certificates.find((c: any) => c.id === t.transferred_certificate_id);
      const certIssuedRef = certificates.find((c: any) => c.id === t.certificate_id);
      const shKey = fromKey || holderKey;
      entries.push({
        entryNum: entries.length + 1,
        date: t.transaction_date || "",
        type: "Cancellation",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : "—",
        certCancelled: certRef ? `#${(certRef as any).certificate_number}` : "—",
        transferee: "—",
        transferor: t.from_shareholder || transfereeName || "—",
        classLabel: t.share_class || "—",
        sharesIssued: 0,
        sharesCancelled,
        sharesToTreasury: 0,
        consideration: null,
        shareholderBalance: Math.max(0, holderBalances[shKey] || holderBalances[fromKey] || 0),
        treasuryBalance: Math.max(0, (authorizedShares ?? 0) - totalIssued),
        notes: t.notes || "",
        source: "ledger",
        linked: !!t.bill_of_sale_id,
        id: t.id,
      });
      return;
    }

    if (isReissuance) {
      sharesIssued = t.num_shares || 0;
      // Don't change balances — this is a cert lifecycle event
      const certIssuedRef = certificates.find((c: any) => c.id === t.certificate_id);
      entries.push({
        entryNum: entries.length + 1,
        date: t.transaction_date || "",
        type: "Reissuance",
        certIssued: certIssuedRef ? `#${(certIssuedRef as any).certificate_number}` : 
          // Fallback: find cert by shareholder name and date
          (() => {
            const c = certificates.find((c: any) =>
              c.issue_date === t.transaction_date &&
              (c.shareholders?.name || "").toLowerCase().trim() === holderKey &&
              c.num_shares === sharesIssued
            );
            return c ? `#${(c as any).certificate_number}` : "—";
          })(),
        certCancelled: "—",
        transferee: transfereeName || "—",
        transferor: "—",
        classLabel: t.share_class || "—",
        sharesIssued,
        sharesCancelled: 0,
        sharesToTreasury: 0,
        consideration: null,
        shareholderBalance: Math.max(0, holderBalances[holderKey] || 0),
        treasuryBalance: Math.max(0, (authorizedShares ?? 0) - totalIssued),
        notes: t.notes || "",
        source: "ledger",
        linked: !!t.bill_of_sale_id,
        id: t.id,
      });
      return;
    }

    if (isIss) {
      sharesIssued = t.num_shares || 0;
      holderBalances[holderKey] = (holderBalances[holderKey] || 0) + sharesIssued;
      totalIssued += sharesIssued;
    } else if (isRed) {
      sharesToTreasury = t.num_shares || 0;
      sharesCancelled = t.num_shares || 0;
      const redKey = holderKey || fromKey;
      holderBalances[redKey] = (holderBalances[redKey] || 0) - sharesToTreasury;
      totalIssued -= sharesToTreasury;
    } else if (isTx) {
      sharesIssued = t.num_shares || 0;
      sharesCancelled = t.num_shares || 0;
      if (fromKey) {
        holderBalances[fromKey] = (holderBalances[fromKey] || 0) - (t.num_shares || 0);
      }
      if (holderKey) {
        holderBalances[holderKey] = (holderBalances[holderKey] || 0) + (t.num_shares || 0);
      }
    }

    // Find linked certs
    const certIssued = findCertIssued(transfereeName, t.transaction_date);
    const certCancelled = findCertCancelled(transferorName || transfereeName, t.transaction_date);

    const treasuryBal = (authorizedShares ?? 0) - Math.max(0, totalIssued);
    const shBal = Math.max(0, holderBalances[holderKey] || 0);

    entries.push({
      entryNum: entries.length + 1,
      date: t.transaction_date || "",
      type: txType.replace(/_/g, " "),
      certIssued: certIssued ? `#${(certIssued as any).certificate_number}` : "—",
      certCancelled: certCancelled ? `#${(certCancelled as any).certificate_number}` : "—",
      transferee: transfereeName || "—",
      transferor: isTx ? (transferorName || "—") : isRed ? (transferorName || transfereeName || "—") : "—",
      classLabel: t.share_class || "—",
      sharesIssued: isIss || isTx ? sharesIssued : 0,
      sharesCancelled: isRed || isTx ? sharesCancelled : 0,
      sharesToTreasury: isRed ? sharesToTreasury : 0,
      consideration: t.total_consideration,
      shareholderBalance: shBal,
      treasuryBalance: Math.max(0, treasuryBal),
      notes: t.notes || "",
      source: "ledger",
      linked: !!t.bill_of_sale_id,
      id: t.id,
    });
  });

  const sourceColor = (source: string) => {
    switch (source) {
      case "ledger": return "bg-primary/10 text-primary border-primary/20";
      case "bill": return "bg-accent/50 text-accent-foreground border-accent/30";
      case "certificate": return "bg-muted text-muted-foreground border-muted";
      default: return "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">{term.isLLC ? "Membership Interest Ledger" : "Stock Transfer Ledger"}</CardTitle>
            <span title="Permanent record"><Lock className="h-3 w-3 text-muted-foreground" /></span>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            Permanent chronological record of all {term.isLLC ? "membership interest" : "share"} transactions
          </CardDescription>
        </div>
        <SectionPdfActions config={{
          title: term.isLLC ? "Membership Interest Ledger" : "Stock Transfer Ledger",
          companyName: "",
          statuteRef: `Permanent record — entries cannot be edited or deleted`,
          landscape: true,
          table: {
            headers: ["#", "Date", "Type", "Cert Issued", "Cert Cancelled", "Transferee", "Transferor", "Issued", "Cancelled", "To Treasury", "Consideration", "SH Balance", "Treasury Balance"],
            rows: entries.map(e => [
              String(e.entryNum),
              e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—",
              e.type,
              e.certIssued,
              e.certCancelled,
              e.transferee,
              e.transferor,
              e.sharesIssued > 0 ? e.sharesIssued.toLocaleString() : "—",
              e.sharesCancelled > 0 ? e.sharesCancelled.toLocaleString() : "—",
              e.sharesToTreasury > 0 ? e.sharesToTreasury.toLocaleString() : "—",
              e.consideration != null ? `$${Number(e.consideration).toFixed(2)}` : "—",
              e.shareholderBalance.toLocaleString(),
              e.treasuryBalance.toLocaleString(),
            ]),
          },
        }} />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No ownership activity recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase w-8">#</TableHead>
                  <TableHead className="text-[10px] uppercase">Date</TableHead>
                  <TableHead className="text-[10px] uppercase">Type</TableHead>
                  <TableHead className="text-[10px] uppercase">Cert Issued</TableHead>
                  <TableHead className="text-[10px] uppercase">Cert Canc.</TableHead>
                  <TableHead className="text-[10px] uppercase">Transferee</TableHead>
                  <TableHead className="text-[10px] uppercase">Transferor</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Issued</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Canc.</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">To Treas.</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Consideration</TableHead>
                  <TableHead className="text-[10px] uppercase text-right bg-primary/5">SH Bal.</TableHead>
                  <TableHead className="text-[10px] uppercase text-right bg-primary/5">Treasury</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.entryNum}</TableCell>
                    <TableCell className="text-xs">
                      {e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{e.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{e.certIssued}</TableCell>
                    <TableCell className="text-xs font-mono">{e.certCancelled}</TableCell>
                    <TableCell className="text-xs font-medium">{e.transferee}</TableCell>
                    <TableCell className="text-xs">{e.transferor}</TableCell>
                    <TableCell className="text-xs text-right">{e.sharesIssued > 0 ? e.sharesIssued.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{e.sharesCancelled > 0 ? e.sharesCancelled.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{e.sharesToTreasury > 0 ? e.sharesToTreasury.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">
                      {e.consideration != null ? `$${Number(e.consideration).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">
                      {e.shareholderBalance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">
                      {e.treasuryBalance.toLocaleString()}
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
