import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "EntityIQ";
const BRAND_SUB = "Corporate Records Management";

function addHeader(doc: jsPDF, companyName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(BRAND, 14, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(BRAND_SUB, 14, 24);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Annual Update Review", 14, 36);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(companyName, 14, 43);

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 18, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, 47, pageWidth - 14, 47);
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`${BRAND} — Confidential`, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }
}

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 55, 72);
  doc.text(title, 14, y);
  return y + 2;
}

function addKeyValueTable(doc: jsPDF, rows: [string, string][], y: number): number {
  if (rows.length === 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No data on file.", 14, y + 6);
    return y + 14;
  }
  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "plain",
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold", textColor: [80, 80, 80] },
      1: { textColor: [30, 30, 30] },
    },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

function addDataTable(doc: jsPDF, headers: string[], rows: string[][], y: number): number {
  if (rows.length === 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records on file.", 14, y + 6);
    return y + 14;
  }
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows,
    theme: "grid",
    headStyles: { fillColor: [45, 55, 72], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 8;
}

export interface AnnualUpdateData {
  company: any;
  officers: any;
  directors: any[];
  shareholders: any[];
  attorneyFirms: any[];
  attorneys: any[];
  accountantFirms: any[];
  accountants: any[];
  banks: any[];
  registeredAgent: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
}

export function generateAnnualUpdatePdf(data: AnnualUpdateData): jsPDF {
  const doc = new jsPDF();
  const c = data.company;

  addHeader(doc, c.name);

  let y = 54;

  // --- Section 1: Company Information ---
  y = addSectionTitle(doc, "1. Company Information", y);
  y = addKeyValueTable(doc, [
    ["Company Name", c.name || "—"],
    ["Entity Type", c.entity_type || "—"],
    ["State of Incorporation", c.state_of_incorporation || "—"],
    ["Incorporation Date", c.incorporation_date ? new Date(c.incorporation_date + "T00:00:00").toLocaleDateString() : "—"],
    ["Address", [c.address, c.address_2].filter(Boolean).join(", ") || "—"],
    ["City / State / Zip", [c.city, c.state, c.zip].filter(Boolean).join(", ") || "—"],
    ["Phone", c.phone || "—"],
    ["Fiscal Year End", c.fiscal_year_end || "—"],
    ["NAICS Code", c.naics_code || "—"],
    ["Business Purpose", c.business_purpose || "—"],
    ["Status", c.corporate_status || c.status || "—"],
    ["S-Election Date", c.s_election_date ? new Date(c.s_election_date + "T00:00:00").toLocaleDateString() : "—"],
    ["Accounting Method", c.accounting_method || "—"],
  ], y);

  // --- Section 1b: Primary Contact ---
  y = addSectionTitle(doc, "Primary Contact", y);
  y = addKeyValueTable(doc, [
    ["Full Name", c.contact_full_name || "—"],
    ["Salutation", c.salutation_name || "—"],
    ["Email", c.contact_email || "—"],
    ["Main Phone", c.contact_phone || "—"],
    ["Cell Phone", c.contact_cell || "—"],
    ["Webpage", c.contact_webpage || "—"],
  ], y);

  // --- Section 2: Registered Agent ---
  y = addSectionTitle(doc, "2. Registered Agent", y);
  const ra = data.registeredAgent;
  y = addKeyValueTable(doc, [
    ["Agent Name", ra.name || "—"],
    ["Address", ra.address || "—"],
    ["City / State / Zip", [ra.city, ra.state, ra.zip].filter(Boolean).join(", ") || "—"],
  ], y);

  // --- Section 3: Officers ---
  y = addSectionTitle(doc, "3. Officers", y);
  const off = data.officers;
  if (off) {
    y = addKeyValueTable(doc, [
      ["President", off.president || "—"],
      ["Vice President", off.vice_president || "—"],
      ["Secretary", off.secretary || "—"],
      ["Treasurer", off.treasurer || "—"],
    ], y);
  } else {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No officers on file.", 14, y + 6);
    y += 14;
  }

  // --- Section 4: Directors ---
  y = addSectionTitle(doc, "4. Directors", y);
  y = addDataTable(doc,
    ["Name", "Address", "City", "State", "Zip", "Date Added"],
    data.directors.map(d => [
      d.name || "—",
      [d.address, d.address_2].filter(Boolean).join(", ") || "—",
      d.city || "—",
      d.state || "—",
      d.zip || "—",
      d.added_date ? new Date(d.added_date + "T00:00:00").toLocaleDateString() : "—",
    ]),
    y,
  );

  // --- Section 5: Shareholders ---
  y = addSectionTitle(doc, "5. Shareholders / Members", y);
  y = addDataTable(doc,
    ["Name", "Ownership %", "Status", "Address"],
    data.shareholders.filter(s => !s.is_treasury).map(s => [
      s.name || "—",
      s.ownership_percentage != null ? `${s.ownership_percentage}%` : "—",
      s.status || "—",
      [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ") || "—",
    ]),
    y,
  );

  // --- Section 6: Legal Counsel ---
  y = addSectionTitle(doc, "6. Legal Counsel", y);
  if (data.attorneyFirms.length > 0) {
    y = addDataTable(doc,
      ["Firm Name", "Address", "Phone", "Email"],
      data.attorneyFirms.map(f => [
        f.firm_name || "—",
        [f.address, f.city, f.state, f.zip].filter(Boolean).join(", ") || "—",
        f.phone || "—",
        f.email || "—",
      ]),
      y,
    );
  }
  if (data.attorneys.length > 0) {
    y = addDataTable(doc,
      ["Attorney Name", "Title", "Bar #", "Phone", "Email"],
      data.attorneys.map(a => [
        a.attorney_name || "—",
        a.title || "—",
        a.bar_number || "—",
        a.phone || "—",
        a.email || "—",
      ]),
      y,
    );
  }
  if (data.attorneyFirms.length === 0 && data.attorneys.length === 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No legal counsel on file.", 14, y + 6);
    y += 14;
  }

  // --- Section 7: Accounting ---
  y = addSectionTitle(doc, "7. Accounting", y);
  if (data.accountantFirms.length > 0) {
    y = addDataTable(doc,
      ["Firm Name", "Address", "Phone", "Email"],
      data.accountantFirms.map(f => [
        f.firm_name || "—",
        [f.address, f.city, f.state, f.zip].filter(Boolean).join(", ") || "—",
        f.phone || "—",
        f.email || "—",
      ]),
      y,
    );
  }
  if (data.accountants.length > 0) {
    y = addDataTable(doc,
      ["Accountant Name", "Title", "CPA #", "Phone", "Email"],
      data.accountants.map(a => [
        a.accountant_name || "—",
        a.title || "—",
        a.cpa_number || "—",
        a.phone || "—",
        a.email || "—",
      ]),
      y,
    );
  }
  if (data.accountantFirms.length === 0 && data.accountants.length === 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No accounting records on file.", 14, y + 6);
    y += 14;
  }

  // --- Section 8: Banking ---
  y = addSectionTitle(doc, "8. Banking", y);
  y = addDataTable(doc,
    ["Bank Name", "Account Type", "Address", "Contact"],
    data.banks.map(b => [
      b.bank_name || "—",
      b.account_type || "—",
      [b.address, b.city, b.state, b.zip].filter(Boolean).join(", ") || "—",
      b.contact_name || "—",
    ]),
    y,
  );

  // --- Review Notice ---
  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 20;
  }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, doc.internal.pageSize.getWidth() - 14, y);
  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text("Please review all sections above and report any changes or corrections to your service provider.", 14, y);

  addFooter(doc);
  return doc;
}

export function downloadAnnualUpdatePdf(data: AnnualUpdateData) {
  const doc = generateAnnualUpdatePdf(data);
  const filename = `annual-update-${data.company.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  doc.save(filename);
  return doc;
}
