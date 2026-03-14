import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, Plus, AlertTriangle, FileText, Shield, Activity, Database, BookOpen, Scale, Eye, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAIComplianceStore } from "@/stores/ai-compliance-store";
import RegistrationWizard from "./RegistrationWizard";

const TABS = [
  { id: "registry", label: "Systems registry", icon: Shield },
  { id: "risk", label: "Risk classification", icon: AlertTriangle },
  { id: "oversight", label: "Human oversight", icon: Eye },
  { id: "usage", label: "Usage log", icon: Activity },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "data", label: "Data governance", icon: Database },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "laws", label: "State laws", icon: Scale },
] as const;

type TabId = (typeof TABS)[number]["id"];

const impactColors: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-amber-500/20 text-amber-400",
  limited: "bg-blue-500/20 text-blue-400",
  minimal: "bg-emerald-500/20 text-emerald-400",
};

const statusColors: Record<string, string> = {
  Assessed: "bg-emerald-500/20 text-emerald-400",
  Compliant: "bg-emerald-500/20 text-emerald-400",
  "Audit pending": "bg-amber-500/20 text-amber-400",
  Pending: "bg-amber-500/20 text-amber-400",
  Current: "bg-emerald-500/20 text-emerald-400",
  Approved: "bg-emerald-500/20 text-emerald-400",
  Published: "bg-emerald-500/20 text-emerald-400",
  Draft: "bg-amber-500/20 text-amber-400",
  Overdue: "bg-red-500/20 text-red-400",
};

const lawStatusColors: Record<string, string> = {
  red: "bg-red-500/20 text-red-400",
  green: "bg-emerald-500/20 text-emerald-400",
  amber: "bg-amber-500/20 text-amber-400",
  blue: "bg-blue-500/20 text-blue-400",
};

const logBadgeColors: Record<string, string> = {
  "High impact": "bg-red-500/20 text-red-400",
  Override: "bg-amber-500/20 text-amber-400",
  "Model event": "bg-amber-500/20 text-amber-400",
  Disclosure: "bg-blue-500/20 text-blue-400",
  Warning: "bg-red-500/20 text-red-400",
  Registry: "bg-emerald-500/20 text-emerald-400",
  Monitoring: "bg-blue-500/20 text-blue-400",
};

const riskDot: Record<string, string> = { high: "bg-red-500", medium: "bg-amber-500", limited: "bg-blue-500", minimal: "bg-emerald-500" };

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /><div>{children}</div>
    </div>
  );
}

export default function USComplianceTracker() {
  const [activeTab, setActiveTab] = useState<TabId>("registry");
  const [wizardOpen, setWizardOpen] = useState(false);
  const { systems, usageLogs, incidents, documents, stateLaws } = useAIComplianceStore();

  const highCount = systems.filter((s) => s.impactLevel === "high").length;
  const biasCount = systems.filter((s) => s.biasAnalysis === "Completed").length;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-[15px] font-medium text-foreground">US AI compliance tracker</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">NIST AI RMF · EO 14110 · FTC guidance · State laws · Future-ready</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5"><ArrowDown className="h-3 w-3" />Export audit report</Button>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto -mx-1 mb-4">
        <div className="flex gap-0 min-w-max px-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn(
                "px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors",
                activeTab === t.id ? "border-foreground text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground/70"
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-[900px]">
        {activeTab === "registry" && <RegistryTab systems={systems} highCount={highCount} biasCount={biasCount} onRegister={() => setWizardOpen(true)} />}
        {activeTab === "risk" && <RiskTab systems={systems} />}
        {activeTab === "oversight" && <OversightTab systems={systems} />}
        {activeTab === "usage" && <UsageTab logs={usageLogs} systems={systems} />}
        {activeTab === "incidents" && <IncidentsTab incidents={incidents} />}
        {activeTab === "data" && <DataTab systems={systems} />}
        {activeTab === "documents" && <DocumentsTab documents={documents} />}
        {activeTab === "laws" && <LawsTab laws={stateLaws} />}
      </div>

      <RegistrationWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}

/* ──── Tab 1: Registry ──── */
function RegistryTab({ systems, highCount, biasCount, onRegister }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Registered systems" value={String(systems.length)} />
        <MetricCard label="High-impact systems" value={String(highCount)} valueClass="text-red-400" />
        <MetricCard label="Bias assessments done" value={`${biasCount} / ${systems.filter((s: any) => s.impactLevel === "high" || s.impactLevel === "medium").length}`} valueClass="text-amber-400" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onRegister} className="text-xs gap-1.5"><Plus className="h-3 w-3" />Register system</Button>
      </div>

      <div className="space-y-2">
        {systems.map((sys: any) => (
          <div key={sys.id} className="flex items-start justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1.5">
              <div className="text-[13px] font-bold text-foreground">{sys.name}</div>
              <div className="text-[11px] text-muted-foreground">Vendor: {sys.vendor} · {sys.deployer} · v{sys.version}</div>
              <div className="flex flex-wrap gap-1">
                {sys.tags.map((t: string) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", impactColors[sys.impactLevel])}>{sys.impactLevel} impact</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", statusColors[sys.complianceStatus] || "bg-muted text-muted-foreground")}>{sys.complianceStatus}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/50 border border-border">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("text-lg font-bold mt-1", valueClass || "text-foreground")}>{value}</div>
    </div>
  );
}

/* ──── Tab 2: Risk Classification ──── */
function RiskTab({ systems }: any) {
  const tiers = [
    { level: "high", label: "High impact", color: "red", desc: "Consequential decisions: credit, employment, housing, healthcare" },
    { level: "medium", label: "Medium impact", color: "amber", desc: "Recommendations, scoring, not decisive" },
    { level: "limited", label: "Limited impact", color: "blue", desc: "Chatbots, generative AI, transparency obligations" },
    { level: "minimal", label: "Minimal", color: "green", desc: "Internal tools, no downstream effect" },
  ];

  return (
    <div className="space-y-4">
      <InfoBanner>No single federal AI risk tier system exists. This tracker uses NIST AI RMF impact levels combined with sector agency guidance to classify systems.</InfoBanner>
      <div className="space-y-2">
        {tiers.map((t) => {
          const count = systems.filter((s: any) => s.impactLevel === t.level).length;
          return (
            <div key={t.level} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <span className={cn("w-3 h-3 rounded-full shrink-0", riskDot[t.level])} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground">{t.desc}</div>
              </div>
              <div className="w-24"><Progress value={count > 0 ? (count / systems.length) * 100 : 0} className="h-1.5" /></div>
              <span className="text-xs font-bold w-12 text-right">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-xs font-semibold mb-3">Sector-specific regulatory exposure</h3>
        <div className="space-y-2">
          {systems.map((sys: any) => (
            <div key={sys.id} className="flex items-start justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-xs font-semibold">{sys.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{sys.regulatoryHooks.filter((h: any) => h.status === "Active").map((h: any) => h.name).join(", ") || "No active obligations"}</div>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", statusColors[sys.complianceStatus] || "bg-muted text-muted-foreground")}>{sys.complianceStatus}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──── Tab 3: Human Oversight ──── */
function OversightTab({ systems }: any) {
  const highSystems = systems.filter((s: any) => s.impactLevel === "high");

  return (
    <div className="space-y-4">
      <InfoBanner>Human oversight requirements per NIST AI RMF GOVERN 6 and MANAGE 4. High-impact systems require designated responsible persons and tested override capabilities.</InfoBanner>
      <div className="space-y-3">
        {highSystems.map((sys: any) => {
          const hasPersons = sys.riskOwner.name || sys.technicalMonitor.name;
          return (
            <div key={sys.id} className="p-4 rounded-lg border border-border space-y-3">
              <div className="text-xs font-bold">{sys.name}</div>
              {hasPersons ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: sys.riskOwner.name, role: "Risk owner" },
                      { name: sys.technicalMonitor.name, role: "Technical" },
                      { name: sys.complianceLead.name, role: "Compliance" },
                      { name: sys.legalContact.name, role: "Legal" },
                    ].filter((p) => p.name).map((p) => (
                      <div key={p.role} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-[10px]">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold">
                          {p.name.split(" ").map((w: string) => w[0]).join("")}
                        </span>
                        <span>{p.name}</span>
                        <span className="text-muted-foreground">· {p.role}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <FieldRow label="Override enabled" value={sys.overrideMechanism} />
                    <FieldRow label="Adverse action" value={sys.adverseActionProcess} />
                    <FieldRow label="Explainability" value={sys.explainability} />
                    <FieldRow label="Audit trail" value={sys.auditLog} />
                    <FieldRow label="Last exercise" value={sys.lastOverrideTest || "—"} />
                    <FieldRow label="Cadence" value={sys.monitoringCadence} />
                  </div>
                </>
              ) : (
                <div className="p-3 rounded bg-amber-500/10 border border-amber-500/20">
                  <p className="text-[11px] text-amber-400">No oversight roles assigned. High-impact systems require designated responsible persons. {sys.decisionDomains.some((d: string) => d.includes("Employment")) && "NYC LL 144 requires documented human oversight for employment AI tools."}</p>
                  <Button size="sm" variant="outline" className="mt-2 text-[10px] h-7">Assign roles</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between p-1.5 rounded bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ──── Tab 4: Usage Log ──── */
function UsageTab({ logs, systems }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Append-only · Supports NIST RMF MEASURE 2.5</p>
      </div>
      <div className="space-y-1.5">
        {logs.map((log: any) => (
          <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">{log.timestamp}</span>
            <div className="flex-1 text-xs">{log.description}</div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{log.actor}</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap", logBadgeColors[log.badge] || "bg-muted text-muted-foreground")}>{log.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──── Tab 5: Incidents ──── */
function IncidentsTab({ incidents }: any) {
  return (
    <div className="space-y-4">
      <InfoBanner>No federal AI incident reporting mandate exists yet. This log follows NIST RMF MANAGE 2.4 guidance for tracking and resolving AI-related incidents.</InfoBanner>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="text-xs gap-1.5"><Plus className="h-3 w-3" />Report incident</Button>
      </div>
      <div className="space-y-3">
        {incidents.map((inc: any) => (
          <div key={inc.id} className="p-4 rounded-lg border border-border space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-muted-foreground font-mono">{inc.code}</span>
                <span className="text-[10px] text-muted-foreground ml-2">· {inc.systemName}</span>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium capitalize", inc.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400")}>{inc.status}</span>
            </div>
            <div className="text-xs font-semibold">{inc.title}</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <FieldRow label="Root cause" value={inc.rootCause} />
              <FieldRow label="Regulatory exposure" value={inc.regulatoryExposure} />
              <FieldRow label="Legal notified" value={inc.legalNotified ? "Yes" : "Pending"} />
              <FieldRow label="Corrective action" value={inc.correctiveAction} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──── Tab 6: Data Governance ──── */
function DataTab({ systems }: any) {
  return (
    <div className="space-y-4">
      <InfoBanner>Data governance requirements per NIST AI RMF MAP 1.5, CCPA/CPRA, FCRA, and HIPAA as applicable to each system's domain.</InfoBanner>
      <div className="space-y-3">
        {systems.map((sys: any) => {
          const hasData = sys.datasetName;
          const biasOk = sys.biasAnalysis === "Completed" || sys.biasAnalysis === "N/A";
          const excludedOk = sys.protectedClassesExcluded === "Yes verified";
          return (
            <div key={sys.id} className="p-4 rounded-lg border border-border space-y-2">
              <div className="text-xs font-bold">{sys.name}</div>
              {hasData ? (
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <FieldRow label="Dataset" value={sys.datasetName} />
                  <FieldRow label="Records" value={sys.datasetRecordCount || "—"} />
                  <div className="flex justify-between p-1.5 rounded bg-muted/30">
                    <span className="text-muted-foreground">Disparate impact</span>
                    <StatusDot ok={biasOk} label={sys.biasAnalysis} />
                  </div>
                  <div className="flex justify-between p-1.5 rounded bg-muted/30">
                    <span className="text-muted-foreground">Protected classes</span>
                    <StatusDot ok={excludedOk} label={sys.protectedClassesExcluded} />
                  </div>
                  {sys.privacyCompliance.map((p: string) => (
                    <div key={p} className="flex justify-between p-1.5 rounded bg-muted/30">
                      <span className="text-muted-foreground">{p}</span>
                      <StatusDot ok label="Active" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <StatusDot ok={false} label="Dataset not documented" />
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <StatusDot ok={false} label={`Bias analysis: ${sys.biasAnalysis}`} />
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <StatusDot ok={false} label={`Protected classes: ${sys.protectedClassesExcluded}`} />
                  </div>
                  {sys.decisionDomains.some((d: string) => d.includes("Employment")) && (
                    <div className="flex items-center gap-2 text-[11px]">
                      <StatusDot ok={false} label="NYC LL 144 audit required — not scheduled" />
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="mt-1 text-[10px] h-7">View requirements</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("text-[10px] font-medium flex items-center gap-1", ok ? "text-emerald-400" : "text-red-400")}>
      <span className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-red-500")} />{label}
    </span>
  );
}

/* ──── Tab 7: Documents ──── */
function DocumentsTab({ documents }: any) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {documents.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">{doc.name}</div>
              <div className="text-[10px] text-muted-foreground">{doc.systemName} · {doc.type}{doc.date && ` · ${doc.date}`}</div>
            </div>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap", statusColors[doc.status] || "bg-muted text-muted-foreground")}>{doc.status}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground italic">Retain all compliance documentation for a minimum of 5 years per sector-specific guidance. Some obligations (e.g. NYC LL 144) require annual audit renewal.</p>
    </div>
  );
}

/* ──── Tab 8: State Laws ──── */
function LawsTab({ laws }: any) {
  return (
    <div className="space-y-4">
      <InfoBanner>State law is the primary active compliance layer for AI in the US. Federal guidance (NIST, FTC, EEOC) sets expectations but few binding rules exist outside sector regulators.</InfoBanner>
      <div className="space-y-2">
        {laws.map((law: any) => (
          <div key={law.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
            <span className={cn("w-3 h-3 rounded-full shrink-0 mt-0.5", law.statusColor === "red" ? "bg-red-500" : law.statusColor === "green" ? "bg-emerald-500" : law.statusColor === "amber" ? "bg-amber-500" : "bg-blue-500")} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">{law.name} <span className="text-muted-foreground font-normal">({law.year})</span></div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{law.description}</div>
            </div>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap", lawStatusColors[law.statusColor] || "bg-muted text-muted-foreground")}>{law.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
