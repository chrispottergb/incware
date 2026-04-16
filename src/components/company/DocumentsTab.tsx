import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  Pin,
  PinOff,
  Search,
  FileText,
  FileSpreadsheet,
  File,
  Loader2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { QueryErrorBanner } from "@/components/ui/query-error-banner";

const CATEGORIES = [
  "Formation Documents",
  "Meeting Minutes & Resolutions",
  "Annual Filings",
  "Agreements & Contracts",
  "Correspondence",
  "Tax Documents",
  "Miscellaneous",
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  "Formation Documents": FileText,
  "Meeting Minutes & Resolutions": FileText,
  "Annual Filings": FileText,
  "Agreements & Contracts": FileText,
  "Correspondence": FileText,
  "Tax Documents": FileSpreadsheet,
  "Miscellaneous": File,
};

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.includes("pdf")) return FileText;
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("csv")) return FileSpreadsheet;
  return FileText;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  companyId: string;
}

export default function DocumentsTab({ companyId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [uploadCategory, setUploadCategory] = useState<Category>("Miscellaneous");
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: documents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["company_documents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documents")
        .select("*")
        .eq("company_id", companyId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = documents.filter((doc) => {
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    const matchesSearch = !search || doc.file_name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter((d) => d.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, typeof documents>);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const ALLOWED_EXTENSIONS = [".pdf",".doc",".docx",".xls",".xlsx",".csv",".txt",".rtf",".jpg",".jpeg",".png"];

  // Sanitize a string for safe use in a Supabase Storage object key.
  // Keeps alphanumerics, dot, dash, underscore. Replaces everything else with `_`,
  // collapses repeats, and trims leading/trailing separators.
  const sanitizeForStorage = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[._-]+|[._-]+$/g, "")
      .toLowerCase() || "file";

  const sanitizeFileName = (name: string) => {
    const dot = name.lastIndexOf(".");
    if (dot <= 0) return sanitizeForStorage(name);
    const base = sanitizeForStorage(name.slice(0, dot));
    const ext = name.slice(dot + 1).replace(/[^\w]+/g, "").toLowerCase();
    return ext ? `${base}.${ext}` : base;
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;

    // Validate files before uploading
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File "${file.name}" exceeds the 20 MB size limit.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`File type "${ext}" is not allowed. Accepted: ${ALLOWED_EXTENSIONS.join(", ")}`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${companyId}/${uploadCategory}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("company-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase
          .from("company_documents")
          .insert({
            company_id: companyId,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            category: uploadCategory,
          });
        if (insertError) throw insertError;
      }
      queryClient.invalidateQueries({ queryKey: ["company_documents", companyId] });
      toast.success(`${files.length} file(s) uploaded`);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: (typeof documents)[0]) => {
    try {
      // If file_path is a full URL (public Supabase URL or any https URL), open directly
      if (doc.file_path.startsWith("http://") || doc.file_path.startsWith("https://")) {
        window.open(doc.file_path, "_blank");
        return;
      }
      // Otherwise treat as a relative storage path in company-documents bucket
      const { data, error } = await supabase.storage
        .from("company-documents")
        .download(doc.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed. Please try again.");
    }
  };

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const { error } = await supabase
        .from("company_documents")
        .update({ is_pinned: pinned })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company_documents", companyId] }),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      await supabase.storage.from("company-documents").remove([doc.file_path]);
      const { error } = await supabase.from("company_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_documents", companyId] });
      toast.success("Document deleted");
      setDeleteId(null);
    },
  });

  const renameDoc = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      const { error } = await supabase
        .from("company_documents")
        .update({ file_name: newName })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_documents", companyId] });
      setRenamingId(null);
      toast.success("Document renamed");
    },
  });

  const changeCategoryMut = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from("company_documents")
        .update({ category })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company_documents", companyId] }),
  });

  const categoryCounts = CATEGORIES.map((cat) => ({
    name: cat,
    count: documents.filter((d) => d.category === cat).length,
  }));

  return (
    <div className="space-y-4">
      {/* Upload bar */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as Category)}>
              <SelectTrigger className="h-8 w-[220px] text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
              Upload Files
            </Button>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents..."
                className="h-8 pl-8 text-xs w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={selectedCategory === "all" ? "default" : "outline"}
          className="cursor-pointer text-[10px] px-2 py-0.5"
          onClick={() => setSelectedCategory("all")}
        >
          All ({documents.length})
        </Badge>
        {categoryCounts.map((cc) => (
          <Badge
            key={cc.name}
            variant={selectedCategory === cc.name ? "default" : "outline"}
            className="cursor-pointer text-[10px] px-2 py-0.5"
            onClick={() => {
              setSelectedCategory(cc.name);
              setUploadCategory(cc.name as Category);
            }}
          >
            {cc.name} ({cc.count})
          </Badge>
        ))}
      </div>

      {/* Document list */}
      {isError ? (
        <QueryErrorBanner message="Failed to load documents." onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {documents.length === 0
                ? "No documents uploaded yet. Use the upload button above to get started."
                : "No documents match your search or filter."}
            </p>
          </CardContent>
        </Card>
      ) : selectedCategory === "all" ? (
        // Show grouped by category
        Object.entries(grouped).map(([cat, docs]) => (
          <Card key={cat}>
            <CardHeader className="py-2.5 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                {cat}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{docs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <DocumentTable
                docs={docs}
                onDownload={handleDownload}
                onDelete={setDeleteId}
                onTogglePin={(id, pinned) => togglePin.mutate({ id, pinned })}
                onRename={(id, name) => { setRenamingId(id); setRenameValue(name); }}
                renamingId={renamingId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onRenameSubmit={(id) => renameDoc.mutate({ id, newName: renameValue })}
                onRenameCancel={() => setRenamingId(null)}
                onCategoryChange={(id, cat) => changeCategoryMut.mutate({ id, category: cat })}
                showCategory={false}
              />
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="px-0 py-0">
            <DocumentTable
              docs={filtered}
              onDownload={handleDownload}
              onDelete={setDeleteId}
              onTogglePin={(id, pinned) => togglePin.mutate({ id, pinned })}
              onRename={(id, name) => { setRenamingId(id); setRenameValue(name); }}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onRenameSubmit={(id) => renameDoc.mutate({ id, newName: renameValue })}
              onRenameCancel={() => setRenamingId(null)}
              onCategoryChange={(id, cat) => changeCategoryMut.mutate({ id, category: cat })}
              showCategory
            />
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteDoc.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Document Table ─── */
function DocumentTable({
  docs,
  onDownload,
  onDelete,
  onTogglePin,
  onRename,
  renamingId,
  renameValue,
  setRenameValue,
  onRenameSubmit,
  onRenameCancel,
  onCategoryChange,
  showCategory,
}: {
  docs: any[];
  onDownload: (doc: any) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRename: (id: string, name: string) => void;
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onRenameSubmit: (id: string) => void;
  onRenameCancel: () => void;
  onCategoryChange: (id: string, cat: string) => void;
  showCategory: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs w-8"></TableHead>
            <TableHead className="text-xs">File Name</TableHead>
            {showCategory && <TableHead className="text-xs">Category</TableHead>}
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Size</TableHead>
            <TableHead className="text-xs">Uploaded</TableHead>
            <TableHead className="text-xs w-[140px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {docs.map((doc) => {
            const Icon = getFileIcon(doc.file_type);
            return (
              <TableRow key={doc.id}>
                <TableCell className="px-2">
                  {doc.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                </TableCell>
                <TableCell className="text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {renamingId === doc.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-6 text-xs w-[200px]"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onRenameSubmit(doc.id);
                            if (e.key === "Escape") onRenameCancel();
                          }}
                        />
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onRenameSubmit(doc.id)}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={onRenameCancel}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="truncate max-w-[300px]">{doc.file_name}</span>
                    )}
                  </div>
                </TableCell>
                {showCategory && (
                  <TableCell>
                    <Select value={doc.category} onValueChange={(v) => onCategoryChange(doc.id, v)}>
                      <SelectTrigger className="h-6 text-[10px] w-[160px] border-none bg-transparent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground">
                  {doc.file_type?.split("/").pop()?.toUpperCase() || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(doc.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(doc)} title="Download">
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRename(doc.id, doc.file_name)} title="Rename">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => onTogglePin(doc.id, !doc.is_pinned)}
                      title={doc.is_pinned ? "Unpin" : "Pin to top"}
                    >
                      {doc.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(doc.id)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
