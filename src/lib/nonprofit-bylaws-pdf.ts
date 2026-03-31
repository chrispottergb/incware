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
  const lines = doc.splitTextToSize(text, pw(doc) - indent - R_MARGIN);
  for (const line of lines) {
    y = checkBreak(doc, y, 6);
    doc.text(line, indent, y);
    y += 5.0;
  }
  return y + 4;
}

function addArticleTitle(doc: jsPDF, y: number, num: string, title: string): number {
  y = checkBreak(doc, y, 18);
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text(`ARTICLE ${num}`, pw(doc) / 2, y, { align: "center" });
  y += 6;
  doc.text(title.toUpperCase(), pw(doc) / 2, y, { align: "center" });
  y += 3;
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.4);
  doc.line(pw(doc) / 2 - 30, y, pw(doc) / 2 + 30, y);
  return y + 7;
}

function addSectionTitle(doc: jsPDF, y: number, label: string): number {
  y = checkBreak(doc, y, 18);
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
    doc.text(`Bylaws — ${companyName}`, MARGIN, ph(doc) - 8);
    doc.text(`Page ${i - 1} of ${count - 1}`, pw(doc) - R_MARGIN, ph(doc) - 8, { align: "right" });
  }
}

export interface NonprofitBylawsData {
  company: any;
  directors: any[];
  officers: any[];
  aiDraftSections?: Record<string, string> | null;
}

export function generateNonprofitBylawsPDF(data: NonprofitBylawsData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  const { company, directors, officers, aiDraftSections } = data;
  const cx = pw(doc) / 2;
  const ai = aiDraftSections || {};

  const companyName = company.name || "_______________";
  const state = company.state_of_incorporation || "Wisconsin";
  const raName = company.registered_agent_name || "_______________";
  const raAddress = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ") || "_______________";
  const purpose = company.business_purpose || "charitable, educational, religious, scientific, or literary purposes within the meaning of Section 501(c)(3) of the Internal Revenue Code";
  const incDate = company.incorporation_date ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString() : "_______________";
  const fiscalYearEnd = company.fiscal_year_end || "December 31";
  const statuteRef = "Wis. Stat. Ch. 181";

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
  doc.text(`${statuteRef} — Wisconsin Nonstock Corporation Law`, cx, 52, { align: "center" });

  doc.setDrawColor(40, 130, 80);
  doc.setLineWidth(1.5);
  doc.line(40, 62, pw(doc) - 40, 62);
  doc.setLineWidth(0.3);
  doc.line(40, 64, pw(doc) - 40, 64);

  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("BYLAWS", cx, 85, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("(Non-Profit Corporation)", cx, 94, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(140, 80, 40);
  const nameLines = doc.splitTextToSize(companyName, pw(doc) - 60);
  let cy = 115;
  nameLines.forEach((l: string) => { doc.text(l, cx, cy, { align: "center" }); cy += 8; });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("A Wisconsin Non-Profit Corporation", cx, cy + 5, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Incorporated: ${incDate}`, cx, cy + 20, { align: "center" });
  doc.text(`Prepared by ${BRAND}`, cx, cy + 27, { align: "center" });

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
    "I. Name and Purpose",
    "II. Offices",
    "III. Membership",
    "IV. Board of Directors",
    "V. Officers",
    "VI. Committees",
    "VII. Conflicts of Interest",
    "VIII. Indemnification",
    "IX. Books and Records",
    "X. Fiscal Year",
    "XI. Non-Discrimination",
    "XII. Dissolution",
    "XIII. Amendments",
    "XIV. Miscellaneous Provisions",
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
  doc.text("BYLAWS", cx, y, { align: "center" });
  doc.text(`OF ${companyName.toUpperCase()}`, cx, y + 6, { align: "center" });
  y += 15;

  const preamble = ai.preamble || `These Bylaws ("Bylaws") are adopted for the governance of ${companyName}, a Wisconsin non-profit, nonstock corporation (the "Corporation"), organized under the Wisconsin Nonstock Corporation Law, ${statuteRef}, effective as of ${incDate}.`;
  y = addParagraph(doc, y, preamble);

  // ── ARTICLE I: NAME AND PURPOSE ──
  y = addArticleTitle(doc, y, "I", "Name and Purpose");
  y = addSectionTitle(doc, y, "Section 1.1 — Name");
  y = addParagraph(doc, y, `The name of this corporation is ${companyName}.`);
  y = addSectionTitle(doc, y, "Section 1.2 — Purpose");
  y = addParagraph(doc, y, ai.purpose || `The Corporation is organized exclusively for ${purpose}. No part of the net earnings of the Corporation shall inure to the benefit of, or be distributable to, its directors, officers, or other private persons, except that the Corporation shall be authorized to pay reasonable compensation for services rendered and to make payments and distributions in furtherance of the purposes set forth herein.`);
  y = addSectionTitle(doc, y, "Section 1.3 — Powers");
  y = addParagraph(doc, y, ai.powers || `The Corporation shall have all powers conferred upon nonstock corporations under ${statuteRef} and such other powers as are not inconsistent with law. No substantial part of the activities of the Corporation shall consist of carrying on propaganda, or otherwise attempting to influence legislation, and the Corporation shall not participate in, or intervene in, any political campaign on behalf of or in opposition to any candidate for public office.`);

  // ── ARTICLE II: OFFICES ──
  y = addArticleTitle(doc, y, "II", "Offices");
  y = addSectionTitle(doc, y, "Section 2.1 — Principal Office");
  const addr = [company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "_______________";
  y = addParagraph(doc, y, ai.principalOffice || `The principal office of the Corporation shall be located at ${addr}, or at such other place as the Board of Directors may from time to time designate.`);
  y = addSectionTitle(doc, y, "Section 2.2 — Registered Office and Agent");
  y = addParagraph(doc, y, `The registered office of the Corporation shall be located at ${raAddress}, and the registered agent at such address is ${raName}, as required by Wis. Stat. § 181.0501.`);

  // ── ARTICLE III: MEMBERSHIP ──
  y = addArticleTitle(doc, y, "III", "Membership");
  y = addSectionTitle(doc, y, "Section 3.1 — Members");
  y = addParagraph(doc, y, ai.membership || `The Corporation may have one or more classes of members, or may be organized without members, as provided in the Articles of Incorporation, pursuant to Wis. Stat. § 181.0601. If the Corporation has no members, all rights and duties that would otherwise vest in the members shall vest in the Board of Directors, pursuant to Wis. Stat. § 181.0601(2).`);
  y = addSectionTitle(doc, y, "Section 3.2 — Meetings of Members");
  y = addParagraph(doc, y, ai.memberMeetings || `If the Corporation has members entitled to vote, annual meetings shall be held at a date, time, and place determined by the Board of Directors. Special meetings may be called by the Board, the President, or by members holding at least ten percent (10%) of the voting power, pursuant to Wis. Stat. § 181.0701 and § 181.0702.`);
  y = addSectionTitle(doc, y, "Section 3.3 — Notice and Quorum");
  y = addParagraph(doc, y, `Written notice of members' meetings shall be given not fewer than ten (10) nor more than sixty (60) days before the meeting date, pursuant to Wis. Stat. § 181.0705. A quorum at a meeting of members shall consist of a majority of the members entitled to vote, unless the Articles of Incorporation provide otherwise, pursuant to Wis. Stat. § 181.0725.`);

  // ── ARTICLE IV: BOARD OF DIRECTORS ──
  y = addArticleTitle(doc, y, "IV", "Board of Directors");
  y = addSectionTitle(doc, y, "Section 4.1 — General Powers");
  y = addParagraph(doc, y, ai.boardPowers || `The business and affairs of the Corporation shall be managed under the direction of the Board of Directors, except as otherwise provided in the Articles of Incorporation, pursuant to Wis. Stat. § 181.0801.`);
  y = addSectionTitle(doc, y, "Section 4.2 — Number and Qualification");
  const dirCount = company.initial_directors_count || directors.length || "___";
  const maxDir = company.max_directors_allowed ? `, but not more than ${company.max_directors_allowed}` : "";
  y = addParagraph(doc, y, ai.boardNumber || `The number of directors shall be ${dirCount}${maxDir}. Directors need not be residents of the State of Wisconsin.`);
  y = addSectionTitle(doc, y, "Section 4.3 — Election and Term");
  y = addParagraph(doc, y, ai.boardElection || `Directors shall be elected at the annual meeting of members (or by the Board if there are no members) and shall hold office until their successors are elected and qualified, or until their earlier resignation, removal, or death, pursuant to Wis. Stat. § 181.0803 and § 181.0805.`);
  y = addSectionTitle(doc, y, "Section 4.4 — Vacancies");
  y = addParagraph(doc, y, `Any vacancy on the Board of Directors may be filled by the affirmative vote of a majority of the remaining directors, even though less than a quorum, pursuant to Wis. Stat. § 181.0810.`);
  y = addSectionTitle(doc, y, "Section 4.5 — Meetings");
  y = addParagraph(doc, y, ai.boardMeetings || `Regular meetings of the Board of Directors may be held at such times and places as the Board may determine. Special meetings may be called by the President or any two directors upon not less than two (2) days' notice, pursuant to Wis. Stat. § 181.0822.`);
  y = addSectionTitle(doc, y, "Section 4.6 — Quorum and Voting");
  y = addParagraph(doc, y, `A majority of the number of directors shall constitute a quorum. The act of a majority of directors present at a meeting at which a quorum is present shall be the act of the Board, pursuant to Wis. Stat. § 181.0824.`);
  y = addSectionTitle(doc, y, "Section 4.7 — Compensation");
  y = addParagraph(doc, y, `Directors shall not receive compensation for their services as directors, but may be reimbursed for actual expenses incurred in the performance of their duties, unless the Board resolves otherwise in compliance with the Corporation's tax-exempt status.`);

  // Directors table
  if (directors.length > 0) {
    y = checkBreak(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Director Name", "Address", "City/State/Zip", "Date Added"]],
      body: directors.map((d) => [
        d.name,
        d.address || "—",
        [d.city, d.state, d.zip].filter(Boolean).join(", ") || "—",
        d.added_date ? new Date(d.added_date + "T00:00:00").toLocaleDateString() : "—",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 11, fontStyle: "bold" },
      bodyStyles: { fontSize: 11 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── ARTICLE V: OFFICERS ──
  y = addArticleTitle(doc, y, "V", "Officers");
  y = addSectionTitle(doc, y, "Section 5.1 — Designation");
  y = addParagraph(doc, y, ai.officers || `The officers of the Corporation shall consist of a President, a Secretary, and a Treasurer, and may include one or more Vice Presidents and such other officers as the Board may appoint, pursuant to Wis. Stat. § 181.0840.`);

  if (officers.length > 0) {
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

  y = addSectionTitle(doc, y, "Section 5.2 — Duties");
  y = addParagraph(doc, y, `The President shall be the chief executive officer and shall preside at all meetings. The Secretary shall keep minutes of all meetings and maintain corporate records. The Treasurer shall have custody of all funds and shall keep accurate financial records.`);
  y = addSectionTitle(doc, y, "Section 5.3 — Removal");
  y = addParagraph(doc, y, `Any officer may be removed by the Board of Directors at any time, with or without cause, pursuant to Wis. Stat. § 181.0843.`);

  // ── ARTICLE VI: COMMITTEES ──
  y = addArticleTitle(doc, y, "VI", "Committees");
  y = addParagraph(doc, y, ai.committees || `The Board of Directors may designate one or more committees, each consisting of two or more directors, which shall have such authority as the Board may delegate, pursuant to Wis. Stat. § 181.0825. Committees shall not have the power to (a) fill vacancies on the Board, (b) adopt, amend, or repeal the Bylaws, or (c) approve a plan of merger or dissolution.`);

  // ── ARTICLE VII: CONFLICTS OF INTEREST ──
  y = addArticleTitle(doc, y, "VII", "Conflicts of Interest");
  y = addSectionTitle(doc, y, "Section 7.1 — Duty to Disclose");
  y = addParagraph(doc, y, ai.conflictDisclosure || `Any director, officer, or committee member who has a direct or indirect financial interest in any matter under consideration by the Corporation shall disclose the existence and nature of such interest to the Board of Directors prior to any action being taken. This disclosure obligation applies to any transaction or arrangement where the interested person could potentially benefit.`);
  y = addSectionTitle(doc, y, "Section 7.2 — Determining Conflict");
  y = addParagraph(doc, y, ai.conflictDetermination || `After disclosure, the disinterested members of the Board shall determine whether a conflict of interest exists. A conflict of interest exists when the financial interest of the interested person could reasonably be seen as competing with the interests of the Corporation.`);
  y = addSectionTitle(doc, y, "Section 7.3 — Procedures");
  y = addParagraph(doc, y, `An interested person may make a presentation to the Board but shall leave the meeting during the discussion and vote on the matter. The Board shall determine by a majority vote of the disinterested directors whether the transaction is in the best interest of the Corporation, is fair and reasonable, and shall make its decision as to whether to enter into the transaction or arrangement, in conformity with Wis. Stat. § 181.0831.`);
  y = addSectionTitle(doc, y, "Section 7.4 — Violations");
  y = addParagraph(doc, y, `If the Board has reasonable cause to believe a person has failed to disclose an actual or possible conflict of interest, it shall inform the person and afford them an opportunity to explain. If, after hearing the response and making further investigation, the Board determines the person has failed to disclose a conflict, it shall take appropriate disciplinary and corrective action.`);
  y = addSectionTitle(doc, y, "Section 7.5 — Annual Statements");
  y = addParagraph(doc, y, `Each director, officer, and committee member shall annually sign a statement affirming that such person (a) has received a copy of the conflict of interest policy, (b) has read and understands the policy, (c) has agreed to comply with the policy, and (d) understands the Corporation is a tax-exempt organization and must engage primarily in activities which accomplish its exempt purposes.`);

  // ── ARTICLE VIII: INDEMNIFICATION ──
  y = addArticleTitle(doc, y, "VIII", "Indemnification");
  y = addParagraph(doc, y, ai.indemnification || `The Corporation shall indemnify any director, officer, employee, or agent who was or is a party to any action, suit, or proceeding by reason of serving in such capacity, to the fullest extent authorized by Wis. Stat. § 181.0851 through § 181.0859. The Corporation may purchase and maintain insurance on behalf of such persons.`);

  // ── ARTICLE IX: BOOKS AND RECORDS ──
  y = addArticleTitle(doc, y, "IX", "Books and Records");
  y = addParagraph(doc, y, ai.booksAndRecords || `The Corporation shall keep at its principal office: (a) minutes of all meetings of the Board of Directors and any members; (b) appropriate accounting records; (c) a list of directors and officers with addresses; and (d) copies of the Articles of Incorporation, these Bylaws, and all amendments, as required by Wis. Stat. § 181.1601. The Corporation shall also maintain records sufficient to demonstrate compliance with its tax-exempt purpose.`);

  // ── ARTICLE X: FISCAL YEAR ──
  y = addArticleTitle(doc, y, "X", "Fiscal Year");
  y = addParagraph(doc, y, `The fiscal year of the Corporation shall end on ${fiscalYearEnd} of each year, unless changed by resolution of the Board of Directors.`);

  // ── ARTICLE XI: NON-DISCRIMINATION ──
  y = addArticleTitle(doc, y, "XI", "Non-Discrimination");
  y = addParagraph(doc, y, ai.nonDiscrimination || `The Corporation shall not discriminate on the basis of race, color, religion, sex, sexual orientation, gender identity, national origin, age, disability, or veteran status in any of its activities, programs, or operations. This policy of non-discrimination extends to the selection of directors, officers, volunteers, and any recipients of services.`);

  // ── ARTICLE XII: DISSOLUTION ──
  y = addArticleTitle(doc, y, "XII", "Dissolution");
  y = addParagraph(doc, y, ai.dissolution || `Upon dissolution of the Corporation, the Board of Directors shall, after paying or making provision for payment of all liabilities, dispose of all remaining assets exclusively for the purposes of the Corporation in such manner, or to such organization or organizations organized and operated exclusively for charitable, educational, religious, or scientific purposes as shall at the time qualify as an exempt organization under Section 501(c)(3) of the Internal Revenue Code, as the Board shall determine, pursuant to Wis. Stat. § 181.1405. No assets shall be distributed to any director, officer, or private individual.`);

  // ── ARTICLE XIII: AMENDMENTS ──
  y = addArticleTitle(doc, y, "XIII", "Amendments");
  y = addParagraph(doc, y, ai.amendments || `These Bylaws may be amended or repealed, and new Bylaws may be adopted, by the Board of Directors, unless the Articles of Incorporation reserve such power exclusively to the members, pursuant to Wis. Stat. § 181.1020. Any amendments shall be consistent with the Corporation's Articles of Incorporation and its tax-exempt status.`);

  // ── ARTICLE XIV: MISCELLANEOUS ──
  y = addArticleTitle(doc, y, "XIV", "Miscellaneous Provisions");
  y = addSectionTitle(doc, y, "Section 14.1 — Governing Law");
  y = addParagraph(doc, y, `These Bylaws shall be governed by the laws of the State of Wisconsin, including the Wisconsin Nonstock Corporation Law, ${statuteRef}.`);
  y = addSectionTitle(doc, y, "Section 14.2 — Severability");
  y = addParagraph(doc, y, `If any provision of these Bylaws is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`);
  y = addSectionTitle(doc, y, "Section 14.3 — Tax-Exempt Status");
  y = addParagraph(doc, y, `Notwithstanding any other provision of these Bylaws, the Corporation shall not carry on any activities not permitted to be carried on by a corporation exempt from federal income tax under Section 501(c)(3) of the Internal Revenue Code, or the corresponding section of any future federal tax code.`);

  // ── CERTIFICATION PAGE ──
  doc.addPage();
  y = 30;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("CERTIFICATION", cx, y, { align: "center" });
  y += 10;
  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(50, 50, 50);
  const certText = `The undersigned, being the Secretary of ${companyName}, hereby certifies that the foregoing Bylaws were duly adopted by the Board of Directors of the Corporation.`;
  const cLines = doc.splitTextToSize(certText, pw(doc) - MARGIN - R_MARGIN);
  cLines.forEach((l: string) => { doc.text(l, cx, y, { align: "center" }); y += 4.5; });
  y += 20;

  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + 80, y);
  doc.line(pw(doc) - MARGIN - 50, y, pw(doc) - R_MARGIN, y);
  y += 4;
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const secName = officers.length > 0 && officers[0]?.secretary ? officers[0].secretary : "Secretary";
  doc.text(secName, MARGIN, y);
  doc.text("Date", pw(doc) - MARGIN - 50, y);

  addFooters(doc, companyName);
  return doc;
}
