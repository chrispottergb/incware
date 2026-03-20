import jsPDF from "jspdf";
import { registerArialFont } from "@/lib/arial-font";

interface PromissoryNoteData {
  lenderName: string;
  borrowerName: string;
  loanAmount: number | null;
  interestRate: number | null;
  loanDuration: string;
  startDate: string;
  endDate: string;
  repaymentTerms: string;
  companyName: string;
}

export function generatePromissoryNotePDF(data: PromissoryNoteData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;
  const margin = 25.4; // 1 inch for binder compatibility
  const textWidth = pw - margin * 2;

  let y = 20;

  // Title
  doc.setFontSize(16);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("PROMISSORY NOTE", cx, y, { align: "center" });
  y += 10;

  // Decorative line
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pw - margin, y);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, pw - margin, y + 1.5);
  y += 10;

  // Header info
  doc.setFontSize(10);
  doc.setFont("Arial", "normal");
  doc.setTextColor(60, 60, 60);

  const fmt = (v: number | null) =>
    v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "_______________";
  const fmtDate = (d: string) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "_______________";

  const amountStr = fmt(data.loanAmount);
  const rateStr = data.interestRate != null ? `${Number(data.interestRate).toFixed(2)}%` : "_____%";
  const startStr = fmtDate(data.startDate);
  const endStr = fmtDate(data.endDate);
  const lender = data.lenderName || "_______________";
  const borrower = data.borrowerName || "_______________";

  // Principal paragraph
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const p1 = `Principal Amount: ${amountStr}                    Date: ${startStr}`;
  doc.text(p1, margin, y);
  y += 8;

  // Promise to pay
  doc.setFont("Arial", "normal");
  const bodyText = `FOR VALUE RECEIVED, the undersigned ${borrower} ("Borrower") promises to pay to the order of ${lender} ("Lender"), the principal sum of ${amountStr}, together with interest thereon at the rate of ${rateStr} per annum.`;
  const bodyLines = doc.splitTextToSize(bodyText, textWidth);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 5 + 6;

  // Terms section
  doc.setFont("Arial", "bold");
  doc.text("TERMS AND CONDITIONS", margin, y);
  y += 6;
  doc.setFont("Arial", "normal");

  const terms = [
    `1. PRINCIPAL: The principal amount of this Note is ${amountStr}.`,
    `2. INTEREST RATE: Interest shall accrue at the rate of ${rateStr} per annum on the unpaid principal balance.`,
    `3. LOAN DURATION: ${data.loanDuration || "As specified by the parties."}`,
    `4. COMMENCEMENT DATE: This Note shall commence on ${startStr}.`,
    `5. MATURITY DATE: The entire unpaid principal balance, together with all accrued and unpaid interest, shall be due and payable on ${endStr}.`,
    `6. REPAYMENT TERMS: ${data.repaymentTerms || "Payments shall be made as agreed upon by the parties."}`,
    `7. PREPAYMENT: The Borrower may prepay this Note in whole or in part at any time without penalty.`,
    `8. DEFAULT: If the Borrower fails to make any payment when due, the entire unpaid balance shall, at the option of the Lender, become immediately due and payable.`,
    `9. GOVERNING LAW: This Note shall be governed by and construed in accordance with the laws of the State of Wisconsin.`,
    `10. WAIVER: The Borrower waives presentment, demand, protest, and notice of dishonor.`,
  ];

  terms.forEach((term) => {
    const lines = doc.splitTextToSize(term, textWidth);
    if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    doc.text(lines, margin, y);
    y += lines.length * 5 + 3;
  });

  y += 10;

  // Signature blocks
  if (y > doc.internal.pageSize.getHeight() - 80) {
    doc.addPage();
    y = 20;
  }

  doc.setFont("Arial", "bold");
  doc.text("IN WITNESS WHEREOF, the Borrower has executed this Promissory Note as of the date first written above.", margin, y);
  y += 15;

  doc.setFont("Arial", "normal");
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);

  // Borrower signature
  doc.text("BORROWER:", margin, y);
  y += 12;
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text(borrower, margin, y);
  doc.text("Date: _______________", margin + 100, y);
  y += 15;

  // Lender signature
  doc.text("LENDER:", margin, y);
  y += 12;
  doc.line(margin, y, margin + 80, y);
  y += 5;
  doc.text(lender, margin, y);
  doc.text("Date: _______________", margin + 100, y);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(margin, ph - 15, pw - margin, ph - 15);
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(`Promissory Note — ${data.companyName}`, margin, ph - 10);
    doc.text(`Page ${i} of ${pageCount}`, pw - margin, ph - 10, { align: "right" });
    doc.text("Generated by EntityIQ", margin, ph - 6);
  }

  return doc;
}
