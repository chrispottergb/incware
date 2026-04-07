import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as pdfjsLib from "pdfjs-dist";
import { savePdfReliably } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const MARGIN = 31.75; // 1.25 inch left margin for 3-hole punch binder filing
const R_MARGIN = 19.05; // 0.75 inch right margin
const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(BRAND, MARGIN, 18);

  doc.setFontSize(8);
  doc.setFont("Arial", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, MARGIN, 24);

  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, MARGIN, 36);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, MARGIN, 43);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - R_MARGIN, 18, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  const lineY = subtitle ? 47 : 40;
  doc.line(MARGIN, lineY, pageWidth - R_MARGIN, lineY);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${BRAND} — Confidential`, MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - R_MARGIN, pageHeight - 8, { align: "right" });
  }
}

export interface SectionPdfField {
  label: string;
  value: string;
}

export interface SectionPdfTable {
  headers: string[];
  rows: string[][];
  /** Map of row index → inline note text to render beneath that row */
  noteRows?: Record<number, string>;
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
  const doc = new jsPDF({ orientation: config.landscape ? "l" : "p", unit: "mm", format: "a4" });
  registerArialFont(doc);
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
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: "bold" },
      },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Render table data
  if (config.table && config.table.rows.length > 0) {
    const noteRowSet = new Set<number>();
    if (config.table.noteRows) {
      Object.keys(config.table.noteRows).forEach(k => noteRowSet.add(Number(k)));
    }

    autoTable(doc, {
      startY: y,
      head: [config.table.headers],
      body: config.table.rows,
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 10 },
      styles: { lineColor: [180, 180, 180], lineWidth: 0.5 },
      margin: { left: MARGIN, right: R_MARGIN },
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
      didDrawRow(data) {
        if (data.section === "body" && config.table?.noteRows) {
          const note = config.table.noteRows[data.row.index];
          if (note) {
            const rowBottom = data.row.y + data.row.height;
            doc.setFontSize(8);
            doc.setFont("Arial", "italic");
            doc.setTextColor(130, 130, 130);
            doc.text(`Correction Note: ${note}`, MARGIN + 8, rowBottom + 4);
            // Add spacing so the next row doesn't overlap
            data.row.height += 7;
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  if (config.table && config.table.rows.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records to display.", MARGIN, y + 6);
  }

  addFooter(doc);
  return doc;
}

export async function downloadSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const filename = config.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
  await savePdfReliably(doc, filename);
}

export async function previewSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const pdfData = doc.output("arraybuffer");

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;";

  const container = document.createElement("div");
  container.style.cssText = "width:90vw;height:90vh;max-width:900px;background:#fff;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;";

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;justify-content:flex-end;padding:8px 12px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕ Close";
  closeBtn.style.cssText = "padding:4px 12px;border:1px solid #d1d5db;border-radius:4px;background:#fff;cursor:pointer;font-size:13px;";
  closeBtn.onclick = () => { document.body.removeChild(overlay); };
  toolbar.appendChild(closeBtn);

  const scrollArea = document.createElement("div");
  scrollArea.style.cssText = "flex:1;overflow-y:auto;padding:16px;background:#e5e7eb;display:flex;flex-direction:column;align-items:center;gap:16px;";

  container.appendChild(toolbar);
  container.appendChild(scrollArea);
  overlay.appendChild(container);
  overlay.onclick = (e) => { if (e.target === overlay) { document.body.removeChild(overlay); } };
  document.body.appendChild(overlay);

  // Render pages as canvas images via pdf.js
  try {
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const scale = 2;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.cssText = "max-width:100%;height:auto;box-shadow:0 2px 8px rgba(0,0,0,0.15);border-radius:4px;";
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      scrollArea.appendChild(canvas);
    }
  } catch (err) {
    scrollArea.textContent = "Failed to render preview.";
    console.error("PDF preview error:", err);
  }
}

export async function printSectionPdf(config: SectionPdfConfig) {
  const doc = generateSectionPdf(config);
  const filename = `${config.title.replace(/\s+/g, "_")}.pdf`;
  await savePdfReliably(doc, filename);
}
