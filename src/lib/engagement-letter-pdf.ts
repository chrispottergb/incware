import jsPDF from "jspdf";
import { registerArialFont } from "@/lib/arial-font";
import { savePdfReliably } from "@/lib/pdf-save";
import { ENGAGEMENT_LETTER_TEMPLATE } from "@/lib/engagement-letter-template";

export interface EngagementLetterCompany {
  name: string;
  address?: string | null;
  address_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  contact_full_name?: string | null;
  salutation_name?: string | null;
}

export interface EngagementLetterFirm {
  firm_name?: string | null;
  address?: string | null;
  address_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
}

export interface EngagementLetterParams {
  company: EngagementLetterCompany;
  firm: EngagementLetterFirm;
  services?: string[];
  feeTerms?: string;
  letterDate?: string;
}

const MARGIN_LEFT = 31.75; // 1.25" binder margin
const MARGIN_RIGHT = 19.05; // 0.75"
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;

const clean = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "";
  return s;
};

function formatLetterDate(iso?: string): string {
  const d = iso ? new Date(`${iso.slice(0, 10)}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function cityStateZip(city?: string | null, state?: string | null, zip?: string | null): string {
  const c = clean(city);
  const s = clean(state);
  const z = clean(zip);
  const left = [c, s].filter(Boolean).join(", ");
  return [left, z].filter(Boolean).join(" ");
}

export function buildEngagementLetterPDF(params: EngagementLetterParams): jsPDF {
  const T = ENGAGEMENT_LETTER_TEMPLATE;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const textWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  let y = MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  const writeParagraph = (text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; gap?: number; indent?: number }) => {
    const size = opts?.size ?? 10;
    doc.setFontSize(size);
    doc.setFont("Arial", opts?.bold ? "bold" : opts?.italic ? "italic" : "normal");
    doc.setTextColor(30, 30, 30);
    const indent = opts?.indent ?? 0;
    const lines = doc.splitTextToSize(text, textWidth - indent) as string[];
    const lineH = size * 0.4 + 1.2;
    ensureSpace(lines.length * lineH);
    doc.text(lines, MARGIN_LEFT + indent, y);
    y += lines.length * lineH + (opts?.gap ?? 4);
  };

  const writeBullet = (text: string) => {
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(text, textWidth - 8) as string[];
    const lineH = 5;
    ensureSpace(lines.length * lineH);
    doc.text("•", MARGIN_LEFT + 2, y);
    doc.text(lines, MARGIN_LEFT + 8, y);
    y += lines.length * lineH + 1.5;
  };

  const ruledLine = (width = 70) => {
    ensureSpace(6);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, y, MARGIN_LEFT + width, y);
    y += 5;
  };

  // Title
  doc.setFontSize(13);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(T.documentTitle, pageWidth / 2, y, { align: "center" });
  y += 9;

  // Firm letterhead
  const firmName = clean(params.firm.firm_name);
  const firmContactLine = [
    clean(params.firm.address),
    clean(params.firm.address_2),
    cityStateZip(params.firm.city, params.firm.state, params.firm.zip),
    clean(params.firm.phone),
    clean(params.firm.email),
  ]
    .filter(Boolean)
    .join(" · ");

  if (firmName) {
    doc.setFontSize(11);
    doc.setFont("Arial", "bold");
    doc.text(firmName, pageWidth / 2, y, { align: "center" });
    y += 5;
  } else {
    ruledLine(80);
  }
  if (firmContactLine) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(90, 90, 90);
    const l = doc.splitTextToSize(firmContactLine, textWidth) as string[];
    doc.text(l, pageWidth / 2, y, { align: "center" });
    y += l.length * 4.5;
  }
  y += 6;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  y += 8;

  // Date
  writeParagraph(formatLetterDate(params.letterDate), { gap: 6 });

  // Client address block
  const companyName = clean(params.company.name);
  if (companyName) writeParagraph(companyName, { gap: 0 });
  const clientLines = [
    clean(params.company.address),
    clean(params.company.address_2),
    cityStateZip(params.company.city, params.company.state, params.company.zip),
  ].filter(Boolean);
  if (clientLines.length === 0) {
    ruledLine(70);
    ruledLine(70);
    y += 2;
  } else {
    clientLines.forEach((line) => writeParagraph(line, { gap: 0 }));
    y += 6;
  }

  // Re: line
  writeParagraph(T.reLine, { bold: true, gap: 6 });

  // Salutation
  const salutation =
    clean(params.company.salutation_name) ||
    clean(params.company.contact_full_name) ||
    T.salutationFallback;
  writeParagraph(`Dear ${salutation}:`, { gap: 5 });

  // Intro
  writeParagraph(
    T.intro
      .replace(/\{FIRM\}/g, firmName || "our firm")
      .replace(/\{COMPANY\}/g, companyName || "the Company"),
    { gap: 6 }
  );

  const services =
    (params.services && params.services.filter((s) => clean(s).length > 0)) ||
    [...T.defaultServices];
  const feeTerms = clean(params.feeTerms) || T.defaultFeeTerms;

  T.sections.forEach((section, idx) => {
    const number = idx + 1;
    ensureSpace(14);
    writeParagraph(`${number}. ${section.heading}`, { bold: true, gap: 3 });

    section.paragraphs?.forEach((p) => writeParagraph(p, { gap: 3 }));

    let bullets = section.bullets ? [...section.bullets] : [];
    if (section.heading === T.sections[0].heading) bullets = services;
    bullets.forEach((b) => writeBullet(b));
    if (bullets.length > 0) y += 3;

    if (section.heading === "Fees") writeParagraph(feeTerms, { gap: 3 });

    section.trailingParagraphs?.forEach((p) => writeParagraph(p, { gap: 3 }));

    y += 3;
  });

  // Closing
  ensureSpace(40);
  y += 3;
  writeParagraph(T.closing, { gap: 8 });
  writeParagraph(T.signOff, { gap: 14 });

  ruledLine(75);
  const signerName = clean(params.firm.contact_name);
  const signerTitle = clean(params.firm.contact_title);
  const signerLine = [signerName, signerTitle, firmName].filter(Boolean).join(", ");
  if (signerLine) writeParagraph(signerLine, { gap: 10 });
  else y += 8;

  // Client acceptance block
  ensureSpace(55);
  writeParagraph(T.acceptanceHeading, { bold: true, gap: 5 });
  writeParagraph(companyName ? companyName.toUpperCase() : "", { bold: true, gap: 8 });
  T.acceptanceLines.forEach((label) => {
    ensureSpace(10);
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(label, MARGIN_LEFT, y);
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT + 18, y + 1, MARGIN_LEFT + 100, y + 1);
    y += 10;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("Arial", "normal");
    doc.text(`Engagement Letter ${T.version}`, MARGIN_LEFT, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN_RIGHT, pageHeight - 8, { align: "right" });
  }

  return doc;
}

export function engagementLetterFileName(companyName: string): string {
  const slug = (companyName || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `engagement-letter-${slug || "client"}.pdf`;
}

export async function exportEngagementLetterPDF(params: EngagementLetterParams): Promise<jsPDF> {
  const doc = buildEngagementLetterPDF(params);
  await savePdfReliably(doc, engagementLetterFileName(params.company.name));
  return doc;
}
