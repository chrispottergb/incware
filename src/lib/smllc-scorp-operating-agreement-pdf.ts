import jsPDF from "jspdf";
import { registerArialFont } from "@/lib/arial-font";

// S-Corp Sole Member Operating Agreement — fork of smllc-operating-agreement-pdf.ts.
// Shares layout, margins, fonts, article/section helpers. Differences:
//   - Article 5 (Tax Treatment) — S-corp election under IRC § 1362, controls over default LLC treatment
//   - Article 2 (Distributions) — pro rata to ownership %, single class of membership interest
//   - Article 6.6 (Officer / Compensation) — reasonable W-2 compensation before distributions
//   - Article 7 (Transfer Restrictions) — S-corp-eligible holders only (renumbers subsequent articles)
//   - Amendment savings clause — no amendment jeopardizing S-election

const MARGIN = 31.75; // 1.25 inch left margin for 3-hole punch binder filing
const R_MARGIN = 19.05; // 0.75 inch right margin
const BRAND = "EntityIQ";
const FOOTER_LABEL_PREFIX = "S-Corp Sole Member Operating Agreement";

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
  const lines = doc.splitTextToSize(text, pw(doc) - indent - R_MARGIN);
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
  doc.setFont("Arial", "bold");
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
  y = checkBreak(doc, y, 16);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text(label, MARGIN, y);
  return y + 8;
}

function addFooters(doc: jsPDF, companyName: string) {
  const count = doc.getNumberOfPages();
  for (let i = 2; i <= count; i++) {
    doc.setPage(i);
    doc.setFontSize(11);
    doc.setTextColor(160, 160, 160);
    doc.text(`${FOOTER_LABEL_PREFIX} — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - R_MARGIN, ph(doc) - 8, { align: "right" });
  }
}

export interface SMScorpOperatingAgreementData {
  company: any;
  members: any[];
}

export function generateSMScorpOperatingAgreementPDF(data: SMScorpOperatingAgreementData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const { company, members } = data;
  const cx = pw(doc) / 2;

  const rawName = company.name || "_______________";
  const companyBase = rawName.replace(/[,\s]+L\.?\s*L\.?\s*C\.?\s*$/i, "").trim() || rawName;
  const companyName = companyBase;
  const memberName = members.length > 0 ? members[0].name : "_______________";
  const filingDate = company.filing_date
    ? new Date(company.filing_date + "T00:00:00").toLocaleDateString()
    : "_______________, 20___";
  const sElectionDate = company.s_election_date
    ? new Date(company.s_election_date + "T00:00:00").toLocaleDateString()
    : "_______________, 20___";
  const purpose = company.business_purpose || "_______________";
  const fiscalYearEnd = company.fiscal_year_end || "December";

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
  doc.text("Taxed as an S Corporation under IRC § 1362", cx, 58, { align: "center" });

  doc.setDrawColor(140, 40, 30);
  doc.setLineWidth(1.5);
  doc.line(40, 68, pw(doc) - 40, 68);
  doc.setLineWidth(0.3);
  doc.line(40, 70, pw(doc) - 40, 70);

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("SOLE MEMBER", cx, 88, { align: "center" });
  doc.text("OPERATING AGREEMENT", cx, 96, { align: "center" });
  doc.text("(S CORPORATION ELECTION)", cx, 104, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(140, 80, 40);
  const nameLines = doc.splitTextToSize(companyName, pw(doc) - 60);
  let cy = 125;
  nameLines.forEach((l: string) => { doc.text(l, cx, cy, { align: "center" }); cy += 8; });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("A Wisconsin Limited Liability Company", cx, cy + 5, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Effective Date: ${filingDate}`, cx, cy + 20, { align: "center" });
  doc.text(`S-Election Effective Date: ${sElectionDate}`, cx, cy + 27, { align: "center" });
  doc.text(`Prepared by ${BRAND}`, cx, cy + 34, { align: "center" });

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
    "Article 1 — Organization",
    "Article 2 — Capital Contributions and Distributions (Pro Rata; Single Class of Interest)",
    "Article 3 — Books, Records and Accounting",
    "Article 4 — Member's Capital Accounts",
    "Article 5 — U.S. Federal / Wisconsin State Income Tax Treatment (S Corporation Election)",
    "Article 6 — Rights, Powers and Obligations of Member; Reasonable Compensation",
    "Article 7 — Transfer Restrictions (S-Corp Eligibility)",
    "Article 8 — Limitation of Liability; Indemnification",
    "Article 9 — Death, Disability, Dissolution",
    "Article 10 — Miscellaneous Provisions (S-Election Savings Clause)",
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
  doc.text("SOLE MEMBER OPERATING AGREEMENT (S CORPORATION ELECTION)", cx, y, { align: "center" });
  y += 15;

  y = addParagraph(doc, y,
    `THIS OPERATING AGREEMENT ("Agreement") is made and entered into as of ${filingDate}, by and among ${companyName}, LLC, a Wisconsin Limited Liability Company (the "Company") and ${memberName}, executing this Agreement as the sole member of the Company (the "Member"). The Company has elected, effective ${sElectionDate}, to be taxed as an S corporation under Section 1362 of the Internal Revenue Code, and this Agreement is entered into to reflect and preserve that election.`
  );
  y += 3;

  doc.setFontSize(11);
  doc.setFont("Arial", "italic");
  doc.setTextColor(85, 85, 85);
  const considLines = doc.splitTextToSize(
    "NOW, THEREFORE, for good and valuable consideration the receipt and sufficiency of which is hereby acknowledged, it is agreed as follows:",
    pw(doc) - MARGIN - R_MARGIN - 10
  );
  y = checkBreak(doc, y, considLines.length * 4.2 + 6);
  doc.setDrawColor(200, 185, 154);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y - 2, MARGIN, y + considLines.length * 4.2 + 2);
  considLines.forEach((l: string) => {
    doc.text(l, MARGIN + 6, y);
    y += 4.2;
  });
  doc.setFont("Arial", "normal");
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

  // ── ARTICLE 2: CAPITAL CONTRIBUTIONS AND DISTRIBUTIONS (S-CORP) ──
  y = addArticleTitle(doc, y, "2", "Capital Contributions and Distributions");

  y = addSectionTitle(doc, y, "2.1 — Capital Contributions");
  y = addParagraph(doc, y,
    `The Member may make such capital contributions (each a "Capital Contribution") in such amounts and at such times as the Member shall determine. The Member shall not be obligated to make any Capital Contributions.`
  );

  y = addSectionTitle(doc, y, "2.2 — Single Class of Membership Interest");
  y = addParagraph(doc, y,
    `The Company shall at all times have only one class of membership interest outstanding, conferring identical rights to distributions and liquidation proceeds, as required to maintain the Company's S corporation election under IRC § 1361(b)(1)(D). The Company shall not create, issue, or authorize any interest, security, agreement, or arrangement that would result in the Company being treated as having more than one class of stock for purposes of Subchapter S of the Internal Revenue Code.`
  );

  y = addSectionTitle(doc, y, "2.3 — Distributions Pro Rata");
  y = addParagraph(doc, y,
    `All distributions of cash or other property by the Company shall be made strictly pro rata in proportion to each member's ownership percentage of the Company's membership interest as of the date of distribution. So long as the Member is the sole member, all distributions shall be made to the Member. If additional members are ever admitted, no distribution, allocation, redemption, or other economic right shall be made or granted on a non-pro-rata basis or in a manner that would create a second class of stock under IRC § 1361 and the Treasury Regulations thereunder. Distributions shall be subject to the limitations imposed by the Statutes and Section 6.6 below (Reasonable Compensation Priority).`
  );

  // ── ARTICLE 3: BOOKS, RECORDS AND ACCOUNTING ──
  y = addArticleTitle(doc, y, "3", "Books, Records and Accounting");

  y = addSectionTitle(doc, y, "3.1 — Books and Records");
  y = addParagraph(doc, y,
    `The Company shall maintain complete and accurate books and records of the Company's business and affairs as required by the Statutes and such books and records shall be kept at the Company's Registered Office and shall in all respects be independent of the books, records and transactions of the Member.`
  );

  y = addSectionTitle(doc, y, "3.2 — Fiscal Year; Accounting");
  y = addParagraph(doc, y,
    `The Company's fiscal year shall be the calendar year with an ending month of ${fiscalYearEnd}, subject to any permissible tax year required or permitted for S corporations under IRC § 1378.`
  );

  y = addSectionTitle(doc, y, "3.3 — Payroll and Employment Tax Reporting");
  y = addParagraph(doc, y,
    `The Company shall maintain payroll records and file all employment tax returns (including Forms W-2, 941, and 940) required for compensation paid to the Member in the Member's capacity as an officer or employee of the Company under Section 6.6.`
  );

  // ── ARTICLE 4: MEMBER'S CAPITAL ACCOUNTS ──
  y = addArticleTitle(doc, y, "4", "Member's Capital Accounts");
  y = addParagraph(doc, y,
    `A Capital Account for the Member shall be maintained by the Company. The Member's Capital Account shall reflect the Member's capital contributions and increases for any net income or gain of the Company. The Member's Capital Account shall also reflect decreases for distributions made to the Member and the Member's share of any losses and deductions of the Company. The Company shall also maintain an Accumulated Adjustments Account (AAA) and any other tax-basis accounts required or advisable for an S corporation under IRC § 1368 and the Treasury Regulations.`
  );

  // ── ARTICLE 5: TAX TREATMENT (S CORP) ──
  y = addArticleTitle(doc, y, "5", "U.S. Federal / Wisconsin State Income Tax Treatment");

  y = addSectionTitle(doc, y, "5.1 — S Corporation Election");
  y = addParagraph(doc, y,
    `The Member and the Company intend that the Company be classified and taxed as an S corporation under Subchapter S of the Internal Revenue Code, having timely filed IRS Form 2553 electing such treatment under IRC § 1362, effective as of ${sElectionDate}. The Company shall file all federal and Wisconsin returns consistent with such election, including IRS Form 1120-S.`
  );

  y = addSectionTitle(doc, y, "5.2 — S-Election Controls");
  y = addParagraph(doc, y,
    `This Article 5 shall control over any conflicting default LLC or "disregarded entity" tax treatment that would otherwise apply. Any provision of this Agreement, and any action of the Member, that would cause the Company to be taxed other than as an S corporation, or that would cause a termination or invalidation of the Company's S election under IRC § 1362(d), shall be inoperative to the extent of such conflict, unless the Member has expressly and in writing elected to terminate the S election.`
  );

  y = addSectionTitle(doc, y, "5.3 — Cooperation");
  y = addParagraph(doc, y,
    `The Member shall take all commercially reasonable actions, and shall refrain from taking any action, that is necessary to preserve the Company's S corporation status, including (i) not admitting any ineligible shareholder (see Article 7), (ii) not creating any second class of stock (see Section 2.2), and (iii) timely filing all required consents, elections, and returns.`
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
    `Except as limited by the Statutes, the Member may engage in other business ventures of any nature. The Company shall not have any right or interest in any such independent ventures or to the income and profits derived therefrom.`
  );

  y = addSectionTitle(doc, y, "6.6 — Officer Status and Reasonable Compensation");
  y = addParagraph(doc, y,
    `The Member is hereby authorized to serve as an officer and employee of the Company, including as its President, Treasurer, and Secretary. To the extent the Member performs services for the Company that are more than minor, the Company shall pay the Member reasonable compensation for such services, reported on IRS Form W-2 and subject to applicable employment taxes (FICA and FUTA), consistent with the reasonable compensation requirement applicable to S corporation shareholder-employees under IRC §§ 3121, 3306, 3401 and the authorities interpreting them (including Rev. Rul. 74-44 and its progeny).`
  );
  y = addParagraph(doc, y,
    `Reasonable compensation shall be determined by reference to what would be paid for comparable services by comparable enterprises under similar circumstances, taking into account the Member's duties, time devoted, skills, and industry norms. Reasonable W-2 compensation to the Member for services rendered shall be paid, accrued, and reported before any profit distributions are made to the Member under Section 2.3.`
  );

  // ── ARTICLE 7: TRANSFER RESTRICTIONS ──
  y = addArticleTitle(doc, y, "7", "Transfer Restrictions (S-Corp Eligibility)");

  y = addSectionTitle(doc, y, "7.1 — Restrictions on Transfer");
  y = addParagraph(doc, y,
    `Notwithstanding any other provision of this Agreement, no membership interest in the Company (nor any economic, voting, or beneficial interest therein) may be sold, assigned, transferred, pledged, hypothecated, or otherwise disposed of, whether voluntarily, involuntarily, by operation of law, by gift, or upon death, disability, dissolution of marriage, bankruptcy, or incapacity, to any person or entity that is not an "Eligible S Corporation Shareholder" as defined in Section 7.2. Any purported transfer in violation of this Article 7 shall be void ab initio, of no force or effect, and shall not be recognized by the Company.`
  );

  y = addSectionTitle(doc, y, "7.2 — Eligible S Corporation Shareholders");
  y = addParagraph(doc, y,
    `"Eligible S Corporation Shareholder" means only those persons and entities permitted to hold shares in an S corporation under IRC § 1361(b), including: (i) individuals who are U.S. citizens or U.S. tax residents; (ii) estates of deceased Members and estates of bankrupt Members, for the period permitted under IRC § 1361; (iii) qualifying trusts, including grantor trusts (during the grantor's life and for the two-year post-death period), qualified subchapter S trusts (QSSTs) that have made a valid election under IRC § 1361(d), and electing small business trusts (ESBTs) that have made a valid election under IRC § 1361(e); and (iv) tax-exempt organizations described in IRC § 401(a) or § 501(c)(3). "Eligible S Corporation Shareholder" expressly excludes (A) corporations (other than qualified subchapter S subsidiaries), (B) partnerships, (C) limited liability companies treated as partnerships for federal tax purposes, and (D) non-resident aliens.`
  );

  y = addSectionTitle(doc, y, "7.3 — Death or Incapacity");
  y = addParagraph(doc, y,
    `Upon the death or incapacity of the Member, the Member's membership interest shall pass only to a person or entity that qualifies as an Eligible S Corporation Shareholder. If the estate, heirs, personal representative, guardian, or conservator of the Member is not an Eligible S Corporation Shareholder, the Company shall have the right (but not the obligation) to redeem the Member's interest at fair market value in order to preserve the Company's S election, and the successor holder shall be prohibited from exercising any rights of ownership other than to receive the redemption proceeds.`
  );

  y = addSectionTitle(doc, y, "7.4 — Cap Table Legend");
  y = addParagraph(doc, y,
    `Any certificate, statement of interest, or other instrument evidencing membership in the Company shall bear a legend substantially in the following form: "THE MEMBERSHIP INTERESTS EVIDENCED HEREBY ARE SUBJECT TO TRANSFER RESTRICTIONS SET FORTH IN THE COMPANY'S OPERATING AGREEMENT INTENDED TO PRESERVE THE COMPANY'S S CORPORATION ELECTION UNDER IRC § 1362. TRANSFER TO ANY PERSON OR ENTITY THAT IS NOT AN 'ELIGIBLE S CORPORATION SHAREHOLDER' IS VOID."`
  );

  // ── ARTICLE 8: LIMITATION OF LIABILITY; INDEMNIFICATION ──
  y = addArticleTitle(doc, y, "8", "Limitation of Liability; Indemnification");

  y = addSectionTitle(doc, y, "8.1 — Limitation of Liability and Indemnification of Member");

  y = addParagraph(doc, y,
    `(i) The Member (including, for purposes of this Section, any estate, heir, personal representative, receiver, trustee, successor, assignee and/or transferee of the Member) shall not be liable, responsible or accountable, in damages or otherwise, to the Company or any other person for: (i) any act performed, or the omission to perform any act, within the scope of the power and authority conferred on the Member by this Agreement and/or by the Statutes except by reason of acts or omissions found by a court of competent jurisdiction upon entry of a final judgment rendered and un-appealable or not timely appealed ("Judicially Determined") to constitute fraud, gross negligence, recklessness or intentional misconduct; (ii) the termination of the Company and this Agreement pursuant to the terms hereof; (iii) the performance by the Member of, or the omission by the Member to perform, any act which the Member reasonably believed to be consistent with the advice of attorneys, accountants or other professional advisers to the Company with respect to matters relating to the Company, including actions or omissions determined to constitute violations of law but which were not undertaken in bad faith; or (iv) the conduct of any person selected or engaged by the Member.`
  );

  y = addParagraph(doc, y,
    `(ii) The Company, its receivers, trustees, successors, assignees and/or transferees shall indemnify, defend and hold the Member harmless from and against any and all liabilities, damages, losses, costs and expenses of any nature whatsoever, known or unknown, liquidated or unliquidated, that are incurred by the Member (including amounts paid in satisfaction of judgments, in settlement of any action, suit, demand, investigation, claim or proceeding ("Claim"), as fines or penalties) and from and against all legal or other such costs as well as the expenses of investigating or defending against any Claim or threatened or anticipated Claim arising out of, connected with or relating to this Agreement, the Company or its business affairs in any way; provided, that the conduct of the Member which gave rise to the action against the Member is indemnifiable under the standards set forth in Section 8.1(i).`
  );

  y = addParagraph(doc, y,
    `(iii) Upon application, the Member shall be entitled to receive advances to cover the costs of defending or settling any Claim or any threatened or anticipated Claim against the Member that may be subject to indemnification hereunder upon receipt by the Company of any undertaking by or on behalf of the Member to repay such advances to the Company, without interest, if the Member is Judicially Determined not to be entitled to indemnification.`
  );

  y = addParagraph(doc, y,
    `(iv) All rights of the Member to indemnification under this Section 8.1 shall (i) be cumulative of, and in addition to, any right to which the Member may be entitled to by contract or as a matter of law or equity, and (ii) survive the dissolution, liquidation or termination of the Company as well as the death, removal, incompetency or insolvency of the Member.`
  );

  y = addParagraph(doc, y,
    `(v) The termination of any Claim or threatened Claim against the Member by judgment, order, settlement or upon a plea of nolo contendere or its equivalent shall not, of itself, cause the Member not to be entitled to indemnification as provided herein unless and until Judicially Determined to not be so entitled.`
  );

  // ── ARTICLE 9: DEATH, DISABILITY, DISSOLUTION ──
  y = addArticleTitle(doc, y, "9", "Death, Disability, Dissolution");

  y = addSectionTitle(doc, y, "9.1 — Death of Member");
  y = addParagraph(doc, y,
    "Upon the death of the Member, the Member's interest shall pass to the Member's heirs or estate, subject in all respects to the Eligible S Corporation Shareholder requirements set forth in Article 7. The Company shall not be dissolved unless required by law."
  );

  y = addSectionTitle(doc, y, "9.2 — Disability of Member");
  y = addParagraph(doc, y,
    `Upon the disability of the Member, the Member may continue to act as Manager hereunder or appoint a person to so serve until the Member's Interests and Capital Account of the Member have been transferred or distributed in accordance with Article 7.`
  );

  y = addSectionTitle(doc, y, "9.3 — Dissolution");
  y = addParagraph(doc, y,
    `The Company shall dissolve and its affairs shall be wound up on the first to occur of: (i) At a time, or upon the occurrence of an event specified in the Articles of Organization or this Agreement. (ii) The determination by the Member that the Company shall be dissolved.`
  );

  // ── ARTICLE 10: MISCELLANEOUS ──
  y = addArticleTitle(doc, y, "10", "Miscellaneous Provisions");

  y = addSectionTitle(doc, y, "10.1 — Article Headings");
  y = addParagraph(doc, y,
    `The Article headings and numbers contained in this Agreement have been inserted only as a matter of convenience and for reference, and in no way shall be construed to define, limit or describe the scope or intent of any provision of this Agreement.`
  );

  y = addSectionTitle(doc, y, "10.2 — Entire Agreement");
  y = addParagraph(doc, y,
    `This Agreement constitutes the entire agreement between the Member and the Company. This Agreement supersedes any and all other agreements, either oral or written, between said parties with respect to the subject matter hereof, including without limitation any prior Operating Agreement executed before the Company's S corporation election.`
  );

  y = addSectionTitle(doc, y, "10.3 — Severability");
  y = addParagraph(doc, y,
    `The invalidity or unenforceability of any particular provision of this Agreement shall not affect the other provisions hereof, and this Agreement shall be construed in all respects as if such invalid or unenforceable provisions were omitted.`
  );

  y = addSectionTitle(doc, y, "10.4 — Amendment; S-Election Savings Clause");
  y = addParagraph(doc, y,
    `This Agreement may be amended or revoked at any time by a written document executed by the Member; provided, however, that no amendment shall be made, and no provision of any amendment shall be given effect, if such amendment would (or would reasonably be expected to) cause a termination, revocation, or invalidation of the Company's S corporation election under IRC § 1362, unless such amendment is expressly designated in writing by the Member as being intended to terminate the S election. Any amendment inadvertently made in violation of the foregoing shall be deemed automatically modified to the minimum extent necessary to preserve the S election, or, if such modification is not possible, shall be void ab initio.`
  );

  y = addSectionTitle(doc, y, "10.5 — Binding Effect");
  y = addParagraph(doc, y,
    `Subject to the provisions of this Agreement relating to transferability (including Article 7), this Agreement will be binding upon and shall inure to the benefit of the parties, and their respective distributees, heirs, successors and assigns.`
  );

  y = addSectionTitle(doc, y, "10.6 — Governing Law");
  y = addParagraph(doc, y,
    `This Agreement is being executed and delivered in the State of Wisconsin and shall be governed by, construed and enforced in accordance with the laws of the State of Wisconsin, except that all matters relating to the Company's federal tax status shall be governed by the Internal Revenue Code and the Treasury Regulations.`
  );

  // ── SIGNATURE PAGE ──
  doc.addPage();
  y = 30;
  doc.setFontSize(11);
  doc.setFont("Arial", "italic");
  doc.setTextColor(50, 50, 50);
  const witnessText = `IN WITNESS WHEREOF, the Member has hereunto set such Member's hand as of the day and year first above written.`;
  const wLines = doc.splitTextToSize(witnessText, pw(doc) - MARGIN - R_MARGIN);
  wLines.forEach((l: string) => { doc.text(l, cx, y, { align: "center" }); y += 4.5; });
  y += 10;

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`${companyName}, LLC`, MARGIN, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("MANAGING MEMBER'S SIGNATURE", MARGIN, y);
  y += 3;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 90, y);
  y += 15;

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("PRINT NAME", MARGIN, y);
  y += 3;
  doc.line(MARGIN, y, MARGIN + 90, y);

  addFooters(doc, companyName);
  return doc;
}
