import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIComplianceStore, type AISystem } from "@/stores/ai-compliance-store";

const STEPS = ["Identity", "Impact", "Regulatory", "Persons", "Oversight", "Data", "Review"];

const DEPLOYMENT_STATUSES = ["Pre-deployment planning", "Testing", "Live internal", "Live customer-facing", "Retired"];
const FOUNDATION_MODELS = ["None", "OpenAI GPT", "Anthropic Claude", "Google Gemini", "Meta Llama", "Other", "Unknown"];
const MODALITIES = ["Text", "Structured data", "Images/video", "Audio", "Documents"];

const IMPACT_LEVELS = [
  { value: "high" as const, label: "High impact", color: "text-red-400 border-red-500/50 bg-red-500/10", dot: "bg-red-500", desc: "Consequential decisions — credit, employment, housing, healthcare" },
  { value: "medium" as const, label: "Medium impact", color: "text-amber-400 border-amber-500/50 bg-amber-500/10", dot: "bg-amber-500", desc: "Significant but not decisive — human makes final call" },
  { value: "limited" as const, label: "Limited impact", color: "text-blue-400 border-blue-500/50 bg-blue-500/10", dot: "bg-blue-500", desc: "Customer-facing AI, chatbots, transparency obligations" },
  { value: "minimal" as const, label: "Minimal impact", color: "text-emerald-400 border-emerald-500/50 bg-emerald-500/10", dot: "bg-emerald-500", desc: "Internal tools, no downstream effect on individuals" },
];

const DECISION_DOMAINS = [
  "Credit/lending — ECOA/FCRA/CFPB",
  "Employment/hiring — Title VII/EEOC/NYC LL 144/IL AEIA",
  "Housing — Fair Housing Act",
  "Healthcare — HIPAA/FDA",
  "Education — FERPA",
  "Insurance",
  "Consumer-facing — FTC Act §5",
  "Internal operations only",
];

const PROTECTED_CLASSES = ["Race/ethnicity", "Sex/gender", "Age 40+", "National origin", "Disability", "Religion", "Other"];

interface Props {
  open: boolean;
  onClose: () => void;
}

function emptyForm(): Omit<AISystem, "id" | "registeredDate"> {
  return {
    name: "", internalId: "", version: "", deploymentStatus: "", vendor: "", deployer: "", foundationModel: "",
    intendedUse: "", modalities: [], impactLevel: "minimal", impactJustification: "", decisionDomains: [],
    statesDeployed: "", regulatoryHooks: [], confirmedObligations: [], regulatoryNotes: "",
    riskOwner: { name: "", email: "" }, technicalMonitor: { name: "", email: "" },
    complianceLead: { name: "", email: "" }, legalContact: { name: "", email: "" },
    overrideMechanism: "", explainability: "", adverseActionProcess: "", auditLog: "",
    lastOverrideTest: "", monitoringCadence: "", datasetName: "", datasetDateRange: "",
    datasetRecordCount: "", biasAnalysis: "", protectedClassesTested: [], protectedClassesExcluded: "",
    privacyCompliance: [], tags: [], complianceStatus: "Pending", 
  };
}

export default function RegistrationWizard({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm());
  const addSystem = useAIComplianceStore((s) => s.addSystem);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleArr = (key: "modalities" | "decisionDomains" | "protectedClassesTested" | "privacyCompliance" | "confirmedObligations", val: string) => {
    setForm((prev) => {
      const arr = prev[key] as string[];
      return { ...prev, [key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val] };
    });
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  const deriveHooks = () => {
    const hooks: { name: string; description: string; status: string }[] = [];
    const domains = form.decisionDomains;
    if (domains.some((d) => d.includes("Credit"))) {
      hooks.push({ name: "ECOA (Reg. B)", description: "Equal Credit Opportunity Act — adverse action notices required", status: "Active" });
      hooks.push({ name: "FCRA", description: "Fair Credit Reporting Act — permissible purpose & explainability", status: "Active" });
      hooks.push({ name: "CFPB model risk guidance", description: "Consumer Financial Protection Bureau model governance", status: "Active" });
    }
    if (domains.some((d) => d.includes("Employment"))) {
      hooks.push({ name: "Title VII disparate impact", description: "Federal employment discrimination — EEOC selection procedures", status: "Active" });
      hooks.push({ name: "NYC Local Law 144", description: "NYC bias audit for automated employment tools", status: "Active" });
      hooks.push({ name: "Illinois AEIA", description: "AI in employment interviews", status: "Monitor" });
    }
    if (domains.some((d) => d.includes("Healthcare"))) {
      hooks.push({ name: "HIPAA", description: "Health Insurance Portability and Accountability Act", status: "Active" });
      hooks.push({ name: "FDA", description: "If clinical decision support tool", status: "Monitor" });
    }
    if (domains.some((d) => d.includes("Housing"))) {
      hooks.push({ name: "Fair Housing Act", description: "Prohibits discrimination in housing-related decisions", status: "Active" });
    }
    if (domains.some((d) => d.includes("Consumer"))) {
      hooks.push({ name: "FTC Act §5", description: "Deception risk — AI must not mislead consumers", status: "Active" });
      hooks.push({ name: "CA AB 2013", description: "California training data disclosure for generative AI", status: "Active" });
    }
    if (form.impactLevel === "high" || form.impactLevel === "medium") {
      hooks.push({ name: "CO SB 205", description: "Colorado AI Act — impact assessments + consumer rights (2026)", status: "Upcoming" });
    }
    hooks.push({ name: "NIST AI RMF", description: "Voluntary framework for AI risk management", status: "Voluntary" });
    return hooks;
  };

  const handleRegister = () => {
    const hooks = deriveHooks();
    const tags = form.decisionDomains.map((d) => d.split(" — ")[0]).slice(0, 3);
    addSystem({
      ...form,
      id: `sys-${Date.now()}`,
      regulatoryHooks: hooks,
      tags,
      registeredDate: new Date().toISOString().split("T")[0],
    });
    setForm(emptyForm());
    setStep(0);
    onClose();
  };

  const hookStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Active: "bg-red-500/20 text-red-400",
      Monitor: "bg-amber-500/20 text-amber-400",
      Upcoming: "bg-amber-500/20 text-amber-400",
      Voluntary: "bg-blue-500/20 text-blue-400",
    };
    return <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", colors[status] || "bg-muted text-muted-foreground")}>{status}</span>;
  };

  const docChecklist = ["Model card", "Bias test results", "Vendor contract", "Adverse action notice template", "NYC LL 144 audit results", "Legal sign-off"];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Step indicator */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-1 mb-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium border",
                  i < step ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" :
                  i === step ? "bg-primary/20 border-primary text-primary" :
                  "bg-muted border-border text-muted-foreground"
                )}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </div>
                <span className={cn("text-[10px] hidden sm:inline", i === step ? "text-foreground font-medium" : "text-muted-foreground")}>{s}</span>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        <div className="p-6 min-h-[400px]">
          {/* Step 1 — Identity */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Identity & Provenance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">System name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Loan approval engine" /></div>
                <div><Label className="text-xs">Internal identifier *</Label><Input value={form.internalId} onChange={(e) => set("internalId", e.target.value)} placeholder="e.g. FIN-AI-001" /></div>
                <div><Label className="text-xs">Version</Label><Input value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="e.g. 2.3.1" /></div>
                <div>
                  <Label className="text-xs">Deployment status</Label>
                  <Select value={form.deploymentStatus} onValueChange={(v) => set("deploymentStatus", v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{DEPLOYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Vendor/developer *</Label><Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} /></div>
                <div><Label className="text-xs">Internal deployer</Label><Input value={form.deployer} onChange={(e) => set("deployer", e.target.value)} /></div>
                <div className="col-span-2">
                  <Label className="text-xs">Foundation model</Label>
                  <Select value={form.foundationModel} onValueChange={(v) => set("foundationModel", v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{FOUNDATION_MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Intended use case</Label><Textarea value={form.intendedUse} onChange={(e) => set("intendedUse", e.target.value)} rows={2} /></div>
                <div className="col-span-2">
                  <Label className="text-xs">Input/output modalities</Label>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {MODALITIES.map((m) => (
                      <label key={m} className="flex items-center gap-1.5 text-xs">
                        <Checkbox checked={form.modalities.includes(m)} onCheckedChange={() => toggleArr("modalities", m)} />{m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Impact */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Impact Classification</h3>
              <div className="grid grid-cols-2 gap-3">
                {IMPACT_LEVELS.map((lvl) => (
                  <button key={lvl.value} onClick={() => set("impactLevel", lvl.value)}
                    className={cn("text-left p-3 rounded-lg border transition-all", form.impactLevel === lvl.value ? lvl.color + " border-2" : "border-border hover:border-muted-foreground/30")}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("w-2.5 h-2.5 rounded-full", lvl.dot)} />
                      <span className="text-xs font-semibold">{lvl.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{lvl.desc}</p>
                  </button>
                ))}
              </div>
              <div><Label className="text-xs">Justification *</Label><Textarea value={form.impactJustification} onChange={(e) => set("impactJustification", e.target.value)} rows={2} /></div>
              <div>
                <Label className="text-xs">Decision domains</Label>
                <div className="grid grid-cols-1 gap-1.5 mt-1">
                  {DECISION_DOMAINS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={form.decisionDomains.includes(d)} onCheckedChange={() => toggleArr("decisionDomains", d)} />{d}
                    </label>
                  ))}
                </div>
              </div>
              <div><Label className="text-xs">States deployed</Label><Input value={form.statesDeployed} onChange={(e) => set("statesDeployed", e.target.value)} placeholder="e.g. NY, CA, CO" /></div>
            </div>
          )}

          {/* Step 3 — Regulatory hooks */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Regulatory Hooks</h3>
              <p className="text-xs text-muted-foreground">Auto-populated based on your impact and domain selections.</p>
              <div className="space-y-2">
                {deriveHooks().map((h, i) => (
                  <div key={i} className="flex items-start justify-between p-3 rounded-lg border border-border">
                    <div>
                      <span className="text-xs font-semibold">{h.name}</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{h.description}</p>
                    </div>
                    {hookStatusBadge(h.status)}
                  </div>
                ))}
                {deriveHooks().length === 1 && <p className="text-xs text-muted-foreground italic">Select decision domains in Step 2 to populate applicable regulations.</p>}
              </div>
              <div>
                <Label className="text-xs">Confirmed obligations</Label>
                <Textarea value={form.confirmedObligations.join("\n")} onChange={(e) => set("confirmedObligations", e.target.value.split("\n").filter(Boolean))} rows={3} placeholder="One per line..." />
              </div>
              <div><Label className="text-xs">Notes</Label><Textarea value={form.regulatoryNotes} onChange={(e) => set("regulatoryNotes", e.target.value)} rows={2} /></div>
            </div>
          )}

          {/* Step 4 — Responsible persons */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Responsible Persons</h3>
              {([
                { key: "riskOwner" as const, title: "AI Risk Owner *", desc: "Accountable for the system's behavior and risk posture" },
                { key: "technicalMonitor" as const, title: "Technical Monitor", desc: "Watches performance and drift day-to-day" },
                { key: "complianceLead" as const, title: "Compliance Lead", desc: "Maps system use to regulatory obligations" },
                { key: "legalContact" as const, title: "Legal Contact", desc: "Escalation point for incidents with regulatory exposure" },
              ]).map((p) => (
                <div key={p.key} className="p-3 rounded-lg border border-border space-y-2">
                  <div><span className="text-xs font-semibold">{p.title}</span><p className="text-[10px] text-muted-foreground">{p.desc}</p></div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Name" value={form[p.key].name} onChange={(e) => set(p.key, { ...form[p.key], name: e.target.value })} />
                    <Input placeholder="Email" value={form[p.key].email} onChange={(e) => set(p.key, { ...form[p.key], email: e.target.value })} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 5 — Oversight */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Oversight Controls</h3>
              {([
                { key: "overrideMechanism" as const, label: "Override/halt mechanism", options: ["Yes", "Partial", "No"] },
                { key: "explainability" as const, label: "Explainability output", options: ["Full per-decision", "Summary only", "None", "Black box"] },
                { key: "adverseActionProcess" as const, label: "Adverse action notice process", options: ["In place", "In progress", "Not applicable"] },
                { key: "auditLog" as const, label: "Audit log", options: ["Yes", "Partial", "No"] },
              ]).map((g) => (
                <div key={g.key}>
                  <Label className="text-xs">{g.label}</Label>
                  <RadioGroup value={form[g.key]} onValueChange={(v) => set(g.key, v)} className="flex flex-wrap gap-3 mt-1">
                    {g.options.map((o) => (
                      <label key={o} className="flex items-center gap-1.5 text-xs"><RadioGroupItem value={o} />{o}</label>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs">Last override test</Label><DatePickerField value={form.lastOverrideTest} onChange={(v) => set("lastOverrideTest", v)} /></div>
                <div>
                  <Label className="text-xs">Monitoring cadence</Label>
                  <Select value={form.monitoringCadence} onValueChange={(v) => set("monitoringCadence", v)}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{["Continuous", "Monthly", "Quarterly", "Annually", "Ad hoc", "Not established"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 6 — Data governance */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Data Governance</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Dataset name</Label><Input value={form.datasetName} onChange={(e) => set("datasetName", e.target.value)} /></div>
                <div><Label className="text-xs">Date range</Label><Input value={form.datasetDateRange} onChange={(e) => set("datasetDateRange", e.target.value)} placeholder="e.g. 2020–2024" /></div>
                <div><Label className="text-xs">Record count</Label><Input value={form.datasetRecordCount} onChange={(e) => set("datasetRecordCount", e.target.value)} /></div>
              </div>
              <div>
                <Label className="text-xs">Bias/disparate impact analysis</Label>
                <RadioGroup value={form.biasAnalysis} onValueChange={(v) => set("biasAnalysis", v)} className="flex flex-wrap gap-3 mt-1">
                  {["Completed", "Scheduled", "Not conducted", "N/A"].map((o) => (
                    <label key={o} className="flex items-center gap-1.5 text-xs"><RadioGroupItem value={o} />{o}</label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="text-xs">Protected classes tested</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {PROTECTED_CLASSES.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={form.protectedClassesTested.includes(c)} onCheckedChange={() => toggleArr("protectedClassesTested", c)} />{c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Protected class features excluded</Label>
                <RadioGroup value={form.protectedClassesExcluded} onValueChange={(v) => set("protectedClassesExcluded", v)} className="flex flex-wrap gap-3 mt-1">
                  {["Yes verified", "Direct only", "Not verified"].map((o) => (
                    <label key={o} className="flex items-center gap-1.5 text-xs"><RadioGroupItem value={o} />{o}</label>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label className="text-xs">Privacy & data compliance</Label>
                <div className="flex flex-wrap gap-3 mt-1">
                  {["FCRA permissible purpose", "CCPA/CPRA opt-out", "HIPAA authorization", "Retention policy", "Data lineage documented"].map((c) => (
                    <label key={c} className="flex items-center gap-1.5 text-xs">
                      <Checkbox checked={form.privacyCompliance.includes(c)} onCheckedChange={() => toggleArr("privacyCompliance", c)} />{c}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 7 — Review */}
          {step === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Review & Register</h3>
              <div className="space-y-3 text-xs">
                <Section title="Identity">
                  <Row label="System" value={form.name} /><Row label="ID" value={form.internalId} /><Row label="Version" value={form.version} />
                  <Row label="Vendor" value={form.vendor} /><Row label="Foundation model" value={form.foundationModel} />
                </Section>
                <Section title="Impact & Domains">
                  <Row label="Impact" value={form.impactLevel} /><Row label="Domains" value={form.decisionDomains.join(", ") || "—"} />
                  <Row label="States" value={form.statesDeployed || "—"} />
                </Section>
                <Section title="Responsible Persons">
                  <Row label="Risk owner" value={form.riskOwner.name || "—"} /><Row label="Technical" value={form.technicalMonitor.name || "—"} />
                  <Row label="Compliance" value={form.complianceLead.name || "—"} /><Row label="Legal" value={form.legalContact.name || "—"} />
                </Section>
                <Section title="Oversight Controls">
                  <Row label="Override" value={form.overrideMechanism || "—"} /><Row label="Explainability" value={form.explainability || "—"} />
                  <Row label="Adverse action" value={form.adverseActionProcess || "—"} /><Row label="Audit log" value={form.auditLog || "—"} />
                </Section>
                <Section title="Data Governance">
                  <Row label="Dataset" value={form.datasetName || "—"} /><Row label="Bias analysis" value={form.biasAnalysis || "—"} />
                  <Row label="Protected classes" value={form.protectedClassesTested.join(", ") || "—"} />
                </Section>
              </div>
              <div>
                <Label className="text-xs font-semibold">Document checklist</Label>
                <div className="space-y-1 mt-1">
                  {docChecklist.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs"><Checkbox />{d}</label>
                  ))}
                </div>
              </div>
              <div><Label className="text-xs">Final notes</Label><Textarea rows={2} /></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <Button variant="ghost" size="sm" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}>
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />Back
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Save className="h-3.5 w-3.5 mr-1" />Save draft</Button>
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)}>Next<ChevronRight className="h-3.5 w-3.5 ml-1" /></Button>
            ) : (
              <Button size="sm" onClick={handleRegister} className="bg-emerald-600 hover:bg-emerald-700">Register system</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border border-border">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
      <div className="mt-1.5 space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
