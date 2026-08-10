import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BookUser, Pencil, Search, Trash2 } from "lucide-react";
import type { AddressBookEntry } from "@/hooks/useAddressBook";

interface EntryRow extends AddressBookEntry {
  company_name?: string | null;
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
 * Address Book manager: lets the user correct or delete the saved names that
 * feed every "type-ahead" name field in the app (members, directors, signers,
 * counsel, etc.). Entries live in `user_address_book` and are scoped to the
 * signed-in user by RLS.
 */
export default function AddressBookCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EntryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<EntryRow | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["address_book_manage", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .select("id, full_name, address, address_2, city, state, zip, company_id, companies(name)")
        .order("full_name");
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        company_name: r.companies?.name ?? null,
      })) as EntryRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["address_book_manage"] });
    qc.invalidateQueries({ queryKey: ["address_book"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      if (!editing) return;
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .update({
          full_name: values.full_name.trim(),
          address: values.address.trim() || null,
          address_2: values.address_2.trim() || null,
          city: values.city.trim() || null,
          state: values.state.trim() || null,
          zip: values.zip.trim() || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", editing.id)
        .select("id");
      if (error) throw error;
      // A successful call that changes nothing means the row was not reachable
      // (permissions / stale id) — surface it instead of showing a false success.
      if (!data || data.length === 0) {
        throw new Error("No entry was updated. Try refreshing the page and editing again.");
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Entry updated" });
      setEditing(null);
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to save entry.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_address_book" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Name removed from autocomplete" });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to delete entry.", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        (e.address || "").toLowerCase().includes(q) ||
        (e.city || "").toLowerCase().includes(q) ||
        (e.company_name || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

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

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookUser className="h-5 w-5 text-primary" />
          Address Book
        </CardTitle>
        <CardDescription>
          These are the saved names that appear in the type-ahead dropdowns throughout the app. Fix a
          misspelling with Edit, or remove an entry entirely with Delete. Deleting here only removes the
          suggestion — it does not change any member, director, or signer record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search saved names…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
                  <TableRow key={e.id}>
                    <TableCell className="font-medium truncate" title={e.full_name}>{e.full_name}</TableCell>
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

                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => openEdit(e)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(e)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
              saveMutation.mutate(form);
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
              <Button type="submit" disabled={saveMutation.isPending || !form.full_name.trim()}>
                {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteTarget?.full_name}" from autocomplete?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the saved suggestion only. Existing member, director, officer, and signer records
              are not affected. If the same name still exists on a record, it can reappear the next time the
              address book is refreshed — correct the record itself to stop that.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
