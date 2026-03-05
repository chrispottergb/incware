import jsPDF from "jspdf";
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
  members: { name: string; commonShares: string; preferredShares: string; distributionPct: string }[];

  businessPurpose: string;

  operatingAgreementAdopted: boolean;

  fiscalYearEnd: string;
  firstFiscalYearEnd: string;
  accountingMethod: string;

  includeScorp: boolean;
  scorpEffectiveDate: string;

  includeBanking: boolean;
  bankName: string;
  bankCity: string;
  bankSignatories: { name: string; title: string }[];

  memberSignatures: { name: string }[];
}

export function generateOrgMeetingPDF(data: OrgMeetingData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentWidth = pw - margin * 2;
  let y = margin;

  const fullName = `${data.companyName}, LLC`;
  const formattedDate = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "MMMM d, yyyy")
    : "[Date]";

  const footerText = `${fullName} — Organizational Meeting Minutes — ${formattedDate}`;

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

  function checkPage(needed: number = 60) {
    if (y + needed > ph - 60) {
      doc.addPage();
      y = margin;
    }
  }

  function heading(text: string) {
    checkPage(50);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(text.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pw - margin, y);
    y += 16;
  }

  function para(text: string, indent: number = 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPage(lines.length * 13 + 6);
    doc.text(lines, margin + indent, y);
    y += lines.length * 13 + 6;
  }

  function boldPara(prefix: string, rest: string) {
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const fullText = prefix + rest;
    const lines = doc.splitTextToSize(fullText, contentWidth);
    checkPage(lines.length * 13 + 6);

    // Render first occurrence of prefix in bold, rest normal
    for (let i = 0; i < lines.length; i++) {
      const lineY = y + i * 13;
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        const prefixWidth = doc.getTextWidth(prefix);
        doc.text(prefix, margin, lineY);
        doc.setFont("helvetica", "normal");
        const remainder = lines[0].substring(prefix.length);
        if (remainder) doc.text(remainder, margin + prefixWidth, lineY);
      } else {
        doc.setFont("helvetica", "normal");
        doc.text(lines[i], margin, lineY);
      }
    }
    y += lines.length * 13 + 6;
  }

  // ===== TITLE =====
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("MINUTES OF THE ORGANIZATIONAL MEETING", pw / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(12);
  doc.text(`OF ${fullName.toUpperCase()}`, pw / 2, y, { align: "center" });
  y += 24;

  // ===== INTRO =====
  const dayOfWeek = data.meetingDate
    ? format(new Date(data.meetingDate + "T12:00:00"), "EEEE")
    : "[Day]";
  const introText = `The organizational meeting of ${fullName}, a ${data.stateOfFormation} limited liability company, was held on ${dayOfWeek}, ${formattedDate}, at ${data.meetingTime || "[Time]"}, at ${data.meetingLocation || "[Location]"}.`;
  para(introText);

  para(`${data.chairperson || "[Chairperson]"} served as Chairperson and ${data.secretary || "[Secretary]"} served as Secretary of the meeting.`);

  // Present members
  if (data.members.length > 0) {
    const memberNames = data.members.map(m => m.name).filter(Boolean);
    if (memberNames.length > 0) {
      para(`The following members were present at the meeting: ${memberNames.join(", ")}.`);
    }
  }

  para("The Chairperson called the meeting to order and announced that a quorum was present. The Chairperson stated the purpose of the meeting was to complete the organization of the limited liability company, adopt initial resolutions, and transact such other business as may properly come before the meeting.");
  y += 4;

  // ===== FORMATION & ORGANIZATION =====
  heading("Formation & Organization");
  boldPara("WHEREAS, ", `the Articles of Organization of ${fullName} were filed with the ${data.stateAgency || "WI Department of Financial Institutions"} on ${data.filingDate ? format(new Date(data.filingDate + "T12:00:00"), "MMMM d, yyyy") : "[Filing Date]"}, thereby forming the limited liability company; and`);
  boldPara("WHEREAS, ", "this organizational meeting has been called for the purpose of completing the organization of the limited liability company, adopting initial resolutions, and transacting such other business as may properly come before the meeting;");
  boldPara("RESOLVED, ", `that the filing of the Articles of Organization and the formation of the limited liability company under the laws of the State of ${data.stateOfFormation} are hereby ratified and confirmed.`);

  // ===== REGISTERED AGENT =====
  heading("Registered Agent");
  boldPara("RESOLVED, ", `that ${data.registeredAgentName || "[Registered Agent]"}, located at ${data.registeredAgentAddress || "[Address]"}, is hereby confirmed as the registered agent of the limited liability company in the State of Wisconsin, pursuant to Wis. Stat. § 183.0113, and the proper authorized binders are authorized to execute any documents necessary to maintain the registered agent designation.`);

  // ===== PRINCIPAL OFFICE =====
  heading("Principal Office");
  boldPara("RESOLVED, ", `that the principal office of the limited liability company shall be located at ${data.principalOfficeAddress || "[Address]"}.`);

  // ===== EIN =====
  heading("Employer Identification Number");
  boldPara("RESOLVED, ", `that ${data.einAuthorizedName || "[Name]"}, ${data.einAuthorizedTitle || "[Title]"}, is hereby authorized to apply for and obtain a federal Employer Identification Number (EIN) from the Internal Revenue Service on behalf of the limited liability company.`);

  // ===== INITIAL MANAGERS / OFFICERS =====
  heading("Initial Managers / Officers");
  boldPara("RESOLVED, ", `that the following persons are hereby elected as the initial managers and officers of ${fullName}:`);

  if (data.managers.length > 0) {
    const tableData = data.managers.map(m => [m.name, m.title]);
    (doc as any).autoTable({
      startY: y,
      head: [["Name", "Title"]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: "bold" },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ===== INITIAL MEMBERS =====
  heading("Initial Members");
  boldPara("RESOLVED, ", `that the following persons are the initial members of ${fullName} and hold ownership interests as set forth below:`);

  if (data.members.length > 0) {
    const tableData = data.members.map(m => [m.name, m.commonShares, m.preferredShares, m.distributionPct ? `${m.distributionPct}%` : ""]);
    (doc as any).autoTable({
      startY: y,
      head: [["Name", "Common Shares", "Preferred Shares", "Distribution %"]],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255], fontStyle: "bold" },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 14;
  }

  // ===== BUSINESS PURPOSE =====
  heading("Business Purpose");
  boldPara("RESOLVED, ", `that the limited liability company is organized for the following purpose:`);
  para(data.businessPurpose || "[Business Purpose]");

  // ===== OPERATING AGREEMENT =====
  heading("Operating Agreement");
  if (data.operatingAgreementAdopted) {
    boldPara("RESOLVED, ", `that the Operating Agreement presented to and reviewed by the members at this meeting is hereby adopted as the Operating Agreement of the limited liability company, pursuant to Wis. Stat. § 183.0105, and the Secretary is directed to insert a copy of the Operating Agreement in the company's records.`);
  } else {
    para("No Operating Agreement was adopted at this meeting. The members agreed to adopt an Operating Agreement at a future date.");
  }

  // ===== FISCAL YEAR & ACCOUNTING =====
  heading("Fiscal Year & Accounting");
  const fyEnd = data.fiscalYearEnd || "December 31";
  const firstFY = data.firstFiscalYearEnd || "[Year]";
  boldPara("RESOLVED, ", `that the fiscal year of the limited liability company shall end on ${fyEnd} of each year (the first fiscal year ending ${firstFY}), and that the limited liability company shall maintain its books and records on the ${data.accountingMethod || "cash"} basis method of accounting.`);

  // ===== S CORP ELECTION (optional) =====
  if (data.includeScorp) {
    heading("S Corporation Election (IRC § 1362)");
    boldPara("WHEREAS, ", "the members have considered the tax treatment of the limited liability company and determined it is in the best interests of the company to elect S Corporation status;");
    boldPara("RESOLVED, ", `that the limited liability company hereby elects to be treated as an S Corporation under Subchapter S of the Internal Revenue Code, effective ${data.scorpEffectiveDate ? format(new Date(data.scorpEffectiveDate + "T12:00:00"), "MMMM d, yyyy") : "[Effective Date]"}, and the proper authorized binders are authorized and directed to prepare and file IRS Form 2553 and any corresponding state forms, with all members consenting to such election.`);
    y += 2;
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("Note: IRS Form 2553 must be filed within 75 days of the effective date of election.", margin, y);
    y += 16;
  }

  // ===== BANKING RESOLUTIONS (optional) =====
  if (data.includeBanking) {
    heading("Banking Resolutions");
    boldPara("RESOLVED, ", `that the limited liability company is hereby authorized to open and maintain a checking account at ${data.bankName || "[Bank Name]"}, ${data.bankCity || "[City, State]"}, and that the following persons are hereby authorized as signatories on said account:`);

    if (data.bankSignatories.length > 0) {
      data.bankSignatories.forEach(s => {
        para(`• ${s.name || "[Name]"}, ${s.title || "[Title]"}`, 10);
      });
    }
  }

  // ===== GENERAL AUTHORIZATION =====
  heading("General Authorization");
  boldPara("RESOLVED, ", "that the authorized binders of the limited liability company are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.");

  // ===== ADJOURNMENT =====
  heading("Adjournment");
  para("There being no further business, the meeting was duly adjourned.");

  // ===== SIGNATURES =====
  checkPage(120);
  heading("Signatures");
  y += 10;

  // Chairperson & Secretary side by side
  const colW = contentWidth / 2 - 10;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  
  // Chairperson
  doc.line(margin, y, margin + colW - 20, y);
  y += 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  doc.text(data.chairperson || "Chairperson", margin, y);
  doc.text("Chairperson", margin, y + 12);
  doc.text("Date: ________________", margin, y + 24);

  // Secretary
  const sx = margin + colW + 20;
  doc.line(sx, y - 14, sx + colW - 20, y - 14);
  doc.text(data.secretary || "Secretary", sx, y);
  doc.text("Secretary", sx, y + 12);
  doc.text("Date: ________________", sx, y + 24);
  y += 50;

  // Member signatures
  if (data.memberSignatures.length > 0) {
    checkPage(data.memberSignatures.length * 60);
    y += 10;
    data.memberSignatures.forEach((sig, i) => {
      checkPage(60);
      const col = i % 2;
      const xPos = col === 0 ? margin : margin + colW + 20;
      if (col === 0 && i > 0) y += 50;
      
      doc.setDrawColor(80, 80, 80);
      doc.line(xPos, y, xPos + colW - 20, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(sig.name || `Member ${i + 1}`, xPos, y + 14);
      doc.text("Member", xPos, y + 26);
      doc.text("Date: ________________", xPos, y + 38);
    });
    // Handle odd number
    if (data.memberSignatures.length % 2 !== 0) {
      y += 50;
    } else {
      y += 50;
    }
  }

  addFooter(doc);

  return doc;
}
