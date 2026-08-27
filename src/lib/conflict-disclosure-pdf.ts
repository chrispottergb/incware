import jsPDF from "jspdf";
import { registerArialFont } from "@/lib/arial-font";

const MARGIN = 31.75; // 1.25 inch binder margin
const R_MARGIN = 19.05;
const BRAND = "EntityIQ";

function pw(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function ph(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

function para(doc: jsPDF, y: number, text: string, size = 10.5): number {
  doc.setFontSize(size);
  doc.setFont("Arial", "normal");
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(text, pw(doc) - MARGIN - R_MARGIN);
  for (const line of lines) {
    doc.text(line, MARGIN, y);
    y += 5.0;
  }
  return y + 4;
}

function heading(doc: jsPDF, y: number, label: string): number {
  doc.setFontSize(11.5);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(label, MARGIN, y);
  doc.setDrawColor(214, 228, 240);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y + 1.8, pw(doc) - R_MARGIN, y + 1.8);
  return y + 9;
}

function checkbox(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.35);
  doc.rect(x, y - 3.4, 4, 4);
}

export interface DisclosureSigner {
  name: string;
  title?: string | null;
}

export interface ConflictDisclosureData {
  companyName: string;
  disclosureYear: number;
  signers: DisclosureSigner[];
  policyAdoptedDate?: string | null;
}

/**
 * Annual Conflict of Interest Disclosure packet: a cover page listing everyone
 * included, then one signature form per director/officer. The policy itself is
 * adopted once (see conflict-of-interest-pdf.ts); this packet is the recurring
 * yearly obligation under IRS Form 1023 / Wis. Stat. § 181.0831.
 */
export function generateConflictDisclosurePDF(data: ConflictDisclosureData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const cx = pw(doc) / 2;
  const { companyName, disclosureYear, signers, policyAdoptedDate } = data;
  // Avoid "Inc.." when the legal name already ends in a period.
  const nameNoDot = companyName.replace(/\.$/, "");

  // ── COVER PAGE ──
  let y = 40;
  doc.setFontSize(10);
  doc.setFont("Arial", "bold");
  doc.setTextColor(90, 90, 90);
  doc.text("ANNUAL GOVERNANCE COMPLIANCE PACKET", cx, y, { align: "center" });
  y += 14;

  doc.setFontSize(16);
  doc.setTextColor(25, 25, 30);
  doc.text("ANNUAL CONFLICT OF INTEREST", cx, y, { align: "center" });
  y += 8;
  doc.text("DISCLOSURE STATEMENTS", cx, y, { align: "center" });
  y += 14;

  doc.setFontSize(13);
  doc.setTextColor(45, 70, 100);
  doc.splitTextToSize(companyName, pw(doc) - 60).forEach((l: string) => {
    doc.text(l, cx, y, { align: "center" });
    y += 7;
  });

  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(70, 70, 70);
  y += 4;
  doc.text(`Disclosure Year: ${disclosureYear}`, cx, y, { align: "center" });
  y += 7;
  if (policyAdoptedDate) {
    doc.setFontSize(9.5);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Conflict of Interest Policy adopted ${new Date(policyAdoptedDate + "T00:00:00").toLocaleDateString()}`,
      cx, y, { align: "center" },
    );
    y += 7;
  }

  y += 8;
  y = heading(doc, y, "Statements Included in This Packet");
  doc.setFontSize(10.5);
  doc.setFont("Arial", "normal");
  doc.setTextColor(30, 30, 30);
  if (signers.length === 0) {
    doc.text("No directors or officers were selected.", MARGIN, y);
    y += 6;
  } else {
    signers.forEach((s, i) => {
      const label = s.title ? `${s.name} — ${s.title}` : s.name;
      doc.text(`${i + 1}.  ${label}`, MARGIN + 4, y);
      y += 6;
    });
  }

  y += 6;
  y = para(
    doc, y,
    `Each person listed above must complete, sign, and return the disclosure statement bearing their name. Completed statements should be retained in the organization's permanent corporate records.`,
  );

  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Prepared by ${BRAND}`, cx, ph(doc) - 16, { align: "center" });

  // ── ONE FORM PER SIGNER ──
  for (const signer of signers) {
    doc.addPage();
    y = 28;

    doc.setFontSize(12);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("ANNUAL CONFLICT OF INTEREST", cx, y, { align: "center" });
    y += 6;
    doc.text("DISCLOSURE STATEMENT", cx, y, { align: "center" });
    y += 7;
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(`${companyName} — Calendar Year ${disclosureYear}`, cx, y, { align: "center" });
    y += 14;

    doc.setFontSize(10.5);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`Name: ${signer.name}`, MARGIN, y);
    y += 6;
    doc.text(`Position / Title: ${signer.title || "_______________________"}`, MARGIN, y);
    y += 12;

    y = heading(doc, y, "Definition of a Conflict");
    y = para(
      doc, y,
      `A conflict of interest exists when a director, principal officer, or member of a committee with Board-delegated powers has, directly or indirectly through business, investment, or family, an ownership or investment interest in, or a compensation arrangement with, any entity or individual with which the Organization has or is negotiating a transaction or arrangement. Compensation includes direct and indirect remuneration as well as gifts or favors that are not insubstantial.`,
    );

    y = heading(doc, y, "Affirmations");
    y = para(doc, y, `1.  I have received a copy of the Conflict of Interest Policy of ${nameNoDot}.`);
    y = para(doc, y, `2.  I have read and understand the policy.`);
    y = para(doc, y, `3.  I agree to comply with the policy.`);
    y = para(
      doc, y,
      `4.  I understand that ${companyName} is a charitable, tax-exempt organization, and that in order to maintain its federal tax exemption it must engage primarily in activities which accomplish one or more of its tax-exempt purposes.`,
    );

    y += 2;
    y = heading(doc, y, "Disclosure");

    checkbox(doc, MARGIN, y);
    doc.setFontSize(10.5);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text("I have no conflicts of interest to disclose.", MARGIN + 7, y);
    y += 9;

    checkbox(doc, MARGIN, y);
    doc.text("I have the following interests to disclose:", MARGIN + 7, y);
    y += 8;

    for (let i = 0; i < 5; i++) {
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 7, y, pw(doc) - R_MARGIN, y);
      y += 8;
    }

    y += 10;
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 80, y);
    doc.line(pw(doc) - MARGIN - 50, y, pw(doc) - R_MARGIN, y);
    y += 4.5;
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Signature", MARGIN, y);
    doc.text("Date", pw(doc) - MARGIN - 50, y);
  }

  // Footers on every page after the cover
  const count = doc.getNumberOfPages();
  for (let i = 2; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${disclosureYear} Conflict of Interest Disclosure — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - R_MARGIN, ph(doc) - 8, { align: "right" });
  }

  return doc;
}
