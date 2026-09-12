import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import NameAutocomplete from "@/components/NameAutocomplete";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { useZipLookup } from "@/hooks/useZipLookup";
import { sanitizeCurrencyInput, formatCurrencyDisplay } from "@/lib/currency-format";
import { Plus, Pencil, Trash2, Loader2, Home } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
  companyName?: string;
}

const DEED_TYPES = [
  "Warranty Deed",
  "Special Warranty Deed",
  "Quit Claim Deed",
  "Trustee's Deed",
  "Personal Representative's Deed",
  "Land Contract",
  "Other",
];

const PROPERTY_USES = [
  "Owner-occupied",
  "Leased to third party",
  "Leased to a related party",
  "Vacant land",
  "Held for investment",
  "Other",
];

const STATUSES = ["Held", "Sold", "Transferred"] as const;

const STATUS_BADGE: Record<string, string> = {
  Held: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  Sold: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  Transferred: "bg-blue-500/10 text-blue-700 border-blue-500/25",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Held", label: "Held" },
  { value: "Sold", label: "Sold" },
  { value: "Transferred", label: "Transferred" },
];

interface RealProperty {
  id: string;
  company_id: string;
  property_label: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  parcel_id: string | null;
  legal_description: string | null;
  acquisition_date: string | null;
  purchase_price: string | number | null;
  seller_name: string | null;
  titled_in_name_of: string | null;
  deed_type: string | null;
  recorded_date: string | null;
  recording_document_number: string | null;
  is_financed: boolean;
  lender_name: string | null;
  linked_loan_id: string | null;
  property_use: string | null;
  authorized_by_meeting_id: string | null;
  notes: string | null;
  status: string;
  disposition_date: string | null;
  sale_price: string | number | null;
  buyer_name: string | null;
  disposition_doc_number: string | null;
  title_held_by_seller: boolean;
  created_at: string;
}

interface FormState {
  property_label: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  parcel_id: string;
  legal_description: string;
  acquisition_date: string;
  purchase_price: string;
  seller_name: string;
  titled_in_name_of: string;
  deed_type: string;
  recorded_date: string;
  recording_document_number: string;
  is_financed: boolean;
  lender_name: string;
  linked_loan_id: string;
  property_use: string;
  authorized_by_meeting_id: string;
  notes: string;
  status: string;
  disposition_date: string;
  sale_price: string;
  buyer_name: string;
  disposition_doc_number: string;
  title_held_by_seller: boolean;
}

const emptyForm: FormState = {
  property_label: "",
  street_address: "",
  city: "",
  state: "",
  zip: "",
  county: "",
  parcel_id: "",
  legal_description: "",
  acquisition_date: "",
  purchase_price: "",
  seller_name: "",
  titled_in_name_of: "",
  deed_type: "",
  recorded_date: "",
  recording_document_number: "",
  is_financed: false,
  lender_name: "",
  linked_loan_id: "",
  property_use: "",
  authorized_by_meeting_id: "",
  notes: "",
  status: "Held",
  disposition_date: "",
  sale_price: "",
  buyer_name: "",
  disposition_doc_number: "",
  title_held_by_seller: false,
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString();
}

function toNumeric(v: string): number | null {
  const n = parseFloat(sanitizeCurrencyInput(v));
  return isFinite(n) ? n : null;
}

export default function RealPropertyTab({ companyId, companyName }: Props) {
  const queryClient = useQueryClient();
  // Read-only suggestions. This tab deliberately never calls
  // useAddressBook.upsert — writing back would revive hidden/renamed entries.
  const { search: searchAddressBook, getCompanySplitIndex } = useAddressBookContext(companyId);

  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<RealProperty | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["real_property", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("real_property")
        .select("*")
        .eq("company_id", companyId)
        .order("acquisition_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RealProperty[];
    },
    enabled: !!companyId,
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ["real_property_meetings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, meeting_type, meeting_date")
        .eq("company_id", companyId)
        .order("meeting_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: loans = [] } = useQuery({
    queryKey: ["real_property_loans", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_loans")
        .select("id, lender_name, loan_amount, loan_date, meetings!inner(company_id)")
        .eq("meetings.company_id", companyId)
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(
    () => (filter === "all" ? entries : entries.filter((e) => e.status === filter)),
    [entries, filter],
  );

  const set = <K extends keyof FormState>(field: K) => (value: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Auto-fill city/state once a 5-digit ZIP is entered (read-only suggestion —
  // the user can still type over either field).
  const { handleZipChange, isLoading: zipLoading, zipError, reset: resetZipLookup } =
    useZipLookup(({ city, state }) =>
      setForm((f) => ({ ...f, city, state })),
    );

  const openAdd = () => {
    setEditingId(null);
    resetZipLookup();
    setForm({ ...emptyForm, titled_in_name_of: companyName || "" });
    setDialogOpen(true);
  };

  const openEdit = (e: RealProperty) => {
    setEditingId(e.id);
    resetZipLookup();
    setForm({
      property_label: e.property_label || "",
      street_address: e.street_address || "",
      city: e.city || "",
      state: e.state || "",
      zip: e.zip || "",
      county: e.county || "",
      parcel_id: e.parcel_id || "",
      legal_description: e.legal_description || "",
      acquisition_date: e.acquisition_date || "",
      purchase_price: e.purchase_price != null ? String(e.purchase_price) : "",
      seller_name: e.seller_name || "",
      titled_in_name_of: e.titled_in_name_of || "",
      deed_type: e.deed_type || "",
      recorded_date: e.recorded_date || "",
      recording_document_number: e.recording_document_number || "",
      is_financed: !!e.is_financed,
      lender_name: e.lender_name || "",
      linked_loan_id: e.linked_loan_id || "",
      property_use: e.property_use || "",
      authorized_by_meeting_id: e.authorized_by_meeting_id || "",
      notes: e.notes || "",
      status: e.status || "Held",
      disposition_date: e.disposition_date || "",
      sale_price: e.sale_price != null ? String(e.sale_price) : "",
      buyer_name: e.buyer_name || "",
      disposition_doc_number: e.disposition_doc_number || "",
      title_held_by_seller: !!e.title_held_by_seller,
    });
    setDialogOpen(true);
  };

  /**
   * Land Contract auto-checks the vendee box, but never clears it and never
   * hides it: a contract since paid off is unchecked by hand, and switching
   * deed type away must not strand the recorded value.
   */
  const handleDeedTypeChange = (v: string) => {
    setForm((f) => ({
      ...f,
      deed_type: v,
      title_held_by_seller: v === "Land Contract" ? true : f.title_held_by_seller,
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.street_address.trim()) throw new Error("Street address is required.");
      if (!form.county.trim()) throw new Error("County is required.");
      if (!form.legal_description.trim()) throw new Error("Legal description is required.");
      if (!form.acquisition_date) throw new Error("Acquisition date is required.");
      if (!form.titled_in_name_of.trim()) throw new Error("Grantee name is required.");

      const payload: Record<string, any> = {
        company_id: companyId,
        property_label: form.property_label.trim() || form.street_address.trim(),
        street_address: form.street_address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        county: form.county.trim(),
        parcel_id: form.parcel_id.trim() || null,
        legal_description: form.legal_description.trim(),
        acquisition_date: form.acquisition_date,
        purchase_price: toNumeric(form.purchase_price),
        seller_name: form.seller_name.trim() || null,
        titled_in_name_of: form.titled_in_name_of.trim(),
        deed_type: form.deed_type || null,
        recorded_date: form.recorded_date || null,
        recording_document_number: form.recording_document_number.trim() || null,
        is_financed: form.is_financed,
        lender_name: form.is_financed ? form.lender_name.trim() || null : null,
        linked_loan_id: form.is_financed ? form.linked_loan_id || null : null,
        property_use: form.property_use || null,
        authorized_by_meeting_id: form.authorized_by_meeting_id || null,
        notes: form.notes.trim() || null,
        status: form.status,
        disposition_date: form.status !== "Held" ? form.disposition_date || null : null,
        sale_price: form.status !== "Held" ? toNumeric(form.sale_price) : null,
        buyer_name: form.status !== "Held" ? form.buyer_name.trim() || null : null,
        disposition_doc_number:
          form.status !== "Held" ? form.disposition_doc_number.trim() || null : null,
        title_held_by_seller: form.title_held_by_seller,
      };

      if (editingId) {
        const { error } = await supabase
          .from("real_property")
          .update(payload as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("real_property").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["real_property", companyId] });
      toast.success(editingId ? "Property updated." : "Property added.");
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save property."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("real_property").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["real_property", companyId] });
      toast.success("Property deleted.");
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete property."),
  });

  const granteeLabel = form.title_held_by_seller
    ? "Vendee (equitable title) *"
    : "Titled in name of *";

  return (
    <div className="space-y-4">
      {/* Header + filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-full px-3 text-xs shadow-none"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add entry
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border py-12 flex flex-col items-center gap-2">
          <Home className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {filter === "all"
              ? "No real property recorded yet."
              : "No properties with this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="group rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {e.property_label || e.street_address || "Untitled property"}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0 font-medium ${
                      STATUS_BADGE[e.status] || "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {e.status}
                  </Badge>
                  {e.title_held_by_seller && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0 font-medium bg-purple-500/10 text-purple-700 border-purple-500/25"
                    >
                      Land contract
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-x-4 gap-y-0.5 flex-wrap text-xs text-muted-foreground">
                  <span>{fmtDate(e.acquisition_date)}</span>
                  {e.county && (
                    <span className="whitespace-nowrap">
                      <span className="text-muted-foreground/70">County:</span> {e.county}
                    </span>
                  )}
                  {e.deed_type && (
                    <span className="whitespace-nowrap">
                      <span className="text-muted-foreground/70">Deed:</span> {e.deed_type}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {e.purchase_price != null && (
                  <div className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrencyDisplay(e.purchase_price)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(e)}
                  title="Edit property"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(e)}
                  title="Delete property"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="min-w-[680px] max-w-[720px] max-h-[85vh] overflow-y-auto"
          onInteractOutside={(ev) => ev.preventDefault()}
          onEscapeKeyDown={(ev) => ev.preventDefault()}
          onPointerDownOutside={(ev) => ev.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Property" : "Add Property"}</DialogTitle>
            <DialogDescription>
              Record the acquisition, the authority for it, the encumbrance, and eventually the sale.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Identification */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Identification
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Street Address *</Label>
                  <Input
                    value={form.street_address}
                    onChange={(ev) => set("street_address")(ev.target.value)}
                    placeholder="715 Woodland Plaza"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <Input value={form.city} onChange={(ev) => set("city")(ev.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">State</Label>
                    <Input value={form.state} onChange={(ev) => set("state")(ev.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">ZIP</Label>
                    <div className="relative">
                      <Input
                        value={form.zip}
                        onChange={(ev) => {
                          set("zip")(ev.target.value);
                          handleZipChange(ev.target.value);
                        }}
                      />
                      {zipLoading && (
                        <Loader2 className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {zipError && <p className="text-xs text-destructive">{zipError}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">County *</Label>
                  <Input
                    value={form.county}
                    onChange={(ev) => set("county")(ev.target.value)}
                    placeholder="Outagamie County, WI"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcel ID / Tax Key</Label>
                  <Input value={form.parcel_id} onChange={(ev) => set("parcel_id")(ev.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Property Label</Label>
                  <Input
                    value={form.property_label}
                    onChange={(ev) => set("property_label")(ev.target.value)}
                    placeholder="Defaults to the street address"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Legal Description *</Label>
                  <Textarea
                    rows={4}
                    value={form.legal_description}
                    onChange={(ev) => set("legal_description")(ev.target.value)}
                    placeholder="Copy verbatim from the deed"
                  />
                </div>
              </div>
            </section>

            {/* Acquisition */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acquisition
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Acquisition Date *</Label>
                  <DatePickerField
                    value={form.acquisition_date}
                    onChange={(v) => set("acquisition_date")(v)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Purchase Price *</Label>
                  <Input
                    value={form.purchase_price}
                    onChange={(ev) => set("purchase_price")(sanitizeCurrencyInput(ev.target.value))}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Seller (grantor)</Label>
                  <NameAutocomplete
                    value={form.seller_name}
                    onChange={(v) => set("seller_name")(v)}
                    onSelect={(entry) => set("seller_name")(entry.full_name)}
                    search={searchAddressBook}
                    getCompanySplitIndex={getCompanySplitIndex}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{granteeLabel}</Label>
                  <Input
                    value={form.titled_in_name_of}
                    onChange={(ev) => set("titled_in_name_of")(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Deed Type</Label>
                  <Select value={form.deed_type} onValueChange={handleDeedTypeChange}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {DEED_TYPES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Recorded Date</Label>
                  <DatePickerField
                    value={form.recorded_date}
                    onChange={(v) => set("recorded_date")(v)}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Recording Document Number</Label>
                  <Input
                    value={form.recording_document_number}
                    onChange={(ev) => set("recording_document_number")(ev.target.value)}
                  />
                </div>
                <div className="col-span-2 flex items-start gap-2 rounded-md border border-border p-3">
                  <Checkbox
                    id="title_held_by_seller"
                    checked={form.title_held_by_seller}
                    onCheckedChange={(c) => set("title_held_by_seller")(c === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="title_held_by_seller" className="text-xs cursor-pointer">
                      Title held by seller (land contract)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Auto-checked when the deed type is Land Contract. Uncheck it once the
                      contract has been paid off and legal title conveyed.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Encumbrance */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Encumbrance
              </h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_financed"
                  checked={form.is_financed}
                  onCheckedChange={(c) => set("is_financed")(c === true)}
                />
                <Label htmlFor="is_financed" className="text-xs cursor-pointer">
                  Property is financed
                </Label>
              </div>
              {form.is_financed && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lender (mortgagee)</Label>
                    <Input
                      value={form.lender_name}
                      onChange={(ev) => set("lender_name")(ev.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Linked Note</Label>
                    <Select
                      value={form.linked_loan_id}
                      onValueChange={(v) => set("linked_loan_id")(v)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select a note..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {loans.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {(l.lender_name || "Lender") +
                              (l.loan_amount != null
                                ? ` — ${formatCurrencyDisplay(l.loan_amount)}`
                                : "")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </section>

            {/* Use and authorization */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Use and Authorization
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Property Use</Label>
                  <Select value={form.property_use} onValueChange={(v) => set("property_use")(v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {PROPERTY_USES.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.property_use === "Leased to a related party" && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Related-party leases draw scrutiny — record the lease terms on the Leases tab.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Authorized By</Label>
                  <Select
                    value={form.authorized_by_meeting_id}
                    onValueChange={(v) => set("authorized_by_meeting_id")(v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select a meeting..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {meetings.map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.meeting_type} — {fmtDate(m.meeting_date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(ev) => set("notes")(ev.target.value)}
                    placeholder="Easements, right of first refusal, anything without its own field"
                  />
                </div>
              </div>
            </section>

            {/* Disposition */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status *</Label>
                  <Select value={form.status} onValueChange={(v) => set("status")(v)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.status !== "Held" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Disposition Date</Label>
                      <DatePickerField
                        value={form.disposition_date}
                        onChange={(v) => set("disposition_date")(v)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sale Price</Label>
                      <Input
                        value={form.sale_price}
                        onChange={(ev) => set("sale_price")(sanitizeCurrencyInput(ev.target.value))}
                        placeholder="0.00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Buyer (grantee)</Label>
                      <NameAutocomplete
                        value={form.buyer_name}
                        onChange={(v) => set("buyer_name")(v)}
                        onSelect={(entry) => set("buyer_name")(entry.full_name)}
                        search={searchAddressBook}
                        getCompanySplitIndex={getCompanySplitIndex}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Disposition Document Number</Label>
                      <Input
                        value={form.disposition_doc_number}
                        onChange={(ev) => set("disposition_doc_number")(ev.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Property"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Property"
        description="This permanently removes this real property record. This cannot be undone."
      />
    </div>
  );
}
