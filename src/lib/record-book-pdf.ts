import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isLLCType } from "@/lib/entity-terminology";

const DFI_HEADER = "STATE OF WISCONSIN";
const DFI_SUB = "DEPARTMENT OF FINANCIAL INSTITUTIONS";
const MARGIN = 25.4; // 1 inch for binder compatibility

function fmt(val: any): string {
  if (val == null) return "—";
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function getPageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}
function getPageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function checkBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > getPageHeight(doc) - 25) {
    doc.addPage();
    return 20;
  }
  return y;
}

function addSectionTitle(doc: jsPDF, y: number, num: number, title: string): number {
  y = checkBreak(doc, y, 20);
  const pw = getPageWidth(doc);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`${num}. ${title.toUpperCase()}`, MARGIN, y);
  doc.setDrawColor(45, 55, 72);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 2, pw - MARGIN, y + 2);
  return y + 8;
}

function addSubSection(doc: jsPDF, y: number, title: string): number {
  y = checkBreak(doc, y, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  doc.text(title, MARGIN, y);
  return y + 5;
}

function addLabelValue(doc: jsPDF, y: number, label: string, value: string, x = MARGIN): number {
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(value || "—", x + doc.getTextWidth(`${label}: `) + 2, y);
  return y + 5;
}

function addNarrative(doc: jsPDF, y: number, text: string): number {
  if (!text) return y;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  const pw = getPageWidth(doc);
  const lines = doc.splitTextToSize(text, pw - MARGIN * 2);
  for (const line of lines) {
    y = checkBreak(doc, y, 5);
    doc.text(line, MARGIN, y);
    y += 4;
  }
  return y + 2;
}

function addTableSafe(doc: jsPDF, y: number, head: string[], body: string[][]): number {
  if (body.length === 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records.", MARGIN, y + 4);
    return y + 10;
  }
  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    theme: "grid",
    headStyles: { fillColor: [45, 55, 72], fontSize: 7, fontStyle: "bold" },
    bodyStyles: { fontSize: 7 },
    margin: { left: MARGIN, right: MARGIN },
    styles: { overflow: "linebreak", cellWidth: "auto" },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

export interface RecordBookData {
  companyData: any;
  aiContent: {
    executiveSummary?: string;
    complianceNarrative?: string;
    sectionIntros?: Record<string, string>;
  } | null;
}

export function generateRecordBookPDF(data: RecordBookData): jsPDF {
  const doc = new jsPDF();
  const { companyData, aiContent } = data;
  const company = companyData.company;
  const isLLC = isLLCType(company.entity_type);
  const pw = getPageWidth(doc);
  const cx = pw / 2;
  const intros = aiContent?.sectionIntros || {};

  // ── COVER PAGE ──
  doc.setFillColor(25, 25, 30);
  doc.rect(0, 0, pw, getPageHeight(doc), "F");

  // DFI header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 200, 200);
  doc.text(DFI_HEADER, cx, 40, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 160);
  doc.text(DFI_SUB, cx, 46, { align: "center" });

  // Lines
  doc.setDrawColor(180, 60, 40);
  doc.setLineWidth(1.5);
  doc.line(40, 55, pw - 40, 55);
  doc.setLineWidth(0.3);
  doc.line(40, 57, pw - 40, 57);

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CORPORATE RECORD BOOK", cx, 80, { align: "center" });

  // Company name
  doc.setFontSize(16);
  doc.setTextColor(200, 140, 100);
  const nameLines = doc.splitTextToSize(company.name, pw - 60);
  let coverY = 95;
  nameLines.forEach((l: string) => {
    doc.text(l, cx, coverY, { align: "center" });
    coverY += 8;
  });

  // Entity info
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text(company.entity_type || "Corporation", cx, coverY + 5, { align: "center" });
  if (company.state_of_incorporation) {
    doc.text(`State of ${isLLC ? "Organization" : "Incorporation"}: ${company.state_of_incorporation}`, cx, coverY + 12, { align: "center" });
  }

  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, cx, coverY + 25, { align: "center" });
  doc.text("Prepared by EntityIQ", cx, coverY + 31, { align: "center" });

  // Confidential
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("CONFIDENTIAL — FOR AUTHORIZED USE ONLY", cx, getPageHeight(doc) - 20, { align: "center" });

  // ── TABLE OF CONTENTS ──
  doc.addPage();
  let y = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("TABLE OF CONTENTS", cx, y, { align: "center" });
  y += 10;

  const sections = [
    "Executive Summary",
    `Articles of ${isLLC ? "Organization" : "Incorporation"}`,
    isLLC ? "Authorized Binders & Members" : "Officers & Directors",
    isLLC ? "Members Registry" : "Shareholders Registry",
    isLLC ? "Membership Interest Certificates" : "Stock Certificates",
    isLLC ? "Interest Ledger" : "Stock Ledger",
    "Meeting Minutes",
    isLLC ? "Interest Transfers" : "Bills of Sale",
    "Business Sales",
    "Company Assets",
    "Compliance Narrative",
    "AI Compliance (EU AI Act)",
    "Corporate Timeline",
    "Document Registry",
  ];

  sections.forEach((s, i) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(`${i + 1}.  ${s}`, MARGIN + 5, y);
    y += 6;
  });

  // ── SECTION 1: EXECUTIVE SUMMARY ──
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 1, "Executive Summary");
  y = addNarrative(doc, y, aiContent?.executiveSummary || "AI-generated executive summary will appear here when available.");

  // ── SECTION 2: ARTICLES ──
  y += 4;
  y = addSectionTitle(doc, y, 2, `Articles of ${isLLC ? "Organization" : "Incorporation"}`);
  const introKey = isLLC ? "Articles of Organization" : "Articles of Incorporation";
  if (intros[introKey]) y = addNarrative(doc, y, intros[introKey]);

  y = addLabelValue(doc, y, "Entity Name", company.name);
  y = addLabelValue(doc, y, "Entity Type", company.entity_type);
  y = addLabelValue(doc, y, "State", company.state_of_incorporation || "—");
  y = addLabelValue(doc, y, isLLC ? "Organization Date" : "Incorporation Date", company.incorporation_date ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString() : "—");
  y = addLabelValue(doc, y, "Filing Date", company.filing_date ? new Date(company.filing_date + "T00:00:00").toLocaleDateString() : "—");
  y = addLabelValue(doc, y, "Business Purpose", company.business_purpose || "—");
  y = addLabelValue(doc, y, "Fiscal Year End", company.fiscal_year_end || "—");
  y = addLabelValue(doc, y, "Accounting Method", company.accounting_method || "—");
  if (!isLLC) {
    y = addLabelValue(doc, y, "Authorized Shares", company.authorized_shares ? company.authorized_shares.toLocaleString() : "—");
    y = addLabelValue(doc, y, "Par Value", company.par_value != null ? `$${company.par_value}` : "—");
  }
  if (company.s_election_date) {
    y = addLabelValue(doc, y, isLLC ? "S Election Effective Date" : "S-Election Date", new Date(company.s_election_date + "T00:00:00").toLocaleDateString());
  }
  y = addLabelValue(doc, y, "Registered Agent", company.registered_agent_name || "—");
  const raAddr = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ");
  if (raAddr) y = addLabelValue(doc, y, "Agent Address", raAddr);
  if (company.additional_provisions) {
    y += 2;
    y = addSubSection(doc, y, "Additional Provisions");
    y = addNarrative(doc, y, company.additional_provisions);
  }

  // ── SECTION 3: OFFICERS & DIRECTORS ──
  doc.addPage();
  y = 20;
  const sec3Title = isLLC ? "Authorized Binders & Members" : "Officers & Directors";
  y = addSectionTitle(doc, y, 3, sec3Title);
  if (intros[sec3Title]) y = addNarrative(doc, y, intros[sec3Title]);

  // Officers
  y = addSubSection(doc, y, "Officers");
  const officers = companyData.officers;
  if (officers.length > 0) {
    const officerRows = officers.map((o: any) => [
      o.president || "—", o.vice_president || "—", o.secretary || "—", o.treasurer || "—",
    ]);
    y = addTableSafe(doc, y, ["President", "Vice President", "Secretary", "Treasurer"], officerRows);
  } else {
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
    doc.text("No officers on record.", MARGIN, y); y += 6;
  }

  // Directors
  y = addSubSection(doc, y, isLLC ? "Authorized Binders" : "Directors");
  const directors = companyData.directors;
  y = addTableSafe(doc, y,
    ["Name", "Address", "City", "State", "Added"],
    directors.map((d: any) => [
      d.name, d.address || "—", d.city || "—", d.state || "—",
      d.added_date ? new Date(d.added_date + "T00:00:00").toLocaleDateString() : "—",
    ])
  );

  // ── SECTION 4: SHAREHOLDERS / MEMBERS REGISTRY ──
  doc.addPage();
  y = 20;
  const sec4Title = isLLC ? "Members Registry" : "Shareholders Registry";
  y = addSectionTitle(doc, y, 4, sec4Title);
  if (intros[sec4Title]) y = addNarrative(doc, y, intros[sec4Title]);

  const shareholders = companyData.shareholders;
  y = addTableSafe(doc, y,
    [isLLC ? "Member" : "Shareholder", "Address", "City", "State", "SSN/EIN", "Status", "Date Added"],
    shareholders.map((s: any) => [
      s.name, s.address || "—", s.city || "—", s.state || "—",
      s.ssn_ein ? `***-**-${s.ssn_ein.slice(-4)}` : "—",
      s.status || "—",
      s.date_added ? new Date(s.date_added + "T00:00:00").toLocaleDateString() : "—",
    ])
  );

  // ── SECTION 5: CERTIFICATES ──
  doc.addPage();
  y = 20;
  const sec5Title = isLLC ? "Membership Interest Certificates" : "Stock Certificates";
  y = addSectionTitle(doc, y, 5, sec5Title);
  if (intros[sec5Title]) y = addNarrative(doc, y, intros[sec5Title]);

  const certs = companyData.certificates;
  y = addTableSafe(doc, y,
    ["Cert #", isLLC ? "Member" : "Shareholder", isLLC ? "Interest Type" : "Class", isLLC ? "Units" : "Shares", "Par Value", "Issue Date", "Status"],
    certs.map((c: any) => [
      `#${c.certificate_number}`,
      c.shareholders?.name || "—",
      c.share_class,
      c.num_shares.toLocaleString(),
      c.par_value != null ? `$${c.par_value}` : "—",
      c.issue_date ? new Date(c.issue_date + "T00:00:00").toLocaleDateString() : "—",
      c.status || "—",
    ])
  );

  // ── SECTION 6: LEDGER ──
  doc.addPage();
  y = 20;
  const sec6Title = isLLC ? "Interest Ledger" : "Stock Ledger";
  y = addSectionTitle(doc, y, 6, sec6Title);
  if (intros[sec6Title]) y = addNarrative(doc, y, intros[sec6Title]);

  const txns = companyData.transactions;
  y = addTableSafe(doc, y,
    ["Date", "Type", isLLC ? "Member" : "Shareholder", isLLC ? "Units" : "Shares", isLLC ? "Interest Type" : "Class", "Price/Unit", "Total", "From", "To"],
    txns.map((t: any) => [
      new Date(t.transaction_date + "T00:00:00").toLocaleDateString(),
      t.transaction_type,
      t.shareholders?.name || "—",
      t.num_shares.toLocaleString(),
      t.share_class,
      t.price_per_share != null ? `$${t.price_per_share}` : "—",
      fmt(t.total_consideration),
      t.from_shareholder || "—",
      t.to_shareholder || "—",
    ])
  );

  // ── SECTION 7: MEETING MINUTES ──
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 7, "Meeting Minutes");
  if (intros["Meeting Minutes"]) y = addNarrative(doc, y, intros["Meeting Minutes"]);

  const meetings = companyData.meetings;
  const subData = companyData.meetingSubData || {};

  if (meetings.length === 0) {
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
    doc.text("No meetings on record.", MARGIN, y); y += 8;
  }

  meetings.forEach((m: any) => {
    y = checkBreak(doc, y, 30);
    y = addSubSection(doc, y, `${m.meeting_type}${m.sub_type ? ` — ${m.sub_type}` : ""} (${new Date(m.meeting_date + "T00:00:00").toLocaleDateString()})`);
    y = addLabelValue(doc, y, "Chairperson", m.chairperson || "—");
    y = addLabelValue(doc, y, "Secretary", m.mtg_secretary || "—");
    if (m.tax_year) y = addLabelValue(doc, y, "Tax Year", String(m.tax_year));

    // Resolutions for this meeting
    const mResolutions = (subData.resolutions || []).filter((r: any) => r.meeting_id === m.id);
    if (mResolutions.length > 0) {
      y = checkBreak(doc, y, 15);
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(60, 60, 60);
      doc.text("Resolutions:", MARGIN + 2, y); y += 4;
      mResolutions.forEach((r: any) => {
        y = checkBreak(doc, y, 10);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
        doc.text(`• ${r.purpose}`, MARGIN + 4, y); y += 3.5;
        doc.setFont("helvetica", "normal");
        const rLines = doc.splitTextToSize(r.resolution_text, pw - MARGIN * 2 - 10);
        rLines.forEach((l: string) => {
          y = checkBreak(doc, y, 4);
          doc.text(l, MARGIN + 6, y); y += 3.5;
        });
        y += 1;
      });
    }
    y += 4;
  });

  // ── SECTION 8: BILLS OF SALE ──
  doc.addPage();
  y = 20;
  const sec8Title = isLLC ? "Interest Transfers" : "Bills of Sale";
  y = addSectionTitle(doc, y, 8, sec8Title);
  if (intros[sec8Title]) y = addNarrative(doc, y, intros[sec8Title]);

  const bills = companyData.bills;
  y = addTableSafe(doc, y,
    ["Date", "Seller", "Buyer", isLLC ? "Interest Type" : "Class", isLLC ? "Units" : "Shares", "Price/Unit", "Total"],
    bills.map((b: any) => [
      new Date(b.sale_date + "T00:00:00").toLocaleDateString(),
      b.seller_name, b.buyer_name, b.share_class,
      b.num_shares.toLocaleString(),
      b.price_per_share != null ? `$${b.price_per_share}` : "—",
      fmt(b.total_price),
    ])
  );

  // ── SECTION 9: BUSINESS SALES ──
  y += 4;
  y = addSectionTitle(doc, y, 9, "Business Sales");
  if (intros["Business Sales"]) y = addNarrative(doc, y, intros["Business Sales"]);

  const bSales = companyData.businessSales;
  y = addTableSafe(doc, y,
    ["Date", "Type", "Seller", "Buyer", "Total", "Status", "Statute"],
    bSales.map((s: any) => [
      new Date(s.sale_date + "T00:00:00").toLocaleDateString(),
      s.sale_type, s.seller_name, s.buyer_name,
      fmt(s.total_price), s.status, s.statute_reference || "—",
    ])
  );

  // ── SECTION 10: COMPANY ASSETS ──
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 10, "Company Assets");
  const assets = companyData.assets;
  y = addTableSafe(doc, y,
    ["Type", "Description", "Value", "Cost", "Ownership"],
    assets.map((a: any) => [
      a.asset_type, a.description,
      a.value != null ? fmt(a.value) : "—",
      a.cost != null ? fmt(a.cost) : "—",
      a.ownership_type || "—",
    ])
  );

  // ── SECTION 11: COMPLIANCE NARRATIVE ──
  y += 4;
  y = addSectionTitle(doc, y, 11, "Compliance Narrative");
  y = addNarrative(doc, y, aiContent?.complianceNarrative || "AI-generated compliance analysis will appear here when available.");

  // ── SECTION 12: AI COMPLIANCE ──
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 12, "AI Compliance (EU AI Act)");
  if (intros["AI Compliance (EU AI Act)"]) y = addNarrative(doc, y, intros["AI Compliance (EU AI Act)"]);

  const aiSystems = companyData.aiSystems;
  if (aiSystems.length > 0) {
    y = addSubSection(doc, y, "AI Systems Registry");
    y = addTableSafe(doc, y,
      ["System", "Provider", "Risk Level", "Status", "Purpose"],
      aiSystems.map((s: any) => [s.system_name, s.provider || "—", s.risk_level, s.status, s.purpose || "—"])
    );

    // Oversight
    const oversight = companyData.oversightPersons;
    if (oversight.length > 0) {
      y = addSubSection(doc, y, "Human Oversight Assignments");
      y = addTableSafe(doc, y,
        ["Person", "Title", "Competence", "Authority Scope", "Status"],
        oversight.map((p: any) => [p.person_name, p.title || "—", p.competence_description || "—", p.authority_scope || "—", p.status])
      );
    }

    // Incidents
    const incidents = companyData.aiIncidents;
    if (incidents.length > 0) {
      y = addSubSection(doc, y, "Risk Incidents");
      y = addTableSafe(doc, y,
        ["Date", "Severity", "Status", "Description"],
        incidents.map((i: any) => [
          new Date(i.incident_date + "T00:00:00").toLocaleDateString(),
          i.severity, i.status, i.description || "—",
        ])
      );
    }
  } else {
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(130, 130, 130);
    doc.text("No AI systems registered.", MARGIN, y); y += 8;
  }

  // ── SECTION 13: CORPORATE TIMELINE ──
  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, y, 13, "Corporate Timeline");
  if (intros["Corporate Timeline"]) y = addNarrative(doc, y, intros["Corporate Timeline"]);

  const timeline = companyData.timeline;
  y = addTableSafe(doc, y,
    ["Date", "Event Type", "Title", "Description"],
    timeline.map((t: any) => [
      new Date(t.event_date + "T00:00:00").toLocaleDateString(),
      t.event_type, t.title, t.description || "—",
    ])
  );

  // ── SECTION 14: DOCUMENT REGISTRY ──
  y += 4;
  y = addSectionTitle(doc, y, 14, "Document Registry");
  if (intros["Document Registry"]) y = addNarrative(doc, y, intros["Document Registry"]);

  const docs = companyData.documents;
  y = addTableSafe(doc, y,
    ["Title", "Category", "Type", "Status", "Statute", "Date"],
    docs.map((d: any) => [
      d.title, d.document_category, d.document_type, d.status,
      d.statute_reference || "—",
      new Date(d.created_at).toLocaleDateString(),
    ])
  );

  // ── FOOTER ON ALL PAGES ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = getPageHeight(doc);
    const ppw = getPageWidth(doc);

    if (i === 1) continue; // Skip cover page

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ph - 18, ppw - MARGIN, ph - 18);

    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text(`${company.name} — Corporate Record Book`, MARGIN, ph - 13);
    doc.text(`Page ${i - 1} of ${pageCount - 1}`, ppw - MARGIN, ph - 13, { align: "right" });
    doc.text("Generated by EntityIQ", MARGIN, ph - 9);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, ppw - MARGIN, ph - 9, { align: "right" });
  }

  return doc;
}

export function downloadRecordBookPDF(doc: jsPDF, companyName: string) {
  const safeName = companyName.replace(/[^a-zA-Z0-9]/g, "_");
  doc.save(`${safeName}_Record_Book_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function getRecordBookBlob(doc: jsPDF): Blob {
  return doc.output("blob");
}

export function getRecordBookPreviewUrl(doc: jsPDF): string {
  return URL.createObjectURL(doc.output("blob"));
}
