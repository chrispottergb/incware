import { useState, useCallback } from "react";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import NameAutocomplete from "@/components/NameAutocomplete";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMasterFirms } from "@/hooks/useMasterDirectory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Landmark, PenTool, ChevronRight, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/phone-format";

interface BanksTabProps {
  companyId: string;
}

const ACCOUNT_TYPES = ["checking", "savings", "money_market", "cd", "line_of_credit", "loan", "other"];

export default function BanksTab({ companyId }: BanksTabProps) {
  const qc = useQueryClient();
  const { masterFirms: masterBanks, upsertMasterFirm: upsertMasterBank } = useMasterFirms("bank");
  const { search: searchAddressBook, getCompanySplitIndex, upsert: upsertAddressBook } = useAddressBookContext(companyId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { bank_name: "", account_type: "checking", account_number: "", routing_number: "", contact_name: "", contact_title: "", phone: "", address: "", address_2: "", city: "", state: "", zip: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  // Reveal state: true once the user has typed into or decrypted the field this session
  const [acctRevealed, setAcctRevealed] = useState(false);
  const [rtRevealed, setRtRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  // Signer dialog state
  const [signerOpen, setSignerOpen] = useState(false);
  const [signerEditingId, setSignerEditingId] = useState<string | null>(null);
  const [signerForm, setSignerForm] = useState({ signer_name: "", title: "", bank_id: "", limited_detail: "" });

  // Track which bank rows are expanded
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({});

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange, isLoading: zipLoading, zipError } = useZipLookup(handleZipResult);

  const { data: banks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["company_banks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_banks").select("*").eq("company_id", companyId).order("bank_name");
      if (error) throw error;
      return data;
    },
  });

  // Use master directory for bank suggestions instead of querying across companies
  const allBankNames = masterBanks;

  const { data: signers = [] } = useQuery({
    queryKey: ["bank_authorized_signers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_authorized_signers")
        .select("*")
        .eq("company_id", companyId)
        .order("signer_name");
      if (error) throw error;
      return data;
    },
  });

  const getSignersForBank = (bankId: string) => signers.filter((s: any) => s.bank_id === bankId);

  const AUTHORITY_OPTIONS = [
    "Check Signing & Payments",
    "Deposits Only",
    "Deposits & Endorsements",
    "View-Only Access",
    "Full Banking Authority",
    "Wire/ACH Approval",
    "Limited Authority (Specify)",
  ];

  // Bank CRUD — never writes plaintext account/routing through PostgREST;
  // encrypts via secure edge function after row save.
  const save = useMutation({
    mutationFn: async () => {
      const { account_number, routing_number, ...rest } = form;
      let bankId: string;
      if (editing) {
        const { error } = await supabase.from("company_banks").update({ ...rest }).eq("id", editing.id);
        if (error) throw error;
        bankId = editing.id;
      } else {
        const { data, error } = await supabase.from("company_banks").insert({ ...rest, company_id: companyId }).select("id").single();
        if (error) throw error;
        bankId = data.id;
      }
      // Encrypt sensitive fields server-side (only if user touched them in this session)
      if (acctRevealed || rtRevealed || !editing) {
        const { error: encErr } = await supabase.functions.invoke("encrypt-company-bank", {
          body: { bank_id: bankId, account_number, routing_number },
        });
        if (encErr) throw encErr;
      }
      // Sync to master directory; the hook encrypts bank numbers via edge function.
      upsertMasterBank.mutate({
        firm_name: form.bank_name, address: form.address, address_2: form.address_2,
        city: form.city, state: form.state, zip: form.zip, phone: form.phone,
        account_type: form.account_type, contact_name: form.contact_name, contact_title: form.contact_title,
        ...((acctRevealed || rtRevealed || !editing) ? { account_number, routing_number } : {}),
      });
      if (form.contact_name?.trim()) {
        upsertAddressBook.mutate({
          full_name: form.contact_name.trim(),
          address: form.address, address_2: form.address_2,
          city: form.city, state: form.state, zip: form.zip,
          company_id: companyId,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_banks", companyId] }); setOpen(false); toast.success("Bank saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("company_banks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company_banks", companyId] }); toast.success("Bank deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Signer CRUD
  const saveSigner = useMutation({
    mutationFn: async () => {
      const authorityValue = signerForm.title === "Limited Authority (Specify)" && signerForm.limited_detail
        ? `Limited Authority — ${signerForm.limited_detail}`
        : signerForm.title || null;
      const payload: any = {
        signer_name: signerForm.signer_name,
        title: authorityValue,
        bank_id: signerForm.bank_id,
      };
      if (signerEditingId) {
        const { error } = await supabase.from("bank_authorized_signers" as any).update(payload as any).eq("id", signerEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_authorized_signers" as any).insert({ ...payload, company_id: companyId } as any);
        if (error) throw error;
      }
      // Save signer to address book
      if (signerForm.signer_name?.trim()) {
        upsertAddressBook.mutate({
          full_name: signerForm.signer_name.trim(),
          company_id: companyId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      setSignerOpen(false);
      toast.success(signerEditingId ? "Signer updated" : "Authorized signer added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delSigner = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_authorized_signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      toast.success("Signer removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [bankNameSearch, setBankNameSearch] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const filteredBankNames = allBankNames.filter((b: any) =>
    (b.firm_name || b.bank_name || "").toLowerCase().includes(bankNameSearch.toLowerCase())
  );

  const selectExistingBank = (b: any) => {
    setForm(p => ({
      ...p,
      bank_name: b.firm_name || b.bank_name,
      address: b.address || p.address,
      address_2: b.address_2 || p.address_2,
      city: b.city || p.city,
      state: b.state || p.state,
      zip: b.zip || p.zip,
      phone: b.phone || p.phone,
      account_type: b.account_type || p.account_type,
      contact_name: b.contact_name || p.contact_name,
      contact_title: b.contact_title || p.contact_title,
    }));
    // Bank numbers stay blank; user re-enters or reveals on the target record.
    setAcctRevealed(false);
    setRtRevealed(false);
    setShowBankDropdown(false);
    setBankNameSearch("");
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setBankNameSearch(""); setAcctRevealed(true); setRtRevealed(true); setOpen(true); };
  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      bank_name: b.bank_name, account_type: b.account_type || "checking", account_number: "",
      routing_number: "", contact_name: b.contact_name || "", contact_title: b.contact_title || "",
      phone: b.phone || "", address: b.address || "", address_2: (b as any).address_2 || "", city: b.city || "", state: b.state || "", zip: b.zip || "", notes: b.notes || "",
    });
    setAcctRevealed(false);
    setRtRevealed(false);
    setBankNameSearch("");
    setOpen(true);
  };

  const revealField = async (field: "account" | "routing") => {
    if (!editing) return;
    setRevealing(true);
    try {
      const { data, error } = await supabase.functions.invoke("decrypt-company-bank", { body: { bank_id: editing.id } });
      if (error) throw error;
      const d = data as { account_number: string | null; routing_number: string | null };
      setForm(p => ({
        ...p,
        account_number: d.account_number || "",
        routing_number: d.routing_number || "",
      }));
      if (field === "account") setAcctRevealed(true);
      else setRtRevealed(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to reveal");
    } finally {
      setRevealing(false);
    }
  };

  const openNewSigner = (bankId: string) => {
    setSignerEditingId(null);
    setSignerForm({ signer_name: "", title: "", bank_id: bankId, limited_detail: "" });
    setSignerOpen(true);
  };

  const openEditSigner = (s: any) => {
    setSignerEditingId(s.id);
    const rawTitle = s.title || "";
    const isLimited = rawTitle.startsWith("Limited Authority");
    setSignerForm({
      signer_name: s.signer_name || "",
      title: isLimited ? "Limited Authority (Specify)" : rawTitle,
      bank_id: s.bank_id || "",
      limited_detail: isLimited ? rawTitle.replace(/^Limited Authority\s*[—–-]\s*/, "") : "",
    });
    setSignerOpen(true);
  };

  const formatType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const toggleBank = (bankId: string) => {
    setExpandedBanks(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (isError) return <QueryErrorBanner message="Failed to load banks." onRetry={refetch} />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank Accounts & Authorized Signers</CardTitle>
          <Button size="sm" variant="outline" onClick={openNew} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Bank</Button>
        </CardHeader>
        <CardContent className="p-0">
          {banks.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-6">No bank accounts yet</div>
          ) : (
            <div className="divide-y divide-border">
              {banks.map((b: any) => {
                const bankSigners = getSignersForBank(b.id);
                const isExpanded = expandedBanks[b.id] ?? false;
                return (
                  <Collapsible key={b.id} open={isExpanded} onOpenChange={() => toggleBank(b.id)}>
                    <div className="flex items-center px-4 py-2 hover:bg-muted/50 transition-colors">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 mr-2 shrink-0">
                          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-90")} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleTrigger asChild>
                        <button className="flex-1 text-left flex items-center gap-3 min-w-0">
                          <span className="font-medium text-xs truncate">{b.bank_name}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{formatType(b.account_type || "")}</Badge>
                          {b.account_number_last4 && <span className="text-[10px] text-muted-foreground font-mono">••••{b.account_number_last4}</span>}
                          {b.routing_number_last4 && <span className="text-[10px] text-muted-foreground font-mono">RT ••••{b.routing_number_last4}</span>}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 ml-auto mr-2">
                            <PenTool className="h-2.5 w-2.5 mr-1" />{bankSigners.length}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); openNewSigner(b.id); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Signer
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openEdit(b); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); del.mutate(b.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <CollapsibleContent>
                      <div className="bg-muted/30 border-t border-border">
                        {bankSigners.length === 0 ? (
                          <div className="px-8 py-4 text-center text-xs text-muted-foreground">
                          No authorized signers yet.{" "}
                            <button className="text-primary hover:underline" onClick={() => openNewSigner(b.id)}>Add one</button>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                               <TableRow className="hover:bg-transparent">
                                 <TableHead className="pl-10 text-xs">Signer Name</TableHead>
                                 <TableHead className="text-xs">Authority Type</TableHead>
                                 <TableHead className="w-16" />
                               </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bankSigners.map((s: any) => (
                                <TableRow key={s.id} className="hover:bg-muted/50">
                                 <TableCell className="pl-10 font-medium text-xs">{s.signer_name}</TableCell>
                                  <TableCell className="text-xs">{s.title || "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditSigner(s)}>
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delSigner.mutate(s.id)}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Bank Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Bank Account</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              {/* Row 1: Bank Name (~60%) | Account Type (~40%) */}
              <div className="grid grid-cols-20 gap-2">
                <div className="col-span-12 relative">
                  <Label className="text-xs">Bank Name *</Label>
                  <Input
                    value={form.bank_name}
                    onChange={e => {
                      setForm(p => ({ ...p, bank_name: e.target.value }));
                      setBankNameSearch(e.target.value);
                      setShowBankDropdown(true);
                    }}
                    onFocus={() => { if (allBankNames.length > 0) setShowBankDropdown(true); }}
                    onBlur={() => setTimeout(() => setShowBankDropdown(false), 200)}
                    placeholder="Type or select from existing banks"
                  />
                  {showBankDropdown && filteredBankNames.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                      <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1">📖 Master Directory</div>
                      {filteredBankNames.map((b: any, i: number) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); selectExistingBank(b); }}
                        >
                          {b.firm_name || b.bank_name}
                          {b.city && b.state && <span className="text-muted-foreground ml-2">— {b.city}, {b.state}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-8">
                  <Label className="text-xs">Account Type</Label>
                  <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Row 2: Account # | Routing # (encrypted at rest, masked by default) */}
              <div className="grid grid-cols-20 gap-2">
                <div className="col-span-10">
                  <Label className="text-xs">Account Number</Label>
                  <div className="flex gap-1">
                    <Input
                      className="h-7 text-sm font-mono"
                      type={acctRevealed ? "text" : "password"}
                      value={acctRevealed ? form.account_number : (editing?.account_number_last4 ? `••••••${editing.account_number_last4}` : "")}
                      onChange={e => { setForm(p => ({ ...p, account_number: e.target.value })); setAcctRevealed(true); }}
                      placeholder={editing ? "Hidden — click eye to reveal" : "Enter account number"}
                      readOnly={!acctRevealed && !!editing}
                    />
                    {editing && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={revealing} onClick={() => acctRevealed ? setAcctRevealed(false) : revealField("account")}>
                        {acctRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="col-span-10">
                  <Label className="text-xs">Routing Number</Label>
                  <div className="flex gap-1">
                    <Input
                      className="h-7 text-sm font-mono"
                      type={rtRevealed ? "text" : "password"}
                      value={rtRevealed ? form.routing_number : (editing?.routing_number_last4 ? `••••••${editing.routing_number_last4}` : "")}
                      onChange={e => { setForm(p => ({ ...p, routing_number: e.target.value })); setRtRevealed(true); }}
                      placeholder={editing ? "Hidden — click eye to reveal" : "Enter routing number"}
                      readOnly={!rtRevealed && !!editing}
                    />
                    {editing && (
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={revealing} onClick={() => rtRevealed ? setRtRevealed(false) : revealField("routing")}>
                        {rtRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {/* Row 3: Address (65%) | Row 4: Address 2 (35%) */}
              <div className="grid grid-cols-20 gap-2">
                <div className="col-span-13"><Label className="text-xs">Address</Label><DbAddressAutocomplete className="h-7 text-sm" value={form.address} onChange={(v) => setForm(p => ({ ...p, address: v }))} onSelect={(addr) => { setForm(p => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip })); }} source="companies" /></div>
                <div className="col-span-7"><Label className="text-xs">Address 2</Label><Input className="h-7 text-sm" value={form.address_2} onChange={e => setForm(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit" /></div>
              </div>
              {/* Row 5: City (50%) | State (15%) | Zip (30%) — using ~20-col approximation */}
              <div className="grid grid-cols-20 gap-2">
                <div className="col-span-10"><Label className="text-xs">City</Label><Input className="h-7 text-sm" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder={zipLoading ? "Loading..." : ""} /></div>
                <div className="col-span-4"><Label className="text-xs">State</Label><Input className="h-7 text-sm min-w-[60px]" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} placeholder={zipLoading ? "..." : ""} /></div>
                <div className="col-span-6"><Label className="text-xs">Zip</Label><Input className="h-7 text-sm" value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} />{zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}</div>
              </div>
              {/* Row 6: Notes — full width */}
              <div><Label className="text-xs">Notes</Label><Textarea className="text-sm min-h-[50px]" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>

              {/* Authorized Signatories section (only when editing) */}
              {editing && (
                <div className="border-t border-border pt-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><PenTool className="h-3 w-3" /> Authorized Signers</Label>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { openNewSigner(editing.id); }}>
                      <Plus className="h-2.5 w-2.5 mr-1" />Add
                    </Button>
                  </div>
                  {(() => {
                    const editSigners = getSignersForBank(editing.id);
                    if (editSigners.length === 0) return (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No signers yet</p>
                    );
                    return (
                      <div className="space-y-1">
                        {editSigners.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium truncate">{s.signer_name}</span>
                              {s.title && <span className="text-[10px] text-muted-foreground">{s.title}</span>}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditSigner(s)}>
                                <Pencil className="h-2.5 w-2.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => delSigner.mutate(s.id)}>
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={!form.bank_name.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Signer Dialog */}
        <Dialog open={signerOpen} onOpenChange={setSignerOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{signerEditingId ? "Edit" : "Add"} Authorized Signer</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label className="text-xs">Bank Account *</Label>
                <Select value={signerForm.bank_id} onValueChange={v => setSignerForm(p => ({ ...p, bank_id: v }))}>
                  <SelectTrigger className="bg-popover"><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {banks.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name} ({formatType(b.account_type || "")})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Signer Name *</Label><NameAutocomplete value={signerForm.signer_name} onChange={(v) => setSignerForm(p => ({ ...p, signer_name: v }))} onSelect={(entry) => { setSignerForm(p => ({ ...p, signer_name: entry.full_name })); }} search={searchAddressBook} getCompanySplitIndex={getCompanySplitIndex} /></div>
                <div>
                  <Label className="text-xs">Authority Type *</Label>
                  <div className="relative">
                    <Input
                      value={signerForm.title}
                      onChange={e => setSignerForm(p => ({ ...p, title: e.target.value, limited_detail: e.target.value === "Limited Authority (Specify)" ? p.limited_detail : "" }))}
                      placeholder="Select or type authority"
                      list="authority-type-options"
                    />
                    <datalist id="authority-type-options">
                      {AUTHORITY_OPTIONS.map(o => <option key={o} value={o} />)}
                    </datalist>
                  </div>
                </div>
              </div>
              {signerForm.title === "Limited Authority (Specify)" && (
                <div>
                  <Label className="text-xs">Specify Limitation *</Label>
                  <Input
                    value={signerForm.limited_detail}
                    onChange={e => setSignerForm(p => ({ ...p, limited_detail: e.target.value }))}
                    placeholder="e.g. Checks under $500"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSignerOpen(false)}>Cancel</Button>
              <Button onClick={() => saveSigner.mutate()} disabled={!signerForm.signer_name.trim() || !signerForm.bank_id || !signerForm.title.trim() || (signerForm.title === "Limited Authority (Specify)" && !signerForm.limited_detail.trim()) || saveSigner.isPending}>
                {saveSigner.isPending ? "Saving…" : signerEditingId ? "Save Changes" : "Add Signer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
