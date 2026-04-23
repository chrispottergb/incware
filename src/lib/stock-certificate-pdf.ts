import jsPDF from "jspdf";
import eagleImg from "@/assets/certificate-eagle.png";
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
  membershipInterest?: number | null; // legacy field — superseded by snapshot/live below
  /** Snapshot saved at issuance for LLC certificates. Preferred when present. */
  ownershipPercentSnapshot?: number | null;
  /** Live-calculated ownership % passed by caller as a fallback for legacy certs. */
  liveOwnershipPercent?: number | null;
}

// Brand defaults for the LLC whimsical-professional layout
const LLC_PRIMARY: [number, number, number] = [31, 78, 121];     // #1F4E79 navy
const LLC_SECONDARY: [number, number, number] = [214, 228, 240]; // #D6E4F0 steel-blue

// Preload eagle image as base64 (used by corporation layout only)
let eagleBase64: string | null = null;
const eagleReady = new Promise<string>((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    eagleBase64 = canvas.toDataURL("image/png");
    resolve(eagleBase64);
  };
  img.onerror = () => resolve("");
  img.src = eagleImg;
});

function drawOrnateRedBorder(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const brickRed: [number, number, number] = [192, 58, 43]; // #C03A2B

  // Outer border
  doc.setDrawColor(...brickRed);
  doc.setLineWidth(3);
  doc.rect(8, 8, pw - 16, ph - 16);

  // Double inner border
  doc.setLineWidth(1);
  doc.rect(12, 12, pw - 24, ph - 24);
  doc.setLineWidth(0.5);
  doc.rect(15, 15, pw - 30, ph - 30);

  // Corner ornaments (small squares at each corner)
  const corners = [
    [8, 8], [pw - 14, 8], [8, ph - 14], [pw - 14, ph - 14]
  ];
  doc.setFillColor(...brickRed);
  for (const [cx, cy] of corners) {
    doc.rect(cx, cy, 6, 6, "F");
  }

  // Decorative line accents along edges
  doc.setDrawColor(...brickRed);
  doc.setLineWidth(0.3);
  doc.line(20, 18, pw - 20, 18);
  doc.line(20, ph - 18, pw - 20, ph - 18);
  doc.line(18, 20, 18, ph - 20);
  doc.line(pw - 18, 20, pw - 18, ph - 20);
}

/** Geometric art-deco border for the LLC whimsical-professional layout. */
function drawLLCArtDecoBorder(doc: jsPDF) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...LLC_PRIMARY);

  // Outer border (~1.2pt ≈ 0.42mm)
  doc.setLineWidth(0.42);
  doc.rect(8, 8, pw - 16, ph - 16);

  // Inner border (~0.4pt ≈ 0.14mm), ~4mm gap
  doc.setLineWidth(0.14);
  doc.rect(12, 12, pw - 24, ph - 24);

  // Filled diamond flourishes at each corner of the outer border
  doc.setFillColor(...LLC_PRIMARY);
  const diamond = (cx: number, cy: number, r = 1.6) => {
    doc.triangle(cx, cy - r, cx + r, cy, cx - r, cy, "F"); // top
    doc.triangle(cx - r, cy, cx + r, cy, cx, cy + r, "F"); // bottom
  };
  diamond(8, 8);
  diamond(pw - 8, 8);
  diamond(8, ph - 8);
  diamond(pw - 8, ph - 8);
}

function buildLLCStatePhrase(state?: string): string {
  const s = (state || "").trim();
  if (!s) return "a limited liability company"; // omit state adjective if missing
  if (s.toLowerCase() === "wi" || s.toLowerCase() === "wisconsin") {
    return "a Wisconsin limited liability company";
  }
  return `a ${s} limited liability company`;
}

function formatPct(pct: number): string {
  // Trim trailing zeros, keep up to 4 decimals
  const fixed = pct.toFixed(4);
  return fixed.replace(/0+$/, "").replace(/\.$/, "");
}

async function renderLLCWhimsicalCertificate(doc: jsPDF, data: StockCertificateData) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Snapshot preferred; legacy certificates fall back to live calculation.
  const ownershipPercent =
    data.ownershipPercentSnapshot ?? data.liveOwnershipPercent ?? data.membershipInterest ?? null;

  drawLLCArtDecoBorder(doc);

  // ── Side boxes: CERTIFICATE NO. (left) and UNITS (right) ──
  doc.setDrawColor(...LLC_PRIMARY);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(...LLC_PRIMARY);

  doc.rect(22, 22, 50, 14);
  doc.text("CERTIFICATE NO.", 47, 28, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(`C-${String(data.certificateNumber).padStart(3, "0")}`, 47, 33.5, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(...LLC_PRIMARY);
  doc.rect(pw - 72, 22, 50, 14);
  doc.text("UNITS", pw - 47, 28, { align: "center" });
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(data.numShares.toLocaleString(), pw - 47, 33.5, { align: "center" });

  // ── Header (centered) ──
  let y = 44;
  doc.setFont("Arial", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(data.companyName, pw / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(...LLC_PRIMARY);
  // Tracked caps via spaces between letters
  const trackedTitle = "MEMBERSHIP UNIT CERTIFICATE".split("").join(" ");
  doc.text(trackedTitle, pw / 2, y, { align: "center" });
  y += 4;

  // Thin secondary-color rule
  doc.setDrawColor(...LLC_SECONDARY);
  doc.setLineWidth(0.6);
  doc.line(40, y, pw - 40, y);
  y += 10;

  // ── Body (centered, Arial 11pt) ──
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("This certifies that:", pw / 2, y, { align: "center" });
  y += 9;

  // Member name — 14pt bold, underlined
  doc.setFont("Arial", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(data.shareholderName, pw / 2, y, { align: "center" });
  const nameWidth = doc.getTextWidth(data.shareholderName);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - nameWidth / 2 - 4, y + 1.5, pw / 2 + nameWidth / 2 + 4, y + 1.5);
  y += 9;

  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("is the record holder of", pw / 2, y, { align: "center" });
  y += 8;

  // Units line — 13pt bold
  doc.setFont("Arial", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text(`${data.numShares.toLocaleString()} Membership Units`, pw / 2, y, { align: "center" });
  y += 9;

  // Ownership / state line
  const statePhrase = buildLLCStatePhrase(data.stateOfIncorporation);
  doc.setFont("Arial", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  let bodyLine: string;
  if (ownershipPercent != null && Number.isFinite(ownershipPercent)) {
    bodyLine = `representing a ${formatPct(ownershipPercent)}% ownership interest in ${data.companyName}, ${statePhrase}.`;
  } else {
    // Fallback when neither snapshot nor live % available.
    bodyLine = `a holder of ${data.numShares.toLocaleString()} Membership Units in ${data.companyName}, ${statePhrase}.`;
  }
  const bodyLines = doc.splitTextToSize(bodyLine, pw - 80);
  doc.text(bodyLines, pw / 2, y, { align: "center", maxWidth: pw - 80 });
  y += bodyLines.length * 5 + 4;

  // Issue date
  const dateStr = new Date(data.issueDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.text(`Issued on ${dateStr}`, pw / 2, y, { align: "center" });

  // ── Signatures ──
  const sigY = Math.max(y + 18, ph - 38);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(40, sigY, 120, sigY);
  doc.line(pw - 120, sigY, pw - 40, sigY);

  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(...LLC_PRIMARY);
  doc.text("Authorized Signatory", 80, sigY + 5, { align: "center" });
  doc.text("Member Acknowledgment", pw - 80, sigY + 5, { align: "center" });

  doc.setFont("Arial", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  doc.text(data.companyName, 80, sigY + 9.5, { align: "center" });
  doc.text(data.shareholderName, pw - 80, sigY + 9.5, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Prepared using EntityIQ Corporate Records Management", pw / 2, ph - 12, { align: "center" });
}

async function renderCorporationCertificate(doc: jsPDF, data: StockCertificateData) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Draw ornate brick red border
  drawOrnateRedBorder(doc);

  // Load eagle
  const eagle = eagleBase64 || (await eagleReady);

  let y = 30;

  // Eagle centered at top
  if (eagle) {
    const eagleW = 40;
    const eagleH = 40;
    doc.addImage(eagle, "PNG", pw / 2 - eagleW / 2, y - 5, eagleW, eagleH);
    y += eagleH + 2;
  }

  // Certificate Number and Shares boxes
  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(80, 80, 80);

  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(30, 32, 45, 12);
  doc.text("CERTIFICATE NO.", 52.5, 37, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`C-${String(data.certificateNumber).padStart(3, "0")}`, 52.5, 42, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.rect(pw - 75, 32, 45, 12);
  doc.text("SHARES", pw - 52.5, 37, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(data.numShares.toLocaleString(), pw - 52.5, 42, { align: "center" });

  // Company name banner
  y += 4;
  const bannerH = 14;
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.roundedRect(35, y, pw - 70, bannerH, 2, 2, "FD");
  doc.setFontSize(16);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(data.companyName.toUpperCase(), pw / 2, y + bannerH / 2 + 2, { align: "center" });
  y += bannerH + 4;

  if (data.stateOfIncorporation) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`Incorporated under the laws of the State of ${data.stateOfIncorporation}`, pw / 2, y, { align: "center" });
    y += 6;
  }

  if (data.authorizedShares) {
    doc.setFontSize(8);
    doc.text(`Authorized Shares: ${data.authorizedShares.toLocaleString()}`, pw / 2, y, { align: "center" });
    y += 6;
  }

  // Title
  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(192, 58, 43);
  doc.text("STOCK CERTIFICATE", pw / 2, y + 2, { align: "center" });
  y += 12;

  // "This Certifies that"
  doc.setFontSize(13);
  doc.setFont("Arial", "bolditalic");
  doc.setTextColor(30, 30, 30);
  doc.text("This Certifies that", pw / 2, y, { align: "center" });
  y += 10;

  // Holder name
  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.text(data.shareholderName, pw / 2, y, { align: "center" });
  const nameWidth = doc.getTextWidth(data.shareholderName);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - nameWidth / 2 - 5, y + 1.5, pw / 2 + nameWidth / 2 + 5, y + 1.5);
  y += 10;

  // Body
  doc.setFontSize(10);
  doc.setFont("Arial", "normal");
  doc.setTextColor(40, 40, 40);
  const parStr = data.parValue ? ` (Par Value: $${data.parValue.toFixed(2)} per share)` : " (No Par Value)";
  const bodyText = `is the registered holder of ${data.numShares.toLocaleString()} shares of ${data.shareClass} Stock${parStr} of ${data.companyName}, transferable only on the books of the Corporation by the holder hereof in person or by duly authorized Attorney upon surrender of this Certificate properly endorsed.`;
  const lines = doc.splitTextToSize(bodyText, pw - 80);
  doc.text(lines, pw / 2, y, { align: "center", maxWidth: pw - 80 });
  y += lines.length * 5 + 8;

  // "In Witness Whereof"
  doc.setFontSize(11);
  doc.setFont("Arial", "bolditalic");
  doc.setTextColor(30, 30, 30);
  doc.text("In Witness Whereof,", 40, y);
  doc.setFont("Arial", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const witnessText = " the said Corporation has caused this Certificate to be executed";
  doc.text(witnessText, 40 + doc.getTextWidth("In Witness Whereof, ") - 2, y);
  y += 5;
  doc.text("on its behalf by its duly authorized officer(s).", 40, y);
  y += 8;

  // Date
  doc.setFontSize(10);
  const dateStr = new Date(data.issueDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  doc.text(`this ${dateStr}`, pw / 2, y, { align: "center" });
  y += 6;

  // Signatures
  const sigY = Math.max(y + 10, ph - 42);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(40, sigY, 120, sigY);
  doc.line(pw - 120, sigY, pw - 40, sigY);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Secretary", 80, sigY + 5, { align: "center" });
  doc.text("President", pw - 80, sigY + 5, { align: "center" });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by EntityIQ — Corporate Records Management", pw / 2, ph - 12, { align: "center" });
}

export async function generateStockCertificatePdf(data: StockCertificateData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape" });
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);

  if (data.isLLC) {
    await renderLLCWhimsicalCertificate(doc, data);
  } else {
    await renderCorporationCertificate(doc, data);
  }

  return doc;
}

export async function downloadStockCertificatePdf(data: StockCertificateData) {
  const doc = await generateStockCertificatePdf(data);
  await savePdfReliably(doc, `certificate-${data.certificateNumber}.pdf`);
}
