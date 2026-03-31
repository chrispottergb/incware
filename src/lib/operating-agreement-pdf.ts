import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerArialFont } from "@/lib/arial-font";

const MARGIN = 31.75; // 1.25 inch left margin for 3-hole punch binder filing
const R_MARGIN = 19.05; // 0.75 inch right margin
const BRAND = "EntityIQ";

function pw(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function ph(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

function checkBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > ph(doc) - 25) { doc.addPage(); return 25; }
  return y;
}

function addParagraph(doc: jsPDF, y: number, text: string, indent = MARGIN): number {
  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(30, 30, 30);
  const lines = doc.splitTextToSize(text, pw(doc) - indent - MARGIN);
  for (const line of lines) {
    y = checkBreak(doc, y, 6);
    doc.text(line, indent, y);
    y += 5.0;
  }
  return y + 4;
}

function addArticleTitle(doc: jsPDF, y: number, num: string, title: string): number {
  y = checkBreak(doc, y, 16);
  doc.setFontSize(13);
  doc.setFont("Arial", "bold");
  doc.setTextColor(25, 25, 30);
  doc.text(`ARTICLE ${num}`, pw(doc) / 2, y, { align: "center" });
  y += 5;
  doc.text(title.toUpperCase(), pw(doc) / 2, y, { align: "center" });
  y += 3;
  doc.setDrawColor(45, 55, 72);
  doc.setLineWidth(0.4);
  doc.line(pw(doc) / 2 - 30, y, pw(doc) / 2 + 30, y);
  return y + 6;
}

function addSectionTitle(doc: jsPDF, y: number, label: string): number {
  y = checkBreak(doc, y, 16);
  y += 4;
  doc.setFontSize(12);
  doc.setFont("Arial", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(label, MARGIN, y);
  return y + 8;
}

function addAiBadge(doc: jsPDF, y: number): number {
  y = checkBreak(doc, y, 8);
  const badgeText = "AI ASSISTED";
  doc.setFontSize(7.5);
  doc.setFont("Arial", "bold");
  const textWidth = doc.getTextWidth(badgeText);
  const badgeWidth = textWidth + 6;
  const badgeHeight = 4.5;
  const badgeX = pw(doc) - MARGIN - badgeWidth;
  // Badge background
  doc.setFillColor(139, 92, 246); // purple
  doc.roundedRect(badgeX, y - 3.2, badgeWidth, badgeHeight, 1.2, 1.2, "F");
  // Badge text
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, badgeX + 3, y);
  doc.setTextColor(30, 30, 30);
  return y + 3;
}

function addFooters(doc: jsPDF, companyName: string) {
  const count = doc.getNumberOfPages();
  for (let i = 2; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Operating Agreement — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - MARGIN, ph(doc) - 8, { align: "right" });
  }
}

export interface OperatingAgreementData {
  company: any;
  members: any[];
  officers: any[];
  managementType: "member-managed" | "manager-managed";
  aiDraftSections?: Record<string, string> | null;
  shareholderHoldings?: Record<string, number>;
  totalIssuedUnits?: number;
}

export function generateOperatingAgreementPDF(data: OperatingAgreementData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  const { company, members, officers, managementType, aiDraftSections, shareholderHoldings, totalIssuedUnits } = data;
  const cx = pw(doc) / 2;
  const ai = aiDraftSections || {};
  const hasAi = !!aiDraftSections && Object.keys(aiDraftSections).length > 0;
  const isManagerManaged = managementType === "manager-managed";

  const companyName = company.name || "_______________";
  const state = company.state_of_incorporation || "Wisconsin";
  const raName = company.registered_agent_name || "_______________";
  const raAddress = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ") || "_______________";
  const purpose = company.business_purpose || "any lawful business purpose permitted under the Wisconsin Uniform Limited Liability Company Law";
  const filingDate = company.filing_date ? new Date(company.filing_date + "T00:00:00").toLocaleDateString() : "_______________";
  const fiscalYearEnd = company.fiscal_year_end || "December 31";

  // ── COVER PAGE ──
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, pw(doc), ph(doc), "F");

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("STATE OF WISCONSIN", cx, 45, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Wis. Stat. Ch. 183 — Wisconsin Uniform Limited Liability Company Law", cx, 52, { align: "center" });

  doc.setDrawColor(140, 40, 30);
  doc.setLineWidth(1.5);
  doc.line(40, 62, pw(doc) - 40, 62);
  doc.setLineWidth(0.3);
  doc.line(40, 64, pw(doc) - 40, 64);

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("OPERATING AGREEMENT", cx, 85, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`(${isManagerManaged ? "Manager-Managed" : "Member-Managed"})`, cx, 94, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(140, 80, 40);
  const nameLines = doc.splitTextToSize(companyName, pw(doc) - 60);
  let cy = 115;
  nameLines.forEach((l: string) => { doc.text(l, cx, cy, { align: "center" }); cy += 8; });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("A Wisconsin Limited Liability Company", cx, cy + 5, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Effective Date: ${filingDate}`, cx, cy + 20, { align: "center" });
  doc.text(`Prepared by ${BRAND}`, cx, cy + 27, { align: "center" });

  if (hasAi) {
    doc.setFontSize(11);
    doc.setTextColor(120, 80, 180);
    doc.text("Contains AI-Assisted Sections", cx, cy + 35, { align: "center" });
  }

  doc.setFontSize(11);
  doc.setTextColor(130, 130, 130);
  doc.text("CONFIDENTIAL — FOR AUTHORIZED USE ONLY", cx, ph(doc) - 20, { align: "center" });

  // ── TABLE OF CONTENTS ──
  doc.addPage();
  let y = 25;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("TABLE OF CONTENTS", cx, y, { align: "center" });
  y += 10;

  const tocItems = [
    "I. Formation",
    "II. Name and Principal Office",
    "III. Purpose and Powers",
    "IV. Term",
    "V. Members and Membership Interests",
    "VI. Capital Contributions",
    "VII. Distributions",
    `VIII. Management and ${isManagerManaged ? "Managers" : "Voting"}`,
    "IX. Meetings of Members",
    "X. Transfer of Membership Interests",
    "XI. Dissolution and Winding Up",
    "XII. Books and Records",
    "XIII. Tax Matters",
    "XIV. Indemnification",
    "XV. Amendments",
    "XVI. Miscellaneous Provisions",
  ];
  tocItems.forEach((item) => {
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(item, MARGIN + 5, y);
    y += 6;
  });

  // ── PREAMBLE ──
  doc.addPage();
  y = 25;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("OPERATING AGREEMENT", cx, y, { align: "center" });
  doc.text(`OF ${companyName.toUpperCase()}`, cx, y + 6, { align: "center" });
  y += 15;

  if (ai.preamble) y = addAiBadge(doc, y);
  const preamble = ai.preamble || `This Operating Agreement ("Agreement") of ${companyName}, a Wisconsin limited liability company (the "Company"), is entered into effective as of ${filingDate}, by and among the Members identified herein, pursuant to the Wisconsin Uniform Limited Liability Company Law, Wis. Stat. Ch. 183.`;
  y = addParagraph(doc, y, preamble);

  y = addParagraph(doc, y, `WHEREAS, the Articles of Organization of the Company were filed with the Wisconsin Department of Financial Institutions on ${filingDate}; and`);
  y = addParagraph(doc, y, `WHEREAS, the Members desire to enter into this Operating Agreement to set forth the rights, powers, duties, obligations, and liabilities of the Members and to provide for the management, operation, and governance of the Company;`);
  y = addParagraph(doc, y, `NOW, THEREFORE, in consideration of the mutual covenants and agreements hereinafter set forth, and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the Members agree as follows:`);

  // ── ARTICLE I: FORMATION ──
  y = addArticleTitle(doc, y, "I", "Formation");
  y = addSectionTitle(doc, y, "Section 1.1 — Formation");
  if (ai.formation) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.formation || `The Company was formed as a Wisconsin limited liability company pursuant to Wis. Stat. § 183.0202 by filing Articles of Organization with the Wisconsin Department of Financial Institutions on ${filingDate}.`);
  y = addSectionTitle(doc, y, "Section 1.2 — Registered Agent");
  y = addParagraph(doc, y, `The Company's registered agent is ${raName}, with a registered office address at ${raAddress}, as required by Wis. Stat. § 183.0105.`);

  // ── ARTICLE II: NAME AND PRINCIPAL OFFICE ──
  y = addArticleTitle(doc, y, "II", "Name and Principal Office");
  y = addSectionTitle(doc, y, "Section 2.1 — Name");
  y = addParagraph(doc, y, `The name of the Company is "${companyName}" and all business of the Company shall be conducted under that name or such other names as the ${isManagerManaged ? "Managers" : "Members"} may determine from time to time in compliance with Wis. Stat. § 183.0103.`);
  y = addSectionTitle(doc, y, "Section 2.2 — Principal Office");
  const addr = [company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "_______________";
  y = addParagraph(doc, y, `The principal office of the Company shall be located at ${addr}, or at such other place as the ${isManagerManaged ? "Managers" : "Members"} may from time to time designate.`);

  // ── ARTICLE III: PURPOSE AND POWERS ──
  y = addArticleTitle(doc, y, "III", "Purpose and Powers");
  if (ai.purpose) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.purpose || `The Company is organized for the purpose of ${purpose}, and to engage in any and all activities necessary, customary, convenient, or incident thereto, as permitted under Wis. Stat. § 183.0106.`);

  // ── ARTICLE IV: TERM ──
  y = addArticleTitle(doc, y, "IV", "Term");
  if (ai.term) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.term || `The term of the Company shall be perpetual, commencing on the date the Articles of Organization were filed with the Wisconsin Department of Financial Institutions, unless sooner dissolved in accordance with this Agreement or Wis. Stat. § 183.0901.`);

  // ── ARTICLE V: MEMBERS AND MEMBERSHIP INTERESTS ──
  y = addArticleTitle(doc, y, "V", "Members and Membership Interests");
  y = addSectionTitle(doc, y, "Section 5.1 — Members");
  if (ai.members) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.members || `The names, addresses, and membership interests of the Members are as set forth in the attached Schedule A. Each Member's interest in the Company shall be personal property as provided in Wis. Stat. § 183.0701.`);

  // Members table
  if (members.length > 0) {
    y = checkBreak(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Member Name", "Address", "City/State/Zip", "Status"]],
      body: members.map((m) => [
        m.name,
        m.address || "—",
        [m.city, m.state, m.zip].filter(Boolean).join(", ") || "—",
        m.status || "Active",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 11, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      margin: { left: MARGIN, right: MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  y = addSectionTitle(doc, y, "Section 5.2 — Admission of New Members");
  y = addParagraph(doc, y, `New Members may be admitted to the Company only with the ${isManagerManaged ? "consent of the Managers and" : ""} unanimous written consent of all existing Members, pursuant to Wis. Stat. § 183.0401(2).`);

  // ── ARTICLE VI: CAPITAL CONTRIBUTIONS ──
  y = addArticleTitle(doc, y, "VI", "Capital Contributions");
  y = addSectionTitle(doc, y, "Section 6.1 — Initial Contributions");
  if (ai.capitalContributions) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.capitalContributions || `Each Member shall make an initial capital contribution to the Company in the amount and form set forth opposite such Member's name in Schedule A. No Member shall be required to make any additional capital contributions without the Member's consent, as provided by Wis. Stat. § 183.0402.`);
  y = addSectionTitle(doc, y, "Section 6.2 — Return of Contributions");
  y = addParagraph(doc, y, `No Member shall have the right to withdraw or receive any return of such Member's capital contribution, except as may be specifically provided in this Agreement or required by Wis. Stat. § 183.0404.`);

  // ── ARTICLE VII: DISTRIBUTIONS ──
  y = addArticleTitle(doc, y, "VII", "Distributions");
  if (ai.distributions) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.distributions || `Distributions shall be made to the Members in proportion to their respective membership interests at such times and in such amounts as the ${isManagerManaged ? "Managers" : "Members"} shall determine, subject to the limitations set forth in Wis. Stat. § 183.0404. No distribution shall be made if, after giving effect to the distribution, the Company would be unable to pay its debts as they become due in the ordinary course of business.`);

  // ── ARTICLE VIII: MANAGEMENT ──
  y = addArticleTitle(doc, y, "VIII", `Management and ${isManagerManaged ? "Managers" : "Voting"}`);

  if (isManagerManaged) {
    y = addSectionTitle(doc, y, "Section 8.1 — Manager-Managed");
    if (ai.management) y = addAiBadge(doc, y);
    y = addParagraph(doc, y, ai.management || `The Company shall be managed by one or more Managers as designated by a majority vote of the Members, pursuant to Wis. Stat. § 183.0401(2). The Managers shall have full and exclusive authority to manage and control the business and affairs of the Company.`);
    y = addSectionTitle(doc, y, "Section 8.2 — Powers of Managers");
    y = addParagraph(doc, y, `The Managers shall have the power and authority to take all actions necessary, appropriate, or advisable to carry out the purposes of the Company, including but not limited to: (a) entering into contracts; (b) opening bank accounts; (c) borrowing money; (d) hiring employees; and (e) acquiring, holding, and disposing of property. Each Manager shall be an agent of the Company per Wis. Stat. § 183.0301.`);
    y = addSectionTitle(doc, y, "Section 8.3 — Officers");
    y = addParagraph(doc, y, `The Managers may appoint officers of the Company, who shall have such duties and authority as the Managers may designate.`);

    if (officers.length > 0) {
      y = checkBreak(doc, y, 15);
      const off = officers[0];
      const officerFields = [
        off?.president && `President: ${off.president}`,
        off?.vice_president && `Vice President: ${off.vice_president}`,
        off?.secretary && `Secretary: ${off.secretary}`,
        off?.treasurer && `Treasurer: ${off.treasurer}`,
      ].filter(Boolean);
      if (officerFields.length > 0) {
        y = addParagraph(doc, y, `Current Officers: ${officerFields.join("; ")}.`);
      }
    }
  } else {
    y = addSectionTitle(doc, y, "Section 8.1 — Member-Managed");
    if (ai.management) y = addAiBadge(doc, y);
    y = addParagraph(doc, y, ai.management || `The Company shall be managed by its Members in proportion to their membership interests, pursuant to Wis. Stat. § 183.0401(1). Each Member shall be an agent of the Company per Wis. Stat. § 183.0301.`);
    y = addSectionTitle(doc, y, "Section 8.2 — Voting");
    y = addParagraph(doc, y, `Except as otherwise provided in this Agreement, decisions shall be made by a majority vote of the Members based on their respective membership interests. The following actions shall require the unanimous consent of all Members: (a) amendment of this Agreement; (b) admission of new Members; (c) any action that would make it impossible to carry on the ordinary business of the Company.`);
    y = addSectionTitle(doc, y, "Section 8.3 — Officers");
    y = addParagraph(doc, y, `The Members may appoint officers of the Company as they see fit.`);
  }

  // ── ARTICLE IX: MEETINGS ──
  y = addArticleTitle(doc, y, "IX", "Meetings of Members");
  if (ai.meetings) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.meetings || `The Members shall hold an annual meeting at such time and place as may be determined by the ${isManagerManaged ? "Managers" : "Members"}. Special meetings may be called by any Member upon not less than ten (10) days' prior written notice to all other Members. Members may participate in meetings by telephone or electronic communication as permitted by Wis. Stat. § 183.0404. Any action required or permitted to be taken at a meeting of Members may be taken without a meeting if a written consent setting forth the action is signed by Members having not less than the minimum number of votes necessary to authorize or take such action at a meeting.`);

  // ── ARTICLE X: TRANSFER OF INTERESTS ──
  y = addArticleTitle(doc, y, "X", "Transfer of Membership Interests");
  y = addSectionTitle(doc, y, "Section 10.1 — Restrictions on Transfer");
  if (ai.transfer) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.transfer || `No Member may transfer, sell, assign, pledge, or otherwise dispose of all or any part of such Member's membership interest in the Company without the prior written consent of ${isManagerManaged ? "the Managers and " : ""}all other Members, pursuant to Wis. Stat. § 183.0706. Any attempted transfer in violation of this Section shall be void and of no effect.`);
  y = addSectionTitle(doc, y, "Section 10.2 — Effect of Transfer");
  y = addParagraph(doc, y, `A transferee of a membership interest who has not been admitted as a Member shall have only the rights of an assignee as provided in Wis. Stat. § 183.0706, including the right to receive distributions to which the transferor would otherwise be entitled.`);

  // ── ARTICLE XI: DISSOLUTION ──
  y = addArticleTitle(doc, y, "XI", "Dissolution and Winding Up");
  y = addSectionTitle(doc, y, "Section 11.1 — Events of Dissolution");
  if (ai.dissolution) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.dissolution || `The Company shall be dissolved upon the first to occur of: (a) the unanimous written agreement of all Members; (b) the entry of a decree of judicial dissolution under Wis. Stat. § 183.0902; (c) any event that makes it unlawful for the business of the Company to be carried on; or (d) as otherwise provided in Wis. Stat. § 183.0901.`);
  y = addSectionTitle(doc, y, "Section 11.2 — Winding Up");
  y = addParagraph(doc, y, `Upon dissolution, the Company's affairs shall be wound up pursuant to Wis. Stat. § 183.0903. The assets shall be distributed in the following order: (a) to creditors of the Company; (b) to Members for unpaid distributions; (c) to Members in proportion to their membership interests.`);

  // ── ARTICLE XII: BOOKS AND RECORDS ──
  y = addArticleTitle(doc, y, "XII", "Books and Records");
  if (ai.booksAndRecords) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.booksAndRecords || `The Company shall maintain at its principal office all books and records required by Wis. Stat. § 183.0405, including: (a) a current list of the full name and last known address of each Member; (b) copies of all federal, state, and local tax returns; (c) copies of the Articles of Organization, this Operating Agreement, and all amendments; and (d) financial statements for the three most recent fiscal years.`);

  // ── ARTICLE XIII: TAX MATTERS ──
  y = addArticleTitle(doc, y, "XIII", "Tax Matters");
  if (ai.tax) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.tax || `The Company shall be classified as a partnership for federal income tax purposes (or as a disregarded entity if there is only one Member). The fiscal year of the Company shall end on ${fiscalYearEnd}. The ${isManagerManaged ? "Managers" : "Members"} shall cause all required tax returns to be prepared and filed in a timely manner. Each Member shall be provided with a Schedule K-1 or equivalent within ninety (90) days following the end of each fiscal year.`);

  // ── ARTICLE XIV: INDEMNIFICATION ──
  y = addArticleTitle(doc, y, "XIV", "Indemnification");
  if (ai.indemnification) y = addAiBadge(doc, y);
  y = addParagraph(doc, y, ai.indemnification || `The Company shall indemnify and hold harmless each Member${isManagerManaged ? ", Manager," : ""} and officer from and against any and all claims, losses, damages, liabilities, and expenses arising out of or in connection with the management of the Company's affairs, to the fullest extent permitted by Wis. Stat. § 183.0408, provided that such person acted in good faith and in a manner reasonably believed to be in or not opposed to the best interests of the Company.`);

  // ── ARTICLE XV: AMENDMENTS ──
  y = addArticleTitle(doc, y, "XV", "Amendments");
  y = addParagraph(doc, y, `This Agreement may be amended only by the unanimous written consent of all Members. Any amendment shall be in writing and signed by all Members, and shall be effective when so executed. Amendments to the Articles of Organization shall be filed with the Wisconsin Department of Financial Institutions as required by Wis. Stat. § 183.0202.`);

  // ── ARTICLE XVI: MISCELLANEOUS ──
  y = addArticleTitle(doc, y, "XVI", "Miscellaneous Provisions");
  y = addSectionTitle(doc, y, "Section 16.1 — Governing Law");
  y = addParagraph(doc, y, `This Agreement shall be governed by and construed in accordance with the laws of the State of Wisconsin, including the Wisconsin Uniform Limited Liability Company Law, Wis. Stat. Ch. 183.`);
  y = addSectionTitle(doc, y, "Section 16.2 — Entire Agreement");
  y = addParagraph(doc, y, `This Agreement constitutes the entire agreement among the Members with respect to the Company and supersedes all prior agreements and understandings, whether written or oral.`);
  y = addSectionTitle(doc, y, "Section 16.3 — Severability");
  y = addParagraph(doc, y, `If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`);
  y = addSectionTitle(doc, y, "Section 16.4 — Binding Effect");
  y = addParagraph(doc, y, `This Agreement shall be binding upon and inure to the benefit of the Members, their heirs, executors, administrators, successors, and permitted assigns.`);

  // ── SIGNATURE PAGE ──
  doc.addPage();
  y = 30;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("IN WITNESS WHEREOF", cx, y, { align: "center" });
  y += 8;
  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(50, 50, 50);
  const witnessText = `the undersigned Members have executed this Operating Agreement as of the date first written above.`;
  const wLines = doc.splitTextToSize(witnessText, pw(doc) - MARGIN * 2);
  wLines.forEach((l: string) => { doc.text(l, cx, y, { align: "center" }); y += 4.5; });
  y += 15;

  // Signature lines for each member
  const sigMembers = members.length > 0 ? members : [{ name: "Member 1" }, { name: "Member 2" }];
  sigMembers.forEach((m: any) => {
    y = checkBreak(doc, y, 30);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 80, y);
    doc.line(pw(doc) - MARGIN - 50, y, pw(doc) - MARGIN, y);
    y += 4;
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(m.name || "Member", MARGIN, y);
    doc.text("Date", pw(doc) - MARGIN - 50, y);
    y += 15;
  });

  // ── SCHEDULE A ──
  doc.addPage();
  y = 25;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("SCHEDULE A", cx, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.text("Members, Addresses, and Membership Interests", cx, y, { align: "center" });
  y += 4;
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.4);
  doc.line(cx - 40, y, cx + 40, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(`Company: ${companyName}`, MARGIN, y);
  y += 5;
  doc.text(`Effective Date: ${filingDate}`, MARGIN, y);
  y += 8;

  const scheduleMembers = members.filter((m: any) => !m.is_treasury);
  const totalUnits = totalIssuedUnits || 0;
  const holdings = shareholderHoldings || {};

  // Helper to get membership interest % for a member
  const getMemberInterest = (m: any): number | null => {
    const units = holdings[m.id] || 0;
    if (totalUnits > 0 && units > 0) return (units / totalUnits) * 100;
    if (m.ownership_percentage != null) return m.ownership_percentage;
    return null;
  };

  if (scheduleMembers.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Member Name", "Address", "City, State, ZIP", "Membership Interest (%)"]],
      body: scheduleMembers.map((m: any) => {
        const interest = getMemberInterest(m);
        return [
          m.name || "—",
          [m.address, m.address_2].filter(Boolean).join(", ") || "—",
          [m.city, m.state, m.zip].filter(Boolean).join(", ") || "—",
          interest != null ? `${interest.toFixed(2)}%` : "—",
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 11, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      margin: { left: MARGIN, right: MARGIN },
      columnStyles: {
        3: { halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  } else {
    y = addParagraph(doc, y, "No members have been recorded at this time.");
  }

  // Total percentage row
  const totalPct = scheduleMembers.reduce((sum: number, m: any) => {
    const interest = getMemberInterest(m);
    return sum + (interest || 0);
  }, 0);
  if (scheduleMembers.length > 0) {
    doc.setFontSize(11);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`Total Membership Interests: ${totalPct.toFixed(2)}%`, pw(doc) - MARGIN, y, { align: "right" });
    y += 10;
  }

  doc.setFontSize(11);
  doc.setFont("Arial", "italic");
  doc.setTextColor(120, 120, 120);
  const scheduleNote = "This Schedule A is incorporated into and made a part of the Operating Agreement. Any changes to membership interests shall be reflected by an amended Schedule A executed by all Members.";
  y = addParagraph(doc, y, scheduleNote);

  addFooters(doc, companyName);
  return doc;
}
