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
  y = checkBreak(doc, y, 16);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text(`ARTICLE ${num}`, pw(doc) / 2, y, { align: "center" });
  y += 5;
  doc.text(title.toUpperCase(), pw(doc) / 2, y, { align: "center" });
  y += 3;
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.4);
  doc.line(pw(doc) / 2 - 30, y, pw(doc) / 2 + 30, y);
  return y + 6;
}

function addSectionTitle(doc: jsPDF, y: number, label: string): number {
  y = checkBreak(doc, y, 12);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text(label, MARGIN, y);
  return y + 5;
}

function addFooters(doc: jsPDF, companyName: string) {
  const count = doc.getNumberOfPages();
  for (let i = 2; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(11);
    doc.setTextColor(160, 160, 160);
    doc.text(`Sole Member Operating Agreement — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - MARGIN, ph(doc) - 8, { align: "right" });
  }
}

export interface SMOperatingAgreementData {
  company: any;
  members: any[];
}

export function generateSMOperatingAgreementPDF(data: SMOperatingAgreementData): jsPDF {
  const doc = new jsPDF();
  const { company, members } = data;
  const cx = pw(doc) / 2;

  const companyName = company.name || "_______________";
  const memberName = members.length > 0 ? members[0].name : "_______________";
  const filingDate = company.filing_date
    ? new Date(company.filing_date + "T00:00:00").toLocaleDateString()
    : "_______________, 20___";
  const purpose = company.business_purpose || "_______________";
  const fiscalYearEnd = company.fiscal_year_end || "December";

  // ── COVER PAGE ──
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, pw(doc), ph(doc), "F");

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text("STATE OF WISCONSIN", cx, 45, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Wis. Stat. Ch. 183 — Wisconsin Uniform Limited Liability Company Law", cx, 52, { align: "center" });

  doc.setDrawColor(140, 40, 30);
  doc.setLineWidth(1.5);
  doc.line(40, 62, pw(doc) - 40, 62);
  doc.setLineWidth(0.3);
  doc.line(40, 64, pw(doc) - 40, 64);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("SOLE MEMBER", cx, 82, { align: "center" });
  doc.text("OPERATING AGREEMENT", cx, 92, { align: "center" });

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

  doc.setFontSize(11);
  doc.setTextColor(130, 130, 130);
  doc.text("CONFIDENTIAL — FOR AUTHORIZED USE ONLY", cx, ph(doc) - 20, { align: "center" });

  // ── TABLE OF CONTENTS ──
  doc.addPage();
  let y = 25;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("TABLE OF CONTENTS", cx, y, { align: "center" });
  y += 10;

  const tocItems = [
    "Article 1 — Organization",
    "Article 2 — Capital Contributions and Distributions",
    "Article 3 — Books, Records and Accounting",
    "Article 4 — Member's Capital Accounts",
    "Article 5 — U.S. Federal / Wisconsin State Income Tax Treatment",
    "Article 6 — Rights, Powers and Obligations of Member",
    "Article 7 — Limitation of Liability; Indemnification",
    "Article 8 — Death, Disability, Dissolution",
    "Article 9 — Miscellaneous Provisions",
  ];
  tocItems.forEach((item) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 50);
    doc.text(item, MARGIN + 5, y);
    y += 6;
  });

  // ── PREAMBLE ──
  doc.addPage();
  y = 25;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("SOLE MEMBER OPERATING AGREEMENT", cx, y, { align: "center" });
  y += 15;

  y = addParagraph(doc, y,
    `THIS OPERATING AGREEMENT ("Agreement") is made and entered into as of ${filingDate}, by and among ${companyName}, LLC, a Wisconsin Limited Liability Company (the "Company") and ${memberName}, executing this Agreement as the sole member of the Company (the "Member") and hereby states as follows:`
  );
  y += 3;

  // Consideration
  doc.setFontSize(11);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(85, 85, 85);
  const considLines = doc.splitTextToSize(
    "NOW, THEREFORE, for good and valuable consideration the receipt and sufficiency of which is hereby acknowledged, it is agreed as follows:",
    pw(doc) - MARGIN * 2 - 10
  );
  y = checkBreak(doc, y, considLines.length * 4.2 + 6);
  doc.setDrawColor(200, 185, 154);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y - 2, MARGIN, y + considLines.length * 4.2 + 2);
  considLines.forEach((l: string) => {
    doc.text(l, MARGIN + 6, y);
    y += 4.2;
  });
  doc.setFont("helvetica", "normal");
  y += 6;

  // ── ARTICLE 1: ORGANIZATION ──
  y = addArticleTitle(doc, y, "1", "Organization");

  y = addSectionTitle(doc, y, "1.1 — Formation of LLC");
  y = addParagraph(doc, y,
    `The Member has formed a Wisconsin Limited Liability Company named ${companyName}, LLC by filing the Articles of Organization with the office in the State of Wisconsin on ${filingDate}. The operation of the Company shall be governed by the terms of this Agreement and the applicable laws of the State of Wisconsin relating to the formation, operation and taxation of a LLC, specifically the provisions under Chapter 183 of the Wisconsin State Statutes which set out the guidelines and procedures for the formation and operation of a LLC hereinafter collectively referred to as the "Statutes." To the extent permitted by the Statutes, the terms and provisions of this Agreement shall control in the event there is a conflict between the Statutes and this Agreement.`
  );

  y = addSectionTitle(doc, y, "1.2 — Purposes and Powers");
  y = addParagraph(doc, y,
    `(a) The purposes of the Company shall be: (i) ${purpose}; and (ii) To perform or engage in any and all activities and/or businesses for which limited liability companies may be engaged under the Statutes.`
  );
  y = addParagraph(doc, y,
    `(b) The Company shall have all powers necessary and convenient to affect any purpose for which it is formed, including all powers granted by the Statutes.`
  );

  y = addSectionTitle(doc, y, "1.3 — Duration");
  y = addParagraph(doc, y,
    `The Company shall continue in existence until dissolved, liquidated or terminated in accordance with the provisions of this Agreement and, to the extent not otherwise superseded by this Agreement, the Statutes.`
  );

  y = addSectionTitle(doc, y, "1.4 — Registered Office and Resident Agent");
  y = addParagraph(doc, y,
    `The Registered Office and Resident Agent of the Company shall be as designated in the initial Articles of Organization/Certificate of Organization or any amendment thereof. The Registered Office and/or Resident Agent may be changed from time to time. Any such change shall be made in accordance with the Statutes, or, if different from the Statutes, in accordance with the provisions of this Agreement. If the Resident Agent shall ever resign, the Company shall promptly appoint a successor agent.`
  );

  // ── ARTICLE 2: CAPITAL CONTRIBUTIONS AND DISTRIBUTIONS ──
  y = addArticleTitle(doc, y, "2", "Capital Contributions and Distributions");
  y = addParagraph(doc, y,
    `The Member may make such capital contributions (each a "Capital Contribution") in such amounts and at such times as the Member shall determine. The Member shall not be obligated to make any Capital Contributions. The Member may take distributions of the capital from time to time in accordance with the limitations imposed by the Statutes.`
  );

  // ── ARTICLE 3: BOOKS, RECORDS AND ACCOUNTING ──
  y = addArticleTitle(doc, y, "3", "Books, Records and Accounting");

  y = addSectionTitle(doc, y, "3.1 — Books and Records");
  y = addParagraph(doc, y,
    `The Company shall maintain complete and accurate books and records of the Company's business and affairs as required by the Statutes and such books and records shall be kept at the Company's Registered Office and shall in all respects be independent of the books, records and transactions of the Member.`
  );

  y = addSectionTitle(doc, y, "3.2 — Fiscal Year; Accounting");
  y = addParagraph(doc, y,
    `The Company's fiscal year shall be the calendar year with an ending month of ${fiscalYearEnd}.`
  );

  // ── ARTICLE 4: MEMBER'S CAPITAL ACCOUNTS ──
  y = addArticleTitle(doc, y, "4", "Member's Capital Accounts");
  y = addParagraph(doc, y,
    `A Capital Account for the Member shall be maintained by the Company. The Member's Capital Account shall reflect the Member's capital contributions and increases for any net income or gain of the Company. The Member's Capital Account shall also reflect decreases for distributions made to the Member and the Member's share of any losses and deductions of the Company.`
  );

  // ── ARTICLE 5: TAX TREATMENT ──
  y = addArticleTitle(doc, y, "5", "U.S. Federal / Wisconsin State Income Tax Treatment");
  y = addParagraph(doc, y,
    `The Member intends that the Company, as a single member LLC, shall be taxed as a sole proprietorship in accordance with the provisions of the Internal Revenue Code. Any provisions herein that may cause the Company not to be taxed as a sole proprietorship shall be inoperative.`
  );

  // ── ARTICLE 6: RIGHTS, POWERS AND OBLIGATIONS ──
  y = addArticleTitle(doc, y, "6", "Rights, Powers and Obligations of Member");

  y = addSectionTitle(doc, y, "6.1 — Authority");
  y = addParagraph(doc, y,
    `${memberName}, as sole member of the Company, has sole authority and power to act for or on behalf of the Company, to do any act that would be binding on the Company, or incur any expenditures on behalf of the Company.`
  );

  y = addSectionTitle(doc, y, "6.2 — Liability to Third Parties");
  y = addParagraph(doc, y,
    `The Member shall not be liable for the debts, obligations or liabilities of the Company, including under a judgment, decree or order of a court.`
  );

  y = addSectionTitle(doc, y, "6.3 — Management");
  y = addParagraph(doc, y,
    `The Company is organized as a "member-managed" limited liability company. The Member is designated as the initial managing member.`
  );

  y = addSectionTitle(doc, y, "6.4 — Ownership of Company Property");
  y = addParagraph(doc, y,
    `The Company's assets shall be deemed owned by the Company as an entity, and the Member shall have no ownership interest in such assets or any portion thereof. Title to any or all such Company assets may be held in the name of the Company, one or more nominees or in "street name," as the Member may determine.`
  );

  y = addSectionTitle(doc, y, "6.5 — Other Activities");
  y = addParagraph(doc, y,
    `Except as limited by the Statutes, the Member may engage in other business ventures of any nature, including, without limitation by specification, the ownership of another business similar to that operated by the Company. The Company shall not have any right or interest in any such independent ventures or to the income and profits derived therefrom.`
  );

  // ── ARTICLE 7: LIMITATION OF LIABILITY; INDEMNIFICATION ──
  y = addArticleTitle(doc, y, "7", "Limitation of Liability; Indemnification");

  y = addSectionTitle(doc, y, "7.1 — Limitation of Liability and Indemnification of Member");

  y = addParagraph(doc, y,
    `(i) The Member (including, for purposes of this Section, any estate, heir, personal representative, receiver, trustee, successor, assignee and/or transferee of the Member) shall not be liable, responsible or accountable, in damages or otherwise, to the Company or any other person for: (i) any act performed, or the omission to perform any act, within the scope of the power and authority conferred on the Member by this agreement and/or by the Statutes except by reason of acts or omissions found by a court of competent jurisdiction upon entry of a final judgment rendered and un-appealable or not timely appealed ("Judicially Determined") to constitute fraud, gross negligence, recklessness or intentional misconduct; (ii) the termination of the Company and this Agreement pursuant to the terms hereof; (iii) the performance by the Member of, or the omission by the Member to perform, any act which the Member reasonably believed to be consistent with the advice of attorneys, accountants or other professional advisers to the Company with respect to matters relating to the Company, including actions or omissions determined to constitute violations of law but which were not undertaken in bad faith; or (iv) the conduct of any person selected or engaged by the Member.`
  );

  y = addParagraph(doc, y,
    `(ii) The Company, its receivers, trustees, successors, assignees and/or transferees shall indemnify, defend and hold the Member harmless from and against any and all liabilities, damages, losses, costs and expenses of any nature whatsoever, known or unknown, liquidated or unliquidated, that are incurred by the Member (including amounts paid in satisfaction of judgments, in settlement of any action, suit, demand, investigation, claim or proceeding ("Claim"), as fines or penalties) and from and against all legal or other such costs as well as the expenses of investigating or defending against any Claim or threatened or anticipated Claim arising out of, connected with or relating to this Agreement, the Company or its business affairs in any way; provided, that the conduct of the Member which gave rise to the action against the Member is indemnifiable under the standards set forth in Section 7.1(i).`
  );

  y = addParagraph(doc, y,
    `(iii) Upon application, the Member shall be entitled to receive advances to cover the costs of defending or settling any Claim or any threatened or anticipated Claim against the Member that may be subject to indemnification hereunder upon receipt by the Company of any undertaking by or on behalf of the Member to repay such advances to the Company, without interest, if the Member is Judicially Determined not to be entitled to indemnification.`
  );

  y = addParagraph(doc, y,
    `(iv) All rights of the Member to indemnification under this Section 7.1 shall (i) be cumulative of, and in addition to, any right to which the Member may be entitled to by contract or as a matter of law or equity, and (ii) survive the dissolution, liquidation or termination of the Company as well as the death, removal, incompetency or insolvency of the Member.`
  );

  y = addParagraph(doc, y,
    `(v) The termination of any Claim or threatened Claim against the Member by judgment, order, settlement or upon a plea of nolo contendere or its equivalent shall not, of itself, cause the Member not to be entitled to indemnification as provided herein unless and until Judicially Determined to not be so entitled.`
  );

  // ── ARTICLE 8: DEATH, DISABILITY, DISSOLUTION ──
  y = addArticleTitle(doc, y, "8", "Death, Disability, Dissolution");

  y = addSectionTitle(doc, y, "8.1 — Death of Member");
  y = addParagraph(doc, y,
    `Upon the death of the Member, the Company shall be dissolved. By separate written documentation, the Member shall designate and appoint the individual who will wind down the Company's business and transfer or distribute the Member's Interests and Capital Account as designated by the Member or as may otherwise be required by law.`
  );

  y = addSectionTitle(doc, y, "8.2 — Disability of Member");
  y = addParagraph(doc, y,
    `Upon the disability of a Member, the Member may continue to act as Manager hereunder or appoint a person to so serve until the Member's Interests and Capital Account of the Member have been transferred or distributed.`
  );

  y = addSectionTitle(doc, y, "8.3 — Dissolution");
  y = addParagraph(doc, y,
    `The Company shall dissolve and its affairs shall be wound up on the first to occur of: (i) At a time, or upon the occurrence of an event specified in the Articles of Organization or this Agreement. (ii) The determination by the Member that the Company shall be dissolved.`
  );

  // ── ARTICLE 9: MISCELLANEOUS PROVISIONS ──
  y = addArticleTitle(doc, y, "9", "Miscellaneous Provisions");

  y = addSectionTitle(doc, y, "9.1 — Article Headings");
  y = addParagraph(doc, y,
    `The Article headings and numbers contained in this Agreement have been inserted only as a matter of convenience and for reference, and in no way shall be construed to define, limit or describe the scope or intent of any provision of this Agreement.`
  );

  y = addSectionTitle(doc, y, "9.2 — Entire Agreement");
  y = addParagraph(doc, y,
    `This Agreement constitutes the entire agreement between the Member and the Company. This Agreement supersedes any and all other agreements, either oral or written, between said parties with respect to the subject matter hereof.`
  );

  y = addSectionTitle(doc, y, "9.3 — Severability");
  y = addParagraph(doc, y,
    `The invalidity or unenforceability of any particular provision of this Agreement shall not affect the other provisions hereof, and this Agreement shall be construed in all respects as if such invalid or unenforceable provisions were omitted.`
  );

  y = addSectionTitle(doc, y, "9.4 — Amendment");
  y = addParagraph(doc, y,
    `This Agreement may be amended or revoked at any time by a written document executed by the Member.`
  );

  y = addSectionTitle(doc, y, "9.5 — Binding Effect");
  y = addParagraph(doc, y,
    `Subject to the provisions of this Agreement relating to transferability, this Agreement will be binding upon and shall inure to the benefit of the parties, and their respective distributees, heirs, successors and assigns.`
  );

  y = addSectionTitle(doc, y, "9.6 — Governing Law");
  y = addParagraph(doc, y,
    `This Agreement is being executed and delivered in the State of Wisconsin and shall be governed by, construed and enforced in accordance with the laws of the State of Wisconsin.`
  );

  // ── SIGNATURE PAGE ──
  doc.addPage();
  y = 30;
  doc.setFontSize(11);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(50, 50, 50);
  const witnessText = `IN WITNESS WHEREOF, the Member has hereunto set such Member's hand as of the day and year first above written.`;
  const wLines = doc.splitTextToSize(witnessText, pw(doc) - MARGIN * 2);
  wLines.forEach((l: string) => { doc.text(l, cx, y, { align: "center" }); y += 4.5; });
  y += 10;

  // Company name
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`${companyName}, LLC`, MARGIN, y);
  y += 15;

  // Managing Member Signature
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("MANAGING MEMBER'S SIGNATURE", MARGIN, y);
  y += 3;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 90, y);
  y += 15;

  // Print Name
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("PRINT NAME", MARGIN, y);
  y += 3;
  doc.line(MARGIN, y, MARGIN + 90, y);

  addFooters(doc, companyName);
  return doc;
}
