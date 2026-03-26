import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

const CATEGORIES = ["Corporate Governance", "Document Signing", "Helpful Hints", "Compliance Reminders"];
const CONTENT_TYPES = ["markdown", "html", "pdf", "image", "link"];

interface ResourceForm {
  id?: string;
  title: string;
  category: string;
  content_type: string;
  content: string;
  content_url: string;
  sort_order: number;
}

const emptyForm: ResourceForm = {
  title: "",
  category: CATEGORIES[0],
  content_type: "markdown",
  content: "",
  content_url: "",
  sort_order: 0,
};

export default function ResourcesAdmin() {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ResourceForm>({ ...emptyForm });
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: ResourceForm) => {
      const payload = {
        title: f.title,
        category: f.category,
        content_type: f.content_type,
        content: f.content || null,
        content_url: f.content_url || null,
        sort_order: f.sort_order,
      };
      if (f.id) {
        const { error } = await supabase.from("resources").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources-admin"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setDialogOpen(false);
      toast({ title: editing ? "Resource updated" : "Resource created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources-admin"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast({ title: "Resource deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditing(false);
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      title: r.title,
      category: r.category,
      content_type: r.content_type,
      content: r.content || "",
      content_url: r.content_url || "",
      sort_order: r.sort_order ?? 0,
    });
    setEditing(true);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Manage Resources</h1>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Resource
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="w-20">Order</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.content_type}</TableCell>
                <TableCell>{r.sort_order}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(r.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {resources.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No resources yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Resource" : "New Resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Content Type</Label>
              <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.content_type === "markdown" || form.content_type === "html") && (
              <div>
                <Label>Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
            )}
            {(form.content_type === "pdf" || form.content_type === "image") && (
              <div className="space-y-2">
                <Label>Upload File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept={form.content_type === "image" ? "image/*" : "application/pdf"}
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const ext = file.name.split(".").pop();
                      const path = `${crypto.randomUUID()}.${ext}`;
                      const { error } = await supabase.storage.from("resource-images").upload(path, file);
                      if (error) {
                        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
                        setUploading(false);
                        return;
                      }
                      const { data: urlData } = supabase.storage.from("resource-images").getPublicUrl(path);
                      setForm((f) => ({ ...f, content_url: urlData.publicUrl }));
                      setUploading(false);
                      toast({ title: "File uploaded" });
                    }}
                  />
                  {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
                </div>
                {form.content_url && (
                  <p className="text-xs text-muted-foreground truncate">Current: {form.content_url}</p>
                )}
              </div>
            )}
            {form.content_type === "link" && (
              <div>
                <Label>URL</Label>
                <Input value={form.content_url} onChange={(e) => setForm({ ...form, content_url: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.title || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
