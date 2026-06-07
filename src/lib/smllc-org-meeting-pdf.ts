import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { registerArialFont } from "@/lib/arial-font";
import type { OrgMeetingData } from "@/lib/org-meeting-pdf";

// Same palette as org-meeting-pdf.ts
const BLUE = { r: 31, g: 78, b: 121 }; // #1F4E79
const LIGHT_BLUE_BG: [number, number, number] = [214, 228, 240]; // #D6E4F0
const BODY_COLOR: [number, number, number] = [40, 40, 40];

/**
 * Plain-English Organizational Meeting Minutes PDF for single-member LLCs.
 * Uses Member / Managing Member terminology only — no Board, no officers,
 * no WHEREAS clauses, no compensation language.
 */
export function generateSmllcOrgMeetingPDF(data: OrgMeetingData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  try {
    registerArialFont(doc);
    doc.setLineHeightFactor(1.15);

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 90;   // 1.25" left binder margin
    const rMargin = 54;  // 0.75" right
    const contentWidth = pw - margin - rMargin;
    let y = margin;

    const baseName = (data.companyName || "").replace(/,?\s*LLC\.?$/i, "").trim();
    const llcName = `${baseName}, LLC`;
    const member = (data.members ?? [])[0];
    const managingMember =
      (data.managers ?? [])[0] ?? { name: member?.name ?? "", title: "Managing Member" };
    const chairperson = data.chairperson || member?.name || "";
    const secretary = data.secretary || member?.name || "";

    const formattedMeetingDate = data.meetingDate
      ? format(new Date(data.meetingDate + "T12:00:00"), "MMMM d, yyyy")
      : "[Date]";
    const dayOfWeek = data.meetingDate
      ? format(new Date(data.meetingDate + "T12:00:00"), "EEEE")
      : "[Day]";
    const formattedFilingDate = data.filingDate
      ? format(new Date(data.filingDate + "T12:00:00"), "MMMM d, yyyy")
      : "[Filing Date]";

    const footerText = `${llcName} — Organizational Meeting Minutes`;

    function addFooter() {
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("Arial", "normal");
        doc.setTextColor(120, 120, 120);
        doc.text(footerText, pw / 2, ph - 30, { align: "center" });
        doc.text(`Page ${i} of ${totalPages}`, pw - rMargin, ph - 30, { align: "right" });
      }
    }

    function checkPage(needed: number = 80) {
      if (y + needed > ph - 72) {
        doc.addPage();
        y = margin;
      }
    }

    function heading(text: string) {
      checkPage(60);
      y += 10;
      doc.setFontSize(11);
      doc.setFont("Arial", "bold");
      doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
      doc.text(text.toUpperCase(), margin, y);
      y += 5;
      doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
      doc.setLineWidth(1);
      doc.line(margin, y, pw - rMargin, y);
      y += 18;
    }

    function para(text: string, indent: number = 0) {
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const lines = doc.splitTextToSize(text, contentWidth - indent);
      for (const line of lines) {
        checkPage(18);
        doc.text(line, margin + indent, y);
        y += 16;
      }
      y += 8;
    }

    function resolvedPara(rest: string) {
      const indent = 36;
      const prefix = "RESOLVED, ";
      doc.setFontSize(11);
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const fullText = prefix + rest;
      const lines = doc.splitTextToSize(fullText, contentWidth - indent);
      checkPage(lines.length * 16 + 10);
      for (let i = 0; i < lines.length; i++) {
        const lineY = y + i * 16;
        if (i === 0) {
          doc.setFont("Arial", "bold");
          const prefixWidth = doc.getTextWidth(prefix);
          doc.text(prefix, margin + indent, lineY);
          doc.setFont("Arial", "normal");
          const remainder = lines[0].substring(prefix.length);
          if (remainder) doc.text(remainder, margin + indent + prefixWidth, lineY);
        } else {
          doc.setFont("Arial", "normal");
          doc.text(lines[i], margin + indent, lineY);
        }
      }
      y += lines.length * 16 + 10;
    }

    // ===== TITLE =====
    doc.setFontSize(14);
    doc.setFont("Arial", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text("ORGANIZATIONAL MEETING MINUTES", pw / 2, y, { align: "center" });
    y += 14;
    doc.setFontSize(12);
    doc.text(`OF ${llcName.toUpperCase()}`, pw / 2, y, { align: "center" });
    y += 32;

    // 1. Meeting Overview
    heading("Meeting Overview");
    para(
      `The organizational meeting of ${llcName}, a ${data.stateOfFormation || "[State]"} limited liability company, was held on ${dayOfWeek}, ${formattedMeetingDate}, at ${data.meetingTime || "[Time]"}, at ${data.meetingLocation || "[Location]"}. The sole Member was present. ${chairperson || "[Chairperson]"} acted as Chairperson and ${secretary || "[Secretary]"} acted as Secretary. The purpose of the meeting was to complete the organization of the Company and adopt initial resolutions.`
    );

    // 2. Confirmation of Formation
    heading("Confirmation of Formation");
    resolvedPara(
      `that the filing of the Articles of Organization with ${data.stateAgency || "[State Agency]"} on ${formattedFilingDate}, forming ${llcName} as a ${data.stateOfFormation || "[State]"} limited liability company, is ratified and confirmed.`
    );

    // 3. Registered Agent
    heading("Registered Agent");
    resolvedPara(
      `that ${data.registeredAgentName || "[Registered Agent]"}, located at ${data.registeredAgentAddress || "[Address]"}, is confirmed as the Company's registered agent.`
    );

    // 4. Fiscal Year & Accounting Method
    heading("Fiscal Year & Accounting Method");
    resolvedPara(
      `that the fiscal year of the Company shall end on ${data.fiscalYearEnd || "December 31"}, with the first fiscal year ending ${data.firstFiscalYearEnd || "[Year]"}, and that the Company shall keep its books on the ${data.accountingMethod || "cash"} method of accounting.`
    );

    // 5. Management
    heading("Management");
    resolvedPara(
      `that ${managingMember.name || "[Member Name]"} is appointed as the Managing Member with full authority to manage the business and affairs of the Company.`
    );

    // 6. Initial Member & Capital Contribution
    heading("Initial Member & Capital Contribution");
    resolvedPara(
      `that the following person is recognized as the initial and sole Member of the Company, having made the capital contribution described in the Company's records:`
    );
    {
      const usable = contentWidth;
      autoTable(doc, {
        startY: y,
        head: [["Name", "Address", "Units", "%"]],
        body: [[
          member?.name || "[Member Name]",
          member?.address || "[Address]",
          member?.membershipUnits || "[Units]",
          member?.membershipInterestPct ? `${member.membershipInterestPct}%` : "100%",
        ]],
        margin: { left: margin, right: rMargin },
        styles: { fontSize: 10, cellPadding: 6, font: "Arial" },
        headStyles: {
          fillColor: LIGHT_BLUE_BG,
          textColor: [BLUE.r, BLUE.g, BLUE.b],
          fontStyle: "normal",
          fontSize: 9,
        },
        theme: "grid",
        columnStyles: {
          0: { cellWidth: usable * 0.28 },
          1: { cellWidth: usable * 0.42 },
          2: { cellWidth: usable * 0.15 },
          3: { cellWidth: usable * 0.15 },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // 7. Adoption of Operating Agreement
    heading("Adoption of Operating Agreement");
    if (data.operatingAgreementAdopted) {
      resolvedPara(
        `that the Operating Agreement presented at this meeting is adopted as the Operating Agreement of the Company.`
      );
    } else {
      para("The Operating Agreement was reviewed and will be adopted by the Member at a future date.");
    }

    // 8. Banking Resolutions (single section, optional)
    if (data.includeBanking && data.bankName) {
      heading("Banking Resolutions");
      resolvedPara(
        `that the Company is authorized to open and maintain accounts at ${data.bankName}, ${data.bankCity || "[City, State]"}, and that ${member?.name || "[Member Name]"} is designated as the authorized signer on such accounts.`
      );
    }

    // 9. Business Purpose
    heading("Business Purpose");
    resolvedPara(
      `that the Company is organized for the following purpose: ${data.businessPurpose || "[Business Purpose]"}.`
    );

    // 10. General Authorization (with ratification of prior actions merged in)
    heading("General Authorization");
    resolvedPara(
      `that the Managing Member is authorized to execute any documents and take any actions necessary or appropriate to carry out the intent of these resolutions, and that all prior actions taken by the Member on behalf of the Company in connection with its formation are hereby ratified and confirmed.`
    );

    // 11. Authorized Binder
    heading("Authorized Binder");
    const binders = data.authorizedBinders ?? [];
    if (binders.length === 0) {
      resolvedPara(
        `that ${member?.name || "[Member Name]"} is designated as the Company's authorized binder under Wis. Stat. § 183.0301, with authority to bind the Company in the ordinary course of business.`
      );
    } else {
      resolvedPara(
        `that the following individuals are designated as authorized binders of the Company under Wis. Stat. § 183.0301, with authority to bind the Company in the ordinary course of business:`
      );
      autoTable(doc, {
        startY: y,
        head: [["Name", "Title", "Scope of Authority"]],
        body: binders.map(b => [b.name || "[Enter]", b.title || "[Enter]", b.scopeOfAuthority || "[Enter]"]),
        margin: { left: margin, right: rMargin },
        styles: { fontSize: 11, cellPadding: 6, font: "Arial" },
        headStyles: {
          fillColor: LIGHT_BLUE_BG,
          textColor: [BLUE.r, BLUE.g, BLUE.b],
          fontStyle: "bold",
          fontSize: 10,
        },
        theme: "grid",
      });
      y = (doc as any).lastAutoTable.finalY + 18;
    }

    // 12. Adjournment
    heading("Adjournment");
    para("There being no further business, the meeting was adjourned.");

    // 13. Signature block — Managing Member + Secretary only
    checkPage(160);
    heading("Signatures");
    y += 10;

    const colW = contentWidth / 2 - 10;
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.5);

    // Managing Member
    doc.line(margin, y, margin + colW - 20, y);
    doc.setFontSize(10);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    doc.text(managingMember.name || "[Managing Member]", margin, y + 14);
    doc.text("Managing Member", margin, y + 27);
    doc.text("Date: ________________", margin, y + 40);

    // Secretary
    const sx = margin + colW + 20;
    doc.line(sx, y, sx + colW - 20, y);
    doc.text(secretary || "[Secretary]", sx, y + 14);
    doc.text("Secretary", sx, y + 27);
    doc.text("Date: ________________", sx, y + 40);
    y += 60;

    addFooter();
    return doc;
  } catch (err) {
    console.error("generateSmllcOrgMeetingPDF error:", err);
    return doc;
  }
}
