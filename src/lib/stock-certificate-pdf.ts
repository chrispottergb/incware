import jsPDF from "jspdf";
import { savePdfReliably } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";

export interface StockCertificateData {
  companyName: string;
  stateOfIncorporation?: string;
  certificateNumber: number;
  shareholderName: string;
  numShares: number;
  shareClass: string;
  parValue?: number | null;
  issueDate: string;
  authorizedShares?: number | null;
  isLLC?: boolean;
  membershipInterest?: number | null;
  ownershipPercentSnapshot?: number | null;
  liveOwnershipPercent?: number | null;
}

const NAVY: [number, number, number] = [31, 78, 121];
const STEEL_BLUE: [number, number, number] = [214, 228, 240];
const TEXT: [number, number, number] = [35, 35, 35];
const MUTED: [number, number, number] = [136, 136, 136];

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function drawArtDecoBorder(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.2);
  doc.rect(9, 9, pw - 18, ph - 18);
  doc.setLineWidth(0.4);
  doc.rect(13, 13, pw - 26, ph - 26);

  doc.setFillColor(...NAVY);
  const diamonds = [
    [18, 18],
    [pw - 18, 18],
    [18, ph - 18],
    [pw - 18, ph - 18],
  ];
  diamonds.forEach(([x, y]) => {
    doc.triangle(x, y - 4, x + 4, y, x, y + 4, "F");
    doc.triangle(x, y - 4, x - 4, y, x, y + 4, "F");
  });
}

function drawSideBoxes(doc: jsPDF, unitsLabel: string, data: StockCertificateData) {
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont("Arial", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);

  doc.rect(24, 25, 48, 13);
  doc.text("CERTIFICATE NO.", 48, 30, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`C-${String(data.certificateNumber).padStart(3, "0")}`, 48, 35, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(...NAVY);
  doc.rect(pw - 72, 25, 48, 13);
  doc.text(unitsLabel, pw - 48, 30, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(formatNumber(data.numShares), pw - 48, 35, { align: "center" });
}

function drawHeader(doc: jsPDF, data: StockCertificateData, title: string) {
  const pw = doc.internal.pageSize.getWidth();

  doc.setFont("Arial", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("TEST CERTIFICATE LAYOUT", pw / 2, 22, { align: "center" });

  doc.setFontSize(18);
  doc.text(data.companyName.toUpperCase(), pw / 2, 48, { align: "center", maxWidth: pw - 80 });

  doc.setFontSize(12);
  doc.text(title, pw / 2, 61, { align: "center" });

  doc.setDrawColor(...STEEL_BLUE);
  doc.setLineWidth(1);
  doc.line(76, 67, pw - 76, 67);
}

function underlineCenteredText(doc: jsPDF, text: string, x: number, y: number, padding = 6) {
  doc.text(text, x, y, { align: "center" });
  const width = doc.getTextWidth(text);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.35);
  doc.line(x - width / 2 - padding, y + 2, x + width / 2 + padding, y + 2);
}

function getLLCStatePhrase(state?: string) {
  const trimmed = state?.trim();
  if (!trimmed) return "a limited liability company";
  if (["WI", "WISCONSIN"].includes(trimmed.toUpperCase())) return "a Wisconsin limited liability company";
  return `a ${trimmed} limited liability company`;
}

function drawSignatures(doc: jsPDF, data: StockCertificateData, isLLC: boolean) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const sigY = ph - 43;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.35);
  doc.line(40, sigY, 120, sigY);
  doc.line(pw - 120, sigY, pw - 40, sigY);

  doc.setFont("Arial", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(isLLC ? "Authorized Signatory" : "Secretary", 80, sigY + 5, { align: "center" });
  doc.text(data.companyName, 80, sigY + 10, { align: "center", maxWidth: 84 });
  doc.text(isLLC ? "Member Acknowledgment" : "President", pw - 80, sigY + 5, { align: "center" });
  doc.text(isLLC ? data.shareholderName : data.companyName, pw - 80, sigY + 10, { align: "center", maxWidth: 84 });
}

function drawFooter(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setFont("Arial", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text("Prepared using EntityIQ Corporate Records Management", pw / 2, ph - 12, { align: "center" });
}

function renderLLCWhimsicalCertificate(doc: jsPDF, data: StockCertificateData) {
  const pw = doc.internal.pageSize.getWidth();
  const statePhrase = getLLCStatePhrase(data.stateOfIncorporation);
  // Snapshot preferred; legacy certificates fall back to live calculation.
  const ownershipPercent = data.ownershipPercentSnapshot ?? data.liveOwnershipPercent ?? data.membershipInterest ?? null;

  drawArtDecoBorder(doc);
  drawSideBoxes(doc, "UNITS", data);
  drawHeader(doc, data, "MEMBERSHIP UNIT CERTIFICATE");

  let y = 84;
  doc.setTextColor(...TEXT);
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.text("This certifies that:", pw / 2, y, { align: "center" });

  y += 14;
  doc.setFont("Arial", "bold");
  doc.setFontSize(14);
  underlineCenteredText(doc, data.shareholderName, pw / 2, y);

  y += 14;
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.text("is the record holder of", pw / 2, y, { align: "center" });

  y += 12;
  doc.setFont("Arial", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(`${formatNumber(data.numShares)} Membership Units`, pw / 2, y, { align: "center" });

  y += 12;
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  const ownershipLine =
    ownershipPercent != null
      ? `representing a ${Number(ownershipPercent).toFixed(4).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1")}% ownership interest in ${data.companyName}, ${statePhrase}.`
      : `a holder of ${formatNumber(data.numShares)} Membership Units in ${data.companyName}, ${statePhrase}.`;
  doc.text(doc.splitTextToSize(ownershipLine, pw - 82), pw / 2, y, { align: "center", maxWidth: pw - 82 });

  y += 22;
  doc.text(`Issued on ${formatDate(data.issueDate)}`, pw / 2, y, { align: "center" });

  drawSignatures(doc, data, true);
  drawFooter(doc);
}

function renderCorporationCertificate(doc: jsPDF, data: StockCertificateData) {
  const pw = doc.internal.pageSize.getWidth();

  drawArtDecoBorder(doc);
  drawSideBoxes(doc, "SHARES", data);
  drawHeader(doc, data, "STOCK CERTIFICATE");

  let y = 83;
  if (data.stateOfIncorporation) {
    doc.setFont("Arial", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Incorporated under the laws of the State of ${data.stateOfIncorporation}`, pw / 2, y, { align: "center" });
    y += 10;
  }

  doc.setTextColor(...TEXT);
  doc.setFont("Arial", "bolditalic");
  doc.setFontSize(13);
  doc.text("This certifies that", pw / 2, y, { align: "center" });

  y += 13;
  doc.setFont("Arial", "bold");
  doc.setFontSize(14);
  underlineCenteredText(doc, data.shareholderName, pw / 2, y);

  y += 13;
  doc.setFont("Arial", "normal");
  doc.setFontSize(10.5);
  const parText = data.parValue != null ? `, par value $${Number(data.parValue).toFixed(2)} per share,` : ", no par value,";
  const body = `is the registered holder of ${formatNumber(data.numShares)} shares of ${data.shareClass} Stock${parText} of ${data.companyName}, transferable only on the books of the Corporation by the holder hereof in person or by duly authorized attorney upon surrender of this Certificate properly endorsed.`;
  doc.text(doc.splitTextToSize(body, pw - 82), pw / 2, y, { align: "center", maxWidth: pw - 82 });

  y += 30;
  doc.setFont("Arial", "bolditalic");
  doc.setFontSize(11);
  doc.text("In Witness Whereof,", 40, y);
  doc.setFont("Arial", "normal");
  doc.setFontSize(10);
  doc.text("the said Corporation has caused this Certificate to be executed on its behalf by its duly authorized officer(s).", 40, y + 6, { maxWidth: pw - 80 });
  doc.text(`Issued on ${formatDate(data.issueDate)}`, pw / 2, y + 19, { align: "center" });

  drawSignatures(doc, data, false);
  drawFooter(doc);
}

export async function generateStockCertificatePdf(data: StockCertificateData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape" });
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);

  if (data.isLLC) {
    renderLLCWhimsicalCertificate(doc, data);
  } else {
    renderCorporationCertificate(doc, data);
  }

  return doc;
}

export async function downloadStockCertificatePdf(data: StockCertificateData) {
  const doc = await generateStockCertificatePdf(data);
  await savePdfReliably(doc, `certificate-${data.certificateNumber}.pdf`);
}
