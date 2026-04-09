import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { savePdfReliably } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";

const BINDER_MARGIN = 31.75; // 1.25 inch binder margin for 3-hole punch filing
const NORMAL_MARGIN = 19.05; // 0.75 inch normal margin
const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

// Portrait defaults (binder on left)
const MARGIN = BINDER_MARGIN;
const R_MARGIN = NORMAL_MARGIN;

// Portrait: binder on left. Landscape: binder on top.
function getMargins(landscape: boolean) {
  return {
    left: landscape ? NORMAL_MARGIN : BINDER_MARGIN,
    right: NORMAL_MARGIN,
    top: landscape ? BINDER_MARGIN : NORMAL_MARGIN,
  };
}

function addHeader(doc: jsPDF, title: string, subtitle?: string, landscape = false) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const m = getMargins(landscape);
  const topOffset = m.top;
  const brandY = topOffset + 4;
  const subY = brandY + 6;
  const titleY = subY + 12;
  const subtitleY = titleY + 7;

  // Brand header
  doc.setFontSize(18);
  doc.setFont("Arial", "bold");
  doc.text(BRAND, m.left, brandY);

  doc.setFontSize(8);
  doc.setFont("Arial", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, m.left, subY);

  // Title
  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, m.left, titleY);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, m.left, subtitleY);
  }

  // Date
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - m.right, brandY, { align: "right" });

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  const lineY = subtitle ? subtitleY + 4 : titleY + 4;
  doc.line(m.left, lineY, pageWidth - m.right, lineY);
}

function addFooter(doc: jsPDF, landscape = false) {
  const m = getMargins(landscape);
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${BRAND} — Confidential`, m.left, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - m.right, pageHeight - 8, { align: "right" });
  }
}

interface ComplianceItem {
  companyName: string;
  score: number;
  passed: number;
  total: number;
  checks: { label: string; pass: boolean }[];
}

export async function exportCompliancePDF(data: ComplianceItem[], overallScore: number) {
  const doc = new jsPDF();
  registerArialFont(doc);

  addHeader(doc, "Compliance Overview Report", `Overall Compliance Score: ${overallScore}%`);

  let y = 54;

  data.forEach((item, idx) => {
    const estimatedHeight = 20 + item.checks.length * 7;
    if (y + estimatedHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(item.companyName, MARGIN, y);

    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Score: ${item.passed}/${item.total} — ${item.score}%`, doc.internal.pageSize.getWidth() - 14, y, { align: "right" });
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Requirement", "Status"]],
      body: item.checks.map((c) => [c.label, c.pass ? "Complete" : "Missing"]),
      theme: "grid",
      headStyles: {
        fillColor: [200, 215, 235], textColor: [30, 30, 30],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 35, halign: "center" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 1) {
          const text = data.cell.raw as string;
          if (text.startsWith("Complete")) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: MARGIN, right: R_MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  });

  addFooter(doc);
  await savePdfReliably(doc, "compliance-report.pdf");
}

interface CertificateRow {
  certNumber: number;
  companyName: string;
  shareholderName: string;
  shareClass: string;
  numShares: number;
  parValue: number | null;
  issueDate: string | null;
  status: string | null;
}

export async function exportStockLedgerPDF(certificates: CertificateRow[], companyFilter?: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  registerArialFont(doc);
  const lm = getMargins(true);

  const subtitle = companyFilter && companyFilter !== "all"
    ? `Filtered by company`
    : "All Companies";

  addHeader(doc, "Stock Ledger Report", subtitle, true);

  // startY after landscape header
  const startY = lm.top + 4 + 6 + 12 + 7 + 4 + 7;

  autoTable(doc, {
    startY,
    head: [["Cert #", "Company", "Shareholder", "Class", "Shares", "Par Value", "Issue Date", "Status"]],
    body: certificates.map((c) => [
      `#${c.certNumber}`,
      c.companyName,
      c.shareholderName,
      c.shareClass,
      c.numShares.toLocaleString(),
      c.parValue != null ? `$${c.parValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
      c.issueDate ? new Date(c.issueDate + "T00:00:00").toLocaleDateString() : "—",
      c.status || "—",
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [200, 215, 235], textColor: [30, 30, 30],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 7) {
        const text = (data.cell.raw as string || "").toLowerCase();
        if (text === "active") {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        } else if (text === "cancelled") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: lm.left, right: lm.right },
  });

  // Summary
  const totalShares = certificates.reduce((s, c) => s + c.numShares, 0);
  const activeCount = certificates.filter((c) => c.status === "active").length;
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Total Certificates: ${certificates.length}`, lm.left, finalY);
  doc.text(`Active: ${activeCount}`, lm.left, finalY + 5);
  doc.text(`Total Shares: ${totalShares.toLocaleString()}`, lm.left, finalY + 10);

  addFooter(doc, true);
  await savePdfReliably(doc, "stock-ledger.pdf");
}

interface ShareholderRow {
  name: string;
  companyName: string;
  address: string;
  status: string | null;
  dateAdded: string | null;
}

export async function exportShareholderPDF(shareholders: ShareholderRow[]) {
  const doc = new jsPDF();
  registerArialFont(doc);

  addHeader(doc, "Shareholder Summary Report", `${shareholders.length} shareholder(s)`);

  autoTable(doc, {
    startY: 54,
    head: [["Name", "Company", "Address", "Status", "Date Added"]],
    body: shareholders.map((sh) => [
      sh.name,
      sh.companyName,
      sh.address || "—",
      sh.status || "—",
      sh.dateAdded ? new Date(sh.dateAdded + "T00:00:00").toLocaleDateString() : "—",
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [200, 215, 235], textColor: [30, 30, 30],
        fontSize: 10,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 10 },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 3) {
        const text = (data.cell.raw as string || "").toLowerCase();
        if (text === "active") {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        } else if (text === "inactive") {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    margin: { left: MARGIN, right: R_MARGIN },
  });

  const activeCount = shareholders.filter((s) => s.status === "active").length;
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Total Shareholders: ${shareholders.length}`, MARGIN, finalY);
  doc.text(`Active: ${activeCount}`, MARGIN, finalY + 5);

  addFooter(doc);
  await savePdfReliably(doc, "shareholder-summary.pdf");
}

// ---------- AI Compliance Audit Report ----------

interface AISystemRow {
  system_name: string;
  provider: string | null;
  risk_level: string;
  status: string;
  deployment_date: string | null;
  purpose: string | null;
  data_categories: string | null;
}

interface AIOversightRow {
  person_name: string;
  title: string | null;
  competence_description: string | null;
  authority_scope: string | null;
  status: string;
  system_name: string;
}

interface AIUsageRow {
  usage_date: string;
  system_name: string;
  usage_type: string;
  description: string | null;
  human_reviewer: string | null;
  review_decision: string | null;
  affected_persons_notified: boolean | null;
}

interface AIIncidentRow {
  incident_date: string;
  system_name: string;
  severity: string;
  status: string;
  description: string | null;
  reported_by: string | null;
  provider_notified: boolean | null;
  authority_notified: boolean | null;
}

export interface AIComplianceData {
  companyName: string;
  systems: AISystemRow[];
  oversightPersons: AIOversightRow[];
  usageLogs: AIUsageRow[];
  incidents: AIIncidentRow[];
}

export async function exportAICompliancePDF(data: AIComplianceData) {
  const doc = new jsPDF();
  registerArialFont(doc);
  const pw = doc.internal.pageSize.getWidth();

  addHeader(doc, "EU AI Act Compliance Report", `${data.companyName} — Regulation (EU) 2024/1689`);

  let y = 54;

  // --- Section 1: AI Systems Registry ---
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("1. AI Systems Registry", MARGIN, y);
  y += 2;

  if (data.systems.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No AI systems registered.", MARGIN, y + 6);
    y += MARGIN;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["System", "Provider", "Risk Level", "Status", "Deployed", "Purpose"]],
      body: data.systems.map(s => [
        s.system_name,
        s.provider || "—",
        s.risk_level,
        s.status,
        s.deployment_date ? new Date(s.deployment_date + "T00:00:00").toLocaleDateString() : "—",
        s.purpose || "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 2) {
          const risk = (data.cell.raw as string).toLowerCase();
          if (risk === "high" || risk === "unacceptable") data.cell.styles.textColor = [220, 38, 38];
          else if (risk === "limited") data.cell.styles.textColor = [202, 138, 4];
          else data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Section 2: Human Oversight (Art. 26.2) ---
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("2. Human Oversight Assignments (Art. 26.2)", MARGIN, y);
  y += 2;

  if (data.oversightPersons.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No oversight persons assigned.", MARGIN, y + 6);
    y += MARGIN;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Liable Person", "Title", "AI System", "Competence", "Authority Scope", "Status"]],
      body: data.oversightPersons.map(p => [
        p.person_name,
        p.title || "—",
        p.system_name,
        p.competence_description || "—",
        p.authority_scope || "—",
        p.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Section 3: Usage Log (Art. 26.6) ---
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("3. AI Usage Log (Art. 26.6 — 6-month retention)", MARGIN, y);
  y += 2;

  if (data.usageLogs.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No usage events recorded.", MARGIN, y + 6);
    y += MARGIN;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "System", "Type", "Description", "Reviewer", "Decision", "Notified"]],
      body: data.usageLogs.map(l => [
        new Date(l.usage_date).toLocaleDateString(),
        l.system_name,
        l.usage_type,
        l.description || "—",
        l.human_reviewer || "—",
        l.review_decision || "Pending",
        l.affected_persons_notified ? "Yes" : "No",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 5) {
          const d = (data.cell.raw as string).toLowerCase();
          if (d === "approved") data.cell.styles.textColor = [22, 163, 74];
          else if (d === "rejected") data.cell.styles.textColor = [220, 38, 38];
          else if (d === "modified") data.cell.styles.textColor = [202, 138, 4];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Section 4: Risk & Incidents (Art. 26.5) ---
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("4. Risk & Incidents (Art. 26.5)", MARGIN, y);
  y += 2;

  if (data.incidents.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No incidents reported.", MARGIN, y + 6);
    y += MARGIN;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Date", "System", "Severity", "Status", "Description", "Reporter", "Provider", "Authority"]],
      body: data.incidents.map(i => [
        new Date(i.incident_date + "T00:00:00").toLocaleDateString(),
        i.system_name,
        i.severity,
        i.status,
        i.description || "—",
        i.reported_by || "—",
        i.provider_notified ? "Yes" : "No",
        i.authority_notified ? "Yes" : "No",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 9, fontStyle: "bold" },
      bodyStyles: { fontSize: 9 },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 2) {
          const s = (data.cell.raw as string).toLowerCase();
          if (s === "serious" || s === "high") data.cell.styles.textColor = [220, 38, 38];
          else if (s === "medium") data.cell.styles.textColor = [202, 138, 4];
          else data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // --- Summary ---
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pw - 14, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Summary", MARGIN, y);
  y += 6;
  doc.setFont("Arial", "normal");
  doc.setFontSize(8);
  const openIncidents = data.incidents.filter(i => i.status !== "resolved").length;
  const pendingReviews = data.usageLogs.filter(l => !l.review_decision).length;
  doc.text(`• Registered AI Systems: ${data.systems.length} (${data.systems.filter(s => s.status === "active").length} active)`, MARGIN, y); y += 5;
  doc.text(`• Oversight Persons Assigned: ${data.oversightPersons.length} (${data.oversightPersons.filter(p => p.status === "active").length} active)`, MARGIN, y); y += 5;
  doc.text(`• Usage Events Logged: ${data.usageLogs.length}`, MARGIN, y); y += 5;
  doc.text(`• Pending Reviews: ${pendingReviews}`, MARGIN, y); y += 5;
  doc.text(`• Total Incidents: ${data.incidents.length} (${openIncidents} open)`, MARGIN, y); y += 5;
  const highRisk = data.systems.filter(s => s.risk_level === "high" || s.risk_level === "unacceptable").length;
  if (highRisk > 0) {
    doc.setTextColor(220, 38, 38);
    doc.setFont("Arial", "bold");
    doc.text(`⚠ ${highRisk} high/unacceptable risk system(s) require enhanced oversight`, MARGIN, y);
  }

  addFooter(doc);
  await savePdfReliably(doc, `ai-compliance-report-${data.companyName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
