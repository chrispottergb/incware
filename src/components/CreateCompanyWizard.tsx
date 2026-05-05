import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useZipLookup } from "@/hooks/useZipLookup";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import NameAutocomplete from "@/components/NameAutocomplete";
import DbAddressAutocomplete from "@/components/ui/db-address-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle2, Building2, Users, AlertTriangle, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import TaxReturnUpload from "@/components/TaxReturnUpload";
import { Upload } from "lucide-react";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { getNextCertificateNumber, validateIssuanceLimit } from "@/lib/transaction-validation";
import { DatePickerField } from "@/components/ui/date-picker-field";

const ENTITY_TYPES = ["Corporation", "LLC", "LLC-S", "Single Member LLC", "S-Corp", "Non-Profit", "Partnership"];
const CORP_TYPES = ["Corporation", "S-Corp"];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const CONSIDERATION_TYPES = ["Cash", "Property", "Services", "Gift"];

interface InitialShareholder {
  name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  ssn_ein: string;
  num_shares: number;
  share_class: string;
  cert_number: string;
  consideration: string;
  consideration_type: string;
  notes: string;
}

const emptyShareholder = (): InitialShareholder => ({
  name: "", address: "", address_2: "", city: "", state: "", zip: "", ssn_ein: "", num_shares: 0, share_class: "Common",
  cert_number: "", consideration: "", consideration_type: "Cash", notes: "",
});

interface InitialDirector {
  name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
}

const emptyDirector = (): InitialDirector => ({
  name: "", address: "", address_2: "", city: "", state: "", zip: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCompanyWizard({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Flow type: null = step 0 (choose), "new" = existing flow, "existing" = opening balance flow
  const [flowType, setFlowType] = useState<"new" | "existing" | null>(null);

  // Step 1: Company info
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("Corporation");
  const [newState, setNewState] = useState("");
  const [authorizedShares, setAuthorizedShares] = useState("");
  const [parValue, setParValue] = useState("");
  const [parValueType, setParValueType] = useState("par");

  // Existing entity: opening balance date
  const [openingBalanceDate, setOpeningBalanceDate] = useState("");

  // Step 2: Shareholders
  const [shareholders, setShareholders] = useState<InitialShareholder[]>([]);
  const [editingSh, setEditingSh] = useState<InitialShareholder>(emptyShareholder());
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Step 2 (corps): Directors — separate from shareholders
  const [directors, setDirectors] = useState<InitialDirector[]>([]);
  const [editingDir, setEditingDir] = useState<InitialDirector>(emptyDirector());
  const [editingDirIdx, setEditingDirIdx] = useState<number | null>(null);

  // Existing entity: confirmation
  const [confirmOwnership, setConfirmOwnership] = useState(false);

  // Zip lookup for shareholder form
  const handleZipResult = useCallback((result: { city: string; state: string }) => {
    setEditingSh(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange, isLoading: zipLoading, zipError } = useZipLookup(handleZipResult);

  // Zip lookup for director form
  const handleDirZipResult = useCallback((result: { city: string; state: string }) => {
    setEditingDir(prev => ({ ...prev, city: result.city, state: result.state }));
  }, []);
  const { handleZipChange: handleDirZipChange, zipError: dirZipError } = useZipLookup(handleDirZipResult);

  const { search: searchAddressBook, getCompanySplitIndex, upsert: upsertAddressBook } = useAddressBookContext();

  const handleAddressSelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setEditingSh(prev => ({
      ...prev,
      name: entry.full_name,
      address: entry.address || "",
      address_2: entry.address_2 || "",
      city: entry.city || "",
      state: entry.state || "",
      zip: entry.zip || "",
    }));
  }, []);

  const handleDirAddressSelect = useCallback((entry: { full_name: string; address?: string | null; address_2?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => {
    setEditingDir(prev => ({
      ...prev,
      name: entry.full_name,
      address: entry.address || "",
      address_2: entry.address_2 || "",
      city: entry.city || "",
      state: entry.state || "",
      zip: entry.zip || "",
    }));
  }, []);

  const isCorp = CORP_TYPES.includes(newType);
  const isLLC = isLLCType(newType);
  const term = getTerminology(newType);
  const authSharesNum = parseInt(authorizedShares) || 0;
  const totalIssuedShares = shareholders.reduce((sum, s) => sum + s.num_shares, 0);
  const availableShares = authSharesNum - totalIssuedShares;

  const resetAll = () => {
    setStep(0);
    setFlowType(null);
    setNewName("");
    setNewType("Corporation");
    setNewState("");
    setAuthorizedShares("");
    setParValue("");
    setParValueType("par");
    setShareholders([]);
    setEditingSh(emptyShareholder());
    setEditingIdx(null);
    setDirectors([]);
    setEditingDir(emptyDirector());
    setEditingDirIdx(null);
    setSaving(false);
    setOpeningBalanceDate("");
    setConfirmOwnership(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetAll, 300);
  };

  // Add/update shareholder in list
  const addShareholder = () => {
    if (!editingSh.name.trim() || editingSh.num_shares <= 0) {
      toast.error(`Name and number of ${term.shareUnit.toLowerCase()} are required.`);
      return;
    }
    if (flowType === "existing" && !editingSh.cert_number.trim()) {
      toast.error("Certificate number is required for existing entity setup.");
      return;
    }
    if (flowType === "existing" && isLLC && !editingSh.consideration.trim()) {
      toast.error("Consideration amount is required for LLC members.");
      return;
    }
    if (isCorp) {
      const currentAvailable = availableShares + (editingIdx !== null ? shareholders[editingIdx].num_shares : 0);
      const validation = validateIssuanceLimit(editingSh.num_shares, authSharesNum > 0 ? currentAvailable : null, term);
      if (!validation.valid) {
        toast.error(validation.message!);
        return;
      }
    }
    // Check cert number uniqueness within the form
    if (flowType === "existing" && editingSh.cert_number.trim()) {
      const dupIdx = shareholders.findIndex((s, i) => i !== editingIdx && s.cert_number.trim() === editingSh.cert_number.trim());
      if (dupIdx !== -1) {
        toast.error(`Certificate number ${editingSh.cert_number} is already assigned to ${shareholders[dupIdx].name}.`);
        return;
      }
    }
    if (editingIdx !== null) {
      setShareholders(prev => prev.map((s, i) => i === editingIdx ? { ...editingSh } : s));
    } else {
      setShareholders(prev => [...prev, { ...editingSh }]);
    }
    // Save to address book
    upsertAddressBook.mutate({
      full_name: editingSh.name.trim(),
      address: editingSh.address,
      address_2: editingSh.address_2,
      city: editingSh.city,
      state: editingSh.state,
      zip: editingSh.zip,
    });
    setEditingSh(emptyShareholder());
    setEditingIdx(null);
  };

  const removeShareholder = (idx: number) => {
    setShareholders(prev => prev.filter((_, i) => i !== idx));
  };

  const editShareholder = (idx: number) => {
    setEditingSh({ ...shareholders[idx] });
    setEditingIdx(idx);
  };
  // Add/update director in list (name-only validation)
  const addDirector = () => {
    if (!editingDir.name.trim()) {
      toast.error("Full Legal Name is required.");
      return;
    }
    if (editingDirIdx !== null) {
      setDirectors(prev => prev.map((d, i) => i === editingDirIdx ? { ...editingDir } : d));
    } else {
      setDirectors(prev => [...prev, { ...editingDir }]);
    }
    upsertAddressBook.mutate({
      full_name: editingDir.name.trim(),
      address: editingDir.address,
      address_2: editingDir.address_2,
      city: editingDir.city,
      state: editingDir.state,
      zip: editingDir.zip,
    });
    setEditingDir(emptyDirector());
    setEditingDirIdx(null);
  };

  const removeDirector = (idx: number) => {
    setDirectors(prev => prev.filter((_, i) => i !== idx));
  };

  const editDirectorEntry = (idx: number) => {
    setEditingDir({ ...directors[idx] });
    setEditingDirIdx(idx);
  };


  const handleSave = async () => {
    setSaving(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Create company
      const { data: company, error: compErr } = await supabase.from("companies").insert({
        user_id: user!.id,
        name: newName,
        entity_type: newType,
        state_of_incorporation: newState || null,
        authorized_shares: isCorp ? authSharesNum || null : null,
        par_value: parValueType === "par" ? (parseFloat(parValue) || null) : null,
        par_value_type: parValueType,
        fiscal_year_end: "December 31",
      }).select("id").single();
      if (compErr) throw compErr;

      const companyId = company.id;

      // 2. For Corp shareholders: create shareholder + cert + ledger entry
      if (isCorp && shareholders.length > 0) {
        let certNumber = await getNextCertificateNumber(companyId) - 1;

        for (const sh of shareholders) {
          const { data: shRecord, error: shErr } = await supabase.from("shareholders").insert({
            company_id: companyId,
            name: sh.name,
            address: sh.address || null,
            address_2: sh.address_2 || null,
            city: sh.city || null,
            state: sh.state || null,
            zip: sh.zip || null,
            status: "active",
            date_added: todayStr,
          }).select("id").single();
          if (shErr) throw shErr;

          if (sh.ssn_ein?.trim()) {
            await supabase.functions.invoke("encrypt-ssn", {
              body: { shareholder_id: shRecord.id, ssn_ein: sh.ssn_ein.trim() },
            });
          }

          if (sh.num_shares > 0) {
            certNumber++;
            const { data: cert, error: certErr } = await supabase.from("stock_certificates").insert({
              company_id: companyId,
              certificate_number: certNumber,
              shareholder_id: shRecord.id,
              share_class: sh.share_class,
              num_shares: sh.num_shares,
              issue_date: todayStr,
              par_value: parValueType === "par" ? (parseFloat(parValue) || null) : null,
            }).select("id").single();
            if (certErr) throw certErr;

            await supabase.from("share_transactions").insert({
              company_id: companyId,
              transaction_type: "initial_issuance",
              shareholder_id: shRecord.id,
              share_class: sh.share_class,
              num_shares: sh.num_shares,
              transaction_date: todayStr,
              effective_date: todayStr,
              to_shareholder: sh.name,
              from_shareholder: "Treasury",
              certificate_id: cert.id,
              consideration_type: "cash",
              issued_certificate_number: certNumber,
              par_value: parValueType === "par" ? (parseFloat(parValue) || null) : null,
            });
          }
        }

        await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
      }

      // 2b. For LLC members: create member + cert + ledger entry
      if (isLLC && shareholders.length > 0) {
        let certNumber = await getNextCertificateNumber(companyId) - 1;

        for (const sh of shareholders) {
          const { data: shRecord, error: shErr } = await supabase.from("shareholders").insert({
            company_id: companyId,
            name: sh.name,
            address: sh.address || null,
            address_2: sh.address_2 || null,
            city: sh.city || null,
            state: sh.state || null,
            zip: sh.zip || null,
            status: "active",
            date_added: todayStr,
          }).select("id").single();
          if (shErr) throw shErr;

          if (sh.ssn_ein?.trim()) {
            await supabase.functions.invoke("encrypt-ssn", {
              body: { shareholder_id: shRecord.id, ssn_ein: sh.ssn_ein.trim() },
            });
          }

          if (sh.num_shares > 0) {
            certNumber++;
            const { data: cert, error: certErr } = await supabase.from("stock_certificates").insert({
              company_id: companyId,
              certificate_number: certNumber,
              shareholder_id: shRecord.id,
              share_class: sh.share_class || "Membership",
              num_shares: sh.num_shares,
              issue_date: todayStr,
            }).select("id").single();
            if (certErr) throw certErr;

            await supabase.from("share_transactions").insert({
              company_id: companyId,
              transaction_type: "membership_issuance",
              shareholder_id: shRecord.id,
              share_class: sh.share_class || "Membership",
              num_shares: sh.num_shares,
              transaction_date: todayStr,
              effective_date: todayStr,
              to_shareholder: sh.name,
              from_shareholder: "Company",
              certificate_id: cert.id,
              consideration_type: "cash",
              issued_certificate_number: certNumber,
            });
          }
        }

        await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });
      }

      // 3. For each director, create director record
      for (const dir of directors) {
        await supabase.from("directors").insert({
          company_id: companyId,
          name: dir.name,
          address: dir.address || null,
          address_2: dir.address_2 || null,
          city: dir.city || null,
          state: dir.state || null,
          zip: dir.zip || null,
          added_date: todayStr,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company created successfully!");
      handleClose();
      navigate(`/company/${companyId}`);
    } catch (err) {
      console.error("Create company error:", err);
      toast.error("Failed to create company. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // --- EXISTING ENTITY SAVE ---
  const handleSaveExisting = async () => {
    setSaving(true);
    try {
      // 1. Create company with opening_balance_date
      const { data: company, error: compErr } = await supabase.from("companies").insert({
        user_id: user!.id,
        name: newName,
        entity_type: newType,
        state_of_incorporation: newState || null,
        authorized_shares: isCorp ? authSharesNum || null : null,
        par_value: parValueType === "par" ? (parseFloat(parValue) || null) : null,
        par_value_type: parValueType,
        fiscal_year_end: "December 31",
        opening_balance_date: openingBalanceDate,
      } as any).select("id").single();
      if (compErr) throw compErr;

      const companyId = company.id;

      // 2. For each shareholder/member
      for (const sh of shareholders) {
        // Insert shareholder
        const { data: shRecord, error: shErr } = await supabase.from("shareholders").insert({
          company_id: companyId,
          name: sh.name,
          address: sh.address || null,
          address_2: sh.address_2 || null,
          city: sh.city || null,
          state: sh.state || null,
          zip: sh.zip || null,
          status: "active",
          date_added: openingBalanceDate,
        }).select("id").single();
        if (shErr) throw shErr;

        // Encrypt SSN/EIN if provided
        if (sh.ssn_ein?.trim()) {
          await supabase.functions.invoke("encrypt-ssn", {
            body: { shareholder_id: shRecord.id, ssn_ein: sh.ssn_ein.trim() },
          });
        }

        const certNum = parseInt(sh.cert_number) || 0;

        if (sh.num_shares > 0 && certNum > 0) {
          // Check cert collision
          const { data: existingCert } = await supabase
            .from("stock_certificates")
            .select("id")
            .eq("company_id", companyId)
            .eq("certificate_number", certNum)
            .maybeSingle();

          if (existingCert) {
            throw new Error(`Cert #${certNum} already exists for this company. Please verify the correct certificate number.`);
          }

          // Insert stock certificate with user-entered cert number
          const { data: cert, error: certErr } = await supabase.from("stock_certificates").insert({
            company_id: companyId,
            certificate_number: certNum,
            shareholder_id: shRecord.id,
            share_class: sh.share_class || (isLLC ? "Membership" : "Common"),
            num_shares: sh.num_shares,
            issue_date: openingBalanceDate,
            par_value: isCorp && parValueType === "par" ? (parseFloat(parValue) || null) : null,
          }).select("id").single();
          if (certErr) throw certErr;

          // Insert opening balance transaction
          const consideration = parseFloat(sh.consideration) || 0;
          await supabase.from("share_transactions").insert({
            company_id: companyId,
            transaction_type: "opening_balance",
            entry_type: "opening_balance",
            shareholder_id: shRecord.id,
            share_class: sh.share_class || (isLLC ? "Membership" : "Common"),
            num_shares: sh.num_shares,
            transaction_date: openingBalanceDate,
            effective_date: openingBalanceDate,
            to_shareholder: sh.name,
            from_shareholder: "Pre-existing Ownership",
            certificate_id: cert.id,
            consideration_type: sh.consideration_type?.toLowerCase() || "cash",
            total_consideration: consideration || null,
            issued_certificate_number: certNum,
            par_value: isCorp && parValueType === "par" ? (parseFloat(parValue) || null) : null,
            notes: sh.notes?.trim() ? sh.notes.trim() : `Opening balance established as of ${openingBalanceDate}`,
          } as any);

          // Insert bills_of_sale (equity transaction)
          await supabase.from("bills_of_sale").insert({
            company_id: companyId,
            shareholder_id: shRecord.id,
            seller_name: "Pre-existing Ownership",
            buyer_name: sh.name,
            num_shares: sh.num_shares,
            share_class: sh.share_class || (isLLC ? "Membership" : "Common"),
            price_per_share: null,
            total_price: consideration || null,
            sale_date: openingBalanceDate,
            equity_type: "Opening Balance",
          });
        }

        // Save to address book
        upsertAddressBook.mutate({
          full_name: sh.name.trim(),
          address: sh.address,
          address_2: sh.address_2,
          city: sh.city,
          state: sh.state,
          zip: sh.zip,
        });
      }

      // Recalculate ownership percentages
      await supabase.rpc("recalculate_ownership_percentages", { p_company_id: companyId });

      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Existing entity created with opening balances!");
      handleClose();
      navigate(`/company/${companyId}`);
    } catch (err: any) {
      console.error("Create existing entity error:", err);
      toast.error(err.message || "Failed to create entity");
    } finally {
      setSaving(false);
    }
  };

  const canProceedStep1 = newName.trim().length > 0;
  const showStep2 = isCorp || isLLC;

  // --- Step indicators ---
  const renderStepIndicators = () => {
    if (flowType === "existing") {
      return (
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex-wrap">
          <span className={step >= 1 ? "text-primary font-semibold" : ""}>1. Company</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step >= 2 ? "text-primary font-semibold" : ""}>2. As-Of Date</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step >= 3 ? "text-primary font-semibold" : ""}>3. {term.shareholders}</span>
          <ArrowRight className="h-3 w-3" />
          <span className={step >= 4 ? "text-primary font-semibold" : ""}>4. Review</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        <span className={step >= 1 ? "text-primary font-semibold" : ""}>1. Company</span>
        <ArrowRight className="h-3 w-3" />
        <span className={step >= 2 ? "text-primary font-semibold" : ""}>
          2. {isCorp ? "Initial Directors" : isLLC ? "Initial Members" : "Skip"}
        </span>
        <ArrowRight className="h-3 w-3" />
        <span className={step >= 3 ? "text-primary font-semibold" : ""}>3. Review</span>
      </div>
    );
  };

  // Shareholder form for existing entity flow
  const renderExistingShareholderForm = () => (
    <div className="rounded-md border border-border p-3 space-y-2">
      <p className="text-xs font-semibold flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-primary" />
        {editingIdx !== null ? `Edit ${term.shareholder}` : `Add Current ${term.shareholder}`}
      </p>
      <div className="field-group">
        <Label className="field-label">Full Legal Name</Label>
        <NameAutocomplete
          value={editingSh.name}
          onChange={(v) => setEditingSh(p => ({ ...p, name: v }))}
          onSelect={handleAddressSelect}
          search={searchAddressBook}
          getCompanySplitIndex={getCompanySplitIndex}
          className="h-7 text-xs"
          placeholder="Start typing a name..."
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="field-group">
          <Label className="field-label">Address</Label>
          <DbAddressAutocomplete className="h-7 text-xs" value={editingSh.address} onChange={(v) => setEditingSh(p => ({ ...p, address: v }))} onSelect={(addr) => { setEditingSh(p => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip })); }} source="shareholders" />
        </div>
        <div className="field-group">
          <Label className="field-label">Address 2</Label>
          <Input className="h-7 text-xs" value={editingSh.address_2} onChange={(e) => setEditingSh(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor" />
        </div>
      </div>
      <div className="grid grid-cols-[2fr_60px_80px] gap-1.5">
        <div className="field-group">
          <Label className="field-label">City</Label>
          <Input className="h-7 text-xs" value={editingSh.city} onChange={(e) => setEditingSh(p => ({ ...p, city: e.target.value }))} />
        </div>
        <div className="field-group">
          <Label className="field-label">State</Label>
          <Select value={editingSh.state} onValueChange={(v) => setEditingSh(p => ({ ...p, state: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="ST" /></SelectTrigger>
            <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="field-group">
          <Label className="field-label">Zip</Label>
          <Input className="h-7 text-xs" value={editingSh.zip} onChange={(e) => { setEditingSh(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} />
          {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="field-group">
          <Label className="field-label">SSN / EIN (optional)</Label>
          <Input className="h-7 text-xs" value={editingSh.ssn_ein} onChange={(e) => setEditingSh(p => ({ ...p, ssn_ein: e.target.value }))} />
        </div>
        <div className="field-group">
          <Label className="field-label">{term.classLabel}</Label>
          <Select value={editingSh.share_class || term.defaultClass} onValueChange={(v) => setEditingSh(p => ({ ...p, share_class: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {term.classOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-1.5 w-full">
        <div className="field-group w-[90px] shrink-0">
          <Label className="field-label whitespace-nowrap">{term.numUnitsLabel}</Label>
          <Input className="h-7 text-xs" type="number" step="0.0001" value={editingSh.num_shares || ""} onChange={(e) => setEditingSh(p => ({ ...p, num_shares: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="field-group">
          <Label className="field-label">Current Cert #</Label>
          <Input className="h-7 text-xs" type="number" value={editingSh.cert_number} onChange={(e) => setEditingSh(p => ({ ...p, cert_number: e.target.value }))} placeholder="e.g. 1" />
        </div>
        <div className="field-group">
          <Label className="field-label whitespace-nowrap">Consideration Type</Label>
          <Select value={editingSh.consideration_type || "Cash"} onValueChange={(v) => setEditingSh(p => ({ ...p, consideration_type: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONSIDERATION_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="field-group">
        <Label className="field-label">Consideration Amount ($){isLLC ? " — required" : " — optional"}</Label>
        <Input className="h-7 text-xs" type="number" step="0.01" value={editingSh.consideration} onChange={(e) => setEditingSh(p => ({ ...p, consideration: e.target.value }))} placeholder="0.00" />
      </div>
      <div className="field-group">
        <Label className="field-label">Notes / Memo</Label>
        <Input className="h-7 text-xs" value={editingSh.notes} onChange={(e) => setEditingSh(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes about this opening balance" />
      </div>
      <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={addShareholder}>
        <Plus className="mr-1 h-3 w-3" /> {editingIdx !== null ? "Update" : "+ Add"} {term.shareholder}
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            New Company
          </DialogTitle>
        </DialogHeader>

        {/* Step 0: Choose flow type */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">How would you like to set up this entity?</p>
            <div
              className="rounded-md border-2 border-border hover:border-primary/50 p-4 cursor-pointer transition-colors space-y-1"
              onClick={() => { setFlowType("new"); setStep(1); }}
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                New Entity — Set up from formation
              </p>
              <p className="text-xs text-muted-foreground">
                This entity is being formed now. You will enter initial directors, shareholders, or members as part of the incorporation/organization process.
              </p>
            </div>
            <div
              className="rounded-md border-2 border-border hover:border-primary/50 p-4 cursor-pointer transition-colors space-y-1"
              onClick={() => { setFlowType("existing"); setStep(1); }}
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Existing Entity — Establish current ownership as of a date
              </p>
              <p className="text-xs text-muted-foreground">
                This entity was already formed before today. You will enter the current ownership state (who holds what) as of a specific date, and all future transactions will be recorded from that point forward.
              </p>
            </div>
          </div>
        )}

        {/* Step indicators */}
        {step > 0 && renderStepIndicators()}

        {/* Step 1: Company Details — same for both flows */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="field-group">
              <Label className="field-label">Company Name</Label>
              <Input className="h-8 text-sm" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Corp" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="field-group">
                <Label className="field-label">Entity Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label className="field-label">State of Incorporation</Label>
                <Select value={newState} onValueChange={setNewState}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isCorp && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field-group">
                    <Label className="field-label">Authorized Shares</Label>
                    <Input className="h-8 text-sm" type="number" value={authorizedShares} onChange={(e) => setAuthorizedShares(e.target.value)} placeholder="e.g. 10000" />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Par Value Type</Label>
                    <Select value={parValueType} onValueChange={setParValueType}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="par">Par Value</SelectItem>
                        <SelectItem value="no_par">No Par Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {parValueType === "par" && (
                  <div className="field-group">
                    <Label className="field-label">Par Value per Share ($)</Label>
                    <Input className="h-8 text-sm" type="number" step="1" value={parValue} onChange={(e) => setParValue(e.target.value)} placeholder="e.g. 1" />
                  </div>
                )}
              </>
            )}

            {flowType === "new" && (
              <>
                <div className="relative flex items-center py-1">
                  <div className="flex-1 border-t border-border" />
                  <span className="mx-3 text-xs text-muted-foreground">or</span>
                  <div className="flex-1 border-t border-border" />
                </div>

                <TaxReturnUpload
                  mode="populate"
                  onCompanyCreated={(id) => {
                    queryClient.invalidateQueries({ queryKey: ["companies"] });
                    handleClose();
                    navigate(`/company/${id}`);
                  }}
                  trigger={
                    <Button variant="outline" className="w-full" size="sm">
                      <Upload className="mr-2 h-3.5 w-3.5" /> Import from Tax Return
                    </Button>
                  }
                />
              </>
            )}

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => { setStep(0); setFlowType(null); }}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              {flowType === "new" ? (
                <Button size="sm" onClick={() => setStep(showStep2 ? 2 : 3)} disabled={!canProceedStep1}>
                  {showStep2 ? (isCorp ? "Add Initial Directors" : "Add Initial Members") : "Review"} <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStep(2)} disabled={!canProceedStep1}>
                  Set As-Of Date <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {/* Step 2 for EXISTING flow: As-Of Date */}
        {step === 2 && flowType === "existing" && (
          <div className="space-y-3">
            <div className="field-group">
              <Label className="field-label">What is the current ownership as of what date?</Label>
              <DatePickerField
                value={openingBalanceDate}
                onChange={setOpeningBalanceDate}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <Alert className="border-warning bg-warning">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-xs text-warning">
                All future transactions must be dated on or after this date. This date becomes the permanent starting point for this entity's ownership records.
              </AlertDescription>
            </Alert>
            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)} disabled={!openingBalanceDate}>
                Add {term.shareholders} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2 for NEW flow (Corps): Initial Directors */}
        {step === 2 && flowType === "new" && isCorp && (
          <div className="space-y-3">
            {/* Director entry form */}
            <div className="rounded-md border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {editingDirIdx !== null ? "Edit Director" : "Add Initial Director"}
              </p>
              <div className="field-group">
                <Label className="field-label">Full Legal Name</Label>
                <NameAutocomplete
                  value={editingDir.name}
                  onChange={(v) => setEditingDir(p => ({ ...p, name: v }))}
                  onSelect={handleDirAddressSelect}
                  search={searchAddressBook}
                  getCompanySplitIndex={getCompanySplitIndex}
                  className="h-7 text-xs"
                  placeholder="Start typing a name..."
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Address</Label>
                <DbAddressAutocomplete className="h-7 text-xs" value={editingDir.address} onChange={(v) => setEditingDir(p => ({ ...p, address: v }))} onSelect={(addr) => { setEditingDir(p => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip })); }} source="companies" />
              </div>
              <div className="field-group">
                <Label className="field-label">Address 2</Label>
                <Input className="h-7 text-xs" value={editingDir.address_2} onChange={(e) => setEditingDir(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="field-group">
                  <Label className="field-label">City</Label>
                  <Input className="h-7 text-xs" value={editingDir.city} onChange={(e) => setEditingDir(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Select value={editingDir.state} onValueChange={(v) => setEditingDir(p => ({ ...p, state: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="ST" /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Zip</Label>
                  <Input className="h-7 text-xs" value={editingDir.zip} onChange={(e) => { setEditingDir(p => ({ ...p, zip: e.target.value })); handleDirZipChange(e.target.value); }} />
                  {dirZipError && <p className="text-[10px] text-destructive mt-0.5">{dirZipError}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={addDirector}>
                <Plus className="mr-1 h-3 w-3" /> {editingDirIdx !== null ? "Update" : "+ Add"} Initial Director
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Initial Directors are appointed at the time of incorporation and serve at the organizational meeting until the shareholders are established and the permanent Board of Directors is elected.
            </p>

            {/* Added directors list */}
            {directors.length > 0 && (
              <div className="rounded-md border border-border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">City</TableHead>
                      <TableHead className="text-[10px]">State</TableHead>
                      <TableHead className="text-[10px] w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directors.map((dir, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{dir.name}</TableCell>
                        <TableCell className="text-xs">{dir.city || "—"}</TableCell>
                        <TableCell className="text-xs">{dir.state || "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => editDirectorEntry(i)}>
                              <Users className="h-2.5 w-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeDirector(i)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Review <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2 for NEW flow (LLCs): Initial Members */}
        {step === 2 && flowType === "new" && isLLC && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                {editingIdx !== null ? `Edit ${term.shareholder}` : `Add Initial ${term.shareholder}`}
              </p>
              <div className="field-group">
                <Label className="field-label">Full Legal Name</Label>
                <NameAutocomplete
                  value={editingSh.name}
                  onChange={(v) => setEditingSh(p => ({ ...p, name: v }))}
                  onSelect={handleAddressSelect}
                  search={searchAddressBook}
                  getCompanySplitIndex={getCompanySplitIndex}
                  className="h-7 text-xs"
                  placeholder="Start typing a name..."
                />
              </div>
              <div className="field-group">
                <Label className="field-label">Address</Label>
                <DbAddressAutocomplete className="h-7 text-xs" value={editingSh.address} onChange={(v) => setEditingSh(p => ({ ...p, address: v }))} onSelect={(addr) => { setEditingSh(p => ({ ...p, address: addr.line1, address_2: addr.line2, city: addr.city, state: addr.state, zip: addr.zip })); }} source="shareholders" />
              </div>
              <div className="field-group">
                <Label className="field-label">Address 2</Label>
                <Input className="h-7 text-xs" value={editingSh.address_2} onChange={(e) => setEditingSh(p => ({ ...p, address_2: e.target.value }))} placeholder="Suite, Unit, Floor" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="field-group">
                  <Label className="field-label">City</Label>
                  <Input className="h-7 text-xs" value={editingSh.city} onChange={(e) => setEditingSh(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">State</Label>
                  <Select value={editingSh.state} onValueChange={(v) => setEditingSh(p => ({ ...p, state: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="ST" /></SelectTrigger>
                    <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label className="field-label">Zip</Label>
                  <Input className="h-7 text-xs" value={editingSh.zip} onChange={(e) => { setEditingSh(p => ({ ...p, zip: e.target.value })); handleZipChange(e.target.value); }} />
                  {zipError && <p className="text-[10px] text-destructive mt-0.5">{zipError}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="field-group">
                  <Label className="field-label">SSN / EIN</Label>
                  <Input className="h-7 text-xs" value={editingSh.ssn_ein} onChange={(e) => setEditingSh(p => ({ ...p, ssn_ein: e.target.value }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.numUnitsLabel}</Label>
                  <Input className="h-7 text-xs" type="number" step="0.0001" value={editingSh.num_shares || ""} onChange={(e) => setEditingSh(p => ({ ...p, num_shares: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="field-group">
                  <Label className="field-label">{term.classLabel}</Label>
                  <Select value={editingSh.share_class || term.defaultClass} onValueChange={(v) => setEditingSh(p => ({ ...p, share_class: v }))}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {term.classOptions.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={addShareholder}>
                <Plus className="mr-1 h-3 w-3" /> {editingIdx !== null ? "Update" : "+ Add"} Initial {term.shareholder}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Initial {term.shareholders} are recorded at the time of formation. {term.shareUnit} and interest percentages can be adjusted later from the company detail page.
            </p>

            {shareholders.length > 0 && (
              <div className="rounded-md border border-border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">{term.numUnitsLabel}</TableHead>
                      <TableHead className="text-[10px]">{term.classLabel}</TableHead>
                      <TableHead className="text-[10px] w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareholders.map((sh, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{sh.name}</TableCell>
                        <TableCell className="text-xs">{sh.num_shares.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{sh.share_class || term.defaultClass}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => editShareholder(i)}>
                              <Users className="h-2.5 w-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeShareholder(i)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep(3)}>
                Review <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3 for EXISTING flow: Enter Shareholders/Members */}
        {step === 3 && flowType === "existing" && (
          <div className="space-y-3">
            {renderExistingShareholderForm()}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enter all current {term.shareholders.toLowerCase()} and their holdings as of {openingBalanceDate ? new Date(openingBalanceDate + "T00:00:00").toLocaleDateString() : "the selected date"}.
            </p>

            {shareholders.length > 0 && (
              <div className="rounded-md border border-border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">{term.numUnitsLabel}</TableHead>
                      <TableHead className="text-[10px]">Cert #</TableHead>
                      <TableHead className="text-[10px]">Consideration</TableHead>
                      <TableHead className="text-[10px] w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareholders.map((sh, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{sh.name}</TableCell>
                        <TableCell className="text-xs">{sh.num_shares.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">#{sh.cert_number}</TableCell>
                        <TableCell className="text-xs">{sh.consideration ? `$${parseFloat(sh.consideration).toLocaleString()}` : "—"}</TableCell>
                        <TableCell>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => editShareholder(i)}>
                              <Users className="h-2.5 w-2.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeShareholder(i)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={() => setStep(4)} disabled={shareholders.length === 0}>
                Review <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3 for NEW flow: Review & Create */}
        {step === 3 && flowType === "new" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-sm">{newName}</p>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Entity Type:</span>
                <span>{newType}</span>
                <span className="text-muted-foreground">State:</span>
                <span>{newState || "—"}</span>
                {isCorp && authSharesNum > 0 && (
                  <>
                    <span className="text-muted-foreground">Authorized Shares:</span>
                    <span>{authSharesNum.toLocaleString()}</span>
                    <span className="text-muted-foreground">Par Value:</span>
                    <span>{parValueType === "par" ? `$${parValue || "0"}` : "No Par Value"}</span>
                  </>
                )}
              </div>
            </div>

            {directors.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1.5">
                <p className="font-medium text-foreground">Initial Directors ({directors.length}):</p>
                {directors.map((dir, i) => (
                  <p key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                    {dir.name}{dir.city || dir.state ? ` — ${[dir.city, dir.state].filter(Boolean).join(", ")}` : ""}
                  </p>
                ))}
              </div>
            )}

            {isLLC && shareholders.length > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1.5">
                <p className="font-medium text-foreground">Initial {term.shareholders} ({shareholders.length}):</p>
                {shareholders.map((sh, i) => (
                  <p key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                    {sh.name} — {sh.num_shares.toLocaleString()} {term.shareUnit.toLowerCase()}
                  </p>
                ))}
              </div>
            )}

            {isCorp && directors.length === 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                No initial directors. You can add them later from the company detail page.
              </div>
            )}

            {isLLC && shareholders.length === 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                No initial {term.shareholders.toLowerCase()}. You can add them later from the company detail page.
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(showStep2 ? 2 : 1)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Create Company
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4 for EXISTING flow: Review & Confirm */}
        {step === 4 && flowType === "existing" && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3 space-y-2 text-xs">
              <p className="font-semibold text-sm">{newName}</p>
              <div className="grid grid-cols-2 gap-1">
                <span className="text-muted-foreground">Entity Type:</span>
                <span>{newType}</span>
                <span className="text-muted-foreground">State:</span>
                <span>{newState || "—"}</span>
                <span className="text-muted-foreground">Opening Balance Date:</span>
                <span className="font-medium">{openingBalanceDate ? new Date(openingBalanceDate + "T00:00:00").toLocaleDateString() : "—"}</span>
                {isCorp && authSharesNum > 0 && (
                  <>
                    <span className="text-muted-foreground">Authorized Shares:</span>
                    <span>{authSharesNum.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>

            {shareholders.length > 0 && (
              <div className="rounded-md border border-border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Name</TableHead>
                      <TableHead className="text-[10px]">{term.numUnitsLabel}</TableHead>
                      <TableHead className="text-[10px]">{term.classLabel}</TableHead>
                      <TableHead className="text-[10px]">Cert #</TableHead>
                      <TableHead className="text-[10px] text-right">Consideration</TableHead>
                      <TableHead className="text-[10px] text-right">Ownership %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shareholders.map((sh, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{sh.name}</TableCell>
                        <TableCell className="text-xs">{sh.num_shares.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{sh.share_class || term.defaultClass}</TableCell>
                        <TableCell className="text-xs">#{sh.cert_number}</TableCell>
                        <TableCell className="text-xs text-right">{sh.consideration ? `$${parseFloat(sh.consideration).toLocaleString()}` : "—"}</TableCell>
                        <TableCell className="text-xs text-right">
                          {totalIssuedShares > 0 ? `${((sh.num_shares / totalIssuedShares) * 100).toFixed(2)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell className="text-xs font-semibold">Total</TableCell>
                      <TableCell className="text-xs font-semibold">{totalIssuedShares.toLocaleString()}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-xs text-right font-semibold">
                        {(() => {
                          const total = shareholders.reduce((sum, s) => sum + (parseFloat(s.consideration) || 0), 0);
                          return total > 0 ? `$${total.toLocaleString()}` : "—";
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-right font-semibold">100.00%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-md border border-border bg-muted/20">
              <Checkbox
                id="confirm-ownership"
                checked={confirmOwnership}
                onCheckedChange={(v) => setConfirmOwnership(v === true)}
              />
              <label htmlFor="confirm-ownership" className="text-xs leading-relaxed cursor-pointer">
                I confirm this represents the current ownership state as of {openingBalanceDate ? new Date(openingBalanceDate + "T00:00:00").toLocaleDateString() : "the selected date"}.
              </label>
            </div>

            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-1 h-3 w-3" /> Back
              </Button>
              <Button size="sm" onClick={handleSaveExisting} disabled={saving || !confirmOwnership}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Establish Opening Balances
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
