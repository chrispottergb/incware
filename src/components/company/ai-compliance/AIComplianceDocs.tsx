import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface Props {
  companyId: string;
}

const folders = [
  { value: "technical-docs", label: "Technical Documentation" },
  { value: "risk-assessments", label: "Risk Assessments" },
  { value: "dpia", label: "Data Protection Impact Assessments" },
  { value: "incident-reports", label: "Incident Reports" },
];

export default function AIComplianceDocs({ companyId }: Props) {
  const qc = useQueryClient();
  const [folder, setFolder] = useState("technical-docs");
  const [uploading, setUploading] = useState(false);

  const basePath = `company-${companyId}`;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["ai_compliance_docs", companyId, folder],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("ai-compliance-docs")
        .list(`${basePath}/${folder}`, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      return (data || []).filter(f => f.name !== ".emptyFolderPlaceholder");
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${basePath}/${folder}/${file.name}`;
    const { error } = await supabase.storage.from("ai-compliance-docs").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("File uploaded");
    qc.invalidateQueries({ queryKey: ["ai_compliance_docs", companyId, folder] });
    e.target.value = "";
  };

  const handleDownload = async (name: string) => {
    const path = `${basePath}/${folder}/${name}`;
    const { data, error } = await supabase.storage.from("ai-compliance-docs").download(path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: async (name: string) => {
      const path = `${basePath}/${folder}/${name}`;
      const { error } = await supabase.storage.from("ai-compliance-docs").remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_compliance_docs", companyId, folder] });
      toast.success("File removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
<>
        <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4" />Compliance Documents</h3>
        <div className="flex items-center gap-2">
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{folders.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
          <Label className="cursor-pointer">
            <Button size="sm" variant="outline" asChild disabled={uploading}>
              <span><Upload className="h-3.5 w-3.5 mr-1" />{uploading ? "Uploading…" : "Upload"}</span>
            </Button>
            <Input type="file" className="hidden" onChange={handleUpload} />
          </Label>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No documents in this folder yet.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">File Name</TableHead>
                <TableHead className="text-xs">Size</TableHead>
                <TableHead className="text-xs">Uploaded</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f: any) => (
                <TableRow key={f.name}>
                  <TableCell className="text-xs font-medium">{f.name}</TableCell>
                  <TableCell className="text-xs">{f.metadata?.size ? `${(f.metadata.size / 1024).toFixed(1)} KB` : "—"}</TableCell>
                  <TableCell className="text-xs">{f.created_at ? new Date(f.created_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(f.name)}><Download className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(f.name)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    <ConfirmDeleteDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)} onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }} title="Delete document?" description="This will permanently remove this compliance document." />
    </>
  );
}
