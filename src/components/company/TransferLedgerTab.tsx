import React from "react";
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
  "treasury_reissue", "Capital Contribution", "Initial Contribution", "initial_contribution",
  "additional_contribution", "membership_issuance", "opening_balance",
];

const REDUCTION_TYPES = [
  "Redemption", "redemption", "Return of Capital",
  "reacquisition", "treasury_acquisition", "withdrawal_distribution", "dissociation_buyout",
];

const TRANSFER_TYPES = [
  "transfer", "interest_transfer", "interest_assignment", "gift",
  "share_exchange", "Transfer In", "Transfer Out",
];

// Certificate lifecycle types that are part of a transfer — not standalone ledger rows
const CERT_LIFECYCLE_TYPES = ["cancellation", "reissuance"];

interface Props {
  companyId: string;
  entityType?: string;
  authorizedShares?: number | null;
}

interface LedgerEntry {
  entryNum: number;
  date: string;
  effectiveDate: string;
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
  ownershipPct: number | null;
  notes: string;
  source: "ledger" | "bill" | "certificate";
  linked: boolean;
  id: string;
  status: string;
  isPending: boolean;
  correctedByEntryNum: string | null;
  correctsEntryNum: string | null;
  correctionMemo: string | null;
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
  const todayStr = new Date().toISOString().split("T")[0];

  // Track running balances
  const holderBalances: Record<string, number> = {};
  let totalIssued = 0;

  // Helper to find cert by shareholder + date
  const findCertIssued = (shareholderName: string, date: string, allTxns: any[]) => {
    // First try direct certificate lookup
    const directCert = certificates.find((c: any) =>
      c.issue_date === date &&
      (c.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim() &&
      c.status === "active"
    );
    if (directCert) return directCert;
    // Look for sibling reissuance transaction's certificate
    const reissuanceTx = allTxns.find((tx: any) =>
      tx.transaction_type === "reissuance" &&
      tx.transaction_date === date &&
      ((tx.to_shareholder || tx.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim())
    );
    if (reissuanceTx?.certificate_id) {
      return certificates.find((c: any) => c.id === reissuanceTx.certificate_id);
    }
    return null;
  };

  const findCertCancelled = (shareholderName: string, date: string, allTxns: any[]) => {
    // First try direct certificate lookup
    const directCert = certificates.find((c: any) =>
      c.cancelled_date === date &&
      (c.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim() &&
      c.status === "cancelled"
    );
    if (directCert) return directCert;
    // Look for sibling cancellation transaction's certificate
    const cancellationTx = allTxns.find((tx: any) =>
      tx.transaction_type === "cancellation" &&
      tx.transaction_date === date &&
      ((tx.from_shareholder || tx.to_shareholder || tx.shareholders?.name || "").toLowerCase().trim() === shareholderName.toLowerCase().trim())
    );
    if (cancellationTx?.transferred_certificate_id) {
      return certificates.find((c: any) => c.id === cancellationTx.transferred_certificate_id);
    }
    return null;
  };

  // Keep full list for sibling lookups, filter for display
  const allSorted = [...transactions].sort((a: any, b: any) =>
    (a.transaction_date || "").localeCompare(b.transaction_date || "") ||
    // Opening balance entries come first on same date
    ((b as any).entry_type === "opening_balance" ? 1 : 0) - ((a as any).entry_type === "opening_balance" ? 1 : 0) ||
    (a.created_at || "").localeCompare(b.created_at || "")
  );

  // Filter out cert lifecycle entries — they're part of transfers, not standalone rows
  const sorted = allSorted.filter((t: any) => !CERT_LIFECYCLE_TYPES.includes(t.transaction_type || ""));

  // First pass: assign entry numbers
  const entryNumMap = new Map<string, number>();
  sorted.forEach((t: any, idx: number) => {
    entryNumMap.set(t.id, idx + 1);
  });

  sorted.forEach((t: any, idx: number) => {
    const txType = t.transaction_type || "";
    const txStatus = (t as any).status || "active";
    const isCorrected = txStatus === "corrected";
    const isCorrection = txType === "correction";
    const effectiveDate = (t as any).effective_date || t.transaction_date || "";
    const isPending = effectiveDate > todayStr && !isCorrected;
    const isIss = ISSUANCE_TYPES.includes(txType);
    const isRed = REDUCTION_TYPES.includes(txType);
    const isTx = TRANSFER_TYPES.includes(txType);

    const transfereeName = t.to_shareholder || t.shareholders?.name || "";
    const transferorName = t.from_shareholder || "";
    const holderKey = transfereeName.toLowerCase().trim();
    const fromKey = transferorName.toLowerCase().trim();

    let sharesIssued = 0;
    let sharesCancelled = 0;
    let sharesToTreasury = 0;

    // Skip corrected entries from balance accumulation
    // Also skip pending (future effective_date) entries from balance accumulation
    if (!isCorrected && !isPending) {
      if (isCorrection) {
        const key = fromKey || holderKey;
        if (key) {
          holderBalances[key] = (holderBalances[key] || 0) - (t.num_shares || 0);
          totalIssued -= (t.num_shares || 0);
        }
        sharesCancelled = t.num_shares || 0;
      } else if (isIss) {
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
    }

    // Find linked certs — pass full transaction list for sibling lookups
    const certIssued = findCertIssued(transfereeName, t.transaction_date, allSorted);
    const certCancelled = findCertCancelled(transferorName || transfereeName, t.transaction_date, allSorted);

    const treasuryBal = (authorizedShares ?? 0) - Math.max(0, totalIssued);
    // Always show the recipient's (transferee/holder's) resulting balance.
    // For transfers this is the person receiving shares; for issuances/redemptions it's the holder.
    const balanceKey = holderKey || fromKey;
    const shBal = Math.max(0, holderBalances[balanceKey] || 0);
    const ownershipPct = term.isLLC && totalIssued > 0 ? (Math.max(0, holderBalances[holderKey] || 0) / totalIssued) * 100 : null;

    // Cross-reference entry numbers
    const correctedByEntryNum = isCorrected && (t as any).corrected_by_id
      ? String(entryNumMap.get((t as any).corrected_by_id) || "?") : null;
    const correctsEntryNum = isCorrection && (t as any).corrects_id
      ? String(entryNumMap.get((t as any).corrects_id) || "?") : null;

    entries.push({
      entryNum: entries.length + 1,
      date: t.transaction_date || "",
      effectiveDate: effectiveDate,
      type: txType.replace(/_/g, " "),
      certIssued: (t as any).issued_certificate_number
        ? `Cert #${(t as any).issued_certificate_number}`
        : certIssued ? `Cert #${(certIssued as any).certificate_number}` : "—",
      certCancelled: (t as any).surrendered_certificate_number
        ? `Cancels #${(t as any).surrendered_certificate_number}`
        : certCancelled ? `Cancels #${(certCancelled as any).certificate_number}` : "—",
      transferee: transfereeName || "—",
      transferor: isIss ? "" : isTx ? (transferorName || "—") : isRed ? (transferorName || transfereeName || "—") : isCorrection ? (transferorName || "—") : "—",
      classLabel: t.share_class || "—",
      sharesIssued: isIss || isTx ? sharesIssued : 0,
      sharesCancelled: isRed || isTx || isCorrection ? sharesCancelled : 0,
      sharesToTreasury: isRed ? sharesToTreasury : 0,
      consideration: t.total_consideration,
      shareholderBalance: shBal,
      treasuryBalance: Math.max(0, treasuryBal),
      ownershipPct,
      notes: t.notes || "",
      source: "ledger",
      linked: !!t.bill_of_sale_id,
      id: t.id,
      status: txStatus,
      isPending,
      correctedByEntryNum,
      correctsEntryNum,
      correctionMemo: (t as any).correction_memo || null,
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
            headers: ["#", "Date", "Type", "Transferred To", "Transferred From", "Cert Issued", "Cert Cancelled", "Issued", "Cancelled", "To Treasury", "Consideration", "Balance Held", ...(term.isLLC ? ["Ownership %"] : []), "Treasury Balance"],
            rows: entries.map(e => [
              String(e.entryNum),
              e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—",
              e.isPending ? `${e.type} [PENDING]` : e.type,
              e.transferee,
              e.transferor,
              e.certIssued,
              e.certCancelled,
              e.sharesIssued > 0 ? e.sharesIssued.toLocaleString() : "—",
              e.sharesCancelled > 0 ? e.sharesCancelled.toLocaleString() : "—",
              e.sharesToTreasury > 0 ? e.sharesToTreasury.toLocaleString() : "—",
              e.consideration != null ? `$${Number(e.consideration).toFixed(2)}` : "—",
              e.shareholderBalance.toLocaleString(),
              ...(term.isLLC ? [e.ownershipPct != null ? `${e.ownershipPct.toFixed(2)}%` : "—"] : []),
              e.treasuryBalance.toLocaleString(),
            ]),
            noteRows: entries.reduce<Record<number, string>>((acc, e, idx) => {
              if (e.type === "correction" && e.correctionMemo) acc[idx] = e.correctionMemo;
              return acc;
            }, {}),
          },
        }} />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No ownership activity recorded yet.</p>
        ) : (
          <div className="rounded-md border border-border overflow-auto [&_td]:border-l [&_td]:border-border [&_td:first-child]:border-l-0 [&_th]:border-l [&_th]:border-border [&_th:first-child]:border-l-0 [&_th]:text-center">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] uppercase !text-center w-8">#</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Date</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Type</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Transferred To</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Transferred From</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Cert Issued</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Cert Canc.</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Issued</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Canc.</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">To Treas.</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center">Consideration</TableHead>
                  <TableHead className="text-[10px] uppercase !text-center bg-primary/5">Balance Held</TableHead>
                  {term.isLLC && <TableHead className="text-[10px] uppercase !text-center bg-primary/5">Own. %</TableHead>}
                  <TableHead className="text-[10px] uppercase !text-center bg-primary/5">Treasury</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const isCorrected = e.status === "corrected";
                  const isCorrection = e.type === "correction";
                  const rawTx = sorted.find((t: any) => t.id === e.id);
                  const isOpeningBalance = rawTx && (rawTx as any).entry_type === "opening_balance";
                  return (
                  <React.Fragment key={e.id}>
                  <TableRow className={`${isCorrected ? "opacity-50" : ""} ${isOpeningBalance ? "italic bg-muted/30" : ""}`}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{e.entryNum}</TableCell>
                    <TableCell className={`text-xs ${isCorrected ? "line-through" : ""}`}>
                      {e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${isCorrected ? "line-through" : ""}`}>
                          {isOpeningBalance ? `Opening Balance (as of ${e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"})` : e.type}
                        </Badge>
                        {isCorrected && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="destructive" className="text-[9px] px-1 py-0">Corrected</Badge>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">See entry #{e.correctedByEntryNum || "?"}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {isCorrection && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="text-[9px] px-1 py-0 bg-accent text-accent-foreground">Correction</Badge>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Corrects entry #{e.correctsEntryNum || "?"}</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {e.isPending && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-300 text-yellow-700 bg-yellow-50">Pending</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`text-xs font-medium ${isCorrected ? "line-through" : ""}`}>{e.transferee}</TableCell>
                    <TableCell className={`text-xs ${isCorrected ? "line-through" : ""}`}>{e.transferor}</TableCell>
                    <TableCell className="text-xs font-mono">{e.certIssued}</TableCell>
                    <TableCell className="text-xs font-mono">{e.certCancelled}</TableCell>
                    <TableCell className={`text-xs text-right ${isCorrected ? "line-through" : ""}`}>{e.sharesIssued > 0 ? e.sharesIssued.toLocaleString() : "—"}</TableCell>
                    <TableCell className={`text-xs text-right ${isCorrected ? "line-through" : ""}`}>{e.sharesCancelled > 0 ? e.sharesCancelled.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">{e.sharesToTreasury > 0 ? e.sharesToTreasury.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-right">
                      {e.consideration != null ? `$${Number(e.consideration).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">
                      {e.shareholderBalance.toLocaleString()}
                    </TableCell>
                    {term.isLLC && (
                      <TableCell className="text-xs text-right font-semibold bg-primary/5">
                        {e.ownershipPct != null ? `${e.ownershipPct.toFixed(2)}%` : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-right font-semibold bg-primary/5">
                      {e.treasuryBalance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                  {isCorrection && e.correctionMemo && (
                    <TableRow className="border-t-0 hover:bg-transparent">
                      <TableCell colSpan={term.isLLC ? 15 : 14} className="py-1 px-4 pl-12 border-t-0">
                        <p className="text-[10px] italic text-muted-foreground">
                          Correction Note: {e.correctionMemo}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
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
