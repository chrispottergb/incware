import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Brand header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(BRAND, 14, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, 14, 24);

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, 14, 36);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 43);
  }

  // Date
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 18, { align: "right" });

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, subtitle ? 47 : 40, pageWidth - 14, subtitle ? 47 : 40);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${BRAND} — Confidential`, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }
}

interface ComplianceItem {
  companyName: string;
  score: number;
  passed: number;
  total: number;
  checks: { label: string; pass: boolean }[];
}

export function exportCompliancePDF(data: ComplianceItem[], overallScore: number) {
  const doc = new jsPDF();

  addHeader(doc, "Compliance Overview Report", `Overall Compliance Score: ${overallScore}%`);

  let y = 54;

  data.forEach((item, idx) => {
    // Check if we need a new page
    const estimatedHeight = 20 + item.checks.length * 7;
    if (y + estimatedHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }

    // Company header
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(item.companyName, 14, y);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Score: ${item.passed}/${item.total} — ${item.score}%`, doc.internal.pageSize.getWidth() - 14, y, { align: "right" });
    y += 4;

    // Checks table
    autoTable(doc, {
      startY: y,
      head: [["Requirement", "Status"]],
      body: item.checks.map((c) => [c.label, c.pass ? "✓ Complete" : "✗ Missing"]),
      theme: "grid",
      headStyles: {
        fillColor: [45, 55, 72],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 35, halign: "center" },
      },
      didParseCell(data) {
        if (data.section === "body" && data.column.index === 1) {
          const text = data.cell.raw as string;
          if (text.startsWith("✓")) {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 12;
  });

  addFooter(doc);
  doc.save("compliance-report.pdf");
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

export function exportStockLedgerPDF(certificates: CertificateRow[], companyFilter?: string) {
  const doc = new jsPDF({ orientation: "landscape" });

  const subtitle = companyFilter && companyFilter !== "all"
    ? `Filtered by company`
    : "All Companies";

  addHeader(doc, "Stock Ledger Report", subtitle);

  autoTable(doc, {
    startY: 54,
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
      fillColor: [45, 55, 72],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8 },
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
    margin: { left: 14, right: 14 },
  });

  // Summary
  const totalShares = certificates.reduce((s, c) => s + c.numShares, 0);
  const activeCount = certificates.filter((c) => c.status === "active").length;
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Total Certificates: ${certificates.length}`, 14, finalY);
  doc.text(`Active: ${activeCount}`, 14, finalY + 5);
  doc.text(`Total Shares: ${totalShares.toLocaleString()}`, 14, finalY + 10);

  addFooter(doc);
  doc.save("stock-ledger.pdf");
}

interface ShareholderRow {
  name: string;
  companyName: string;
  address: string;
  status: string | null;
  dateAdded: string | null;
}

export function exportShareholderPDF(shareholders: ShareholderRow[]) {
  const doc = new jsPDF();

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
      fillColor: [45, 55, 72],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8 },
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
    margin: { left: 14, right: 14 },
  });

  const activeCount = shareholders.filter((s) => s.status === "active").length;
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Total Shareholders: ${shareholders.length}`, 14, finalY);
  doc.text(`Active: ${activeCount}`, 14, finalY + 5);

  addFooter(doc);
  doc.save("shareholder-summary.pdf");
}
