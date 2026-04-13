import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { maskEin } from "@/lib/utils";
import {
  Upload, FileText, Loader2, CheckCircle2, Building2,
  DollarSign, Users, Car, Wrench, PiggyBank, AlertCircle,
  XCircle, Clock, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

interface ExtractedData {
  form_type: string;
  tax_year: number;
  company: {
    name: string;
    ein: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    fiscal_year_end: string;
    business_purpose: string | null;
    entity_type: string;
    accounting_method: string;
    naics_code: string | null;
  };
  financials: {
    total_sales: number | null;
    cost_of_goods_sold: number | null;
    gross_profit: number | null;
    net_income: number | null;
    total_assets: number | null;
    total_liabilities: number | null;
    cog_ratio: number | null;
  };
  officers: { name: string; title: string; compensation: number | null; ownership_pct: number | null }[];
  shareholders: { name: string; ssn_ein: string | null; ownership_pct: number | null }[];
  vehicles: { description: string; year: string | null; make: string | null; model: string | null; cost: number | null }[];
  equipment: { description: string; year: string | null; manufacturer: string | null; model: string | null; cost: number | null }[];
  retirement_contributions: { plan_type: string | null; total_contribution: number | null; employer_contribution: number | null };
  depreciation_items: { description: string; cost: number | null; method: string | null; current_deduction: number | null }[];
}

interface FileEntry {
  id: string;
  file: File;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  data?: ExtractedData;
  error?: string;
  retries?: number;
}

interface Props {
  companyId?: string;
  mode?: "extract" | "populate";
  onExtracted?: (data: ExtractedData) => void;
  onCompanyCreated?: (companyId: string) => void;
  trigger?: React.ReactNode;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function TaxReturnUpload({ companyId, mode = "extract", onExtracted, onCompanyCreated, trigger, externalOpen, onExternalOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onExternalOpenChange?.(v);
    else setInternalOpen(v);
  };
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState<{
    meetings: number;
    shareholders: number;
    vehicles: number;
    equipment: number;
    officers: number;
    taxYears: number[];
    companyName: string;
  } | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  // ── Tax Return Job History ──
  const { data: jobHistory = [] } = useQuery({
    queryKey: ["tax_return_jobs", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_return_jobs" as any)
        .select("id, status, file_name, error, created_at, updated_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: processing ? 5000 : false,
  });

  const extractedList = files
    .filter((f) => f.status === "done" && f.data)
    .map((f) => f.data!)
    .sort((a, b) => a.tax_year - b.tax_year);

  const completedCount = files.filter((f) => f.status === "done" || f.status === "error").length;
  const processingCount = files.filter((f) => f.status === "processing").length;
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  const buildAndShowSummary = (dataList: ExtractedData[]) => {
    const seenShareholders = new Set<string>();
    const seenVehicles = new Set<string>();
    const seenEquipment = new Set<string>();
    let officerCount = 0;
    const taxYears: number[] = [];

    for (const d of dataList) {
      if (d.tax_year) taxYears.push(d.tax_year);
      officerCount += d.officers?.length || 0;
      for (const s of d.shareholders || []) seenShareholders.add(s.name.toLowerCase().trim());
      for (const v of d.vehicles || []) seenVehicles.add((v.description || `${v.year} ${v.make} ${v.model}`).toLowerCase());
      for (const eq of d.equipment || []) seenEquipment.add((eq.description || `${eq.manufacturer} ${eq.model}`).toLowerCase());
    }

    const meetingsCount = dataList.filter((d) => d.tax_year && d.financials.total_sales !== null).length;
    const latest = dataList[dataList.length - 1];

    setSummaryData({
      meetings: meetingsCount,
      shareholders: seenShareholders.size,
      vehicles: seenVehicles.size,
      equipment: seenEquipment.size,
      officers: officerCount,
      taxYears: taxYears.sort(),
      companyName: latest?.company?.name || "Company",
    });
    setShowSummary(true);
  };

  // Simulate real-time progress while a file is being parsed
  useEffect(() => {
    if (processingCount === 0) {
      setSimulatedProgress(0);
      return;
    }
    setSimulatedProgress(8);
    const interval = setInterval(() => {
      setSimulatedProgress((prev) => {
        // Keep moving so UI never appears frozen while server-side parsing/retries run
        if (prev >= 99) return 99;
        const increment = prev < 30 ? 3 : prev < 60 ? 2 : prev < 85 ? 1 : 0.35;
        return Math.min(prev + increment, 99);
      });
    }, 500);
    return () => clearInterval(interval);
  }, [processingCount]);

  const progressPct = files.length > 0
    ? ((completedCount + (processingCount > 0 ? simulatedProgress / 100 : 0)) / files.length) * 100
    : 0;

  const handleFiles = async (newFiles: File[]) => {
    const valid = newFiles.filter((f) => {
      if (f.size > 20 * 1024 * 1024) {
        toast.error(`${f.name} exceeds 20MB limit`);
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    const entries: FileEntry[] = valid.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...entries]);
    setProcessing(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Please log in first");
      setProcessing(false);
      return;
    }

    cancelledRef.current = false;

    // Process sequentially
    for (const entry of entries) {
      if (cancelledRef.current) break;
      await processEntry(entry, session.access_token);
    }

    setProcessing(false);
    // In populate mode WITH companyId, the edge function already saved data server-side
    // so we can show the summary immediately. Without companyId, the user needs to click Save
    // to create a new company client-side.
    if (mode === "populate" && companyId) {
      setFiles((prev) => {
        const doneData = prev.filter((f) => f.status === "done" && f.data).map((f) => f.data!);
        if (doneData.length > 0) {
          buildAndShowSummary(doneData);
        }
        return prev;
      });
    }
    const doneCount = entries.filter((e) => e.status !== "error").length;
    if (doneCount > 0 && mode !== "populate") {
      toast.success(`Parsed ${entries.length} tax return(s)`);
    }
  };

  const UPLOAD_TIMEOUT_MS = 30_000; // 30s for initial upload + job creation
  const POLL_INTERVAL_MS = 3_000; // poll every 3 seconds
  const POLL_TIMEOUT_MS = 300_000; // 5 minutes max polling time
  const MAX_RETRIES = 2;

  const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      abortRef.current = null;
    });
  };

  const cancelProcessing = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setProcessing(false);
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "processing" ? { ...f, status: "error", error: "Cancelled" } : f
      )
    );
    toast.info("Parsing cancelled");
  };

  const pollForResult = async (jobId: string, accessToken: string): Promise<ExtractedData> => {
    const startTime = Date.now();

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      if (cancelledRef.current) throw new Error("Cancelled");

      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poll-tax-return-job`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ job_id: jobId }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Poll failed (${resp.status})`);
      }

      const job = await resp.json();

      if (job.status === "completed" && job.extracted) {
        return job.extracted as ExtractedData;
      } else if (job.status === "failed") {
        throw new Error(job.error || "AI processing failed");
      }
      // status === "processing" → keep polling
    }

    throw new Error("Processing timed out after 5 minutes");
  };

  const processEntry = async (entry: FileEntry, accessToken: string, retryCount = 0) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: "processing", error: undefined, retries: retryCount } : f))
    );

    try {
      // Step 1: Upload file and get job_id (fast, returns immediately)
      const formData = new FormData();
      formData.append("file", entry.file);
      formData.append("mode", mode);
      if (companyId) formData.append("company_id", companyId);
      if (pdfPassword.trim()) formData.append("pdf_password", pdfPassword.trim());

      const response = await fetchWithTimeout(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-tax-return`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        },
        UPLOAD_TIMEOUT_MS
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const data = await response.json();

      // Step 2: Poll for completion
      const extracted = await pollForResult(data.job_id, accessToken);
      onExtracted?.(extracted);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, status: "done", data: extracted } : f
        )
      );
    } catch (err: any) {
      const isTimeout = err.name === "AbortError";
      const errorMsg = isTimeout ? "Upload timed out" : err.message;

      // Auto-retry on timeout or 5xx
      if (retryCount < MAX_RETRIES && (isTimeout || /5\d{2}/.test(err.message))) {
        console.warn(`Retry ${retryCount + 1}/${MAX_RETRIES} for ${entry.name}`);
        toast.info(`Retrying ${entry.name}… (attempt ${retryCount + 2})`);
        await processEntry(entry, accessToken, retryCount + 1);
        return;
      }

      console.error(err);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id ? { ...f, status: "error", error: errorMsg, retries: retryCount } : f
        )
      );
    }
  };

  const retryFile = async (entry: FileEntry) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Please log in first"); return; }
    setProcessing(true);
    await processEntry(entry, session.access_token);
    setProcessing(false);
  };

  const handleSaveAll = async () => {
    if (extractedList.length === 0) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      let targetCompanyId = companyId;
      // Use most recent year for company info
      const latest = extractedList[extractedList.length - 1];

      if (!targetCompanyId) {
        const { data: newComp, error: createErr } = await supabase
          .from("companies")
          .insert({
            user_id: session.user.id,
            name: latest.company.name || "New Company",
            entity_type: latest.company.entity_type || "Corporation",
            state_of_incorporation: latest.company.state || null,
            address: latest.company.address || null,
            city: latest.company.city || null,
            state: latest.company.state || null,
            zip: latest.company.zip || null,
            fiscal_year_end: latest.company.fiscal_year_end || null,
            business_purpose: latest.company.business_purpose || null,
            accounting_method: latest.company.accounting_method || null,
            naics_code: latest.company.naics_code || null,
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        targetCompanyId = newComp.id;
        onCompanyCreated?.(newComp.id);
      } else {
        // Update company with latest year info
        const c = latest.company;
        await supabase.from("companies").update({
          address: c.address || undefined,
          city: c.city || undefined,
          state: c.state || undefined,
          zip: c.zip || undefined,
          fiscal_year_end: c.fiscal_year_end || undefined,
          business_purpose: c.business_purpose || undefined,
          accounting_method: c.accounting_method || undefined,
          naics_code: c.naics_code || undefined,
        }).eq("id", targetCompanyId);
      }

      // Create meetings & financials per year, linking previous year data
      for (let i = 0; i < extractedList.length; i++) {
        const d = extractedList[i];
        const prev = i > 0 ? extractedList[i - 1] : null;
        const f = d.financials;

        if (d.tax_year && f.total_sales !== null) {
          const { data: mtg } = await supabase.from("meetings").insert({
            company_id: targetCompanyId,
            meeting_date: `${d.tax_year}-12-31`,
            meeting_type: "Annual Meeting",
            tax_year: d.tax_year,
          }).select("id").single();

          if (mtg) {
            await supabase.from("meeting_financials").insert({
              meeting_id: mtg.id,
              current_total_sales: f.total_sales,
              current_cog: f.cost_of_goods_sold,
              current_gross_profit: f.gross_profit,
              current_net_income: f.net_income,
              current_cog_ratio: f.cog_ratio,
              previous_total_sales: prev?.financials.total_sales ?? null,
              previous_cog: prev?.financials.cost_of_goods_sold ?? null,
              previous_gross_profit: prev?.financials.gross_profit ?? null,
              previous_net_income: prev?.financials.net_income ?? null,
              previous_cog_ratio: prev?.financials.cog_ratio ?? null,
            });
          }
        }
      }

      // De-duplicate & insert assets
      const seenAssets = new Set<string>();
      const allAssets: any[] = [];
      for (const d of extractedList) {
        for (const v of d.vehicles || []) {
          const key = `vehicle:${v.description || `${v.year} ${v.make} ${v.model}`}`.toLowerCase();
          if (!seenAssets.has(key)) {
            seenAssets.add(key);
            allAssets.push({
              company_id: targetCompanyId,
              asset_type: "Vehicle",
              description: v.description || `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle",
              year: v.year || null, make: v.make || null, model: v.model || null, cost: v.cost || null,
            });
          }
        }
        for (const eq of d.equipment || []) {
          const key = `equip:${eq.description || `${eq.manufacturer} ${eq.model}`}`.toLowerCase();
          if (!seenAssets.has(key)) {
            seenAssets.add(key);
            allAssets.push({
              company_id: targetCompanyId,
              asset_type: "Equipment",
              description: eq.description || `${eq.manufacturer || ""} ${eq.model || ""}`.trim() || "Equipment",
              year: eq.year || null, manufacturer: eq.manufacturer || null, model: eq.model || null, cost: eq.cost || null,
            });
          }
        }
      }
      if (allAssets.length > 0) {
        await supabase.from("company_assets").insert(allAssets);
      }

      // De-duplicate & insert shareholders
      const seenShareholders = new Set<string>();
      for (const d of extractedList) {
        for (const s of d.shareholders || []) {
          const key = s.name.toLowerCase().trim();
          if (!seenShareholders.has(key)) {
            seenShareholders.add(key);
            const { data: newShareholder } = await supabase.from("shareholders").insert({
              company_id: targetCompanyId,
              name: s.name,
            }).select("id").single();

            // Encrypt SSN/EIN via edge function if provided
            if (newShareholder && s.ssn_ein) {
              await supabase.functions.invoke("encrypt-ssn", {
                body: { shareholder_id: newShareholder.id, ssn_ein: s.ssn_ein },
              });
            }
          }
        }
      }

      buildAndShowSummary(extractedList);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";

  const yoyPct = (curr: number | null, prev: number | null) => {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const YoYBadge = ({ value }: { value: number | null }) => {
    if (value == null) return <span className="text-muted-foreground">—</span>;
    const isPos = value > 0;
    const isZero = Math.abs(value) < 0.01;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isZero ? "text-muted-foreground" : isPos ? "text-success" : "text-destructive"}`}>
        {isZero ? <Minus className="h-3 w-3" /> : isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {value.toFixed(1)}%
      </span>
    );
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Tax Return
    </Button>
  );

  const renderYearPreview = (d: ExtractedData) => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> Company Info
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1 text-xs">
            <p><span className="text-muted-foreground">Name:</span> {d.company.name}</p>
            <p><span className="text-muted-foreground">EIN:</span> {maskEin(d.company.ein)}</p>
            <p><span className="text-muted-foreground">Type:</span> {d.company.entity_type}</p>
            <p><span className="text-muted-foreground">Address:</span> {[d.company.address, d.company.city, d.company.state, d.company.zip].filter(Boolean).join(", ") || "—"}</p>
          </CardContent>
        </Card>
        {/* Financials */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-success" /> Financials
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1 text-xs">
            <p><span className="text-muted-foreground">Revenue:</span> {fmt(d.financials.total_sales)}</p>
            <p><span className="text-muted-foreground">COGS:</span> {fmt(d.financials.cost_of_goods_sold)}</p>
            <p><span className="text-muted-foreground">Net Income:</span> {fmt(d.financials.net_income)}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.officers?.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Officers ({d.officers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs">
              {d.officers.map((o, i) => (
                <p key={i}>{o.name} — {o.title}{o.compensation ? ` (${fmt(o.compensation)})` : ""}</p>
              ))}
            </CardContent>
          </Card>
        )}
        {d.vehicles?.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-warning" /> Vehicles ({d.vehicles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-1 text-xs">
              {d.vehicles.map((v, i) => (
                <p key={i}>{v.description}{v.cost ? ` — ${fmt(v.cost)}` : ""}</p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const handleCloseSummary = () => {
    setShowSummary(false);
    setSummaryData(null);
    setOpen(false);
    setFiles([]);
    setPdfPassword("");
  };

  return (
    <>
    <Dialog open={open && !showSummary} onOpenChange={(v) => { setOpen(v); if (!v) { setFiles([]); setPdfPassword(""); } }}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Import from Tax Returns
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              processing ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
            onClick={() => !processing && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const droppedFiles = Array.from(e.dataTransfer.files);
              if (droppedFiles.length > 0) handleFiles(droppedFiles);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
              onChange={(e) => {
                const selected = Array.from(e.target.files || []);
                if (selected.length > 0) handleFiles(selected);
                e.target.value = "";
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <Upload className="h-10 w-10 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">Drop tax returns here or click to upload</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload multiple years at once · PDF, JPG, PNG, TIFF · Forms 1120, 1120-S, 1065, 990
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="tax-pdf-password" className="text-xs font-medium text-foreground">
              PDF password (optional)
            </label>
            <Input
              id="tax-pdf-password"
              type="password"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              placeholder="Enter password for locked PDFs"
              disabled={processing}
            />
            <p className="text-[10px] text-muted-foreground">
              Only needed for password-protected tax returns.
            </p>
          </div>

          {/* File queue */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {completedCount} of {files.length} parsed
                </p>
                {!processing && files.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFiles([])}>
                    Clear all
                  </Button>
                )}
              </div>
              <Progress value={progressPct} className="h-2" />
              {processing && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground animate-pulse">
                    AI is analyzing the tax return… {Math.round(progressPct)}%
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-5 px-2 text-[10px]"
                    onClick={cancelProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/50">
                    {f.status === "pending" && <Clock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    {f.status === "processing" && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                    {f.status === "done" && <CheckCircle2 className="h-3 w-3 text-success shrink-0" />}
                    {f.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                    <span className="truncate flex-1">{f.name}</span>
                    {f.data && (
                      <Badge variant="outline" className="text-[10px] shrink-0">TY {f.data.tax_year}</Badge>
                    )}
                    {f.status === "error" && (
                      <>
                        <span className="text-destructive truncate max-w-[120px]">{f.error}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[10px] shrink-0"
                          onClick={(e) => { e.stopPropagation(); retryFile(f); }}
                        >
                          Retry
                        </Button>
                      </>
                    )}
                    {!processing && (
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                        <XCircle className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* YoY Summary Table */}
          {extractedList.length > 1 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Year-over-Year Comparison
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1.5 pr-3 font-medium text-muted-foreground">Year</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Revenue</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">YoY</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">COGS</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">YoY</th>
                        <th className="text-right py-1.5 px-2 font-medium text-muted-foreground">Net Income</th>
                        <th className="text-right py-1.5 pl-2 font-medium text-muted-foreground">YoY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedList.map((d, i) => {
                        const prev = i > 0 ? extractedList[i - 1] : null;
                        return (
                          <tr key={d.tax_year} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-medium">{d.tax_year}</td>
                            <td className="text-right py-1.5 px-2">{fmt(d.financials.total_sales)}</td>
                            <td className="text-right py-1.5 px-2">
                              <YoYBadge value={yoyPct(d.financials.total_sales, prev?.financials.total_sales ?? null)} />
                            </td>
                            <td className="text-right py-1.5 px-2">{fmt(d.financials.cost_of_goods_sold)}</td>
                            <td className="text-right py-1.5 px-2">
                              <YoYBadge value={yoyPct(d.financials.cost_of_goods_sold, prev?.financials.cost_of_goods_sold ?? null)} />
                            </td>
                            <td className="text-right py-1.5 px-2">{fmt(d.financials.net_income)}</td>
                            <td className="text-right py-1.5 pl-2">
                              <YoYBadge value={yoyPct(d.financials.net_income, prev?.financials.net_income ?? null)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* YoY Bar Chart */}
                {extractedList.length > 1 && (() => {
                  const chartData = extractedList.map((d) => ({
                    year: String(d.tax_year),
                    Revenue: d.financials.total_sales ?? 0,
                    COGS: d.financials.cost_of_goods_sold ?? 0,
                    "Net Income": d.financials.net_income ?? 0,
                  }));
                  return (
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-[11px] font-medium text-muted-foreground mb-2">Trend Visualization</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="year" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
                          <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} contentStyle={{ fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="COGS" fill="hsl(var(--destructive))" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="Net Income" fill="hsl(var(--success, 142 71% 45%))" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Per-year accordion */}
          {extractedList.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                {extractedList.length === 1
                  ? "Data extracted successfully"
                  : `${extractedList.length} years extracted successfully`}
              </div>

              {extractedList.length === 1 ? (
                renderYearPreview(extractedList[0])
              ) : (
                <Accordion type="multiple" defaultValue={extractedList.map((d) => String(d.tax_year))}>
                  {extractedList.map((d) => (
                    <AccordionItem key={d.tax_year} value={String(d.tax_year)}>
                      <AccordionTrigger className="text-sm py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">TY {d.tax_year}</Badge>
                          <span>{d.company.name}</span>
                          <span className="text-muted-foreground text-xs">
                            Form {d.form_type} · Rev {fmt(d.financials.total_sales)}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {renderYearPreview(d)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">
                  Review the extracted data above. Click "Save" to {companyId ? "update this company's records" : "create a new company"} with {extractedList.length > 1 ? `all ${extractedList.length} years of` : "this"} data.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveAll} disabled={saving} className="flex-1">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-1.5" />
                      {companyId
                        ? `Save ${extractedList.length > 1 ? `All (${extractedList.length} years)` : "to Company"}`
                        : `Create Company & Save${extractedList.length > 1 ? ` All (${extractedList.length} years)` : ""}`
                      }
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Success Summary Dialog */}
    <Dialog open={showSummary} onOpenChange={(v) => { if (!v) handleCloseSummary(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            Import Complete
          </DialogTitle>
        </DialogHeader>
        {summaryData && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Successfully imported data for <span className="font-medium text-foreground">{summaryData.companyName}</span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{summaryData.meetings}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Meeting{summaryData.meetings !== 1 ? "s" : ""} Created</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{summaryData.shareholders}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Shareholder{summaryData.shareholders !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{summaryData.vehicles}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Vehicle{summaryData.vehicles !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{summaryData.equipment}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Equipment</p>
              </div>
            </div>

            {summaryData.officers > 0 && (
              <p className="text-xs text-muted-foreground">
                <Users className="h-3 w-3 inline mr-1" />
                {summaryData.officers} officer{summaryData.officers !== 1 ? "s" : ""} recorded
              </p>
            )}

            {summaryData.taxYears.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Tax year{summaryData.taxYears.length > 1 ? "s" : ""}: {summaryData.taxYears.join(", ")}
              </p>
            )}

            <Button onClick={handleCloseSummary} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    {companyId && jobHistory.length > 0 && (
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Recent Processing Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {jobHistory.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between text-xs border border-border rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {job.status === "completed" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  {job.status === "processing" && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />}
                  {job.status === "failed" && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className="truncate">{job.file_name || "Tax return"}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {job.error && <span className="text-destructive truncate max-w-[200px]">{job.error}</span>}
                  <span className="text-muted-foreground">{new Date(job.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </>
  );
}
