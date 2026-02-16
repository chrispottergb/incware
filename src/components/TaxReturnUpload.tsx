import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, CheckCircle2, Building2,
  DollarSign, Users, Car, Wrench, PiggyBank, AlertCircle,
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
    sic_code: string | null;
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

interface Props {
  companyId?: string;
  mode?: "extract" | "populate";
  onExtracted?: (data: ExtractedData) => void;
  onCompanyCreated?: (companyId: string) => void;
  trigger?: React.ReactNode;
}

export default function TaxReturnUpload({ companyId, mode = "extract", onExtracted, onCompanyCreated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20MB");
      return;
    }
    setFileName(file.name);
    setUploading(true);
    setExtracted(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", "extract");
      if (companyId) formData.append("company_id", companyId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-tax-return`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${response.status})`);
      }

      const data = await response.json();
      setExtracted(data.extracted);
      onExtracted?.(data.extracted);
      toast.success(`Tax return parsed: Form ${data.extracted.form_type} (${data.extracted.tax_year})`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to parse tax return");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveToCompany = async () => {
    if (!extracted) return;
    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please log in first"); return; }

      let targetCompanyId = companyId;

      // If no company, create one
      if (!targetCompanyId) {
        const { data: newComp, error: createErr } = await supabase
          .from("companies")
          .insert({
            user_id: session.user.id,
            name: extracted.company.name || "New Company",
            entity_type: extracted.company.entity_type || "Corporation",
            state_of_incorporation: extracted.company.state || null,
            address: extracted.company.address || null,
            city: extracted.company.city || null,
            state: extracted.company.state || null,
            zip: extracted.company.zip || null,
            fiscal_year_end: extracted.company.fiscal_year_end || null,
            business_purpose: extracted.company.business_purpose || null,
            accounting_method: extracted.company.accounting_method || null,
            sic_code: extracted.company.sic_code || null,
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        targetCompanyId = newComp.id;
        onCompanyCreated?.(newComp.id);
      }

      // Re-upload with populate mode
      const fileInput = fileRef.current;
      const file = fileInput?.files?.[0];
      if (!file) {
        // Fallback: just populate using extracted data directly
        await populateFromExtracted(targetCompanyId, extracted, session.access_token);
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", "populate");
        formData.append("company_id", targetCompanyId);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-tax-return`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          }
        );
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save");
        }
      }

      toast.success("Company records populated from tax return!");
      setOpen(false);
      setExtracted(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const populateFromExtracted = async (cid: string, data: ExtractedData, _token: string) => {
    const c = data.company;
    const f = data.financials;

    // Update company
    await supabase.from("companies").update({
      address: c.address || undefined,
      city: c.city || undefined,
      state: c.state || undefined,
      zip: c.zip || undefined,
      fiscal_year_end: c.fiscal_year_end || undefined,
      business_purpose: c.business_purpose || undefined,
      accounting_method: c.accounting_method || undefined,
      sic_code: c.sic_code || undefined,
    }).eq("id", cid);

    // Create meeting + financials
    if (data.tax_year && f.total_sales !== null) {
      const { data: mtg } = await supabase.from("meetings").insert({
        company_id: cid,
        meeting_date: `${data.tax_year}-12-31`,
        meeting_type: "Annual Meeting",
        tax_year: data.tax_year,
      }).select("id").single();

      if (mtg) {
        await supabase.from("meeting_financials").insert({
          meeting_id: mtg.id,
          current_total_sales: f.total_sales,
          current_cog: f.cost_of_goods_sold,
          current_gross_profit: f.gross_profit,
          current_net_income: f.net_income,
          current_cog_ratio: f.cog_ratio,
        });
      }
    }

    // Add vehicles
    if (data.vehicles?.length > 0) {
      await supabase.from("company_assets").insert(
        data.vehicles.map((v) => ({
          company_id: cid,
          asset_type: "Vehicle",
          description: v.description || `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle",
          year: v.year || null,
          make: v.make || null,
          model: v.model || null,
          cost: v.cost || null,
        }))
      );
    }

    // Add equipment
    if (data.equipment?.length > 0) {
      await supabase.from("company_assets").insert(
        data.equipment.map((eq) => ({
          company_id: cid,
          asset_type: "Equipment",
          description: eq.description || `${eq.manufacturer || ""} ${eq.model || ""}`.trim() || "Equipment",
          year: eq.year || null,
          manufacturer: eq.manufacturer || null,
          model: eq.model || null,
          cost: eq.cost || null,
        }))
      );
    }

    // Add shareholders
    if (data.shareholders?.length > 0) {
      for (const s of data.shareholders) {
        await supabase.from("shareholders").insert({
          company_id: cid,
          name: s.name,
          ssn_ein: s.ssn_ein || null,
        });
      }
    }
  };

  const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Upload className="h-3.5 w-3.5 mr-1.5" /> Import Tax Return
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Import from Tax Return
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              uploading ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/30"
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing tax return with AI…</p>
                <p className="text-xs text-muted-foreground">This may take 15-30 seconds</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-medium">Drop tax return here or click to upload</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supports PDF, JPG, PNG, TIFF — Forms 1120, 1120-S, 1065, 990
                  </p>
                </div>
              </div>
            )}
            {fileName && !uploading && (
              <p className="text-xs text-muted-foreground mt-2">Selected: {fileName}</p>
            )}
          </div>

          {/* Extracted Data Preview */}
          {extracted && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                Data extracted successfully
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Company Info */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" />
                      Company Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1 text-xs">
                    <p><span className="text-muted-foreground">Name:</span> {extracted.company.name}</p>
                    <p><span className="text-muted-foreground">EIN:</span> {extracted.company.ein || "—"}</p>
                    <p><span className="text-muted-foreground">Type:</span> {extracted.company.entity_type}</p>
                    <p><span className="text-muted-foreground">Address:</span> {[extracted.company.address, extracted.company.city, extracted.company.state, extracted.company.zip].filter(Boolean).join(", ") || "—"}</p>
                    <p><span className="text-muted-foreground">Fiscal Year:</span> {extracted.company.fiscal_year_end || "—"}</p>
                    <div className="flex gap-1.5 pt-1">
                      <Badge variant="outline" className="text-[10px]">
                        Form {extracted.form_type}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        TY {extracted.tax_year}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Financials */}
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-success" />
                      Financials
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1 text-xs">
                    <p><span className="text-muted-foreground">Revenue:</span> {fmt(extracted.financials.total_sales)}</p>
                    <p><span className="text-muted-foreground">COGS:</span> {fmt(extracted.financials.cost_of_goods_sold)}</p>
                    <p><span className="text-muted-foreground">Gross Profit:</span> {fmt(extracted.financials.gross_profit)}</p>
                    <p><span className="text-muted-foreground">Net Income:</span> {fmt(extracted.financials.net_income)}</p>
                    <p><span className="text-muted-foreground">Total Assets:</span> {fmt(extracted.financials.total_assets)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Officers & Shareholders */}
              <div className="grid gap-3 sm:grid-cols-2">
                {extracted.officers?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        Officers ({extracted.officers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1 text-xs">
                      {extracted.officers.map((o, i) => (
                        <p key={i}>{o.name} — {o.title}{o.compensation ? ` (${fmt(o.compensation)})` : ""}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {extracted.shareholders?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-accent" />
                        Shareholders ({extracted.shareholders.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1 text-xs">
                      {extracted.shareholders.map((s, i) => (
                        <p key={i}>{s.name}{s.ownership_pct ? ` (${s.ownership_pct}%)` : ""}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Vehicles & Equipment */}
              <div className="grid gap-3 sm:grid-cols-2">
                {extracted.vehicles?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Car className="h-3.5 w-3.5 text-warning" />
                        Vehicles ({extracted.vehicles.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1 text-xs">
                      {extracted.vehicles.map((v, i) => (
                        <p key={i}>{v.description}{v.cost ? ` — ${fmt(v.cost)}` : ""}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {extracted.equipment?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        Equipment ({extracted.equipment.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1 text-xs">
                      {extracted.equipment.map((e, i) => (
                        <p key={i}>{e.description}{e.cost ? ` — ${fmt(e.cost)}` : ""}</p>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Retirement */}
              {extracted.retirement_contributions?.total_contribution && (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <PiggyBank className="h-3.5 w-3.5 text-success" />
                      Retirement Contributions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-1 text-xs">
                    <p><span className="text-muted-foreground">Plan:</span> {extracted.retirement_contributions.plan_type || "—"}</p>
                    <p><span className="text-muted-foreground">Total:</span> {fmt(extracted.retirement_contributions.total_contribution)}</p>
                    <p><span className="text-muted-foreground">Employer:</span> {fmt(extracted.retirement_contributions.employer_contribution)}</p>
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 border-t">
                <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground flex-1">
                  Review the extracted data above. Click "Save" to {companyId ? "update this company's records" : "create a new company"} with this data.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveToCompany} disabled={saving} className="flex-1">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-1.5" /> {companyId ? "Save to Company" : "Create Company & Save"}</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
