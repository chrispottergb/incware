import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as pdfjsLib from "pdfjs-dist";
import { savePdfReliably, printPdfInIframe } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

const BINDER_MARGIN = 31.75; // 1.25 inch binder margin for 3-hole punch filing
const NORMAL_MARGIN = 19.05; // 0.75 inch normal margin
const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

// Portrait: binder on left. Landscape: binder on top.
function getMargins(landscape: boolean) {
  return {
    left: landscape ? NORMAL_MARGIN : BINDER_MARGIN,
    right: NORMAL_MARGIN,
    top: landscape ? BINDER_MARGIN : NORMAL_MARGIN,
  };
}

function addHeader(doc: jsPDF, title: string, companyName: string, statuteRef?: string, landscape = false) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const m = getMargins(landscape);
  const topOffset = m.top;
  // Y positions are offset by top margin
  const brandY = topOffset + 4;
  const subY = brandY + 6;
  const titleY = subY + 12;
  const subtitleY = titleY + 7;

  const headline = companyName && companyName.trim().length > 0 ? companyName : BRAND;

  doc.setFontSize(18);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(headline, m.left, brandY);

  doc.setFontSize(8);
  doc.setFont("Arial", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, m.left, subY);

  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(title, m.left, titleY);

  if (statuteRef) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(statuteRef, m.left, subtitleY);
  }

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

export interface SectionPdfField {
  label: string;
  value: string;
}

export interface SectionPdfTable {
  headers: string[];
  rows: string[][];
  /** Map of row index → inline note text to render beneath that row */
  noteRows?: Record<number, string>;
  /** Optional per-column width overrides keyed by column index */
  columnStyles?: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right" | "justify" }>;
  /** Optional summary lines rendered as bold text just below the table */
  summaryLines?: string[];
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
  const isLandscape = !!config.landscape;
  const doc = new jsPDF({ orientation: isLandscape ? "l" : "p", unit: "mm", format: "a4" });
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const m = getMargins(isLandscape);
  const subtitle = [config.companyName, config.statuteRef].filter(Boolean).join(" — ");

  addHeader(doc, config.title, subtitle, isLandscape);

  // startY after header — matches the lineY + some padding
  const headerLineY = config.statuteRef
    ? m.top + 4 + 6 + 12 + 7 + 4
    : m.top + 4 + 6 + 12 + 4;
  let y = headerLineY + 7;

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
      margin: { left: m.left, right: m.right },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Render table data
  if (config.table && config.table.rows.length > 0) {
    // Build expanded body rows with note rows inserted inline
    const expandedRows: string[][] = [];
    const colCount = config.table.headers.length;
    config.table.rows.forEach((row, idx) => {
      expandedRows.push(row);
      if (config.table?.noteRows && config.table.noteRows[idx]) {
        const noteRow = new Array(colCount).fill("");
        noteRow[0] = `  Correction Note: ${config.table.noteRows[idx]}`;
        expandedRows.push(noteRow);
      }
    });

    // Track which expanded rows are note rows
    const noteExpandedIndices = new Set<number>();
    let expandedIdx = 0;
    config.table.rows.forEach((_, idx) => {
      expandedIdx++; // data row
      if (config.table?.noteRows && config.table.noteRows[idx]) {
        noteExpandedIndices.add(expandedIdx);
        expandedIdx++; // note row
      }
    });

    autoTable(doc, {
      startY: y,
      head: [config.table.headers],
      body: expandedRows,
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 10 },
      styles: { lineColor: [180, 180, 180], lineWidth: 0.5 },
      margin: { left: m.left, right: m.right },
      ...(config.table.columnStyles ? { columnStyles: config.table.columnStyles } : {}),
      didParseCell(data) {
        if (data.section === "body") {
          if (noteExpandedIndices.has(data.row.index)) {
            data.cell.styles.fontSize = 8;
            data.cell.styles.fontStyle = "italic";
            data.cell.styles.textColor = [130, 130, 130];
            data.cell.styles.lineWidth = 0;
            if (data.column.index === 0) {
              data.cell.colSpan = colCount;
            } else {
              data.cell.text = [];
            }
          } else {
            const text = (data.cell.raw as string || "").toLowerCase();
            if (text === "active") {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = "bold";
            } else if (text === "cancelled" || text === "inactive" || text === "dissolved") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Render any summary lines below the table (e.g. Treasury Balance: 8,000)
    if (config.table.summaryLines && config.table.summaryLines.length > 0) {
      doc.setFontSize(10);
      doc.setFont("Arial", "bold");
      doc.setTextColor(30, 30, 30);
      config.table.summaryLines.forEach((line) => {
        doc.text(line, m.left, y);
        y += 5;
      });
      y += 4;
    }
  }

  if (config.table && config.table.rows.length === 0) {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records to display.", m.left, y + 6);
  }

  addFooter(doc, isLandscape);
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
  const ok = await printPdfInIframe(doc);
  if (!ok) await savePdfReliably(doc, filename);
}