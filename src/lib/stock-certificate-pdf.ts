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
  membershipInterest?: number | null; // percentage for LLCs
}

// Preload eagle image as base64
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
    [8, 8],
    [pw - 14, 8],
    [8, ph - 14],
    [pw - 14, ph - 14],
  ];
  doc.setFillColor(...brickRed);
  for (const [cx, cy] of corners) {
    doc.rect(cx, cy, 6, 6, "F");
  }

  // Decorative line accents along edges
  doc.setDrawColor(...brickRed);
  doc.setLineWidth(0.3);
  // Top & bottom horizontal accent lines
  doc.line(20, 18, pw - 20, 18);
  doc.line(20, ph - 18, pw - 20, ph - 18);
  // Left & right vertical accent lines
  doc.line(18, 20, 18, ph - 20);
  doc.line(pw - 18, 20, pw - 18, ph - 20);
}

export async function generateStockCertificatePdf(data: StockCertificateData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(40);
  doc.text("TEST", 20, 20);

  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const isLLC = data.isLLC || false;

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

  // Certificate Number and Units/Shares boxes (flanking the eagle area)
  doc.setFontSize(9);
  doc.setFont("Arial", "bold");
  doc.setTextColor(80, 80, 80);

  // Left box: Certificate No.
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(30, 32, 45, 12);
  doc.text("CERTIFICATE NO.", 52.5, 37, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text(`C-${String(data.certificateNumber).padStart(3, "0")}`, 52.5, 42, { align: "center" });

  // Right box: Shares/Units
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.rect(pw - 75, 32, 45, 12);
  doc.text(isLLC ? "UNITS" : "SHARES", pw - 52.5, 37, { align: "center" });
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

  // State and type info
  if (data.stateOfIncorporation) {
    doc.setFontSize(9);
    doc.setFont("Arial", "normal");
    doc.setTextColor(80, 80, 80);
    const orgWord = isLLC ? "Organized" : "Incorporated";
    doc.text(`${orgWord} under the laws of the State of ${data.stateOfIncorporation}`, pw / 2, y, { align: "center" });
    y += 6;
  }

  if (data.authorizedShares) {
    doc.setFontSize(8);
    doc.text(`Authorized ${isLLC ? "Units" : "Shares"}: ${data.authorizedShares.toLocaleString()}`, pw / 2, y, {
      align: "center",
    });
    y += 6;
  }

  // Title
  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(192, 58, 43); // brick red
  const certTitle = isLLC ? "MEMBERSHIP UNIT CERTIFICATE" : "STOCK CERTIFICATE";
  doc.text(certTitle, pw / 2, y + 2, { align: "center" });
  y += 12;

  // "This Certifies that" heading
  doc.setFontSize(13);
  doc.setFont("Arial", "bolditalic");
  doc.setTextColor(30, 30, 30);
  doc.text("This Certifies that", pw / 2, y, { align: "center" });
  y += 10;

  // Holder name with underline
  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.text(data.shareholderName, pw / 2, y, { align: "center" });
  const nameWidth = doc.getTextWidth(data.shareholderName);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(pw / 2 - nameWidth / 2 - 5, y + 1.5, pw / 2 + nameWidth / 2 + 5, y + 1.5);
  y += 10;

  // Body text - differs for LLC vs Corporation
  doc.setFontSize(10);
  doc.setFont("Arial", "normal");
  doc.setTextColor(40, 40, 40);

  let bodyText: string;
  if (isLLC) {
    const interestStr =
      data.membershipInterest != null
        ? ` representing ${data.membershipInterest.toFixed(2)}% membership interest in`
        : " of the above named";
    bodyText = `is the owner of ${data.numShares.toLocaleString()} ${data.shareClass} units${interestStr} ${data.companyName}, Limited Liability Company, transferable only on the books of the Company by the holder hereof in person or by duly authorized Attorney upon surrender of this Certificate properly endorsed. The transfer of the units in this Limited Liability Company is subject to restrictions as set forth in the Limited Liability Company Operating Agreement and the transfer of the actual ownership rights may be dependent upon the consent or approval of members in compliance with any provision provided in the Operating Agreement.`;
  } else {
    const parStr = data.parValue ? ` (Par Value: $${data.parValue.toFixed(2)} per share)` : " (No Par Value)";
    bodyText = `is the registered holder of ${data.numShares.toLocaleString()} shares of ${data.shareClass} Stock${parStr} of ${data.companyName}, transferable only on the books of the Corporation by the holder hereof in person or by duly authorized Attorney upon surrender of this Certificate properly endorsed.`;
  }

  const lines = doc.splitTextToSize(bodyText, pw - 80);
  doc.text(lines, pw / 2, y, { align: "center", maxWidth: pw - 80 });
  y += lines.length * 5 + 8;

  // "In Witness Whereof" clause
  doc.setFontSize(11);
  doc.setFont("Arial", "bolditalic");
  doc.setTextColor(30, 30, 30);
  doc.text("In Witness Whereof,", 40, y);
  doc.setFont("Arial", "normal");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const entityLabel = isLLC ? "Limited Liability Company" : "Corporation";
  const witnessText = ` the said ${entityLabel} has caused this Certificate to be executed`;
  doc.text(witnessText, 40 + doc.getTextWidth("In Witness Whereof, ") - 2, y);
  y += 5;

  const rolesText = isLLC
    ? "on its behalf by its duly authorized manager(s), member(s), officer(s), or agent(s)."
    : "on its behalf by its duly authorized officer(s).";
  doc.text(rolesText, 40, y);
  y += 8;

  // Date line
  doc.setFontSize(10);
  const dateStr = new Date(data.issueDate + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`this ${dateStr}`, pw / 2, y, { align: "center" });
  y += 6;

  // Signature lines
  const sigY = Math.max(y + 10, ph - 42);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(40, sigY, 120, sigY);
  doc.line(pw - 120, sigY, pw - 40, sigY);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);

  if (isLLC) {
    doc.text("Manager / Member", 80, sigY + 5, { align: "center" });
    doc.text("Manager / Member", pw - 80, sigY + 5, { align: "center" });
  } else {
    doc.text("Secretary", 80, sigY + 5, { align: "center" });
    doc.text("President", pw - 80, sigY + 5, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by EntityIQ — Corporate Records Management", pw / 2, ph - 12, { align: "center" });

  return doc;
}

export async function downloadStockCertificatePdf(data: StockCertificateData) {
  const doc = await generateStockCertificatePdf(data);
  await savePdfReliably(doc, `certificate-${data.certificateNumber}.pdf`);
}
