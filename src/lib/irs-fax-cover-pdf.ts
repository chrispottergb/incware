import jsPDF from "jspdf";
import { savePdfReliably } from "./pdf-save";

export interface IRSFaxCoverData {
  companyName?: string;
  ein?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  pageCount?: number;
}

const IRS_FAX_NUMBERS: { state: string; faxNumber: string }[] = [
  { state: "Connecticut, Delaware, District of Columbia, Georgia, Illinois, Indiana, Kentucky, Maine, Maryland, Massachusetts, Michigan, New Hampshire, New Jersey, New York, North Carolina, Ohio, Pennsylvania, Rhode Island, South Carolina, Tennessee, Vermont, Virginia, West Virginia, Wisconsin", faxNumber: "855-887-7734" },
  { state: "Alabama, Alaska, Arizona, Arkansas, California, Colorado, Florida, Hawaii, Idaho, Iowa, Kansas, Louisiana, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Mexico, North Dakota, Oklahoma, Oregon, South Dakota, Texas, Utah, Washington, Wyoming", faxNumber: "855-214-7520" },
];

export async function generateIRSFaxCoverSheet(data: IRSFaxCoverData = {}): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 54;
  let y = margin;

  // Header
  doc.setFillColor(0xD6, 0xE4, 0xF0);
  doc.rect(margin, y, pageWidth - margin * 2, 60, "F");
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FAX COVER SHEET", pageWidth / 2, y + 25, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("IRS Form 2553 — Election by a Small Business Corporation", pageWidth / 2, y + 45, { align: "center" });
  y += 80;

  doc.setTextColor(0, 0, 0);

  // To / From box
  const labelX = margin;
  const valueX = margin + 90;
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const drawRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(value || "_______________________________", valueX, y);
    y += 18;
    doc.setDrawColor(0xCC, 0xCC, 0xCC);
    doc.line(valueX, y - 4, pageWidth - margin, y - 4);
    y += 4;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.text("TO:", labelX, y);
  y += 18;
  doc.setTextColor(0, 0, 0);
  drawRow("Recipient:", "Internal Revenue Service");
  drawRow("Department:", "Form 2553 Processing");
  drawRow("Fax Number:", "(see IRS table on page 2)");

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.text("FROM:", labelX, y);
  y += 18;
  doc.setTextColor(0, 0, 0);
  drawRow("Company:", data.companyName || "");
  drawRow("EIN:", data.ein || "");
  drawRow("Contact:", data.contactName || "");
  drawRow("Phone:", data.contactPhone || "");
  drawRow("Email:", data.contactEmail || "");
  drawRow("Date:", today);
  drawRow("Pages (incl. cover):", String(data.pageCount ?? ""));

  // Subject / Notes
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.text("SUBJECT:", labelX, y);
  y += 16;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("IRS Form 2553 — Election by a Small Business Corporation to be treated as an S Corporation.", margin, y, {
    maxWidth: pageWidth - margin * 2,
  });
  y += 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.text("MESSAGE:", labelX, y);
  y += 16;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const message =
    "Please find attached IRS Form 2553 (Election by a Small Business Corporation) for the above-named entity. " +
    "All required signatures and shareholder consents are included. Please confirm receipt and process accordingly. " +
    "If you have any questions, please contact us using the information above.";
  const lines = doc.splitTextToSize(message, pageWidth - margin * 2);
  doc.text(lines, margin, y);
  y += lines.length * 13 + 20;

  // Confidentiality
  doc.setDrawColor(0x1F, 0x4E, 0x79);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONFIDENTIALITY NOTICE:", margin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  const conf =
    "This facsimile transmission contains confidential information intended only for the named recipient. " +
    "If you have received this transmission in error, please notify the sender immediately and destroy all copies.";
  const confLines = doc.splitTextToSize(conf, pageWidth - margin * 2);
  doc.text(confLines, margin, y);

  // Page 2 — IRS fax numbers reference
  doc.addPage();
  y = margin;
  doc.setFillColor(0xD6, 0xE4, 0xF0);
  doc.rect(margin, y, pageWidth - margin * 2, 40, "F");
  doc.setTextColor(0x1F, 0x4E, 0x79);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("IRS Fax Numbers for Form 2553", pageWidth / 2, y + 25, { align: "center" });
  y += 60;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Send Form 2553 to the IRS fax number that corresponds to your principal business location. Verify the current fax number at IRS.gov before sending.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );
  y += 32;

  IRS_FAX_NUMBERS.forEach((entry) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0x1F, 0x4E, 0x79);
    doc.text(`Fax: ${entry.faxNumber}`, margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const stateLines = doc.splitTextToSize(`States: ${entry.state}`, pageWidth - margin * 2);
    doc.text(stateLines, margin, y);
    y += stateLines.length * 11 + 14;
  });

  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(0x55, 0x55, 0x55);
  doc.text(
    "Source: IRS instructions for Form 2553. For the most current fax numbers and mailing addresses, visit https://www.irs.gov/forms-pubs/about-form-2553.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  const safeName = (data.companyName || "Company").replace(/[^a-z0-9]+/gi, "_");
  await savePdfReliably(doc, `IRS_Fax_Cover_Form_2553_${safeName}.pdf`);
}
