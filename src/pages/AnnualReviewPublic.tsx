import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, Building2, Users, UserCheck, Shield, Landmark,
  Car, Home, HeartHandshake, FileText, Calculator, Scale,
  AlertCircle, Download, HelpCircle, Banknote, Cpu, CheckCircle2,
  Plus, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/phone-format";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SUPPORT_EMAIL = "support@entityiq.net";

// ---- UI helpers ----
function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Subsection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-4 pt-3 border-t border-border">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words">
        {value === null || value === undefined || value === "" ? "—" : value}
      </span>
    </div>
  );
}

// Formatters
const joinAddr = (...parts: any[]) => parts.filter(Boolean).join(", ") || null;
const fmtDate = (s?: string | null) => {
  if (!s) return null;
  try { return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return s; }
};

interface Snapshot {
  link_id: string;
  company_id: string;
  review_year: number;
  company_name: string;
  last_updated: string;
  company: any;
  contacts: any;
  registeredAgent: any;
  accountant: any;
  attorney: any;
  banking: { bank: any; banks: any[]; signers: any[] };
  shareholders: any[];
  directors: any[];
  officers: any[];
  lease: any;
  leases: any[];
  benefits: any[];
  assets: any[];
  loans: any[];
  contributions: any[];
  meeting: any;
  ai: any;
}

// ---- Default factories ----
const blankSigner = () => ({ signer_name: "", title: "", bank_id: null });
const blankShareholder = () => ({ name: "", address: "", city: "", state: "", zip: "", shares_held: "", ownership_percentage: "" });
const blankDirector = () => ({ name: "" });
const blankOfficer = () => ({ title: "", name: "", salary: "", bonus: "", compensation_status: "", compensation_note: "" });
const blankBenefit = () => ({ benefit_description: "", benefit_type: "", provider: "", insurance_agency: "", agent_administrator: "", eligibility_comments: "", retirement_contribution: "" });
const blankAsset = () => ({ asset_type: "", description: "", ownership_type: "", year: "", make: "", model: "", manufacturer: "", vin: "", purchase_date: "", purchase_amount: "" });
const blankLease = () => ({ property_address: "", landlord_name: "", landlord_address: "", monthly_payment: "", lease_start_date: "", lease_end_date: "", lease_classification: "", leasehold_improvements: "", leasehold_improvement_amount: "" });
const blankBank = () => ({ bank_name: "", account_type: "", address: "", city: "", state: "", zip: "", loc_amount: "", loc_rate: "", loc_lender: "" });
const blankLoan = () => ({ lender_name: "", borrower_name: "", loan_amount: "", loan_rate: "" });
const blankContribution = () => ({ agreement_type: "", agreement_with: "", amount: "", agreement_date: "", agreement_purpose: "" });

export default function AnnualReviewPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [edits, setEdits] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const snapshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/annual-review?action=load&token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } }
        );
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || "Failed to load review");
        } else {
          const snap = body as Snapshot;
          setData(snap);
          // Seed edits from snapshot
          setEdits({
            company: { ...(snap.company || {}) },
            contacts: { ...(snap.contacts || {}) },
            registeredAgent: { ...(snap.registeredAgent || {}) },
            accountant: { ...(snap.accountant || {}) },
            attorney: { ...(snap.attorney || {}) },
            bank: { ...(snap.banking?.bank || {}) },
            banks: (snap.banking?.banks && snap.banking.banks.length > 0)
              ? snap.banking.banks.map((b: any) => ({ ...b }))
              : (snap.banking?.bank ? [{ ...snap.banking.bank }] : []),
            signers: (snap.banking?.signers || []).map((s) => ({ ...s })),
            shareholders: (snap.shareholders || []).map((s) => ({ ...s })),
            directors: (snap.directors || []).map((d) => ({ ...d })),
            officers: (snap.officers || []).map((o) => ({ ...o })),
            lease: { ...(snap.lease || {}) },
            leases: (snap.leases && snap.leases.length > 0)
              ? snap.leases.map((l: any) => ({ ...l }))
              : (snap.lease && Object.keys(snap.lease || {}).length > 0 ? [{ ...snap.lease }] : []),
            benefits: (snap.benefits || []).map((b) => ({ ...b })),
            assets: (snap.assets || []).map((a) => ({ ...a })),
            loans: (snap.loans || []).map((l) => ({ ...l })),
            contributions: (snap.contributions || []).map((c) => ({ ...c })),
          });
        }
      } catch {
        if (!cancelled) setError("Failed to connect. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // ---- edit helpers ----
  const setObj = (key: string, field: string, value: any) =>
    setEdits((p: any) => ({ ...p, [key]: { ...(p[key] || {}), [field]: value } }));

  const setArrItem = (key: string, idx: number, field: string, value: any) =>
    setEdits((p: any) => {
      const arr = [...(p[key] || [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...p, [key]: arr };
    });

  const addArrItem = (key: string, blank: any) =>
    setEdits((p: any) => ({ ...p, [key]: [...(p[key] || []), blank] }));

  const removeArrItem = (key: string, idx: number) =>
    setEdits((p: any) => ({ ...p, [key]: (p[key] || []).filter((_: any, i: number) => i !== idx) }));

  const handleDownloadPdf = async () => {
    if (!snapshotRef.current || !data) return;
    setDownloading(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf()
        .set({
          margin: [0.5, 0.4, 0.5, 0.4],
          filename: `${data.company_name.replace(/[^a-z0-9]/gi, "_")}_Annual_Review_${data.review_year}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 2, backgroundColor: "#ffffff" },
          jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        } as any)
        .from(snapshotRef.current)
        .save();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async () => {
    if (!data || !token || !edits) return;
    if (!edits.contacts?.contact_full_name?.trim() || !edits.contacts?.contact_email?.trim()) {
      toast.error("Primary contact name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insErr } = await supabase
        .from("annual_review_submissions" as any)
        .insert({
          link_id: data.link_id,
          company_id: data.company_id,
          status: "pending_review",
          submitted_at: new Date().toISOString(),
          notes: notes || null,
          new_entries: edits,
        } as any);
      if (insErr) throw insErr;

      const { error: updErr } = await supabase
        .from("annual_review_links" as any)
        .update({ status: "submitted" })
        .eq("token", token);
      if (updErr) throw updErr;

      setSubmitted(true);
      toast.success("Your information has been submitted. Thank you!");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your review...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Unable to Load Review</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
            <p className="text-xs text-muted-foreground">
              Need help? <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">Contact support</a>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || !edits) return null;

  const { company, banking } = data;
  const isLLC = (company.entity_type || "").toLowerCase().includes("llc");
  const ownerLabel = isLLC ? "Members" : "Shareholders";
  const sharesLabel = isLLC ? "Units" : "Shares";

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h3 className="text-lg font-semibold text-foreground">Submission Received</h3>
            <p className="text-sm text-muted-foreground">
              Thank you. Your updates for {data.review_year} have been submitted to
              EntityIQ for review. You may close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addBtn = (onClick: () => void, label: string) => (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="h-7 text-xs">
      <Plus className="h-3 w-3 mr-1" /> {label}
    </Button>
  );

  const removeBtn = (onClick: () => void) => (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="h-7 px-2 text-destructive">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Annual Review for {company.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Review Year {data.review_year}
                {data.last_updated && ` · Records last updated ${fmtDate(data.last_updated)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Snapshot
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                try { window.close(); } catch {}
                // Fallback if window wasn't opened by script
                setTimeout(() => { window.location.href = "about:blank"; }, 50);
              }}
              title="Close"
            >
              <X className="mr-1 h-4 w-4" />
              Close
            </Button>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-5">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Review &amp; Update Your Information
            </h2>
            <p className="text-sm text-muted-foreground">
              Below is the information EntityIQ currently has on file for {data.review_year}.
              Edit any field directly, add or remove entries as needed, then click
              <strong> Submit Updates </strong> at the bottom of the page.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Editable Snapshot */}
      <div ref={snapshotRef} className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* 1. Company */}
        <Section title="Company Information" icon={Building2}>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Company Name" value={edits.company.name || ""} onChange={(v) => setObj("company", "name", v)} />
            <EditField label="Entity Type" value={edits.company.entity_type || ""} onChange={(v) => setObj("company", "entity_type", v)} />
            <EditField label="Address" value={edits.company.address || ""} onChange={(v) => setObj("company", "address", v)} />
            <EditField label="Address 2" value={edits.company.address_2 || ""} onChange={(v) => setObj("company", "address_2", v)} />
            <EditField label="City" value={edits.company.city || ""} onChange={(v) => setObj("company", "city", v)} />
            <EditField label="State" value={edits.company.state || ""} onChange={(v) => setObj("company", "state", v)} />
            <EditField label="ZIP" value={edits.company.zip || ""} onChange={(v) => setObj("company", "zip", v)} />
            <EditField label="Phone" type="tel" value={edits.company.phone || ""} onChange={(v) => setObj("company", "phone", formatPhone(v))} placeholder="(555) 555-5555" />
            <EditField label="Website" value={edits.company.contact_webpage || ""} onChange={(v) => setObj("company", "contact_webpage", v)} />
            <EditField label="Fiscal Year End" value={edits.company.fiscal_year_end || ""} onChange={(v) => setObj("company", "fiscal_year_end", v)} placeholder="MM-DD" />
          </div>
          <ReadOnlyField label="Incorporation Date" value={fmtDate(company.incorporation_date)} />
          <ReadOnlyField label="EIN" value={company.ein_last4 ? `***-**-${company.ein_last4}` : "—"} />
          <ReadOnlyField label="S-Election Date" value={fmtDate(company.s_election_date)} />

          <Subsection title="Primary Contact">
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Contact Name *" value={edits.contacts.contact_full_name || ""} onChange={(v) => setObj("contacts", "contact_full_name", v)} />
              <EditField label="Email *" type="email" value={edits.contacts.contact_email || ""} onChange={(v) => setObj("contacts", "contact_email", v)} />
              <EditField label="Phone" type="tel" value={edits.contacts.contact_phone || ""} onChange={(v) => setObj("contacts", "contact_phone", formatPhone(v))} placeholder="(555) 555-5555" />
              <EditField label="Cell" type="tel" value={edits.contacts.contact_cell || ""} onChange={(v) => setObj("contacts", "contact_cell", formatPhone(v))} placeholder="(555) 555-5555" />
            </div>
          </Subsection>
        </Section>

        {/* 2. Registered Agent */}
        <Section title="Registered Agent" icon={Shield}>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Agent Name" value={edits.registeredAgent.name || ""} onChange={(v) => setObj("registeredAgent", "name", v)} />
            <EditField label="Agent Type" value={edits.registeredAgent.type || ""} onChange={(v) => setObj("registeredAgent", "type", v)} />
            <EditField label="Address" value={edits.registeredAgent.address || ""} onChange={(v) => setObj("registeredAgent", "address", v)} />
            <EditField label="Address 2" value={edits.registeredAgent.address_2 || ""} onChange={(v) => setObj("registeredAgent", "address_2", v)} />
            <EditField label="City" value={edits.registeredAgent.city || ""} onChange={(v) => setObj("registeredAgent", "city", v)} />
            <EditField label="State" value={edits.registeredAgent.state || ""} onChange={(v) => setObj("registeredAgent", "state", v)} />
            <EditField label="ZIP" value={edits.registeredAgent.zip || ""} onChange={(v) => setObj("registeredAgent", "zip", v)} />
            <EditField label="Phone" type="tel" value={edits.registeredAgent.phone || ""} onChange={(v) => setObj("registeredAgent", "phone", formatPhone(v))} placeholder="(555) 555-5555" />
            <EditField label="Email" type="email" value={edits.registeredAgent.email || ""} onChange={(v) => setObj("registeredAgent", "email", v)} />
          </div>
        </Section>

        {/* 3. Accountant */}
        <Section title="Accountant" icon={Calculator}>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Accountant Name" value={edits.accountant.accountant_name || ""} onChange={(v) => setObj("accountant", "accountant_name", v)} />
            <EditField label="Firm" value={edits.accountant.firm_name || ""} onChange={(v) => setObj("accountant", "firm_name", v)} />
            <EditField label="Address" value={edits.accountant.address || ""} onChange={(v) => setObj("accountant", "address", v)} />
            <EditField label="City" value={edits.accountant.city || ""} onChange={(v) => setObj("accountant", "city", v)} />
            <EditField label="State" value={edits.accountant.state || ""} onChange={(v) => setObj("accountant", "state", v)} />
            <EditField label="ZIP" value={edits.accountant.zip || ""} onChange={(v) => setObj("accountant", "zip", v)} />
            <EditField label="Phone" type="tel" value={edits.accountant.phone || ""} onChange={(v) => setObj("accountant", "phone", formatPhone(v))} placeholder="(555) 555-5555" />
            <EditField label="Email" type="email" value={edits.accountant.email || ""} onChange={(v) => setObj("accountant", "email", v)} />
          </div>
        </Section>

        {/* 4. Attorney */}
        <Section title="Attorney" icon={Scale}>
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Attorney Name" value={edits.attorney.attorney_name || ""} onChange={(v) => setObj("attorney", "attorney_name", v)} />
            <EditField label="Firm" value={edits.attorney.firm_name || ""} onChange={(v) => setObj("attorney", "firm_name", v)} />
            <EditField label="Address" value={edits.attorney.address || ""} onChange={(v) => setObj("attorney", "address", v)} />
            <EditField label="City" value={edits.attorney.city || ""} onChange={(v) => setObj("attorney", "city", v)} />
            <EditField label="State" value={edits.attorney.state || ""} onChange={(v) => setObj("attorney", "state", v)} />
            <EditField label="ZIP" value={edits.attorney.zip || ""} onChange={(v) => setObj("attorney", "zip", v)} />
            <EditField label="Phone" type="tel" value={edits.attorney.phone || ""} onChange={(v) => setObj("attorney", "phone", formatPhone(v))} placeholder="(555) 555-5555" />
            <EditField label="Email" type="email" value={edits.attorney.email || ""} onChange={(v) => setObj("attorney", "email", v)} />
          </div>
        </Section>

        {/* 5. Banking */}
        <Section
          title="Banking"
          icon={Landmark}
          action={addBtn(() => addArrItem("banks", blankBank()), "Add Bank")}
        >
          {edits.banks.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No bank accounts on file.</p>
          ) : (
            edits.banks.map((bk: any, bi: number) => (
              <div key={bi} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Bank {bi + 1}
                  </span>
                  {removeBtn(() => removeArrItem("banks", bi))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Bank Name" value={bk.bank_name || ""} onChange={(v) => setArrItem("banks", bi, "bank_name", v)} />
                  <EditField label="Account Type" value={bk.account_type || ""} onChange={(v) => setArrItem("banks", bi, "account_type", v)} />
                  <EditField label="Branch Address" value={bk.address || ""} onChange={(v) => setArrItem("banks", bi, "address", v)} />
                  <EditField label="City" value={bk.city || ""} onChange={(v) => setArrItem("banks", bi, "city", v)} />
                  <EditField label="State" value={bk.state || ""} onChange={(v) => setArrItem("banks", bi, "state", v)} />
                  <EditField label="ZIP" value={bk.zip || ""} onChange={(v) => setArrItem("banks", bi, "zip", v)} />
                </div>
                <ReadOnlyField
                  label="Account Number"
                  value={bk.account_number_last4 ? `****${bk.account_number_last4}` : "—"}
                />
                <Subsection title="Line of Credit">
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="LOC Amount ($)" value={String(bk.loc_amount ?? "")} onChange={(v) => setArrItem("banks", bi, "loc_amount", v)} />
                    <EditField label="LOC Rate (%)" value={String(bk.loc_rate ?? "")} onChange={(v) => setArrItem("banks", bi, "loc_rate", v)} />
                    <EditField label="LOC Lender" value={bk.loc_lender || ""} onChange={(v) => setArrItem("banks", bi, "loc_lender", v)} />
                  </div>
                </Subsection>
              </div>
            ))
          )}

          <Subsection
            title="Authorized Signers"
            action={addBtn(() => addArrItem("signers", blankSigner()), "Add Signer")}
          >
            {edits.signers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No authorized signers on file.</p>
            ) : (
              edits.signers.map((s: any, i: number) => {
                const bank = edits.banks.find((b: any) => b.id && b.id === s.bank_id);
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <EditField label="Signer Name" value={s.signer_name || ""} onChange={(v) => setArrItem("signers", i, "signer_name", v)} />
                    <EditField label="Title" value={s.title || ""} onChange={(v) => setArrItem("signers", i, "title", v)} />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Bank</Label>
                      <div className="text-sm py-2 px-2 border border-border rounded-md bg-muted/30 truncate">
                        {bank?.bank_name || "—"}
                      </div>
                    </div>
                    {removeBtn(() => removeArrItem("signers", i))}
                  </div>
                );
              })
            )}
          </Subsection>
        </Section>

        {/* 6. Shareholders / Members */}
        <Section
          title={ownerLabel}
          icon={Users}
          action={addBtn(() => addArrItem("shareholders", blankShareholder()), `Add ${isLLC ? "Member" : "Shareholder"}`)}
        >
          {edits.shareholders.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No {ownerLabel.toLowerCase()} on file.</p>
          ) : (
            edits.shareholders.map((s: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex justify-end">{removeBtn(() => removeArrItem("shareholders", i))}</div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Name" value={s.name || ""} onChange={(v) => setArrItem("shareholders", i, "name", v)} />
                  <EditField label={`${sharesLabel} Held`} value={String(s.shares_held ?? "")} onChange={(v) => setArrItem("shareholders", i, "shares_held", v)} />
                  <EditField label="Address" value={s.address || ""} onChange={(v) => setArrItem("shareholders", i, "address", v)} />
                  <EditField label="City" value={s.city || ""} onChange={(v) => setArrItem("shareholders", i, "city", v)} />
                  <EditField label="State" value={s.state || ""} onChange={(v) => setArrItem("shareholders", i, "state", v)} />
                  <EditField label="ZIP" value={s.zip || ""} onChange={(v) => setArrItem("shareholders", i, "zip", v)} />
                  <EditField label="Ownership %" value={String(s.ownership_percentage ?? "")} onChange={(v) => setArrItem("shareholders", i, "ownership_percentage", v)} />
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 7. Directors */}
        <Section
          title="Directors"
          icon={UserCheck}
          action={addBtn(() => addArrItem("directors", blankDirector()), "Add Director")}
        >
          {edits.directors.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No directors on file.</p>
          ) : (
            edits.directors.map((d: any, i: number) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-end">
                <EditField label={`Director ${i + 1}`} value={d.name || ""} onChange={(v) => setArrItem("directors", i, "name", v)} />
                {removeBtn(() => removeArrItem("directors", i))}
              </div>
            ))
          )}
        </Section>

        {/* 8. Officers */}
        <Section
          title="Officers"
          icon={UserCheck}
          action={addBtn(() => addArrItem("officers", blankOfficer()), "Add Officer")}
        >
          {edits.officers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No officers on file.</p>
          ) : (
            edits.officers.map((o: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex justify-end">{removeBtn(() => removeArrItem("officers", i))}</div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Title" value={o.title || ""} onChange={(v) => setArrItem("officers", i, "title", v)} />
                  <EditField label="Name" value={o.name || ""} onChange={(v) => setArrItem("officers", i, "name", v)} />
                  <EditField label="Salary ($)" value={String(o.salary ?? "")} onChange={(v) => setArrItem("officers", i, "salary", v)} />
                  <EditField label="Bonus ($)" value={String(o.bonus ?? "")} onChange={(v) => setArrItem("officers", i, "bonus", v)} />
                  <EditField label="Compensation Status" value={o.compensation_status || ""} onChange={(v) => setArrItem("officers", i, "compensation_status", v)} />
                  <EditField label="Compensation Note" value={o.compensation_note || ""} onChange={(v) => setArrItem("officers", i, "compensation_note", v)} />
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 9. Leases */}
        <Section
          title="Lease Information"
          icon={Home}
          action={addBtn(() => addArrItem("leases", blankLease()), "Add Lease")}
        >
          {edits.leases.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No leases on file.</p>
          ) : (
            edits.leases.map((l: any, li: number) => (
              <div key={li} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Lease {li + 1}
                  </span>
                  {removeBtn(() => removeArrItem("leases", li))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Property Address" value={l.property_address || ""} onChange={(v) => setArrItem("leases", li, "property_address", v)} />
                  <EditField label="Landlord" value={l.landlord_name || ""} onChange={(v) => setArrItem("leases", li, "landlord_name", v)} />
                  <EditField label="Landlord Address" value={l.landlord_address || ""} onChange={(v) => setArrItem("leases", li, "landlord_address", v)} />
                  <EditField label="Monthly Payment ($)" value={String(l.monthly_payment ?? "")} onChange={(v) => setArrItem("leases", li, "monthly_payment", v)} />
                  <EditField label="Lease Start" type="date" value={l.lease_start_date || ""} onChange={(v) => setArrItem("leases", li, "lease_start_date", v)} />
                  <EditField label="Lease End" type="date" value={l.lease_end_date || ""} onChange={(v) => setArrItem("leases", li, "lease_end_date", v)} />
                  <EditField label="Classification" value={l.lease_classification || ""} onChange={(v) => setArrItem("leases", li, "lease_classification", v)} placeholder="standard / related_party / self_rental" />
                  <EditField label="Leasehold Improvements" value={l.leasehold_improvements || ""} onChange={(v) => setArrItem("leases", li, "leasehold_improvements", v)} />
                  <EditField label="Improvement Amount ($)" value={String(l.leasehold_improvement_amount ?? "")} onChange={(v) => setArrItem("leases", li, "leasehold_improvement_amount", v)} />
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 10. Benefits */}
        <Section
          title="Benefits"
          icon={HeartHandshake}
          action={addBtn(() => addArrItem("benefits", blankBenefit()), "Add Benefit")}
        >
          {edits.benefits.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No benefits on file.</p>
          ) : (
            edits.benefits.map((b: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex justify-end">{removeBtn(() => removeArrItem("benefits", i))}</div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Description" value={b.benefit_description || ""} onChange={(v) => setArrItem("benefits", i, "benefit_description", v)} />
                  <EditField label="Type" value={b.benefit_type || ""} onChange={(v) => setArrItem("benefits", i, "benefit_type", v)} />
                  <EditField label="Provider" value={b.provider || ""} onChange={(v) => setArrItem("benefits", i, "provider", v)} />
                  <EditField label="Insurance Agency" value={b.insurance_agency || ""} onChange={(v) => setArrItem("benefits", i, "insurance_agency", v)} />
                  <EditField label="Agent / Administrator" value={b.agent_administrator || ""} onChange={(v) => setArrItem("benefits", i, "agent_administrator", v)} />
                  <EditField label="Contribution" value={String(b.retirement_contribution ?? "")} onChange={(v) => setArrItem("benefits", i, "retirement_contribution", v)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Eligibility Comments</Label>
                  <Textarea
                    value={b.eligibility_comments || ""}
                    onChange={(e) => setArrItem("benefits", i, "eligibility_comments", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 11. Vehicles & Equipment */}
        <Section
          title="Vehicles &amp; Equipment"
          icon={Car}
          action={addBtn(() => addArrItem("assets", blankAsset()), "Add Asset")}
        >
          {edits.assets.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No vehicles or equipment on file.</p>
          ) : (
            edits.assets.map((a: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                <div className="flex justify-end">{removeBtn(() => removeArrItem("assets", i))}</div>
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="Asset Type" value={a.asset_type || ""} onChange={(v) => setArrItem("assets", i, "asset_type", v)} placeholder="vehicle / equipment" />
                  <EditField label="Ownership Type" value={a.ownership_type || ""} onChange={(v) => setArrItem("assets", i, "ownership_type", v)} />
                  <EditField label="Description" value={a.description || ""} onChange={(v) => setArrItem("assets", i, "description", v)} />
                  <EditField label="Year" value={String(a.year ?? "")} onChange={(v) => setArrItem("assets", i, "year", v)} />
                  <EditField label="Make" value={a.make || ""} onChange={(v) => setArrItem("assets", i, "make", v)} />
                  <EditField label="Model" value={a.model || ""} onChange={(v) => setArrItem("assets", i, "model", v)} />
                  <EditField label="Manufacturer" value={a.manufacturer || ""} onChange={(v) => setArrItem("assets", i, "manufacturer", v)} />
                  <EditField label="VIN" value={a.vin || ""} onChange={(v) => setArrItem("assets", i, "vin", v)} />
                  <EditField label="Purchase Date" type="date" value={a.purchase_date || ""} onChange={(v) => setArrItem("assets", i, "purchase_date", v)} />
                  <EditField label="Purchase Amount ($)" value={String(a.purchase_amount ?? "")} onChange={(v) => setArrItem("assets", i, "purchase_amount", v)} />
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 12. Loans & Contributions */}
        <Section title="Loans &amp; Contributions" icon={Banknote}>
          <Subsection
            title="Loans"
            action={addBtn(() => addArrItem("loans", blankLoan()), "Add Loan")}
          >
            {edits.loans.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No loans on file.</p>
            ) : (
              edits.loans.map((l: any, i: number) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                  <div className="flex justify-end">{removeBtn(() => removeArrItem("loans", i))}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Lender" value={l.lender_name || ""} onChange={(v) => setArrItem("loans", i, "lender_name", v)} />
                    <EditField label="Borrower" value={l.borrower_name || ""} onChange={(v) => setArrItem("loans", i, "borrower_name", v)} />
                    <EditField label="Amount ($)" value={String(l.loan_amount ?? "")} onChange={(v) => setArrItem("loans", i, "loan_amount", v)} />
                    <EditField label="Rate (%)" value={String(l.loan_rate ?? "")} onChange={(v) => setArrItem("loans", i, "loan_rate", v)} />
                  </div>
                </div>
              ))
            )}
          </Subsection>
          <Subsection
            title="Agreements / Contributions"
            action={addBtn(() => addArrItem("contributions", blankContribution()), "Add Agreement")}
          >
            {edits.contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No agreements on file.</p>
            ) : (
              edits.contributions.map((c: any, i: number) => (
                <div key={i} className="border border-border/50 rounded-md p-3 space-y-2">
                  <div className="flex justify-end">{removeBtn(() => removeArrItem("contributions", i))}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <EditField label="Agreement Type" value={c.agreement_type || ""} onChange={(v) => setArrItem("contributions", i, "agreement_type", v)} />
                    <EditField label="Agreement With" value={c.agreement_with || ""} onChange={(v) => setArrItem("contributions", i, "agreement_with", v)} />
                    <EditField label="Amount ($)" value={String(c.amount ?? "")} onChange={(v) => setArrItem("contributions", i, "amount", v)} />
                    <EditField label="Date" type="date" value={c.agreement_date || ""} onChange={(v) => setArrItem("contributions", i, "agreement_date", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Purpose</Label>
                    <Textarea
                      value={c.agreement_purpose || ""}
                      onChange={(e) => setArrItem("contributions", i, "agreement_purpose", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))
            )}
          </Subsection>
        </Section>

        {/* 13. Notes & Submit */}
        <Section title="Additional Notes" icon={FileText}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            maxLength={5000}
            placeholder="Anything else you'd like to share with EntityIQ about changes for this review year."
          />
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Updates
            </Button>
          </div>
        </Section>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className="text-center text-xs text-muted-foreground pt-4">
          <HelpCircle className="inline h-3.5 w-3.5 mr-1" />
          Need help? <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">Contact support</a>.
        </div>
      </div>
    </div>
  );
}
