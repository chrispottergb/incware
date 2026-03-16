import { useState, useCallback } from "react";
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
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Landmark, PenTool, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BanksTabProps {
  companyId: string;
}

const ACCOUNT_TYPES = ["checking", "savings", "money_market", "cd", "line_of_credit", "loan", "other"];

export default function BanksTab({ companyId }: BanksTabProps) {
  const qc = useQueryClient();
  const { masterFirms: masterBanks, upsertMasterFirm: upsertMasterBank } = useMasterFirms("bank");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const emptyForm = { bank_name: "", account_type: "checking", account_number: "", routing_number: "", contact_name: "", contact_title: "", phone: "", address: "", address_2: "", city: "", state: "", zip: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  // Signer dialog state
  const [signerOpen, setSignerOpen] = useState(false);
  const [signerEditingId, setSignerEditingId] = useState<string | null>(null);
  const [signerForm, setSignerForm] = useState({ signer_name: "", title: "", bank_id: "", effective_date: new Date().toISOString().split("T")[0], end_date: "" });

  // Track which bank rows are expanded
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({});

  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange } = useZipLookup(handleZipResult);

  const { data: banks = [] } = useQuery({
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

  const isActive = (s: any) => {
    const today = new Date().toISOString().split("T")[0];
    if (!s.effective_date) return true;
    if (s.effective_date > today) return false;
    if (s.end_date && s.end_date < today) return false;
    return true;
  };

  // Bank CRUD
  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("company_banks").update({ ...form }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_banks").insert({ ...form, company_id: companyId });
        if (error) throw error;
      }
      // Sync to master directory
      upsertMasterBank.mutate({
        firm_name: form.bank_name, address: form.address, address_2: form.address_2,
        city: form.city, state: form.state, zip: form.zip, phone: form.phone,
        account_number: form.account_number, routing_number: form.routing_number,
        account_type: form.account_type, contact_name: form.contact_name, contact_title: form.contact_title,
      });
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
      const payload: any = {
        signer_name: signerForm.signer_name,
        title: signerForm.title || null,
        bank_id: signerForm.bank_id,
        effective_date: signerForm.effective_date || null,
        end_date: signerForm.end_date || null,
      };
      if (signerEditingId) {
        const { error } = await supabase.from("bank_authorized_signers" as any).update(payload as any).eq("id", signerEditingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_authorized_signers" as any).insert({ ...payload, company_id: companyId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      setSignerOpen(false);
      toast.success(signerEditingId ? "Signatory updated" : "Authorized signatory added");
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
      toast.success("Signatory removed");
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
      account_number: b.account_number || p.account_number,
      routing_number: b.routing_number || p.routing_number,
      account_type: b.account_type || p.account_type,
      contact_name: b.contact_name || p.contact_name,
      contact_title: b.contact_title || p.contact_title,
    }));
    setShowBankDropdown(false);
    setBankNameSearch("");
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setBankNameSearch(""); setOpen(true); };
  const openEdit = (b: any) => {
    setEditing(b);
    setForm({
      bank_name: b.bank_name, account_type: b.account_type || "checking", account_number: b.account_number || "",
      routing_number: b.routing_number || "", contact_name: b.contact_name || "", contact_title: b.contact_title || "",
      phone: b.phone || "", address: b.address || "", address_2: (b as any).address_2 || "", city: b.city || "", state: b.state || "", zip: b.zip || "", notes: b.notes || "",
    });
    setBankNameSearch("");
    setOpen(true);
  };

  const openNewSigner = (bankId: string) => {
    setSignerEditingId(null);
    setSignerForm({ signer_name: "", title: "", bank_id: bankId, effective_date: new Date().toISOString().split("T")[0], end_date: "" });
    setSignerOpen(true);
  };

  const openEditSigner = (s: any) => {
    setSignerEditingId(s.id);
    setSignerForm({
      signer_name: s.signer_name || "", title: s.title || "", bank_id: s.bank_id || "",
      effective_date: s.effective_date || "", end_date: s.end_date || "",
    });
    setSignerOpen(true);
  };

  const formatType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const toggleBank = (bankId: string) => {
    setExpandedBanks(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Landmark className="h-4 w-4" /> Bank Accounts & Authorized Signatories</CardTitle>
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
                          {b.account_number && <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">••••{b.account_number.slice(-4)}</span>}
                          <span className="text-[10px] text-muted-foreground hidden md:inline">{b.routing_number}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 ml-auto mr-2">
                            <PenTool className="h-2.5 w-2.5 mr-1" />{bankSigners.length}
                          </Badge>
                        </button>
                      </CollapsibleTrigger>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={(e) => { e.stopPropagation(); openNewSigner(b.id); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Add Signatory
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
                            No authorized signatories yet.{" "}
                            <button className="text-primary hover:underline" onClick={() => openNewSigner(b.id)}>Add one</button>
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-10 text-xs">Signatory Name</TableHead>
                                <TableHead className="text-xs hidden sm:table-cell">Title</TableHead>
                                <TableHead className="text-xs hidden md:table-cell">Effective</TableHead>
                                <TableHead className="text-xs hidden md:table-cell">End</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                                <TableHead className="w-16" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bankSigners.map((s: any) => (
                                <TableRow key={s.id} className="hover:bg-muted/50">
                                  <TableCell className="pl-10 font-medium text-xs">{s.signer_name}</TableCell>
                                  <TableCell className="hidden sm:table-cell text-xs">{s.title}</TableCell>
                                  <TableCell className="hidden md:table-cell text-xs">{s.effective_date ? new Date(s.effective_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                                  <TableCell className="hidden md:table-cell text-xs">{s.end_date ? new Date(s.end_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={isActive(s) ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                      {isActive(s) ? "Active" : "Inactive"}
                                    </Badge>
                                  </TableCell>
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Bank Account</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="relative">
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
              <div className="grid grid-cols-12 gap-x-2 gap-y-2">
                <div className="col-span-4">
                  <Label className="text-xs">Account Type</Label>
                  <Select value={form.account_type} onValueChange={v => setForm(p => ({ ...p, account_type: v }))}>
                    <SelectTrigger className="h-7 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4"><Label className="text-xs">Account #</Label><Input className="h-7 text-sm" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} /></div>
                <div className="col-span-4"><Label className="text-xs">Routing #</Label><Input className="h-7 text-sm" value={form.routing_number} onChange={e => setForm(p => ({ ...p, routing_number: e.target.value }))} /></div>
                <div className="col-span-5"><Label className="text-xs">Contact Name</Label><Input className="h-7 text-sm" value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
                <div className="col-span-4"><Label className="text-xs">Contact Title</Label><Input className="h-7 text-sm" value={form.contact_title} onChange={e => setForm(p => ({ ...p, contact_title: e.target.value }))} /></div>
                <div className="col-span-3"><Label className="text-xs">Phone</Label><Input className="h-7 text-sm" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
                <div className="col-span-7"><Label className="text-xs">Address</Label><Input className="h-7 text-sm" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
                <div className="col-span-5"><Label className="text-xs">Address 2</Label><Input className="h-7 text-sm" value={form.address_2} onChange={e => setForm(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit" /></div>
                <div className="col-span-5"><Label className="text-xs">City</Label><Input className="h-7 text-sm" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
                <div className="col-span-3"><Label className="text-xs">State</Label><Input className="h-7 text-sm" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
                <div className="col-span-4"><Label className="text-xs">Zip</Label><Input className="h-7 text-sm" value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} /></div>
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea className="text-sm min-h-[50px]" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>

              {/* Authorized Signatories section (only when editing) */}
              {editing && (
                <div className="border-t border-border pt-3 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold flex items-center gap-1.5"><PenTool className="h-3 w-3" /> Authorized Signatories</Label>
                    <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => { openNewSigner(editing.id); }}>
                      <Plus className="h-2.5 w-2.5 mr-1" />Add
                    </Button>
                  </div>
                  {(() => {
                    const editSigners = getSignersForBank(editing.id);
                    if (editSigners.length === 0) return (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No signatories yet</p>
                    );
                    return (
                      <div className="space-y-1">
                        {editSigners.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between bg-muted/40 rounded px-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium truncate">{s.signer_name}</span>
                              {s.title && <span className="text-[10px] text-muted-foreground">{s.title}</span>}
                              <Badge variant={isActive(s) ? "default" : "secondary"} className="text-[9px] px-1 py-0">
                                {isActive(s) ? "Active" : "Inactive"}
                              </Badge>
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
            <DialogHeader><DialogTitle>{signerEditingId ? "Edit" : "Add"} Authorized Signatory</DialogTitle></DialogHeader>
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
                <div><Label className="text-xs">Signatory Name *</Label><Input value={signerForm.signer_name} onChange={e => setSignerForm(p => ({ ...p, signer_name: e.target.value }))} /></div>
                <div><Label className="text-xs">Title</Label><Input value={signerForm.title} onChange={e => setSignerForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. President, Treasurer" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Effective Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !signerForm.effective_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {signerForm.effective_date ? format(new Date(signerForm.effective_date + "T00:00:00"), "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={signerForm.effective_date ? new Date(signerForm.effective_date + "T00:00:00") : undefined} onSelect={d => setSignerForm(p => ({ ...p, effective_date: d ? d.toISOString().split("T")[0] : "" }))} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs">End Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !signerForm.end_date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {signerForm.end_date ? format(new Date(signerForm.end_date + "T00:00:00"), "PPP") : "Still active"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={signerForm.end_date ? new Date(signerForm.end_date + "T00:00:00") : undefined} onSelect={d => setSignerForm(p => ({ ...p, end_date: d ? d.toISOString().split("T")[0] : "" }))} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSignerOpen(false)}>Cancel</Button>
              <Button onClick={() => saveSigner.mutate()} disabled={!signerForm.signer_name.trim() || !signerForm.bank_id || saveSigner.isPending}>
                {saveSigner.isPending ? "Saving…" : signerEditingId ? "Save Changes" : "Add Signatory"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
