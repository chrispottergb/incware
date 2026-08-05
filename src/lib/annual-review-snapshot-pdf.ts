import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerArialFont } from "@/lib/arial-font";

const MARGIN = 31.75; // 1.25" binder margin
const R_MARGIN = 19.05; // 0.75"
const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

const val = (v: any) => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
};

const money = (v: any) => {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  if (!isFinite(n)) return String(v);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const joinAddr = (...parts: any[]) => parts.filter((p) => p && String(p).trim()).join(", ") || "—";

function addHeader(doc: jsPDF, companyName: string, reviewYear: number | string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(18);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(BRAND, MARGIN, 18);

  doc.setFontSize(8);
  doc.setFont("Arial", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, MARGIN, 24);

  doc.setFontSize(14);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Annual Review Snapshot — ${reviewYear}`, MARGIN, 36);

  doc.setFontSize(10);
  doc.setFont("Arial", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(companyName || "", MARGIN, 43);

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 47, pageWidth - R_MARGIN, 47);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${BRAND} — Confidential`, MARGIN, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - R_MARGIN, pageHeight - 8, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }
  y += 6;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(45, 55, 72);
  doc.text(title, MARGIN, y);
  return y + 4;
}

function emptyNote(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont("Arial", "italic");
  doc.setTextColor(130, 130, 130);
  doc.text(text, MARGIN, y + 5);
  return y + 12;
}

function kvTable(doc: jsPDF, rows: [string, string][], y: number): number {
  const filtered = rows.filter(([, v]) => v && v !== "—");
  if (filtered.length === 0) return emptyNote(doc, "No data on file.", y);
  autoTable(doc, {
    startY: y + 2,
    body: filtered,
    theme: "plain",
    bodyStyles: { fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold", textColor: [80, 80, 80] },
      1: { textColor: [30, 30, 30] },
    },
    margin: { left: MARGIN, right: R_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

function dataTable(doc: jsPDF, headers: string[], rows: string[][], y: number, emptyText: string): number {
  if (rows.length === 0) return emptyNote(doc, emptyText, y);
  autoTable(doc, {
    startY: y + 2,
    head: [headers],
    body: rows,
    theme: "grid",
    headStyles: {
      fillColor: [214, 228, 240],
      textColor: [30, 30, 30],
      fontSize: 9,
      fontStyle: "bold",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    bodyStyles: { fontSize: 9 },
    margin: { left: MARGIN, right: R_MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

export interface ReviewSnapshotInput {
  companyName: string;
  reviewYear: number | string;
  lastUpdated?: string | null;
  isLLC: boolean;
  isNonProfit?: boolean;
  ownerLabel: string;
  sharesLabel: string;
  edits: any;
  notes?: string;
}

export function generateAnnualReviewSnapshotPdf(input: ReviewSnapshotInput): jsPDF {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);

  const e = input.edits || {};
  const c = e.company || {};
  const ct = e.contacts || {};
  const ra = e.registeredAgent || {};
  const ac = e.accountant || {};
  const at = e.attorney || {};

  addHeader(doc, input.companyName, input.reviewYear);
  let y = 54;
  let n = 0;
  const num = (t: string) => `${++n}. ${t}`;

  y = sectionTitle(doc, num("Company Information"), y);
  y = kvTable(doc, [
    ["Company Name", val(c.name || input.companyName)],
    ["Entity Type", val(c.entity_type)],
    ["Address", joinAddr(c.address, c.address_2)],
    ["City / State / ZIP", joinAddr(c.city, c.state, c.zip)],
    ["Phone", val(c.phone)],
    ["Website", val(c.contact_webpage || c.website)],
    ["EIN", c.ein_last4 ? `**-***${c.ein_last4}` : "—"],
    ["Fiscal Year End", val(c.fiscal_year_end)],
    ["Incorporation Date", val(c.incorporation_date)],
    ["Corporate Status", val(c.corporate_status || c.status)],
    ["S-Election Date", val(c.s_election_date)],
  ], y);

  y = sectionTitle(doc, "Primary Contact", y);
  y = kvTable(doc, [
    ["Contact Name", val(ct.contact_full_name)],
    ["Email", val(ct.contact_email)],
    ["Phone", val(ct.contact_phone)],
    ["Cell", val(ct.contact_cell)],
  ], y);

  y = sectionTitle(doc, num("Registered Agent"), y);
  y = kvTable(doc, [
    ["Agent Name", val(ra.name || ra.agent_name)],
    ["Address", joinAddr(ra.address, ra.address_2)],
    ["City / State / ZIP", joinAddr(ra.city, ra.state, ra.zip)],
    ["Email", val(ra.email)],
  ], y);

  y = sectionTitle(doc, num("Accountant"), y);
  y = kvTable(doc, [
    ["Name", val(ac.name || ac.accountant_name)],
    ["Firm", val(ac.firm || ac.firm_name)],
    ["Address", joinAddr(ac.address, ac.city, ac.state, ac.zip)],
    ["Phone", val(ac.phone)],
    ["Email", val(ac.email)],
  ], y);

  y = sectionTitle(doc, num("Attorney"), y);
  y = kvTable(doc, [
    ["Name", val(at.name || at.attorney_name)],
    ["Firm", val(at.firm || at.firm_name)],
    ["Address", joinAddr(at.address, at.city, at.state, at.zip)],
    ["Phone", val(at.phone)],
    ["Email", val(at.email)],
  ], y);

  y = sectionTitle(doc, num("Banking"), y);
  y = dataTable(doc,
    ["Bank Name", "Account Type", "Branch Address", "Account #", "LOC Amount", "LOC Rate"],
    (e.banks || []).map((b: any) => [
      val(b.bank_name),
      val(b.account_type),
      joinAddr(b.address, b.city, b.state, b.zip),
      b.account_number_last4 ? `****${b.account_number_last4}` : "—",
      money(b.loc_amount),
      val(b.loc_rate),
    ]),
    y, "No bank accounts on file.");

  y = sectionTitle(doc, "Authorized Signers", y);
  y = dataTable(doc,
    ["Signer Name", "Title", "Bank"],
    (e.signers || []).map((s: any) => {
      const bank = (e.banks || []).find((b: any) => b.id && b.id === s.bank_id);
      return [val(s.signer_name), val(s.title), val(bank?.bank_name)];
    }),
    y, "No authorized signers on file.");

  y = sectionTitle(doc, num(input.ownerLabel), y);
  y = dataTable(doc,
    ["Name", `${input.sharesLabel} Held`, "Ownership %", "Address"],
    (e.shareholders || []).map((s: any) => [
      val(s.name),
      val(s.shares_held),
      s.ownership_percentage != null && String(s.ownership_percentage).trim() !== ""
        ? `${s.ownership_percentage}%`
        : "—",
      joinAddr(s.address, s.city, s.state, s.zip),
    ]),
    y, `No ${input.ownerLabel.toLowerCase()} on file.`);

  if (!input.isLLC) {
    y = sectionTitle(doc, num("Directors"), y);
    y = dataTable(doc, ["Director"], (e.directors || []).map((d: any) => [val(d.name)]), y, "No directors on file.");
  }

  y = sectionTitle(doc, num("Officers"), y);
  y = dataTable(doc,
    ["Title", "Name", "Salary", "Bonus", "Comp. Status", "Note"],
    (e.officers || []).map((o: any) => [
      val(o.title), val(o.name), money(o.salary), money(o.bonus),
      val(o.compensation_status), val(o.compensation_note),
    ]),
    y, "No officers on file.");

  y = sectionTitle(doc, num("Lease Information"), y);
  y = dataTable(doc,
    ["Property", "Landlord", "Monthly", "Start", "End", "Classification", "Improvements"],
    (e.leases || []).map((l: any) => [
      val(l.property_address),
      val(l.landlord_name),
      money(l.monthly_payment),
      val(l.lease_start_date),
      val(l.lease_end_date),
      val(l.lease_classification),
      val(l.leasehold_improvements),
    ]),
    y, "No leases on file.");

  y = sectionTitle(doc, num("Benefits"), y);
  y = dataTable(doc,
    ["Description", "Type", "Provider", "Agency", "Agent / Admin", "Contribution"],
    (e.benefits || []).map((b: any) => [
      val(b.benefit_description), val(b.benefit_type), val(b.provider),
      val(b.insurance_agency), val(b.agent_administrator), val(b.retirement_contribution),
    ]),
    y, "No benefits on file.");

  y = sectionTitle(doc, num("Vehicles & Equipment"), y);
  y = dataTable(doc,
    ["Type", "Description", "Year", "Make", "Model", "VIN", "Purchased", "Amount"],
    (e.assets || []).map((a: any) => [
      val(a.asset_type), val(a.description), val(a.year), val(a.make),
      val(a.model), val(a.vin), val(a.purchase_date), money(a.purchase_amount),
    ]),
    y, "No new vehicles or equipment added this year.");

  y = sectionTitle(doc, num("Loans"), y);
  y = dataTable(doc,
    ["Lender", "Borrower", "Amount", "Rate"],
    (e.loans || []).map((l: any) => [val(l.lender_name), val(l.borrower_name), money(l.loan_amount), val(l.loan_rate)]),
    y, "No new loans added this year.");

  y = sectionTitle(doc, "Agreements / Contributions", y);
  y = dataTable(doc,
    ["Type", "With", "Amount", "Date", "Purpose"],
    (e.contributions || []).map((x: any) => [
      val(x.agreement_type), val(x.agreement_with), money(x.amount), val(x.agreement_date), val(x.agreement_purpose),
    ]),
    y, "No new agreements or contributions added this year.");

  if (input.notes && input.notes.trim()) {
    y = sectionTitle(doc, num("Additional Notes"), y);
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    const width = doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN;
    const lines = doc.splitTextToSize(input.notes.trim(), width);
    lines.forEach((line: string) => {
      if (y > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, MARGIN, y + 5);
      y += 5;
    });
    y += 6;
  }

  if (y > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - R_MARGIN, y);
  y += 7;
  doc.setFontSize(8);
  doc.setFont("Arial", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Snapshot generated ${new Date().toLocaleDateString()}${input.lastUpdated ? ` · Records last updated ${input.lastUpdated}` : ""}.`,
    MARGIN,
    y
  );

  addFooter(doc);
  return doc;
}

export async function downloadAnnualReviewSnapshotPdf(input: ReviewSnapshotInput) {
  const doc = generateAnnualReviewSnapshotPdf(input);
  const safe = (input.companyName || "company").replace(/[^a-z0-9]+/gi, "_");
  const filename = `${safe}_Annual_Review_${input.reviewYear}.pdf`;
  // Use the shared reliable saver: a plain anchor download is silently blocked
  // inside sandboxed/embedded preview frames, so this falls back to a viewer tab.
  const { downloadPdfReliably } = await import("@/lib/pdf-save");
  await downloadPdfReliably(doc, filename);
}

