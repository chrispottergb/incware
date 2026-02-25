import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, Link2 } from "lucide-react";
import { getTerminology } from "@/lib/entity-terminology";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  companyId: string;
  entityType?: string;
}

interface LedgerEntry {
  date: string;
  type: string;
  from: string;
  to: string;
  classLabel: string;
  units: number;
  price: number | null;
  total: number | null;
  source: "ledger" | "bill" | "certificate";
  linked: boolean;
  id: string;
}

export default function TransferLedgerTab({ companyId, entityType = "Corporation" }: Props) {
  const term = getTerminology(entityType);

  const { data: transactions = [] } = useQuery({
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
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills_of_sale", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_of_sale").select("*").eq("company_id", companyId).order("sale_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: certificates = [] } = useQuery({
    queryKey: ["stock_certificates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_certificates")
        .select("*, shareholders(name)")
        .eq("company_id", companyId)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isLoading = !transactions && !bills && !certificates;

  // Build unified entries
  const entries: LedgerEntry[] = [];

  // Ledger entries
  transactions.forEach((t: any) => {
    entries.push({
      date: t.transaction_date || "",
      type: t.transaction_type?.replace(/_/g, " ") || "—",
      from: t.from_shareholder || "—",
      to: t.shareholders?.name || t.to_shareholder || "—",
      classLabel: t.share_class || "—",
      units: t.num_shares || 0,
      price: t.price_per_share,
      total: t.total_consideration,
      source: "ledger",
      linked: !!t.bill_of_sale_id,
      id: t.id,
    });
  });

  // Standalone bills (not linked to a transaction)
  bills.forEach((b: any) => {
    if (b.transaction_id) return; // Already represented via ledger
    entries.push({
      date: b.sale_date || "",
      type: "Bill of Sale",
      from: b.seller_name || "—",
      to: b.buyer_name || "—",
      classLabel: b.share_class || "—",
      units: b.num_shares || 0,
      price: b.price_per_share,
      total: b.total_price,
      source: "bill",
      linked: false,
      id: b.id,
    });
  });

  // Certificate events
  certificates.forEach((c: any) => {
    if (c.issue_date) {
      entries.push({
        date: c.issue_date,
        type: `Cert #${c.certificate_number} Issued`,
        from: "—",
        to: c.shareholders?.name || "—",
        classLabel: c.share_class || "—",
        units: c.num_shares || 0,
        price: c.par_value,
        total: null,
        source: "certificate",
        linked: false,
        id: c.id + "-issue",
      });
    }
    if (c.status === "cancelled" && c.cancelled_date) {
      entries.push({
        date: c.cancelled_date,
        type: `Cert #${c.certificate_number} Cancelled`,
        from: c.shareholders?.name || "—",
        to: "—",
        classLabel: c.share_class || "—",
        units: c.num_shares || 0,
        price: null,
        total: null,
        source: "certificate",
        linked: false,
        id: c.id + "-cancel",
      });
    }
  });

  // Sort by date descending
  entries.sort((a, b) => b.date.localeCompare(a.date));

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
            <CardTitle className="card-section-title">Transfer Ledger</CardTitle>
          </div>
          <CardDescription className="text-[11px] mt-0.5">
            Unified chronological view of all ownership activity
          </CardDescription>
        </div>
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
                  <TableHead className="text-[10px] uppercase">Date</TableHead>
                  <TableHead className="text-[10px] uppercase">Type</TableHead>
                  <TableHead className="text-[10px] uppercase">From</TableHead>
                  <TableHead className="text-[10px] uppercase">To</TableHead>
                  <TableHead className="text-[10px] uppercase">{term.classLabel}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.shareUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">{term.dollarPerUnit}</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Total</TableHead>
                  <TableHead className="text-[10px] uppercase">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">
                      {e.date ? new Date(e.date + "T00:00:00").toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{e.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.from}</TableCell>
                    <TableCell className="text-xs font-medium">{e.to}</TableCell>
                    <TableCell className="text-xs">{e.classLabel}</TableCell>
                    <TableCell className="text-xs text-right">{e.units?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-right">
                      {e.price != null ? `$${Number(e.price).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right">
                      {e.total != null ? `$${Number(e.total).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${sourceColor(e.source)}`}>
                          {e.source === "ledger" ? "Ledger" : e.source === "bill" ? "Bill" : "Cert"}
                        </Badge>
                        {e.linked && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Link2 className="h-3 w-3 text-primary" />
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Linked to bill of sale</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
