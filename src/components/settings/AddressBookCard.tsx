import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { BookUser, EyeOff, Eye, Pencil, Search } from "lucide-react";
import { normalizeEntryText } from "@/lib/name-normalize";
import { countNameReferences, type NameReferenceCount } from "@/lib/name-references";
import NameCleanupLogList from "@/components/settings/NameCleanupLogList";
import type { AddressBookEntry } from "@/hooks/useAddressBook";

interface EntryRow extends AddressBookEntry {
  company_name?: string | null;
  is_hidden: boolean;
}

const emptyForm = {
  full_name: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  zip: "",
};

/**
 * Address Book manager: lets the user correct or hide the saved names that
 * feed every "type-ahead" name field in the app (members, directors, signers,
 * counsel, etc.). Entries live in `user_address_book` and are scoped to the
 * signed-in user by RLS.
 *
 * Safety model:
 * - Renaming here updates the SUGGESTION ONLY. It never rewrites a saved
 *   record, so the confirmation dialog says exactly that and reports how many
 *   records still carry the old spelling.
 * - Removal is a soft hide (`is_hidden`). Nothing stored on a record is ever
 *   nulled, cleared or deleted. There is deliberately NO hard delete: the
 *   reference count spans many tables and cannot be proven exhaustive, so no
 *   destructive action is gated on it.
 * - Every rename and hide is appended to the insert-only `name_cleanup_log`,
 *   including a full JSONB snapshot of the row so a mistake is recoverable.
 */
export default function AddressBookCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [renameConfirm, setRenameConfirm] = useState<{
    entry: EntryRow;
    values: typeof emptyForm;
    counts: NameReferenceCount;
  } | null>(null);
  const [hideTarget, setHideTarget] = useState<{ entry: EntryRow; counts: NameReferenceCount } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["address_book_manage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .select(
          "id, full_name, address, address_2, city, state, zip, company_id, is_hidden, companies(name)"
        )
        .order("full_name");
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        is_hidden: !!r.is_hidden,
        company_name: r.companies?.name ?? null,
      })) as EntryRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["address_book_manage"] });
    qc.invalidateQueries({ queryKey: ["address_book"] });
    qc.invalidateQueries({ queryKey: ["name_cleanup_log"] });
  };

  const writeLog = async (row: {
    action: "rename" | "hide" | "delete";
    old_value: string | null;
    new_value: string | null;
    affected_row_count: number;
    snapshot: EntryRow;
  }) => {
    await supabase.from("name_cleanup_log" as any).insert({
      action: row.action,
      target_table: "user_address_book",
      target_column: "full_name",
      old_value: row.old_value,
      new_value: row.new_value,
      affected_row_count: row.affected_row_count,
      row_snapshot: row.snapshot as any,
      performed_by: user?.id,
    } as any);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      entry,
      values,
      counts,
    }: {
      entry: EntryRow;
      values: typeof emptyForm;
      counts: NameReferenceCount;
    }) => {
      const nextName = normalizeEntryText(values.full_name);
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .update({
          full_name: nextName,
          address: normalizeEntryText(values.address) || null,
          address_2: normalizeEntryText(values.address_2) || null,
          city: normalizeEntryText(values.city) || null,
          state: normalizeEntryText(values.state) || null,
          zip: normalizeEntryText(values.zip) || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", entry.id)
        .select("id");
      if (error) throw error;
      // A successful call that changes nothing means the row was not reachable
      // (permissions / stale id) — surface it instead of showing a false success.
      if (!data || data.length === 0) {
        throw new Error("No entry was updated. Try refreshing the page and editing again.");
      }
      await writeLog({
        action: "rename",
        old_value: entry.full_name,
        new_value: nextName,
        affected_row_count: counts.records,
        snapshot: entry,
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Suggestion updated" });
      setEditing(null);
      setRenameConfirm(null);
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to save entry.", variant: "destructive" }),
  });

  const hideMutation = useMutation({
    mutationFn: async ({ entry, counts }: { entry: EntryRow; counts: NameReferenceCount }) => {
      const { error } = await supabase
        .from("user_address_book" as any)
        .update({ is_hidden: true, updated_at: new Date().toISOString() } as any)
        .eq("id", entry.id);
      if (error) throw error;
      await writeLog({
        action: "hide",
        old_value: entry.full_name,
        new_value: null,
        affected_row_count: counts.records,
        snapshot: entry,
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Hidden from suggestions", description: "Saved records were not changed." });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to hide entry.", variant: "destructive" }),
  });

  const unhideMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_address_book" as any)
        .update({ is_hidden: false, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Restored to suggestions" });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to restore entry.", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const visible = showHidden ? entries : entries.filter((e) => !e.is_hidden);
    if (!q) return visible;
    return visible.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.address || "").toLowerCase().includes(q) ||
        (e.city || "").toLowerCase().includes(q) ||
        (e.company_name || "").toLowerCase().includes(q)
    );
  }, [entries, search, showHidden]);

  const hiddenCount = useMemo(() => entries.filter((e) => e.is_hidden).length, [entries]);

  const openEdit = (e: EntryRow) => {
    setEditing(e);
    setForm({
      full_name: e.full_name || "",
      address: e.address || "",
      address_2: e.address_2 || "",
      city: e.city || "",
      state: e.state || "",
      zip: e.zip || "",
    });
  };

  const requestSave = async (values: typeof emptyForm) => {
    if (!editing) return;
    const nextName = normalizeEntryText(values.full_name);
    if (!nextName) return;
    // Name unchanged: nothing to warn about, just save the address fields.
    if (nextName.toLowerCase() === editing.full_name.trim().toLowerCase()) {
      saveMutation.mutate({ entry: editing, values, counts: { records: 0, companies: 0 } });
      return;
    }
    setBusy(true);
    try {
      const counts = await countNameReferences(editing.full_name);
      setRenameConfirm({ entry: editing, values, counts });
    } finally {
      setBusy(false);
    }
  };

  const requestHide = async (entry: EntryRow) => {
    setBusy(true);
    try {
      const counts = await countNameReferences(entry.full_name);
      setHideTarget({ entry, counts });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookUser className="h-5 w-5 text-primary" />
          Address Book
        </CardTitle>
        <CardDescription>
          These are the saved names that appear in the type-ahead dropdowns throughout the app. Fix a
          misspelling with Edit, or stop a name from being suggested with Hide. Neither action changes any
          member, director, signer, or other saved record — those keep exactly what was entered on them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search saved names…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
            <Label htmlFor="show-hidden" className="text-xs font-normal cursor-pointer">
              Show hidden{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <BookUser className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">{entries.length === 0 ? "No saved names yet." : "No matches."}</p>
          </div>
        ) : (
          <div className="rounded-md border border-border max-h-[420px] overflow-y-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[26%]">Name</TableHead>
                  <TableHead className="w-[36%]">Address</TableHead>
                  <TableHead className="w-[20%]">Company</TableHead>
                  <TableHead className="w-[18%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id} className={e.is_hidden ? "opacity-60" : undefined}>
                    <TableCell className="font-medium truncate" title={e.full_name}>
                      {e.full_name}
                      {e.is_hidden && (
                        <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                          Hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate">
                      {[e.address, e.address_2, [e.city, e.state].filter(Boolean).join(", "), e.zip]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate">
                      {e.company_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 whitespace-nowrap">
                        {e.is_hidden ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => unhideMutation.mutate(e.id)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => openEdit(e)}>
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              disabled={busy}
                              onClick={() => requestHide(e)}
                            >
                              <EyeOff className="h-3.5 w-3.5 mr-1" />
                              Hide
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <NameCleanupLogList />
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="min-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Saved Name</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!form.full_name.trim()) return;
              requestSave(form);
            }}
            className="grid gap-3"
          >
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={(ev) => setForm((f) => ({ ...f, full_name: ev.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Address</Label>
                <Input
                  value={form.address}
                  onChange={(ev) => setForm((f) => ({ ...f, address: ev.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Address 2</Label>
                <Input
                  value={form.address_2}
                  onChange={(ev) => setForm((f) => ({ ...f, address_2: ev.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={(ev) => setForm((f) => ({ ...f, city: ev.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <Input value={form.state} onChange={(ev) => setForm((f) => ({ ...f, state: ev.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">ZIP</Label>
                <Input value={form.zip} onChange={(ev) => setForm((f) => ({ ...f, zip: ev.target.value }))} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending || busy || !form.full_name.trim()}>
                {saveMutation.isPending || busy ? "Checking…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename confirmation — reports the true impact: the suggestion changes,
          saved records do not. */}
      <AlertDialog open={!!renameConfirm} onOpenChange={(o) => !o && setRenameConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename this suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              {renameConfirm?.counts.records === 0 ? (
                <>
                  No saved records use "{renameConfirm?.entry.full_name}". This only updates the suggestion
                  list — nothing else changes.
                </>
              ) : (
                <>
                  {renameConfirm?.counts.records} saved record
                  {renameConfirm?.counts.records === 1 ? "" : "s"}
                  {renameConfirm && renameConfirm.counts.companies > 0
                    ? ` across ${renameConfirm.counts.companies} compan${
                        renameConfirm.counts.companies === 1 ? "y" : "ies"
                      }`
                    : ""}{" "}
                  still use "{renameConfirm?.entry.full_name}". Renaming here only fixes the suggestion list —
                  those records keep the old spelling, and documents already generated will not match.
                  Continue?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (renameConfirm) saveMutation.mutate(renameConfirm);
              }}
            >
              Rename suggestion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!hideTarget} onOpenChange={(o) => !o && setHideTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide "{hideTarget?.entry.full_name}" from suggestions?</AlertDialogTitle>
            <AlertDialogDescription>
              {hideTarget && hideTarget.counts.records > 0 ? (
                <>
                  In use by {hideTarget.counts.records} record
                  {hideTarget.counts.records === 1 ? "" : "s"}. Those records are left exactly as they are —
                  hiding only stops this value from being offered in type-ahead lists. You can restore it at
                  any time.
                </>
              ) : (
                <>
                  This stops the value from being offered in type-ahead lists. Nothing stored on any record is
                  changed, and you can restore it at any time.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hideTarget) hideMutation.mutate(hideTarget);
                setHideTarget(null);
              }}
            >
              Hide
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
