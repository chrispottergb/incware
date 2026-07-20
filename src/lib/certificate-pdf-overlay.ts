import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  CERTIFICATE_TEMPLATES,
  CertificateKind,
  CertificateFieldSpec,
} from "./certificate-templates";

export class TemplateNotAvailableError extends Error {
  constructor(url: string, status: number) {
    super(`Certificate template not available at ${url} (HTTP ${status})`);
    this.name = "TemplateNotAvailableError";
  }
}

export interface LlcCertificateData {
  memberName: string;
  units: string;
  ownershipPct: string;
  issueDate: string;
  certNumber: string;
}

export interface CorporationCertificateData {
  shareholderName: string;
  shares: string;
  ownershipPct: string;
  authorizedShares: string;
  parValue: string;
  issueDate: string;
  certNumber: string;
}

export type CertificateData = LlcCertificateData | CorporationCertificateData;

/**
 * Overlay record data onto a static PDF template.
 * Throws TemplateNotAvailableError if the template file is missing (404),
 * so the caller can fall back to the legacy jsPDF generator.
 */
export async function generateCertificateFromTemplate(
  kind: CertificateKind,
  data: Record<string, string>,
): Promise<Uint8Array> {
  const template = CERTIFICATE_TEMPLATES[kind];
  const response = await fetch(template.pdfUrl);
  if (!response.ok) {
    throw new TemplateNotAvailableError(template.pdfUrl, response.status);
  }
  const bytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(bytes);
  const [page] = pdfDoc.getPages();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.12, 0.16, 0.22);

  for (const [key, spec] of Object.entries(template.fields) as [
    string,
    CertificateFieldSpec,
  ][]) {
    const value = data[key];
    if (!value) continue;

    const useFont = spec.bold ? fontBold : font;
    const width = useFont.widthOfTextAtSize(value, spec.size);
    let x = spec.x;
    if (spec.align === "center") x = spec.x - width / 2;
    else if (spec.align === "right") x = spec.x - width;

    page.drawText(value, {
      x,
      y: spec.y,
      size: spec.size,
      font: useFont,
      color,
    });
  }

  return pdfDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
