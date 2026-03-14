import { useState, useCallback } from "react";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMasterFirms, useMasterContacts } from "@/hooks/useMasterDirectory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, Building, Scale, Calculator, ChevronDown, ChevronRight, X, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface CounselTabProps {
  companyId: string;
}

// ─── Firm Dialog (shared for both attorney and accountant firms) ───
function FirmDialog({
  open, onOpenChange, editing, form, setForm, onSave, isPending, type,
  masterFirms, onSelectMaster,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: any;
  form: any; setForm: (fn: (prev: any) => any) => void;
  onSave: () => void; isPending: boolean; type: "Attorney" | "Accountant";
  masterFirms: any[]; onSelectMaster: (f: any) => void;
}) {
  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setForm(prev => ({ ...prev, city: result.city, state: result.state }));
  }, [setForm]);
  const { handleZipChange } = useZipLookup(handleZipResult);

  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = masterFirms.filter((f: any) =>
    f.firm_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(""); setShowDropdown(false); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit" : "Add New"} {type} Firm</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="relative">
            <Label className="text-xs">Firm Name *</Label>
            <Input
              value={form.firm_name}
              onChange={e => {
                setForm(p => ({ ...p, firm_name: e.target.value }));
                setSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => { if (masterFirms.length > 0 && !editing) setShowDropdown(true); }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder={!editing && masterFirms.length > 0 ? "Type or select from directory" : "Firm name"}
            />
            {showDropdown && !editing && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> Master Directory</div>
                {filtered.map((f: any) => (
                  <button
                    key={f.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                    onMouseDown={(e) => { e.preventDefault(); onSelectMaster(f); setShowDropdown(false); setSearch(""); }}
                  >
                    {f.firm_name}
                    {f.city && f.state && <span className="text-muted-foreground ml-2">— {f.city}, {f.state}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-12 gap-x-2 gap-y-2">
            <div className="col-span-7"><Label className="text-xs">Address</Label><Input className="h-7 text-sm" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="col-span-5"><Label className="text-xs">Address 2</Label><Input className="h-7 text-sm" value={form.address_2} onChange={e => setForm(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit" /></div>
            <div className="col-span-5"><Label className="text-xs">City</Label><Input className="h-7 text-sm" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} /></div>
            <div className="col-span-3"><Label className="text-xs">State</Label><Input className="h-7 text-sm" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} /></div>
            <div className="col-span-4"><Label className="text-xs">Zip</Label><Input className="h-7 text-sm" value={form.zip} onChange={e => { setForm(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} /></div>
            <div className="col-span-6"><Label className="text-xs">Phone</Label><Input className="h-7 text-sm" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div className="col-span-6"><Label className="text-xs">Email</Label><Input className="h-7 text-sm" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          </div>
          <div><Label className="text-xs">Website</Label><Input className="h-7 text-sm" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} /></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!form.firm_name.trim() || isPending}>{isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ACCOUNTING_SERVICES = [
  "Tax Preparation & Planning",
  "Bookkeeping",
  "Payroll Services",
  "Audit & Assurance",
  "Financial Statement Preparation",
  "Business Advisory",
  "Estate & Trust Planning",
  "Forensic Accounting",
  "Cost Accounting",
  "Management Consulting",
  "IRS Representation",
  "Business Valuation",
  "Succession Planning",
  "Nonprofit Accounting",
  "International Tax",
  "Sales Tax Compliance",
  "Cash Flow Management",
  "Budgeting & Forecasting",
  "Controller Services",
  "CFO Services",
];

const LEGAL_SERVICES = [
  "Corporate Law",
  "Real Estate",
  "Litigation",
  "Estate Planning & Trusts",
  "Tax Law",
  "Employment & Labor Law",
  "Intellectual Property",
  "Mergers & Acquisitions",
  "Bankruptcy & Restructuring",
  "Securities & Capital Markets",
  "Immigration",
  "Environmental Law",
  "Healthcare Law",
  "Government Relations",
  "Contract Drafting & Review",
  "Regulatory Compliance",
  "Business Formation",
  "Commercial Transactions",
];

function ScopeCombobox({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter(s =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setSearch(e.target.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder || "Select or type engagement scope"}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(s => (
            <button
              key={s}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); setSearch(""); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyFirmForm = () => ({ firm_name: "", address: "", address_2: "", city: "", state: "", zip: "", phone: "", email: "", website: "" });

// ─── Attorney Firms + Nested Attorneys ───
function AttorneySection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { masterFirms, upsertMasterFirm } = useMasterFirms("law");
  const { masterContacts, upsertMasterContact } = useMasterContacts("attorney");
  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<any>(null);
  const [firmForm, setFirmForm] = useState(emptyFirmForm());
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({ attorney_name: "", specialty: "", phone: "", email: "", notes: "" });
  const [contactFirmId, setContactFirmId] = useState<string | null>(null);
  const [expandedFirms, setExpandedFirms] = useState<Set<string>>(new Set());
  const [selectedAttorneys, setSelectedAttorneys] = useState<Record<string, string>>({});

  // Contact search state
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const filteredMasterContacts = masterContacts.filter((c: any) =>
    c.contact_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const selectMasterContact = (c: any) => {
    setContactForm({
      attorney_name: c.contact_name || "",
      specialty: c.specialty || "",
      phone: c.phone || "",
      email: c.email || "",
      notes: c.notes || "",
    });
    setShowContactDropdown(false);
    setContactSearch("");
  };

  const { data: firms = [] } = useQuery({
    queryKey: ["attorney_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorney_firms").select("*").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: attorneys = [] } = useQuery({
    queryKey: ["attorneys", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("attorneys").select("*, attorney_firms(firm_name)").eq("company_id", companyId).order("attorney_name");
      if (error) throw error;
      return data;
    },
  });

  const saveFirm = useMutation({
    mutationFn: async () => {
      if (editingFirm) {
        const { error } = await supabase.from("attorney_firms").update({ ...firmForm }).eq("id", editingFirm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attorney_firms").insert({ ...firmForm, company_id: companyId });
        if (error) throw error;
      }
      // Sync to master directory
      upsertMasterFirm.mutate({ firm_name: firmForm.firm_name, address: firmForm.address, address_2: firmForm.address_2, city: firmForm.city, state: firmForm.state, zip: firmForm.zip, phone: firmForm.phone, email: firmForm.email, website: firmForm.website });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorney_firms", companyId] }); setFirmDialogOpen(false); toast.success("Attorney firm saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delFirm = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("attorney_firms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorney_firms", companyId] }); qc.invalidateQueries({ queryKey: ["attorneys", companyId] }); toast.success("Firm deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveContact = useMutation({
    mutationFn: async () => {
      const payload = { ...contactForm, firm_id: contactFirmId };
      if (editingContact) {
        const { error } = await supabase.from("attorneys").update(payload).eq("id", editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attorneys").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
      // Sync to master directory
      upsertMasterContact.mutate({ contact_name: contactForm.attorney_name, specialty: contactForm.specialty, phone: contactForm.phone, email: contactForm.email, notes: contactForm.notes });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorneys", companyId] }); setContactDialogOpen(false); toast.success("Attorney saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delContact = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("attorneys").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["attorneys", companyId] }); toast.success("Attorney deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewFirm = () => { setEditingFirm(null); setFirmForm(emptyFirmForm()); setFirmDialogOpen(true); };
  const openEditFirm = (f: any) => { setEditingFirm(f); setFirmForm({ firm_name: f.firm_name, address: f.address || "", address_2: f.address_2 || "", city: f.city || "", state: f.state || "", zip: f.zip || "", phone: f.phone || "", email: f.email || "", website: f.website || "" }); setFirmDialogOpen(true); };

  const openNewContact = (firmId: string) => { setEditingContact(null); setContactFirmId(firmId); setContactForm({ attorney_name: "", title: "", bar_number: "", specialty: "", phone: "", email: "", notes: "" }); setContactSearch(""); setContactDialogOpen(true); };
  const openEditContact = (a: any) => { setEditingContact(a); setContactFirmId(a.firm_id); setContactForm({ attorney_name: a.attorney_name, title: a.title || "", bar_number: a.bar_number || "", specialty: a.specialty || "", phone: a.phone || "", email: a.email || "", notes: a.notes || "" }); setContactSearch(""); setContactDialogOpen(true); };

  const selectMasterFirm = (mf: any) => {
    setFirmForm({
      firm_name: mf.firm_name || "",
      address: mf.address || "",
      address_2: mf.address_2 || "",
      city: mf.city || "",
      state: mf.state || "",
      zip: mf.zip || "",
      phone: mf.phone || "",
      email: mf.email || "",
      website: mf.website || "",
    });
  };

  const toggleFirm = (id: string) => {
    setExpandedFirms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getAttorneysForFirm = (firmId: string) => attorneys.filter((a: any) => a.firm_id === firmId);
  const unassignedAttorneys = attorneys.filter((a: any) => !a.firm_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Scale className="h-4 w-4" /> Attorney Firms & Attorneys</CardTitle>
        <Button size="sm" variant="outline" onClick={openNewFirm} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Firm</Button>
      </CardHeader>
      <CardContent className="p-0">
        {firms.length === 0 && unassignedAttorneys.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">None Appointed</div>
        )}
        {firms.map((f: any) => {
          const firmAttorneys = getAttorneysForFirm(f.id);
          const isExpanded = expandedFirms.has(f.id);
          return (
            <Collapsible key={f.id} open={isExpanded} onOpenChange={() => toggleFirm(f.id)}>
              <div className="border-b last:border-b-0">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-left flex-1 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{f.firm_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({firmAttorneys.length} attorney{firmAttorneys.length !== 1 ? "s" : ""})</span>
                      {f.city && f.state && <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">· {f.city}, {f.state}</span>}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openNewContact(f.id); }}><Plus className="h-3 w-3 mr-1" />Attorney</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditFirm(f); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); delFirm.mutate(f.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="bg-muted/30 border-t">
                    {/* Select Attorney dropdown — always visible */}
                    <div className="px-10 py-2 border-b">
                      <Label className="text-xs text-muted-foreground">Select Attorney</Label>
                      <Select value={selectedAttorneys[f.id] || ""} onValueChange={v => setSelectedAttorneys(prev => ({ ...prev, [f.id]: v }))}>
                        <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select Attorney" /></SelectTrigger>
                        <SelectContent>
                          {firmAttorneys.length > 0 ? firmAttorneys.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.attorney_name}{a.title ? `, ${a.title}` : ""}</SelectItem>
                          )) : (
                            <SelectItem value="__none" disabled>No attorneys in this firm</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {firmAttorneys.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead className="pl-10">Name</TableHead><TableHead className="hidden sm:table-cell">Title</TableHead><TableHead className="hidden md:table-cell">Bar #</TableHead><TableHead className="hidden lg:table-cell">Phone</TableHead><TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow>
                        </TableHeader>
                        <TableBody>
                          {firmAttorneys.map((a: any) => (
                            <TableRow key={a.id} className={selectedAttorneys[f.id] === a.id ? "bg-primary/5" : ""}>
                              <TableCell className="font-medium text-xs pl-10">{a.attorney_name}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs">{a.title}</TableCell>
                              <TableCell className="hidden md:table-cell text-xs">{a.bar_number}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{a.email}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditContact(a)}><Pencil className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delContact.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <p className="text-sm text-muted-foreground">No attorneys added to this firm yet.</p>
                        <Button variant="outline" size="sm" onClick={() => openNewContact(f.id)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Attorney</Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        {/* Unassigned attorneys */}
        {unassignedAttorneys.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">Unassigned Attorneys</div>
            <Table>
              <TableBody>
                {unassignedAttorneys.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-xs pl-4">{a.attorney_name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{a.title}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{a.bar_number}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditContact(a)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delContact.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <FirmDialog open={firmDialogOpen} onOpenChange={setFirmDialogOpen} editing={editingFirm} form={firmForm} setForm={setFirmForm} onSave={() => saveFirm.mutate()} isPending={saveFirm.isPending} type="Attorney" masterFirms={masterFirms} onSelectMaster={selectMasterFirm} />

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={(v) => { setContactDialogOpen(v); if (!v) { setContactSearch(""); setShowContactDropdown(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingContact ? "Edit" : "Add"} Attorney</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Firm</Label>
              <div className="flex gap-2 items-center">
                <Select value={contactFirmId || ""} onValueChange={v => setContactFirmId(v || null)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.firm_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contactFirmId && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setContactFirmId(null)}><X className="h-3 w-3" /></Button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Label className="text-xs">Attorney Name *</Label>
                <Input
                  value={contactForm.attorney_name}
                  onChange={e => {
                    setContactForm(p => ({ ...p, attorney_name: e.target.value }));
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => { if (masterContacts.length > 0 && !editingContact) setShowContactDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                  placeholder={!editingContact && masterContacts.length > 0 ? "Type or select from directory" : ""}
                />
                {showContactDropdown && !editingContact && filteredMasterContacts.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> Directory</div>
                    {filteredMasterContacts.map((c: any) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); selectMasterContact(c); }}
                      >
                        {c.contact_name}
                        {c.specialty && <span className="text-muted-foreground ml-2">— {c.specialty}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div><Label className="text-xs">Title</Label><Input value={contactForm.title} onChange={e => setContactForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Partner, Associate" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Bar Number</Label><Input value={contactForm.bar_number} onChange={e => setContactForm(p => ({ ...p, bar_number: e.target.value }))} /></div>
              <div><Label className="text-xs">Specialty</Label><Input value={contactForm.specialty} onChange={e => setContactForm(p => ({ ...p, specialty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveContact.mutate()} disabled={!contactForm.attorney_name.trim() || saveContact.isPending}>{saveContact.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Accountant Firms + Nested Accountants ───
function AccountantSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { masterFirms, upsertMasterFirm } = useMasterFirms("accounting");
  const { masterContacts, upsertMasterContact } = useMasterContacts("accountant");
  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<any>(null);
  const [firmForm, setFirmForm] = useState(emptyFirmForm());
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({ accountant_name: "", specialty: "", phone: "", email: "", notes: "" });
  const [contactFirmId, setContactFirmId] = useState<string | null>(null);
  const [expandedFirms, setExpandedFirms] = useState<Set<string>>(new Set());
  const [selectedAccountants, setSelectedAccountants] = useState<Record<string, string>>({});

  // Contact search state
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const filteredMasterContacts = masterContacts.filter((c: any) =>
    c.contact_name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const selectMasterContact = (c: any) => {
     setContactForm({
      accountant_name: c.contact_name || "",
      specialty: c.specialty || "",
      phone: c.phone || "",
      email: c.email || "",
      notes: c.notes || "",
    });
    setShowContactDropdown(false);
    setContactSearch("");
  };

  const { data: firms = [] } = useQuery({
    queryKey: ["accountant_firms", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountant_firms").select("*").eq("company_id", companyId).order("firm_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: accountants = [] } = useQuery({
    queryKey: ["accountants", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("accountants").select("*, accountant_firms(firm_name)").eq("company_id", companyId).order("accountant_name");
      if (error) throw error;
      return data;
    },
  });

  const saveFirm = useMutation({
    mutationFn: async () => {
      if (editingFirm) {
        const { error } = await supabase.from("accountant_firms").update({ ...firmForm }).eq("id", editingFirm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accountant_firms").insert({ ...firmForm, company_id: companyId });
        if (error) throw error;
      }
      upsertMasterFirm.mutate({ firm_name: firmForm.firm_name, address: firmForm.address, address_2: firmForm.address_2, city: firmForm.city, state: firmForm.state, zip: firmForm.zip, phone: firmForm.phone, email: firmForm.email, website: firmForm.website });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountant_firms", companyId] }); setFirmDialogOpen(false); toast.success("Accountant firm saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delFirm = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("accountant_firms").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountant_firms", companyId] }); qc.invalidateQueries({ queryKey: ["accountants", companyId] }); toast.success("Firm deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveContact = useMutation({
    mutationFn: async () => {
      const payload = { ...contactForm, firm_id: contactFirmId };
      if (editingContact) {
        const { error } = await supabase.from("accountants").update(payload).eq("id", editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accountants").insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }
      upsertMasterContact.mutate({ contact_name: contactForm.accountant_name, specialty: contactForm.specialty, phone: contactForm.phone, email: contactForm.email, notes: contactForm.notes });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountants", companyId] }); setContactDialogOpen(false); toast.success("Accountant saved"); },
    onError: (e: any) => toast.error(e.message),
  });

  const delContact = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("accountants").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accountants", companyId] }); toast.success("Accountant deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNewFirm = () => { setEditingFirm(null); setFirmForm(emptyFirmForm()); setFirmDialogOpen(true); };
  const openEditFirm = (f: any) => { setEditingFirm(f); setFirmForm({ firm_name: f.firm_name, address: f.address || "", address_2: f.address_2 || "", city: f.city || "", state: f.state || "", zip: f.zip || "", phone: f.phone || "", email: f.email || "", website: f.website || "" }); setFirmDialogOpen(true); };

   const openNewContact = (firmId: string) => { setEditingContact(null); setContactFirmId(firmId); setContactForm({ accountant_name: "", specialty: "", phone: "", email: "", notes: "" }); setContactSearch(""); setContactDialogOpen(true); };
   const openEditContact = (a: any) => { setEditingContact(a); setContactFirmId(a.firm_id); setContactForm({ accountant_name: a.accountant_name, specialty: a.specialty || "", phone: a.phone || "", email: a.email || "", notes: a.notes || "" }); setContactSearch(""); setContactDialogOpen(true); };

  const selectMasterFirm = (mf: any) => {
    setFirmForm({
      firm_name: mf.firm_name || "",
      address: mf.address || "",
      address_2: mf.address_2 || "",
      city: mf.city || "",
      state: mf.state || "",
      zip: mf.zip || "",
      phone: mf.phone || "",
      email: mf.email || "",
      website: mf.website || "",
    });
  };

  const toggleFirm = (id: string) => {
    setExpandedFirms(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getAccountantsForFirm = (firmId: string) => accountants.filter((a: any) => a.firm_id === firmId);
  const unassignedAccountants = accountants.filter((a: any) => !a.firm_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Calculator className="h-4 w-4" /> Accountant / CPA Firms & Accountants</CardTitle>
        <Button size="sm" variant="outline" onClick={openNewFirm} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" />Add Firm</Button>
      </CardHeader>
      <CardContent className="p-0">
        {firms.length === 0 && unassignedAccountants.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-6">No accountant firms yet. Add a firm to get started.</div>
        )}
        {firms.map((f: any) => {
          const firmAccountants = getAccountantsForFirm(f.id);
          const isExpanded = expandedFirms.has(f.id);
          return (
            <Collapsible key={f.id} open={isExpanded} onOpenChange={() => toggleFirm(f.id)}>
              <div className="border-b last:border-b-0">
                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-left flex-1 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <Building className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{f.firm_name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({firmAccountants.length} accountant{firmAccountants.length !== 1 ? "s" : ""})</span>
                      {f.city && f.state && <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">· {f.city}, {f.state}</span>}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openNewContact(f.id); }}><Plus className="h-3 w-3 mr-1" />Accountant</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEditFirm(f); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); delFirm.mutate(f.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="bg-muted/30 border-t">
                    {/* Select Accountant dropdown — always visible */}
                    <div className="px-10 py-2 border-b">
                      <Label className="text-xs text-muted-foreground">Select Accountant</Label>
                      <Select value={selectedAccountants[f.id] || ""} onValueChange={v => setSelectedAccountants(prev => ({ ...prev, [f.id]: v }))}>
                        <SelectTrigger className="h-7 text-xs mt-1"><SelectValue placeholder="Select Accountant" /></SelectTrigger>
                        <SelectContent>
                          {firmAccountants.length > 0 ? firmAccountants.map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>{a.accountant_name}{a.specialty ? ` — ${a.specialty}` : ""}</SelectItem>
                          )) : (
                            <SelectItem value="__none" disabled>No accountants in this firm</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    {firmAccountants.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow><TableHead className="pl-10">Name</TableHead><TableHead className="hidden sm:table-cell">Scope of Engagement</TableHead><TableHead className="hidden lg:table-cell">Phone</TableHead><TableHead className="hidden lg:table-cell">Email</TableHead><TableHead className="w-16" /></TableRow>
                        </TableHeader>
                        <TableBody>
                          {firmAccountants.map((a: any) => (
                            <TableRow key={a.id} className={selectedAccountants[f.id] === a.id ? "bg-primary/5" : ""}>
                             <TableCell className="font-medium text-xs pl-10">{a.accountant_name}</TableCell>
                              <TableCell className="hidden sm:table-cell text-xs">{a.specialty}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                              <TableCell className="hidden lg:table-cell text-xs">{a.email}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditContact(a)}><Pencil className="h-3 w-3" /></Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delContact.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-6">
                        <p className="text-sm text-muted-foreground">No accountants added to this firm yet.</p>
                        <Button variant="outline" size="sm" onClick={() => openNewContact(f.id)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Accountant</Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        {/* Unassigned accountants */}
        {unassignedAccountants.length > 0 && (
          <div className="border-t">
            <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">Unassigned Accountants</div>
            <Table>
              <TableBody>
                {unassignedAccountants.map((a: any) => (
                  <TableRow key={a.id}>
                     <TableCell className="font-medium text-xs pl-4">{a.accountant_name}</TableCell>
                     <TableCell className="hidden sm:table-cell text-xs">{a.specialty}</TableCell>
                     <TableCell className="hidden lg:table-cell text-xs">{a.phone}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditContact(a)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => delContact.mutate(a.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <FirmDialog open={firmDialogOpen} onOpenChange={setFirmDialogOpen} editing={editingFirm} form={firmForm} setForm={setFirmForm} onSave={() => saveFirm.mutate()} isPending={saveFirm.isPending} type="Accountant" masterFirms={masterFirms} onSelectMaster={selectMasterFirm} />

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={(v) => { setContactDialogOpen(v); if (!v) { setContactSearch(""); setShowContactDropdown(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingContact ? "Edit" : "Add"} Accountant</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Firm</Label>
              <div className="flex gap-2 items-center">
                <Select value={contactFirmId || ""} onValueChange={v => setContactFirmId(v || null)}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select firm" /></SelectTrigger>
                  <SelectContent>
                    {firms.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.firm_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {contactFirmId && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setContactFirmId(null)}><X className="h-3 w-3" /></Button>}
              </div>
            </div>
            <div className="relative">
              <Label className="text-xs">Accountant Name *</Label>
              <Input
                value={contactForm.accountant_name}
                onChange={e => {
                  setContactForm(p => ({ ...p, accountant_name: e.target.value }));
                  setContactSearch(e.target.value);
                  setShowContactDropdown(true);
                }}
                onFocus={() => { if (masterContacts.length > 0 && !editingContact) setShowContactDropdown(true); }}
                onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                placeholder={!editingContact && masterContacts.length > 0 ? "Type or select from directory" : ""}
              />
              {showContactDropdown && !editingContact && filteredMasterContacts.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                  <div className="px-3 py-1 text-[10px] text-muted-foreground font-medium border-b flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" /> Directory</div>
                  {filteredMasterContacts.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => { e.preventDefault(); selectMasterContact(c); }}
                    >
                      {c.contact_name}
                      {c.specialty && <span className="text-muted-foreground ml-2">— {c.specialty}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Scope of Engagement</Label>
              <ScopeOfEngagementCombobox value={contactForm.specialty} onChange={v => setContactForm(p => ({ ...p, specialty: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone</Label><Input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Email</Label><Input value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveContact.mutate()} disabled={!contactForm.accountant_name.trim() || saveContact.isPending}>{saveContact.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Main CounselTab ───
export default function CounselTab({ companyId }: CounselTabProps) {
  return (
    <div className="space-y-5">
      <AttorneySection companyId={companyId} />
      <AccountantSection companyId={companyId} />
    </div>
  );
}
