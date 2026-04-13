import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

const AMENDMENT_TYPES: Record<string, { label: string; statute?: string }[]> = {
  Corporation: [
    { label: "Amendment to Articles – Name Change", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Business Purpose", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Authorized Shares", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Par Value", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Registered Agent", statute: "Wis. Stat. § 180.0502" },
    { label: "Amendment to Articles – Registered Office", statute: "Wis. Stat. § 180.0501" },
    { label: "Amendment to Articles – Director Provisions", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Stock Classes/Series", statute: "Wis. Stat. § 180.0602" },
    { label: "Amendment to Articles – Preemptive Rights", statute: "Wis. Stat. § 180.0630" },
    { label: "Amendment to Articles – Other Provision", statute: "Wis. Stat. § 180.1001" },
    { label: "Restated Articles of Incorporation", statute: "Wis. Stat. § 180.1007" },
    { label: "Amendment to Bylaws", statute: "Wis. Stat. § 180.1020" },
    { label: "Adoption of New Bylaws", statute: "Wis. Stat. § 180.1020" },
    { label: "Repeal of Bylaws Provision", statute: "Wis. Stat. § 180.1020" },
    { label: "Other" },
  ],
  "S-Corp": [
    { label: "Amendment to Articles – Name Change", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Business Purpose", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Authorized Shares", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Par Value", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Registered Agent", statute: "Wis. Stat. § 180.0502" },
    { label: "Amendment to Articles – Registered Office", statute: "Wis. Stat. § 180.0501" },
    { label: "Amendment to Articles – Director Provisions", statute: "Wis. Stat. § 180.1001" },
    { label: "Amendment to Articles – Stock Classes/Series", statute: "Wis. Stat. § 180.0602" },
    { label: "Amendment to Articles – S-Election Provisions", statute: "IRC § 1362" },
    { label: "Amendment to Articles – Shareholder Restrictions", statute: "Wis. Stat. § 180.1001; IRC § 1361(b)" },
    { label: "Amendment to Articles – Other Provision", statute: "Wis. Stat. § 180.1001" },
    { label: "Restated Articles of Incorporation", statute: "Wis. Stat. § 180.1007" },
    { label: "Amendment to Bylaws", statute: "Wis. Stat. § 180.1020" },
    { label: "Adoption of New Bylaws", statute: "Wis. Stat. § 180.1020" },
    { label: "Repeal of Bylaws Provision", statute: "Wis. Stat. § 180.1020" },
    { label: "Revocation of S-Election", statute: "IRC § 1362(d)" },
    { label: "Other" },
  ],
  LLC: [
    { label: "Amendment to Articles of Organization – Name Change", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Articles of Organization – Registered Agent", statute: "Wis. Stat. § 183.0105" },
    { label: "Amendment to Articles of Organization – Registered Office", statute: "Wis. Stat. § 183.0105" },
    { label: "Amendment to Articles of Organization – Management Structure", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Articles of Organization – Duration", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Articles of Organization – Other Provision", statute: "Wis. Stat. § 183.0202" },
    { label: "Restated Articles of Organization", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Operating Agreement – Profit/Loss Allocation", statute: "Wis. Stat. § 183.0503" },
    { label: "Amendment to Operating Agreement – Distribution Rights", statute: "Wis. Stat. § 183.0504" },
    { label: "Amendment to Operating Agreement – Voting Rights", statute: "Wis. Stat. § 183.0404" },
    { label: "Amendment to Operating Agreement – Transfer Restrictions", statute: "Wis. Stat. § 183.0706" },
    { label: "Amendment to Operating Agreement – Admission of Members", statute: "Wis. Stat. § 183.0801" },
    { label: "Amendment to Operating Agreement – Other Provision", statute: "Wis. Stat. § 183.0103" },
    { label: "Other" },
  ],
  "LLC-S": [
    { label: "Amendment to Articles of Organization – Name Change", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Articles of Organization – Registered Agent", statute: "Wis. Stat. § 183.0105" },
    { label: "Amendment to Articles of Organization – Registered Office", statute: "Wis. Stat. § 183.0105" },
    { label: "Amendment to Articles of Organization – Management Structure", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Articles of Organization – Other Provision", statute: "Wis. Stat. § 183.0202" },
    { label: "Restated Articles of Organization", statute: "Wis. Stat. § 183.0202" },
    { label: "Amendment to Operating Agreement – Profit/Loss Allocation", statute: "Wis. Stat. § 183.0503" },
    { label: "Amendment to Operating Agreement – Distribution Rights", statute: "Wis. Stat. § 183.0504" },
    { label: "Amendment to Operating Agreement – Voting Rights", statute: "Wis. Stat. § 183.0404" },
    { label: "Amendment to Operating Agreement – Transfer Restrictions", statute: "Wis. Stat. § 183.0706" },
    { label: "Amendment to Operating Agreement – Admission of Members", statute: "Wis. Stat. § 183.0801" },
    { label: "Amendment to Operating Agreement – S-Election Provisions", statute: "IRC § 1362" },
    { label: "Amendment to Operating Agreement – Other Provision", statute: "Wis. Stat. § 183.0103" },
    { label: "Revocation of S-Election", statute: "IRC § 1362(d)" },
    { label: "Other" },
  ],
  "Non-Profit": [
    { label: "Amendment to Articles – Name Change", statute: "Wis. Stat. § 181.1001" },
    { label: "Amendment to Articles – Purpose Change", statute: "Wis. Stat. § 181.1001" },
    { label: "Amendment to Articles – Membership Provisions", statute: "Wis. Stat. § 181.1001" },
    { label: "Amendment to Articles – Registered Agent", statute: "Wis. Stat. § 181.0502" },
    { label: "Amendment to Articles – Registered Office", statute: "Wis. Stat. § 181.0501" },
    { label: "Amendment to Articles – Director Provisions", statute: "Wis. Stat. § 181.1001" },
    { label: "Amendment to Articles – Dissolution Provisions", statute: "Wis. Stat. § 181.1001" },
    { label: "Amendment to Articles – Other Provision", statute: "Wis. Stat. § 181.1001" },
    { label: "Restated Articles of Incorporation", statute: "Wis. Stat. § 181.1006" },
    { label: "Amendment to Bylaws", statute: "Wis. Stat. § 181.1020" },
    { label: "Adoption of New Bylaws", statute: "Wis. Stat. § 181.1020" },
    { label: "Repeal of Bylaws Provision", statute: "Wis. Stat. § 181.1020" },
    { label: "Other" },
  ],
  Partnership: [
    { label: "Amendment to Partnership Agreement – Name Change" },
    { label: "Amendment to Partnership Agreement – Partner Admission" },
    { label: "Amendment to Partnership Agreement – Partner Withdrawal" },
    { label: "Amendment to Partnership Agreement – Profit/Loss Sharing" },
    { label: "Amendment to Partnership Agreement – Management Authority" },
    { label: "Amendment to Partnership Agreement – Capital Contributions" },
    { label: "Amendment to Partnership Agreement – Distribution Policy" },
    { label: "Amendment to Partnership Agreement – Dissolution Terms" },
    { label: "Amendment to Partnership Agreement – Other Provision" },
    { label: "Amendment to Certificate of Limited Partnership", statute: "Wis. Stat. § 179.09" },
    { label: "Restated Certificate of Limited Partnership", statute: "Wis. Stat. § 179.09" },
    { label: "Other" },
  ],
};

interface Props {
  meetingId: string;
  entityType: string;
}

export default function MeetingAmendments({ meetingId, entityType }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amendmentType, setAmendmentType] = useState("");
  const [amendmentText, setAmendmentText] = useState("");

  const amendmentOptions = AMENDMENT_TYPES[entityType] || AMENDMENT_TYPES["Corporation"];

  const { data: rows = [] } = useQuery({
    queryKey: ["meeting_amendments", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_amendments" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data as any[];
    },
  });

  const addRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_amendments" as any)
        .insert({
          meeting_id: meetingId,
          amendment_type: amendmentType,
          amendment_text: amendmentText,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_amendments", meetingId] });
      closeDialog();
      toast.success("Amendment added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateRow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("meeting_amendments" as any)
        .update({
          amendment_type: amendmentType,
          amendment_text: amendmentText,
        } as any)
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_amendments", meetingId] });
      closeDialog();
      toast.success("Amendment updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteRow = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase
        .from("meeting_amendments" as any)
        .delete()
        .eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_amendments", meetingId] });
      toast.success("Amendment removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setAmendmentType("");
    setAmendmentText("");
  };

  const openEdit = (row: any) => {
    setEditingId(row.id);
    setAmendmentType(row.amendment_type || "");
    setAmendmentText(row.amendment_text || "");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateRow.mutate();
    } else {
      addRow.mutate();
    }
  };

  const isPending = addRow.isPending || updateRow.isPending;
  const selectedOption = amendmentOptions.find((o) => o.label === amendmentType);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Amendments</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setAmendmentType(""); setAmendmentText(""); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Amendment" : "Add Amendment"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update" : "Select"} the type of amendment for this {entityType} entity.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Amendment Type</Label>
                <Select value={amendmentType} onValueChange={setAmendmentType} required>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select amendment type…" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[300px]">
                    {amendmentOptions.map((opt) => (
                      <SelectItem key={opt.label} value={opt.label}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOption?.statute && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Ref: {selectedOption.statute}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Amendment Details</Label>
                <Textarea
                  value={amendmentText}
                  onChange={(e) => setAmendmentText(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the amendment…"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isPending || !amendmentType}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Amendment"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">No amendments recorded</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row: any) => {
                  const match = amendmentOptions.find((o) => o.label === row.amendment_type);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <div className="font-medium text-sm">{row.amendment_type || "—"}</div>
                        {match?.statute && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{match.statute}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-pre-wrap">{row.amendment_text}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(row)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(row.id)}
                            className="h-8 w-8 text-destructive/60 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}