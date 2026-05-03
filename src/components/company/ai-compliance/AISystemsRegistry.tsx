import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

interface Props {
  companyId: string;
}

const riskColors: Record<string, string> = {
  minimal: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  limited: "bg-warning/10 text-warning border-warning/20",
  high: "bg-required/10 text-required border-required/20",
  unacceptable: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusColors: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  suspended: "bg-warning/10 text-warning border-warning/20",
  decommissioned: "bg-muted text-muted-foreground border-muted",
};

const DECISION_DOMAINS = [
  "Credit", "Employment / Hiring", "Housing", "Education",
  "Healthcare", "Insurance", "Legal / Criminal Justice", "Consumer Finance",
];

const STATE_LAWS = [
  "NYC LL 144 (Hiring)", "CO SB 21-169 (Insurance)", "CO SB 205 (High-Risk AI)",
  "IL AEIA (Employment)", "IL BIPA (Biometrics)", "CA AB 2013 (GenAI Disclosure)",
  "TX HB 2060 (AI Governance)", "CT SB 1103 (High-Risk AI)",
];

const SECTOR_HOOKS = [
  "ECOA — Adverse Action Notices (Credit)",
  "FCRA — Permissible Purpose / Explainability (Credit)",
  "Title VII — Disparate Impact (Employment)",
  "NYC LL 144 — Bias Audit (Employment)",
  "EEOC — Selection Procedures Guidance",
  "HIPAA — PHI Involvement (Healthcare)",
  "FDA — Clinical Decision Support",
  "FTC Act §5 — Deception Risk (Consumer AI)",
  "CA AB 2013 — Training Data Disclosure (GenAI)",
  "CFPB — Model Risk Guidance (Financial Services)",
];

const PROTECTED_CLASSES = [
  "Race", "Sex / Gender", "Age", "National Origin",
  "Disability", "Religion", "Color", "Genetic Information",
];

const PRIVACY_BASES = [
  "FCRA Permissible Purpose", "CCPA/CPRA Opt-Out Rights",
  "HIPAA Authorization", "Consent", "Legitimate Business Interest",
  "Contract Necessity", "Legal Obligation",
];

const TABS = ["identity", "impact", "persons", "oversight", "data"] as const;
type TabKey = typeof TABS[number];
const TAB_LABELS: Record<TabKey, string> = {
  identity: "Identity & Provenance",
  impact: "Impact & Regulatory",
  persons: "Responsible Persons",
  oversight: "Oversight Controls",
  data: "Data & Bias",
};

const emptyForm = {
  // Identity
  system_name: "", version: "", internal_identifier: "",
  provider: "", deployer_type: "vendor", foundation_model: "",
  vendor_intended_use: "", purpose: "",
  // Classification
  risk_level: "minimal", status: "active", deployment_date: "",
  decision_domains: "", triggered_state_laws: "", nist_impact_level: "",
  impact_justification: "", sector_regulatory_hooks: "",
  // Persons
  risk_owner: "", technical_monitor: "", compliance_lead: "", legal_contact: "",
  // Oversight
  human_override_capability: false, human_override_tested: false,
  explainable_output: false, adverse_action_notice_in_place: false,
  instructions_for_use: "",
  // Data & Bias
  data_categories: "", training_dataset_info: "",
  disparate_impact_analysis_done: false, protected_classes_analyzed: "",
  proxy_features_excluded: false, data_privacy_basis: "",
};

function MultiCheckSelect({ options, value, onChange, columns = 2 }: {
  options: string[]; value: string; onChange: (v: string) => void; columns?: number;
}) {
  const selected = value ? value.split("||").filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next.join("||"));
  };
  return (
    <div className={`grid gap-1.5 ${columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-1"}`}>
      {options.map(opt => (
        <label key={opt} className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} className="h-3.5 w-3.5" />
          <span className="leading-tight">{opt}</span>
        </label>
      ))}
    </div>
  );
}

export default function AISystemsRegistry({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  const { data: systems = [], isLoading } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_systems")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        company_id: companyId,
        deployment_date: form.deployment_date || null,
      };
      if (editId) {
        const { error } = await supabase.from("ai_systems").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_systems").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_systems", companyId] });
      toast.success(editId ? "System updated" : "System registered");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_systems").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai_systems", companyId] });
      toast.success("System removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeDialog = () => {
    setOpen(false);
    setEditId(null);
    setForm(emptyForm);
    setActiveTab("identity");
  };

  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      system_name: s.system_name || "",
      version: s.version || "",
      internal_identifier: s.internal_identifier || "",
      provider: s.provider || "",
      deployer_type: s.deployer_type || "vendor",
      foundation_model: s.foundation_model || "",
      vendor_intended_use: s.vendor_intended_use || "",
      purpose: s.purpose || "",
      risk_level: s.risk_level || "minimal",
      status: s.status || "active",
      deployment_date: s.deployment_date || "",
      decision_domains: s.decision_domains || "",
      triggered_state_laws: s.triggered_state_laws || "",
      nist_impact_level: s.nist_impact_level || "",
      impact_justification: s.impact_justification || "",
      sector_regulatory_hooks: s.sector_regulatory_hooks || "",
      risk_owner: s.risk_owner || "",
      technical_monitor: s.technical_monitor || "",
      compliance_lead: s.compliance_lead || "",
      legal_contact: s.legal_contact || "",
      human_override_capability: s.human_override_capability ?? false,
      human_override_tested: s.human_override_tested ?? false,
      explainable_output: s.explainable_output ?? false,
      adverse_action_notice_in_place: s.adverse_action_notice_in_place ?? false,
      instructions_for_use: s.instructions_for_use || "",
      data_categories: s.data_categories || "",
      training_dataset_info: s.training_dataset_info || "",
      disparate_impact_analysis_done: s.disparate_impact_analysis_done ?? false,
      protected_classes_analyzed: s.protected_classes_analyzed || "",
      proxy_features_excluded: s.proxy_features_excluded ?? false,
      data_privacy_basis: s.data_privacy_basis || "",
    });
    setOpen(true);
  };

  const f = (key: keyof typeof form) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const tabIdx = TABS.indexOf(activeTab);
  const prevTab = () => tabIdx > 0 && setActiveTab(TABS[tabIdx - 1]);
  const nextTab = () => tabIdx < TABS.length - 1 && setActiveTab(TABS[tabIdx + 1]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Systems Registry</h3>
        <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Register System</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editId ? "Edit" : "Register"} AI System</DialogTitle></DialogHeader>
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabKey)} className="mt-1">
              <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50 p-1">
                {TABS.map(t => (
                  <TabsTrigger key={t} value={t} className="text-[11px] flex-1 min-w-0 px-2 py-1.5">{TAB_LABELS[t]}</TabsTrigger>
                ))}
              </TabsList>

              {/* ── Identity & Provenance ── */}
              <TabsContent value="identity" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs">System Name *</Label><Input {...f("system_name")} /></div>
                  <div><Label className="text-xs">Version</Label><Input {...f("version")} placeholder="e.g. 2.1.0" /></div>
                  <div><Label className="text-xs">Internal ID</Label><Input {...f("internal_identifier")} placeholder="e.g. AI-HR-003" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Vendor / Developer</Label><Input {...f("provider")} /></div>
                  <div>
                    <Label className="text-xs">Deployer Type</Label>
                    <Select value={form.deployer_type} onValueChange={v => setForm(f => ({ ...f, deployer_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vendor">Third-Party Vendor</SelectItem>
                        <SelectItem value="internal">Internal / In-House</SelectItem>
                        <SelectItem value="hybrid">Hybrid (Vendor + Customized)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Foundation Model (if applicable)</Label><Input {...f("foundation_model")} placeholder="e.g. GPT-4, Claude 3.5, Gemini" /></div>
                  <div><Label className="text-xs">Deployment Date</Label><DatePickerField value={form.deployment_date || ""} onChange={(v) => setForm(p => ({ ...p, deployment_date: v }))} /></div>
                </div>
                <div><Label className="text-xs">Vendor's Stated Intended Use</Label><Textarea rows={2} {...f("vendor_intended_use")} placeholder="As described in vendor documentation or terms of service" /></div>
                <div><Label className="text-xs">Your Organization's Purpose / Use Case</Label><Textarea rows={2} {...f("purpose")} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Risk Level (NIST RMF)</Label>
                    <Select value={form.risk_level} onValueChange={v => setForm(f => ({ ...f, risk_level: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="limited">Limited</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="unacceptable">Unacceptable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="decommissioned">Decommissioned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* ── Impact & Regulatory ── */}
              <TabsContent value="impact" className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs font-semibold">Consequential Decision Domains</Label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Select all domains this system's output may influence.</p>
                  <MultiCheckSelect options={DECISION_DOMAINS} value={form.decision_domains} onChange={v => setForm(f => ({ ...f, decision_domains: v }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Triggered State / Local Laws</Label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Based on domain and your operating geography.</p>
                  <MultiCheckSelect options={STATE_LAWS} value={form.triggered_state_laws} onChange={v => setForm(f => ({ ...f, triggered_state_laws: v }))} columns={1} />
                </div>
                <div>
                  <Label className="text-xs font-semibold">NIST RMF Impact Level</Label>
                  <Select value={form.nist_impact_level || ""} onValueChange={v => setForm(f => ({ ...f, nist_impact_level: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select level…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Impact Level Justification</Label><Textarea rows={3} {...f("impact_justification")} placeholder="Document why you assigned this level — not just what you assigned." /></div>
                <div>
                  <Label className="text-xs font-semibold">Sector-Specific Regulatory Hooks</Label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Applicable federal and sector regulations.</p>
                  <MultiCheckSelect options={SECTOR_HOOKS} value={form.sector_regulatory_hooks} onChange={v => setForm(f => ({ ...f, sector_regulatory_hooks: v }))} columns={1} />
                </div>
              </TabsContent>

              {/* ── Responsible Persons ── */}
              <TabsContent value="persons" className="space-y-3 mt-3">
                <p className="text-[10px] text-muted-foreground">Identify the individuals accountable for this AI system's governance.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">AI Risk Owner</Label>
                    <Input {...f("risk_owner")} placeholder="Accountable for system behavior" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Overall accountability for risk</p>
                  </div>
                  <div>
                    <Label className="text-xs">Technical Monitor</Label>
                    <Input {...f("technical_monitor")} placeholder="Day-to-day performance oversight" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Watches performance metrics daily</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Compliance Lead</Label>
                    <Input {...f("compliance_lead")} placeholder="Maps to regulatory obligations" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Regulatory obligation mapping</p>
                  </div>
                  <div>
                    <Label className="text-xs">Legal Contact</Label>
                    <Input {...f("legal_contact")} placeholder="Escalation for regulatory incidents" />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Incident escalation point</p>
                  </div>
                </div>
              </TabsContent>

              {/* ── Oversight Controls ── */}
              <TabsContent value="oversight" className="space-y-3 mt-3">
                <div className="space-y-2.5 rounded-md border p-3">
                  <Label className="text-xs font-semibold">Control Capabilities</Label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.human_override_capability} onCheckedChange={v => setForm(f => ({ ...f, human_override_capability: !!v }))} />
                    Human can override or halt the system
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.human_override_tested} onCheckedChange={v => setForm(f => ({ ...f, human_override_tested: !!v }))} />
                    Override capability has been tested
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.explainable_output} onCheckedChange={v => setForm(f => ({ ...f, explainable_output: !!v }))} />
                    System produces explainable output for reviewers
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.adverse_action_notice_in_place} onCheckedChange={v => setForm(f => ({ ...f, adverse_action_notice_in_place: !!v }))} />
                    Adverse action notice process is in place
                  </label>
                </div>
                <div><Label className="text-xs">Instructions for Use / Operating Procedures</Label><Textarea rows={3} {...f("instructions_for_use")} placeholder="How operators should use this system, including limitations" /></div>
              </TabsContent>

              {/* ── Data & Bias ── */}
              <TabsContent value="data" className="space-y-3 mt-3">
                <div><Label className="text-xs">Data Categories Processed</Label><Input {...f("data_categories")} placeholder="e.g. PII, PHI, financial records, biometric data" /></div>
                <div><Label className="text-xs">Training Dataset Info</Label><Textarea rows={2} {...f("training_dataset_info")} placeholder="Dataset name, source, date range — or 'vendor proprietary'" /></div>
                <div className="space-y-2 rounded-md border p-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.disparate_impact_analysis_done} onCheckedChange={v => setForm(f => ({ ...f, disparate_impact_analysis_done: !!v }))} />
                    Disparate impact analysis has been conducted
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={form.proxy_features_excluded} onCheckedChange={v => setForm(f => ({ ...f, proxy_features_excluded: !!v }))} />
                    Protected class proxies are excluded from inputs
                  </label>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Protected Classes Analyzed</Label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">If disparate impact analysis was done, which classes were tested?</p>
                  <MultiCheckSelect options={PROTECTED_CLASSES} value={form.protected_classes_analyzed} onChange={v => setForm(f => ({ ...f, protected_classes_analyzed: v }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Data Privacy Lawful Basis</Label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">Select all applicable bases for data processing.</p>
                  <MultiCheckSelect options={PRIVACY_BASES} value={form.data_privacy_basis} onChange={v => setForm(f => ({ ...f, data_privacy_basis: v }))} columns={1} />
                </div>
              </TabsContent>
            </Tabs>

            {/* Navigation & Submit */}
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <Button variant="ghost" size="sm" onClick={prevTab} disabled={tabIdx === 0}>
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />Previous
              </Button>
              <span className="text-[10px] text-muted-foreground">{tabIdx + 1} / {TABS.length}</span>
              {tabIdx < TABS.length - 1 ? (
                <Button variant="ghost" size="sm" onClick={nextTab}>
                  Next<ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              ) : (
                <Button size="sm" disabled={!form.system_name || upsert.isPending} onClick={() => upsert.mutate()}>
                  {editId ? "Update" : "Register"} System
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : systems.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No AI systems registered yet.</p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">System</TableHead>
                <TableHead className="text-xs">Provider</TableHead>
                <TableHead className="text-xs">Risk</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Deployed</TableHead>
                <TableHead className="text-xs w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-medium">
                    {s.system_name}
                    {s.version && <span className="text-muted-foreground ml-1">v{s.version}</span>}
                  </TableCell>
                  <TableCell className="text-xs">{s.provider || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${riskColors[s.risk_level] || ""}`}>{s.risk_level}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${statusColors[s.status] || ""}`}>{s.status}</Badge></TableCell>
                  <TableCell className="text-xs">{s.deployment_date ? new Date(s.deployment_date + "T00:00:00").toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(s.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
