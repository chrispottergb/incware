import jsPDF from "jspdf";
import { format } from "date-fns";
import { registerArialFont } from "@/lib/arial-font";
import type { NonProfitGovernanceData } from "@/components/meeting/NonProfitGovernanceStep";

// -----------------------------------------------------------------------------
// Nonprofit annual meeting minutes renderer.
//
// Compensation amounts and detailed financial figures are intentionally NOT
// interpolated into the rendered document. They live in the structured data
// (NonProfitGovernanceData) for reports and Form 990 prep only. Only non-
// sensitive placeholders like fiscal years and names of officers being elected
// are merged into the text.
// -----------------------------------------------------------------------------

export interface NonProfitAnnualMeetingData {
  companyName: string;
  meetingDate: string;      // yyyy-MM-dd
  meetingTime: string;
  meetingLocation: string;
  chairperson: string;
  secretary: string;
  priorMeetingDate: string; // yyyy-MM-dd
  attendees: { name: string; title?: string }[];
  quorumConfirmed?: boolean;
  governance: NonProfitGovernanceData;
  /**
   * "directors" (default) — Annual Meeting of Directors (board-only nonprofits).
   * "members" — Annual Meeting of Members (membership-based nonprofits): the
   * membership convenes, confirms member quorum, and elects directors.
   * Governance content (fund accounting, compensation, COI, 990, etc.) is
   * identical for both scopes; only title, opening, quorum, and elections
   * wording change.
   */
  meetingScope?: "directors" | "members";

  /** Ratified interim actions (optional — printed only when the ratification sweep supplies them). */
  ratifications?: { action_date: string | null; description: string; amount: number | null; is_related_party: boolean }[];
  ratificationPeriod?: { start: string; end: string };
}


const BLUE = { r: 31, g: 78, b: 121 };
const BODY_COLOR: [number, number, number] = [40, 40, 40];

function fmtDate(iso: string, fallback = "[Date]") {
  if (!iso) return fallback;
  try {
    return format(new Date(iso + "T12:00:00"), "MMMM d, yyyy");
  } catch {
    return fallback;
  }
}

export function generateNonProfitAnnualMeetingPDF(data: NonProfitAnnualMeetingData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  try {
    registerArialFont(doc);
    doc.setLineHeightFactor(1.15);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 90;
    const rMargin = 54;
    const contentWidth = pw - margin - rMargin;
    let y = margin;

    const corp = data.companyName || "[Nonprofit Corporation Name]";
    const footerText = `${corp} — Annual Meeting Minutes`;
    let sectionNumber = 0;

    function addFooter(d: jsPDF) {
      const totalPages = d.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        d.setPage(i);
        d.setFontSize(8);
        d.setFont("Arial", "normal");
        d.setTextColor(120, 120, 120);
        d.text(footerText, pw / 2, ph - 30, { align: "center" });
        d.text(`Page ${i} of ${totalPages}`, pw - rMargin, ph - 30, { align: "right" });
      }
    }
    function checkPage(needed = 80) {
      if (y + needed > ph - 72) {
        doc.addPage();
        y = margin;
      }
    }
    function sectionHeading(text: string) {
      sectionNumber++;
      checkPage(50);
      y += 12;
      doc.setFontSize(11);
      doc.setFont("Arial", "bold");
      doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
      doc.text(`${sectionNumber}. ${text.toUpperCase()}`, margin, y);
      y += 5;
      doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setLineWidth(1);
      doc.line(margin, y, pw - rMargin, y);
      y += 14;
    }
    function para(text: string, indent = 0) {
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      for (const line of lines) {
        checkPage(18);
        doc.text(line, margin + indent, y);
        y += 16;
      }
      y += 4;
    }
    function bullets(items: string[], indent = 12) {
      for (const item of items) {
        para(`• ${item}`, indent);
      }
    }

    const gov = data.governance;
    const meetingDateStr = fmtDate(data.meetingDate);
    const chair = data.chairperson || "[Chairperson]";
    const secretary = data.secretary || "[Secretary]";
    const time = data.meetingTime || "[Time]";
    const location = data.meetingLocation || "[Location]";

    const scope = data.meetingScope === "members" ? "members" : "directors";
    const attendeeNoun = scope === "members" ? "members" : "directors";
    const titleText = scope === "members" ? "ANNUAL MEETING OF MEMBERS" : "ANNUAL MEETING MINUTES";
    const bodyName = scope === "members" ? "membership" : "Board of Directors";

    // ===== 1. TITLE =====
    doc.setFontSize(14);
    doc.setFont("Arial", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(titleText, pw / 2, y, { align: "center" });
    y += 14;
    doc.setFontSize(12);
    doc.text(corp.toUpperCase(), pw / 2, y, { align: "center" });
    y += 28;

    // 2. Meeting held
    sectionHeading("Meeting");
    const openingSubject = scope === "members"
      ? `The Annual Meeting of the Members of ${corp}`
      : `The Annual Meeting of ${corp}`;
    para(`${openingSubject} was held on ${meetingDateStr} at ${location}, or by remote communication as permitted by the Corporation's bylaws.`);

    // 3. Call to order / attendees / quorum
    sectionHeading("Call to Order");
    const attendeesList = (data.attendees ?? []).map(a => a.name).filter(Boolean);
    const attendeesText = attendeesList.length > 0
      ? attendeesList.join(", ")
      : (scope === "members" ? "[Members Present]" : "[Directors Present]");
    const quorumText = scope === "members"
      ? `The meeting was called to order by ${chair} at ${time}. The following members were present in person or by proxy: ${attendeesText}. A quorum of the membership was confirmed.`
      : `The meeting was called to order by ${chair} at ${time}. The following directors were present: ${attendeesText}. A quorum was confirmed.`;
    para(quorumText);

    // 4. Notice
    sectionHeading("Notice of Meeting");
    if (gov.noticeType === "waived") {
      const waivedBy = scope === "members" ? "all members entitled to notice" : "all directors entitled to notice";
      para(`Notice of the meeting was waived in writing by ${waivedBy}.`);
    } else {
      para("Notice of the meeting was duly given in accordance with the Corporation's bylaws.");
    }


    // 5. Prior minutes
    sectionHeading("Approval of Prior Minutes");
    const priorStr = data.priorMeetingDate ? fmtDate(data.priorMeetingDate) : "the previous annual meeting";
    para(`The minutes of ${data.priorMeetingDate ? `the meeting held on ${priorStr}` : priorStr} were presented and, upon motion duly made and seconded, were approved as presented.`);

    // 6. Activities & operations
    sectionHeading("Review of Activities & Operations");
    para("The officers and directors reviewed the Corporation's activities and operations for the year. Program, finance, and compliance reports were presented and discussed.");
    if (gov.missionStatementReview?.trim()) {
      para(`The Board reaffirmed the Corporation's mission: ${gov.missionStatementReview.trim()}`);
    }
    if (gov.programServiceAccomplishments?.trim()) {
      para("The Board reviewed the Corporation's principal program service accomplishments for the year.");
    }

    // 7. Fund review paragraph
    sectionHeading("Fund Review");
    para("The Board reviewed the Corporation's funds, including net assets without donor restrictions, net assets with donor restrictions (including any endowment funds subject to donor stipulations), and any board-designated funds, and confirmed that all such funds have been administered consistent with donor intent and applicable law.");

    // 8. Fund actions
    sectionHeading("Fund Actions");
    const fundLines: { label: string; values: string[]; none: boolean }[] = [
      { label: "Funds established during the year", values: gov.funds.established, none: gov.funds.establishedNone },
      { label: "Donor-restricted funds received during the year", values: gov.funds.donorRestricted, none: gov.funds.donorRestrictedNone },
      { label: "Endowment funds established or modified during the year", values: gov.funds.endowment, none: gov.funds.endowmentNone },
      { label: "Restrictions satisfied or released during the year", values: gov.funds.restrictionsReleased, none: gov.funds.restrictionsReleasedNone },
      { label: "Board-designated funds established, modified, or terminated", values: gov.funds.boardDesignated, none: gov.funds.boardDesignatedNone },
    ];
    for (const group of fundLines) {
      para(`${group.label}:`);
      if (group.none || group.values.filter(v => v.trim()).length === 0) {
        bullets(["None"]);
      } else {
        bullets(group.values.filter(v => v.trim()));
      }
    }

    // 9. Treasurer's report
    sectionHeading("Treasurer's Report");
    const fyCur = gov.treasurerFiscalYearCurrent || "[Year]";
    const fyPri = gov.treasurerFiscalYearPrior || "[Year]";
    para(`The Treasurer presented a comparative financial summary for the fiscal years ended ${fyCur} and ${fyPri}. After review and discussion, the Board determined that the Corporation's financial records accurately reflected its financial condition and accepted the Treasurer's report.`);

    // 10. Budget approval
    sectionHeading("Budget Approval");
    const budgetFy = gov.budgetFiscalYear || "[Year]";
    if (gov.budgetApproved) {
      para(`Upon motion duly made and seconded, the Board approved the operating budget for the fiscal year ${budgetFy} as presented.`);
    } else {
      para(`The operating budget for the fiscal year ${budgetFy} was presented and discussed; final approval was deferred.`);
    }

    // 11. Compensation review — general language only, no figures/names
    sectionHeading("Compensation Review");
    para("The Board reviewed the compensation of the Executive Director and other key employees, including comparability data for similarly situated positions at comparable organizations. Based on this review, the Board (with any interested directors abstaining) determined that current compensation arrangements are reasonable and approved them as presented.");

    // 12. Conflict of interest
    sectionHeading("Conflict of Interest");
    const disclosures = gov.conflictDisclosures.filter(d => d.trim());
    if (gov.conflictDisclosuresNone || disclosures.length === 0) {
      para("No conflicts of interest were disclosed by directors or officers during the year.");
    } else {
      para("The following conflict of interest disclosures were made during the year:");
      bullets(disclosures);
    }
    if (gov.coiPolicyReaffirmed) {
      para("The Board reaffirmed the Corporation's Conflict of Interest Policy and confirmed that all directors and officers remain bound by its terms.");
    }

    // 13. Form 990 review
    sectionHeading("Form 990 Review");
    const f990Fy = gov.form990FiscalYear || "[Year]";
    if (gov.form990ReviewedPriorToFiling) {
      para(`The Board reviewed the Corporation's Form 990 for the fiscal year ${f990Fy} prior to its filing with the Internal Revenue Service, consistent with IRS governance recommendations.`);
    } else {
      para(`The Corporation's Form 990 for the fiscal year ${f990Fy} was discussed; the Board directed that it be circulated for review prior to filing.`);
    }

    // 14. Outside professionals
    sectionHeading("Outside Professionals");
    const atty = gov.outsideAttorneyName?.trim() || "[Attorney/Firm]";
    const acct = gov.outsideAccountantName?.trim() || "[Accountant/Firm]";
    if (gov.outsideEngagementChanged) {
      const details = gov.outsideChangeDetails.filter(d => d.trim());
      para(`The Board reviewed the Corporation's outside professional engagements. Legal counsel: ${atty}. Accounting professionals: ${acct}. Changes in engagement occurred during the year as follows:`);
      if (gov.outsideChangeDetailsNone || details.length === 0) {
        bullets(["None"]);
      } else {
        bullets(details);
      }
    } else {
      para(`The Board confirmed the continued engagement of the Corporation's legal counsel, ${atty}, and accounting professionals, ${acct}, for the ensuing year.`);
    }

    // 15. Elections of directors and officers
    sectionHeading("Election of Directors and Officers");
    const directors = gov.electedDirectors.filter(d => d.trim());
    const electorPhrase = scope === "members"
      ? "The following persons were elected by the members to serve as directors of the Corporation for the ensuing year:"
      : "The following persons were elected to serve as directors of the Corporation for the ensuing year:";
    if (directors.length > 0) {
      para(electorPhrase);
      bullets(directors);
    } else {
      para(scope === "members"
        ? "The members acted on the election of directors for the ensuing year."
        : "The Board acted on the election of directors for the ensuing year.");
    }

    const officers = gov.electedOfficers.filter(o => o.name.trim() || o.role.trim());
    if (officers.length > 0) {
      const combinedNote = gov.chairpersonCombinedWithPresident
        ? " The offices of Chairperson and President are held by the same individual as reflected below."
        : " The offices of Chairperson and President are held separately as reflected below.";
      para(`The following persons were elected to serve as officers of the Corporation for the ensuing year:${combinedNote}`);
      bullets(officers.map(o => `${o.role || "[Office]"} — ${o.name || "[Name]"}`));
    }

    // 16. Banking / signing authority
    sectionHeading("Banking and Signing Authority");
    const bankNames = gov.bankNames.filter(b => b.trim());
    const signers = gov.bankCurrentSigners.filter(s => s.name.trim() || s.title.trim());
    const bankPhrase = bankNames.length > 0 ? bankNames.join(", ") : "[Bank Name]";
    para(`The Board confirmed the Corporation's depository relationship(s) with ${bankPhrase} and designated the following individuals as authorized signers on the Corporation's accounts:`);
    if (signers.length > 0) {
      bullets(signers.map(s => `${s.name || "[Name]"}${s.title ? `, ${s.title}` : ""}`));
    } else {
      bullets(["[Authorized Signer], [Title]"]);
    }
    if (gov.bankPriorAuthorizationsRevoked) {
      para("All prior signing authorizations for individuals no longer serving in the designated offices are hereby revoked.");
    }

    // 17. Next meeting
    sectionHeading("Next Annual Meeting");
    const nextDate = gov.nextMeetingDate ? fmtDate(gov.nextMeetingDate) : "[Date]";
    const nextLoc = gov.nextMeetingLocation?.trim() || "[Location]";
    para(`The next Annual Meeting of the Corporation is scheduled for ${nextDate} at ${nextLoc}.`);

    // Ratification of actions taken during the year (narrative form for nonprofits).
    // Always printed: an empty sweep prints an express negative statement.
    {
      const ratified = (data.ratifications ?? []).filter(r => (r?.description || "").trim().length > 0);
      const ordinary = ratified.filter(r => !r.is_related_party);
      const related = ratified.filter(r => r.is_related_party);
      const ps = data.ratificationPeriod?.start;
      const pe = data.ratificationPeriod?.end;
      const periodPhrase = ps && pe ? `during the period from ${fmtDate(ps)} through ${fmtDate(pe)}` : "since the last annual meeting";
      const lineFor = (r: { action_date: string | null; description: string; amount: number | null }) => {
        const d = r.action_date ? fmtDate(r.action_date) : "Date not recorded";
        const amt = r.amount != null ? ` in the amount of $${Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
        return `${d} \u2014 ${r.description}${amt}.`;
      };

      sectionHeading("Ratification of Actions Taken During the Year");
      if (ratified.length === 0) {
        para("No actions requiring ratification were presented at this meeting.");
        para(`Upon motion duly made and seconded, all lawful acts taken by the officers and agents of the Corporation on its behalf since the last annual meeting were ratified, approved, and confirmed.`);
      } else {
        if (ordinary.length > 0) {
          para(
            `The board reviewed actions taken on behalf of the Corporation ${periodPhrase} without formal action at a meeting. Upon motion duly made and seconded, each of the following actions was ratified, approved, and confirmed in all respects as the act of the Corporation:`
          );
          ordinary.forEach(r => para(lineFor(r), 12));
        }
        para(
          "Upon further motion duly made and seconded, all other lawful acts taken by the officers and agents of the Corporation on its behalf since the last annual meeting, to the extent not separately ratified above, were ratified, approved, and confirmed."
        );
      }

      para(
        "The Board further authorized the officers to continue conducting the ordinary business and affairs of the Corporation — including banking, purchasing, contracting, leasing, and employment matters arising in the ordinary course — without further Board action, until this authority is modified or revoked."
      );

      if (related.length > 0) {
        sectionHeading("Interested Transactions");
        para("The following transactions were entered into with a party related to one or more directors or officers of the Corporation, and the material facts of each relationship and of each transaction were disclosed to and known by the Board:");
        related.forEach(r => para(lineFor(r), 12));
        para("The disinterested directors, having considered the terms of each of the foregoing transactions, determined that the terms are fair to the organization and no less favorable than could reasonably have been obtained from an unrelated party, and ratified, confirmed, and approved each such transaction.");
      }
    }


    // 18. Other business
    sectionHeading("Other Business");
    if (gov.otherBusiness?.trim()) {
      para(gov.otherBusiness.trim());
    } else {
      para("No other business came before the meeting.");
    }

    // 19. Adjournment
    sectionHeading("Adjournment");
    para(`There being no further business, the meeting was adjourned at ${gov.adjournmentTime?.trim() || "[Time]"}.`);

    // 20. Certification
    sectionHeading("Certification");
    const certDate = gov.certificationDate ? fmtDate(gov.certificationDate) : "[Date]";
    para(`These minutes were reviewed and approved by the Board of Directors on ${certDate}.`);

    // 21. Secretary signature line
    checkPage(80);
    y += 20;
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + 260, y);
    y += 14;
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    doc.text(`${secretary}, Secretary`, margin, y);

    addFooter(doc);
    return doc;
  } catch (err) {
    console.error("generateNonProfitAnnualMeetingPDF error:", err);
    return doc;
  }
}
