import { useState, useCallback, useMemo } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import NameAutocomplete from "@/components/NameAutocomplete";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Plus, Trash2, Loader2, Users, Edit2, Eye, EyeOff, ArrowRightLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { getTerminology } from "@/lib/entity-terminology";
import type { ShareholderHoldings } from "@/hooks/useShareCalculations";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const TRANSFER_BALANCE_TYPES = new Set([
  "transfer",
  "interest_transfer",
  "interest_assignment",
  "share_exchange",
  "gift",
]);

const REDUCTION_BALANCE_TYPES = new Set([
  "redemption",
  "reacquisition",
  "cancellation",
  "treasury_acquisition",
  "withdrawal_distribution",
  "dissociation_buyout",
]);

interface Props {
  companyId: string;
  entityType?: string;
  shareholderHoldings?: ShareholderHoldings;
  onBuySell?: (sellerId: string, sellerName: string) => void;
}

export default function ShareholdersTab({ companyId, entityType = "Corporation", shareholderHoldings, onBuySell }: Props) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", address: "", address_2: "", city: "", state: "", zip: "", ssn_ein: "", status: "active",
    owner_kind: "individual" as "individual" | "entity",
    representative_name: "", representative_title: "",
  });
  const [decryptedSsns, setDecryptedSsns] = useState<Record<string, string | null>>({});
  const [showSsns, setShowSsns] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange, isLoading: zipLoading, zipError, reset: resetZip } = useZipLookup(handleZipResult);

  const { search: searchAddressBook, getCompanySplitIndex, upsert: upsertAddressBook } = useAddressBookContext(companyId);

  const handleAddressSelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setForm(prev => ({
      ...prev,
      name: entry.full_name,
      address: entry.address || "",
      address_2: entry.address_2 || "",
      city: entry.city || "",
      state: entry.state || "",
      zip: entry.zip || "",
    }));
  }, []);

  const t = getTerminology(entityType);

  const { data: shareholders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [], isLoading: isTransactionsLoading } = useQuery({
    queryKey: ["share_transactions", companyId, "shareholders-table-balance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("share_transactions")
        .select("id, transaction_type, num_shares, transaction_date, created_at, effective_date, status, from_shareholder, to_shareholder, total_consideration, shareholder_id, shareholders(name)")
        .eq("company_id", companyId)
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const resolvedShareholderHoldings = useMemo<ShareholderHoldings>(() => {
    if (isTransactionsLoading || transactions.length === 0) {
      return shareholderHoldings ?? {};
    }

    const balances: Record<string, number> = {};
    const todayStr = new Date().toISOString().split("T")[0];
    const sorted = [...(transactions as any[])].sort((a, b) =>
      (a.transaction_date || "").localeCompare(b.transaction_date || "") ||
      (a.created_at || "").localeCompare(b.created_at || "")
    );

    sorted.forEach((transaction: any) => {
      const relatedShareholderName = Array.isArray(transaction.shareholders)
        ? transaction.shareholders[0]?.name
        : transaction.shareholders?.name;
      const shareholderName = String(relatedShareholderName || "").toLowerCase().trim();
      const txType = String(transaction.transaction_type || "").toLowerCase();
      const effectiveDate = transaction.effective_date || transaction.transaction_date || "";
      const isPending = effectiveDate > todayStr;
      const amount = Number(transaction.num_shares || 0);

      if (transaction.status === "corrected" || isPending) {
        return;
      }

      if (REDUCTION_BALANCE_TYPES.has(txType)) {
        const key = shareholderName || String(transaction.from_shareholder || "unknown").toLowerCase().trim();
        balances[key] = (balances[key] || 0) - amount;
        return;
      }

      if (txType === "correction") {
        const key = String(transaction.from_shareholder || shareholderName || "unknown").toLowerCase().trim();
        balances[key] = (balances[key] || 0) - amount;
        return;
      }

      if (txType === "reissuance") {
        const key = shareholderName || String(transaction.to_shareholder || "unknown").toLowerCase().trim();
        balances[key] = (balances[key] || 0) + amount;
        return;
      }

      if (TRANSFER_BALANCE_TYPES.has(txType)) {
        const buyerKey = String(transaction.to_shareholder || relatedShareholderName || "unknown").toLowerCase().trim();
        balances[buyerKey] = (balances[buyerKey] || 0) + amount;
        return;
      }

      const key = shareholderName || String(transaction.to_shareholder || "unknown").toLowerCase().trim();
      balances[key] = (balances[key] || 0) + amount;
    });

    return shareholders.reduce<ShareholderHoldings>((acc, shareholder) => {
      acc[shareholder.id] = Math.max(0, balances[shareholder.name.toLowerCase().trim()] || 0);
      return acc;
    }, {});
  }, [isTransactionsLoading, shareholderHoldings, shareholders, transactions]);

  // Compute capital account per shareholder from transactions (not DB column)
  const CAPITAL_CONTRIBUTION_TYPES = new Set([
    "initial_issuance", "authorized_issuance", "subscription_issuance", "consideration_issuance",
    "initial_contribution", "additional_contribution", "membership_issuance",
    "preemptive_rights", "share_dividend", "fractional_shares", "reissuance", "treasury_reissue",
  ]);
  const CAPITAL_REDUCTION_TYPES = new Set([
    "redemption", "reacquisition", "cancellation", "treasury_acquisition",
    "withdrawal_distribution", "dissociation_buyout",
  ]);

  const computedCapitalAccounts = useMemo<Record<string, number>>(() => {
    const accounts: Record<string, number> = {};
    const todayStr = new Date().toISOString().split("T")[0];
    (transactions as any[]).forEach((tx) => {
      if (tx.status === "corrected") return;
      const effectiveDate = tx.effective_date || tx.transaction_date || "";
      if (effectiveDate > todayStr) return;
      const txType = String(tx.transaction_type || "").toLowerCase();
      const amount = Number(tx.total_consideration || 0);
      if (amount === 0) return;
      const shId = tx.shareholder_id;
      if (!shId) return;
      if (CAPITAL_CONTRIBUTION_TYPES.has(txType)) {
        accounts[shId] = (accounts[shId] || 0) + amount;
      } else if (CAPITAL_REDUCTION_TYPES.has(txType)) {
        accounts[shId] = (accounts[shId] || 0) - amount;
      }
    });
    return accounts;
  }, [transactions]);

  const showHoldingsColumn = Boolean(shareholderHoldings) || transactions.length > 0 || t.isLLC;

  const defaultForm = { name: "", address: "", address_2: "", city: "", state: "", zip: "", ssn_ein: "", status: "active", owner_kind: "individual" as "individual" | "entity", representative_name: "", representative_title: "" };
  const resetForm = () => {
    setForm(defaultForm);
    setEditId(null);
    resetZip();
  };

  const save = useMutation({
    mutationFn: async () => {
      const ssnValue = form.ssn_ein?.trim() || null;
      let shareholderId = editId;

      if (editId) {
        const { error } = await supabase.from("shareholders").update({
          name: form.name, address: form.address || null, address_2: form.address_2 || null, city: form.city || null,
          state: form.state || null, zip: form.zip || null, status: form.status,
          owner_kind: form.owner_kind,
          representative_name: form.owner_kind === "entity" ? (form.representative_name?.trim() || null) : null,
          representative_title: form.owner_kind === "entity" ? (form.representative_title?.trim() || null) : null,
        } as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("shareholders").insert({
          company_id: companyId, name: form.name, address: form.address || null, address_2: form.address_2 || null,
          city: form.city || null, state: form.state || null, zip: form.zip || null, status: form.status,
          capital_account_balance: 0,
          owner_kind: form.owner_kind,
          representative_name: form.owner_kind === "entity" ? (form.representative_name?.trim() || null) : null,
          representative_title: form.owner_kind === "entity" ? (form.representative_title?.trim() || null) : null,
        } as any).select("id").single();
        if (error) throw error;
        shareholderId = inserted.id;
      }

      // Encrypt SSN/EIN via edge function if provided
      if (ssnValue && shareholderId) {
        const { error: encError } = await supabase.functions.invoke("encrypt-ssn", {
          body: { shareholder_id: shareholderId, ssn_ein: ssnValue },
        });
        if (encError) {
          console.error("Encryption error:", encError);
          toast.error("Shareholder saved but SSN/EIN encryption failed. Please try editing again.");
        }
      }
    },
    onSuccess: async () => {
      // Save to address book
      upsertAddressBook.mutate({
        full_name: form.name.trim(),
        address: form.address,
        address_2: form.address_2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        company_id: companyId,
      });
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["shareholders", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] }),
        queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] }),
      ]);
      setDialog(false); resetForm();
      setDecryptedSsns({});
      setShowSsns(false);
      toast.success(editId ? `${t.shareholder} updated!` : `${t.shareholder} added!`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shareholders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      toast.success(`${t.shareholder} removed.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (s: typeof shareholders[0]) => {
    setEditId(s.id);
    resetZip();
    // When editing, the SSN field starts empty since it's encrypted in DB
    // User can enter a new value or leave blank to keep existing
    setForm({ name: s.name, address: s.address ?? "", address_2: (s as any).address_2 ?? "", city: s.city ?? "", state: s.state ?? "", zip: s.zip ?? "", ssn_ein: decryptedSsns[s.id] ?? "", status: s.status ?? "active", owner_kind: ((s as any).owner_kind === "entity" ? "entity" : "individual"), representative_name: (s as any).representative_name ?? "", representative_title: (s as any).representative_title ?? "" });
    setDialog(true);
  };

  const toggleDecrypt = async () => {
    if (showSsns) {
      setShowSsns(false);
      setDecryptedSsns({});
      return;
    }

    const ids = shareholders.filter(s => (s as any).ssn_ein_encrypted).map(s => s.id);
    if (ids.length === 0) {
      toast.info("No encrypted SSN/EIN data found.");
      setShowSsns(true);
      return;
    }

    setDecrypting(true);
    try {
      const { data, error } = await supabase.functions.invoke("decrypt-ssn", {
        body: { shareholder_ids: ids },
      });
      if (error) throw error;
      setDecryptedSsns(data.data || {});
      setShowSsns(true);
    } catch (err: any) {
      toast.error("Failed to decrypt SSN/EIN data: " + (err.message || "Unknown error"));
    } finally {
      setDecrypting(false);
    }
  };

  const getSsnDisplay = (s: typeof shareholders[0]) => {
    if (showSsns && decryptedSsns[s.id]) {
      return decryptedSsns[s.id];
    }
    // Show masked version - check if encrypted data exists
    if ((s as any).ssn_ein_encrypted) {
      return "••••••••";
    }
    return "—";
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <CardTitle className="card-section-title">{t.shareholders}</CardTitle>
          </div>
          <CardDescription className="text-[11px] mt-0.5">{t.shareholderStatute}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <SectionPdfActions config={{
            title: t.shareholders,
            companyName: "",
            statuteRef: t.shareholderStatute,
            table: {
              headers: ["Name", "Address", "City/State/Zip", "SSN/EIN", "Status"],
              rows: shareholders.map((s) => [
                s.name,
                s.address ?? "—",
                [s.city, s.state, s.zip].filter(Boolean).join(", ") || "—",
                getSsnDisplay(s),
                s.status ?? "—",
              ]),
            },
          }} />
          {shareholders.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={toggleDecrypt}
              disabled={decrypting}
            >
              {decrypting ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : showSsns ? (
                <EyeOff className="mr-1 h-3 w-3" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              {showSsns ? "Hide SSN" : "Show SSN"}
            </Button>
          )}
          <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Plus className="mr-1 h-3 w-3" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display text-base">
                  {editId ? `Edit ${t.shareholder}` : `Add ${t.shareholder}`}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-2">
                <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                  <div className="field-group col-span-4">
                    <Label className="field-label">Owner Type</Label>
                    <Select value={form.owner_kind} onValueChange={(v) => setForm(p => ({ ...p, owner_kind: v as "individual" | "entity" }))}>
                      <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Individual</SelectItem>
                        <SelectItem value="entity">Entity (LLC, Corp, Trust)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="field-group col-span-8">
                    <Label className="field-label">{t.shareholder} Name{form.owner_kind === "entity" ? " (Entity)" : ""}</Label>
                    <NameAutocomplete
                      value={form.name}
                      onChange={(v) => setForm(p => ({ ...p, name: v }))}
                      onSelect={handleAddressSelect}
                      search={searchAddressBook}
                      getCompanySplitIndex={getCompanySplitIndex}
                      className="h-7 text-sm"
                      placeholder={form.owner_kind === "entity" ? "Entity legal name..." : "Start typing a name..."}
                    />
                  </div>
                  {form.owner_kind === "entity" && (
                    <>
                      <div className="field-group col-span-7">
                        <Label className="field-label">Representative Name</Label>
                        <Input
                          className="h-7 text-sm"
                          value={form.representative_name}
                          onChange={(e) => setForm(p => ({ ...p, representative_name: e.target.value }))}
                          placeholder="e.g. Jane Doe"
                        />
                      </div>
                      <div className="field-group col-span-5">
                        <Label className="field-label">Representative Title</Label>
                        <Input
                          className="h-7 text-sm"
                          value={form.representative_title}
                          onChange={(e) => setForm(p => ({ ...p, representative_title: e.target.value }))}
                          placeholder="e.g. Trustee, Manager"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                  <div className="field-group col-span-7">
                    <Label className="field-label">Address</Label>
                    <DbAddressAutocomplete className="h-7 text-sm" value={form.address} onChange={(v) => setForm(p => ({ ...p, address: v }))} onSelect={(addr) => { setForm(p => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip })); }} source="shareholders" />
                  </div>
                  <div className="field-group col-span-5">
                    <Label className="field-label">Address 2</Label>
                    <Input className="h-7 text-sm" value={form.address_2} onChange={(e) => setForm(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit" />
                  </div>
                  <div className="field-group col-span-5">
                    <Label className="field-label">City</Label>
                    <Input className="h-7 text-sm" value={form.city} onChange={(e) => setForm(p => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="field-group col-span-3">
                    <Label className="field-label">State</Label>
                    <Select value={form.state} onValueChange={(v) => setForm(p => ({ ...p, state: v }))}>
                      <SelectTrigger className="h-7 text-sm"><SelectValue placeholder="ST" /></SelectTrigger>
                      <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="field-group col-span-4">
                    <Label className="field-label">Zip</Label>
                    <Input className="h-7 text-sm" value={form.zip} onChange={(e) => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} />
                    {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
                  </div>
                  <div className="field-group col-span-5">
                    <Label className="field-label">SSN / EIN</Label>
                    <Input
                      className="h-7 text-sm"
                      value={form.ssn_ein}
                      onChange={(e) => setForm(p => ({ ...p, ssn_ein: e.target.value }))}
                      placeholder={editId ? "New or blank" : ""}
                    />
                  </div>
                  <div className="field-group col-span-4">
                    <Label className="field-label">Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button type="submit" className="w-full" size="sm" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editId ? "Save Changes" : `Add ${t.shareholder}`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isError ? (
          <QueryErrorBanner message="Failed to load shareholders." onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : shareholders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No {t.shareholders.toLowerCase()} recorded yet.</p>
        ) : (() => {
          const activeShareholders = shareholders.filter(s => s.status === "active" && !s.is_treasury);
          const totalUnits = activeShareholders.reduce((sum, s) => sum + (resolvedShareholderHoldings[s.id] ?? 0), 0);

          const getInterestPct = (s: typeof shareholders[0]) => {
            if (totalUnits === 0) return null;
            const units = resolvedShareholderHoldings[s.id] ?? 0;
            if (units === 0) return 0;
            return (units / totalUnits) * 100;
          };

          const totalPct = activeShareholders.reduce((sum, s) => sum + (getInterestPct(s) ?? 0), 0);

          return (
            <div className="rounded-md border border-border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Name</TableHead>
                    <TableHead className="text-[10px] uppercase">Address</TableHead>
                    <TableHead className="text-[10px] uppercase">City/State/Zip</TableHead>
                    <TableHead className="text-[10px] uppercase">SSN/EIN</TableHead>
                    {showHoldingsColumn && <TableHead className="text-[10px] uppercase text-right">{t.isLLC ? "Units Held" : "Shares Held"}</TableHead>}
                    <TableHead className="text-[10px] uppercase text-right">{t.isLLC ? "Interest %" : "Ownership %"}</TableHead>
                    {t.isLLC && <TableHead className="text-[10px] uppercase text-right">Capital Account</TableHead>}
                    <TableHead className="text-[10px] uppercase">Status</TableHead>
                    <TableHead className="text-[10px] uppercase w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shareholders.map((s) => {
                    const pct = getInterestPct(s);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs">
                          {s.address ? (
                            <>
                              {s.address}
                              {(s as any).address_2 && <>, {(s as any).address_2}</>}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{[s.city, s.state, s.zip].filter(Boolean).join(", ") || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{getSsnDisplay(s)}</TableCell>
                        {showHoldingsColumn && (
                          <TableCell className="text-xs text-right font-medium">
                            {(resolvedShareholderHoldings[s.id] ?? 0).toLocaleString()}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-right font-medium">
                          {s.status === "active" && !s.is_treasury && pct != null && pct > 0
                            ? `${pct.toFixed(2)}%`
                            : "—"}
                        </TableCell>
                        {t.isLLC && (
                          <TableCell className="text-xs text-right font-medium font-mono">
                            {(() => {
                              const cap = computedCapitalAccounts[s.id] || 0;
                              return cap !== 0
                                ? `$${cap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "—";
                            })()}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}`}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {onBuySell && s.status === "active" && !s.is_treasury && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="Buy/Sell" onClick={() => onBuySell(s.id, s.name)}>
                                <ArrowRightLeft className="h-3 w-3" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(s)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove.mutate(s.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(totalUnits > 0 || (totalPct != null && totalPct > 0)) && (
                    <TableRow className="bg-muted/30 border-t-2">
                      <TableCell colSpan={4} className="text-xs font-semibold text-right">
                        Totals
                      </TableCell>
                      {showHoldingsColumn && (
                        <TableCell className="text-xs text-right font-semibold">
                          {totalUnits.toLocaleString()}
                        </TableCell>
                      )}
                      <TableCell className={`text-xs text-right font-semibold ${totalPct != null && Math.abs(totalPct - 100) > 0.01 ? "text-destructive" : "text-success"}`}>
                        {totalPct != null ? `${totalPct.toFixed(2)}%` : "—"}
                        {totalPct != null && Math.abs(totalPct - 100) > 0.01 && (
                          <span className="block text-[10px] text-destructive font-normal">≠ 100%</span>
                        )}
                      </TableCell>
                      {t.isLLC && <TableCell />}
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
