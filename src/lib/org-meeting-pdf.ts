import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface OrgMeetingData {
  companyName: string;
  stateOfFormation: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  chairperson: string;
  secretary: string;
  taxYear: string;

  filingDate: string;
  stateAgency: string;

  registeredAgentName: string;
  registeredAgentAddress: string;

  principalOfficeAddress: string;

  einAuthorizedName: string;
  einAuthorizedTitle: string;

  managers: { name: string; title: string }[];
  members: { name: string; membershipUnits: string; membershipInterestPct: string }[];

  businessPurpose: string;

  operatingAgreementAdopted: boolean;

  fiscalYearEnd: string;
  firstFiscalYearEnd: string;
  accountingMethod: string;

  authorizedBinders: { name: string; title: string; scopeOfAuthority: string }[];

  includeScorp: boolean;
  scorpEffectiveDate: string;

  includeBanking: boolean;
  bankName: string;
  bankCity: string;
  bankSignatories: { name: string; title: string }[];

  memberSignatures: { name: string }[];
}

// Blue theme colors
const BLUE = { r: 31, g: 78, b: 121 }; // #1F4E79
const LIGHT_BLUE_BG = [214, 228, 240]; // #D6E4F0
const BODY_COLOR = [40, 40, 40];

export function generateOrgMeetingPDF(data: OrgMeetingData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 72; // 1 inch
  const contentWidth = pw - margin * 2;
  let y = margin;

  const fullName = `${data.companyName}, LLC`;
  const formattedDate = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "MMMM d, yyyy")
    : "[Date]";
  const generatedDate = format(new Date(), "MMMM d, yyyy");

  const footerText = `${fullName} — Organizational Meeting Minutes — Generated: ${generatedDate}`;

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
  function heading(text: string) {
    checkPage(60);
    y += 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(text.toUpperCase(), margin, y);
    y += 5;
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(1);
    doc.line(margin, y, pw - margin, y);
    y += 18;
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
    y += 8;
  }

  // RESOLVED: indented, "RESOLVED" in bold
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
    y += lines.length * 16 + 10;
  }

  // WHEREAS: flush left, "WHEREAS" in bold italic, remainder in italic
  function whereasPara(rest: string) {
    const indent = 0;
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
    y += lines.length * 16 + 10;
  }

  // ===== TITLE =====
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text("MINUTES OF THE ORGANIZATIONAL MEETING", pw / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(12);
  doc.text(`OF ${fullName.toUpperCase()}`, pw / 2, y, { align: "center" });
  y += 32;

  // ===== INTRO =====
  const dayOfWeek = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "EEEE")
    : "[Day]";
  para(`The organizational meeting of ${fullName}, a ${data.stateOfFormation} limited liability company, was held on ${dayOfWeek}, ${formattedDate}, at ${data.meetingTime || "[Time]"}, at ${data.meetingLocation || "[Location]"}.`);

  // Present members
  const memberNames = data.members.map(m => m.name).filter(Boolean);
  if (memberNames.length > 0) {
    para(`The following were present at the meeting:`);
    memberNames.forEach(name => {
      para(`• ${name}`, 10);
    });
  }

  para(`${data.chairperson || "[Chairperson]"} served as Chairperson and ${data.secretary || "[Secretary]"} served as Secretary of the meeting.`);

  para("The Chairperson called the meeting to order and announced that a quorum was present. The Chairperson stated the purpose of the meeting was to complete the organization of the limited liability company, adopt initial resolutions, and transact such other business as may properly come before the meeting.");
  y += 8;

  // ===== FORMATION & ORGANIZATION =====
  heading("Formation & Organization");
  whereasPara(`the Articles of Organization of ${fullName} were filed with the ${data.stateAgency || "[State Agency]"} on ${data.filingDate ? format(new Date(data.filingDate + "T12:00:00"), "MMMM d, yyyy") : "[Filing Date]"}, thereby forming the limited liability company; and`);
  whereasPara("this organizational meeting has been called for the purpose of completing the organization of the limited liability company, adopting initial resolutions, and transacting such other business as may properly come before the meeting;");
  resolvedPara(`that the filing of the Articles of Organization and the formation of the limited liability company under the laws of the State of ${data.stateOfFormation} are hereby ratified and confirmed.`);

  // ===== REGISTERED AGENT =====
  heading("Registered Agent");
  resolvedPara(`that ${data.registeredAgentName || "[Registered Agent]"}, located at ${data.registeredAgentAddress || "[Address]"}, is hereby confirmed as the registered agent of the limited liability company in the State of Wisconsin, pursuant to Wis. Stat. § 183.0113, and the proper officers are authorized to execute any documents necessary to maintain the registered agent designation.`);

  // ===== PRINCIPAL OFFICE =====
  heading("Principal Office");
  resolvedPara(`that the principal office of the limited liability company shall be located at ${data.principalOfficeAddress || "[Address]"}.`);

  // ===== EMPLOYER IDENTIFICATION NUMBER =====
  heading("Employer Identification Number");
  resolvedPara(`that ${data.einAuthorizedName || "[Name]"}, ${data.einAuthorizedTitle || "[Title]"}, is hereby authorized to apply for and obtain a federal Employer Identification Number (EIN) from the Internal Revenue Service on behalf of the limited liability company.`);

  // ===== INITIAL MANAGERS / OFFICERS =====
  heading("Initial Managers / Officers");
  resolvedPara(`that the following persons are hereby elected as the initial managers and officers of ${fullName}:`);

  if (data.managers.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Name", "Title"]],
      body: data.managers.map(m => [m.name || "[Enter]", m.title || "[Enter]"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 11, cellPadding: 6, font: "helvetica" },
      headStyles: {
        fillColor: LIGHT_BLUE_BG as [number, number, number],
        textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
        fontStyle: "bold",
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ===== INITIAL MEMBERS =====
  heading("Initial Members");
  resolvedPara(`that the following persons are the initial members of ${fullName} and hold ownership interests as set forth below:`);

  if (data.members.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Name", "Membership Units", "Membership Interest %"]],
      body: data.members.map(m => [m.name || "[Enter]", m.membershipUnits || "[Enter]", m.membershipInterestPct ? `${m.membershipInterestPct}%` : "[Enter]"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 11, cellPadding: 6, font: "helvetica" },
      headStyles: {
        fillColor: LIGHT_BLUE_BG as [number, number, number],
        textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
        fontStyle: "bold",
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ===== BUSINESS PURPOSE =====
  heading("Business Purpose");
  resolvedPara("that the limited liability company is organized for the following purpose:");
  para(data.businessPurpose || "[Business Purpose]");

  // ===== OPERATING AGREEMENT =====
  heading("Operating Agreement");
  if (data.operatingAgreementAdopted) {
    resolvedPara(`that the Operating Agreement presented to and reviewed by the members at this meeting is hereby adopted as the Operating Agreement of the limited liability company, pursuant to Wis. Stat. § 183.0105, and the Secretary is directed to insert a copy of the Operating Agreement in the company's records.`);
  } else {
    para("No Operating Agreement was adopted at this meeting. The members agreed to adopt an Operating Agreement at a future date.");
  }

  // ===== FISCAL YEAR & ACCOUNTING =====
  heading("Fiscal Year & Accounting");
  resolvedPara(`that the fiscal year of the limited liability company shall end on ${data.fiscalYearEnd || "December 31"} of each year (the first fiscal year ending ${data.firstFiscalYearEnd || "[Year]"}), and that the limited liability company shall maintain its books and records on the ${data.accountingMethod || "cash"} basis method of accounting.`);

  // ===== S CORP ELECTION (optional) =====
  if (data.includeScorp) {
    heading("S Corporation Election (IRC § 1362)");
    whereasPara("the members have considered the tax treatment of the limited liability company and determined it is in the best interests of the company to elect S Corporation status;");
    resolvedPara(`that the limited liability company hereby elects to be treated as an S Corporation under Subchapter S of the Internal Revenue Code, effective ${data.scorpEffectiveDate ? format(new Date(data.scorpEffectiveDate + "T12:00:00"), "MMMM d, yyyy") : "[Effective Date]"}, and the proper officers are authorized and directed to prepare and file IRS Form 2553 and any corresponding state forms, with all members consenting to such election.`);
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Note: IRS Form 2553 must be filed within 75 days of the effective date of election.", margin, y);
    y += 18;
  }

  // ===== BANKING RESOLUTIONS (optional) =====
  if (data.includeBanking) {
    heading("Banking Resolutions");
    resolvedPara(`that the limited liability company is hereby authorized to open and maintain a checking account at ${data.bankName || "[Bank Name]"}, ${data.bankCity || "[City, State]"}, and that the following persons are hereby authorized as signatories on said account:`);
    data.bankSignatories.forEach(s => {
      para(`• ${s.name || "[Name]"}, ${s.title || "[Title]"}`, 10);
    });
  }

  // ===== DESIGNATION OF AUTHORIZED BINDERS =====
  heading("Designation of Authorized Binders");
  whereasPara(`the members of the limited liability company desire to formally designate and record the persons who shall serve as authorized binders, consistent with Wis. Stat. § 183.0407;`);
  resolvedPara(`that the following persons are hereby designated as authorized binders of the limited liability company for the ensuing year, each authorized to act on behalf of the company in their designated capacity:`);

  if (data.authorizedBinders.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Name", "Title", "Scope of Authority"]],
      body: data.authorizedBinders.map(b => [b.name || "[Enter]", b.title || "[Enter]", b.scopeOfAuthority || "[Enter]"]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 11, cellPadding: 6, font: "helvetica" },
      headStyles: {
        fillColor: LIGHT_BLUE_BG as [number, number, number],
        textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
        fontStyle: "bold",
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ===== GENERAL AUTHORIZATION =====
  heading("General Authorization");
  resolvedPara("that the officers are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.");

  // ===== ADJOURNMENT =====
  heading("Adjournment");
  para("There being no further business, the meeting was duly adjourned.");

  // ===== SIGNATURES =====
  checkPage(120);
  heading("Signatures");
  y += 10;

  const colW = contentWidth / 2 - 10;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  
  // Chairperson
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
    checkPage(data.memberSignatures.length * 70);
    y += 10;
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
      doc.text(`Member: ${sig.name || `[Name]`}`, xPos, y + 14);
      doc.text("Date: ________________", xPos, y + 27);
      doc.text("Title: ________________", xPos, y + 40);
    });
    if (data.memberSignatures.length % 2 !== 0) {
      y += 60;
    } else {
      y += 60;
    }
  }

  addFooter(doc);

  return doc;
}
