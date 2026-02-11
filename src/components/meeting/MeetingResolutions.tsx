import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

const RESOLUTION_PURPOSES = [
  "Authorize a line of credit",
  "Approve Officer Bonuses",
  "Approve Issuance, Transfer, Sale of Shares",
  "Adopt Regular Meeting Resolution",
  "Approve Distributions",
  "Elect Officers",
  "Name Directors to Committees",
  "Other",
];

const RESOLUTION_TEMPLATES: Record<string, string> = {
  "Authorize a line of credit":
    "WHEREAS, it would be in the best interests of the corporation to obtain a line of credit, and after discussion, it was\n\nRESOLVED, that the proper officers of this corporation are hereby authorized to contact the Bank and are further authorized to execute any documents necessary to establish a line of credit not to exceed $_______ (amount) dollars for and on behalf of the corporation.",
  "Approve Officer Bonuses":
    "WHEREAS, the Board of Directors has reviewed the performance of the officers of the corporation and, after discussion, it was\n\nRESOLVED, that bonuses be paid to the following officers in the amounts set forth below:\n\n[Officer Name] - $[Amount]",
  "Adopt Regular Meeting Resolution":
    "RESOLVED, that regular meetings of the Board of Directors shall be held on the ______ day of each ______ at ______ o'clock at the principal office of the corporation, or at such other place as may be designated by the Chairman.",
};

interface Props {
  meetingId: string;
}

export default function MeetingResolutions({ meetingId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [resolutionText, setResolutionText] = useState("");

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
      setDialogOpen(false);
      setPurpose("");
      setResolutionText("");
      toast.success("Resolution added!");
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

  const handlePurposeChange = (value: string) => {
    setPurpose(value);
    if (RESOLUTION_TEMPLATES[value]) {
      setResolutionText(RESOLUTION_TEMPLATES[value]);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="font-display text-base">Resolutions</CardTitle>
          </div>
          <CardDescription className="mt-1">
            Select a purpose to auto-fill a boiler plate resolution, or create a custom one
          </CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display">Add Resolution</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addResolution.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Purpose of Meeting</Label>
                <Select value={purpose} onValueChange={handlePurposeChange}>
                  <SelectTrigger><SelectValue placeholder="Choose a purpose..." /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_PURPOSES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Button type="submit" className="w-full" disabled={addResolution.isPending}>
                {addResolution.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Resolution
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
            {resolutions.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                      {r.purpose}
                    </p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.resolution_text}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteResolution.mutate(r.id)}
                    className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
