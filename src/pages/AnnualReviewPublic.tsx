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
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const SUPPORT_EMAIL = "support@entityiq.net";

// Reusable read-only renderers
function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  const display =
    value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words">{display}</span>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 pt-3 border-t border-border">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// Formatters
const fmtMoney = (v: any) =>
  v == null || v === "" ? null : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const joinAddr = (...parts: any[]) => parts.filter(Boolean).join(", ") || null;
const fmtDate = (s?: string | null) => {
  if (!s) return null;
  try { return new Date(s + (s.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return s; }
};

interface Snapshot {
  review_year: number;
  company_name: string;
  last_updated: string;
  company: any;
  contacts: any;
  registeredAgent: any;
  accountant: any;
  attorney: any;
  banking: { bank: any; signers: any[] };
  shareholders: any[];
  directors: any[];
  officers: any[];
  lease: any;
  benefits: any[];
  assets: any[];
  loans: any[];
  contributions: any[];
  meeting: any;
  ai: any;
}

export default function AnnualReviewPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [jotformId, setJotformId] = useState<string>(DEFAULT_JOTFORM_ID);
  const snapshotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "jotform_form_id")
        .maybeSingle();
      const v = (row as any)?.value;
      if (v && typeof v === "string" && v.trim()) setJotformId(v.trim());
    })();
  }, []);

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
          setData(body as Snapshot);
        }
      } catch {
        if (!cancelled) setError("Failed to connect. Please try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

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

  if (!data) return null;

  const {
    company, contacts, registeredAgent, accountant, attorney,
    banking, shareholders, directors, officers, lease,
    benefits, assets, loans, contributions, meeting, ai,
  } = data;

  const isLLC = (company.entity_type || "").toLowerCase().includes("llc");
  const ownerLabel = isLLC ? "Members" : "Shareholders";
  const sharesLabel = isLLC ? "Units" : "Shares";

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
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="shrink-0"
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download Snapshot
          </Button>
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
              Below is the information EntityIQ currently has on file. Please review it carefully,
              then complete the form at the bottom of the page with any updates for {data.review_year}.
              The form loads blank — only fill in what has changed or what is new.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Snapshot */}
      <div ref={snapshotRef} className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* 1. Company */}
        <Section title="Company Information" icon={Building2}>
          <Field label="Company Name" value={company.name} />
          <Field label="Entity Type" value={company.entity_type} />
          <Field label="Address" value={joinAddr(company.address, company.address_2)} />
          <Field label="City" value={company.city} />
          <Field label="State" value={company.state} />
          <Field label="ZIP" value={company.zip} />
          <Field label="Phone" value={company.phone} />
          <Field label="Website" value={company.contact_webpage} />
          <Field label="Incorporation Date" value={fmtDate(company.incorporation_date)} />
          <Field label="EIN" value={company.ein_last4 ? `***-**-${company.ein_last4}` : null} />
          <Field label="Fiscal Year End" value={company.fiscal_year_end} />
          <Field label="S-Election Date" value={fmtDate(company.s_election_date)} />
          <Subsection title="Primary Contact">
            <Field label="Contact Name" value={contacts.contact_full_name} />
            <Field label="Email" value={contacts.contact_email} />
            <Field label="Phone" value={contacts.contact_phone} />
            <Field label="Cell" value={contacts.contact_cell} />
          </Subsection>
        </Section>

        {/* 2. Registered Agent */}
        <Section title="Registered Agent" icon={Shield}>
          <Field label="Agent Name" value={registeredAgent.name} />
          <Field label="Agent Type" value={registeredAgent.type} />
          <Field label="Address" value={joinAddr(registeredAgent.address, registeredAgent.address_2)} />
          <Field label="City" value={registeredAgent.city} />
          <Field label="State" value={registeredAgent.state} />
          <Field label="ZIP" value={registeredAgent.zip} />
          <Field label="Phone" value={registeredAgent.phone} />
          <Field label="Email" value={registeredAgent.email} />
          <Field label="Annual Filing Status" value={registeredAgent.annual_filing_status} />
          <Field label="Annual Filing Year on Record" value={registeredAgent.annual_filing_fee_year} />
        </Section>

        {/* 3. Accountant */}
        <Section title="Accountant" icon={Calculator}>
          {accountant ? (
            <>
              <Field label="Accountant Name" value={accountant.accountant_name} />
              <Field label="Firm" value={accountant.firm_name} />
              <Field label="Address" value={accountant.address} />
              <Field label="City" value={accountant.city} />
              <Field label="State" value={accountant.state} />
              <Field label="ZIP" value={accountant.zip} />
              <Field label="Phone" value={accountant.phone} />
              <Field label="Email" value={accountant.email} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No accountant on file.</p>
          )}
        </Section>

        {/* 4. Attorney */}
        <Section title="Attorney" icon={Scale}>
          {attorney ? (
            <>
              <Field label="Attorney Name" value={attorney.attorney_name} />
              <Field label="Firm" value={attorney.firm_name} />
              <Field label="Address" value={attorney.address} />
              <Field label="City" value={attorney.city} />
              <Field label="State" value={attorney.state} />
              <Field label="ZIP" value={attorney.zip} />
              <Field label="Phone" value={attorney.phone} />
              <Field label="Email" value={attorney.email} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No attorney on file.</p>
          )}
        </Section>

        {/* 5. Banking */}
        <Section title="Banking" icon={Landmark}>
          {banking.bank ? (
            <>
              <Field label="Bank Name" value={banking.bank.bank_name} />
              <Field label="Branch Address" value={banking.bank.address} />
              <Field label="City" value={banking.bank.city} />
              <Field label="State" value={banking.bank.state} />
              <Field label="ZIP" value={banking.bank.zip} />
              <Field label="Account Type" value={banking.bank.account_type} />
              <Field label="Account Number" value={banking.bank.account_number_last4 ? `****${banking.bank.account_number_last4}` : null} />
              <Subsection title="Line of Credit">
                <Field label="LOC Amount" value={fmtMoney(banking.bank.loc_amount)} />
                <Field label="LOC Rate" value={banking.bank.loc_rate} />
                <Field label="LOC Lender" value={banking.bank.loc_lender} />
              </Subsection>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No bank on file.</p>
          )}
          <Subsection title="Authorized Signers">
            {banking.signers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No authorized signers on file.</p>
            ) : (
              banking.signers.map((s, i) => (
                <Field key={i} label={s.signer_name} value={s.title || "Signer"} />
              ))
            )}
          </Subsection>
        </Section>

        {/* 6. Shareholders / Members */}
        <Section title={ownerLabel} icon={Users}>
          {shareholders.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No {ownerLabel.toLowerCase()} on file.</p>
          ) : (
            shareholders.map((s, i) => (
              <div key={i} className="py-2 border-b border-border/50 last:border-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-semibold text-foreground">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {Number(s.shares_held || 0).toLocaleString()} {sharesLabel.toLowerCase()}
                    {s.ownership_percentage != null && ` · ${s.ownership_percentage}%`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {joinAddr(s.address, s.city, s.state, s.zip) || "No address on file"}
                </div>
                {s.distribution_amount != null && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Capital balance: {fmtMoney(s.distribution_amount)}
                  </div>
                )}
                {isLLC && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Can bind LLC: {s.can_bind_llc ? "Yes" : "No"}
                  </div>
                )}
              </div>
            ))
          )}
        </Section>

        {/* 7. Directors */}
        <Section title="Directors" icon={UserCheck}>
          {directors.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No directors on file.</p>
          ) : (
            directors.map((d, i) => (
              <Field key={i} label={`Director ${i + 1}`} value={d.name} />
            ))
          )}
        </Section>

        {/* 8. Officers */}
        <Section title="Officers" icon={UserCheck}>
          {officers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No officers on file from the most recent meeting.</p>
          ) : (
            officers.map((o, i) => (
              <div key={i} className="py-1.5 border-b border-border/50 last:border-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-foreground">{o.title}</span>
                  <span className="text-sm text-foreground">{o.name}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>Salary: {fmtMoney(o.salary) || "—"}</span>
                  <span>Bonus: {fmtMoney(o.bonus) || "—"}</span>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 9. Lease */}
        <Section title="Lease Information" icon={Home}>
          {lease ? (
            <>
              <Field label="Property Address" value={lease.property_address} />
              <Field label="Landlord" value={lease.landlord_name} />
              <Field label="Landlord Address" value={lease.landlord_address} />
              <Field label="Monthly Payment" value={fmtMoney(lease.monthly_payment)} />
              <Field label="Lease Start" value={fmtDate(lease.lease_start_date)} />
              <Field label="Lease End" value={fmtDate(lease.lease_end_date)} />
              <Field label="Leasehold Improvements" value={lease.leasehold_improvements} />
              <Field label="Improvement Amount" value={fmtMoney(lease.leasehold_improvement_amount)} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No lease on file.</p>
          )}
        </Section>

        {/* 10. Benefits */}
        <Section title="Benefits" icon={HeartHandshake}>
          {benefits.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No benefits on file.</p>
          ) : (
            benefits.map((b, i) => (
              <div key={i} className="py-2 border-b border-border/50 last:border-0">
                <div className="text-sm font-medium text-foreground">
                  {b.benefit_description || b.benefit_type || `Benefit ${i + 1}`}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground mt-1">
                  {b.benefit_type && <div>Type: {b.benefit_type}</div>}
                  {b.provider && <div>Provider: {b.provider}</div>}
                  {b.insurance_agency && <div>Agency: {b.insurance_agency}</div>}
                  {b.agent_administrator && <div>Agent: {b.agent_administrator}</div>}
                  {b.eligibility_comments && <div className="col-span-2">Eligibility: {b.eligibility_comments}</div>}
                  {b.retirement_contribution != null && <div>Contribution: {fmtMoney(b.retirement_contribution)}</div>}
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 11. Vehicles & Equipment */}
        <Section title="Vehicles &amp; Equipment" icon={Car}>
          {assets.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No vehicles or equipment on file.</p>
          ) : (
            assets.map((a, i) => (
              <div key={i} className="py-2 border-b border-border/50 last:border-0">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {a.asset_type}: {a.description || `${a.year || ""} ${a.make || ""} ${a.model || ""}`.trim() || "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.ownership_type}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground mt-1">
                  {a.year && <div>Year: {a.year}</div>}
                  {a.make && <div>Make: {a.make}</div>}
                  {a.model && <div>Model: {a.model}</div>}
                  {a.manufacturer && <div>Manufacturer: {a.manufacturer}</div>}
                  {a.vin && <div>VIN: {a.vin}</div>}
                  {a.purchase_date && <div>Purchased: {fmtDate(a.purchase_date)}</div>}
                  {a.purchase_amount != null && <div>Amount: {fmtMoney(a.purchase_amount)}</div>}
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 12. Loans & Contributions */}
        <Section title="Loans &amp; Contributions" icon={Banknote}>
          <Subsection title="Loans">
            {loans.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No loans on file from the most recent meeting.</p>
            ) : (
              loans.map((l, i) => (
                <div key={i} className="py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-foreground">{l.lender_name} → {l.borrower_name}</span>
                    <span className="text-xs text-muted-foreground">{fmtMoney(l.loan_amount)} · {l.loan_rate}%</span>
                  </div>
                </div>
              ))
            )}
          </Subsection>
          <Subsection title="Agreements / Contributions">
            {contributions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No agreements on file from the most recent meeting.</p>
            ) : (
              contributions.map((c, i) => (
                <div key={i} className="py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-foreground">{c.agreement_type} — {c.agreement_with}</span>
                    <span className="text-xs text-muted-foreground">{fmtMoney(c.amount)} · {fmtDate(c.agreement_date)}</span>
                  </div>
                  {c.agreement_purpose && (
                    <div className="text-xs text-muted-foreground mt-0.5">{c.agreement_purpose}</div>
                  )}
                </div>
              ))
            )}
          </Subsection>
        </Section>

        {/* 13. Meeting */}
        <Section title="Last Meeting on Record" icon={FileText}>
          {meeting ? (
            <>
              <Field label="Meeting Date" value={fmtDate(meeting.meeting_date)} />
              <Field label="Location" value={meeting.location} />
              <Field label="Attendees" value={meeting.attendees} />
              <Field label="Notes" value={meeting.notes} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">No meeting on file.</p>
          )}
        </Section>

        {/* 14. AI Compliance */}
        <Section title="AI Compliance" icon={Cpu}>
          <Field label="Active AI Systems" value={ai.systems_count} />
          <Field label="Recent Usage Events (90 days)" value={ai.recent_usage_count} />
          <Field
            label="Usage Frequency"
            value={
              ai.frequency === "regularly" ? "Regularly" :
              ai.frequency === "occasionally" ? "Occasionally" :
              ai.frequency === "not_aware" ? "Systems registered, no recent usage logged" :
              "No AI systems registered"
            }
          />
        </Section>
      </div>

      {/* Divider + Jotform iframe */}
      <div className="max-w-4xl mx-auto px-4 pb-12 space-y-4">
        <div className="border-t border-border pt-8">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Update Your Information
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                The form below loads blank. Fill in only the items that have changed
                or any new activity for {data.review_year}, then submit at the bottom of the form.
              </p>
            </CardHeader>
            <CardContent>
              <iframe
                src={`https://form.jotform.com/${jotformId}`}
                width="100%"
                height={2000}
                frameBorder={0}
                scrolling="auto"
                allow="fullscreen"
                title="Annual Review Form"
                className="w-full border border-border rounded-md bg-white"
              />
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4">
          <HelpCircle className="inline h-3.5 w-3.5 mr-1" />
          Need help? <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline">Contact support</a>.
        </div>
      </div>
    </div>
  );
}
