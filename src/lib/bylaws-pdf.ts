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

export interface BylawsData {
  company: any;
  directors: any[];
  officers: any[];
  shareholders: any[];
  aiDraftSections?: Record<string, string> | null;
}

export function generateBylawsPDF(data: BylawsData): jsPDF {
  const doc = new jsPDF();
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const { company, directors, officers, shareholders, aiDraftSections } = data;
  const cx = pw(doc) / 2;
  const ai = aiDraftSections || {};

  const companyName = company.name || "_______________";
  const state = company.state_of_incorporation || "Wisconsin";
  const raName = company.registered_agent_name || "_______________";
  const raAddress = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ") || "_______________";
  const purpose = company.business_purpose || "any lawful business purpose permitted under the Wisconsin Business Corporation Law";
  const incDate = company.incorporation_date ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString() : "_______________";
  const fiscalYearEnd = company.fiscal_year_end || "December 31";
  const authorizedShares = company.authorized_shares?.toLocaleString() || "_______________";
  const parValue = company.par_value ? `$${Number(company.par_value).toFixed(2)}` : "no par value";
  const isSCorp = company.entity_type === "S-Corp";
  const statuteRef = isSCorp ? "Wis. Stat. Ch. 180 (with IRC § 1362 S-Election)" : "Wis. Stat. Ch. 180";

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
  doc.text(`${statuteRef} — Wisconsin Business Corporation Law`, cx, 52, { align: "center" });

  doc.setDrawColor(40, 80, 160);
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
  doc.text(`(${company.entity_type})`, cx, 94, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(140, 80, 40);
  const nameLines = doc.splitTextToSize(companyName, pw(doc) - 60);
  let cy = 115;
  nameLines.forEach((l: string) => { doc.text(l, cx, cy, { align: "center" }); cy += 8; });

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`A Wisconsin ${company.entity_type}`, cx, cy + 5, { align: "center" });

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
    "I. Offices",
    "II. Shareholders",
    "III. Board of Directors",
    "IV. Officers",
    "V. Stock",
    "VI. Dividends and Distributions",
    "VII. Indemnification",
    "VIII. Books and Records",
    "IX. Fiscal Year",
    "X. Corporate Seal",
    "XI. Amendments",
    "XII. Miscellaneous Provisions",
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

  const preamble = ai.preamble || `These Bylaws ("Bylaws") are adopted for the governance of ${companyName}, a Wisconsin ${company.entity_type} (the "Corporation"), incorporated under the Wisconsin Business Corporation Law, ${statuteRef}, effective as of ${incDate}.`;
  y = addParagraph(doc, y, preamble);

  // ── ARTICLE I: OFFICES ──
  y = addArticleTitle(doc, y, "I", "Offices");
  y = addSectionTitle(doc, y, "Section 1.1 — Principal Office");
  const addr = [company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "_______________";
  y = addParagraph(doc, y, ai.principalOffice || `The principal office of the Corporation shall be located at ${addr}, or at such other place as the Board of Directors may from time to time designate.`);
  y = addSectionTitle(doc, y, "Section 1.2 — Registered Office and Agent");
  y = addParagraph(doc, y, `The registered office of the Corporation shall be located at ${raAddress}, and the registered agent at such address is ${raName}, as required by Wis. Stat. § 180.0501.`);
  y = addSectionTitle(doc, y, "Section 1.3 — Other Offices");
  y = addParagraph(doc, y, `The Corporation may have such other offices, within or without the State of ${state}, as the Board of Directors may from time to time determine or as the business of the Corporation may require.`);

  // ── ARTICLE II: SHAREHOLDERS ──
  y = addArticleTitle(doc, y, "II", "Shareholders");
  y = addSectionTitle(doc, y, "Section 2.1 — Annual Meeting");
  y = addParagraph(doc, y, ai.annualMeeting || `The annual meeting of shareholders shall be held ${company.scheduled_annual_meeting || "at such date and time as determined by the Board of Directors"} for the purpose of electing directors and transacting such other business as may properly come before the meeting, pursuant to Wis. Stat. § 180.0701.`);
  y = addSectionTitle(doc, y, "Section 2.2 — Special Meetings");
  y = addParagraph(doc, y, ai.specialMeetings || `Special meetings of the shareholders may be called by the Board of Directors, the President, or by holders of not less than ten percent (10%) of all votes entitled to be cast on any issue proposed to be considered at the meeting, pursuant to Wis. Stat. § 180.0702.`);
  y = addSectionTitle(doc, y, "Section 2.3 — Notice of Meetings");
  y = addParagraph(doc, y, `Written notice stating the place, day, and hour of the meeting, and in the case of a special meeting, the purpose(s) for which the meeting is called, shall be delivered not less than ten (10) nor more than sixty (60) days before the date of the meeting to each shareholder of record entitled to vote at such meeting, as required by Wis. Stat. § 180.0705.`);
  y = addSectionTitle(doc, y, "Section 2.4 — Quorum");
  y = addParagraph(doc, y, ai.quorum || `A majority of the votes entitled to be cast on a matter by a voting group constitutes a quorum of that voting group for action on that matter, pursuant to Wis. Stat. § 180.0725.`);
  y = addSectionTitle(doc, y, "Section 2.5 — Voting");
  y = addParagraph(doc, y, `Each outstanding share shall be entitled to one vote on each matter submitted to a vote at a meeting of shareholders, unless otherwise provided by the Articles of Incorporation. Shareholders may vote in person or by proxy appointed in writing, as provided by Wis. Stat. § 180.0721 and § 180.0722.`);
  y = addSectionTitle(doc, y, "Section 2.6 — Action Without Meeting");
  y = addParagraph(doc, y, `Any action required or permitted to be taken at a shareholders' meeting may be taken without a meeting if the action is taken by all shareholders entitled to vote on the action, pursuant to Wis. Stat. § 180.0704.`);

  // Shareholders table
  if (shareholders.length > 0) {
    y = checkBreak(doc, y, 20);
    autoTable(doc, {
      startY: y,
      head: [["Shareholder Name", "Address", "City/State/Zip", "Status"]],
      body: shareholders.map((s) => [
        s.name,
        s.address || "—",
        [s.city, s.state, s.zip].filter(Boolean).join(", ") || "—",
        s.status || "Active",
      ]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── ARTICLE III: BOARD OF DIRECTORS ──
  y = addArticleTitle(doc, y, "III", "Board of Directors");
  y = addSectionTitle(doc, y, "Section 3.1 — General Powers");
  y = addParagraph(doc, y, ai.boardPowers || `The business and affairs of the Corporation shall be managed under the direction of the Board of Directors, except as otherwise provided in the Articles of Incorporation or the Wisconsin Business Corporation Law, pursuant to Wis. Stat. § 180.0801.`);
  y = addSectionTitle(doc, y, "Section 3.2 — Number and Qualification");
  const dirCount = company.initial_directors_count || directors.length || "___";
  const maxDir = company.max_directors_allowed ? `, but not more than ${company.max_directors_allowed}` : "";
  y = addParagraph(doc, y, ai.boardNumber || `The number of directors of the Corporation shall be ${dirCount}${maxDir}. The number of directors may be increased or decreased from time to time by amendment to these Bylaws, but no decrease shall have the effect of shortening the term of any incumbent director. Directors need not be shareholders or residents of the State of Wisconsin.`);
  y = addSectionTitle(doc, y, "Section 3.3 — Election and Term");
  y = addParagraph(doc, y, `Directors shall be elected at the annual meeting of shareholders and shall hold office until the next annual meeting of shareholders and until their successors are elected and qualified, or until their earlier resignation, removal, or death, pursuant to Wis. Stat. § 180.0803 and § 180.0805.`);
  y = addSectionTitle(doc, y, "Section 3.4 — Vacancies");
  y = addParagraph(doc, y, `Any vacancy on the Board of Directors, including a vacancy resulting from an increase in the number of directors, may be filled by the affirmative vote of a majority of the remaining directors, even though less than a quorum, pursuant to Wis. Stat. § 180.0810.`);
  y = addSectionTitle(doc, y, "Section 3.5 — Regular Meetings");
  y = addParagraph(doc, y, ai.boardMeetings || `Regular meetings of the Board of Directors may be held at such times and places as the Board may determine. A regular meeting of the Board may be held without notice immediately after and at the same place as the annual meeting of shareholders.`);
  y = addSectionTitle(doc, y, "Section 3.6 — Special Meetings");
  y = addParagraph(doc, y, `Special meetings of the Board of Directors may be called by the President or any two directors upon not less than two (2) days' notice to each director, as provided by Wis. Stat. § 180.0822.`);
  y = addSectionTitle(doc, y, "Section 3.7 — Quorum and Voting");
  y = addParagraph(doc, y, `A majority of the number of directors fixed by these Bylaws shall constitute a quorum for the transaction of business. The act of a majority of directors present at a meeting at which a quorum is present shall be the act of the Board, pursuant to Wis. Stat. § 180.0824.`);
  y = addSectionTitle(doc, y, "Section 3.8 — Compensation");
  y = addParagraph(doc, y, `Directors may receive such compensation for their services as may be fixed by resolution of the Board of Directors, pursuant to Wis. Stat. § 180.0811.`);

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
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── ARTICLE IV: OFFICERS ──
  y = addArticleTitle(doc, y, "IV", "Officers");
  y = addSectionTitle(doc, y, "Section 4.1 — Designation");
  y = addParagraph(doc, y, ai.officers || `The officers of the Corporation shall consist of a President, a Secretary, and a Treasurer, and may include one or more Vice Presidents and such other officers as the Board of Directors may from time to time appoint. Any two or more offices may be held by the same person, except the offices of President and Secretary, pursuant to Wis. Stat. § 180.0840.`);

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

  y = addSectionTitle(doc, y, "Section 4.2 — President");
  y = addParagraph(doc, y, `The President shall be the chief executive officer of the Corporation and shall, subject to the control of the Board of Directors, have general supervision of the business and affairs of the Corporation. The President shall preside at all meetings of the shareholders and Board of Directors.`);
  y = addSectionTitle(doc, y, "Section 4.3 — Secretary");
  y = addParagraph(doc, y, `The Secretary shall keep the minutes of all meetings of shareholders and of the Board of Directors, shall have charge of the corporate seal and the corporate records, and shall give notice of meetings as required by law or these Bylaws.`);
  y = addSectionTitle(doc, y, "Section 4.4 — Treasurer");
  y = addParagraph(doc, y, `The Treasurer shall have custody of all funds and securities of the Corporation, shall keep full and accurate accounts of receipts and disbursements, and shall render statements of accounts when requested by the Board of Directors or the President.`);
  y = addSectionTitle(doc, y, "Section 4.5 — Removal");
  y = addParagraph(doc, y, `Any officer may be removed by the Board of Directors at any time, with or without cause, pursuant to Wis. Stat. § 180.0843. Removal shall be without prejudice to the contract rights, if any, of the officer so removed.`);

  // ── ARTICLE V: STOCK ──
  y = addArticleTitle(doc, y, "V", "Stock");
  y = addSectionTitle(doc, y, "Section 5.1 — Certificates");
  y = addParagraph(doc, y, ai.stock || `Shares of stock of the Corporation may be represented by certificates or may be uncertificated shares, as determined by the Board of Directors, pursuant to Wis. Stat. § 180.0625 and § 180.0626. The Corporation is authorized to issue ${authorizedShares} shares at ${parValue} per share.`);
  y = addSectionTitle(doc, y, "Section 5.2 — Transfer of Shares");
  y = addParagraph(doc, y, `Shares of stock shall be transferable on the books of the Corporation only by the holder of record thereof, in person or by duly authorized attorney, upon surrender of the certificate(s) representing such shares, properly endorsed, or upon receipt of proper transfer instructions from the owner of uncertificated shares, pursuant to Wis. Stat. § 180.0627.`);
  y = addSectionTitle(doc, y, "Section 5.3 — Record Date");
  y = addParagraph(doc, y, `The Board of Directors may fix a record date for determining the shareholders entitled to notice of or to vote at any meeting, or entitled to receive a dividend, pursuant to Wis. Stat. § 180.0707. The record date shall not be more than seventy (70) days before the meeting or action requiring a determination of shareholders.`);

  if (isSCorp) {
    y = addSectionTitle(doc, y, "Section 5.4 — S-Corporation Restrictions");
    y = addParagraph(doc, y, `The Corporation has elected to be treated as an S-Corporation under IRC § 1362. No transfer of shares shall be permitted that would cause the Corporation to cease to qualify as an S-Corporation. The Corporation shall have only one class of stock. ${company.s_election_date ? `The S-Election was effective as of ${new Date(company.s_election_date + "T00:00:00").toLocaleDateString()}.` : ""}`);
  }

  // ── ARTICLE VI: DIVIDENDS ──
  y = addArticleTitle(doc, y, "VI", "Dividends and Distributions");
  y = addParagraph(doc, y, ai.dividends || `The Board of Directors may, from time to time, declare and the Corporation may pay dividends on its outstanding shares in the manner and upon the terms and conditions provided by the Wisconsin Business Corporation Law and the Articles of Incorporation, pursuant to Wis. Stat. § 180.0640. No dividend shall be declared or paid if, after giving it effect, the Corporation would be unable to pay its debts as they become due in the usual course of business, or the Corporation's total assets would be less than the sum of its total liabilities.`);

  // ── ARTICLE VII: INDEMNIFICATION ──
  y = addArticleTitle(doc, y, "VII", "Indemnification");
  y = addParagraph(doc, y, ai.indemnification || `The Corporation shall indemnify any director, officer, employee, or agent of the Corporation who was or is a party or is threatened to be made a party to any action, suit, or proceeding, whether civil, criminal, administrative, or investigative, by reason of the fact that such person is or was serving in such capacity, to the fullest extent authorized by Wis. Stat. § 180.0851 through § 180.0859. The Corporation may purchase and maintain insurance on behalf of such persons against any liability asserted against such person in such capacity, whether or not the Corporation would have the power to indemnify such person against such liability.`);

  // ── ARTICLE VIII: BOOKS AND RECORDS ──
  y = addArticleTitle(doc, y, "VIII", "Books and Records");
  y = addParagraph(doc, y, ai.booksAndRecords || `The Corporation shall keep at its principal office: (a) minutes of all meetings of shareholders and the Board of Directors; (b) appropriate accounting records; (c) a record of its shareholders; and (d) copies of the Articles of Incorporation and these Bylaws, including all amendments, as required by Wis. Stat. § 180.1601. Any shareholder may inspect and copy the records of the Corporation upon compliance with Wis. Stat. § 180.1602.`);

  // ── ARTICLE IX: FISCAL YEAR ──
  y = addArticleTitle(doc, y, "IX", "Fiscal Year");
  y = addParagraph(doc, y, `The fiscal year of the Corporation shall end on ${fiscalYearEnd} of each year, unless changed by resolution of the Board of Directors.`);

  // ── ARTICLE X: CORPORATE SEAL ──
  y = addArticleTitle(doc, y, "X", "Corporate Seal");
  const sealText = company.seal_type === "seal"
    ? `The Corporation shall have a corporate seal in such form as the Board of Directors may from time to time determine. The seal shall contain the name of the Corporation, the year of its incorporation, and the words "Corporate Seal" and "Wisconsin."`
    : `The Corporation shall not have a corporate seal. The absence of a corporate seal shall not affect the validity of any document or instrument executed on behalf of the Corporation.`;
  y = addParagraph(doc, y, sealText);

  // ── ARTICLE XI: AMENDMENTS ──
  y = addArticleTitle(doc, y, "XI", "Amendments");
  y = addParagraph(doc, y, ai.amendments || `These Bylaws may be amended or repealed, and new Bylaws may be adopted, by the Board of Directors, unless the Articles of Incorporation or the Wisconsin Business Corporation Law reserve such power exclusively to the shareholders, pursuant to Wis. Stat. § 180.1020. The shareholders may also amend or repeal these Bylaws, and any Bylaws adopted by the Board of Directors may be amended or repealed by the shareholders.`);

  // ── ARTICLE XII: MISCELLANEOUS ──
  y = addArticleTitle(doc, y, "XII", "Miscellaneous Provisions");
  y = addSectionTitle(doc, y, "Section 12.1 — Governing Law");
  y = addParagraph(doc, y, `These Bylaws shall be governed by and construed in accordance with the laws of the State of Wisconsin, including the Wisconsin Business Corporation Law, ${statuteRef}.`);
  y = addSectionTitle(doc, y, "Section 12.2 — Severability");
  y = addParagraph(doc, y, `If any provision of these Bylaws is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.`);
  y = addSectionTitle(doc, y, "Section 12.3 — Conflict with Articles of Incorporation");
  y = addParagraph(doc, y, `In the event of any conflict between these Bylaws and the Articles of Incorporation, the Articles of Incorporation shall control.`);

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

  // Signature line
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
