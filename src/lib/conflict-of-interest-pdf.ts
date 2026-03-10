import jsPDF from "jspdf";

const MARGIN = 25.4; // 1 inch for binder compatibility
const BRAND = "EntityIQ";

function pw(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function ph(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

function checkBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > ph(doc) - 25) { doc.addPage(); return 25; }
  return y;
}

function addParagraph(doc: jsPDF, y: number, text: string, indent = MARGIN): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
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
  y = checkBreak(doc, y, 18);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(25, 25, 30);
  doc.text(`ARTICLE ${num}`, pw(doc) / 2, y, { align: "center" });
  y += 6;
  doc.text(title.toUpperCase(), pw(doc) / 2, y, { align: "center" });
  y += 3;
  doc.setDrawColor(45, 55, 72);
  doc.setLineWidth(0.4);
  doc.line(pw(doc) / 2 - 30, y, pw(doc) / 2 + 30, y);
  return y + 7;
}

function addSectionTitle(doc: jsPDF, y: number, label: string): number {
  y = checkBreak(doc, y, 20);
  y += 6;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(label, MARGIN, y);
  return y + 10;
}

function addFooters(doc: jsPDF, companyName: string) {
  const count = doc.getNumberOfPages();
  for (let i = 2; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Conflict of Interest Policy — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - MARGIN, ph(doc) - 8, { align: "right" });
  }
}

export interface ConflictOfInterestData {
  company: any;
  directors: any[];
  officers: any[];
}

export function generateConflictOfInterestPDF(data: ConflictOfInterestData): jsPDF {
  const doc = new jsPDF();
  const { company, directors, officers } = data;
  const cx = pw(doc) / 2;

  const companyName = company.name || "_______________";
  const incDate = company.incorporation_date ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString() : "_______________";

  // ── COVER PAGE ──
  doc.setFillColor(25, 25, 30);
  doc.rect(0, 0, pw(doc), ph(doc), "F");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(200, 200, 200);
  doc.text("IRS FORM 1023 COMPLIANCE DOCUMENT", cx, 45, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(160, 160, 160);
  doc.text("Required for 501(c)(3) Tax-Exempt Status", cx, 52, { align: "center" });

  doc.setDrawColor(180, 80, 40);
  doc.setLineWidth(1.5);
  doc.line(40, 62, pw(doc) - 40, 62);
  doc.setLineWidth(0.3);
  doc.line(40, 64, pw(doc) - 40, 64);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("CONFLICT OF INTEREST", cx, 85, { align: "center" });
  doc.text("POLICY", cx, 95, { align: "center" });

  doc.setFontSize(16);
  doc.setTextColor(200, 130, 80);
  const nameLines = doc.splitTextToSize(companyName, pw(doc) - 60);
  let cy = 118;
  nameLines.forEach((l: string) => { doc.text(l, cx, cy, { align: "center" }); cy += 8; });

  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text("A Wisconsin Non-Profit Corporation", cx, cy + 5, { align: "center" });

  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Prepared by ${BRAND}`, cx, cy + 20, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text("CONFIDENTIAL — FOR AUTHORIZED USE ONLY", cx, ph(doc) - 20, { align: "center" });

  // ── POLICY BODY ──
  doc.addPage();
  let y = 25;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CONFLICT OF INTEREST POLICY", cx, y, { align: "center" });
  doc.text(`OF ${companyName.toUpperCase()}`, cx, y + 6, { align: "center" });
  y += 18;

  // Article I: Purpose
  y = addArticleTitle(doc, y, "I", "Purpose");
  y = addParagraph(doc, y, `The purpose of this Conflict of Interest Policy is to protect the interests of ${companyName} (the "Organization"), a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code, when it is contemplating entering into a transaction or arrangement that might benefit the private interest of an officer, director, or key employee of the Organization. This policy is intended to supplement but not replace any applicable state and federal laws governing conflicts of interest applicable to nonprofit and charitable organizations, including Wis. Stat. § 181.0831.`);

  // Article II: Definitions
  y = addArticleTitle(doc, y, "II", "Definitions");
  y = addSectionTitle(doc, y, "Section 2.1 — Interested Person");
  y = addParagraph(doc, y, `Any director, principal officer, or member of a committee with Board-delegated powers who has a direct or indirect financial interest, as defined below, is an interested person.`);
  y = addSectionTitle(doc, y, "Section 2.2 — Financial Interest");
  y = addParagraph(doc, y, `A person has a financial interest if the person has, directly or indirectly, through business, investment, or family: (a) an ownership or investment interest in any entity with which the Organization has a transaction or arrangement; (b) a compensation arrangement with the Organization or with any entity or individual with which the Organization has a transaction or arrangement; or (c) a potential ownership or investment interest in, or compensation arrangement with, any entity or individual with which the Organization is negotiating a transaction or arrangement.`);
  y = addParagraph(doc, y, `Compensation includes direct and indirect remuneration as well as gifts or favors that are not insubstantial. A financial interest is not necessarily a conflict of interest. A person who has a financial interest may have a conflict of interest only if the Board or appropriate committee decides that a conflict of interest exists, in accordance with this policy.`);

  // Article III: Procedures
  y = addArticleTitle(doc, y, "III", "Procedures");
  y = addSectionTitle(doc, y, "Section 3.1 — Duty to Disclose");
  y = addParagraph(doc, y, `In connection with any actual or possible conflict of interest, an interested person must disclose the existence of the financial interest and be given the opportunity to disclose all material facts to the directors and members of committees with Board-delegated powers considering the proposed transaction or arrangement.`);
  y = addSectionTitle(doc, y, "Section 3.2 — Determining Whether a Conflict Exists");
  y = addParagraph(doc, y, `After disclosure of the financial interest and all material facts, and after any discussion with the interested person, the interested person shall leave the Board or committee meeting while the determination of a conflict of interest is discussed and voted upon. The remaining Board or committee members shall decide if a conflict of interest exists.`);
  y = addSectionTitle(doc, y, "Section 3.3 — Procedures for Addressing the Conflict");
  y = addParagraph(doc, y, `(a) An interested person may make a presentation at the Board or committee meeting, but after the presentation, the interested person shall leave the meeting during the discussion of, and the vote on, the transaction or arrangement involving the possible conflict of interest.`);
  y = addParagraph(doc, y, `(b) The chairperson of the Board or committee shall, if appropriate, appoint a disinterested person or committee to investigate alternatives to the proposed transaction or arrangement.`);
  y = addParagraph(doc, y, `(c) After exercising due diligence, the Board or committee shall determine whether the Organization can obtain with reasonable efforts a more advantageous transaction or arrangement from a person or entity that would not give rise to a conflict of interest.`);
  y = addParagraph(doc, y, `(d) If a more advantageous transaction or arrangement is not reasonably possible under circumstances not producing a conflict of interest, the Board or committee shall determine by a majority vote of the disinterested directors whether the transaction or arrangement is in the Organization's best interest, for its own benefit, and whether it is fair and reasonable. In conformity with the above determination, it shall make its decision as to whether to enter into the transaction or arrangement.`);
  y = addSectionTitle(doc, y, "Section 3.4 — Violations of the Policy");
  y = addParagraph(doc, y, `(a) If the Board or committee has reasonable cause to believe a member has failed to disclose actual or possible conflicts of interest, it shall inform the member of the basis for such belief and afford the member an opportunity to explain the alleged failure to disclose.`);
  y = addParagraph(doc, y, `(b) If, after hearing the member's response and after making further investigation as warranted by the circumstances, the Board or committee determines the member has failed to disclose an actual or possible conflict of interest, it shall take appropriate disciplinary and corrective action.`);

  // Article IV: Records of Proceedings
  y = addArticleTitle(doc, y, "IV", "Records of Proceedings");
  y = addParagraph(doc, y, `The minutes of the Board and all committees with Board-delegated powers shall contain: (a) the names of the persons who disclosed or otherwise were found to have a financial interest in connection with an actual or possible conflict of interest, the nature of the financial interest, any action taken to determine whether a conflict of interest was present, and the Board's or committee's decision as to whether a conflict of interest in fact existed; (b) the names of the persons who were present for discussions and votes relating to the transaction or arrangement, the content of the discussion, including any alternatives to the proposed transaction or arrangement, and a record of any votes taken in connection with the proceedings.`);

  // Article V: Compensation
  y = addArticleTitle(doc, y, "V", "Compensation");
  y = addParagraph(doc, y, `(a) A voting member of the Board who receives compensation, directly or indirectly, from the Organization for services is precluded from voting on matters pertaining to that member's compensation.`);
  y = addParagraph(doc, y, `(b) A voting member of any committee whose jurisdiction includes compensation matters and who receives compensation, directly or indirectly, from the Organization for services is precluded from voting on matters pertaining to that member's compensation.`);
  y = addParagraph(doc, y, `(c) No voting member of the Board or any committee whose jurisdiction includes compensation matters and who receives compensation, directly or indirectly, from the Organization, either individually or collectively, is prohibited from providing information to any committee regarding compensation.`);

  // Article VI: Annual Statements
  y = addArticleTitle(doc, y, "VI", "Annual Statements");
  y = addParagraph(doc, y, `Each director, principal officer, and member of a committee with Board-delegated powers shall annually sign a statement which affirms such person: (a) has received a copy of the conflict of interest policy; (b) has read and understands the policy; (c) has agreed to comply with the policy; and (d) understands the Organization is charitable and in order to maintain its federal tax exemption it must engage primarily in activities which accomplish one or more of its tax-exempt purposes.`);

  // Article VII: Periodic Reviews
  y = addArticleTitle(doc, y, "VII", "Periodic Reviews");
  y = addParagraph(doc, y, `To ensure the Organization operates in a manner consistent with charitable purposes and does not engage in activities that could jeopardize its tax-exempt status, periodic reviews shall be conducted. The periodic reviews shall, at a minimum, include: (a) whether compensation arrangements and benefits are reasonable, based on competent survey information, and the result of arm's length bargaining; and (b) whether partnerships, joint ventures, and arrangements with management organizations conform to the Organization's written policies, are properly recorded, reflect reasonable investment or payments for goods and services, further charitable purposes, and do not result in inurement, impermissible private benefit, or in an excess benefit transaction.`);

  // Article VIII: Use of Outside Experts
  y = addArticleTitle(doc, y, "VIII", "Use of Outside Experts");
  y = addParagraph(doc, y, `When conducting the periodic reviews as provided for in Article VII, the Organization may, but need not, use outside advisors. If outside experts are used, their use shall not relieve the Board of its responsibility for ensuring periodic reviews are conducted.`);

  // ── ANNUAL DISCLOSURE FORM ──
  doc.addPage();
  y = 30;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("ANNUAL CONFLICT OF INTEREST", cx, y, { align: "center" });
  doc.text("DISCLOSURE STATEMENT", cx, y + 6, { align: "center" });
  y += 18;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  y = addParagraph(doc, y, `Name: _________________________________    Date: ______________`);
  y = addParagraph(doc, y, `Position / Title: _________________________________`);
  y += 4;

  y = addParagraph(doc, y, `I affirm the following:`);
  y = addParagraph(doc, y, `1. I have received a copy of the Conflict of Interest Policy of ${companyName}.`);
  y = addParagraph(doc, y, `2. I have read and understand the policy.`);
  y = addParagraph(doc, y, `3. I agree to comply with the policy.`);
  y = addParagraph(doc, y, `4. I understand that ${companyName} is a tax-exempt organization and that in order to maintain its federal tax exemption it must engage primarily in activities which accomplish one or more of its tax-exempt purposes.`);
  y += 6;

  y = addParagraph(doc, y, `Disclosures:`);
  y = addParagraph(doc, y, `I have the following financial interests that could give rise to a conflict of interest:`);
  y += 3;
  for (let i = 0; i < 4; i++) {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y, pw(doc) - MARGIN, y);
    y += 8;
  }
  y += 6;

  y = addParagraph(doc, y, `I have no financial interests that could give rise to a conflict of interest: ☐`);
  y += 10;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(pw(doc) - MARGIN - 50, y, pw(doc) - MARGIN, y);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("Signature", MARGIN, y);
  doc.text("Date", pw(doc) - MARGIN - 50, y);

  addFooters(doc, companyName);
  return doc;
}
