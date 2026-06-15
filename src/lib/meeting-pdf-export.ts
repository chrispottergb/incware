import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { savePdfReliably } from "./pdf-save";
import { registerArialFont } from "@/lib/arial-font";


// Wisconsin DFI-style document formatting
const DFI_HEADER = "STATE OF WISCONSIN";
const DFI_SUB = "DEPARTMENT OF FINANCIAL INSTITUTIONS";
const MARGIN = 31.75; // 1.25 inch left margin for 3-hole punch binder filing
const R_MARGIN = 19.05; // 0.75 inch right margin

// Blue theme colors for Annual Meeting
const BLUE = { r: 31, g: 78, b: 121 }; // #1F4E79
const LIGHT_BLUE_BG: [number, number, number] = [214, 228, 240]; // #D6E4F0
const BODY_COLOR: [number, number, number] = [40, 40, 40];
const WHEREAS_INDENT = 0; // Flush left
const RESOLVED_INDENT = 12.7; // 0.5 inch

interface MeetingData {
  meeting: any;
  company: any;
  shareholders?: any[];
  directors?: any[];
  officers?: any[];
  counsel?: any[];
  assets?: any[];
  amendments?: any[];
  resolutions?: any[];
  benefits?: any[];
  loans?: any[];
  agreements?: any[];
  other?: any[];
  financials?: any;
  nonRecurringItems?: any[];
  authorizedSigners?: any[];
  capitalAssets?: any[];
  vehicleLeases?: any[];
  vehiclesSold?: any[];
  leaseTerminations?: any[];
  balanceEntries?: any[];
  priorYear?: {
    officers?: any[];
    benefits?: any[];
    loans?: any[];
    authorizedSigners?: any[];
  };
  // Company-level data for organizational meeting boilerplate
  companyOfficers?: any;
  companyShareholders?: any[];
  companyDirectors?: any[];
  companyBanks?: any[];
  companyBankSigners?: any[];
  companyAttorneys?: any[];
  companyAccountants?: any[];
  companyLeases?: any[];
}

function addDFIHeader(doc: jsPDF, title: string, companyName: string, entityType: string, meeting?: any, company?: any) {
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  const displayName = meeting?.company_name_at_meeting || companyName;
  doc.setFontSize(13);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(displayName, cx, 18, { align: "center" });

  const addrLine = meeting?.company_address_at_meeting || company?.address || "";
  let hy = 24;
  if (addrLine) {
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.text(addrLine, cx, hy, { align: "center" });
    hy += 4;
  }

  const cityPart = meeting?.company_city_at_meeting || company?.city || "";
  const statePart = meeting?.company_state_at_meeting || company?.state || "";
  const zipPart = meeting?.company_zip_at_meeting || company?.zip || "";
  const cityStateLine = [cityPart, statePart].filter(Boolean).join(", ") + (zipPart ? `  ${zipPart}` : "");
  if (cityStateLine.trim()) {
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.text(cityStateLine, cx, hy, { align: "center" });
    hy += 4;
  }

  // Blue horizontal line beneath header
  hy += 2;
  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setLineWidth(1);
  doc.line(MARGIN, hy, pw - R_MARGIN, hy);
}

function addMeetingTypeHeader(doc: jsPDF, y: number, meetingType: string, companyName: string, meetingDate: string, isWrittenConsent: boolean, meeting?: any, company?: any, meetingData?: MeetingData): number {
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  if (isWrittenConsent) {
    // Determine the consenting body (board / shareholders / members)
    const entityTypeLower = (company?.entity_type || "").toLowerCase();
    const isLLCEntity = entityTypeLower.includes("llc") || entityTypeLower.includes("limited liability");
    const rawBody = (meeting?.consent_body || "").toString().toLowerCase();
    const consentBody: "board" | "shareholders" | "members" =
      rawBody === "shareholders" ? "shareholders"
        : rawBody === "members" ? "members"
        : rawBody === "board" ? "board"
        : (isLLCEntity ? "members" : "board");

    const bodyTitle =
      consentBody === "shareholders" ? "SHAREHOLDERS"
        : consentBody === "members" ? "MEMBERS"
        : "BOARD OF DIRECTORS";

    // Title block (company name appears ONLY here)
    doc.setFontSize(14);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`WRITTEN CONSENT OF THE ${bodyTitle}`, cx, y, { align: "center" });
    y += 6;
    doc.text(`OF ${companyName.toUpperCase()}`, cx, y, { align: "center" });
    y += 6;

    // Principal office address (single line, only here)
    const addrLine = meeting?.company_address_at_meeting || company?.address || "";
    const cityPart = meeting?.company_city_at_meeting || company?.city || "";
    const statePart = meeting?.company_state_at_meeting || company?.state || "";
    const zipPart = meeting?.company_zip_at_meeting || company?.zip || "";
    const addressFull = [addrLine, [cityPart, statePart].filter(Boolean).join(", "), zipPart]
      .filter(Boolean).join(" • ");
    if (addressFull) {
      doc.setFontSize(10);
      doc.setFont("Arial", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(addressFull, cx, y, { align: "center" });
      y += 5;
    }

    // Date
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    const dateLabel = "Date: ";
    doc.setFont("Arial", "normal");
    const dateLabelWidth = doc.getTextWidth(dateLabel);
    doc.setFont("Arial", "italic");
    const dateValueWidth = doc.getTextWidth(meetingDate);
    const dateStartX = cx - (dateLabelWidth + dateValueWidth) / 2;
    doc.setFont("Arial", "normal");
    doc.text(dateLabel, dateStartX, y);
    doc.setFont("Arial", "italic");
    doc.text(meetingDate, dateStartX + dateLabelWidth, y);
    doc.setFont("Arial", "normal");
    y += 4;


    // Blue rule
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, pw - R_MARGIN, y);
    y += 6;

    // Intro paragraph (varies by consenting body)
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    let introText: string;
    if (consentBody === "shareholders") {
      introText = `The undersigned, being all shareholders holding the required voting power of ${companyName}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the corporation's governing documents.`;
    } else if (consentBody === "members") {
      introText = `The undersigned, being all Members of ${companyName}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the operating agreement.`;
    } else {
      introText = `The undersigned, being all members of the Board of Directors of ${companyName}, hereby adopt the following resolutions by written consent without a meeting, pursuant to applicable law and the corporation's bylaws.`;
    }
    if (meeting?.purpose && !/^Written Consent($| —)/i.test(String(meeting.purpose))) {
      introText += ` The purpose of this action is: ${meeting.purpose}.`;
    }
    const lines = doc.splitTextToSize(introText, pw - MARGIN - R_MARGIN);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 6;

  } else {
    // Standard Meeting Type Header - compact spacing
    doc.setFontSize(13);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`MINUTES OF ${meetingType.toUpperCase()}`, cx, y, { align: "center" });
    y += 4;
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const namePart = `${companyName} — `;
    doc.setFont("Arial", "normal");
    const namePartWidth = doc.getTextWidth(namePart);
    doc.setFont("Arial", "italic");
    const dPartWidth = doc.getTextWidth(meetingDate);
    const startX = cx - (namePartWidth + dPartWidth) / 2;
    doc.setFont("Arial", "normal");
    doc.text(namePart, startX, y);
    doc.setFont("Arial", "italic");
    doc.text(meetingDate, startX + namePartWidth, y);
    doc.setFont("Arial", "normal");
    y += 4;

    // Blue horizontal line beneath header
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(1);
    doc.line(MARGIN, y, pw - R_MARGIN, y);
    y += 6;
  }

  // Add introductory paragraph for all meeting types (non-written-consent)
  if (!isWrittenConsent && meeting && company) {
    const entityLabel = (company.entity_type || "Corporation").toLowerCase().includes("llc")
      ? "a limited liability company"
      : (company.entity_type || "Corporation").toLowerCase().includes("nonprofit")
        ? "a nonprofit corporation"
        : "a corporation";
    const stateOfInc = company.state_of_incorporation || company.state || "Wisconsin";
    const location = meeting.meeting_location || "";
    const mtgDate = new Date(meeting.meeting_date + "T00:00:00");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayName = days[mtgDate.getDay()];
    const monthName = months[mtgDate.getMonth()];
    const dateStr = `${dayName}, ${monthName} ${mtgDate.getDate()}, ${mtgDate.getFullYear()}`;
    const timeStr = meeting.meeting_time || "";

    const meetingLabel = meetingType.toLowerCase().includes("annual") ? "annual" :
      meetingType.toLowerCase().includes("shareholder") ? "shareholder" :
      meetingType.toLowerCase().includes("special") ? "special" :
        meetingType.toLowerCase().includes("organizational") ? "organizational" : meetingType.toLowerCase();

    let locationPart = "";
    if (location) {
      locationPart = `, was held at ${location}`;
    }

    let datePart = ` on ${dateStr}`;
    if (timeStr) datePart += ` at ${timeStr}`;

    const purposePart = meeting.purpose && meetingLabel === "special" ? ` The purpose of this meeting is: ${meeting.purpose}.` : "";
    const introText = `The ${meetingLabel} meeting of ${companyName}, ${entityLabel} duly formed in the state of ${stateOfInc}${locationPart}${datePart}. There were present and participating at the meeting:${purposePart ? `\n\n${purposePart}` : ""}`;

    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    const introLines = doc.splitTextToSize(introText, pw - MARGIN - R_MARGIN);
    doc.text(introLines, MARGIN, y);
    y += introLines.length * 5 + 6;

    // S-Corporation status paragraph for corporations with S-election
    const isLLC = (company.entity_type || "").toLowerCase().includes("llc");
    const hasSElection = company.s_election_date != null;
    if (!isLLC && hasSElection) {
      const fye = company.fiscal_year_end || "December 31";
      const sCorpText = `The Secretary noted that the corporation has elected S corporation status under Subchapter S of the Internal Revenue Code, and that said election remains in full force and effect for the tax year ending ${fye}.`;
      y += 3;
      const sCorpLines = doc.splitTextToSize(sCorpText, pw - MARGIN - R_MARGIN);
      for (const line of sCorpLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
    }

    // List participants based on meeting sub_type / type
    if (meetingData) {
      const participants: string[] = [];
      const subType = (meeting.sub_type || "").toLowerCase();
      const mType = meetingType.toLowerCase();

      if (subType.includes("shareholder") || subType.includes("member")) {
        (meetingData.shareholders || []).forEach(s => {
          if (s.shareholder_name) participants.push(s.shareholder_name);
        });
      }
      if (subType.includes("director") || subType.includes("board")) {
        (meetingData.directors || []).forEach(d => {
          if (d.director_name) participants.push(d.director_name);
        });
      }
      if (participants.length === 0) {
        const seen = new Set<string>();
        const addUnique = (name: string) => {
          const normalized = name.trim();
          if (!normalized) return;
          const simplify = (n: string) => n.toLowerCase().replace(/\b[a-z]\.\s*/g, "").replace(/\s+/g, " ").trim();
          const simple = simplify(normalized);
          for (const existing of seen) {
            if (simplify(existing) === simple || simple.includes(simplify(existing)) || simplify(existing).includes(simple)) {
              return;
            }
          }
          seen.add(normalized);
          participants.push(normalized);
        };
        (meetingData.shareholders || []).forEach(s => {
          if (s.shareholder_name) addUnique(s.shareholder_name);
        });
        (meetingData.directors || []).forEach(d => {
          if (d.director_name) addUnique(d.director_name);
        });
        (meetingData.officers || []).forEach(o => {
          if (o.name) addUnique(o.name);
        });
      }

      if (participants.length > 0) {
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(30, 30, 30);
        participants.forEach(name => {
          y = checkPageBreak(doc, y, 6);
          doc.text(`•  ${name}`, MARGIN + 6, y);
          y += 5.5;
        });
        y += 4;
      }
    }
  }

  return y;
}

function addDFIFooter(doc: jsPDF, companyName: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();

    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, ph - 20, pw - R_MARGIN, ph - 20);

    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(`${companyName} — Corporate Records`, MARGIN, ph - 15);
    doc.text(`Page ${i} of ${pageCount}`, pw - R_MARGIN, ph - 15, { align: "right" });
    doc.text("Generated by EntityIQ", MARGIN, ph - 10);
  }
}

function addAnnualMeetingFooter(doc: jsPDF, companyName: string, documentLabel: string = "Annual Meeting Minutes") {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();

    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, ph - 20, pw - R_MARGIN, ph - 20);

    doc.setFontSize(8);
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(`${companyName} — ${documentLabel}`, pw / 2, ph - 14, { align: "center" });
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${i} of ${pageCount}`, pw - R_MARGIN, ph - 14, { align: "right" });
  }
}


function addSectionTitle(doc: jsPDF, y: number, title: string, blueTheme: boolean = false, sectionNum?: number): number {
  y += 3;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  if (blueTheme) {
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    const label = sectionNum != null ? `${sectionNum}. ${title.toUpperCase()}` : title.toUpperCase();
    doc.text(label, MARGIN, y);
    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(1);
    doc.line(MARGIN, y + 3, doc.internal.pageSize.getWidth() - R_MARGIN, y + 3);
  } else {
    doc.setTextColor(120, 120, 120);
    doc.text(title.toUpperCase(), MARGIN, y);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y + 2, doc.internal.pageSize.getWidth() - R_MARGIN, y + 2);
  }
  return y + 10;
}

function addLabelValue(doc: jsPDF, y: number, label: string, value: string, x = MARGIN): number {
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(`${label}:`, x, y);
  doc.setFont("Arial", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(value || "—", x + doc.getTextWidth(`${label}: `) + 2, y);
  return y + 6;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 25) {
    doc.addPage();
    return 25;
  }
  return y;
}

function addResolutionBlock(doc: jsPDF, y: number, purpose: string, text: string): number {
  const pw = doc.internal.pageSize.getWidth();
  const contentWidth = pw - MARGIN - R_MARGIN;
  y = checkPageBreak(doc, y, 35);
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(purpose, MARGIN, y);
  y += 6;

  // Split text into paragraphs and apply WHEREAS/RESOLVED formatting globally
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  for (const para of paragraphs) {
    const upperPara = para.toUpperCase().trimStart();

    if (upperPara.startsWith("WHEREAS,") || upperPara.startsWith("WHEREAS ")) {
      // WHEREAS: flush left (WHEREAS_INDENT = 0), bold-italic prefix, italic body
      let body = para.trim();
      if (body.toUpperCase().startsWith("WHEREAS,")) {
        body = body.substring(body.indexOf(",") + 1).trim();
      } else if (body.toUpperCase().startsWith("WHEREAS ")) {
        body = body.substring(8).trim();
      }
      // Split body on single newlines to preserve list items
      const bodySubLines = body.split("\n").map(l => l.trim()).filter(Boolean);
      const prefix = "WHEREAS, ";

      // Render first sub-line with prefix
      const firstFullText = prefix + bodySubLines[0];
      const firstLines = doc.splitTextToSize(firstFullText, contentWidth - WHEREAS_INDENT);
      y = checkPageBreak(doc, y, firstLines.length * 5.5 + 6);

      for (let i = 0; i < firstLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("Arial", "bolditalic");
          doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
          const prefixWidth = doc.getTextWidth(prefix);
          doc.text(prefix, MARGIN + WHEREAS_INDENT, y);
          doc.setFont("Arial", "italic");
          const remainder = firstLines[0].substring(prefix.length);
          if (remainder) doc.text(remainder, MARGIN + WHEREAS_INDENT + prefixWidth, y);
        } else {
          doc.setFont("Arial", "italic");
          doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
          doc.text(firstLines[i], MARGIN + WHEREAS_INDENT, y);
        }
        y += 5.5;
      }

      // Render remaining sub-lines as continuation
      for (let s = 1; s < bodySubLines.length; s++) {
        doc.setFont("Arial", "italic");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const wrapped = doc.splitTextToSize(bodySubLines[s], contentWidth - WHEREAS_INDENT);
        for (const wl of wrapped) {
          y = checkPageBreak(doc, y, 6);
          doc.text(wl, MARGIN + WHEREAS_INDENT, y);
          y += 5.5;
        }
      }
      y += 3;
    } else if (
      upperPara.startsWith("FURTHER RESOLVED,") ||
      upperPara.startsWith("FURTHER RESOLVED ") ||
      upperPara.startsWith("RESOLVED,") ||
      upperPara.startsWith("RESOLVED ") ||
      upperPara.startsWith("NOW, THEREFORE, BE IT RESOLVED") ||
      upperPara.startsWith("NOW, THEREFORE, BE IT")
    ) {
      // RESOLVED / FURTHER RESOLVED: indented 0.5 inch, bold prefix, normal body
      const isFurtherResolved = upperPara.startsWith("FURTHER RESOLVED");
      let body = para.trim();
      const nowPrefix = "NOW, THEREFORE, BE IT ";
      if (body.toUpperCase().startsWith(nowPrefix.toUpperCase())) {
        body = body.substring(nowPrefix.length);
      }
      if (isFurtherResolved) {
        if (body.toUpperCase().startsWith("FURTHER RESOLVED,")) {
          body = body.substring(body.indexOf(",") + 1).trim();
        } else if (body.toUpperCase().startsWith("FURTHER RESOLVED ")) {
          body = body.substring(18).trim();
        }
      } else {
        if (body.toUpperCase().startsWith("RESOLVED,")) {
          body = body.substring(body.indexOf(",") + 1).trim();
        } else if (body.toUpperCase().startsWith("RESOLVED ")) {
          body = body.substring(9).trim();
        }
      }
      // Ensure "that" prefix
      const bodyLower = body.toLowerCase();
      const resolvedBody = bodyLower.startsWith("that ") ? body : "that " + body;
      const prefix = isFurtherResolved ? "FURTHER RESOLVED, " : "RESOLVED, ";

      // Split resolved body on single newlines to preserve list items
      const bodySubLines = resolvedBody.split("\n").map(l => l.trim()).filter(Boolean);

      // Render first sub-line with prefix
      const firstFullText = prefix + bodySubLines[0];
      const firstLines = doc.splitTextToSize(firstFullText, contentWidth - RESOLVED_INDENT);
      y = checkPageBreak(doc, y, firstLines.length * 5.5 + 6);

      for (let i = 0; i < firstLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("Arial", "bold");
          doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
          const prefixWidth = doc.getTextWidth(prefix);
          doc.text(prefix, MARGIN + RESOLVED_INDENT, y);
          doc.setFont("Arial", "normal");
          const remainder = firstLines[0].substring(prefix.length);
          if (remainder) doc.text(remainder, MARGIN + RESOLVED_INDENT + prefixWidth, y);
        } else {
          doc.setFont("Arial", "normal");
          doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
          doc.text(firstLines[i], MARGIN + RESOLVED_INDENT, y);
        }
        y += 5.5;
      }

      // Render remaining sub-lines as continuation
      for (let s = 1; s < bodySubLines.length; s++) {
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const wrapped = doc.splitTextToSize(bodySubLines[s], contentWidth - RESOLVED_INDENT);
        for (const wl of wrapped) {
          y = checkPageBreak(doc, y, 6);
          doc.text(wl, MARGIN + RESOLVED_INDENT, y);
          y += 5.5;
        }
      }
      y += 5;
    } else {
      // Plain paragraph — normal text flush left, preserve single newlines
      doc.setFont("Arial", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const subLines = para.split("\n").map(l => l.trim()).filter(Boolean);
      for (const sub of subLines) {
        const wrapped = doc.splitTextToSize(sub, contentWidth);
        for (const wl of wrapped) {
          y = checkPageBreak(doc, y, 6);
          doc.text(wl, MARGIN, y);
          y += 5;
        }
      }
      y += 3;
    }
  }
  y += 2;
  return y;
}

function addSubHeading(doc: jsPDF, y: number, text: string): number {
  y = checkPageBreak(doc, y, 20);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("Arial", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text(text, MARGIN, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - R_MARGIN, y);
  return y + 5;
}

function addWhereasResolved(doc: jsPDF, y: number, whereas: string, resolved: string, blueTheme: boolean = false): number {
  const pw = doc.internal.pageSize.getWidth();

  // Skip empty whereas or resolved
  if (!whereas && !resolved) return y;

  if (blueTheme) {
    // WHEREAS: flush left, bold italic prefix, italic body
    if (whereas) {
    const wIndent = WHEREAS_INDENT;
    const whereasPrefix = "WHEREAS, ";
    doc.setFontSize(11);
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    // Strip leading "WHEREAS, " if present in the text
    let whereasBody = whereas;
    if (whereasBody.toUpperCase().startsWith("WHEREAS,")) {
      whereasBody = whereasBody.substring(whereasBody.indexOf(",") + 1).trim();
    }
    const fullWhereas = whereasPrefix + whereasBody;
    const wLines = doc.splitTextToSize(fullWhereas, pw - MARGIN - R_MARGIN - wIndent);
    y = checkPageBreak(doc, y, wLines.length * 5.5 + 6);

    for (let i = 0; i < wLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bolditalic");
        const prefixWidth = doc.getTextWidth(whereasPrefix);
        doc.text(whereasPrefix, MARGIN + wIndent, y);
        doc.setFont("Arial", "italic");
        const remainder = wLines[0].substring(whereasPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + wIndent + prefixWidth, y);
      } else {
        doc.setFont("Arial", "italic");
        doc.text(wLines[i], MARGIN + wIndent, y);
      }
      y += 5.5;
    }
    y += 3;
    }

    // RESOLVED: indented 0.5 inch, bold prefix, normal body
    if (resolved) {
    const rIndent = RESOLVED_INDENT;
    const resolvedPrefix = "RESOLVED, ";
    let resolvedBody = resolved;
    // Strip "NOW, THEREFORE, BE IT " prefix if present
    const nowPrefix = "NOW, THEREFORE, BE IT ";
    if (resolvedBody.toUpperCase().startsWith(nowPrefix.toUpperCase())) {
      resolvedBody = resolvedBody.substring(nowPrefix.length);
    }
    // If it still starts with RESOLVED, strip that too
    if (resolvedBody.toUpperCase().startsWith("RESOLVED,")) {
      resolvedBody = resolvedBody.substring(resolvedBody.indexOf(",") + 1).trim();
    }
    const fullResolved = resolvedPrefix + "that " + resolvedBody;
    const rLines = doc.splitTextToSize(fullResolved, pw - MARGIN - R_MARGIN - rIndent);
    y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);

    for (let i = 0; i < rLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bold");
        const prefixWidth = doc.getTextWidth(resolvedPrefix);
        doc.text(resolvedPrefix, MARGIN + rIndent, y);
        doc.setFont("Arial", "normal");
        const remainder = rLines[0].substring(resolvedPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + rIndent + prefixWidth, y);
      } else {
        doc.setFont("Arial", "normal");
        doc.text(rLines[i], MARGIN + rIndent, y);
      }
      y += 5.5;
    }
    y += 3;
    }
  } else {
    // Non-blue theme: WHEREAS flush left (bold-italic prefix, italic body), RESOLVED indented (bold prefix, normal body)
    // WHEREAS
    if (whereas) {
    let whereasBody = whereas;
    const whereasPrefix = "WHEREAS, ";
    if (whereasBody.toUpperCase().startsWith("WHEREAS,")) {
      whereasBody = whereasBody.substring(whereasBody.indexOf(",") + 1).trim();
    }
    const fullWhereas = whereasPrefix + whereasBody;
    const wLines = doc.splitTextToSize(fullWhereas, pw - MARGIN - R_MARGIN - WHEREAS_INDENT);
    y = checkPageBreak(doc, y, wLines.length * 5.5 + 6);
    doc.setFontSize(11);
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);

    for (let i = 0; i < wLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bolditalic");
        const prefixWidth = doc.getTextWidth(whereasPrefix);
        doc.text(whereasPrefix, MARGIN + WHEREAS_INDENT, y);
        doc.setFont("Arial", "italic");
        const remainder = wLines[0].substring(whereasPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + WHEREAS_INDENT + prefixWidth, y);
      } else {
        doc.setFont("Arial", "italic");
        doc.text(wLines[i], MARGIN + WHEREAS_INDENT, y);
      }
      y += 5.5;
    }
    y += 3;
    }

    // RESOLVED
    if (resolved) {
    const resolvedPrefix = "RESOLVED, ";
    let resolvedBody = resolved;
    const nowPrefix = "NOW, THEREFORE, BE IT ";
    if (resolvedBody.toUpperCase().startsWith(nowPrefix.toUpperCase())) {
      resolvedBody = resolvedBody.substring(nowPrefix.length);
    }
    if (resolvedBody.toUpperCase().startsWith("RESOLVED,")) {
      resolvedBody = resolvedBody.substring(resolvedBody.indexOf(",") + 1).trim();
    }
    const fullResolved = resolvedPrefix + resolvedBody;
    const rLines = doc.splitTextToSize(fullResolved, pw - MARGIN - R_MARGIN - RESOLVED_INDENT);
    y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);

    for (let i = 0; i < rLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bold");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const prefixWidth = doc.getTextWidth(resolvedPrefix);
        doc.text(resolvedPrefix, MARGIN + RESOLVED_INDENT, y);
        doc.setFont("Arial", "normal");
        const remainder = rLines[0].substring(resolvedPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + RESOLVED_INDENT + prefixWidth, y);
      } else {
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        doc.text(rLines[i], MARGIN + RESOLVED_INDENT, y);
      }
      y += 5.5;
    }
    y += 3;
    }
  }
  return y;
}

function addWaiverOfNoticePages(doc: jsPDF, data: MeetingData): void {
  const { meeting, company } = data;
  const companyName = meeting?.company_name_at_meeting || company?.name || "the Company";
  const entityType = company?.entity_type || "Corporation";
  const isLLC = entityType?.toLowerCase().includes("llc") || entityType?.toLowerCase().includes("limited liability");
  const isNonprofit = entityType?.toLowerCase().includes("nonprofit") || entityType?.toLowerCase().includes("non-profit");
  const isShareholderMeeting = (meeting?.meeting_type || "").toLowerCase().includes("shareholder");
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  const governingLabel = isShareholderMeeting ? "Shareholders" : (isLLC ? "Members" : isNonprofit ? "Board of Directors" : "Board of Directors");
  const governingLabelLower = isShareholderMeeting ? "shareholders" : (isLLC ? "members" : "directors");
  const meetingOfLabel = isShareholderMeeting ? "Shareholders" : (isLLC ? "Members" : "Directors");

  // Build full date string
  const mtgDate = new Date(meeting.meeting_date + "T12:00:00");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const fullDateStr = `${days[mtgDate.getDay()]}, ${months[mtgDate.getMonth()]} ${mtgDate.getDate()}, ${mtgDate.getFullYear()}`;

  // Build location string
  const location = meeting.meeting_location || "";
  const cityAtMeeting = meeting.company_city_at_meeting || company?.city || "";
  const stateAtMeeting = meeting.company_state_at_meeting || company?.state || "";
  let locationStr = location;

  // Collect director/member names for signatures
  const signerNames: string[] = [];
  const seen = new Set<string>();
  const addUnique = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase().replace(/\b[a-z]\.\s*/g, "").replace(/\s+/g, " ").trim();
    if (seen.has(key)) return;
    seen.add(key);
    signerNames.push(n);
  };

  // For Corps: use shareholders for shareholder meetings, directors otherwise; for LLCs use members
  if (isLLC || isShareholderMeeting) {
    (data.shareholders || []).forEach(s => { if (s.shareholder_name) addUnique(s.shareholder_name); });
  } else {
    (data.directors || []).forEach(d => { if (d.director_name) addUnique(d.director_name); });
  }
  // Fallback: use officers if no directors/members found
  if (signerNames.length === 0) {
    (data.officers || []).forEach(o => { if (o.name) addUnique(o.name); });
  }

  const purposes = isShareholderMeeting
    ? [
        "elect a new board of directors",
        "conduct any other business that properly may be brought before the meeting",
      ]
    : [
        `Elect ${isLLC ? "managers/officers" : "officers"}`,
        "Conduct any other business that properly may be brought before the meeting",
      ];

  let y = 30;

  // ── PAGE 1: NOTICE OF MEETING ──
  doc.setFontSize(16);
  doc.setFont("Arial", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(companyName, cx, y, { align: "center" });
  y += 8;

  doc.setFontSize(13);
  doc.setFont("Arial", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  const meetingTypeLabel = isShareholderMeeting ? "Meeting of Shareholders" : `Annual Meeting of ${governingLabel}`;
  doc.text(meetingTypeLabel, cx, y, { align: "center" });
  y += 4;

  doc.setFontSize(12);
  doc.setFont("Arial", "italic");
  doc.setTextColor(30, 30, 30);
  doc.text(fullDateStr, cx, y, { align: "center" });
  doc.setFont("Arial", "normal");
  y += 4;


  // Blue horizontal line beneath header
  doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, pw - R_MARGIN, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
  doc.text("The purposes of this meeting are to:", MARGIN, y);
  y += 8;

  purposes.forEach((p, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${p}`, pw - MARGIN - R_MARGIN - 10);
    for (const line of lines) {
      doc.text(line, MARGIN + 8, y);
      y += 5.5;
    }
    y += 2;
  });

  // ── WAIVER OF NOTICE SECTION (same page if space, otherwise new page) ──
  y = checkPageBreak(doc, y, 80);
  y += 6;

  doc.setFontSize(12);
  doc.setFont("Arial", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  const waiverTitle = isShareholderMeeting
    ? `WAIVER OF NOTICE AND CONSENT TO MEETING OF SHAREHOLDERS`
    : `WAIVER OF NOTICE AND CONSENT TO ANNUAL MEETING OF ${meetingOfLabel.toUpperCase()}`;
  doc.text(waiverTitle, cx, y, { align: "center" });
  y += 10;

  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);

  const meetingDescriptor = isShareholderMeeting ? "meeting of shareholders" : `annual meeting of said ${governingLabelLower}`;
  const followingClause = isShareholderMeeting || isLLC ? "" : " immediately following the meeting of shareholders";
  const waiverText = `We (I), the undersigned, being the ${governingLabelLower} of ${companyName}, do hereby severally waive notice of the time, place and purposes of the ${meetingDescriptor} and do hereby call said meeting and consent to the holding thereof at this time and place: ${locationStr || "[location]"} on ${fullDateStr}${followingClause}, and are aware that the purposes of the meeting are to:`;
  const waiverLines = doc.splitTextToSize(waiverText, pw - MARGIN - R_MARGIN);
  for (const line of waiverLines) {
    y = checkPageBreak(doc, y, 6);
    doc.text(line, MARGIN, y);
    y += 5.5;
  }
  y += 6;

  purposes.forEach((p, i) => {
    y = checkPageBreak(doc, y, 8);
    const lines = doc.splitTextToSize(`${i + 1}. ${p}`, pw - MARGIN - R_MARGIN - 10);
    for (const line of lines) {
      doc.text(line, MARGIN + 8, y);
      y += 5.5;
    }
    y += 2;
  });

  y += 6;
  y = checkPageBreak(doc, y, 10 + signerNames.length * 15);
  doc.setFont("Arial", "normal");
  doc.text("DATED: ", MARGIN, y);
  const datedLabelWidth = doc.getTextWidth("DATED: ");
  doc.setFont("Arial", "italic");
  doc.text(fullDateStr, MARGIN + datedLabelWidth, y);
  doc.setFont("Arial", "normal");
  y += 12;

  signerNames.forEach(name => {
    y = checkPageBreak(doc, y, 15);
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, MARGIN + 70, y);
    y += 5;
    doc.setFontSize(10);
    doc.text(name, MARGIN, y);
    y += 10;
  });

  // Start minutes on a new page
  doc.addPage();
}

function addOrganizationalBoilerplate(doc: jsPDF, y: number, data: MeetingData): number {
  const { company, meeting } = data;
  const entityType = company?.entity_type || "Corporation";
  const isLLC = entityType === "LLC" || entityType === "Single Member LLC";
  const isNonprofit = entityType === "Non-Profit";
  const isSCorp = !!company?.s_election_date;
  const entityLabel = isLLC ? "limited liability company" : isNonprofit ? "nonprofit corporation" : "corporation";
  const governingBody = isLLC ? "members" : "Board of Directors";
  const companyName = company?.name || "the Company";
  const stateOfInc = company?.state_of_incorporation || "Wisconsin";
  const pw = doc.internal.pageSize.getWidth();

  const hasOfficerData = (data.officers && (data.officers ?? []).length > 0);
  const hasShareholderData = (data.shareholders && (data.shareholders ?? []).length > 0);
  const hasDirectorData = (data.directors && (data.directors ?? []).length > 0);

  // 1. Formation
  y += 3;
  y = checkPageBreak(doc, y, 40);
  y = addSectionTitle(doc, y, "Formation & Organization");

  const incDate = company?.incorporation_date
    ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "the date of filing";
  const formationDoc = isLLC ? "Articles of Organization" : "Articles of Incorporation";

  y = addResolutionBlock(doc, y, "Ratification of Formation",
    `WHEREAS, the ${formationDoc} of ${companyName} were filed with the ${stateOfInc} Department of Financial Institutions on ${incDate}, thereby forming the ${entityLabel}; and\n\nWHEREAS, this organizational meeting has been called for the purpose of completing the organization of the ${entityLabel}, adopting initial resolutions, and transacting such other business as may properly come before the meeting;\n\nNOW, THEREFORE, BE IT RESOLVED, that the filing of the ${formationDoc} and the formation of the ${entityLabel} under the laws of the State of ${stateOfInc} are hereby ratified and confirmed.`);

  // 2. Registered Agent
  if (company?.registered_agent_name) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, "Registered Agent");
    const agentAddr = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ");
    y = addResolutionBlock(doc, y, "Appointment of Registered Agent",
      `RESOLVED, that ${company.registered_agent_name}${agentAddr ? `, located at ${agentAddr},` : ""} is hereby confirmed as the registered agent of the ${entityLabel} in the State of ${stateOfInc}, and the proper officers are authorized to execute any documents necessary to maintain the registered agent designation.`);
  }

  // 3. Fiscal Year & Accounting
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, "Fiscal Year & Accounting");
  const fiscalEnd = company?.fiscal_year_end || "December 31";
  const acctMethod = company?.accounting_method || "cash basis";
  y = addResolutionBlock(doc, y, "Adoption of Fiscal Year & Accounting Method",
    `RESOLVED, that the fiscal year of the ${entityLabel} shall end on ${fiscalEnd} of each year, and that the ${entityLabel} shall maintain its books and records on the ${acctMethod} method of accounting.`);

  // 4. Officers
  const officerSource = hasOfficerData ? data.officers! :
    data.companyOfficers ? (() => {
      const o = data.companyOfficers;
      const list: { title: string; name: string }[] = [];
      if (o.president) list.push({ title: isLLC ? "Managing Member" : "President", name: o.president });
      if (o.vice_president) list.push({ title: isLLC ? "Member" : "Vice President", name: o.vice_president });
      if (o.secretary) list.push({ title: "Secretary", name: o.secretary });
      if (o.treasurer) list.push({ title: "Treasurer", name: o.treasurer });
      return list;
    })() : [];

  if (officerSource.length > 0) {
    y = checkPageBreak(doc, y, 30 + officerSource.length * 7);
    y = addSectionTitle(doc, y, isLLC ? "Managers / Officers" : "Election of Officers");
    const officerLines = officerSource.map((o: any) => `${o.name} as ${o.title}`).join("; ");
    y = addResolutionBlock(doc, y, `Initial ${isLLC ? "Managers/Officers" : "Officers"}`,
      `RESOLVED, that the following persons are hereby ${isLLC ? "appointed" : "elected"} as the initial ${isLLC ? "managers/officers" : "officers"} of the ${entityLabel}, to serve until their successors are duly ${isLLC ? "appointed" : "elected"} and qualified:\n\n${officerLines}.`);
    autoTable(doc, {
      startY: y,
      head: [["Title", "Name"]],
      body: officerSource.map((o: any) => [o.title, o.name]),
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 5. Directors (Corp only)
  if (!isLLC) {
    const directorSource = hasDirectorData
      ? data.directors!.map((d: any) => d.director_name)
      : (data.companyDirectors || []).map((d: any) => d.name);
    if (directorSource.length > 0) {
      y = checkPageBreak(doc, y, 30 + directorSource.length * 7);
      y = addSectionTitle(doc, y, "Board of Directors");
      y = addResolutionBlock(doc, y, "Election of Board of Directors",
        `RESOLVED, that the following persons are hereby elected as the initial Board of Directors of the ${entityLabel}, to serve until the first annual meeting of ${isNonprofit ? "the board" : "shareholders"} and until their successors are duly elected and qualified:\n\n${directorSource.join("; ")}.`);
    }
  }

  // 6. Members / Shareholders (with addresses)
  const shareholderSource = hasShareholderData
    ? data.shareholders!.map((s: any) => {
        const cs = (data.companyShareholders || []).find(
          (c: any) => c.name?.toLowerCase().trim() === s.shareholder_name?.toLowerCase().trim()
        );
        const addr = s.address || cs?.address || "";
        const addr2 = s.address_2 || (cs as any)?.address_2 || "";
        const city = s.city || cs?.city || "";
        const state = s.state || cs?.state || "";
        const zip = s.zip || cs?.zip || "";
        const line1 = [addr, addr2].filter(Boolean).join(", ");
        const line2 = [city, state].filter(Boolean).join(", ");
        const address = [line1, line2, zip].filter(Boolean).join(" ");
        return { name: s.shareholder_name, shares: s.common_shares, address };
      })
    : (data.companyShareholders || []).map((s: any) => {
        const addr = s.address || "";
        const addr2 = (s as any).address_2 || "";
        const city = s.city || "";
        const state = s.state || "";
        const zip = s.zip || "";
        const line1 = [addr, addr2].filter(Boolean).join(", ");
        const line2 = [city, state].filter(Boolean).join(", ");
        const address = [line1, line2, zip].filter(Boolean).join(" ");
        return { name: s.name, shares: null, address };
      });

  if (shareholderSource.length > 0) {
    y = checkPageBreak(doc, y, 30 + shareholderSource.length * 7);
    const memberLabel = isLLC ? "Members" : "Shareholders";
    y = addSectionTitle(doc, y, `Initial ${memberLabel}`);
    if (isLLC) {
      y = addResolutionBlock(doc, y, "Recognition of Initial Members",
        `RESOLVED, that the following persons are hereby recognized as the initial members of the ${entityLabel}, having made their respective capital contributions as set forth in the Operating Agreement:`);
    } else {
      y = addResolutionBlock(doc, y, "Authorization of Stock Issuance",
        `RESOLVED, that the ${entityLabel} is authorized to issue shares of stock to the following initial shareholders:`);
    }
    const usableW = doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN;
    const tableHeaders = isLLC
      ? ["Name", "Address"]
      : ["Name", "Address", "Shares"];
    const tableBody = shareholderSource.map((s: any) =>
      isLLC
        ? [s.name || "—", s.address || "—"]
        : [s.name || "—", s.address || "—", s.shares ? s.shares.toLocaleString() : "—"]
    );
    autoTable(doc, {
      startY: y,
      head: [tableHeaders],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235] as [number, number, number], textColor: [30, 30, 30] as [number, number, number], fontSize: 10, fontStyle: "bold" as const },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      columnStyles: isLLC
        ? { 0: { cellWidth: usableW * 0.35 }, 1: { cellWidth: usableW * 0.65 } }
        : { 0: { cellWidth: usableW * 0.30 }, 1: { cellWidth: usableW * 0.50 }, 2: { cellWidth: usableW * 0.20 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 7. Operating Agreement / Bylaws
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, isLLC ? "Operating Agreement" : "Bylaws");
  y = addResolutionBlock(doc, y, isLLC ? "Adoption of Operating Agreement" : "Adoption of Bylaws",
    isLLC
      ? `RESOLVED, that the Operating Agreement presented to and reviewed by the members at this meeting is hereby adopted as the Operating Agreement of the ${entityLabel}, and the Secretary is directed to insert a copy of the Operating Agreement in the company's records.`
      : `RESOLVED, that the Bylaws presented to and reviewed by the ${governingBody} at this meeting are hereby adopted as the Bylaws of the ${entityLabel}, and the Secretary is directed to insert a copy of the Bylaws in the corporate minute book.`);

  // 8. Banking
  const bankSource = data.companyBanks || [];
  const signerSource = data.companyBankSigners || [];
  if (bankSource.length > 0) {
    y = checkPageBreak(doc, y, 30 + bankSource.length * 7);
    y = addSectionTitle(doc, y, "Banking Resolutions");
    bankSource.forEach((bank: any) => {
      let bankSigners = signerSource.filter((s: any) => s.bank_id === bank.id);
      if (bankSigners.length === 0 && data.authorizedSigners && (data.authorizedSigners ?? []).length > 0) {
        bankSigners = (data.authorizedSigners ?? []).filter((s: any) =>
          s.bank_name && bank.bank_name && s.bank_name.toLowerCase().trim() === bank.bank_name.toLowerCase().trim()
        );
      }
      const signerNames = bankSigners.map((s: any) => `${s.signer_name}${s.title ? `, ${s.title}` : ""}`).join("; ");
      y = addResolutionBlock(doc, y, `Authorize Account — ${bank.bank_name}`,
        `RESOLVED, that the ${entityLabel} is hereby authorized to open and maintain a ${bank.account_type || "checking"} account at ${bank.bank_name}${bank.city ? `, ${bank.city}` : ""}${bank.state ? `, ${bank.state}` : ""}${signerNames ? `, and that the following persons are hereby authorized as signers on said account: ${signerNames}` : ""}.`);
    });
  }

  // 9. S Corp Election
  if (isSCorp || company?.s_election_date) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, "S Corporation Election");
    const sDate = company?.s_election_date
      ? new Date(company.s_election_date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "the earliest permissible date";
    y = addResolutionBlock(doc, y, "S Corporation Election (IRC § 1362)",
      `RESOLVED, that the ${entityLabel} hereby elects to be treated as an S Corporation under Subchapter S of the Internal Revenue Code, effective ${sDate}, and the proper officers are authorized and directed to prepare and file IRS Form 2553 and any corresponding state forms, with all ${isLLC ? "members" : "shareholders"} consenting to such election.`);
  }

  // 10. Business Purpose
  if (company?.business_purpose) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, "Business Purpose");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    const bpLines = doc.splitTextToSize(`The ${entityLabel} is organized for the following purpose: ${company.business_purpose}`, pw - MARGIN - R_MARGIN);
    for (const line of bpLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 4;
  }

  // 11. Seal
  if (company?.seal_type && company.seal_type !== "no_seal") {
    y = checkPageBreak(doc, y, 20);
    y = addResolutionBlock(doc, y, "Adoption of Corporate Seal",
      `RESOLVED, that the ${entityLabel} shall adopt a corporate seal in the form presented to and approved at this meeting.`);
  }

  // 12. General Authorization
  y = checkPageBreak(doc, y, 30);
  y = addSectionTitle(doc, y, "General Authorization");
  y = addResolutionBlock(doc, y, "Authorization to Take All Necessary Actions",
    `RESOLVED, that the officers of the ${entityLabel} are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.`);

  return y;
}

export function exportMeetingMinutesPDF(data: MeetingData) {
  const doc = new jsPDF();
  try {
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);

  // Exclude zero-share / zero-interest shareholders & members from all PDF sections.
  // A holder is "zero" when both common and preferred (or interest %) are 0/null/undefined.
  const hasNonZeroHolding = (s: any) => {
    const c = Number(s?.common_shares ?? 0) || 0;
    const p = Number(s?.preferred_shares ?? 0) || 0;
    return c > 0 || p > 0;
  };
  const hasNonZeroOwnership = (s: any) => {
    // companyShareholders: keep unless ownership_percentage is explicitly 0
    if (s?.is_treasury) return false;
    const op = s?.ownership_percentage;
    if (op === 0 || op === "0" || op === "0.00") return false;
    return true;
  };
  data = {
    ...data,
    shareholders: (data.shareholders || []).filter(hasNonZeroHolding),
    companyShareholders: (data.companyShareholders || []).filter(hasNonZeroOwnership),
  };

  const { meeting, company } = data;
  const companyName = company?.name || "Unknown Company";
  const entityType = company?.entity_type || "Corporation";
  const meetingDate = new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString();
  const isWrittenConsent = meeting.meeting_type === "Written Consent";
  const isLLC = entityType?.toLowerCase().includes("llc") || entityType?.toLowerCase().includes("limited liability");
  const isAnnual = (meeting.meeting_type || "").toLowerCase().includes("annual");
  const isShareholder = (meeting.meeting_type || "").toLowerCase().includes("shareholder");
  const bt = isAnnual || isShareholder; // blue theme flag for both annual and shareholder meetings
  let sectionNum = 0;

  // Helper to get table head styles based on theme
  const tableHeadStyles = bt
    ? { fillColor: LIGHT_BLUE_BG as [number, number, number], textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number], fontStyle: "bold" as const, fontSize: 10 }
    : { fillColor: [200, 215, 235] as [number, number, number], textColor: [30, 30, 30] as [number, number, number], fontSize: 10, fontStyle: "bold" as const };

  // Helper for numbered section titles in blue theme
  const section = (title: string) => {
    sectionNum++;
    return addSectionTitle(doc, y, title, bt, bt ? sectionNum : undefined);
  };

  // For Annual Meeting: add Waiver of Notice front pages
  if (bt) {
    addWaiverOfNoticePages(doc, data);
  }

  // For written consents, the title block contains the company name + address
  // (so we skip the standard DFI page header to avoid duplication). For all
  // other meeting types, render the DFI header at the top of the document.
  if (!isWrittenConsent) {
    addDFIHeader(doc, `${meeting.meeting_type} — Minutes`, companyName, entityType, meeting, company);
  }

  let y = bt ? 52 : (isWrittenConsent ? 22 : 45);

  // For Annual Meeting blue theme: use a cleaner title block
  if (bt) {
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.setFont("Arial", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    const titleText = isShareholder ? "MINUTES OF THE ANNUAL MEETING OF SHAREHOLDERS" : "MINUTES OF THE ANNUAL MEETING";
    doc.text(titleText, pw / 2, y, { align: "center" });
    y += 6;
  } else {
    // Meeting Type Header
    y = addMeetingTypeHeader(doc, y, meeting.meeting_type, companyName, meetingDate, isWrittenConsent, meeting, company, data);
  }

  // Optional Recitals block for Written Consents (rendered before resolutions section)
  if (isWrittenConsent && meeting.consent_recitals) {
    const pw = doc.internal.pageSize.getWidth();
    y = checkPageBreak(doc, y, 20);
    doc.setFontSize(11);
    doc.setFont("Arial", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("RECITALS", MARGIN, y);
    y += 5;
    doc.setFont("Arial", "normal");
    const recLines = doc.splitTextToSize(String(meeting.consent_recitals), pw - MARGIN - R_MARGIN);
    for (const line of recLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 4;
  }

  // Skip the "Meeting Information" section entirely for Written Consents
  // (no meeting occurred — date/location/chairperson are not applicable).
  if (!isWrittenConsent) {
  y = section("Meeting Information");


  if (bt) {
    // For blue theme: write introductory paragraph
    const stateOfInc = company?.state_of_incorporation || company?.state || "Wisconsin";
    const entityLabel = isLLC ? "limited liability company" : "corporation";
    const mtgDate = new Date(meeting.meeting_date + "T12:00:00");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dateStr = `${days[mtgDate.getDay()]}, ${months[mtgDate.getMonth()]} ${mtgDate.getDate()}, ${mtgDate.getFullYear()}`;

    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);

    if (isShareholder) {
      // Shareholder meeting intro matches the uploaded template format
      const locationStr = meeting.meeting_location || "";
      const cityAtMeeting = meeting.company_city_at_meeting || company?.city || "";
      const stateAtMeeting = meeting.company_state_at_meeting || company?.state || "";
      let locPart = locationStr || "";
      const introText = `Minutes of the annual meeting of shareholders of ${companyName}, held at ${locPart || "[location]"} on ${dateStr}${meeting.meeting_time ? ` at ${meeting.meeting_time}` : ""}, pursuant to the following waiver of notice and consent to the holding of such meeting signed by all of the shareholders of this ${entityLabel} on the records of said meeting, to-wit:`;
      const introLines = doc.splitTextToSize(introText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of introLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 3;

    } else {
      const meetingLabel = "Annual Meeting";
      const introText = `The ${meetingLabel} of the ${stateOfInc} ${entityLabel} was held on ${dateStr}${meeting.meeting_time ? `, at ${meeting.meeting_time}` : ""}${meeting.meeting_location ? `, at ${meeting.meeting_location}` : ""}.`;
      const introLines = doc.splitTextToSize(introText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of introLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }

      // S-Corporation status paragraph for corporations with S-election
      const hasSElection = company?.s_election_date != null;
      if (!isLLC && hasSElection) {
        const fye = company?.fiscal_year_end || "December 31";
        const sCorpText = `The Secretary noted that the corporation has elected S corporation status under Subchapter S of the Internal Revenue Code, and that said election remains in full force and effect for the tax year ending ${fye}.`;
        y += 3;
        const sCorpLines = doc.splitTextToSize(sCorpText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of sCorpLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
      }

      y += 3;
    }

    if (isShareholder) {
      // For shareholder meetings: show shareholders with basis (address)
      const shareholderData = data.shareholders || [];
      if (shareholderData.length > 0) {
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const chairText = `The meeting was called to order by ${meeting.chairperson || "[Chairperson]"}, who chaired the meeting, and ${meeting.mtg_secretary || "[Secretary]"}, acting as secretary, recorded the proceedings.`;
        const chairLines = doc.splitTextToSize(chairText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of chairLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
        y += 3;

        // S-Corporation status paragraph (rendered after secretary is elected)
        const hasSElection = company?.s_election_date != null;
        if (!isLLC && hasSElection) {
          const fye = company?.fiscal_year_end || "December 31";
          const sCorpText = `The Secretary noted that the corporation has elected S corporation status under Subchapter S of the Internal Revenue Code, and that said election remains in full force and effect for the tax year ending ${fye}.`;
          const sCorpLines = doc.splitTextToSize(sCorpText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
          for (const line of sCorpLines) {
            y = checkPageBreak(doc, y, 6);
            doc.text(line, MARGIN, y);
            y += 5.5;
          }
          y += 3;
        }


        const quorumText = `The secretary announced that there were, present in person or by proxy, the following shareholder(s), representing a quorum of the shareholders and showing the current resident address and the number of shares held by each:`;
        const quorumLines = doc.splitTextToSize(quorumText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of quorumLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
        y += 5;

        // Shareholder table with address and basis
        const shareholderTableBody = shareholderData.map(s => {
          const matchingShareholder = (data.companyShareholders || []).find(
            cs => cs.name?.toLowerCase().trim() === s.shareholder_name?.toLowerCase().trim()
          );
          // Prefer address from the meeting shareholder record, fall back to company shareholder
          const addr = s.address || matchingShareholder?.address || "";
          const addr2 = s.address_2 || (matchingShareholder as any)?.address_2 || "";
          const city = s.city || matchingShareholder?.city || "";
          const state = s.state || matchingShareholder?.state || "";
          const zip = s.zip || matchingShareholder?.zip || "";
          const line1 = [addr, addr2].filter(Boolean).join(", ");
          const line2 = [city, state].filter(Boolean).join(", ");
          const address = [line1, line2, zip].filter(Boolean).join(" ");
          return [
            s.shareholder_name,
            address || "—",
            s.common_shares?.toLocaleString() ?? "—",
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [["Shareholder", "Address", "Common Shares"]],
          body: shareholderTableBody,
          theme: "grid",
          headStyles: tableHeadStyles,
          bodyStyles: { fontSize: 10 },
          margin: { left: MARGIN, right: R_MARGIN },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30 },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
    } else {
      // Annual meeting: attendee list with addresses (deduplicate by normalized name)
      const attendeeMap = new Map<string, { name: string; address: string }>(); // normalized → display entry
      const normKey = (n: string) => n.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

      const buildAddress = (name: string): string => {
        const nk = normKey(name);
        // Check meeting shareholders first
        const ms = (data.shareholders || []).find(s => normKey(s.shareholder_name || "") === nk);
        const cs = (data.companyShareholders || []).find(c => normKey(c.name || "") === nk);
        const cd = (data.companyDirectors || []).find(d => normKey(d.name || "") === nk);
        const source = ms || cs || cd;
        if (!source) return "";
        const addr = (ms?.address || cs?.address || cd?.address || "");
        const addr2 = ((ms as any)?.address_2 || (cs as any)?.address_2 || (cd as any)?.address_2 || "");
        const city = (ms?.city || cs?.city || cd?.city || "");
        const state = (ms?.state || cs?.state || cd?.state || "");
        const zip = (ms?.zip || cs?.zip || cd?.zip || "");
        const line1 = [addr, addr2].filter(Boolean).join(", ");
        const line2 = [city, state].filter(Boolean).join(", ");
        return [line1, line2, zip].filter(Boolean).join(" ");
      };

      const addAttendee = (name: string | null | undefined) => {
        if (!name) return;
        const key = normKey(name);
        if (!key || attendeeMap.has(key)) return;
        attendeeMap.set(key, { name: name.trim(), address: buildAddress(name) });
      };
      (data.shareholders || []).forEach(s => addAttendee(s.shareholder_name));
      (data.directors || []).forEach(d => addAttendee(d.director_name));
      (data.officers || []).forEach(o => addAttendee(o.name));
      const attendeeEntries = Array.from(attendeeMap.values());
      if (attendeeEntries.length > 0) {
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        doc.text("The following were present at the meeting:", MARGIN, y);
        y += 6;

        const usableW = doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN;
        autoTable(doc, {
          startY: y,
          head: [["Name", "Address"]],
          body: attendeeEntries.map(e => [e.name, e.address || "—"]),
          theme: "grid",
          headStyles: tableHeadStyles,
          bodyStyles: { fontSize: 10 },
          margin: { left: MARGIN, right: R_MARGIN },
          columnStyles: {
            0: { cellWidth: usableW * 0.35 },
            1: { cellWidth: usableW * 0.65 },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

      const chairText = `${meeting.chairperson || "[Chairperson]"} served as Chairperson and ${meeting.mtg_secretary || "[Secretary]"} served as Secretary of the meeting.`;
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      const chairLines = doc.splitTextToSize(chairText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of chairLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 3;
    }

    if (meeting.tax_year) {
      y = addLabelValue(doc, y, "Tax Year", String(meeting.tax_year));
    }
  } else {
    y = addLabelValue(doc, y, "Date", meetingDate);
    y = addLabelValue(doc, y, "Type", `${meeting.meeting_type}${meeting.sub_type ? ` — ${meeting.sub_type}` : ""}`);
    if (meeting.meeting_time) y = addLabelValue(doc, y, "Time", meeting.meeting_time);
    if (meeting.meeting_location) y = addLabelValue(doc, y, "Location", meeting.meeting_location);

    const chair = meeting.chairperson?.trim() || "";
    const sec = meeting.mtg_secretary?.trim() || "";
    if (chair && sec && chair.toLowerCase() === sec.toLowerCase()) {
      y = addLabelValue(doc, y, "Chairperson & Secretary", chair);
    } else {
      if (chair) y = addLabelValue(doc, y, "Chairperson", chair);
      if (sec) y = addLabelValue(doc, y, "Secretary", sec);
    }

    if (meeting.tax_year) y = addLabelValue(doc, y, "Tax Year", String(meeting.tax_year));
    if (meeting.others_present) y = addLabelValue(doc, y, "Others Present", meeting.others_present);
  }
  } // end if (!isWrittenConsent) Meeting Information section

  // Section 1244 Stock Plan - include in Organizational Meeting if checked (Corp only, not applicable to LLCs)
  if (meeting.meeting_type === "Organizational Meeting" && company?.election_1244 && !isLLC) {
    y += 3;
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, y, "Section 1244 Stock Plan");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(30, 30, 30);
    const section1244Text = `WHEREAS, the Board of Directors deems it to be in the best interest of the corporation and its shareholders to qualify the stock of the corporation as "Section 1244 Stock" as defined in Section 1244 of the Internal Revenue Code of 1986, as amended; and

WHEREAS, the Board of Directors desires to adopt a plan to offer and issue shares of the corporation's common stock pursuant to Section 1244 of the Internal Revenue Code;

NOW, THEREFORE, BE IT RESOLVED, that the corporation hereby adopts the following Section 1244 Stock Plan:

1. The corporation shall offer and issue shares of its common stock for an aggregate dollar amount of consideration that does not exceed the amount authorized by the Articles of Incorporation.

2. Such shares shall be issued only for money, or other property (other than stock or securities), in exchange for the stock.

3. At the time such plan is adopted, the corporation is a "small business corporation" as defined in Section 1244(c)(3) of the Internal Revenue Code.

4. No portion of a prior offering shall be outstanding at the time of the adoption of this plan.

5. The shares issued under this plan shall be designated as "Section 1244 Stock" and the corporation shall maintain such records as are necessary to substantiate compliance with the requirements of Section 1244 of the Internal Revenue Code.

BE IT FURTHER RESOLVED, that the proper officers of the corporation are hereby authorized and directed to take all actions necessary to implement this plan and to maintain the qualification of the stock issued hereunder as Section 1244 Stock.`;
    const lines1244 = doc.splitTextToSize(section1244Text, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of lines1244) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 5;
  }

  // ── Organizational Meeting Boilerplate (auto-generated from company data) ──
  if (meeting.meeting_type === "Organizational Meeting") {
    y = addOrganizationalBoilerplate(doc, y, data);
  }

  // Ratification of Prior Year Actions (for Annual and Shareholder meetings)
  const mType = (meeting.meeting_type || "").toLowerCase();
  if (mType.includes("annual") || mType.includes("shareholder")) {
    y += 3;
    y = checkPageBreak(doc, y, 30);

    if (isShareholder) {
      // Shareholder meeting: prior meeting minutes reading + stock ledger presentation
      y = section("Approval of Prior Meeting Minutes");
      if (meeting.prior_mtg_date) {
        const priorDate = new Date(meeting.prior_mtg_date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const priorText = `The minutes of the last annual meeting of shareholders, having been held on ${priorDate}, were read and approved.`;
        const priorLines = doc.splitTextToSize(priorText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of priorLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
        y += 3;
      }

      // Old business for shareholder meeting
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const oldBizText = meeting.old_business?.trim()
        ? `The first order of business to come before the meeting was a discussion of old business. ${meeting.old_business.trim()}`
        : `The first order of business to come before the meeting was a discussion of old business. There being none, the meeting proceeded.`;
      const oldBizLines = doc.splitTextToSize(oldBizText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of oldBizLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 5;

      // Stock ledger and transfer books presentation
      y = checkPageBreak(doc, y, 40);
      y = section("Presentation of Corporate Records");
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const presentText = `Thereupon, the chairperson presented to the meeting the following papers and documents, all of which were laid upon the table and were publicly declared by the chairperson to be open for inspection by any shareholder:`;
      const presentLines = doc.splitTextToSize(presentText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of presentLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 3;
      const items = [
        "the stock ledger and transfer books of the corporation",
        `minutes of the board of directors, covering all purchases, contracts, contributions, compensations, acts, authorizations, decisions, proceedings, elections, and appointments by the board of directors since the last annual meeting${meeting.prior_mtg_date ? ` which was held on ${new Date(meeting.prior_mtg_date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}` : ""}.`,
      ];
      items.forEach((item, i) => {
        y = checkPageBreak(doc, y, 10);
        const itemLines = doc.splitTextToSize(`${i + 1}) ${item}`, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - 8);
        for (const line of itemLines) {
          doc.text(line, MARGIN + 4, y);
          y += 5.5;
        }
        y += 2;
      });
      y += 3;

      // Ratification resolution
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const motionText = `On motion duly made and seconded, it was`;
      doc.text(motionText, MARGIN, y);
      y += 8;
      y = addWhereasResolved(doc, y,
        "",
        `NOW, THEREFORE, BE IT RESOLVED, that all purchases, contracts, contributions, compensations, acts, decisions, proceedings, elections and appointments by the board of directors since the last annual meeting of the corporation${meeting.tax_year ? `, and all matters referred to in the report to shareholders for the year ending December 31, ${meeting.tax_year}` : ""}, be and the same hereby are approved and ratified.`,
        bt
      );
    } else {
      // Annual meeting ratification
      y = section("Call to Order & Approval of Prior Meeting Minutes");
      y = addWhereasResolved(doc, y,
        `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} and ${isLLC ? "members" : "shareholders"} of ${companyName} have taken various actions and made certain decisions during the prior fiscal year in the ordinary course of business; and`,
        `NOW, THEREFORE, BE IT RESOLVED, that all acts and decisions of the ${isLLC ? "members" : "directors"} and ${isLLC ? "officers" : "officers"} of ${companyName} taken or made since the last annual meeting are hereby ratified, confirmed, and approved in all respects.`,
        bt
      );

      if (meeting.prior_mtg_date) {
        const priorDate = new Date(meeting.prior_mtg_date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        y = addWhereasResolved(doc, y,
          `WHEREAS, the minutes of the previous Annual Meeting held on ${priorDate} have been reviewed by the ${isLLC ? "members" : "shareholders"};`,
          `NOW, THEREFORE, BE IT RESOLVED, that the minutes of the Annual Meeting held on ${priorDate} are hereby approved and adopted as a true and accurate record of that meeting.`,
          bt
        );
      }
    }
  }

  // Old Business (skip for shareholder meetings and written consents - already handled above)
  if (!isShareholder && !isWrittenConsent && meeting.old_business?.trim()) {
    y += 3;
    y = checkPageBreak(doc, y, 30);
    y = section("Old Business");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const oldBizText = `The first order of business to come before the meeting was the discussion of old business.`;
    const oldBizLines = doc.splitTextToSize(oldBizText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of oldBizLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 2;
    const oldLines = doc.splitTextToSize(meeting.old_business.trim(), doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of oldLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 5;
  }


  // Directors / Board Election (shareholder meetings only)
  if (data.directors && (data.directors ?? []).length > 0 && isShareholder) {
    y += 3;
    y = checkPageBreak(doc, y, 30 + (data.directors ?? []).length * 7);
    y = section("Nomination and Election of Board of Directors");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const nominationText = `The chairperson announced that the next item of business was the nomination and election of the board of directors in accordance with the bylaws of the corporation. The following nomination(s) for the position of director(s) of the corporation were made and seconded:`;
    const nomLines = doc.splitTextToSize(nominationText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of nomLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 3;
    (data.directors ?? []).forEach(d => {
      y = checkPageBreak(doc, y, 6);
      doc.text(`•  ${d.director_name}`, MARGIN + 6, y);
      y += 5.5;
    });
    y += 5;

    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const voteText = `The secretary next took the votes of the shareholders entitled to vote for the election of directors at the meeting and upon motion duly made and seconded, it was unanimously`;
    const voteLines = doc.splitTextToSize(voteText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of voteLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 3;

    const rIndent = RESOLVED_INDENT;
    const resolvedPrefix = "RESOLVED, ";
    const resolvedBody = `that the following be elected as director(s) of the corporation, to serve for one year or until his/her respective successor should be duly elected and qualified.`;
    const fullResolved = resolvedPrefix + resolvedBody;
    const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - rIndent);
    y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);
    for (let i = 0; i < rLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bold");
        const prefixWidth = doc.getTextWidth(resolvedPrefix);
        doc.text(resolvedPrefix, MARGIN + rIndent, y);
        doc.setFont("Arial", "normal");
        const remainder = rLines[0].substring(resolvedPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + rIndent + prefixWidth, y);
      } else {
        doc.setFont("Arial", "normal");
        doc.text(rLines[i], MARGIN + rIndent, y);
      }
      y += 5.5;
    }
    y += 5;

    (data.directors ?? []).forEach(d => {
      y = checkPageBreak(doc, y, 6);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      doc.text(`•  ${d.director_name}`, MARGIN + 6, y);
      y += 5.5;
    });
    y += 8;
  }

  // Non-shareholder corp: Directors Present (before officers) — skip for written consents
  if (data.directors && (data.directors ?? []).length > 0 && !isShareholder && !isWrittenConsent && !isLLC) {
    y += 3;
    y = checkPageBreak(doc, y, 30 + (data.directors ?? []).length * 7);
    y = section("Directors Present");
    autoTable(doc, {
      startY: y,
      head: [["Director Name"]],
      body: (data.directors ?? []).map(d => [d.director_name]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Officers (with salary/bonus) — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.officers && (data.officers ?? []).length > 0) {
    y = checkPageBreak(doc, y, 30 + (data.officers ?? []).length * 7);
    y = section("Officers");
    const isSCorp = !!company?.s_election_date;

    const priorOfficerNames = new Set(
      (data.priorYear?.officers || []).map((o: any) => o.name?.toLowerCase())
    );
    const hasNewOfficers = (data.officers ?? []).some((o: any) => !priorOfficerNames.has(o.name?.toLowerCase()));
    const electionVerb = hasNewOfficers ? (isLLC ? "appointed" : "elected") : (isLLC ? "appointed" : "re-elected");

    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} ${isLLC ? "have" : "has"} reviewed the current ${isLLC ? "management" : "officer"} positions and compensation of ${companyName}${isSCorp ? ", and recognizing the requirement under IRC \u00A7 1366 that officer-shareholders receive reasonable compensation" : ""}; and`,
      "",
      bt
    );

    if (hasNewOfficers) {
      y = addWhereasResolved(doc, y,
        `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} ${isLLC ? "have" : "has"} determined it is in the best interests of the ${isLLC ? "LLC" : "corporation"} to elect the following persons as ${isLLC ? "managers/officers" : "officers"}; now therefore be it`,
        "",
        bt
      );
    }

    y = addWhereasResolved(doc, y,
      "",
      `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby ${electionVerb} as ${isLLC ? "managers/officers" : "officers"} of ${companyName}, at the compensation levels set forth below, which the Board has determined to be reasonable compensation for the services performed, and to serve until their successors are duly ${isLLC ? "appointed" : "elected"} and qualified:`,
      bt
    );

    const hasSalaryData = (data.officers ?? []).some(o => o.salary != null || o.bonus != null);
    autoTable(doc, {
      startY: y,
      head: [hasSalaryData ? ["Title", "Name", "Salary", "Bonus"] : ["Title", "Name"]],
      body: (data.officers ?? []).map(o => hasSalaryData
        ? [o.title, o.name, o.salary != null ? fmt(o.salary) : "\u2014", o.bonus != null ? fmt(o.bonus) : "\u2014"]
        : [o.title, o.name]
      ),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Compensation Determinations block
    const processedNames = new Set<string>();
    const compParagraphs: string[] = [];

    for (const o of data.officers) {
      if (!o.compensation_note || !o.compensation_status) continue;
      const nameKey = (o.name || "").trim().toLowerCase();
      if (o.compensation_status === "included_in_primary") continue;

      const secondaryRoles = (data.officers ?? []).filter((other: any) =>
        other.id !== o.id &&
        (other.name || "").trim().toLowerCase() === nameKey &&
        other.compensation_status === "included_in_primary" &&
        other.compensation_note
      );

      if (secondaryRoles.length > 0 && !processedNames.has(nameKey)) {
        compParagraphs.push(o.compensation_note);
        for (const sec of secondaryRoles) {
          compParagraphs.push(sec.compensation_note);
        }
        processedNames.add(nameKey);
      } else if (!processedNames.has(nameKey + o.id)) {
        compParagraphs.push(o.compensation_note);
      }
    }

    if (compParagraphs.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const introText = `The ${isLLC ? "members" : "Board of Directors"} made the following compensation determinations with respect to the ${isLLC ? "managers/officers" : "officers"} of the ${isLLC ? "LLC" : "corporation"}:`;
      const introLines = doc.splitTextToSize(introText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of introLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 3;

      for (const para of compParagraphs) {
        y = checkPageBreak(doc, y, 20);
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const noteLines = doc.splitTextToSize(para, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of noteLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
        y += 4;
      }
    }
  }

  // Authorized Binders (LLC only, non-shareholder) — AFTER officers — skip for written consents
  if (data.directors && (data.directors ?? []).length > 0 && !isShareholder && !isWrittenConsent && isLLC) {
    y += 3;
    y = checkPageBreak(doc, y, 30 + (data.directors ?? []).length * 7);
    y = section("Authorized Binders");
    if (mType.includes("annual")) {
      y = addWhereasResolved(doc, y,
        `WHEREAS, the members desire to confirm and record the persons serving as authorized binders of ${companyName} for the ensuing year, consistent with Wis. Stat. \u00A7 183.0407; and`,
        `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby confirmed as authorized binders of ${companyName} for the ensuing year, authorized to act on behalf of the company in their designated capacity:`,
        bt
      );
    }
    autoTable(doc, {
      startY: y,
      head: [["Authorized Binder Name"]],
      body: (data.directors ?? []).map(d => [d.director_name]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Shareholders — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.shareholders && (data.shareholders ?? []).length > 0) {
    y = checkPageBreak(doc, y, 30 + (data.shareholders ?? []).length * 7);
    const memberLabel = isLLC ? "Members" : "Shareholders";
    y = section(memberLabel);
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "shareholders"} of ${companyName} hold ownership interests as set forth below; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following ${isLLC ? "membership interests" : "share ownership"} is hereby acknowledged and confirmed:`,
      bt
    );
    const hasDistribution = (data.shareholders ?? []).some(s => s.distribution_amount != null && Number(s.distribution_amount) > 0);
    const usableW = doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN;
    autoTable(doc, {
      startY: y,
      head: [[
        "Name",
        "Address",
        isLLC ? "Membership Units" : "Common Shares",
        isLLC ? "Membership Interest %" : "Ownership %",
      ]],
      body: (data.shareholders ?? []).map(s => {
        const matchingShareholder = (data.companyShareholders || []).find(
          cs => cs.name?.toLowerCase().trim() === s.shareholder_name?.toLowerCase().trim()
        );
        // Prefer address from the meeting shareholder record, fall back to company shareholder
        const addr = s.address || matchingShareholder?.address || "";
        const addr2 = s.address_2 || (matchingShareholder as any)?.address_2 || "";
        const city = s.city || matchingShareholder?.city || "";
        const state = s.state || matchingShareholder?.state || "";
        const zip = s.zip || matchingShareholder?.zip || "";
        const line1 = [addr, addr2].filter(Boolean).join(", ");
        const line2 = [city, state].filter(Boolean).join(", ");
        const address = [line1, line2, zip].filter(Boolean).join(" ");
        return [
          s.shareholder_name,
          address || "---",
          s.common_shares?.toLocaleString() ?? "---",
          isLLC && s.preferred_shares != null ? `${s.preferred_shares}%` : (s.preferred_shares?.toLocaleString() ?? "---"),
        ];
      }),
      theme: "grid",
      headStyles: { ...tableHeadStyles, fontSize: 9, fontStyle: "bold" as const },
      bodyStyles: { fontSize: 9, cellPadding: { top: 1.4, bottom: 1.4, left: 2, right: 2 } },
      margin: { left: MARGIN, right: R_MARGIN },
      columnStyles: {
        0: { cellWidth: usableW * 0.25 },
        1: { cellWidth: usableW * 0.40 },
        2: { cellWidth: usableW * 0.15 },
        3: { cellWidth: usableW * 0.20 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Distribution resolution for each member/shareholder with a distribution amount
    if (hasDistribution) {
      const isSCorpEntity = !!company?.s_election_date;
      const distribMembers = (data.shareholders ?? []).filter(s => s.distribution_amount != null && Number(s.distribution_amount) > 0);

      if (distribMembers.length > 0) {
        const sCorpClause = isSCorpEntity || isLLC
          ? " and consistent with the Company's S Corporation election under Section 1362 of the Internal Revenue Code"
          : "";

        // Single WHEREAS statement for all distributions
        y = checkPageBreak(doc, y, 50);
        y = addWhereasResolved(doc, y,
          `WHEREAS, a resolution was presented to approve a distribution to the ${isLLC ? "members" : "shareholders"} in accordance with each ${isLLC ? "member's" : "shareholder's"} ownership interest in the Company${sCorpClause}. The ${isLLC ? "Managing Member" : "Board of Directors"} confirmed that the Company has sufficient cash flow and working capital to support the distribution without impairing the Company's operations or ability to meet its financial obligations. Upon motion duly made and seconded, the following resolutions were unanimously adopted:`,
          "",
          bt
        );

        // Individual RESOLVED for each member/shareholder
        const sCorpResolvedClause = isSCorpEntity || isLLC
          ? " and in compliance with the Company's S Corporation tax election"
          : "";
        const meetingDateStr = meeting.meeting_date
          ? new Date(meeting.meeting_date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "[DATE]";

        for (const s of distribMembers) {
          const distAmount = fmt(s.distribution_amount);
          const ownershipPct = s.preferred_shares != null ? `${s.preferred_shares}%` : "100%";
          y = checkPageBreak(doc, y, 30);
          y = addWhereasResolved(doc, y,
            "",
            `RESOLVED, that the Company is hereby authorized and directed to distribute the sum of ${distAmount} to ${s.shareholder_name}, consistent with the ${isLLC ? "member's" : "shareholder's"} ${ownershipPct} ownership interest${sCorpResolvedClause}, said distribution to be made on or before ${meetingDateStr}.`,
            bt
          );
        }
      }
    }
  }

  // Financials — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.financials) {
    const f = data.financials;
    y = checkPageBreak(doc, y, 80);
    y = section("Financial Comparison — Year to Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the financial statements of ${companyName} for the current and prior fiscal years; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the financial statements as presented are hereby accepted and approved:`,
      bt
    );

    const yoy = (cur: number | null | undefined, prev: number | null | undefined): string => {
      if (cur == null || prev == null || prev === 0) return "--";
      const change = ((cur - prev) / Math.abs(prev)) * 100;
      return `${change >= 0 ? "" : "-"}${Math.abs(change).toFixed(1)}%`;
    };

    const nrItems = (data.nonRecurringItems || []).filter((item: any) => item.description || item.amount);
    const totalNr = nrItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    const adjCurrentNetIncome = totalNr !== 0 ? (Number(f.current_net_income) || 0) - totalNr : null;
    const adjPreviousNetIncome = totalNr !== 0 ? (Number(f.previous_net_income) || 0) : null;

    const tableBody: any[][] = [
      ["Total Sales", fmt(f.current_total_sales), fmt(f.previous_total_sales), yoy(f.current_total_sales, f.previous_total_sales)],
      ["Cost of Goods", fmt(f.current_cog), fmt(f.previous_cog), yoy(f.current_cog, f.previous_cog)],
      ["Gross Profit", fmt(f.current_gross_profit), fmt(f.previous_gross_profit), yoy(f.current_gross_profit, f.previous_gross_profit)],
      ["COG Ratio (%)", f.current_cog_ratio != null ? `${Number(f.current_cog_ratio).toFixed(2)}%` : "—", f.previous_cog_ratio != null ? `${Number(f.previous_cog_ratio).toFixed(2)}%` : "—", yoy(f.current_cog_ratio, f.previous_cog_ratio)],
      ["Net Income", fmt(f.current_net_income), fmt(f.previous_net_income), yoy(f.current_net_income, f.previous_net_income)],
    ];

    if (totalNr !== 0) {
      nrItems.forEach((item: any) => {
        tableBody.push([`  Non-Recurring: ${item.description || ""}`, fmt(item.amount), "—", "—"]);
      });
      tableBody.push([
        "Adjusted Net Income",
        fmt(adjCurrentNetIncome),
        fmt(adjPreviousNetIncome),
        adjPreviousNetIncome && adjPreviousNetIncome !== 0 && adjCurrentNetIncome != null
          ? yoy(adjCurrentNetIncome, adjPreviousNetIncome)
          : "—",
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["", "Current Year", "Previous Year", "YoY Change"]],
      body: tableBody,
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "center", fontStyle: "bold" } },
      margin: { left: MARGIN, right: R_MARGIN },
      didParseCell: (data: any) => {
        // Bold the Adjusted Net Income row
        if (data.section === "body" && data.row.raw?.[0] === "Adjusted Net Income") {
          data.cell.styles.fontStyle = "bold";
        }
        // Indent non-recurring items
        if (data.section === "body" && typeof data.row.raw?.[0] === "string" && data.row.raw[0].startsWith("  Non-Recurring:")) {
          data.cell.styles.fontSize = 9;
          data.cell.styles.textColor = [100, 100, 100];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 5;

    // Footnote for non-recurring items
    if (nrItems.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(8);
      doc.setFont("Arial", "italic");
      doc.setTextColor(100, 100, 100);
      const meetingDateStr = data.meeting?.meeting_date
        ? new Date(data.meeting.meeting_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";
      nrItems.forEach((item: any) => {
        const noteText = `Note: Current year Net Income includes a one-time ${Number(item.amount) >= 0 ? "gain" : "loss"} of ${fmt(Math.abs(Number(item.amount)))} from ${item.description || "non-recurring transaction"}.`;
        const lines = doc.splitTextToSize(noteText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        doc.text(lines, MARGIN, y);
        y += lines.length * 4 + 2;
      });
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      y += 3;
    }

    // Draw simple YoY bar chart in PDF
    const pw = doc.internal.pageSize.getWidth();
    const chartW = (pw - 28) * 0.75;
    const chartH = 50 * 0.75;
    y = checkPageBreak(doc, y, chartH + 30);
    if (bt) {
      y = addSubHeading(doc, y, "Year to Year Visual Comparison");
    } else {
      y = addSectionTitle(doc, y, "Year to Year Visual Comparison");
    }

    const metrics = [
      { label: "Sales", cur: f.current_total_sales, prev: f.previous_total_sales },
      { label: "COG", cur: f.current_cog, prev: f.previous_cog },
      { label: "Gross Profit", cur: f.current_gross_profit, prev: f.previous_gross_profit },
      { label: "Net Income", cur: f.current_net_income, prev: f.previous_net_income },
    ];
    const maxVal = Math.max(...metrics.map(m => Math.max(Math.abs(m.cur || 0), Math.abs(m.prev || 0))), 1);
    const barGroupW = chartW / metrics.length;
    const barW = barGroupW * 0.3;
    const chartX = (pw - chartW) / 2;
    const chartBottom = y + chartH;

    // Background
    doc.setFillColor(248, 249, 250);
    doc.rect(chartX, y, chartW, chartH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(chartX, y, chartW, chartH, "S");

    const fmtShort = (v: number) => {
      const a = Math.abs(v);
      const sign = v < 0 ? "-" : "";
      if (a >= 1000000) return `${sign}$${(a / 1000000).toFixed(1)}M`;
      if (a >= 1000) return `${sign}$${Math.round(a / 1000)}K`;
      return `${sign}$${Math.round(a)}`;
    };

    metrics.forEach((m, i) => {
      const gx = chartX + i * barGroupW + barGroupW * 0.1;
      const curH = (Math.abs(m.cur || 0) / maxVal) * (chartH - 10);
      const prevH = (Math.abs(m.prev || 0) / maxVal) * (chartH - 10);

      // Current year bar (blue)
      doc.setFillColor(bt ? BLUE.r : 45, bt ? BLUE.g : 55, bt ? BLUE.b : 120);
      doc.rect(gx, chartBottom - curH, barW, curH, "F");

      // Previous year bar (gray)
      doc.setFillColor(160, 160, 160);
      doc.rect(gx + barW + 2, chartBottom - prevH, barW, prevH, "F");

      // Dollar amount labels above bars
      doc.setFontSize(6);
      doc.setFont("Arial", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(fmtShort(Number(m.cur || 0)), gx + barW / 2, chartBottom - curH - 1, { align: "center" });
      doc.text(fmtShort(Number(m.prev || 0)), gx + barW + 2 + barW / 2, chartBottom - prevH - 1, { align: "center" });

      // Label
      doc.setFontSize(8);
      doc.setFont("Arial", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(m.label, gx + barW, chartBottom + 4, { align: "center" });
    });

    // Legend
    const ly = chartBottom + 8;
    const legendTotalW = 48 + 6 + 40; // approx width of both legend items
    const legendX = (pw - legendTotalW) / 2;
    doc.setFillColor(bt ? BLUE.r : 45, bt ? BLUE.g : 55, bt ? BLUE.b : 120);
    doc.rect(legendX, ly, 6, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text("Current Year", legendX + 8, ly + 2.5);
    doc.setFillColor(160, 160, 160);
    doc.rect(legendX + 40, ly, 6, 3, "F");
    doc.text("Previous Year", legendX + 48, ly + 2.5);

    y = ly + 10;
  }

  // Counsel / Professional Advisors — skip for shareholder meetings and written consents
  const shouldRenderCounselSection = !isShareholder && !isWrittenConsent && (bt || (data.counsel && (data.counsel ?? []).length > 0));
  const counselRows = data.counsel && (data.counsel ?? []).length > 0 ? data.counsel : [{} as any];

  if (shouldRenderCounselSection) {
    y = checkPageBreak(doc, y, 20 + counselRows.length * 7);
    y = section("Selection of Counsel");

    // Extract attorney and accountant info from counsel records, with fallback to company-level data
    const counselRec = counselRows[0] || {};
    let attorneyName = counselRec.attorney_name?.trim() || "";
    let lawFirm = counselRec.law_firm?.trim() || "";
    let accountantName = counselRec.accountant_name?.trim() || "";
    let accountingFirm = counselRec.counsel_name?.trim() || ""; // counsel_name maps to accounting firm

    // Fallback to company-level attorneys/accountants if meeting_counsel is empty
    if (!attorneyName && data.companyAttorneys && (data.companyAttorneys ?? []).length > 0) {
      const atty = data.companyAttorneys[0];
      attorneyName = atty.attorney_name || "";
      lawFirm = atty.attorney_firms?.firm_name || "";
    }
    if (!accountantName && data.companyAccountants && (data.companyAccountants ?? []).length > 0) {
      const acct = data.companyAccountants[0];
      accountantName = acct.accountant_name || "";
      accountingFirm = acct.accountant_firms?.firm_name || "";
    }

    // Attorney / Law Firm paragraph
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    if (attorneyName && attorneyName.toLowerCase() !== "none appointed") {
      const firmPart = lawFirm ? ` of ${lawFirm}` : "";
      const attyText = `The chairperson then reviewed the legal associations of the ${isLLC ? "company" : "corporation"} and upon motion duly made and seconded, the following resolution was adopted:`;
      const attyLines = doc.splitTextToSize(attyText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of attyLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 2;
      y = addWhereasResolved(doc, y,
        `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the legal counsel needs of ${companyName}; and`,
        `NOW, THEREFORE, BE IT RESOLVED, that ${attorneyName}${firmPart} is hereby approved and retained as legal counsel for ${companyName} for the ensuing year.`,
        bt
      );
    } else {
      // No attorney appointed
      const attyText = `The chairperson then reviewed the legal associations of the ${isLLC ? "company" : "corporation"} and upon motion duly made and seconded, the following resolution was adopted:`;
      const attyLines = doc.splitTextToSize(attyText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of attyLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 2;
      const indent = RESOLVED_INDENT;
      const resolvedPrefix = "RESOLVED, ";
      const resolvedBody = `that no legal counsel will be retained by the ${isLLC ? "company" : "corporation"}. When legal services are required, the ${isLLC ? "managing member" : "president"} of the ${isLLC ? "company" : "corporation"} is authorized to engage legal counsel as deemed appropriate.`;
      const fullResolved = resolvedPrefix + resolvedBody;
      const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - indent);
      y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);
      for (let i = 0; i < rLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("Arial", "bold");
          const prefixWidth = doc.getTextWidth(resolvedPrefix);
          doc.text(resolvedPrefix, MARGIN + indent, y);
          doc.setFont("Arial", "normal");
          const remainder = rLines[0].substring(resolvedPrefix.length);
          if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
        } else {
          doc.setFont("Arial", "normal");
          doc.text(rLines[i], MARGIN + indent, y);
        }
        y += 5.5;
      }
      y += 5;
    }

    // Accountant / Accounting Firm paragraph
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    if (accountantName && accountantName.toLowerCase() !== "none appointed") {
      const firmPart = accountingFirm ? ` of ${accountingFirm}` : "";
      const acctText = `The chairperson then reviewed the accounting associations of the ${isLLC ? "company" : "corporation"} and upon motion duly made and seconded, the following resolution was adopted:`;
      const acctLines = doc.splitTextToSize(acctText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of acctLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 2;
      y = addWhereasResolved(doc, y,
        `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the accounting needs of ${companyName}; and`,
        `NOW, THEREFORE, BE IT RESOLVED, that ${accountantName}${firmPart} is hereby approved and retained as accountant for ${companyName} for the ensuing year.`,
        bt
      );
    } else {
      const acctText = `The chairperson then reviewed the accounting associations of the ${isLLC ? "company" : "corporation"} and upon motion duly made and seconded, the following resolution was adopted:`;
      const acctLines = doc.splitTextToSize(acctText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of acctLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 2;
      const indent = RESOLVED_INDENT;
      const resolvedPrefix = "RESOLVED, ";
      const resolvedBody = `that no accountant will be retained by the ${isLLC ? "company" : "corporation"}. When accounting services are required, the ${isLLC ? "managing member" : "president"} of the ${isLLC ? "company" : "corporation"} is authorized to engage an accountant as deemed appropriate.`;
      const fullResolved = resolvedPrefix + resolvedBody;
      const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - indent);
      y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);
      for (let i = 0; i < rLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("Arial", "bold");
          const prefixWidth = doc.getTextWidth(resolvedPrefix);
          doc.text(resolvedPrefix, MARGIN + indent, y);
          doc.setFont("Arial", "normal");
          const remainder = rLines[0].substring(resolvedPrefix.length);
          if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
        } else {
          doc.setFont("Arial", "normal");
          doc.text(rLines[i], MARGIN + indent, y);
        }
        y += 5.5;
      }
      y += 5;
    }
  }

  // Banking Section (separate from counsel) — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent) {
    const counselRec = counselRows[0] || {} as any;
    let bankNameForTable = counselRec.bank_name?.trim() || "";
    if (!bankNameForTable && data.companyBanks && (data.companyBanks ?? []).length > 0) {
      bankNameForTable = (data.companyBanks ?? []).map((b: any) => b.bank_name).filter(Boolean).join(", ");
    }

    const hasLOC = counselRec.loc_enabled;
    const locAmount = counselRec.loc_amount;
    const locRate = counselRec.loc_interest_rate;

    const hasBankingContent = bt || bankNameForTable || hasLOC || (data.companyBanks && (data.companyBanks ?? []).length > 0) || (data.authorizedSigners && (data.authorizedSigners ?? []).length > 0);

    if (hasBankingContent) {
      y = checkPageBreak(doc, y, 40);
      y = section("Banking");

      // Banking summary table
      const bankTableBody: string[][] = [];
      const bankTableHead = ["Bank", "Line of Credit", "LOC Amount", "Interest Rate"];
      bankTableBody.push([
        bankNameForTable || "—",
        hasLOC ? "Yes" : "No",
        hasLOC && locAmount != null ? fmt(locAmount) : "—",
        hasLOC && locRate ? locRate : "—",
      ]);

      autoTable(doc, {
        startY: y,
        head: [bankTableHead],
        body: bankTableBody,
        theme: "grid",
        headStyles: tableHeadStyles,
        bodyStyles: { fontSize: 10 },
        margin: { left: MARGIN, right: R_MARGIN },
      });
      y = (doc as any).lastAutoTable.finalY + 6;

      // Banking Resolutions for Annual Meetings (use company-level bank data)
      const annualBanks = data.companyBanks || [];
      const annualSigners = data.companyBankSigners || [];
      if (annualBanks.length > 0) {
        y = checkPageBreak(doc, y, 30 + annualBanks.length * 12);
        doc.setFontSize(11);
        doc.setFont("Arial", "normal");
        doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        const bankIntro = `The chairperson then reviewed the banking relationships of the ${isLLC ? "company" : "corporation"} and upon motion duly made and seconded, the following resolution was adopted:`;
        const bankIntroLines = doc.splitTextToSize(bankIntro, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of bankIntroLines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5.5;
        }
        y += 2;
        annualBanks.forEach((bank: any) => {
          // First try company-level bank signers; fall back to meeting-level authorized signers matched by bank name
          let bankSignerList = annualSigners.filter((s: any) => s.bank_id === bank.id);
          if (bankSignerList.length === 0 && data.authorizedSigners && (data.authorizedSigners ?? []).length > 0) {
            bankSignerList = (data.authorizedSigners ?? []).filter((s: any) =>
              s.bank_name && bank.bank_name && s.bank_name.toLowerCase().trim() === bank.bank_name.toLowerCase().trim()
            );
          }
          const signerStr = bankSignerList.map((s: any) => `${s.signer_name}${s.title ? `, ${s.title}` : ""}`).join("; ");
          y = addWhereasResolved(doc, y,
            `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the banking relationship with ${bank.bank_name}; and`,
            `NOW, THEREFORE, BE IT RESOLVED, that ${bank.bank_name} is hereby approved and confirmed as a depository for the funds of ${companyName}${signerStr ? `, and that the following persons are hereby authorized as signers on said account: ${signerStr}` : ""}.`,
            bt
          );
        });
      }
      // Also render authorized signers from meeting_authorized_signers if available
      if (data.authorizedSigners && (data.authorizedSigners ?? []).length > 0) {
        // Filter out signers already rendered via bank resolutions above
        const renderedBankNames = new Set(annualBanks.map((b: any) => b.bank_name?.toLowerCase().trim()));
        const remainingSigners = (data.authorizedSigners ?? []).filter((s: any) =>
          !renderedBankNames.has(s.bank_name?.toLowerCase().trim())
        );
        if (remainingSigners.length > 0) {
          y = checkPageBreak(doc, y, 20 + remainingSigners.length * 7);
          autoTable(doc, {
            startY: y,
            head: [["Bank", "Authorized Signer", "Authority Type"]],
            body: remainingSigners.map((s: any) => [
              s.bank_name || "—",
              s.signer_name || "—",
              s.title || "—",
            ]),
            theme: "grid",
            headStyles: tableHeadStyles,
            bodyStyles: { fontSize: 10 },
            margin: { left: MARGIN, right: R_MARGIN },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }
      }
    }
  }

  // Loans — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.loans && (data.loans ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.loans ?? []).length * 7);
    y = section("Loans");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the borrowing needs and existing loan obligations of ${companyName}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following loans are hereby approved and the proper officers are authorized to execute all necessary documents:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Type", "Rate", "Amount", "Date", "Notes"]],
      body: (data.loans ?? []).map(l => [
        l.loan_type || "—",
        l.loan_rate != null ? `${Number(l.loan_rate).toFixed(2)}%` : "—",
        l.loan_amount != null ? fmt(l.loan_amount) : "—",
        l.loan_date ? new Date(l.loan_date + "T00:00:00").toLocaleDateString() : "—",
        l.notes || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Annual Balance Reporting — two stacked tables from meeting_balance_entries
  if (!isShareholder && !isWrittenConsent) {
    const toRows = (data.balanceEntries || []).filter((e: any) => e.direction === "to");
    const fromRows = (data.balanceEntries || []).filter((e: any) => e.direction === "from");
    
    const fmtBal = (v: any) => v != null ? `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "$0.00";
    const balHead = [["Name / Party", "Relationship", "Beg. Balance", "Advances", "Repayments", "End. Balance"]];
    const mapRow = (e: any) => [e.party_name || "—", e.relationship || "—", fmtBal(e.beginning_balance), fmtBal(e.advances), fmtBal(e.repayments), fmtBal(e.ending_balance)];

    if (toRows.length > 0 || fromRows.length > 0) {
      y = checkPageBreak(doc, y, 30);
      y = section("Annual Balance Reporting");

      if (toRows.length > 0) {
        doc.setFontSize(11); doc.setFont("Arial", "bold"); doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        doc.text("Loans TO Shareholders / Members / Related Parties", MARGIN, y); y += 5;
        autoTable(doc, { startY: y, head: balHead, body: toRows.map(mapRow), theme: "grid", headStyles: tableHeadStyles, bodyStyles: { fontSize: 10 }, margin: { left: MARGIN, right: R_MARGIN } });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
      if (fromRows.length > 0) {
        y = checkPageBreak(doc, y, 30);
        doc.setFontSize(11); doc.setFont("Arial", "bold"); doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
        doc.text("Loans FROM Shareholders / Members / Related Parties", MARGIN, y); y += 5;
        autoTable(doc, { startY: y, head: balHead, body: fromRows.map(mapRow), theme: "grid", headStyles: tableHeadStyles, bodyStyles: { fontSize: 10 }, margin: { left: MARGIN, right: R_MARGIN } });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
    }
  }

  const vehiclePolicyText = meeting?.vehicle_policy_text?.trim();
  const hasVehicleActivity = !isShareholder && !isWrittenConsent && data.capitalAssets && (data.capitalAssets ?? []).length > 0;

  if (bt && vehiclePolicyText && hasVehicleActivity) {
    y = checkPageBreak(doc, y, 30);
    y = section("Company Vehicle Policy");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const policyLines = doc.splitTextToSize(vehiclePolicyText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of policyLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 6;
  }

  // Capital Asset Additions and Disposals — unified table
  if (!isShareholder && !isWrittenConsent && data.capitalAssets && (data.capitalAssets ?? []).length > 0) {
    // Estimate total height: header ~10 + rows ~8 each + whereas/resolved ~30 + closing ~15
    const estimatedHeight = 60 + (data.capitalAssets ?? []).length * 8;
    y = checkPageBreak(doc, y, estimatedHeight);
    y = section("Capital Asset Additions and Disposals During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, it is necessary for the company to obtain vehicles and equipment for the efficient operation of the business, and after discussion, the ${isLLC ? "members" : "directors"} decided that it would be in the best interests of the company to acquire or dispose of the following asset(s);`,
      `RESOLVED, that the following capital asset transactions are hereby approved and ratified:`,
      bt
    );

    // Badge colors for Type column
    const typeBadgeStyles: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
      Vehicle:   { bg: [220, 232, 243], text: [26, 63, 92] },    // #dce8f3 / #1a3f5c
      Equipment: { bg: [225, 240, 232], text: [26, 69, 48] },    // #e1f0e8 / #1a4530
    };
    // Badge colors for Transaction column
    const txnBadgeStyles: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
      Purchased:  { bg: [232, 240, 220], text: [42, 64, 16] },   // #e8f0dc / #2a4010
      Sold:       { bg: [253, 232, 232], text: [92, 26, 26] },   // #fde8e8 / #5c1a1a
      "Trade-in": { bg: [237, 232, 243], text: [46, 26, 92] },   // #ede8f3 / #2e1a5c
      Scrapped:   { bg: [229, 229, 229], text: [55, 55, 55] },    // #e5e5e5 / #373737
      Donated:    { bg: [220, 240, 232], text: [20, 80, 60] },    // #dcf0e8 / #14503c
      "Insurance Totaled": { bg: [253, 220, 220], text: [120, 20, 20] }, // #fddcdc / #781414
    };

    const headerBg: [number, number, number] = [220, 232, 243];       // #dce8f3
    const headerText: [number, number, number] = [26, 63, 92];        // #1a3f5c
    const headerBorder: [number, number, number] = [176, 200, 222];   // #b0c8de
    const cellBorder: [number, number, number] = [205, 218, 234];     // #cddaea
    const altRowBg: [number, number, number] = [245, 248, 252];

    autoTable(doc, {
      startY: y,
      head: [["Year / Make / Model", "Type", "Transaction", "VIN / Serial No.", "Date", "Amount", "Seller / Buyer"]],
      body: (data.capitalAssets ?? []).map((v: any) => [
        v.year_make_model || "—",
        v.asset_type || "Vehicle",
        v.transaction_type || "Purchased",
        v.vin || "—",
        v.date ? new Date(v.date + "T00:00:00").toLocaleDateString() : "—",
        v.amount != null ? fmt(v.amount) : "—",
        v.seller || "—",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: headerBg,
        textColor: headerText,
        fontSize: 8.2,
        fontStyle: "bold",
        lineWidth: 0.18,
        lineColor: headerBorder,
      },
      bodyStyles: {
        fontSize: 8.8,
        lineWidth: 0.18,
        lineColor: cellBorder,
        cellPadding: 2.5,
      },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      pageBreak: "avoid",
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          // Alternating row shading
          if (hookData.row.index % 2 === 1) {
            hookData.cell.styles.fillColor = altRowBg;
          }
          // Type badge (col 1)
          if (hookData.column.index === 1) {
            const style = typeBadgeStyles[hookData.cell.raw as string];
            if (style) {
              hookData.cell.styles.fillColor = style.bg;
              hookData.cell.styles.textColor = style.text;
              hookData.cell.styles.fontStyle = "bold";
            }
          }
          // Transaction badge (col 2)
          if (hookData.column.index === 2) {
            const style = txnBadgeStyles[hookData.cell.raw as string];
            if (style) {
              hookData.cell.styles.fillColor = style.bg;
              hookData.cell.styles.textColor = style.text;
              hookData.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Closing paragraph
    doc.setFontSize(10);
    doc.setFont("Arial", "italic");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const closingText = "A summary of total capital expenditures and disposals for the year is maintained in the financial statements and will be depreciated or adjusted in accordance with the company's accounting policies. Supporting documentation for all transactions is retained in the corporate records.";
    const closingLines = doc.splitTextToSize(closingText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of closingLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 6;
  }

  // Vehicle and Equipment Leases section
  if (!isShareholder && !isWrittenConsent && data.vehicleLeases && (data.vehicleLeases ?? []).length > 0) {
    const leaseEstHeight = 60 + (data.vehicleLeases ?? []).length * 8;
    y = checkPageBreak(doc, y, leaseEstHeight);
    y = section("Vehicle and Equipment Leases Entered Into During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, it is in the best interests of the company to lease certain vehicles and equipment necessary for the efficient operation of the business, and after discussion, the ${isLLC ? "members" : "directors"} approved entering into the following lease agreement(s);`,
      `RESOLVED, that the following lease agreements are hereby approved and ratified:`,
      bt
    );

    const leaseHeaderBg: [number, number, number] = [220, 232, 243];
    const leaseHeaderText: [number, number, number] = [26, 63, 92];
    const leaseHeaderBorder: [number, number, number] = [176, 200, 222];
    const leaseCellBorder: [number, number, number] = [205, 218, 234];
    const leaseAltRowBg: [number, number, number] = [245, 248, 252];

    const leaseTypeBadgeStyles: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
      Vehicle:   { bg: [220, 232, 243], text: [26, 63, 92] },
      Equipment: { bg: [225, 240, 232], text: [26, 69, 48] },
    };

    autoTable(doc, {
      startY: y,
      head: [["Year / Make / Model", "Type", "VIN / Serial No.", "Lessor", "Start Date", "End Date", "Monthly\nPayment", "Total Lease\nValue"]],
      body: (data.vehicleLeases ?? []).map((v: any) => [
        v.year_make_model || "—",
        v.asset_type || "Vehicle",
        v.vin || "—",
        v.lessor_name || "—",
        v.lease_start_date ? new Date(v.lease_start_date + "T00:00:00").toLocaleDateString() : "—",
        v.lease_end_date ? new Date(v.lease_end_date + "T00:00:00").toLocaleDateString() : "—",
        v.monthly_lease_payment != null ? fmt(v.monthly_lease_payment) : "—",
        v.total_lease_value != null ? fmt(v.total_lease_value) : "—",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: leaseHeaderBg,
        textColor: leaseHeaderText,
        fontSize: 8.2,
        fontStyle: "bold",
        lineWidth: 0.18,
        lineColor: leaseHeaderBorder,
      },
      bodyStyles: {
        fontSize: 8.8,
        lineWidth: 0.18,
        lineColor: leaseCellBorder,
        cellPadding: 2.5,
      },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      pageBreak: "avoid",
      didParseCell: (hookData: any) => {
        if (hookData.section === "body") {
          if (hookData.row.index % 2 === 1) {
            hookData.cell.styles.fillColor = leaseAltRowBg;
          }
          if (hookData.column.index === 1) {
            const style = leaseTypeBadgeStyles[hookData.cell.raw as string];
            if (style) {
              hookData.cell.styles.fillColor = style.bg;
              hookData.cell.styles.textColor = style.text;
              hookData.cell.styles.fontStyle = "bold";
            }
          }
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFontSize(10);
    doc.setFont("Arial", "italic");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const leaseClosing = "Leased assets are not owned by the company and are not recorded as capital assets on the balance sheet. Lease obligations are recorded in accordance with the company's accounting policies. Supporting documentation for all lease agreements is retained in the corporate records.";
    const leaseClosingLines = doc.splitTextToSize(leaseClosing, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of leaseClosingLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 6;
  }

  // Vehicles Sold During the Year — mirrors UI, sourced from meeting_vehicle_sales
  console.log("[meeting-pdf-export] Vehicles Sold guard:", {
    isShareholder,
    isWrittenConsent,
    hasVehiclesSold: !!data.vehiclesSold,
    vehiclesSoldLength: data.vehiclesSold?.length ?? 0,
    vehiclesSoldSample: data.vehiclesSold?.[0],
  });
  if (!isShareholder && !isWrittenConsent && data.vehiclesSold && (data.vehiclesSold ?? []).length > 0) {
    const soldEstHeight = 60 + (data.vehiclesSold ?? []).length * 8;
    y = checkPageBreak(doc, y, soldEstHeight);
    y = section("Vehicles Sold During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, during the year the company sold or otherwise disposed of certain vehicles no longer required for business operations, and the ${isLLC ? "members" : "directors"} have reviewed each disposition;`,
      `RESOLVED, that the following vehicle dispositions are hereby approved, ratified, and confirmed:`,
      bt
    );

    const soldHeaderBg: [number, number, number] = [220, 232, 243];
    const soldHeaderText: [number, number, number] = [26, 63, 92];
    const soldHeaderBorder: [number, number, number] = [176, 200, 222];
    const soldCellBorder: [number, number, number] = [205, 218, 234];
    const soldAltRowBg: [number, number, number] = [245, 248, 252];

    autoTable(doc, {
      startY: y,
      head: [["Year / Make / Model", "VIN / Serial No.", "Sale Date", "Sale Price", "Buyer", "Reason"]],
      body: (data.vehiclesSold ?? []).map((v: any) => [
        v.year_make_model || "—",
        v.vin || "—",
        v.sale_date ? new Date(v.sale_date + "T00:00:00").toLocaleDateString() : "—",
        v.sale_price != null ? fmt(v.sale_price) : "—",
        v.buyer_name || "—",
        v.reason_for_sale || "—",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: soldHeaderBg,
        textColor: soldHeaderText,
        fontSize: 8.2,
        fontStyle: "bold",
        lineWidth: 0.18,
        lineColor: soldHeaderBorder,
      },
      bodyStyles: {
        fontSize: 8.8,
        lineWidth: 0.18,
        lineColor: soldCellBorder,
        cellPadding: 2.5,
      },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      pageBreak: "avoid",
      didParseCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.row.index % 2 === 1) {
          hookData.cell.styles.fillColor = soldAltRowBg;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    doc.setFontSize(10);
    doc.setFont("Arial", "italic");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const soldClosing = "Proceeds from vehicle dispositions and any resulting gains or losses have been recorded in the company's financial statements in accordance with the company's accounting policies. Supporting documentation, including bills of sale and title transfer records, is retained in the corporate records.";
    const soldClosingLines = doc.splitTextToSize(soldClosing, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of soldClosingLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 6;
  }

  if (!isShareholder && !isWrittenConsent && data.assets && (data.assets ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.assets ?? []).length * 7);
    y = section("Equipment Transactions");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(bt ? BODY_COLOR[0] : 30, bt ? BODY_COLOR[1] : 30, bt ? BODY_COLOR[2] : 30);
    const equipIntro = `Next, the chairperson reviewed the equipment needs of the ${isLLC ? "company" : "corporation"}, and whereas it is necessary to acquire or dispose of certain equipment for the efficient operation of the business, it was`;
    const equipLines = doc.splitTextToSize(equipIntro, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of equipLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 2;
    const indent = RESOLVED_INDENT;
    const resolvedPrefix = "RESOLVED, ";
    const resolvedBody = `that the company acquire/dispose of the equipment generally described below:`;
    const fullResolved = resolvedPrefix + resolvedBody;
    const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - indent);
    for (let i = 0; i < rLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("Arial", "bold");
        const prefixWidth = doc.getTextWidth(resolvedPrefix);
        doc.text(resolvedPrefix, MARGIN + indent, y);
        doc.setFont("Arial", "normal");
        const remainder = rLines[0].substring(resolvedPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
      } else {
        doc.setFont("Arial", "normal");
        doc.text(rLines[i], MARGIN + indent, y);
      }
      y += 5.5;
    }
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Transaction", "Date", "Equipment", "Make/Model", "Amount"]],
      body: (data.assets ?? []).map((a: any) => [
        a.asset_type || "Purchased",
        a.value != null ? "—" : "—",
        a.description || "—",
        "—",
        a.value != null ? fmt(a.value) : "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Lease Terminations — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.leaseTerminations && (data.leaseTerminations ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.leaseTerminations ?? []).length * 7);
    y = section("Leases Ended During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the leases that have expired or been terminated by ${companyName} during the year; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the termination or expiration of the following leases is hereby acknowledged and ratified:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Property / Vehicle", "Landlord / Lessor", "End Date", "Reason", "Early Term.", "Penalty"]],
      body: (data.leaseTerminations ?? []).map((v: any) => [
        v.property_description || "—",
        v.landlord_name || "—",
        v.lease_end_date ? new Date(v.lease_end_date + "T00:00:00").toLocaleDateString() : "—",
        v.termination_reason || "—",
        v.early_termination ? "Yes" : "No",
        v.penalty_amount != null ? fmt(v.penalty_amount) : "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Company-Level Leases (from company_assets table)
  if (!isShareholder && !isWrittenConsent && data.companyLeases && (data.companyLeases ?? []).length > 0) {
    const clEstHeight = 60 + (data.companyLeases ?? []).length * 8;
    y = checkPageBreak(doc, y, clEstHeight);
    y = section("Real Property and Facility Leases");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the real property and facility lease obligations of ${companyName}; and`,
      `RESOLVED, that the following lease arrangements are hereby acknowledged and ratified:`,
      bt
    );

    const clHeaderBg: [number, number, number] = [220, 232, 243];
    const clHeaderText: [number, number, number] = [26, 63, 92];
    const clHeaderBorder: [number, number, number] = [176, 200, 222];
    const clCellBorder: [number, number, number] = [205, 218, 234];
    const clAltRowBg: [number, number, number] = [245, 248, 252];

    autoTable(doc, {
      startY: y,
      head: [["Property Description", "Property Address", "Landlord", "Landlord Address", "Monthly\nPayment"]],
      body: (data.companyLeases ?? []).map((l: any) => [
        l.description || "—",
        l.address || "—",
        l.landlord_name || "—",
        l.landlord_address || "—",
        l.monthly_payment != null ? fmt(l.monthly_payment) : "—",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: clHeaderBg,
        textColor: clHeaderText,
        fontSize: 8.2,
        fontStyle: "bold",
        lineWidth: 0.18,
        lineColor: clHeaderBorder,
      },
      bodyStyles: {
        fontSize: 8.8,
        lineWidth: 0.18,
        lineColor: clCellBorder,
        cellPadding: 2.5,
      },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      willDrawCell: (hookData: any) => {
        if (hookData.section === "body" && hookData.row.index % 2 === 1) {
          hookData.cell.styles.fillColor = clAltRowBg;
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    // Render leasehold improvements if any lease has them
    const leasesWithImprovements = (data.companyLeases ?? []).filter((l: any) => l.leasehold_improvement_amount || l.leasehold_improvement_description);
    if (leasesWithImprovements.length > 0) {
      y += 2;
      y = checkPageBreak(doc, y, 20);
      doc.setFontSize(10);
      doc.setFont("Arial", "bold");
      doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
      doc.text("Leasehold Improvements by Property", MARGIN, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [["Property", "Property Address", "Improvement Amount", "Description"]],
        body: leasesWithImprovements.map((l: any) => [
          l.description || "—",
          l.address || "—",
          l.leasehold_improvement_amount != null ? fmt(l.leasehold_improvement_amount) : "—",
          l.leasehold_improvement_description || "—",
        ]),
        theme: "grid",
        headStyles: {
          fillColor: clHeaderBg,
          textColor: clHeaderText,
          fontSize: 8.2,
          fontStyle: "bold",
          lineWidth: 0.18,
          lineColor: clHeaderBorder,
        },
        bodyStyles: {
          fontSize: 8.8,
          lineWidth: 0.18,
          lineColor: clCellBorder,
          cellPadding: 2.5,
        },
        margin: { left: MARGIN, right: R_MARGIN },
        styles: { overflow: "linebreak", cellWidth: "auto" },
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }

    y += 2;
    doc.setFontSize(10);
    doc.setFont("Arial", "italic");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const clClosing = "All lease obligations are recorded in accordance with the company's accounting policies. Supporting documentation for all lease agreements is retained in the corporate records.";
    const clLines = doc.splitTextToSize(clClosing, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of clLines) {
      y = checkPageBreak(doc, y, 5);
      doc.text(line, MARGIN, y);
      y += 4.5;
    }
    y += 6;
  }

  // Amendments — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.amendments && (data.amendments ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.amendments ?? []).length * 12);
    y = section("Amendments");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have determined that certain amendments to the governing documents of ${companyName} are in the best interests of the ${isLLC ? "company" : "corporation"}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following amendments are hereby adopted:`,
      bt
    );
    (data.amendments ?? []).forEach((a) => {
      y = checkPageBreak(doc, y, 25);
      doc.setFontSize(11);
      doc.setFont("Arial", "bold");
      doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
      doc.text(a.amendment_type || "Amendment", MARGIN, y);
      y += 6;
      doc.setFont("Arial", "normal");
      doc.setFontSize(11);
      doc.setTextColor(bt ? BODY_COLOR[0] : 30, bt ? BODY_COLOR[1] : 30, bt ? BODY_COLOR[2] : 30);
      const lines = doc.splitTextToSize(a.amendment_text || "", doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of lines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 5;
    });
  }

  // Resolutions
  if (data.resolutions && (data.resolutions ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.resolutions ?? []).length * 15);
    y = section("Special Resolutions");
    (data.resolutions ?? []).forEach((r) => {
      y = addResolutionBlock(doc, y, r.purpose, r.resolution_text || "");
    });
  }

  // Auto-generated resolutions from prior year comparison — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.priorYear) {
    const autoResolutions: { purpose: string; text: string }[] = [];
    const entityType = company?.entity_type || "Corporation";
    const isLLC = entityType === "LLC" || entityType === "Single Member LLC";
    const entityLabel = isLLC ? "LLC" : "corporation";

    // Officer changes: new officers, title changes, salary/bonus changes
    if (data.officers && (data.officers ?? []).length > 0) {
      const priorOfficers = data.priorYear.officers || [];
      const priorByName: Record<string, any> = {};
      priorOfficers.forEach((o: any) => { priorByName[o.name?.toLowerCase()] = o; });

      (data.officers ?? []).forEach((o: any) => {
        const prior = priorByName[o.name?.toLowerCase()];
        if (!prior) {
          // New officer elections are now handled in the combined Officers section above
          // — no separate resolution needed
        } else {
          if (o.salary != null && prior.salary != null && Number(o.salary) !== Number(prior.salary)) {
            autoResolutions.push({
              purpose: `Adjust ${o.title} Salary`,
              text: `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the compensation of ${o.name}, ${o.title}, and after discussion, it was\n\nRESOLVED, that the annual salary of ${o.name}, ${o.title}, is hereby adjusted from ${fmt(prior.salary)} to ${fmt(o.salary)}, effective immediately.`,
            });
          }
          if (o.bonus != null && prior.bonus != null && Number(o.bonus) !== Number(prior.bonus)) {
            autoResolutions.push({
              purpose: `Adjust ${o.title} Bonus`,
              text: `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the bonus compensation of ${o.name}, ${o.title}, and after discussion, it was\n\nRESOLVED, that a bonus of ${fmt(o.bonus)} is hereby authorized for ${o.name}, ${o.title} (prior year bonus: ${fmt(prior.bonus)}).`,
            });
          }
          if (o.title !== prior.title) {
            autoResolutions.push({
              purpose: `Change Officer Title`,
              text: `WHEREAS, ${o.name} previously held the title of ${prior.title}, and the ${isLLC ? "members" : "Board"} have determined a change is appropriate, it was\n\nRESOLVED, that ${o.name} is hereby appointed as ${o.title} of the ${entityLabel}, replacing the prior title of ${prior.title}.`,
            });
          }
        }
      });
    }

    // Benefit changes
    if (data.benefits && (data.benefits ?? []).length > 0) {
      const priorBenefits = data.priorYear.benefits || [];
      const priorTypes = new Set(priorBenefits.map((b: any) => (b.benefit_type || b.benefit_description || "").toLowerCase()));

      (data.benefits ?? []).forEach((b: any) => {
        const bType = b.benefit_type || b.benefit_description || "Benefit Plan";
        if (!priorTypes.has(bType.toLowerCase())) {
          autoResolutions.push({
            purpose: `Approve ${bType}`,
            text: `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the proposed ${bType} plan${b.provider ? ` with ${b.provider}` : ""}, and after discussion, it was\n\nRESOLVED, that the ${entityLabel} is hereby authorized to establish the ${bType} plan${b.provider ? ` through ${b.provider}` : ""}${b.retirement_contribution != null ? `, with a contribution of ${fmt(b.retirement_contribution)}` : ""}${b.plan_year ? `, effective for plan year ${b.plan_year}` : ""}.`,
          });
        } else {
          const priorMatch = priorBenefits.find((pb: any) => (pb.benefit_type || pb.benefit_description || "").toLowerCase() === bType.toLowerCase());
          if (priorMatch && b.retirement_contribution != null && priorMatch.retirement_contribution != null && Number(b.retirement_contribution) !== Number(priorMatch.retirement_contribution)) {
            autoResolutions.push({
              purpose: `Adjust ${bType} Contribution`,
              text: `WHEREAS, the ${isLLC ? "members" : "Board"} have reviewed the ${bType} plan, and after discussion, it was\n\nRESOLVED, that the contribution to the ${bType} plan is hereby adjusted from ${fmt(priorMatch.retirement_contribution)} to ${fmt(b.retirement_contribution)}.`,
            });
          }
        }
      });
    }

    // Loan changes
    if (data.loans && (data.loans ?? []).length > 0) {
      const priorLoans = data.priorYear.loans || [];
      const priorLoanTypes = new Set(priorLoans.map((l: any) => `${l.loan_type || ""}|${l.loan_amount || ""}`));

      (data.loans ?? []).forEach((l: any) => {
        const key = `${l.loan_type || ""}|${l.loan_amount || ""}`;
        if (!priorLoanTypes.has(key)) {
          autoResolutions.push({
            purpose: `Authorize ${l.loan_type || "Loan"}`,
            text: `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have determined it is in the best interests of the ${entityLabel} to obtain financing, and after discussion, it was\n\nRESOLVED, that the proper officers are hereby authorized to execute any documents necessary to establish a ${l.loan_type || "loan"}${l.loan_amount != null ? ` in the amount of ${fmt(l.loan_amount)}` : ""}${l.loan_rate != null ? ` at a rate of ${Number(l.loan_rate).toFixed(2)}%` : ""}.`,
          });
        }
      });
    }

    // Authorized signer changes
    if (data.authorizedSigners && (data.authorizedSigners ?? []).length > 0) {
      const priorSigners = data.priorYear.authorizedSigners || [];
      const priorNames = new Set(priorSigners.map((s: any) => s.signer_name?.toLowerCase()));

      (data.authorizedSigners ?? []).forEach((s: any) => {
        if (!priorNames.has(s.signer_name?.toLowerCase())) {
          autoResolutions.push({
            purpose: `Authorize Bank Signer`,
            text: `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have determined it is necessary to update the authorized signers, and after discussion, it was\n\nRESOLVED, that ${s.signer_name}${s.title ? `, ${s.title},` : ""} is hereby authorized as a signer${s.bank_name ? ` on the accounts at ${s.bank_name}` : ""}.`,
          });
        }
      });
    }

    // Print auto-generated resolutions
    if (autoResolutions.length > 0) {
      y += 3;
      y = checkPageBreak(doc, y, 20 + autoResolutions.length * 20);
      y = section("Resolutions — Changes from Prior Year");

      doc.setFontSize(9);
      doc.setFont("Arial", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("The following resolutions were auto-generated based on changes from the prior year meeting record.", MARGIN, y);
      y += 7;

      autoResolutions.forEach((r) => {
        y = checkPageBreak(doc, y, 30);
        doc.setFontSize(11);
        doc.setFont("Arial", "bold");
        doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
        doc.text(r.purpose, MARGIN, y);
        y += 6;
        doc.setFont("Arial", "normal");
        doc.setFontSize(11);
        doc.setTextColor(bt ? BODY_COLOR[0] : 30, bt ? BODY_COLOR[1] : 30, bt ? BODY_COLOR[2] : 30);
        const lines = doc.splitTextToSize(r.text, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        for (const line of lines) {
          y = checkPageBreak(doc, y, 6);
          doc.text(line, MARGIN, y);
          y += 5;
        }
        y += 5;
      });
    }
  }

  if (!isShareholder && !isWrittenConsent && data.benefits && (data.benefits ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.benefits ?? []).length * 18);
    y = section("Benefits");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the employee benefit plans of ${companyName} for the current plan year; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following benefit plans are hereby approved and adopted for the ensuing year:`,
      bt
    );

    (data.benefits ?? []).forEach((b, index) => {
      // Row 1: Benefit Type / Provider / Agent/Admin — blue header with grid borders on body
      autoTable(doc, {
        startY: y,
        head: [["Benefit Type", "Provider", "Agent / Admin"]],
        body: [[
          b.benefit_type || b.benefit_description || "--",
          b.provider || "--",
          b.agent_administrator || "--",
        ]],
        theme: "grid",
        headStyles: tableHeadStyles,
        bodyStyles: { fontSize: 10 },
        margin: { left: MARGIN, right: R_MARGIN },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 55 },
          2: { cellWidth: 'auto' },
        },
      });

      y = (doc as any).lastAutoTable.finalY;


      // Row 2: Plan Year / Contribution / Eligibility-Comments
      autoTable(doc, {
        startY: y,
        head: [["Plan Year", "Contribution", "Eligibility / Comments"]],
        body: [[
          b.plan_year?.toString() || "--",
          b.retirement_contribution != null ? fmt(b.retirement_contribution) : "--",
          b.eligibility_comments || "--",
        ]],
        theme: "grid",
        headStyles: {
          ...tableHeadStyles,
          fillColor: [255, 255, 255],
          textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
          fontStyle: "normal",
          fontSize: 9,
          lineColor: [191, 219, 254] as [number, number, number],
          lineWidth: 0.2,
        },
        bodyStyles: {
          fontSize: 10,
          lineColor: [191, 219, 254] as [number, number, number],
          lineWidth: 0.2,
        },
        margin: { left: MARGIN, right: R_MARGIN },
        tableLineColor: [191, 219, 254] as [number, number, number],
        tableLineWidth: 0.2,
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 35 },
          2: { cellWidth: 'auto' },
        },
      });

      y = (doc as any).lastAutoTable.finalY + (index < (data.benefits ?? []).length - 1 ? 5 : 10);
    });
  }

  // Agreements — skip for shareholder meetings and written consents
  if (!isShareholder && !isWrittenConsent && data.agreements && (data.agreements ?? []).length > 0) {
    const newOrUpdated = (data.agreements ?? []).filter((a: any) => !a.is_carried_forward);
    const carriedForward = (data.agreements ?? []).filter((a: any) => a.is_carried_forward && (a.status === "Active" || !a.status));

    y = checkPageBreak(doc, y, 30);
    y = section("Agreements");

    // New or updated agreements get full resolution language
    if (newOrUpdated.length > 0) {
      for (const a of newOrUpdated) {
        const amountStr = a.amount != null ? ` for $${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
        const dateStr = a.agreement_date ? ` on ${new Date(a.agreement_date + "T00:00:00").toLocaleDateString()}` : "";
        y = addWhereasResolved(doc, y,
          `WHEREAS, ${companyName} has entered into a ${a.agreement_type} with ${a.agreement_with || "the counterparty"}${dateStr}${amountStr}; and`,
          `NOW, THEREFORE, BE IT RESOLVED, that the ${a.agreement_type} entered into between ${companyName} and ${a.agreement_with || "the counterparty"}${dateStr}${amountStr} is hereby reviewed, ratified, and approved by the ${isLLC ? "members" : "Board of Directors"}.`,
          bt
        );
      }
    }

    // Carried-forward active agreements get a disclosure line
    if (carriedForward.length > 0) {
      y = checkPageBreak(doc, y, 20 + carriedForward.length * 6);
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const disclosureIntro = `The following agreements remain active and in good standing as of the date of this meeting:`;
      const disclosureLines = doc.splitTextToSize(disclosureIntro, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of disclosureLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5.5;
      }
      y += 3;
      for (const a of carriedForward) {
        y = checkPageBreak(doc, y, 6);
        const amountStr = a.amount != null ? ` — $${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "";
        const dateStr = a.agreement_date ? ` (${new Date(a.agreement_date + "T00:00:00").toLocaleDateString()})` : "";
        doc.text(`•  ${a.agreement_type} with ${a.agreement_with || "—"}${dateStr}${amountStr}`, MARGIN + 6, y);
        y += 5.5;
      }
      y += 6;
    }

    // Summary table of all agreements
    autoTable(doc, {
      startY: y,
      head: [["Type", "Counterparty", "Date", "Amount", "Status"]],
      body: (data.agreements ?? []).map((a: any) => [
        a.agreement_type,
        a.agreement_with || "—",
        a.agreement_date ? new Date(a.agreement_date + "T00:00:00").toLocaleDateString() : "—",
        a.amount != null ? `$${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
        a.status || "Active",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Other — skip for written consents
  if (!isWrittenConsent && data.other && (data.other ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.other ?? []).length * 7);
    y = section("Other Notes");
    autoTable(doc, {
      startY: y,
      head: [["Notes"]],
      body: (data.other ?? []).map(o => [o.notes]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Authorized Signers — skip for written consents
  if (!isWrittenConsent && data.authorizedSigners && (data.authorizedSigners ?? []).length > 0) {
    y = checkPageBreak(doc, y, 20 + (data.authorizedSigners ?? []).length * 7);
    y = section("Authorized Signers");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} have reviewed the authorized signers on the banking accounts of ${companyName}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby authorized as signers on the designated accounts:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Name", "Authority Type", "Bank"]],
      body: (data.authorizedSigners ?? []).map(s => [s.signer_name, s.title || "—", s.bank_name || "—"]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Registered Agent Confirmation (Annual Meeting blue theme)
  if (bt && !isShareholder && company?.registered_agent_name) {
    y = checkPageBreak(doc, y, 40);
    y = section("Registered Agent Confirmation");
    const agentAddr = [company.registered_agent_address, company.registered_agent_city, company.registered_agent_state, company.registered_agent_zip].filter(Boolean).join(", ");
    y = addWhereasResolved(doc, y,
      `WHEREAS, pursuant to Wis. Stat. § 183.0113, the company is required to maintain a registered agent in the State of ${company.state_of_incorporation || company.state || "Wisconsin"};`,
      `NOW, THEREFORE, BE IT RESOLVED, that ${company.registered_agent_name}${agentAddr ? `, located at ${agentAddr},` : ""} is hereby confirmed as the registered agent of the company.`,
      bt
    );
  }

  // General Authorization (Annual Meeting blue theme)
  if (bt && !isShareholder) {
    y = checkPageBreak(doc, y, 40);
    y = section("General Authorization");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} recognizes that actions may need to be taken to implement the resolutions adopted at this meeting;`,
      `NOW, THEREFORE, BE IT RESOLVED, that the officers of the company are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.`,
      bt
    );
  }

  // Tax Return Filing Acknowledgment (Annual Meeting)
  if (bt && !isShareholder && meeting?.tax_year) {
    y = checkPageBreak(doc, y, 30);
    const counselRec = (data.counsel && (data.counsel ?? []).length > 0) ? data.counsel[0] : null;
    const acctName = counselRec?.accountant_name?.trim() || "";
    const acctFirm = counselRec?.counsel_name?.trim() || "";
    const acctLabel = acctName && acctName.toLowerCase() !== "none appointed"
      ? `${acctName}${acctFirm ? ` of ${acctFirm}` : ""}`
      : `the ${isLLC ? "company's" : "corporation's"} accounting firm`;

    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const taxText = `The ${isLLC ? "company's" : "corporation's"} income tax return for year ended December 31, ${meeting.tax_year} was prepared by ${acctLabel} and was duly filed with the Internal Revenue Service. The annual filing form has been filed with the state of ${company?.state_of_incorporation || company?.state || "Wisconsin"} by the corporate registered agent.`;
    const taxLines = doc.splitTextToSize(taxText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of taxLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 6;
  }

  // Charitable Contributions (Annual Meeting)
  if (bt && !isShareholder && meeting?.charitable_contribution_amount != null && Number(meeting.charitable_contribution_amount) > 0) {
    y = checkPageBreak(doc, y, 30);
    const contribAmt = fmt(meeting.charitable_contribution_amount);
    const contribOrg = meeting.charitable_contribution_org?.trim() || "a recognized charitable organization";
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "company" : "corporation"} is committed to supporting community initiatives and charitable causes that align with its values and mission;`,
      `NOW, THEREFORE, BE IT RESOLVED, that the ${isLLC ? "company" : "corporation"} approved the contribution of ${contribAmt} to ${contribOrg} as allowed by IRS Code Section 170(c)(2), payment of which is made during this taxable year.`,
      bt
    );
  }

  // Other Business / Vehicle Policy / Profit Improvement Plan (last section before adjournment)
  const hasOtherBiz = meeting.other_business?.trim();
  const hasProfitPlan = meeting.profit_improvement_plan?.trim();
  if (!isShareholder && !isWrittenConsent && (hasOtherBiz || hasProfitPlan)) {
    y += 3;
    y = checkPageBreak(doc, y, 30);
    y = section("Other Business");
    doc.setFontSize(11);
    doc.setFont("Arial", "normal");
    doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
    const otherIntro = `The chairperson then reported on other business of the ${isLLC ? "company" : "corporation"} as follows:`;
    const otherIntroLines = doc.splitTextToSize(otherIntro, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of otherIntroLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 3;

    if (hasOtherBiz) {
      doc.setFont("Arial", "bold");
      doc.text("Other:", MARGIN, y);
      doc.setFont("Arial", "normal");
      y += 5;
      const otherLines = doc.splitTextToSize(meeting.other_business.trim(), doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of otherLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 3;
    }

    if (hasProfitPlan) {
      doc.setFont("Arial", "bold");
      doc.text("Profit Improvement Plan:", MARGIN, y);
      doc.setFont("Arial", "normal");
      y += 5;
      const pipLines = doc.splitTextToSize(meeting.profit_improvement_plan.trim(), doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of pipLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 3;
    }
    y += 5;
  }

  // Shareholder Tax Basis disclaimer (S-election entities only: S-Corp or LLC-S)
  {
    const et = (entityType || "").toLowerCase();
    const isSElection = et.includes("s-corp") || et.includes("llc-s");
    if (isSElection && !isWrittenConsent && (isAnnual || isShareholder)) {
      y += 3;
      y = checkPageBreak(doc, y, 30);
      y = section("Shareholder Tax Basis");
      doc.setFontSize(11);
      doc.setFont("Arial", "normal");
      doc.setTextColor(BODY_COLOR[0], BODY_COLOR[1], BODY_COLOR[2]);
      const basisText = "Shareholders are responsible for maintaining their own adjusted tax basis in S-corporation stock. The corporation maintains records of contributions, distributions, and equity transactions, but does not calculate or track shareholder basis.";
      const basisLines = doc.splitTextToSize(basisText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of basisLines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 5;
    }
  }

  // Signature block — estimate height needed based on type
  const sigBlockHeight = isWrittenConsent ? 60 : 35;
  y = checkPageBreak(doc, y, sigBlockHeight);
  y += 6;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);

  doc.setFontSize(11);
  doc.setFont("Arial", "normal");
  doc.setTextColor(80, 80, 80);

  if (isWrittenConsent) {
    // Determine consent body from meeting (defaults: LLC → members, else → board)
    const rawBody = (meeting?.consent_body || "").toString().toLowerCase();
    const consentBody: "board" | "shareholders" | "members" =
      rawBody === "shareholders" ? "shareholders"
        : rawBody === "members" ? "members"
        : rawBody === "board" ? "board"
        : (isLLC ? "members" : "board");

    const signerRoleLabel =
      consentBody === "shareholders" ? "Shareholder"
        : consentBody === "members" ? "Member"
        : "Director";

    // Collect signers from the appropriate source
    type SignerRow = { name: string; shares?: number; ownership?: number };
    const wcSigners: SignerRow[] = [];
    const wcSeen = new Set<string>();
    const wcAddUnique = (row: SignerRow) => {
      const n = row.name.trim();
      if (!n) return;
      const key = n.toLowerCase().replace(/\s+/g, " ").trim();
      if (wcSeen.has(key)) return;
      wcSeen.add(key);
      wcSigners.push({ ...row, name: n });
    };

    if (consentBody === "board") {
      (data.directors || []).forEach(d => { if (d.director_name) wcAddUnique({ name: d.director_name }); });
    } else {
      // shareholders or members — both source from data.shareholders
      (data.shareholders || []).forEach(s => {
        if (!s.shareholder_name) return;
        wcAddUnique({
          name: s.shareholder_name,
          shares: Number(s.common_shares ?? 0) || 0,
          ownership: Number(s.preferred_shares ?? 0) || 0,
        });
      });
    }
    // Fallback: officers if nothing else
    if (wcSigners.length === 0) {
      (data.officers || []).forEach(o => { if (o.name) wcAddUnique({ name: o.name }); });
    }

    // Date line
    if (meeting?.meeting_date) {
      const mtgDate = new Date(meeting.meeting_date + "T12:00:00");
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dateStr = `${days[mtgDate.getDay()]}, ${months[mtgDate.getMonth()]} ${mtgDate.getDate()}, ${mtgDate.getFullYear()}`;
      doc.text(`DATED: ${dateStr}`, MARGIN, y);
      y += 10;
    } else {
      y += 4;
    }

    // Signature rows — one line per signer, with body-specific columns
    doc.setFontSize(10);
    wcSigners.forEach(s => {
      y = checkPageBreak(doc, y, 16);
      doc.setDrawColor(30, 30, 30);
      doc.setLineWidth(0.3);
      // Signature line
      doc.line(MARGIN, y, MARGIN + 90, y);
      y += 4;
      let label = `${s.name}, ${signerRoleLabel}`;
      if (consentBody === "shareholders" && s.shares != null) {
        label += `  —  Shares Held: ${s.shares.toLocaleString()}`;
      } else if (consentBody === "members") {
        if (s.shares && s.shares > 0) label += `  —  Units: ${s.shares.toLocaleString()}`;
        if (s.ownership && s.ownership > 0) label += `  —  Ownership: ${Number(s.ownership).toFixed(2)}%`;
      }
      doc.text(label, MARGIN, y);
      y += 10;

    });

    // If no signers, render blank line
    if (wcSigners.length === 0) {
      const pw = doc.internal.pageSize.getWidth();
      const sigLineW = (pw - MARGIN - R_MARGIN - 20) / 2;
      doc.line(MARGIN, y, MARGIN + sigLineW, y);
      doc.text(signerRoleLabel, MARGIN, y + 5);
      const rightX = MARGIN + sigLineW + 20;
      doc.line(rightX, y, rightX + sigLineW, y);
      doc.text("Date", rightX, y + 5);
    }
  } else {
    // Regular meetings: adjournment + Chairperson/Secretary signatures
    doc.text("There being no further business, the meeting was adjourned.", MARGIN, y);
    y += 4;

    // Meeting date
    if (bt && meeting?.meeting_date) {
      const mtgDate = new Date(meeting.meeting_date + "T12:00:00");
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dateStr = `${days[mtgDate.getDay()]}, ${months[mtgDate.getMonth()]} ${mtgDate.getDate()}, ${mtgDate.getFullYear()}`;
      doc.text(`Dated: ${dateStr}`, MARGIN, y + 6);
      y += 10;
    }
    y += 8;

    const pw = doc.internal.pageSize.getWidth();
    const sigLineW = (pw - MARGIN - R_MARGIN - 20) / 2;
    const chairName = meeting?.chairperson?.trim() || "";
    const secName = meeting?.mtg_secretary?.trim() || "";

    doc.setFontSize(10);
    // Left signature
    doc.line(MARGIN, y, MARGIN + sigLineW, y);
    doc.text(chairName ? `${chairName}, Meeting Chairperson` : "Chairperson", MARGIN, y + 5);

    // Right signature
    const rightX = MARGIN + sigLineW + 20;
    doc.line(rightX, y, rightX + sigLineW, y);
    doc.text(secName ? `${secName}, Meeting Secretary` : "Secretary", rightX, y + 5);
  }

  // Footer
  if (bt) {
    const docLabel = isShareholder ? "Meeting of Shareholders Minutes" : "Annual Meeting Minutes";
    addAnnualMeetingFooter(doc, companyName, docLabel);
  } else {
    addDFIFooter(doc, companyName);
  }
  return doc;
  } catch (err) {
    console.error("exportMeetingMinutesPDF error:", err);
    return doc;
  }
}

// Export individual section PDFs
export function exportSectionPDF(
  sectionTitle: string,
  company: any,
  meeting: any,
  tableHead: string[],
  tableBody: string[][],
) {
  const doc = new jsPDF();
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const companyName = company?.name || "Unknown";
  const entityType = company?.entity_type || "Corporation";
  const meetingDate = new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString();

  addDFIHeader(doc, sectionTitle, companyName, entityType);

  let y = 55;
  y = addLabelValue(doc, y, "Meeting Date", meetingDate);
  y = addLabelValue(doc, y, "Meeting Type", meeting.meeting_type);
  if (meeting.tax_year) y = addLabelValue(doc, y, "Tax Year", String(meeting.tax_year));
  y += 3;

  if (tableBody.length > 0) {
    const usableWidth = doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN;
    const colCount = tableHead.length;
    // For shareholders table (10 columns), use specific proportional widths
    const isShareholdersTable = colCount === 10 && (
      tableHead.includes("Ownership %") || tableHead.includes("Interest %")
    );
    const columnStyles: Record<number, any> = {};
    if (isShareholdersTable) {
      // Name 15%, Address 18%, City 8%, St 5%, ZIP 7%, Common 8%, Own% 8%, Dist 11%, Basis 10%, Add'l 10%
      const pcts = [0.15, 0.18, 0.08, 0.05, 0.07, 0.08, 0.08, 0.11, 0.10, 0.10];
      pcts.forEach((p, i) => { columnStyles[i] = { cellWidth: usableWidth * p }; });
    }
    autoTable(doc, {
      startY: y,
      head: [tableHead],
      body: tableBody,
      theme: "grid",
      headStyles: {
        fillColor: [200, 215, 235],
        textColor: [30, 30, 30],
        fontSize: isShareholdersTable ? 8 : 10,
        fontStyle: "bold",
        cellPadding: isShareholdersTable ? 3 : 5,
      },
      bodyStyles: {
        fontSize: isShareholdersTable ? 9 : 10,
        cellPadding: isShareholdersTable ? 3 : 5,
      },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
      ...(isShareholdersTable ? { columnStyles } : {}),
    });
  } else {
    doc.setFontSize(9);
    doc.setFont("Arial", "italic");
    doc.setTextColor(130, 130, 130);
    doc.text("No records to display.", MARGIN, y + 6);
  }

  addDFIFooter(doc, companyName);
  return doc;
}

export function exportAmendmentsPDF(company: any, meeting: any, amendments: any[]) {
  return exportSectionPDF(
    "Amendments",
    company,
    meeting,
    ["Amendment Type", "Details"],
    amendments.map(a => [a.amendment_type || "—", a.amendment_text || "—"]),
  );
}

export function exportResolutionsPDF(company: any, meeting: any, resolutions: any[]) {
  return exportSectionPDF(
    "Resolutions",
    company,
    meeting,
    ["Purpose", "Resolution Text"],
    resolutions.map(r => [r.purpose, r.resolution_text]),
  );
}

export function exportFinancialsPDF(company: any, meeting: any, financials: any, nonRecurringItems?: any[]) {
  const doc = new jsPDF();
  registerArialFont(doc);
  doc.setLineHeightFactor(1.15);
  const companyName = company?.name || "Unknown";
  const entityType = company?.entity_type || "Corporation";
  const meetingDate = new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString();

  addDFIHeader(doc, "Financial Comparison", companyName, entityType);

  let y = 55;
  y = addLabelValue(doc, y, "Meeting Date", meetingDate);
  if (meeting.tax_year) y = addLabelValue(doc, y, "Tax Year", String(meeting.tax_year));
  y += 3;

  if (financials) {
    // YoY helper
    const yoy = (cur: any, prev: any): string => {
      if (cur == null || prev == null || prev === 0) return "";
      const pct = ((Number(cur) - Number(prev)) / Math.abs(Number(prev))) * 100;
      return `${pct >= 0 ? "" : "-"}${Math.abs(pct).toFixed(1)}%`;
    };

    const nrItems = (nonRecurringItems || []).filter((item: any) => item.description || item.amount);
    const totalNr = nrItems.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    const adjCurrentNetIncome = totalNr !== 0 ? (Number(financials.current_net_income) || 0) - totalNr : null;
    const adjPreviousNetIncome = totalNr !== 0 ? (Number(financials.previous_net_income) || 0) : null;

    const tableBody: any[][] = [
      ["Total Sales", fmt(financials.current_total_sales), fmt(financials.previous_total_sales), yoy(financials.current_total_sales, financials.previous_total_sales)],
      ["Cost of Goods", fmt(financials.current_cog), fmt(financials.previous_cog), yoy(financials.current_cog, financials.previous_cog)],
      ["Gross Profit", fmt(financials.current_gross_profit), fmt(financials.previous_gross_profit), yoy(financials.current_gross_profit, financials.previous_gross_profit)],
      ["COG Ratio (%)", financials.current_cog_ratio != null ? `${Number(financials.current_cog_ratio).toFixed(2)}%` : "—", financials.previous_cog_ratio != null ? `${Number(financials.previous_cog_ratio).toFixed(2)}%` : "—", yoy(financials.current_cog_ratio, financials.previous_cog_ratio)],
      ["Net Income", fmt(financials.current_net_income), fmt(financials.previous_net_income), yoy(financials.current_net_income, financials.previous_net_income)],
    ];

    if (totalNr !== 0) {
      nrItems.forEach((item: any) => {
        tableBody.push([`  Non-Recurring: ${item.description || ""}`, fmt(item.amount), "—", "—"]);
      });
      tableBody.push([
        "Adjusted Net Income",
        fmt(adjCurrentNetIncome),
        fmt(adjPreviousNetIncome),
        adjPreviousNetIncome && adjPreviousNetIncome !== 0 && adjCurrentNetIncome != null
          ? yoy(adjCurrentNetIncome, adjPreviousNetIncome)
          : "—",
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["", "Current Year", "Previous Year", "YoY Change"]],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [200, 215, 235], textColor: [30, 30, 30], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "center", fontSize: 9 } },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Footnote for non-recurring items
    if (nrItems.length > 0) {
      doc.setFontSize(8);
      doc.setFont("Arial", "italic");
      doc.setTextColor(100, 100, 100);
      nrItems.forEach((item: any) => {
        const noteText = `Note: Current year Net Income includes a one-time ${Number(item.amount) >= 0 ? "gain" : "loss"} of ${fmt(Math.abs(Number(item.amount)))} from ${item.description || "non-recurring transaction"}.`;
        const lines = doc.splitTextToSize(noteText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
        y = checkPageBreak(doc, y, lines.length * 4 + 4);
        doc.text(lines, MARGIN, y);
        y += lines.length * 4 + 2;
      });
      doc.setTextColor(40, 40, 40);
      y += 3;
    }

    // Draw simple bar chart comparison
    const pw = doc.internal.pageSize.getWidth();
    y = checkPageBreak(doc, y, 90);
    y = addSectionTitle(doc, y, "Visual Comparison");

    const chartItems = [
      { label: "Total Sales", cur: Number(financials.current_total_sales) || 0, prev: Number(financials.previous_total_sales) || 0 },
      { label: "Gross Profit", cur: Number(financials.current_gross_profit) || 0, prev: Number(financials.previous_gross_profit) || 0 },
      { label: "COG", cur: Number(financials.current_cog) || 0, prev: Number(financials.previous_cog) || 0 },
      { label: "Net Income", cur: Number(financials.current_net_income) || 0, prev: Number(financials.previous_net_income) || 0 },
    ];

    const maxVal = Math.max(...chartItems.map(i => Math.max(Math.abs(i.cur), Math.abs(i.prev))), 1);
    const barMaxWidth = pw - 80;
    const barHeight = 6;
    const groupHeight = 22;

    // Legend
    doc.setFillColor(45, 55, 120);
    doc.rect(14, y, 8, 4, "F");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text("Current Year", 24, y + 3);
    doc.setFillColor(160, 160, 180);
    doc.rect(60, y, 8, 4, "F");
    doc.text("Previous Year", 70, y + 3);
    y += 10;

    chartItems.forEach((item) => {
      doc.setFontSize(8);
      doc.setFont("Arial", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(item.label, MARGIN, y + 3);

      const curWidth = maxVal > 0 ? (Math.abs(item.cur) / maxVal) * barMaxWidth : 0;
      const prevWidth = maxVal > 0 ? (Math.abs(item.prev) / maxVal) * barMaxWidth : 0;

      doc.setFillColor(45, 55, 120);
      doc.roundedRect(50, y - 2, Math.max(curWidth, 1), barHeight, 1, 1, "F");

      doc.setFillColor(160, 160, 180);
      doc.roundedRect(50, y + barHeight, Math.max(prevWidth, 1), barHeight, 1, 1, "F");

      // Values
      doc.setFontSize(6);
      doc.setTextColor(30, 30, 30);
      if (item.cur > 0) doc.text(fmt(item.cur), 50 + curWidth + 2, y + 3);
      if (item.prev > 0) doc.text(fmt(item.prev), 50 + prevWidth + 2, y + barHeight + 5);

      y += groupHeight;
    });
  }

  addDFIFooter(doc, companyName);
  return doc;
}

function fmt(val: any): string {
  if (val == null) return "--";
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Save and download
export async function downloadPDF(doc: jsPDF, fileName: string) {
  await savePdfReliably(doc, fileName);
}

// Get PDF as blob URL for preview
export function getPDFPreviewUrl(doc: jsPDF): string {
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
