import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GitBranch, ArrowUp, ArrowDown, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";
import { useNavigate } from "react-router-dom";

interface RelationshipsTabProps {
  companyId: string;
  companyName: string;
}

const RELATIONSHIP_TYPES = ["subsidiary", "division", "affiliate", "joint_venture"];

const formatType = (t: string) => t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function RelationshipsTab({ companyId, companyName }: RelationshipsTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [direction, setDirection] = useState<"parent" | "child">("child");
  const emptyForm = { related_company_id: "", relationship_type: "subsidiary", ownership_percentage: "", effective_date: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  // All user companies (for the dropdown)
  const { data: allCompanies = [], isLoading: loadingCompanies, isError: isCompaniesError, refetch: refetchCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, entity_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Relationships where this company is the parent
  const { data: childRelationships = [], isLoading: loadingChildren, isError: isChildError, refetch: refetchChildren } = useQuery({
    queryKey: ["company_relationships", "children", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_relationships")
        .select("*, companies!company_relationships_child_company_id_fkey(id, name, entity_type)")
        .eq("parent_company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Relationships where this company is the child
  const { data: parentRelationships = [], isLoading: loadingParents } = useQuery({
    queryKey: ["company_relationships", "parents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_relationships")
        .select("*, companies!company_relationships_parent_company_id_fkey(id, name, entity_type)")
        .eq("child_company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["company_relationships"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        relationship_type: form.relationship_type,
        ownership_percentage: form.ownership_percentage ? parseFloat(form.ownership_percentage) : null,
        effective_date: form.effective_date || null,
        notes: form.notes || null,
        user_id: user!.id,
      };

      if (editing) {
        const { error } = await supabase.from("company_relationships").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (direction === "child") {
          payload.parent_company_id = companyId;
          payload.child_company_id = form.related_company_id;
        } else {
          payload.parent_company_id = form.related_company_id;
          payload.child_company_id = companyId;
        }
        const { error } = await supabase.from("company_relationships").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      toast.success(editing ? "Relationship updated" : "Relationship added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Relationship removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = (dir: "parent" | "child") => {
    setEditing(null);
    setDirection(dir);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (rel: any, dir: "parent" | "child") => {
    setEditing(rel);
    setDirection(dir);
    setForm({
      related_company_id: dir === "child" ? rel.child_company_id : rel.parent_company_id,
      relationship_type: rel.relationship_type,
      ownership_percentage: rel.ownership_percentage?.toString() || "",
      effective_date: rel.effective_date || "",
      notes: rel.notes || "",
    });
    setOpen(true);
  };

  const availableCompanies = allCompanies.filter((c) => c.id !== companyId);

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case "subsidiary": return "bg-primary/10 text-primary border-primary/20";
      case "division": return "bg-accent/50 text-accent-foreground border-accent/30";
      case "affiliate": return "bg-muted text-muted-foreground border-muted";
      case "joint_venture": return "bg-warning/10 text-warning border-warning/20";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const isLoading = loadingCompanies || loadingChildren || loadingParents;
  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (isCompaniesError || isChildError) return <QueryErrorBanner message="Failed to load relationships." onRetry={refetchChildren} />;

  return (
    <div className="space-y-5">
      {/* Parent Entities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowUp className="h-4 w-4" /> Parent Entities
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => openNew("parent")} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Add Parent
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ownership %</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parentRelationships.map((rel: any) => (
                <TableRow key={rel.id}>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/company/${rel.companies?.id}`)}
                      className="font-medium text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {rel.companies?.name}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground">{rel.companies?.entity_type}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${typeBadgeColor(rel.relationship_type)}`}>
                      {formatType(rel.relationship_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {rel.ownership_percentage != null ? `${rel.ownership_percentage}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rel.effective_date ? new Date(rel.effective_date + "T00:00:00").toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(rel, "parent")}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(rel.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {parentRelationships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                    No parent entities defined
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Child Entities */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ArrowDown className="h-4 w-4" /> Subsidiaries & Affiliates
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => openNew("child")} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Add Subsidiary
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ownership %</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {childRelationships.map((rel: any) => (
                <TableRow key={rel.id}>
                  <TableCell>
                    <button
                      onClick={() => navigate(`/company/${rel.companies?.id}`)}
                      className="font-medium text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      {rel.companies?.name}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                    <span className="text-[10px] text-muted-foreground">{rel.companies?.entity_type}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${typeBadgeColor(rel.relationship_type)}`}>
                      {formatType(rel.relationship_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {rel.ownership_percentage != null ? `${rel.ownership_percentage}%` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {rel.effective_date ? new Date(rel.effective_date + "T00:00:00").toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(rel, "child")}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => del.mutate(rel.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {childRelationships.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                    No subsidiaries or affiliates defined
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit" : "Add"} {direction === "parent" ? "Parent Entity" : "Subsidiary / Affiliate"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {!editing && (
              <div>
                <Label className="text-xs">Company *</Label>
                <Select value={form.related_company_id} onValueChange={(v) => setForm((p) => ({ ...p, related_company_id: v }))}>
                  <SelectTrigger className="bg-popover">
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-60">
                    {availableCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.entity_type})
                      </SelectItem>
                    ))}
                    {availableCompanies.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No other companies available</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Relationship Type</Label>
              <Select value={form.relationship_type} onValueChange={(v) => setForm((p) => ({ ...p, relationship_type: v }))}>
                <SelectTrigger className="bg-popover">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {RELATIONSHIP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ownership %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.ownership_percentage}
                  onChange={(e) => setForm((p) => ({ ...p, ownership_percentage: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <Label className="text-xs">Effective Date</Label>
                <DatePickerField value={form.effective_date} onChange={(v) => setForm((p) => ({ ...p, effective_date: v }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={(!editing && !form.related_company_id) || save.isPending}
            >
              {save.isPending ? "Saving…" : editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
