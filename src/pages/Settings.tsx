import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Code2 } from "lucide-react";

type Shortcode = {
  id: string;
  shortcode: string;
  expansion_text: string;
  category: string;
  created_at: string;
};

const CATEGORIES = ["general", "resolution", "amendment", "bylaws", "agreement", "compliance"];

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shortcode | null>(null);
  const [form, setForm] = useState({ shortcode: "", expansion_text: "", category: "general" });

  const { data: shortcodes = [], isLoading } = useQuery({
    queryKey: ["shortcode_expansions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shortcode_expansions" as any)
        .select("*")
        .order("shortcode");
      if (error) throw error;
      return (data as any[]) as Shortcode[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: { shortcode: string; expansion_text: string; category: string }) => {
      const code = values.shortcode.startsWith("/") ? values.shortcode : `/${values.shortcode}`;
      if (editing) {
        const { error } = await supabase
          .from("shortcode_expansions" as any)
          .update({ shortcode: code, expansion_text: values.expansion_text, category: values.category } as any)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shortcode_expansions" as any)
          .insert({ shortcode: code, expansion_text: values.expansion_text, category: values.category, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortcode_expansions"] });
      toast({ title: editing ? "Shortcode updated" : "Shortcode created" });
      closeDialog();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shortcode_expansions" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortcode_expansions"] });
      toast({ title: "Shortcode deleted" });
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ shortcode: "", expansion_text: "", category: "general" });
    setDialogOpen(true);
  };

  const openEdit = (sc: Shortcode) => {
    setEditing(sc);
    setForm({ shortcode: sc.shortcode, expansion_text: sc.expansion_text, category: sc.category });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const filtered = shortcodes.filter((sc) => {
    const matchSearch = !search || sc.shortcode.toLowerCase().includes(search.toLowerCase()) || sc.expansion_text.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || sc.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage shortcodes and text expansion library</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5 text-primary" />
              Shortcode Library
            </CardTitle>
            <CardDescription>
              Type a shortcode in any text field and press <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">Space</kbd> or <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">Tab</kbd> to expand it.
            </CardDescription>
          </div>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Shortcode
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search shortcodes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Code2 className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">No shortcodes found. Add one to get started.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">Shortcode</TableHead>
                    <TableHead>Expansion Text</TableHead>
                    <TableHead className="w-28">Category</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sc) => (
                    <TableRow key={sc.id}>
                      <TableCell className="font-mono text-primary font-semibold">{sc.shortcode}</TableCell>
                      <TableCell className="max-w-md truncate text-sm">{sc.expansion_text}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                          {sc.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sc)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(sc.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
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
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Shortcode" : "New Shortcode"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.shortcode.trim() || !form.expansion_text.trim()) return;
              saveMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Shortcode</Label>
              <Input
                placeholder="/res1"
                value={form.shortcode}
                onChange={(e) => setForm((f) => ({ ...f, shortcode: e.target.value }))}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">Prefix with / recommended (e.g., /res1). Auto-added if omitted.</p>
            </div>
            <div className="space-y-2">
              <Label>Expansion Text</Label>
              <Textarea
                placeholder="RESOLVED, that the officers of the Corporation be…"
                value={form.expansion_text}
                onChange={(e) => setForm((f) => ({ ...f, expansion_text: e.target.value }))}
                rows={5}
                className="no-expansion"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
