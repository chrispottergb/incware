import jsPDF from "jspdf";
import { registerArialFont } from "@/lib/arial-font";
import {
  buildStatementHeader,
  computeRatios,
  getFormVisibility,
  formatMoney,
  hasBoardReviewFigures,
  yoyPercent,
  BOARD_REVIEW_FIELDS,
  EMPTY_STATEMENT_NOTE,
  SOURCE_TAG_LABELS,
  type IrsFormType,
  type NonprofitStatement,
  type SourceTag,
} from "@/lib/nonprofit-financials";

const MARGIN = 31.75; // 1.25" binder margin
const R_MARGIN = 19.05;
const HEADER_FILL: [number, number, number] = [214, 228, 240]; // steel blue

function pw(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}
function ph(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

export interface NonprofitStatementPdfData {
  companyName: string;
  formType: IrsFormType | null;
  statement: NonprofitStatement;
  priorYear?: NonprofitStatement | null;
}

export function generateNonprofitFinancialStatementPDF(data: NonprofitStatementPdfData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  const { statement: s, priorYear, formType } = data;
  const vis = getFormVisibility(formType);
  const header = buildStatementHeader(s);
  const width = pw(doc) - MARGIN - R_MARGIN;
  let y = 24;

  const ensure = (needed = 12) => {
    if (y + needed > ph(doc) - 24) {
      doc.addPage();
      y = 24;
    }
  };

  const text = (str: string, size: number, style: "normal" | "bold", gap: number) => {
    doc.setFontSize(size);
    doc.setFont("Arial", style);
    doc.setTextColor(30, 30, 30);
    for (const line of doc.splitTextToSize(str, width)) {
      ensure();
      doc.text(line, MARGIN, y);
      y += gap;
    }
  };

  // ---- Header block
  text(data.companyName, 14, "bold", 6.5);
  text(header.title, 11.5, "bold", 6);
  y += 1;
  text(header.fiscalYearLine, 9.5, "normal", 4.8);
  if (header.periodLine) text(header.periodLine, 9.5, "normal", 4.8);
  text(header.sourceLine, 9.5, "normal", 4.8);
  text(header.statusLine, 9.5, "normal", 4.8);
  text(header.documentedLine, 9.5, "normal", 4.8);
  text(header.boardReviewedLine, 9.5, "normal", 4.8);
  if (header.postFilingNote) {
    y += 1.5;
    text(header.postFilingNote, 8.5, "normal", 4.2);
  }
  y += 4;

  if (vis.unsupportedMessage) {
    text(vis.unsupportedMessage, 10.5, "normal", 5);
    return doc;
  }

  if (vis.showConfirmationBlock) {
    sectionTitle(doc, "Form 990-N Confirmation", () => y, (v) => (y = v), width);
    text(`Fiscal Year: FY${s.fiscal_year}`, 10, "normal", 5);
    text(
      `Gross receipts under the filing threshold: ${s.gross_receipts_under_threshold ? "Yes" : "No"}`,
      10,
      "normal",
      5,
    );
    text(`Board acknowledgment: ${s.board_acknowledgment || "—"}`, 10, "normal", 5);
    return doc;
  }

  const tags = (s.source_tags || {}) as Record<string, SourceTag>;

  const table = (
    title: string,
    rows: { key: string; label: string; ref: string; total?: boolean; indent?: boolean }[],
  ) => {
    const estimatedHeight = 15.5 + rows.reduce((height, row) => {
      const rowHeight = tags[row.key] ? 8.2 : 5.4;
      return height + rowHeight + (row.total ? 1.5 : 0);
    }, 0);
    ensure(estimatedHeight);
    sectionTitle(doc, title, () => y, (v) => (y = v), width);

    const colLabel = MARGIN;
    const colRef = MARGIN + 62;
    const colCur = MARGIN + 104;
    const colPri = MARGIN + 130;
    const colYoy = MARGIN + 152;

    doc.setFillColor(...HEADER_FILL);
    doc.rect(MARGIN, y - 4.4, width, 6.4, "F");
    doc.setFontSize(8.5);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Line", colLabel + 1, y);
    doc.text("990 Ref.", colRef, y);
    doc.text("Current Year", colCur, y);
    doc.text("Prior Year", colPri, y);
    doc.text("YoY %", colYoy, y);
    y += 6.5;

    for (const r of rows) {
      ensure(8);
      doc.setFontSize(8.5);
      doc.setFont("Arial", r.total ? "bold" : "normal");
      const tag = tags[r.key];
      const label = (r.indent ? "    " : "") + r.label;
      doc.text(label, colLabel + 1, y);
      doc.setFont("Arial", "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(110, 110, 110);
      doc.text(r.ref, colRef, y);
      if (tag) doc.text(SOURCE_TAG_LABELS[tag], colRef, y + 3.2);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(8.5);
      doc.setFont("Arial", r.total ? "bold" : "normal");
      doc.text(formatMoney(s[r.key]) || "—", colCur, y);
      doc.text(priorYear ? formatMoney(priorYear[r.key]) || "—" : "—", colPri, y);
      const yoy = priorYear ? yoyPercent(s[r.key], priorYear[r.key]) : null;
      doc.text(yoy == null ? "—" : `${yoy.toFixed(1)}%`, colYoy, y);
      y += tag ? 8.2 : 5.4;
      if (r.total) {
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y - 3.4, MARGIN + width, y - 3.4);
        y += 1.5;
      }
    }
    y += 4;
  };

  const hasFigures = hasBoardReviewFigures(s);

  if (!hasFigures) {
    text(EMPTY_STATEMENT_NOTE, 9.5, "normal", 5);
    return doc;
  }

  table("Annual Financial Review", BOARD_REVIEW_FIELDS as any);

  if (vis.showRatios) {
    const ratios = computeRatios(s);
    if (ratios.length) {
      ensure(20);
      sectionTitle(doc, "Oversight Ratios", () => y, (v) => (y = v), width);
      for (const r of ratios) {
        ensure(8);
        doc.setFontSize(9);
        doc.setFont("Arial", "normal");
        doc.text(`${r.label}: ${r.display}`, MARGIN + 1, y);
        doc.setFontSize(7.2);
        doc.setTextColor(110, 110, 110);
        doc.text(r.formula, MARGIN + 110, y);
        doc.setTextColor(30, 30, 30);
        y += 5.4;
      }
      y += 4;
    }
  }

  const dismissed = s.dismissed_warnings || [];
  if (dismissed.length) {
    ensure(20);
    sectionTitle(doc, "Accepted Reconciliation Differences", () => y, (v) => (y = v), width);
    for (const w of dismissed) {
      text(
        `• ${w.message}${w.dismissed_by ? ` (accepted by ${w.dismissed_by}${w.dismissed_at ? ` on ${String(w.dismissed_at).slice(0, 10)}` : ""})` : ""}`,
        8,
        "normal",
        4.2,
      );
    }
  }

  return doc;
}

function sectionTitle(
  doc: jsPDF,
  label: string,
  getY: () => number,
  setY: (v: number) => void,
  width: number,
) {
  let y = getY();
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(label, MARGIN, y);
  doc.setDrawColor(...HEADER_FILL);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 1.8, MARGIN + width, y + 1.8);
  setY(y + 9);
}
