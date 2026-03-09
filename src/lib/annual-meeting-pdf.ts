import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface AnnualMeetingData {
  companyName: string;
  stateOfFormation: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  chairperson: string;
  secretary: string;
  taxYear: string;
  priorMeetingDate: string;

  attendees: { name: string; title: string }[];

  // Professional Advisors
  advisors: { role: string; nameFirm: string; address: string; phoneEmail: string }[];

  // Members & Ownership
  members: { name: string; units: string; interestPct: string; address: string }[];

  // Officers/Managers
  officers: { name: string; title: string; salary: string; bonus: string }[];

  // Authorized Binders
  authorizedBinders: { name: string; title: string; scope: string; status: string }[];

  // Financial Information
  fiscalYearEnd: string;
  financialItems: { item: string; amount: string; notes: string }[];
  compensationItems: { name: string; title: string; salary: string; bonus: string; notes: string }[];
  distributions: { memberName: string; amount: string; date: string; notes: string }[];
  retainedEarnings: string;
  retainedEarningsJustification: string;

  // Banking
  includeBanking: boolean;
  bankAccounts: { institution: string; accountType: string; signatory: string; title: string }[];
  includeBankingChanges: boolean;
  bankingChanges: { changeType: string; institution: string; details: string }[];

  // Tax & Accounting
  accountingMethod: string;
  taxElections: { election: string; status: string; effectiveDate: string; notes: string }[];

  // Loans
  institutionalLoans: { lender: string; loanType: string; balance: string; rate: string; maturity: string; signatory: string }[];
  memberLoans: { lender: string; borrower: string; amount: string; rate: string; terms: string; notes: string }[];

  // Leases
  leases: { property: string; lessor: string; lessee: string; monthlyAmount: string; term: string; leaseBack: string }[];

  // Vehicles & Equipment
  vehicles: { yearMakeModel: string; vin: string; ownedLeased: string; primaryDriver: string; businessUsePct: string; notes: string }[];
  equipment: { description: string; manufacturer: string; ownedLeased: string; value: string; notes: string }[];

  // Benefits
  benefitPlans: { planType: string; provider: string; eligibility: string; contribution: string; status: string }[];
  profitSharingAmount: string;

  // Special Resolutions
  includeSpecialResolutions: boolean;
  specialResolutions: { title: string; whereas: string; resolved: string }[];

  // Registered Agent
  registeredAgentName: string;
  registeredAgentAddress: string;

  // Signatures
  memberSignatures: { name: string }[];
}

// Blue theme colors matching org meeting
const BLUE = { r: 31, g: 78, b: 121 }; // #1F4E79
const LIGHT_BLUE_BG = [214, 228, 240]; // #D6E4F0
const BODY_COLOR = [40, 40, 40];

export function generateAnnualMeetingPDF(data: AnnualMeetingData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 72;
  const contentWidth = pw - margin * 2;
  let y = margin;

  const fullName = `${data.companyName}, LLC`;
  const formattedDate = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "MMMM d, yyyy")
    : "[Date]";
  const formattedPriorDate = data.priorMeetingDate
    ? format(new Date(data.priorMeetingDate + "T12:00:00"), "MMMM d, yyyy")
    : "[Prior Meeting Date]";
  const generatedDate = format(new Date(), "MMMM d, yyyy");
  const footerText = `${fullName} — Annual Meeting Minutes — Generated: ${generatedDate}`;

  let sectionNumber = 0;

  function addFooter(pageDoc: jsPDF) {
    const totalPages = pageDoc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pageDoc.setPage(i);
      pageDoc.setFontSize(8);
      pageDoc.setFont("helvetica", "normal");
      pageDoc.setTextColor(120, 120, 120);
      pageDoc.text(footerText, pw / 2, ph - 30, { align: "center" });
      pageDoc.text(`Page ${i} of ${totalPages}`, pw - margin, ph - 30, { align: "right" });
    }
  }

  function checkPage(needed: number = 80) {
    if (y + needed > ph - 72) {
      doc.addPage();
      y = margin;
    }
  }

  // Blue text heading with blue bottom border underline
  function sectionHeading(text: string) {
    sectionNumber++;
    checkPage(50);
    y += 14;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(`${sectionNumber}. ${text.toUpperCase()}`, margin, y);
    y += 5;
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(1);
    doc.line(margin, y, pw - margin, y);
    y += 18;
  }

  // Blue text sub-heading with lighter gray bottom border
  function subHeading(text: string) {
    checkPage(30);
    y += 6;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(text, margin, y);
    y += 4;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pw - margin, y);
    y += 14;
  }

  function para(text: string, indent: number = 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BODY_COLOR as [number, number, number]);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    for (const line of lines) {
      checkPage(18);
      doc.text(line, margin + indent, y);
      y += 16;
    }
    y += 4;
  }

  // RESOLVED: indented, "RESOLVED" in bold, remainder normal
  function resolvedPara(rest: string) {
    const indent = 36;
    const prefix = "RESOLVED, ";
    doc.setFontSize(11);
    doc.setTextColor(...BODY_COLOR as [number, number, number]);
    const fullText = prefix + rest;
    const lines = doc.splitTextToSize(fullText, contentWidth - indent);
    checkPage(lines.length * 16 + 10);

    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * 16;
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        const prefixWidth = doc.getTextWidth(prefix);
        doc.text(prefix, margin + indent, lineY);
        doc.setFont("helvetica", "normal");
        const remainder = lines[0].substring(prefix.length);
        if (remainder) doc.text(remainder, margin + indent + prefixWidth, lineY);
      } else {
        doc.setFont("helvetica", "normal");
        doc.text(lines[i], margin + indent, lineY);
      }
    }
    y += lines.length * 16 + 6;
  }

  // WHEREAS: indented, "WHEREAS" in bold italic, remainder in italic
  function whereasPara(rest: string) {
    const indent = 36;
    const prefix = "WHEREAS, ";
    doc.setFontSize(11);
    doc.setTextColor(...BODY_COLOR as [number, number, number]);
    const fullText = prefix + rest;
    const lines = doc.splitTextToSize(fullText, contentWidth - indent);
    checkPage(lines.length * 16 + 10);

    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * 16;
      if (i === 0) {
        doc.setFont("helvetica", "bolditalic");
        const prefixWidth = doc.getTextWidth(prefix);
        doc.text(prefix, margin + indent, lineY);
        doc.setFont("helvetica", "italic");
        const remainder = lines[0].substring(prefix.length);
        if (remainder) doc.text(remainder, margin + indent + prefixWidth, lineY);
      } else {
        doc.setFont("helvetica", "italic");
        doc.text(lines[i], margin + indent, lineY);
      }
    }
    y += lines.length * 16 + 6;
  }

  function addTable(headers: string[], rows: string[][]) {
    if (rows.length === 0) return;
    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 5, font: "helvetica" },
      headStyles: {
        fillColor: LIGHT_BLUE_BG as [number, number, number],
        textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
        fontStyle: "bold",
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ===== TITLE =====
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text("MINUTES OF THE ANNUAL MEETING", pw / 2, y, { align: "center" });
  y += 22;
  doc.setFontSize(12);
  doc.text(`OF ${fullName.toUpperCase()}`, pw / 2, y, { align: "center" });
  y += 32;

  // ===== SECTION 1: MEETING INFORMATION =====
  sectionHeading("Meeting Information");

  const dayOfWeek = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "EEEE")
    : "[Day]";

  para(`The Annual Meeting of ${fullName}, a ${data.stateOfFormation} limited liability company, was held on ${dayOfWeek}, ${formattedDate}, at ${data.meetingTime || "[Time]"}, at ${data.meetingLocation || "[Location]"}.`);

  para(`${data.chairperson || "[Chairperson]"} served as Chairperson and ${data.secretary || "[Secretary]"} served as Secretary of the meeting.`);

  if (data.attendees.length > 0) {
    para("The following members were present at the meeting:");
    data.attendees.forEach(a => {
      para(`• ${a.name}${a.title ? `, ${a.title}` : ""}`, 10);
    });
  }

  // ===== SECTION 2: CALL TO ORDER =====
  sectionHeading("Call to Order & Approval of Prior Meeting Minutes");

  whereasPara(`the Annual Meeting of ${fullName} was duly called and noticed in accordance with the Operating Agreement;`);

  whereasPara(`the minutes of the previous Annual Meeting held on ${formattedPriorDate} have been reviewed by the members;`);

  resolvedPara(`that the meeting is hereby called to order, and the minutes of the Annual Meeting held on ${formattedPriorDate} are hereby approved and adopted as a true and accurate record of that meeting.`);

  // ===== SECTION 3: PROFESSIONAL ADVISORS =====
  sectionHeading("Professional Advisors on Record");

  resolvedPara("that the following professional advisors are hereby confirmed as the company's advisors of record for the current year:");

  if (data.advisors.length > 0) {
    addTable(
      ["Role", "Name / Firm", "Address", "Phone / Email"],
      data.advisors.map(a => [a.role || "[Enter]", a.nameFirm || "[Enter]", a.address || "[Enter]", a.phoneEmail || "[Enter]"])
    );
  }

  // ===== SECTION 4: MEMBERS, MANAGERS & OFFICERS =====
  sectionHeading("Members, Managers & Officers");

  subHeading("Current Members & Ownership");

  whereasPara(`the members of ${fullName} hold ownership interests as set forth below;`);
  resolvedPara("that the following membership interests are hereby acknowledged and confirmed for the current year:");

  if (data.members.length > 0) {
    addTable(
      ["Name", "Membership Units", "Membership Interest %", "Address"],
      data.members.map(m => [m.name || "[Enter]", m.units || "[Enter]", m.interestPct ? `${m.interestPct}%` : "[Enter]", m.address || "[Enter]"])
    );
  }

  subHeading("Re-Appointment or Election of Managers / Officers");

  resolvedPara("that the following persons are hereby re-appointed or newly elected as managers/officers of the limited liability company, to serve until the next annual meeting or until their successors are duly appointed:");

  if (data.officers.length > 0) {
    addTable(
      ["Name", "Title", "Salary", "Bonus"],
      data.officers.map(o => [o.name || "[Enter]", o.title || "[Enter]", o.salary || "[Enter]", o.bonus || "[Enter]"])
    );
  }

  // ===== SECTION 5: AUTHORIZED BINDERS =====
  sectionHeading("Authorized Binders — Confirmation or Update");

  whereasPara("the members desire to confirm or update the persons authorized to execute documents on behalf of the company, consistent with Wis. Stat. § 183.0407;");

  resolvedPara("that the following persons are hereby confirmed or newly designated as authorized binders of the limited liability company:");

  if (data.authorizedBinders.length > 0) {
    addTable(
      ["Name", "Title", "Scope of Authority", "Status (Confirmed / New / Removed)"],
      data.authorizedBinders.map(b => [b.name || "[Enter]", b.title || "[Enter]", b.scope || "[Enter]", b.status || "[Enter]"])
    );
  }

  // ===== SECTION 6: FINANCIAL INFORMATION =====
  sectionHeading("Financial Information");

  subHeading("Prior Year Financial Review");

  resolvedPara(`that the members have reviewed the financial statements for the fiscal year ended ${data.fiscalYearEnd || "December 31"}, ${data.taxYear || "[Year]"}:`);

  if (data.financialItems.length > 0) {
    addTable(
      ["Item", "Amount", "Notes"],
      data.financialItems.map(f => [f.item || "[Enter]", f.amount || "[Enter]", f.notes || ""])
    );
  }

  subHeading("Compensation & Bonuses");

  if (data.compensationItems.length > 0) {
    resolvedPara("that the following compensation and bonuses for officers and managers are hereby approved and ratified:");
    addTable(
      ["Name", "Title", "Salary", "Bonus", "Notes"],
      data.compensationItems.map(c => [c.name || "[Enter]", c.title || "[Enter]", c.salary || "[Enter]", c.bonus || "[Enter]", c.notes || ""])
    );
  }

  subHeading("Distributions");

  if (data.distributions.length > 0) {
    addTable(
      ["Member Name", "Distribution Amount", "Distribution Date", "Notes"],
      data.distributions.map(d => [d.memberName || "[Enter]", d.amount || "[Enter]", d.date || "[Enter]", d.notes || ""])
    );
  }

  subHeading("Retained Earnings");

  resolvedPara(`that the members have reviewed the current retained earnings balance of $${data.retainedEarnings || "[Amount]"} and hereby acknowledge and approve said balance.`);

  if (data.retainedEarningsJustification) {
    whereasPara(`the retained earnings balance exceeds $250,000, the members acknowledge and provide the following justification for retaining said earnings: ${data.retainedEarningsJustification}`);
  }

  // ===== SECTION 7: BANKING =====
  sectionHeading("Banking");

  if (data.includeBanking && data.bankAccounts.length > 0) {
    subHeading("Current Banking Relationships");
    resolvedPara("that the company shall continue to maintain the following account(s), and the following persons are authorized as signatories:");
    addTable(
      ["Institution", "Account Type", "Authorized Signatory", "Title"],
      data.bankAccounts.map(b => [b.institution || "[Enter]", b.accountType || "[Enter]", b.signatory || "[Enter]", b.title || "[Enter]"])
    );
  } else {
    para("No changes to banking relationships were proposed at this meeting.");
  }

  if (data.includeBankingChanges && data.bankingChanges.length > 0) {
    subHeading("Banking Changes");
    resolvedPara("that the following banking changes are hereby authorized:");
    addTable(
      ["Change Type", "Institution", "Details"],
      data.bankingChanges.map(b => [b.changeType || "[Enter]", b.institution || "[Enter]", b.details || "[Enter]"])
    );
  }

  // ===== SECTION 8: TAX & ACCOUNTING =====
  sectionHeading("Tax & Accounting");

  subHeading("Fiscal Year Confirmation");
  resolvedPara(`that the fiscal year of the limited liability company shall continue to end on ${data.fiscalYearEnd || "December 31"}, and the company shall continue to maintain its books on the ${data.accountingMethod || "cash"} basis method of accounting.`);

  if (data.taxElections.length > 0) {
    subHeading("Tax Elections — Confirmation or Changes");
    addTable(
      ["Election", "Status", "Effective Date", "Notes"],
      data.taxElections.map(t => [t.election || "[Enter]", t.status || "[Enter]", t.effectiveDate || "[Enter]", t.notes || ""])
    );
  }

  // ===== SECTION 9: LOANS =====
  sectionHeading("Loans");

  if (data.institutionalLoans.length > 0) {
    subHeading("Loans From Financial Institutions");
    addTable(
      ["Lender", "Loan Type", "Balance / Amount", "Interest Rate", "Maturity Date", "Auth. Signatory"],
      data.institutionalLoans.map(l => [l.lender || "[Enter]", l.loanType || "[Enter]", l.balance || "[Enter]", l.rate || "[Enter]", l.maturity || "[Enter]", l.signatory || "[Enter]"])
    );
  }

  if (data.memberLoans.length > 0) {
    subHeading("Member Loans");
    addTable(
      ["Lender", "Borrower", "Amount", "Interest Rate", "Terms", "Notes"],
      data.memberLoans.map(l => [l.lender || "[Enter]", l.borrower || "[Enter]", l.amount || "[Enter]", l.rate || "[Enter]", l.terms || "[Enter]", l.notes || ""])
    );
  }

  if (data.institutionalLoans.length === 0 && data.memberLoans.length === 0) {
    para("No loans were reviewed or authorized at this meeting.");
  }

  // ===== SECTION 10: LEASES =====
  sectionHeading("Leases");

  if (data.leases.length > 0) {
    addTable(
      ["Property / Asset", "Lessor", "Lessee", "Monthly Amount", "Term / Expiration", "Lease-Back? (Y/N)"],
      data.leases.map(l => [l.property || "[Enter]", l.lessor || "[Enter]", l.lessee || "[Enter]", l.monthlyAmount || "[Enter]", l.term || "[Enter]", l.leaseBack || "N"])
    );

    resolvedPara("that the above-referenced lease agreements are hereby ratified and confirmed. Any lease-back arrangements between the company and its members have been reviewed and acknowledged as being on terms consistent with fair market value.");
  } else {
    para("No leases were reviewed or authorized at this meeting.");
  }

  // ===== SECTION 11: VEHICLES & EQUIPMENT =====
  sectionHeading("Vehicles & Equipment");

  if (data.vehicles.length > 0) {
    subHeading("Company Vehicles");
    addTable(
      ["Year / Make / Model", "VIN", "Owned / Leased", "Primary Driver", "Business Use %", "Notes"],
      data.vehicles.map(v => [v.yearMakeModel || "[Enter]", v.vin || "[Enter]", v.ownedLeased || "[Enter]", v.primaryDriver || "[Enter]", v.businessUsePct || "[Enter]", v.notes || ""])
    );
  }

  if (data.equipment.length > 0) {
    subHeading("Major Equipment");
    addTable(
      ["Description", "Manufacturer", "Owned / Leased", "Value", "Notes"],
      data.equipment.map(e => [e.description || "[Enter]", e.manufacturer || "[Enter]", e.ownedLeased || "[Enter]", e.value || "[Enter]", e.notes || ""])
    );
  }

  if (data.vehicles.length === 0 && data.equipment.length === 0) {
    para("No vehicles or equipment were reviewed at this meeting.");
  }

  // ===== SECTION 12: EMPLOYEE BENEFIT PLANS =====
  sectionHeading("Employee Benefit Plans");

  if (data.benefitPlans.length > 0) {
    addTable(
      ["Plan Type", "Provider", "Eligibility", "Company Contribution", "Status (Active / New / Terminated)"],
      data.benefitPlans.map(b => [b.planType || "[Enter]", b.provider || "[Enter]", b.eligibility || "[Enter]", b.contribution || "[Enter]", b.status || "[Enter]"])
    );
  }

  if (data.profitSharingAmount) {
    subHeading("Profit Sharing");
    resolvedPara(`that the profit sharing contribution for the fiscal year ended December 31, ${data.taxYear || "[Year]"} shall be $${data.profitSharingAmount}.`);
  }

  if (data.benefitPlans.length === 0 && !data.profitSharingAmount) {
    para("No benefit plan changes were proposed at this meeting.");
  }

  // ===== SECTION 13: SPECIAL RESOLUTIONS =====
  if (data.includeSpecialResolutions && data.specialResolutions.length > 0) {
    sectionHeading("Special Resolutions");
    data.specialResolutions.forEach((r, i) => {
      subHeading(`Resolution ${i + 1} — ${r.title || "[Title]"}`);
      if (r.whereas) {
        whereasPara(r.whereas);
      }
      resolvedPara(`that ${r.resolved || "[Enter resolved clause]"}`);
    });
  }

  // ===== SECTION 14: REGISTERED AGENT CONFIRMATION =====
  sectionHeading("Registered Agent Confirmation");

  resolvedPara(`that ${data.registeredAgentName || "[Registered Agent Name]"}, located at ${data.registeredAgentAddress || "[Address, City, State, ZIP]"}, is hereby confirmed as the registered agent of the limited liability company in the State of Wisconsin, pursuant to Wis. Stat. § 183.0113.`);

  // ===== SECTION 15: GENERAL AUTHORIZATION =====
  sectionHeading("General Authorization");

  resolvedPara("that the authorized binders of the limited liability company are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.");

  // ===== ADJOURNMENT =====
  checkPage(40);
  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text("ADJOURNMENT", margin, y);
  y += 4;
  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setLineWidth(1);
  doc.line(margin, y, pw - margin, y);
  y += 18;
  para("There being no further business, the meeting was duly adjourned.");

  // ===== SECTION 16: SIGNATURES =====
  sectionHeading("Signatures");
  y += 10;

  const colW = contentWidth / 2 - 10;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);

  // Chairperson
  checkPage(80);
  doc.line(margin, y, margin + colW - 20, y);
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BODY_COLOR as [number, number, number]);
  doc.text(data.chairperson || "Chairperson", margin, y);
  doc.text("Chairperson", margin, y + 13);
  doc.text("Date: ________________", margin, y + 26);
  doc.text("Title: ________________", margin, y + 39);

  // Secretary
  const sx = margin + colW + 20;
  doc.line(sx, y - 14, sx + colW - 20, y - 14);
  doc.text(data.secretary || "Secretary", sx, y);
  doc.text("Secretary", sx, y + 13);
  doc.text("Date: ________________", sx, y + 26);
  doc.text("Title: ________________", sx, y + 39);
  y += 60;

  // Member signatures
  if (data.memberSignatures.length > 0) {
    data.memberSignatures.forEach((sig, i) => {
      checkPage(70);
      const col = i % 2;
      const xPos = col === 0 ? margin : margin + colW + 20;
      if (col === 0 && i > 0) y += 60;

      doc.setDrawColor(80, 80, 80);
      doc.line(xPos, y, xPos + colW - 20, y);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BODY_COLOR as [number, number, number]);
      doc.text(`Member: ${sig.name || "[Name]"}`, xPos, y + 14);
      doc.text("Date: ________________", xPos, y + 27);
      doc.text("Title: ________________", xPos, y + 40);
    });
    y += 60;
  }

  addFooter(doc);

  return doc;
}
