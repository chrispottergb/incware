import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Upload,
  FileText,
  Search,
  Loader2,
  Trash2,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DFI_FILING_URL =
  "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/FileOnline.aspx";
const DFI_SEARCH_URL =
  "https://apps.dfi.wi.gov/apps/corpsearch/search.aspx";

type ChecklistItem = {
  id: string;
  company_id: string;
  item_name: string;
  status: string;
  ein_number: string | null;
  document_file_name: string | null;
  document_file_path: string | null;
  notes: string | null;
  filed_date: string | null;
  created_at: string;
  updated_at: string;
};

function getRequiredFilings(entityType: string | undefined): string[] {
  switch (entityType) {
    case "Corporation":
      return [
        "Articles of Incorporation",
        "EIN Registration",
        "IRS Form 2553",
      ];
    case "S-Corp":
      return [
        "Articles of Incorporation",
        "EIN Registration",
        "IRS Form 2553 (S-Corp Election)",
      ];
    case "LLC":
    case "LLC-S":
    case "Single Member LLC":
      return [
        "Articles of Organization",
        "EIN Registration",
        "IRS Form 2553",
      ];
    case "Non-Profit":
      return [
        "Articles of Incorporation",
        "EIN Registration",
        "Initial Board Meeting Minutes",
        "IRS Form 1023/1023-EZ",
      ];
    case "Partnership":
      return [
        "Partnership Agreement",
        "EIN Registration",
        "Statement of Partnership",
      ];
    default:
      return [
        "Formation Documents",
        "EIN Registration",
      ];
  }
}

function getOptionalFilings(_entityType: string | undefined): string[] {
  return [];
}

function getFileOnlineUrl(itemName: string): string {
  if (itemName.toLowerCase().includes("ein")) return "https://sa.www4.irs.gov/applyein/";
  if (itemName.toLowerCase().includes("2553")) return "https://www.irs.gov/forms-pubs/about-form-2553";
  if (itemName.toLowerCase().includes("1023")) return "https://www.irs.gov/forms-pubs/about-form-1023-ez";
  return DFI_FILING_URL;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  pending: { label: "Pending", color: "bg-muted text-muted-foreground border-muted", icon: Circle },
  filed: { label: "Filed", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Clock },
  complete: { label: "Complete", color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
};

interface Props {
  companyId: string;
  entityType: string | undefined;
}

export default function FilingComplianceTab({ companyId, entityType }: Props) {
  const queryClient = useQueryClient();
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);

  const requiredFilings = useMemo(() => getRequiredFilings(entityType), [entityType]);
  const optionalFilings = useMemo(() => getOptionalFilings(entityType), [entityType]);
  const allFilings = useMemo(() => [...requiredFilings, ...optionalFilings], [requiredFilings, optionalFilings]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["filing-checklist", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("filing_checklist")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at");
      if (error) throw error;
      return data as ChecklistItem[];
    },
  });

  // Seed missing checklist items
  useEffect(() => {
    if (isLoading) return;
    const existing = new Set(items.map((i) => i.item_name));
    const missing = allFilings.filter((f) => !existing.has(f));
    if (missing.length === 0) return;

    const rows = missing.map((name) => ({
      company_id: companyId,
      item_name: name,
      status: "pending",
    }));

    supabase
      .from("filing_checklist")
      .insert(rows)
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["filing-checklist", companyId] });
        }
      });
  }, [isLoading, items, allFilings, companyId, queryClient]);

  const updateItem = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ChecklistItem> }) => {
      const { error } = await supabase
        .from("filing_checklist")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["filing-checklist", companyId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleFileUpload = async (item: ChecklistItem, file: File) => {
    setUploadingItem(item.id);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${item.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("filing-documents")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      await updateItem.mutateAsync({
        id: item.id,
        updates: { document_file_name: file.name, document_file_path: path },
      });
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingItem(null);
    }
  };

  const handleDownload = async (item: ChecklistItem) => {
    if (!item.document_file_path) return;
    const { data, error } = await supabase.storage
      .from("filing-documents")
      .createSignedUrl(item.document_file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Failed to generate download link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleRemoveFile = async (item: ChecklistItem) => {
    if (!item.document_file_path) return;
    await supabase.storage.from("filing-documents").remove([item.document_file_path]);
    await updateItem.mutateAsync({
      id: item.id,
      updates: { document_file_name: null, document_file_path: null },
    });
    toast.success("Document removed");
  };

  // Order items to match allFilings order
  const orderedItems = useMemo(() => {
    const map = new Map(items.map((i) => [i.item_name, i]));
    const ordered: ChecklistItem[] = [];
    for (const name of allFilings) {
      const item = map.get(name);
      if (item) ordered.push(item);
    }
    // Add any items not in allFilings at the end
    for (const item of items) {
      if (!allFilings.includes(item.item_name)) {
        ordered.push(item);
      }
    }
    return ordered;
  }, [items, allFilings]);

  const completedCount = items.filter((i) => i.status === "complete").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with progress and DFI links */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Filing &amp; Compliance Checklist</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} of {orderedItems.length} items complete
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href={DFI_SEARCH_URL} target="_blank" rel="noopener noreferrer">
              <Search className="h-3 w-3 mr-1.5" />
              WI DFI Name Search
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href={DFI_FILING_URL} target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3 mr-1.5" />
              WI DFI File Online
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href="https://www.revenue.wi.gov/Pages/FAQS/pcs-btr.aspx" target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3 mr-1.5" />
              WI Business Tax Registration
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
            </a>
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href="https://dsps.wi.gov/Pages/Professions/Default.aspx" target="_blank" rel="noopener noreferrer">
              <FileText className="h-3 w-3 mr-1.5" />
              Professional Licenses
              <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
            </a>
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: orderedItems.length > 0 ? `${(completedCount / orderedItems.length) * 100}%` : "0%" }}
        />
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {orderedItems.map((item) => {
          const cfg = statusConfig[item.status] || statusConfig.pending;
          const StatusIcon = cfg.icon;
          const isUploading = uploadingItem === item.id;
          const isOptional = optionalFilings.includes(item.item_name);

          return (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
            >
              {/* Row 1: Status, name, badge */}
              <div className="flex items-center gap-3">
                <StatusIcon
                  className={`h-4 w-4 shrink-0 ${
                    item.status === "complete"
                      ? "text-success"
                      : item.status === "filed"
                      ? "text-amber-500"
                      : "text-muted-foreground/50"
                  }`}
                />
                <span className="text-xs font-medium flex-1">{item.item_name}</span>
                {isOptional && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-muted">
                    Optional
                  </Badge>
                )}
                <Select
                  value={item.status}
                  onValueChange={(val) =>
                    updateItem.mutate({ id: item.id, updates: { status: val } })
                  }
                >
                  <SelectTrigger className="h-6 w-[100px] text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                    <SelectItem value="filed" className="text-xs">Filed</SelectItem>
                    <SelectItem value="complete" className="text-xs">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: EIN, file date, file upload, DFI link */}
              <div className="flex items-center gap-2 flex-wrap pl-7">
                {item.item_name.toLowerCase().includes("ein") && (
                  <Input
                    placeholder="XX-XXXXXXX"
                    value={item.ein_number || ""}
                    onChange={(e) =>
                      updateItem.mutate({
                        id: item.id,
                        updates: { ein_number: e.target.value },
                      })
                    }
                    className="h-7 w-[120px] text-xs"
                  />
                )}
                <Input
                  type="date"
                  value={item.filed_date || ""}
                  onChange={(e) =>
                    updateItem.mutate({
                      id: item.id,
                      updates: { filed_date: e.target.value || null },
                    })
                  }
                  className="h-7 w-[130px] text-xs"
                  title="Date filed"
                />

                {/* File upload / display */}
                {item.document_file_path ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-primary"
                      onClick={() => handleDownload(item)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      {item.document_file_name || "Document"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveFile(item)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(item, f);
                        e.target.value = "";
                      }}
                      disabled={isUploading}
                    />
                    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors">
                      {isUploading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      Upload
                    </span>
                  </label>
                )}

                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" asChild>
                  <a href={getFileOnlineUrl(item.item_name)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    File Online
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
