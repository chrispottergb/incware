import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMasterFirms } from "@/hooks/useMasterDirectory";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import BankCard from "./BankCard";
import BankDialog, { type BankForm } from "./BankDialog";
import SignerDialog, { type SignerForm } from "./SignerDialog";

interface Props {
  companyId: string;
}

/**
 * Bank accounts and authorized signers.
 * Signers are nested inside their bank account card; account and routing
 * numbers are not surfaced anywhere in this UI (columns remain in the database).
 */
export default function BanksSection({ companyId }: Props) {
  const qc = useQueryClient();
  const { masterFirms: masterBanks, upsertMasterFirm: upsertMasterBank } = useMasterFirms("bank");
  const { search: searchAddressBook, getCompanySplitIndex, upsert: upsertAddressBook } = useAddressBookContext(companyId);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [signerDialogOpen, setSignerDialogOpen] = useState(false);
  const [signerBankId, setSignerBankId] = useState<string | null>(null);
  const [editingSigner, setEditingSigner] = useState<any>(null);
  const [deleteBank, setDeleteBank] = useState<any>(null);
  const [deleteSigner, setDeleteSigner] = useState<any>(null);

  const { data: banks = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["company_banks", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_banks").select("*").eq("company_id", companyId).order("bank_name");
      if (error) throw error;
      return data;
    },
  });

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

  const signersByBank = useMemo(() => {
    const map: Record<string, any[]> = {};
    (signers as any[]).forEach((s) => {
      if (!s.bank_id) return;
      (map[s.bank_id] ||= []).push(s);
    });
    return map;
  }, [signers]);

  const saveBank = useMutation({
    mutationFn: async (form: BankForm) => {
      let newId: string | null = null;
      if (editingBank) {
        const { error } = await supabase.from("company_banks").update({ ...form }).eq("id", editingBank.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("company_banks")
          .insert({ ...form, company_id: companyId })
          .select("id")
          .single();
        if (error) throw error;
        newId = data?.id ?? null;
      }
      upsertMasterBank.mutate({
        firm_name: form.bank_name, address: form.address, address_2: form.address_2,
        city: form.city, state: form.state, zip: form.zip, phone: form.phone,
        account_type: form.account_type, contact_name: form.contact_name, contact_title: form.contact_title,
      });
      if (form.contact_name?.trim()) {
        upsertAddressBook.mutate({
          full_name: form.contact_name.trim(),
          address: form.address, address_2: form.address_2,
          city: form.city, state: form.state, zip: form.zip,
          company_id: companyId,
        });
      }
      return newId;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["company_banks", companyId] });
      setBankDialogOpen(false);
      toast.success("Bank saved");
      // A new account is incomplete without a signer — chain straight into the
      // signer step rather than leaving an empty card behind.
      if (newId) {
        setEditingSigner(null);
        setSignerBankId(newId);
        setSignerDialogOpen(true);
      }
      setEditingBank(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeBank = useMutation({
    mutationFn: async (id: string) => {
      const { error: sErr } = await supabase.from("bank_authorized_signers").delete().eq("bank_id", id);
      if (sErr) throw sErr;
      const { error } = await supabase.from("company_banks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_banks", companyId] });
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      toast.success("Bank account deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSigner = useMutation({
    mutationFn: async (form: SignerForm) => {
      const authorityValue =
        form.title === "Limited Authority (Specify)" && form.limited_detail
          ? `Limited Authority — ${form.limited_detail}`
          : form.title || null;
      const payload: any = { signer_name: form.signer_name, title: authorityValue };
      if (editingSigner) {
        const { error } = await supabase.from("bank_authorized_signers").update(payload).eq("id", editingSigner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bank_authorized_signers")
          .insert({ ...payload, bank_id: signerBankId, company_id: companyId });
        if (error) throw error;
      }
      if (form.signer_name?.trim()) {
        upsertAddressBook.mutate({ full_name: form.signer_name.trim(), company_id: companyId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_authorized_signers", companyId] });
      setSignerDialogOpen(false);
      toast.success(editingSigner ? "Signer updated" : "Authorized signer added");
      setEditingSigner(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeSigner = useMutation({
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

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (isError) return <QueryErrorBanner message="Failed to load banks." onRetry={refetch} />;

  const signerBank = banks.find((b: any) => b.id === signerBankId);
  const isLastSigner =
    deleteSigner && (signersByBank[deleteSigner.bank_id]?.length ?? 0) <= 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Bank accounts and authorized signers</h3>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => { setEditingBank(null); setBankDialogOpen(true); }}
        >
          <Plus className="h-3 w-3 mr-1" />Add bank
        </Button>
      </div>

      {banks.length === 0 ? (
        <Card className="border border-border bg-card shadow-none p-4">
          <p className="text-sm text-muted-foreground">None added.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {banks.map((b: any) => (
            <BankCard
              key={b.id}
              bank={b}
              signers={signersByBank[b.id] || []}
              expanded={!collapsed[b.id]}
              onToggle={() => setCollapsed((prev) => ({ ...prev, [b.id]: !prev[b.id] }))}
              onEditBank={() => { setEditingBank(b); setBankDialogOpen(true); }}
              onDeleteBank={() => setDeleteBank(b)}
              onAddSigner={() => { setEditingSigner(null); setSignerBankId(b.id); setSignerDialogOpen(true); }}
              onEditSigner={(s) => { setEditingSigner(s); setSignerBankId(b.id); setSignerDialogOpen(true); }}
              onDeleteSigner={(s) => setDeleteSigner(s)}
            />
          ))}
        </div>
      )}

      <BankDialog
        open={bankDialogOpen}
        onOpenChange={(o) => { setBankDialogOpen(o); if (!o) setEditingBank(null); }}
        editing={editingBank}
        masterBanks={masterBanks as any[]}
        saving={saveBank.isPending}
        onSave={(form) => saveBank.mutate(form)}
      />

      <SignerDialog
        open={signerDialogOpen}
        onOpenChange={(o) => { setSignerDialogOpen(o); if (!o) setEditingSigner(null); }}
        editing={editingSigner}
        bankName={signerBank?.bank_name || ""}
        saving={saveSigner.isPending}
        onSave={(form) => saveSigner.mutate(form)}
        search={searchAddressBook}
        getCompanySplitIndex={getCompanySplitIndex}
      />

      <ConfirmDeleteDialog
        open={!!deleteBank}
        onOpenChange={(o) => { if (!o) setDeleteBank(null); }}
        title={`Delete ${deleteBank?.bank_name ?? "bank account"}?`}
        description="This will permanently delete the bank account and all of its authorized signers. This action cannot be undone."
        onConfirm={() => { if (deleteBank) removeBank.mutate(deleteBank.id); setDeleteBank(null); }}
      />

      <ConfirmDeleteDialog
        open={!!deleteSigner}
        onOpenChange={(o) => { if (!o) setDeleteSigner(null); }}
        title={`Remove ${deleteSigner?.signer_name ?? "signer"}?`}
        description={
          isLastSigner
            ? "This is the only signer on this account. Removing them will leave the account without an authorized signer."
            : "This action cannot be undone. This will permanently remove this authorized signer."
        }
        onConfirm={() => { if (deleteSigner) removeSigner.mutate(deleteSigner.id); setDeleteSigner(null); }}
      />
    </div>
  );
}
