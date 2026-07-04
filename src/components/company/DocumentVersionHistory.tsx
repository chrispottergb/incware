import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { History, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
  documentType: string | string[];
}

export default function DocumentVersionHistory({ companyId, documentType }: Props) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

  const docTypeList = Array.isArray(documentType) ? documentType : [documentType];
  const queryKey = ["doc-versions", companyId, docTypeList.join("|")];

  const { data: versions = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const base = supabase
        .from("document_registry")
        .select("*")
        .eq("company_id", companyId);
      const filtered = docTypeList.length > 1
        ? base.in("document_type", docTypeList)
        : base.eq("document_type", docTypeList[0]);
      const { data, error } = await filtered.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const removeStorage = async (rows: any[]) => {
    const paths = rows.map((r) => r.file_name).filter(Boolean);
    if (paths.length === 0) return;
    await supabase.storage.from("generated-documents").remove(paths);
  };

  const handleDeleteOne = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeStorage([deleteTarget]);
      const { error } = await supabase
        .from("document_registry")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey });
      toast.success("Version deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete version");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAll = async () => {
    setBusy(true);
    try {
      await removeStorage(versions);
      const baseDel = supabase
        .from("document_registry")
        .delete()
        .eq("company_id", companyId);
      const delQ = docTypeList.length > 1
        ? baseDel.in("document_type", docTypeList)
        : baseDel.eq("document_type", docTypeList[0]);
      const { error } = await delQ;
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey });
      toast.success("All versions deleted");
      setConfirmAll(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete versions");
    } finally {
      setBusy(false);
    }
  };

  if (versions.length === 0) return null;

  return (
    <>
      <Collapsible open={showHistory} onOpenChange={setShowHistory}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              <History className="h-3 w-3" />
              Version History ({versions.length})
              <ChevronDown className="h-3 w-3" />
            </Button>
          </CollapsibleTrigger>
          {showHistory && versions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-destructive hover:text-destructive gap-1"
              onClick={() => setConfirmAll(true)}
            >
              <Trash2 className="h-3 w-3" /> Delete All Versions
            </Button>
          )}
        </div>
        <CollapsibleContent className="mt-2">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            {versions.map((v: any, i: number) => (
              <div key={v.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="outline" className="text-[9px] h-4">v{versions.length - i}</Badge>
                  {i === 0 && <Badge className="text-[9px] h-4 bg-primary">Current</Badge>}
                  <span className="text-muted-foreground truncate">{v.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(v)}
                    aria-label="Delete version"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this version? This cannot be undone.</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && versions[0]?.id === deleteTarget.id && (
                <span className="block mb-2 text-amber-600 font-medium">
                  Warning: this is the current (latest) version.
                </span>
              )}
              {deleteTarget?.title}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteOne(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {versions.length} versions?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes every saved snapshot of this document, including the current version. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteAll(); }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
