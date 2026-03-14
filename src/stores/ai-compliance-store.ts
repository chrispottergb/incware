import { create } from "zustand";

export interface AISystem {
  id: string;
  name: string;
  internalId: string;
  version: string;
  deploymentStatus: string;
  vendor: string;
  deployer: string;
  foundationModel: string;
  intendedUse: string;
  modalities: string[];
  impactLevel: "high" | "medium" | "limited" | "minimal";
  impactJustification: string;
  decisionDomains: string[];
  statesDeployed: string;
  regulatoryHooks: { name: string; description: string; status: string }[];
  confirmedObligations: string[];
  regulatoryNotes: string;
  riskOwner: { name: string; email: string };
  technicalMonitor: { name: string; email: string };
  complianceLead: { name: string; email: string };
  legalContact: { name: string; email: string };
  overrideMechanism: string;
  explainability: string;
  adverseActionProcess: string;
  auditLog: string;
  lastOverrideTest: string;
  monitoringCadence: string;
  datasetName: string;
  datasetDateRange: string;
  datasetRecordCount: string;
  biasAnalysis: string;
  protectedClassesTested: string[];
  protectedClassesExcluded: string;
  privacyCompliance: string[];
  tags: string[];
  complianceStatus: string;
  registeredDate: string;
}

export interface UsageLogEntry {
  id: string;
  timestamp: string;
  description: string;
  actor: string;
  badge: string;
  systemId: string;
}

export interface Incident {
  id: string;
  code: string;
  systemId: string;
  systemName: string;
  title: string;
  rootCause: string;
  regulatoryExposure: string;
  legalNotified: boolean;
  correctiveAction: string;
  status: "resolved" | "open";
}

export interface ComplianceDocument {
  id: string;
  name: string;
  systemName: string;
  type: string;
  status: string;
  date: string;
}

export interface StateLaw {
  id: string;
  name: string;
  year: string;
  description: string;
  status: string;
  statusColor: string;
}

interface AIComplianceStore {
  systems: AISystem[];
  usageLogs: UsageLogEntry[];
  incidents: Incident[];
  documents: ComplianceDocument[];
  stateLaws: StateLaw[];
  addSystem: (system: AISystem) => void;
  addIncident: (incident: Incident) => void;
}

const SAMPLE_SYSTEMS: AISystem[] = [
  {
    id: "sys-1",
    name: "Loan approval engine",
    internalId: "FIN-AI-001",
    version: "2.3.1",
    deploymentStatus: "Live internal",
    vendor: "Acme Financial",
    deployer: "Internal deployer",
    foundationModel: "None",
    intendedUse: "Automated credit decisioning for consumer loans",
    modalities: ["Structured data"],
    impactLevel: "high",
    impactJustification: "Makes consequential credit decisions affecting consumer access to lending",
    decisionDomains: ["Credit/lending — ECOA/FCRA/CFPB"],
    statesDeployed: "NY, CA, CO, IL",
    regulatoryHooks: [
      { name: "ECOA (Reg. B)", description: "Equal Credit Opportunity Act — adverse action notices required", status: "Active" },
      { name: "FCRA", description: "Fair Credit Reporting Act — permissible purpose and explainability", status: "Active" },
      { name: "CFPB model risk guidance", description: "Consumer Financial Protection Bureau model governance", status: "Active" },
      { name: "CO SB 205", description: "Colorado AI Act — high-risk AI impact assessments", status: "Upcoming" },
      { name: "NIST AI RMF", description: "Voluntary framework for AI risk management", status: "Voluntary" },
    ],
    confirmedObligations: ["Adverse action notices", "Bias audit annually", "Model documentation"],
    regulatoryNotes: "",
    riskOwner: { name: "Sarah Chen", email: "s.chen@company.com" },
    technicalMonitor: { name: "James Park", email: "j.park@company.com" },
    complianceLead: { name: "Maria Lopez", email: "m.lopez@company.com" },
    legalContact: { name: "David Kim", email: "d.kim@company.com" },
    overrideMechanism: "Yes",
    explainability: "Full per-decision",
    adverseActionProcess: "In place",
    auditLog: "Yes",
    lastOverrideTest: "2024-09-15",
    monitoringCadence: "Monthly",
    datasetName: "Consumer credit bureau data 2020–2024",
    datasetDateRange: "Jan 2020 – Dec 2024",
    datasetRecordCount: "2,400,000",
    biasAnalysis: "Completed",
    protectedClassesTested: ["Race/ethnicity", "Sex/gender", "Age 40+", "National origin"],
    protectedClassesExcluded: "Yes verified",
    privacyCompliance: ["FCRA permissible purpose", "CCPA/CPRA opt-out", "Retention policy", "Data lineage documented"],
    tags: ["credit decisions", "ECOA / FCRA", "NIST RMF"],
    complianceStatus: "Assessed",
    registeredDate: "2024-03-15",
  },
  {
    id: "sys-2",
    name: "HR candidate screening",
    internalId: "HR-AI-002",
    version: "1.0.4",
    deploymentStatus: "Live internal",
    vendor: "RecruitAI Ltd",
    deployer: "Internal deployer",
    foundationModel: "Unknown",
    intendedUse: "Resume screening and candidate ranking for open positions",
    modalities: ["Text", "Documents"],
    impactLevel: "high",
    impactJustification: "Directly influences hiring decisions — consequential under federal and state law",
    decisionDomains: ["Employment/hiring — Title VII/EEOC/NYC LL 144/IL AEIA"],
    statesDeployed: "NY, IL",
    regulatoryHooks: [
      { name: "Title VII disparate impact", description: "Federal employment discrimination — EEOC selection procedures", status: "Active" },
      { name: "NYC Local Law 144", description: "NYC bias audit requirement for automated employment tools", status: "Active" },
      { name: "Illinois AEIA", description: "Illinois AI Employment Interview Act", status: "Monitor" },
      { name: "CO SB 205", description: "Colorado AI Act", status: "Upcoming" },
      { name: "NIST AI RMF", description: "Voluntary framework", status: "Voluntary" },
    ],
    confirmedObligations: ["NYC LL 144 bias audit", "Disparate impact analysis"],
    regulatoryNotes: "",
    riskOwner: { name: "", email: "" },
    technicalMonitor: { name: "", email: "" },
    complianceLead: { name: "", email: "" },
    legalContact: { name: "", email: "" },
    overrideMechanism: "Partial",
    explainability: "Summary only",
    adverseActionProcess: "In progress",
    auditLog: "Partial",
    lastOverrideTest: "",
    monitoringCadence: "Not established",
    datasetName: "",
    datasetDateRange: "",
    datasetRecordCount: "",
    biasAnalysis: "Not conducted",
    protectedClassesTested: [],
    protectedClassesExcluded: "Not verified",
    privacyCompliance: [],
    tags: ["hiring", "Title VII risk", "NYC Local Law 144"],
    complianceStatus: "Audit pending",
    registeredDate: "2024-06-01",
  },
  {
    id: "sys-3",
    name: "Customer support chatbot",
    internalId: "CS-AI-003",
    version: "3.1.0",
    deploymentStatus: "Live customer-facing",
    vendor: "Internal",
    deployer: "Customer-facing",
    foundationModel: "OpenAI GPT",
    intendedUse: "Automated customer support for product inquiries and troubleshooting",
    modalities: ["Text"],
    impactLevel: "limited",
    impactJustification: "Customer-facing generative AI — transparency obligations apply, no consequential decisions",
    decisionDomains: ["Consumer-facing — FTC Act §5"],
    statesDeployed: "All US",
    regulatoryHooks: [
      { name: "FTC Act §5", description: "Deception risk — AI must not mislead consumers", status: "Active" },
      { name: "CA AB 2013", description: "California training data disclosure for generative AI", status: "Active" },
      { name: "NIST AI RMF", description: "Voluntary framework", status: "Voluntary" },
    ],
    confirmedObligations: ["AI disclosure notice", "Training data documentation"],
    regulatoryNotes: "",
    riskOwner: { name: "Tom Rivera", email: "t.rivera@company.com" },
    technicalMonitor: { name: "Amy Walsh", email: "a.walsh@company.com" },
    complianceLead: { name: "Maria Lopez", email: "m.lopez@company.com" },
    legalContact: { name: "David Kim", email: "d.kim@company.com" },
    overrideMechanism: "Yes",
    explainability: "None",
    adverseActionProcess: "Not applicable",
    auditLog: "Yes",
    lastOverrideTest: "2024-11-01",
    monitoringCadence: "Quarterly",
    datasetName: "Internal FAQ + product docs",
    datasetDateRange: "2022 – present",
    datasetRecordCount: "50,000",
    biasAnalysis: "N/A",
    protectedClassesTested: [],
    protectedClassesExcluded: "Yes verified",
    privacyCompliance: ["CCPA/CPRA opt-out", "Retention policy"],
    tags: ["generative AI", "FTC disclosure", "CA AB 2013"],
    complianceStatus: "Compliant",
    registeredDate: "2024-01-10",
  },
];

const SAMPLE_LOGS: UsageLogEntry[] = [
  { id: "log-1", timestamp: "2024-12-01 14:32", description: "Loan decision — applicant #4821 denied, adverse action notice generated", actor: "System auto", badge: "High impact", systemId: "sys-1" },
  { id: "log-2", timestamp: "2024-12-01 14:35", description: "Manual override — loan officer approved applicant #4821 after review", actor: "J. Park", badge: "Override", systemId: "sys-1" },
  { id: "log-3", timestamp: "2024-11-28 09:15", description: "Model drift detected — accuracy dropped 3.2% over 30 days, retrain initiated", actor: "Monitoring", badge: "Model event", systemId: "sys-1" },
  { id: "log-4", timestamp: "2024-11-25 11:00", description: "AI disclosure notice displayed to user before chat session", actor: "System auto", badge: "Disclosure", systemId: "sys-3" },
  { id: "log-5", timestamp: "2024-11-20 16:45", description: "CV ranking batch — 142 applicants scored, oversight flag: 3 borderline cases", actor: "System auto", badge: "Warning", systemId: "sys-2" },
  { id: "log-6", timestamp: "2024-11-15 10:00", description: "HR candidate screening system registered in compliance tracker", actor: "M. Lopez", badge: "Registry", systemId: "sys-2" },
  { id: "log-7", timestamp: "2024-11-01 09:00", description: "Quarterly compliance review completed for all registered systems", actor: "M. Lopez", badge: "Monitoring", systemId: "" },
];

const SAMPLE_INCIDENTS: Incident[] = [
  {
    id: "inc-1", code: "INC-2024-003", systemId: "sys-1", systemName: "Loan approval engine",
    title: "Disparate impact detected — age group 55–65",
    rootCause: "Training data underrepresented age 55–65 applicants with strong credit",
    regulatoryExposure: "ECOA / ADEA",
    legalNotified: true,
    correctiveAction: "Resampled training data, retrained model, bias test passed",
    status: "resolved",
  },
  {
    id: "inc-2", code: "INC-2024-004", systemId: "sys-2", systemName: "HR candidate screening",
    title: "Score variance detected — November 2024 batch",
    rootCause: "Under investigation",
    regulatoryExposure: "Title VII / NYC LL 144",
    legalNotified: false,
    correctiveAction: "Batch paused, manual review initiated",
    status: "open",
  },
];

const SAMPLE_DOCS: ComplianceDocument[] = [
  { id: "doc-1", name: "Loan engine model card", systemName: "Loan approval engine", type: "Model card", status: "Current", date: "2024-10-01" },
  { id: "doc-2", name: "Loan engine disparate impact analysis", systemName: "Loan approval engine", type: "Bias test", status: "Current", date: "2024-09-20" },
  { id: "doc-3", name: "Loan engine adverse action notice template", systemName: "Loan approval engine", type: "Notice template", status: "Approved", date: "2024-08-15" },
  { id: "doc-4", name: "HR screening model card", systemName: "HR candidate screening", type: "Model card", status: "Draft", date: "2024-11-01" },
  { id: "doc-5", name: "HR screening NYC LL 144 audit", systemName: "HR candidate screening", type: "Audit report", status: "Overdue", date: "" },
  { id: "doc-6", name: "Chatbot AI disclosure notice", systemName: "Customer support chatbot", type: "Disclosure", status: "Published", date: "2024-01-10" },
  { id: "doc-7", name: "Organisation responsible AI policy", systemName: "—", type: "Policy", status: "Approved", date: "2024-06-01" },
];

const SAMPLE_LAWS: StateLaw[] = [
  { id: "law-1", name: "NYC Local Law 144", year: "2023", description: "Hiring tools bias audit requirement for automated employment decision tools in NYC", status: "Active — applies", statusColor: "red" },
  { id: "law-2", name: "CA AB 2013", year: "2024", description: "Generative AI training data disclosure — requires transparency about training data sources", status: "Compliant", statusColor: "green" },
  { id: "law-3", name: "CO SB 205", year: "2026 effective", description: "High-risk AI impact assessments + consumer rights — Colorado AI Act", status: "Upcoming — prep needed", statusColor: "amber" },
  { id: "law-4", name: "Illinois AEIA", year: "2020", description: "Bias audit for AI used in employment interviews — Illinois Artificial Intelligence Employment Interview Act", status: "Monitor — may apply", statusColor: "amber" },
  { id: "law-5", name: "Federal Algorithmic Accountability Act", year: "Draft", description: "Proposed federal legislation requiring impact assessments for automated critical decisions — not yet enacted", status: "Draft — watch", statusColor: "blue" },
  { id: "law-6", name: "NIST AI RMF", year: "2023", description: "Voluntary framework for AI risk management — likely basis for future federal rules", status: "Voluntary — adopted", statusColor: "blue" },
];

export const useAIComplianceStore = create<AIComplianceStore>((set) => ({
  systems: SAMPLE_SYSTEMS,
  usageLogs: SAMPLE_LOGS,
  incidents: SAMPLE_INCIDENTS,
  documents: SAMPLE_DOCS,
  stateLaws: SAMPLE_LAWS,
  addSystem: (system) => set((state) => ({ systems: [...state.systems, system] })),
  addIncident: (incident) => set((state) => ({ incidents: [...state.incidents, incident] })),
}));
