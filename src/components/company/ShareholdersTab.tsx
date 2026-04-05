import { useState, useCallback } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import AddressAutocomplete from "@/components/AddressAutocomplete";
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
import { Plus, Trash2, Loader2, Users, Edit2, Eye, EyeOff, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import SectionPdfActions from "./SectionPdfActions";
import { getTerminology } from "@/lib/entity-terminology";
import type { ShareholderHoldings } from "@/hooks/useShareCalculations";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

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
    num_units: "", price_per_unit: "", capital_account: "", share_class: "",
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

  const { data: shareholders = [], isLoading } = useQuery({
    queryKey: ["shareholders", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shareholders").select("*").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const defaultForm = { name: "", address: "", address_2: "", city: "", state: "", zip: "", ssn_ein: "", status: "active", num_units: "", price_per_unit: "", capital_account: "", share_class: "" };
  const resetForm = () => {
    setForm(defaultForm);
    setEditId(null);
    resetZip();
  };

  const getNextCertNumber = async () => {
    const { data } = await supabase
      .from("stock_certificates")
      .select("certificate_number")
      .eq("company_id", companyId)
      .order("certificate_number", { ascending: false })
      .limit(1);
    return ((data?.[0] as any)?.certificate_number || 0) + 1;
  };

  const save = useMutation({
    mutationFn: async () => {
      const ssnValue = form.ssn_ein?.trim() || null;
      let shareholderId = editId;

      const numUnits = parseFloat(form.num_units) || 0;
      const pricePerUnit = parseFloat(form.price_per_unit) || 0;
      const capitalAccount = parseFloat(form.capital_account) || 0;

      if (editId) {
        const { error } = await supabase.from("shareholders").update({
          name: form.name, address: form.address || null, address_2: form.address_2 || null, city: form.city || null,
          state: form.state || null, zip: form.zip || null, status: form.status,
        }).eq("id", editId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("shareholders").insert({
          company_id: companyId, name: form.name, address: form.address || null, address_2: form.address_2 || null,
          city: form.city || null, state: form.state || null, zip: form.zip || null, status: form.status,
          capital_account_balance: capitalAccount || 0,
        }).select("id").single();
        if (error) throw error;
        shareholderId = inserted.id;

        // Auto-generate certificate and ledger entry for new member with units
        if (numUnits > 0 && shareholderId) {
          const certNumber = await getNextCertNumber();
          const shareClass = form.share_class || (t.isLLC ? "Membership" : "Common");
          const today = new Date().toISOString().split("T")[0];
          const totalConsideration = numUnits * pricePerUnit;

          // Create certificate
          const { data: certData, error: certErr } = await supabase.from("stock_certificates").insert({
            company_id: companyId,
            certificate_number: certNumber,
            shareholder_id: shareholderId,
            num_shares: numUnits,
            share_class: shareClass,
            issue_date: today,
            status: "active",
            par_value: t.isLLC ? null : pricePerUnit || null,
          } as any).select("id").single();
          if (certErr) throw certErr;

          // Create ledger transaction
          const txType = t.isLLC ? "initial_contribution" : "initial_issuance";
          const { error: txErr } = await supabase.from("share_transactions").insert({
            company_id: companyId,
            shareholder_id: shareholderId,
            certificate_id: certData.id,
            transaction_type: txType,
            share_class: shareClass,
            num_shares: numUnits,
            price_per_share: pricePerUnit || null,
            total_consideration: totalConsideration || null,
            consideration_type: "cash",
            transaction_date: today,
            to_shareholder: form.name,
            issued_certificate_number: certNumber,
            notes: `Initial ${t.isLLC ? "capital contribution" : "share issuance"} — auto-generated`,
          } as any);
          if (txErr) throw txErr;

          // Recalculate ownership percentages
          await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
        }
      }

      // Encrypt SSN/EIN via edge function if provided
      if (ssnValue && shareholderId) {
        const { error: encError } = await supabase.functions.invoke("encrypt-ssn", {
          body: { shareholder_id: shareholderId, ssn_ein: ssnValue },
        });
        if (encError) {
          console.error("SSN encryption error:", encError);
          toast.error("Shareholder saved but SSN/EIN encryption failed. Please try editing again.");
        }
      }
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock-certificate-shareholders", companyId] });
      queryClient.invalidateQueries({ queryKey: ["shareholders-for-holdings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["stock_certificates", companyId] });
      queryClient.invalidateQueries({ queryKey: ["share-transactions", companyId] });
      queryClient.invalidateQueries({ queryKey: ["share_transactions", companyId] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareholders", companyId] });
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
    setForm({ name: s.name, address: s.address ?? "", address_2: (s as any).address_2 ?? "", city: s.city ?? "", state: s.state ?? "", zip: s.zip ?? "", ssn_ein: decryptedSsns[s.id] ?? "", status: s.status ?? "active", num_units: "", price_per_unit: "", capital_account: "", share_class: "" });
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
    // Legacy plaintext fallback
    if (s.ssn_ein) {
      return "••••" + s.ssn_ein.slice(-4);
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
                <div className="field-group">
                  <Label className="field-label">{t.shareholder} Name</Label>
                  <AddressAutocomplete
                    value={form.name}
                    onChange={(v) => setForm(p => ({ ...p, name: v }))}
                    onSelect={handleAddressSelect}
                    search={searchAddressBook}
                    getCompanySplitIndex={getCompanySplitIndex}
                    className="h-7 text-sm"
                    placeholder="Start typing a name..."
                  />
                </div>
                <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                  <div className="field-group col-span-7">
                    <Label className="field-label">Address</Label>
                    <Input className="h-7 text-sm" value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} />
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
                  {/* Show units/shares + capital fields only for NEW members */}
                  {!editId && (
                    <>
                      <div className="col-span-12 mt-1">
                        <div className="border-t border-border pt-2">
                          <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1.5">
                            Initial {t.isLLC ? "Membership Units" : "Shares"}
                          </p>
                        </div>
                      </div>
                      <div className="field-group col-span-4">
                        <Label className="field-label">{t.isLLC ? "Units" : "Shares"}</Label>
                        <Input className="h-7 text-sm" type="number" step="0.0001" min="0" value={form.num_units} onChange={(e) => setForm(p => ({ ...p, num_units: e.target.value }))} placeholder="0" />
                      </div>
                      <div className="field-group col-span-4">
                        <Label className="field-label">Price / {t.isLLC ? "Unit" : "Share"}</Label>
                        <Input className="h-7 text-sm" type="number" step="0.01" min="0" value={form.price_per_unit} onChange={(e) => setForm(p => ({ ...p, price_per_unit: e.target.value }))} placeholder="0.00" />
                      </div>
                      {t.isLLC && (
                        <div className="field-group col-span-4">
                          <Label className="field-label">Capital Account</Label>
                          <Input className="h-7 text-sm" type="number" step="0.01" min="0" value={form.capital_account} onChange={(e) => setForm(p => ({ ...p, capital_account: e.target.value }))} placeholder="0.00" />
                        </div>
                      )}
                      {!t.isLLC && (
                        <div className="field-group col-span-4">
                          <Label className="field-label">Share Class</Label>
                          <Select value={form.share_class || "Common"} onValueChange={(v) => setForm(p => ({ ...p, share_class: v }))}>
                            <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Common">Common</SelectItem>
                              <SelectItem value="Preferred">Preferred</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
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
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : shareholders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No {t.shareholders.toLowerCase()} recorded yet.</p>
        ) : (() => {
          // Calculate total units/shares for ownership %
          const activeShareholders = shareholders.filter(s => s.status === "active" && !s.is_treasury);
          const totalUnits = shareholderHoldings
            ? activeShareholders.reduce((sum, s) => sum + (shareholderHoldings[s.id] ?? 0), 0)
            : 0;
          // Use ownership_percentage from DB (set by recalculate function) as primary source
          // Fall back to certificate-based calculation only if DB value is null
          const getInterestPct = (s: typeof shareholders[0]) => {
            // If the shareholder has a stored ownership_percentage, use it
            if (s.ownership_percentage != null && Number(s.ownership_percentage) !== 0) {
              return Number(s.ownership_percentage);
            }
            // Fall back to certificate-based calculation
            if (!shareholderHoldings || totalUnits === 0) return null;
            const units = shareholderHoldings[s.id] ?? 0;
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
                    {(shareholderHoldings || t.isLLC) && <TableHead className="text-[10px] uppercase text-right">{t.isLLC ? "Units Held" : "Shares Held"}</TableHead>}
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
                        {(shareholderHoldings || t.isLLC) && (
                          <TableCell className="text-xs text-right font-medium">
                            {(shareholderHoldings?.[s.id] ?? 0).toLocaleString()}
                          </TableCell>
                        )}
                        <TableCell className="text-xs text-right font-medium">
                          {s.status === "active" && !s.is_treasury && pct != null && pct > 0
                            ? `${pct.toFixed(2)}%`
                            : "—"}
                        </TableCell>
                        {t.isLLC && (
                          <TableCell className="text-xs text-right font-medium font-mono">
                            {(s as any).capital_account_balance != null && Number((s as any).capital_account_balance) !== 0
                              ? `$${Number((s as any).capital_account_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : "—"}
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
                  {/* Total validation row for ownership % */}
                  {(totalUnits > 0 || (totalPct != null && totalPct > 0)) && (
                    <TableRow className="bg-muted/30 border-t-2">
                      <TableCell colSpan={4} className="text-xs font-semibold text-right">
                        Totals
                      </TableCell>
                      {(shareholderHoldings || t.isLLC) && (
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
