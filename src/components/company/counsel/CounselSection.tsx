import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMasterFirms, useMasterContacts } from "@/hooks/useMasterDirectory";
import { useAddressBookContext } from "@/contexts/AddressBookContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import FirmDialog from "./FirmDialog";
import PersonDialog from "./PersonDialog";
import { FirmCard, SoloCard } from "./FirmCard";
import { emptyFirmForm, emptyPersonForm, type CounselConfig, type FirmForm, type PersonForm } from "./config";

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Generic renderer for one counsel category (Attorneys or Accountants).
 * All table/column/label differences come from `config`, so both categories
 * behave identically.
 */
export default function CounselSection({
  companyId,
  config,
}: {
  companyId: string;
  config: CounselConfig;
}) {
  const qc = useQueryClient();
  const { masterFirms, upsertMasterFirm } = useMasterFirms(config.masterFirmType);
  const { masterContacts, upsertMasterContact } = useMasterContacts(config.masterContactType);
  const { upsert: upsertAddressBook } = useAddressBookContext(companyId);

  // ── Firm dialog state ──
  const [firmDialogOpen, setFirmDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<any>(null);
  const [firmForm, setFirmForm] = useState<FirmForm>(emptyFirmForm());
  /** True when the firm dialog was opened from inside the person dialog ("Add new firm…"). */
  const [firmDialogFromPerson, setFirmDialogFromPerson] = useState(false);

  // ── Person dialog state ──
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [personForm, setPersonForm] = useState<PersonForm>(emptyPersonForm());
  const [personFirmId, setPersonFirmId] = useState<string | null>(null);
  const [personInitialMode, setPersonInitialMode] = useState<"firm" | "solo">("firm");

  // ── Delete state ──
  const [deletePerson, setDeletePersonTarget] = useState<any>(null);
  const [deleteFirmTarget, setDeleteFirmTarget] = useState<any>(null);
  const [firmDeleteMode, setFirmDeleteMode] = useState<"detach" | "delete">("detach");

  const firmsQuery = useQuery({
    queryKey: [config.firmTable, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.firmTable as any)
        .select("*")
        .eq("company_id", companyId)
        .order("firm_name");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const peopleQuery = useQuery({
    queryKey: [config.personTable, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.personTable as any)
        .select("*")
        .eq("company_id", companyId)
        .order(config.nameColumn);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const firms = firmsQuery.data || [];
  const people = peopleQuery.data || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [config.firmTable, companyId] });
    qc.invalidateQueries({ queryKey: [config.personTable, companyId] });
  };

  // ── Cards, interleaved and alphabetically sorted ──
  const cards = useMemo(() => {
    const firmCards = firms.map((f: any) => ({
      kind: "firm" as const,
      sortKey: (f.firm_name || "") as string,
      firm: f,
      people: people
        .filter((p: any) => p.firm_id === f.id)
        .sort((a: any, b: any) => byName(a[config.nameColumn] || "", b[config.nameColumn] || "")),
    }));
    const soloCards = people
      .filter((p: any) => !p.firm_id)
      .map((p: any) => ({
        kind: "solo" as const,
        sortKey: (p[config.nameColumn] || "") as string,
        person: p,
      }));
    return [...firmCards, ...soloCards].sort((a, b) => byName(a.sortKey, b.sortKey));
  }, [firms, people, config.nameColumn]);

  // ── Firm mutations ──
  const saveFirm = useMutation({
    mutationFn: async () => {
      let firmId = editingFirm?.id as string | undefined;
      if (editingFirm) {
        const { error } = await supabase
          .from(config.firmTable as any)
          .update({ ...firmForm } as any)
          .eq("id", editingFirm.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from(config.firmTable as any)
          .insert({ ...firmForm, company_id: companyId } as any)
          .select("id")
          .single();
        if (error) throw error;
        firmId = (data as any)?.id;
      }
      upsertMasterFirm.mutate({ ...firmForm });
      return firmId;
    },
    onSuccess: (firmId) => {
      invalidate();
      setFirmDialogOpen(false);
      toast.success(`${config.firmTypeLabel} saved`);
      // Stacked flow: hand the newly created firm back to the open person dialog.
      if (firmDialogFromPerson) {
        if (firmId && !editingFirm) setPersonFirmId(firmId);
        setFirmDialogFromPerson(false);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFirm = useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: "detach" | "delete" }) => {
      if (mode === "detach") {
        const { error } = await supabase
          .from(config.personTable as any)
          .update({ firm_id: null, title: null } as any)
          .eq("firm_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(config.personTable as any).delete().eq("firm_id", id);
        if (error) throw error;
      }
      const { error } = await supabase.from(config.firmTable as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeleteFirmTarget(null);
      toast.success("Firm deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Person mutations ──
  const savePerson = useMutation({
    mutationFn: async () => {
      const payload: any = {
        [config.nameColumn]: personForm.name.trim(),
        title: personFirmId ? personForm.title || null : null,
        [config.licenseColumn]: personForm.license || null,
        email: personForm.email || null,
        phone: personForm.phone || null,
        specialty: personForm.specialty || null,
        notes: personForm.notes || null,
        firm_id: personFirmId,
      };
      if (editingPerson) {
        const { error } = await supabase
          .from(config.personTable as any)
          .update(payload)
          .eq("id", editingPerson.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(config.personTable as any)
          .insert({ ...payload, company_id: companyId });
        if (error) throw error;
      }

      upsertMasterContact.mutate({
        contact_name: personForm.name.trim(),
        title: personForm.title || undefined,
        [config.licenseColumn]: personForm.license || undefined,
        specialty: personForm.specialty || undefined,
        phone: personForm.phone || undefined,
        email: personForm.email || undefined,
        notes: personForm.notes || undefined,
      } as any);

      const firm = firms.find((f: any) => f.id === personFirmId);
      if (personForm.name.trim()) {
        upsertAddressBook.mutate({
          full_name: personForm.name.trim(),
          address: firm?.address,
          address_2: firm?.address_2,
          city: firm?.city,
          state: firm?.state,
          zip: firm?.zip,
          company_id: companyId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.personTable, companyId] });
      setPersonDialogOpen(false);
      toast.success(`${config.personLabelTitle} saved`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(config.personTable as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.personTable, companyId] });
      setDeletePersonTarget(null);
      toast.success(`${config.personLabelTitle} deleted`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Openers ──
  const openNewFirm = () => {
    setEditingFirm(null);
    setFirmForm(emptyFirmForm());
    setFirmDialogFromPerson(false);
    setFirmDialogOpen(true);
  };

  const openEditFirm = (f: any) => {
    setEditingFirm(f);
    setFirmForm({
      firm_name: f.firm_name || "",
      address: f.address || "",
      address_2: f.address_2 || "",
      city: f.city || "",
      state: f.state || "",
      zip: f.zip || "",
      phone: f.phone || "",
      email: f.email || "",
      website: f.website || "",
    });
    setFirmDialogFromPerson(false);
    setFirmDialogOpen(true);
  };

  const openNewPerson = (firmId: string | null) => {
    setEditingPerson(null);
    setPersonForm(emptyPersonForm());
    setPersonFirmId(firmId);
    setPersonInitialMode(firmId ? "firm" : "solo");
    setPersonDialogOpen(true);
  };

  const openEditPerson = (p: any) => {
    setEditingPerson(p);
    setPersonForm({
      name: p[config.nameColumn] || "",
      title: p.title || "",
      license: p[config.licenseColumn] || "",
      email: p.email || "",
      phone: p.phone || "",
      specialty: p.specialty || "",
      notes: p.notes || "",
    });
    setPersonFirmId(p.firm_id || null);
    setPersonInitialMode(p.firm_id ? "firm" : "solo");
    setPersonDialogOpen(true);
  };

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

  const deleteFirmPeopleCount = deleteFirmTarget
    ? people.filter((p: any) => p.firm_id === deleteFirmTarget.id).length
    : 0;

  if (firmsQuery.isError || peopleQuery.isError) {
    return (
      <QueryErrorBanner
        message={`Failed to load ${config.categoryLabel.toLowerCase()}.`}
        onRetry={() => {
          firmsQuery.refetch();
          peopleQuery.refetch();
        }}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{config.categoryLabel}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNewFirm}>
            <Plus className="h-3 w-3 mr-1" />
            Add firm
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewPerson(null)}>
            <Plus className="h-3 w-3 mr-1" />
            Add solo practitioner
          </Button>
        </div>
      </div>

      {firmsQuery.isLoading || peopleQuery.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : cards.length === 0 ? (
        <Card className="border border-border bg-card shadow-none p-4">
          <p className="text-sm text-muted-foreground">None appointed</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cards.map((c) =>
            c.kind === "firm" ? (
              <FirmCard
                key={`firm-${c.firm.id}`}
                firm={c.firm}
                people={c.people}
                config={config}
                onEditFirm={() => openEditFirm(c.firm)}
                onDeleteFirm={() => {
                  setFirmDeleteMode("detach");
                  setDeleteFirmTarget(c.firm);
                }}
                onAddPerson={() => openNewPerson(c.firm.id)}
                onEditPerson={openEditPerson}
                onDeletePerson={setDeletePersonTarget}
              />
            ) : (
              <SoloCard
                key={`solo-${c.person.id}`}
                person={c.person}
                config={config}
                onEdit={() => openEditPerson(c.person)}
                onDelete={() => setDeletePersonTarget(c.person)}
              />
            )
          )}
        </div>
      )}

      <FirmDialog
        open={firmDialogOpen}
        onOpenChange={(v) => {
          setFirmDialogOpen(v);
          if (!v) setFirmDialogFromPerson(false);
        }}
        editing={editingFirm}
        form={firmForm}
        setForm={setFirmForm}
        onSave={() => saveFirm.mutate()}
        isPending={saveFirm.isPending}
        config={config}
        masterFirms={masterFirms}
        onSelectMaster={selectMasterFirm}
      />

      <PersonDialog
        open={personDialogOpen}
        onOpenChange={setPersonDialogOpen}
        config={config}
        editing={editingPerson}
        firms={firms}
        form={personForm}
        setForm={setPersonForm}
        firmId={personFirmId}
        setFirmId={setPersonFirmId}
        initialMode={personInitialMode}
        onRequestNewFirm={() => {
          setEditingFirm(null);
          setFirmForm(emptyFirmForm());
          setFirmDialogFromPerson(true);
          setFirmDialogOpen(true);
        }}
        onSave={() => savePerson.mutate()}
        isPending={savePerson.isPending}
        masterContacts={masterContacts}
      />

      <ConfirmDeleteDialog
        open={!!deletePerson}
        onOpenChange={(v) => !v && setDeletePersonTarget(null)}
        onConfirm={() => deletePerson && removePerson.mutate(deletePerson.id)}
        title={`Delete ${deletePerson?.[config.nameColumn] ?? ""}?`}
        description={`This permanently removes this ${config.personLabel} from the company's records.`}
      />

      <AlertDialog open={!!deleteFirmTarget} onOpenChange={(v) => !v && setDeleteFirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFirmTarget?.firm_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFirmPeopleCount > 0
                ? `This firm has ${deleteFirmPeopleCount} ${config.personLabel}${
                    deleteFirmPeopleCount === 1 ? "" : "s"
                  } listed. Choose what should happen to them.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteFirmPeopleCount > 0 && (
            <RadioGroup
              value={firmDeleteMode}
              onValueChange={(v) => setFirmDeleteMode(v as "detach" | "delete")}
              className="gap-3 py-1"
            >
              <div className="flex items-start gap-2">
                <RadioGroupItem value="detach" id={`detach-${config.key}`} className="mt-0.5" />
                <Label htmlFor={`detach-${config.key}`} className="font-normal cursor-pointer">
                  Keep them as solo practitioners
                  <span className="block text-xs text-muted-foreground">
                    Their records stay, with no firm affiliation.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2">
                <RadioGroupItem value="delete" id={`delete-${config.key}`} className="mt-0.5" />
                <Label htmlFor={`delete-${config.key}`} className="font-normal cursor-pointer">
                  Delete them along with the firm
                  <span className="block text-xs text-muted-foreground">
                    Permanently removes these {config.personLabel} records.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteFirmTarget &&
                deleteFirm.mutate({
                  id: deleteFirmTarget.id,
                  mode: deleteFirmPeopleCount > 0 ? firmDeleteMode : "detach",
                })
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete firm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
