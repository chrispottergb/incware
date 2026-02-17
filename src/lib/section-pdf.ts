import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(BRAND, 14, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, 14, 24);

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

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 18, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  const lineY = subtitle ? 47 : 40;
  doc.line(14, lineY, pageWidth - 14, lineY);
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

export interface SectionPdfField {
  label: string;
  value: string;
}

export interface SectionPdfTable {
  headers: string[];
  rows: string[][];
}

export interface SectionPdfConfig {
  title: string;
  companyName: string;
  statuteRef?: string;
  fields?: SectionPdfField[];
  table?: SectionPdfTable;
  landscape?: boolean;
}

export function generateSectionPdf(config: SectionPdfConfig): jsPDF {
  const doc = new jsPDF({ orientation: config.landscape ? "landscape" : "portrait" });
  const subtitle = [config.companyName, config.statuteRef].filter(Boolean).join(" — ");

  addHeader(doc, config.title, subtitle);

  let y = config.statuteRef ? 54 : 47;

  // Render key-value fields
  if (config.fields && config.fields.length > 0) {
    const fieldRows = config.fields.map((f) => [f.label, f.value || "—"]);
    autoTable(doc, {
      startY: y,
      head: [["Field", "Value"]],
      body: fieldRows,
      theme: "grid",
      headStyles: { fillColor: [45, 55, 72], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Render table data
  if (config.table && config.table.rows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [config.table.headers],
      body: config.table.rows,
      theme: "grid",
      headStyles: { fillColor: [45, 55, 72], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        // Color status-like cells
        if (data.section === "body") {
          const text = (data.cell.raw as string || "").toLowerCase();
          if (text === "active") {
            data.cell.styles.textColor = [22, 163, 74];
            data.cell.styles.fontStyle = "bold";
          } else if (text === "cancelled" || text === "inactive" || text === "dissolved") {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (config.table && config.table.rows.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records to display.", 14, y + 6);
  }

  addFooter(doc);
  return doc;
}

export function downloadSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const filename = config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
  doc.save(filename);
}

export function previewSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  // Use an inline iframe overlay instead of window.open to avoid Edge popup blocker
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";
  
  const container = document.createElement("div");
  container.style.cssText = "width:90vw;height:90vh;max-width:900px;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;";
  
  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;";
  
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = "padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;";
  closeBtn.onclick = () => { document.body.removeChild(overlay); URL.revokeObjectURL(url); };
  toolbar.appendChild(closeBtn);
  
  const iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = "flex:1;border:0;width:100%;";
  
  container.appendChild(toolbar);
  container.appendChild(iframe);
  overlay.appendChild(container);
  overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); URL.revokeObjectURL(url); } };
  document.body.appendChild(overlay);
}

export function printSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  // Convert to data URI to avoid cross-origin iframe print restrictions in Chrome/Edge
  const reader = new FileReader();
  reader.onload = () => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(`<html><body style="margin:0"><embed src="${reader.result}" type="application/pdf" width="100%" height="100%" style="width:100%;height:100vh;"></body></html>`);
      iframeDoc.close();
    }

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // Fallback: open in new tab
        window.open(url, "_blank");
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 5000);
    }, 1000);
  };
  reader.readAsDataURL(blob);
}
