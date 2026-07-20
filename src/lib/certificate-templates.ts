// Static PDF template registry for certificate generation.
// Coordinates are pdf-lib space (origin at bottom-left, points).
// Templates are landscape US Letter (792 x 612 pt). Initial positions are
// best-guess centered values against blank placeholders and should be tuned
// once real certificate artwork is dropped into public/certificate-templates/.

export type CertificateKind = "llc" | "corporation";

export type CertificateFieldAlign = "left" | "center" | "right";

export interface CertificateFieldSpec {
  x: number;
  y: number;
  size: number;
  align?: CertificateFieldAlign;
  bold?: boolean;
}

export interface CertificateTemplateSpec {
  pdfUrl: string;
  fields: Record<string, CertificateFieldSpec>;
}

// LLC membership certificate fields.
// Data keys: memberName, units, ownershipPct, issueDate, certNumber
export const CERTIFICATE_TEMPLATES: Record<CertificateKind, CertificateTemplateSpec> = {
  llc: {
    pdfUrl: "/certificate-templates/llc.pdf",
    fields: {
      certNumber:   { x: 90,  y: 555, size: 12, align: "center" },
      units:        { x: 702, y: 555, size: 12, align: "center" },
      memberName:   { x: 396, y: 360, size: 18, align: "center", bold: true },
      ownershipPct: { x: 396, y: 320, size: 12, align: "center" },
      issueDate:    { x: 396, y: 130, size: 11, align: "center" },
    },
  },
  corporation: {
    pdfUrl: "/certificate-templates/corporation.pdf",
    fields: {
      certNumber:       { x: 90,  y: 555, size: 12, align: "center" },
      shares:           { x: 702, y: 555, size: 12, align: "center" },
      shareholderName:  { x: 396, y: 360, size: 18, align: "center", bold: true },
      ownershipPct:     { x: 396, y: 320, size: 12, align: "center" },
      authorizedShares: { x: 200, y: 200, size: 10, align: "center" },
      parValue:         { x: 592, y: 200, size: 10, align: "center" },
      issueDate:        { x: 396, y: 130, size: 11, align: "center" },
    },
  },
};

/**
 * Map a company's entity_type to the certificate template kind.
 * Returns null for entity types that don't use share/unit certificates
 * (e.g. Non-Profit), so the caller can hide the download button.
 */
export function resolveCertificateKind(entityType?: string | null): CertificateKind | null {
  const t = (entityType || "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("non") && t.includes("profit")) return null;
  if (t.includes("nonprofit")) return null;
  if (t.startsWith("llc") || t.includes("member") || t.includes("manager")) return "llc";
  if (t.includes("corporation") || t === "corp" || t.includes("s corp") || t.includes("c corp")) {
    return "corporation";
  }
  return null;
}
