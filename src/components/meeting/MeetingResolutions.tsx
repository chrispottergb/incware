import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";

import { RESOLUTION_TYPES } from "@/lib/resolution-types";

interface Props {
  meetingId: string;
  entityType: string;
  meetingType?: string;
}

export default function MeetingResolutions({ meetingId, entityType, meetingType }: Props) {
  const isSpecialMeeting = meetingType === "Special Meeting of Board of Directors";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [resolutionText, setResolutionText] = useState("");

  const resolutionOptions = RESOLUTION_TYPES[entityType] || RESOLUTION_TYPES["Corporation"];

  const { data: resolutions = [] } = useQuery({
    queryKey: ["meeting_resolutions", meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_resolutions")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const addResolution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_resolutions").insert({
        meeting_id: meetingId,
        purpose,
        resolution_text: resolutionText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      closeDialog();
      toast.success("Resolution added!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateResolution = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_resolutions").update({
        purpose,
        resolution_text: resolutionText,
      }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      closeDialog();
      toast.success("Resolution updated!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteResolution = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_resolutions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", meetingId] });
      toast.success("Resolution removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setPurpose("");
    setResolutionText("");
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setPurpose(r.purpose || "");
    setResolutionText(r.resolution_text || "");
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateResolution.mutate();
    } else {
      addResolution.mutate();
    }
  };

  const handlePurposeChange = (value: string) => {
    setPurpose(value);
    if (!editingId) {
      const selected = resolutionOptions.find((o) => o.label === value);
      if (selected?.template) {
        setResolutionText(selected.template);
      }
    }
  };

  const isPending = addResolution.isPending || updateResolution.isPending;
  const selectedOption = resolutionOptions.find((o) => o.label === purpose);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Resolutions</CardTitle>
          </div>
          <CardDescription className="mt-1">
            Select a resolution type for this <span className="font-semibold">{entityType}</span> entity, or create a custom one
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setPurpose(""); setResolutionText(""); }}>
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display">{editingId ? "Edit Resolution" : "Add Resolution"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Update" : "Select"} the type of resolution for this <span className="font-semibold">{entityType}</span> entity.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Resolution Type</Label>
                <Select value={purpose} onValueChange={handlePurposeChange}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select resolution type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50 max-h-[300px]">
                    {resolutionOptions.map((opt) => (
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
                <Label className="text-xs font-medium text-muted-foreground">Resolution</Label>
                <Textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  rows={8}
                  required
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                If resolutions involve complex issues, it is advised to have your final documentation reviewed by your attorney or tax advisor.
              </p>
              <Button type="submit" className="w-full" disabled={isPending || !purpose}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Add Resolution"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {resolutions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No resolutions yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {resolutions.map((r) => {
              const match = resolutionOptions.find((o) => o.label === r.purpose);
              return (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {isSpecialMeeting && (
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                          {r.purpose}
                        </p>
                      )}
                      {match?.statute && (
                        <p className="text-[10px] text-muted-foreground mb-2">{match.statute}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.resolution_text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteResolution.mutate(r.id)}
                        className="h-8 w-8 text-destructive/60 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
