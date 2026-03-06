import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Wisconsin DFI-style document formatting
const DFI_HEADER = "STATE OF WISCONSIN";
const DFI_SUB = "DEPARTMENT OF FINANCIAL INSTITUTIONS";
const MARGIN = 25.4; // 1 inch for binder compatibility
const R_MARGIN = 25.4; // 1 inch right margin — matches left for readability

// Blue theme colors for Annual Meeting
const BLUE = { r: 31, g: 78, b: 121 }; // #1F4E79
const LIGHT_BLUE_BG: [number, number, number] = [214, 228, 240]; // #D6E4F0
const BODY_COLOR: [number, number, number] = [40, 40, 40];
const WHEREAS_RESOLVED_INDENT = 14;

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
  authorizedSigners?: any[];
  vehiclePurchases?: any[];
  vehicleLeases?: any[];
  vehicleSales?: any[];
  leaseTerminations?: any[];
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
}

function addDFIHeader(doc: jsPDF, title: string, companyName: string, entityType: string, meeting?: any, company?: any) {
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  const displayName = meeting?.company_name_at_meeting || companyName;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(displayName, cx, 22, { align: "center" });

  const addrLine = meeting?.company_address_at_meeting || company?.address || "";
  let hy = 29;
  if (addrLine) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(addrLine, cx, hy, { align: "center" });
    hy += 6;
  }

  const cityPart = meeting?.company_city_at_meeting || company?.city || "";
  const statePart = meeting?.company_state_at_meeting || company?.state || "";
  const zipPart = meeting?.company_zip_at_meeting || company?.zip || "";
  const cityStateLine = [cityPart, statePart].filter(Boolean).join(", ") + (zipPart ? `  ${zipPart}` : "");
  if (cityStateLine.trim()) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(cityStateLine, cx, hy, { align: "center" });
    hy += 6;
  }

  hy += 2;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, hy, pw - R_MARGIN, hy);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, hy + 1.5, pw - R_MARGIN, hy + 1.5);
}

function addMeetingTypeHeader(doc: jsPDF, y: number, meetingType: string, companyName: string, meetingDate: string, isWrittenConsent: boolean, meeting?: any, company?: any, meetingData?: MeetingData): number {
  const pw = doc.internal.pageSize.getWidth();
  const cx = pw / 2;

  if (isWrittenConsent) {
    // Written Consent Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("WRITTEN CONSENT", cx, y, { align: "center" });
    y += 7;
    doc.setFontSize(12);
    doc.text("IN LIEU OF A MEETING", cx, y, { align: "center" });
    y += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`OF THE BOARD OF DIRECTORS / MEMBERS OF`, cx, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(companyName.toUpperCase(), cx, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`Date: ${meetingDate}`, cx, y, { align: "center" });
    y += 6;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pw - R_MARGIN, y);
    y += 8;
    // Intro paragraph
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const introText = `The undersigned, being all of the directors/members of ${companyName}, do hereby consent to and adopt the following resolutions and actions without a formal meeting, pursuant to the applicable provisions of the Wisconsin Statutes:`;
    const lines = doc.splitTextToSize(introText, pw - MARGIN - R_MARGIN);
    doc.text(lines, MARGIN, y);
    y += lines.length * 5 + 6;
  } else {
    // Standard Meeting Type Header
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`MINUTES OF ${meetingType.toUpperCase()}`, cx, y, { align: "center" });
    y += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(`${companyName} — ${meetingDate}`, cx, y, { align: "center" });
    y += 5;
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pw - R_MARGIN, y);
    y += 8;
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
    const cityAtMeeting = meeting.company_city_at_meeting || company.city || "";
    const stateAtMeeting = meeting.company_state_at_meeting || company.state || "";
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
      const locLower = location.toLowerCase();
      const cityAlreadyInLoc = cityAtMeeting && locLower.includes(cityAtMeeting.toLowerCase());
      const stateAlreadyInLoc = stateAtMeeting && locLower.includes(stateAtMeeting.toLowerCase());
      const extras = [
        !cityAlreadyInLoc ? cityAtMeeting : "",
        !stateAlreadyInLoc ? stateAtMeeting : "",
      ].filter(Boolean);
      if (extras.length > 0) {
        locationPart += `, ${extras.join(", ")}`;
      }
    }

    let datePart = ` on ${dateStr}`;
    if (timeStr) datePart += ` at ${timeStr}`;

    const introText = `The ${meetingLabel} meeting of ${companyName}, ${entityLabel} duly formed in the state of ${stateOfInc}${locationPart}${datePart}. There were present and participating at the meeting:`;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const introLines = doc.splitTextToSize(introText, pw - MARGIN - R_MARGIN);
    doc.text(introLines, MARGIN, y);
    y += introLines.length * 5 + 6;

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
        doc.setFont("helvetica", "normal");
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
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pw - R_MARGIN, ph - 10, { align: "right" });
  }
}

function addAnnualMeetingFooter(doc: jsPDF, companyName: string) {
  const pageCount = doc.getNumberOfPages();
  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();

    doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, ph - 20, pw - R_MARGIN, ph - 20);

    doc.setFontSize(8);
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text(`${companyName} — Annual Meeting Minutes — Generated: ${generatedDate}`, pw / 2, ph - 14, { align: "center" });
    doc.setTextColor(130, 130, 130);
    doc.text(`Page ${i} of ${pageCount}`, pw - R_MARGIN, ph - 14, { align: "right" });
  }
}


function addSectionTitle(doc: jsPDF, y: number, title: string, blueTheme: boolean = false, sectionNum?: number): number {
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
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
  return y + 8;
}

function addLabelValue(doc: jsPDF, y: number, label: string, value: string, x = MARGIN): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text(`${label}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  doc.text(value || "—", x + doc.getTextWidth(`${label}: `) + 2, y);
  return y + 6;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 35) {
    doc.addPage();
    return 25;
  }
  return y;
}

function addResolutionBlock(doc: jsPDF, y: number, purpose: string, text: string): number {
  const pw = doc.internal.pageSize.getWidth();
  y = checkPageBreak(doc, y, 35);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(purpose, MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, pw - MARGIN - R_MARGIN);
  for (const line of lines) {
    y = checkPageBreak(doc, y, 6);
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 5;
  return y;
}

function addSubHeading(doc: jsPDF, y: number, text: string): number {
  y = checkPageBreak(doc, y, 20);
  y += 4;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text(text, MARGIN, y);
  y += 3;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, doc.internal.pageSize.getWidth() - R_MARGIN, y);
  return y + 8;
}

function addWhereasResolved(doc: jsPDF, y: number, whereas: string, resolved: string, blueTheme: boolean = false): number {
  const pw = doc.internal.pageSize.getWidth();

  if (blueTheme) {
    // WHEREAS: indented, bold italic prefix, italic body
    const indent = WHEREAS_RESOLVED_INDENT;
    const whereasPrefix = "WHEREAS, ";
    doc.setFontSize(11);
    doc.setTextColor(...BODY_COLOR);
    // Strip leading "WHEREAS, " if present in the text
    let whereasBody = whereas;
    if (whereasBody.toUpperCase().startsWith("WHEREAS,")) {
      whereasBody = whereasBody.substring(whereasBody.indexOf(",") + 1).trim();
    }
    const fullWhereas = whereasPrefix + whereasBody;
    const wLines = doc.splitTextToSize(fullWhereas, pw - MARGIN - R_MARGIN - indent);
    y = checkPageBreak(doc, y, wLines.length * 5.5 + 6);

    for (let i = 0; i < wLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("helvetica", "bolditalic");
        const prefixWidth = doc.getTextWidth(whereasPrefix);
        doc.text(whereasPrefix, MARGIN + indent, y);
        doc.setFont("helvetica", "italic");
        const remainder = wLines[0].substring(whereasPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
      } else {
        doc.setFont("helvetica", "italic");
        doc.text(wLines[i], MARGIN + indent, y);
      }
      y += 5.5;
    }
    y += 3;

    // RESOLVED: indented, bold prefix, normal body
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
    const rLines = doc.splitTextToSize(fullResolved, pw - MARGIN - R_MARGIN - indent);
    y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);

    for (let i = 0; i < rLines.length; i++) {
      y = checkPageBreak(doc, y, 6);
      if (i === 0) {
        doc.setFont("helvetica", "bold");
        const prefixWidth = doc.getTextWidth(resolvedPrefix);
        doc.text(resolvedPrefix, MARGIN + indent, y);
        doc.setFont("helvetica", "normal");
        const remainder = rLines[0].substring(resolvedPrefix.length);
        if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
      } else {
        doc.setFont("helvetica", "normal");
        doc.text(rLines[i], MARGIN + indent, y);
      }
      y += 5.5;
    }
    y += 5;
  } else {
    // Original gray theme
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const whereasLines = doc.splitTextToSize(whereas, pw - MARGIN - R_MARGIN);
    for (const line of whereasLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 3;
    y = checkPageBreak(doc, y, 20);
    const resolvedLines = doc.splitTextToSize(resolved, pw - MARGIN - R_MARGIN);
    for (const line of resolvedLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5;
    }
    y += 5;
  }
  return y;
}

function addOrganizationalBoilerplate(doc: jsPDF, y: number, data: MeetingData): number {
  const { company, meeting } = data;
  const entityType = company?.entity_type || "Corporation";
  const isLLC = entityType === "LLC";
  const isNonprofit = entityType === "Non-Profit";
  const isSCorp = entityType === "S-Corp";
  const entityLabel = isLLC ? "limited liability company" : isNonprofit ? "nonprofit corporation" : "corporation";
  const governingBody = isLLC ? "members/authorized binders" : "Board of Directors";
  const companyName = company?.name || "the Company";
  const stateOfInc = company?.state_of_incorporation || "Wisconsin";
  const pw = doc.internal.pageSize.getWidth();

  const hasOfficerData = (data.officers && data.officers.length > 0);
  const hasShareholderData = (data.shareholders && data.shareholders.length > 0);
  const hasDirectorData = (data.directors && data.directors.length > 0);

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
      `RESOLVED, that ${company.registered_agent_name}${agentAddr ? `, located at ${agentAddr},` : ""} is hereby confirmed as the registered agent of the ${entityLabel} in the State of ${stateOfInc}, and the proper ${isLLC ? "authorized binders" : "officers"} are authorized to execute any documents necessary to maintain the registered agent designation.`);
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
      headStyles: { fillColor: [45, 55, 72], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
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

  // 6. Members / Shareholders
  const shareholderSource = hasShareholderData
    ? data.shareholders!.map((s: any) => ({ name: s.shareholder_name, shares: s.common_shares }))
    : (data.companyShareholders || []).map((s: any) => ({ name: s.name, shares: null }));

  if (shareholderSource.length > 0) {
    y = checkPageBreak(doc, y, 30 + shareholderSource.length * 7);
    const memberLabel = isLLC ? "Members" : "Shareholders";
    y = addSectionTitle(doc, y, `Initial ${memberLabel}`);
    if (isLLC) {
      y = addResolutionBlock(doc, y, "Recognition of Initial Members",
        `RESOLVED, that the following persons are hereby recognized as the initial members of the ${entityLabel}, having made their respective capital contributions as set forth in the Operating Agreement:\n\n${shareholderSource.map((s: any) => s.name).join("; ")}.`);
    } else {
      y = addResolutionBlock(doc, y, "Authorization of Stock Issuance",
        `RESOLVED, that the ${entityLabel} is authorized to issue shares of stock to the following initial shareholders:\n\n${shareholderSource.map((s: any) => s.name + (s.shares ? ` (${s.shares.toLocaleString()} shares)` : "")).join("; ")}.`);
    }
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
      const bankSigners = signerSource.filter((s: any) => s.bank_id === bank.id);
      const signerNames = bankSigners.map((s: any) => `${s.signer_name}${s.title ? `, ${s.title}` : ""}`).join("; ");
      y = addResolutionBlock(doc, y, `Authorize Account — ${bank.bank_name}`,
        `RESOLVED, that the ${entityLabel} is hereby authorized to open and maintain a ${bank.account_type || "checking"} account at ${bank.bank_name}${bank.city ? `, ${bank.city}` : ""}${bank.state ? `, ${bank.state}` : ""}${signerNames ? `, and that the following persons are hereby authorized as signatories on said account: ${signerNames}` : ""}.`);
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
      `RESOLVED, that the ${entityLabel} hereby elects to be treated as an S Corporation under Subchapter S of the Internal Revenue Code, effective ${sDate}, and the proper ${isLLC ? "authorized binders" : "officers"} are authorized and directed to prepare and file IRS Form 2553 and any corresponding state forms, with all ${isLLC ? "members" : "shareholders"} consenting to such election.`);
  }

  // 10. Business Purpose
  if (company?.business_purpose) {
    y = checkPageBreak(doc, y, 30);
    y = addSectionTitle(doc, y, "Business Purpose");
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
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
    `RESOLVED, that the ${isLLC ? "authorized binders" : "officers"} of the ${entityLabel} are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.`);

  return y;
}

export function exportMeetingMinutesPDF(data: MeetingData) {
  const doc = new jsPDF();
  const { meeting, company } = data;
  const companyName = company?.name || "Unknown Company";
  const entityType = company?.entity_type || "Corporation";
  const meetingDate = new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString();
  const isWrittenConsent = meeting.meeting_type === "Written Consent";
  const isLLC = entityType?.toLowerCase().includes("llc") || entityType?.toLowerCase().includes("limited liability");
  const isAnnual = (meeting.meeting_type || "").toLowerCase().includes("annual");
  const bt = isAnnual; // blue theme flag
  let sectionNum = 0;

  // Helper to get table head styles based on theme
  const tableHeadStyles = bt
    ? { fillColor: LIGHT_BLUE_BG as [number, number, number], textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number], fontStyle: "bold" as const, fontSize: 10 }
    : { fillColor: [45, 55, 72] as [number, number, number], fontSize: 10, fontStyle: "bold" as const };

  // Helper for numbered section titles in blue theme
  const section = (title: string) => {
    sectionNum++;
    return addSectionTitle(doc, y, title, bt, bt ? sectionNum : undefined);
  };

  addDFIHeader(doc, isWrittenConsent ? "Written Consent" : `${meeting.meeting_type} — Minutes`, companyName, entityType, meeting, company);

  let y = 45;

  // For Annual Meeting blue theme: use a cleaner title block
  if (bt) {
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
    doc.text("MINUTES OF THE ANNUAL MEETING", pw / 2, y, { align: "center" });
    y += 10;
  } else {
    // Meeting Type Header
    y = addMeetingTypeHeader(doc, y, meeting.meeting_type, companyName, meetingDate, isWrittenConsent, meeting, company, data);
  }

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
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BODY_COLOR);
    const introText = `The Annual Meeting of ${companyName}, a ${stateOfInc} ${entityLabel}, was held on ${dateStr}${meeting.meeting_time ? `, at ${meeting.meeting_time}` : ""}${meeting.meeting_location ? `, at ${meeting.meeting_location}` : ""}.`;
    const introLines = doc.splitTextToSize(introText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of introLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 3;

    const chairText = `${meeting.chairperson || "[Chairperson]"} served as Chairperson and ${meeting.mtg_secretary || "[Secretary]"} served as Secretary of the meeting.`;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const chairLines = doc.splitTextToSize(chairText, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
    for (const line of chairLines) {
      y = checkPageBreak(doc, y, 6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 3;

    // Attendees list
    const attendees = new Set<string>();
    (data.shareholders || []).forEach(s => { if (s.shareholder_name) attendees.add(s.shareholder_name); });
    (data.directors || []).forEach(d => { if (d.director_name) attendees.add(d.director_name); });
    (data.officers || []).forEach(o => { if (o.name) attendees.add(o.name); });
    if (attendees.size > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BODY_COLOR);
      doc.text("The following were present at the meeting:", MARGIN, y);
      y += 5.5;
      attendees.forEach(name => {
        y = checkPageBreak(doc, y, 6);
        doc.text(`•  ${name}`, MARGIN + 6, y);
        y += 5.5;
      });
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

  // Section 1244 Stock Plan - include in Organizational Meeting if checked (Corp only, not applicable to LLCs)
  if (meeting.meeting_type === "Organizational Meeting" && company?.election_1244 && !isLLC) {
    y += 3;
    y = checkPageBreak(doc, y, 60);
    y = addSectionTitle(doc, y, "Section 1244 Stock Plan");
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
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
    y = section("Call to Order & Approval of Prior Meeting Minutes");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} and ${isLLC ? "members" : "shareholders"} of ${companyName} have taken various actions and made certain decisions during the prior fiscal year in the ordinary course of business; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that all acts and decisions of the ${isLLC ? "members/authorized binders" : "directors"} and ${isLLC ? "members" : "officers"} of ${companyName} taken or made since the last annual meeting are hereby ratified, confirmed, and approved in all respects.`,
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

  // Directors
  if (data.directors && data.directors.length > 0) {
    y += 3;
    y = checkPageBreak(doc, y, 30 + data.directors.length * 7);
    y = section(isLLC ? "Authorized Binders Present" : "Directors Present");
    if (mType.includes("annual") || mType.includes("shareholder")) {
      y = addWhereasResolved(doc, y,
        `WHEREAS, the terms of the current ${isLLC ? "authorized binders" : "directors"} expire at this meeting, and the ${isLLC ? "members" : "shareholders"} are called upon to ${isLLC ? "appoint" : "elect"} the ${isLLC ? "authorized binders" : "Board of Directors"} for the ensuing year; and`,
        `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby ${isLLC ? "appointed" : "re-elected"} as ${isLLC ? "authorized binders" : "directors"} of ${companyName}, to serve until the next annual meeting and until their successors are duly ${isLLC ? "appointed" : "elected"} and qualified:`,
        bt
      );
    }
    autoTable(doc, {
      startY: y,
      head: [[isLLC ? "Authorized Binder Name" : "Director Name"]],
      body: data.directors.map(d => [d.director_name]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Officers (with salary/bonus)
  if (data.officers && data.officers.length > 0) {
    y = checkPageBreak(doc, y, 30 + data.officers.length * 7);
    y = section("Officers");
    const isSCorp = entityType === "S-Corp";
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the current ${isLLC ? "management" : "officer"} positions and compensation of ${companyName}${isSCorp ? ", and recognizing the requirement under IRC § 1366 that officer-shareholders receive reasonable compensation" : ""}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby ${isLLC ? "appointed" : "re-elected"} as ${isLLC ? "managers/officers" : "officers"} of ${companyName}, at the compensation levels set forth below, to serve until their successors are duly ${isLLC ? "appointed" : "elected"} and qualified:`,
      bt
    );
    const hasSalaryData = data.officers.some(o => o.salary != null || o.bonus != null);
    autoTable(doc, {
      startY: y,
      head: [hasSalaryData ? ["Title", "Name", "Salary", "Bonus"] : ["Title", "Name"]],
      body: data.officers.map(o => hasSalaryData
        ? [o.title, o.name, o.salary != null ? fmt(o.salary) : "—", o.bonus != null ? fmt(o.bonus) : "—"]
        : [o.title, o.name]
      ),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Shareholders
  if (data.shareholders && data.shareholders.length > 0) {
    y = checkPageBreak(doc, y, 30 + data.shareholders.length * 7);
    const memberLabel = isLLC ? "Members" : "Shareholders";
    y = section(memberLabel);
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "shareholders"} of ${companyName} hold ownership interests as set forth below; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following ${isLLC ? "membership interests" : "share ownership"} is hereby acknowledged and confirmed:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Name", "Common Shares", "Preferred Shares", "Distribution"]],
      body: data.shareholders.map(s => [
        s.shareholder_name,
        s.common_shares?.toLocaleString() ?? "—",
        s.preferred_shares?.toLocaleString() ?? "—",
        s.distribution || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Financials
  if (data.financials) {
    const f = data.financials;
    y = checkPageBreak(doc, y, 80);
    y = section("Financial Comparison — Year to Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the financial statements of ${companyName} for the current and prior fiscal years; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the financial statements as presented are hereby accepted and approved:`,
      bt
    );

    const yoy = (cur: number | null | undefined, prev: number | null | undefined): string => {
      if (cur == null || prev == null || prev === 0) return "—";
      const change = ((cur - prev) / Math.abs(prev)) * 100;
      return `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}%`;
    };

    autoTable(doc, {
      startY: y,
      head: [["", "Current Year", "Previous Year", "YoY Change"]],
      body: [
        ["Total Sales", fmt(f.current_total_sales), fmt(f.previous_total_sales), yoy(f.current_total_sales, f.previous_total_sales)],
        ["Cost of Goods", fmt(f.current_cog), fmt(f.previous_cog), yoy(f.current_cog, f.previous_cog)],
        ["Gross Profit", fmt(f.current_gross_profit), fmt(f.previous_gross_profit), yoy(f.current_gross_profit, f.previous_gross_profit)],
        ["COG Ratio (%)", f.current_cog_ratio != null ? `${Number(f.current_cog_ratio).toFixed(2)}%` : "—", f.previous_cog_ratio != null ? `${Number(f.previous_cog_ratio).toFixed(2)}%` : "—", yoy(f.current_cog_ratio, f.previous_cog_ratio)],
        ["Net Income", fmt(f.current_net_income), fmt(f.previous_net_income), yoy(f.current_net_income, f.previous_net_income)],
      ],
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "center", fontStyle: "bold" } },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Draw simple YoY bar chart in PDF
    const pw = doc.internal.pageSize.getWidth();
    const chartW = pw - 28;
    const chartH = 50;
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
    const chartX = 14;
    const chartBottom = y + chartH;

    // Background
    doc.setFillColor(248, 249, 250);
    doc.rect(chartX, y, chartW, chartH, "F");
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.rect(chartX, y, chartW, chartH, "S");

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

      // Label
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(m.label, gx + barW, chartBottom + 4, { align: "center" });
    });

    // Legend
    const ly = chartBottom + 8;
    doc.setFillColor(bt ? BLUE.r : 45, bt ? BLUE.g : 55, bt ? BLUE.b : 120);
    doc.rect(chartX, ly, 6, 3, "F");
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 60);
    doc.text("Current Year", chartX + 8, ly + 2.5);
    doc.setFillColor(160, 160, 160);
    doc.rect(chartX + 40, ly, 6, 3, "F");
    doc.text("Previous Year", chartX + 48, ly + 2.5);

    y = ly + 10;
  }

  // Counsel / Professional Advisors
  if (data.counsel && data.counsel.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.counsel.length * 7);
    y = section("Selection of Counsel & Banking");

    // Extract attorney and accountant info from counsel records
    const counselRec = data.counsel[0] || {};
    const attorneyName = counselRec.attorney_name?.trim() || "";
    const lawFirm = counselRec.law_firm?.trim() || "";
    const accountantName = counselRec.accountant_name?.trim() || "";
    const accountingFirm = counselRec.counsel_name?.trim() || ""; // counsel_name maps to accounting firm

    // Attorney / Law Firm paragraph
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BODY_COLOR);
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
        `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the legal counsel needs of ${companyName}; and`,
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
      const indent = 20;
      const resolvedPrefix = "RESOLVED, ";
      const resolvedBody = `that no legal counsel will be retained by the ${isLLC ? "company" : "corporation"}. When legal services are required, the ${isLLC ? "authorized binder" : "president"} of the ${isLLC ? "company" : "corporation"} is authorized to engage legal counsel as deemed appropriate.`;
      const fullResolved = resolvedPrefix + resolvedBody;
      const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - indent);
      y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);
      for (let i = 0; i < rLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("helvetica", "bold");
          const prefixWidth = doc.getTextWidth(resolvedPrefix);
          doc.text(resolvedPrefix, MARGIN + indent, y);
          doc.setFont("helvetica", "normal");
          const remainder = rLines[0].substring(resolvedPrefix.length);
          if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
        } else {
          doc.setFont("helvetica", "normal");
          doc.text(rLines[i], MARGIN + indent, y);
        }
        y += 5.5;
      }
      y += 5;
    }

    // Accountant / Accounting Firm paragraph
    y = checkPageBreak(doc, y, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BODY_COLOR);
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
        `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the accounting needs of ${companyName}; and`,
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
      const indent = 20;
      const resolvedPrefix = "RESOLVED, ";
      const resolvedBody = `that no accountant will be retained by the ${isLLC ? "company" : "corporation"}. When accounting services are required, the ${isLLC ? "authorized binder" : "president"} of the ${isLLC ? "company" : "corporation"} is authorized to engage an accountant as deemed appropriate.`;
      const fullResolved = resolvedPrefix + resolvedBody;
      const rLines = doc.splitTextToSize(fullResolved, doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN - indent);
      y = checkPageBreak(doc, y, rLines.length * 5.5 + 6);
      for (let i = 0; i < rLines.length; i++) {
        y = checkPageBreak(doc, y, 6);
        if (i === 0) {
          doc.setFont("helvetica", "bold");
          const prefixWidth = doc.getTextWidth(resolvedPrefix);
          doc.text(resolvedPrefix, MARGIN + indent, y);
          doc.setFont("helvetica", "normal");
          const remainder = rLines[0].substring(resolvedPrefix.length);
          if (remainder) doc.text(remainder, MARGIN + indent + prefixWidth, y);
        } else {
          doc.setFont("helvetica", "normal");
          doc.text(rLines[i], MARGIN + indent, y);
        }
        y += 5.5;
      }
      y += 5;
    }

    // Banking table
    y = checkPageBreak(doc, y, 30);
    autoTable(doc, {
      startY: y,
      head: [["Counsel", "Bank", "Loans"]],
      body: data.counsel.map(c => [c.counsel_name || "—", c.bank_name || "—", c.loans || "—"]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Loans
  if (data.loans && data.loans.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.loans.length * 7);
    y = section("Loans");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the borrowing needs and existing loan obligations of ${companyName}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following loans are hereby approved and the proper ${isLLC ? "authorized binders" : "officers"} are authorized to execute all necessary documents:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Type", "Rate", "Amount", "Date", "Notes"]],
      body: data.loans.map(l => [
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
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Vehicle Purchases
  if (data.vehiclePurchases && data.vehiclePurchases.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.vehiclePurchases.length * 7);
    y = section("Vehicle Purchases Entered Into During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, it is necessary for the company to obtain vehicles for the efficient operation of the business, and after discussion, the ${isLLC ? "authorized binders" : "directors"} decided that it would be in the best interests of the company to acquire the following vehicle(s);`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following vehicle purchases are hereby approved and ratified:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Year / Make / Model", "VIN", "Purchase Date", "Price", "Seller", "Business Use", "Authorized Drivers"]],
      body: data.vehiclePurchases.map((v: any) => [
        v.year_make_model || "—",
        v.vin || "—",
        v.purchase_date ? new Date(v.purchase_date + "T00:00:00").toLocaleDateString() : "—",
        v.purchase_price != null ? fmt(v.purchase_price) : "—",
        v.seller || "—",
        v.business_use_description || "—",
        v.authorized_drivers || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Vehicle Leases
  if (data.vehicleLeases && data.vehicleLeases.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.vehicleLeases.length * 7);
    y = section("Vehicle Leases Entered Into During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, it is necessary for the company to lease vehicles for the efficient operation of the business, and after discussion, the ${isLLC ? "members" : "directors"} decided that it would be in the best interests of the company to enter into the following vehicle lease(s);`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following vehicle leases are hereby approved and ratified:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Year / Make / Model", "VIN", "Lease Start", "Monthly Payment", "Lessor", "Relationship", "FMV Verified", "Business Use"]],
      body: data.vehicleLeases.map((v: any) => [
        v.year_make_model || "—",
        v.vin || "—",
        v.lease_start_date ? new Date(v.lease_start_date + "T00:00:00").toLocaleDateString() : "—",
        v.monthly_lease_payment != null ? fmt(v.monthly_lease_payment) : "—",
        v.lessor_name || "—",
        v.relationship_to_company || "—",
        v.fmv_verified ? "Yes" : "No",
        v.business_use_description || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Vehicle/Equipment Sales
  if (data.vehicleSales && data.vehicleSales.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.vehicleSales.length * 7);
    y = section("Vehicles & Equipment Sold During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the disposition of vehicles and equipment by ${companyName} during the year, and after discussion;`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following vehicle and equipment sales are hereby ratified and approved:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Description", "VIN", "Sale Date", "Sale Price", "Buyer", "Reason"]],
      body: data.vehicleSales.map((v: any) => [
        v.year_make_model || "—",
        v.vin || "—",
        v.sale_date ? new Date(v.sale_date + "T00:00:00").toLocaleDateString() : "—",
        v.sale_price != null ? fmt(v.sale_price) : "—",
        v.buyer_name || "—",
        v.reason_for_sale || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Lease Terminations
  if (data.leaseTerminations && data.leaseTerminations.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.leaseTerminations.length * 7);
    y = section("Leases Ended During the Year");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the leases that have expired or been terminated by ${companyName} during the year; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the termination or expiration of the following leases is hereby acknowledged and ratified:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Property / Vehicle", "Landlord / Lessor", "End Date", "Reason", "Early Term.", "Penalty"]],
      body: data.leaseTerminations.map((v: any) => [
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
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Amendments
  if (data.amendments && data.amendments.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.amendments.length * 12);
    y = section("Amendments");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has determined that certain amendments to the governing documents of ${companyName} are in the best interests of the ${isLLC ? "company" : "corporation"}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following amendments are hereby adopted:`,
      bt
    );
    data.amendments.forEach((a) => {
      y = checkPageBreak(doc, y, 25);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
      doc.text(a.amendment_type || "Amendment", MARGIN, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...(bt ? BODY_COLOR : [30, 30, 30] as [number, number, number]));
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
  if (data.resolutions && data.resolutions.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.resolutions.length * 15);
    y = section("Special Resolutions");
    data.resolutions.forEach((r) => {
      y = checkPageBreak(doc, y, 25);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
      doc.text(r.purpose, MARGIN, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...(bt ? BODY_COLOR : [30, 30, 30] as [number, number, number]));
      const lines = doc.splitTextToSize(r.resolution_text || "", doc.internal.pageSize.getWidth() - MARGIN - R_MARGIN);
      for (const line of lines) {
        y = checkPageBreak(doc, y, 6);
        doc.text(line, MARGIN, y);
        y += 5;
      }
      y += 5;
    });
  }

  // Auto-generated resolutions from prior year comparison
  if (data.priorYear) {
    const autoResolutions: { purpose: string; text: string }[] = [];
    const entityType = company?.entity_type || "Corporation";
    const isLLC = entityType === "LLC";
    const entityLabel = isLLC ? "LLC" : "corporation";

    // Officer changes: new officers, title changes, salary/bonus changes
    if (data.officers && data.officers.length > 0) {
      const priorOfficers = data.priorYear.officers || [];
      const priorByName: Record<string, any> = {};
      priorOfficers.forEach((o: any) => { priorByName[o.name?.toLowerCase()] = o; });

      data.officers.forEach((o: any) => {
        const prior = priorByName[o.name?.toLowerCase()];
        if (!prior) {
          autoResolutions.push({
            purpose: `Elect ${o.title}`,
            text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has determined it is in the best interests of the ${entityLabel} to elect a new officer, and after discussion, it was\n\nRESOLVED, that ${o.name} is hereby elected as ${o.title} of the ${entityLabel}${o.salary != null ? `, with an annual salary of ${fmt(o.salary)}` : ""}${o.bonus != null ? ` and a bonus of ${fmt(o.bonus)}` : ""}, effective immediately.`,
          });
        } else {
          if (o.salary != null && prior.salary != null && Number(o.salary) !== Number(prior.salary)) {
            autoResolutions.push({
              purpose: `Adjust ${o.title} Salary`,
              text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the compensation of ${o.name}, ${o.title}, and after discussion, it was\n\nRESOLVED, that the annual salary of ${o.name}, ${o.title}, is hereby adjusted from ${fmt(prior.salary)} to ${fmt(o.salary)}, effective immediately.`,
            });
          }
          if (o.bonus != null && prior.bonus != null && Number(o.bonus) !== Number(prior.bonus)) {
            autoResolutions.push({
              purpose: `Adjust ${o.title} Bonus`,
              text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the bonus compensation of ${o.name}, ${o.title}, and after discussion, it was\n\nRESOLVED, that a bonus of ${fmt(o.bonus)} is hereby authorized for ${o.name}, ${o.title} (prior year bonus: ${fmt(prior.bonus)}).`,
            });
          }
          if (o.title !== prior.title) {
            autoResolutions.push({
              purpose: `Change Officer Title`,
              text: `WHEREAS, ${o.name} previously held the title of ${prior.title}, and the ${isLLC ? "members/authorized binders" : "Board"} has determined a change is appropriate, it was\n\nRESOLVED, that ${o.name} is hereby appointed as ${o.title} of the ${entityLabel}, replacing the prior title of ${prior.title}.`,
            });
          }
        }
      });
    }

    // Benefit changes
    if (data.benefits && data.benefits.length > 0) {
      const priorBenefits = data.priorYear.benefits || [];
      const priorTypes = new Set(priorBenefits.map((b: any) => (b.benefit_type || b.benefit_description || "").toLowerCase()));

      data.benefits.forEach((b: any) => {
        const bType = b.benefit_type || b.benefit_description || "Benefit Plan";
        if (!priorTypes.has(bType.toLowerCase())) {
          autoResolutions.push({
            purpose: `Approve ${bType}`,
            text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the proposed ${bType} plan${b.provider ? ` with ${b.provider}` : ""}, and after discussion, it was\n\nRESOLVED, that the ${entityLabel} is hereby authorized to establish the ${bType} plan${b.provider ? ` through ${b.provider}` : ""}${b.retirement_contribution != null ? `, with a contribution of ${fmt(b.retirement_contribution)}` : ""}${b.plan_year ? `, effective for plan year ${b.plan_year}` : ""}.`,
          });
        } else {
          const priorMatch = priorBenefits.find((pb: any) => (pb.benefit_type || pb.benefit_description || "").toLowerCase() === bType.toLowerCase());
          if (priorMatch && b.retirement_contribution != null && priorMatch.retirement_contribution != null && Number(b.retirement_contribution) !== Number(priorMatch.retirement_contribution)) {
            autoResolutions.push({
              purpose: `Adjust ${bType} Contribution`,
              text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board"} has reviewed the ${bType} plan, and after discussion, it was\n\nRESOLVED, that the contribution to the ${bType} plan is hereby adjusted from ${fmt(priorMatch.retirement_contribution)} to ${fmt(b.retirement_contribution)}.`,
            });
          }
        }
      });
    }

    // Loan changes
    if (data.loans && data.loans.length > 0) {
      const priorLoans = data.priorYear.loans || [];
      const priorLoanTypes = new Set(priorLoans.map((l: any) => `${l.loan_type || ""}|${l.loan_amount || ""}`));

      data.loans.forEach((l: any) => {
        const key = `${l.loan_type || ""}|${l.loan_amount || ""}`;
        if (!priorLoanTypes.has(key)) {
          autoResolutions.push({
            purpose: `Authorize ${l.loan_type || "Loan"}`,
            text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has determined it is in the best interests of the ${entityLabel} to obtain financing, and after discussion, it was\n\nRESOLVED, that the proper ${isLLC ? "authorized binders" : "officers"} are hereby authorized to execute any documents necessary to establish a ${l.loan_type || "loan"}${l.loan_amount != null ? ` in the amount of ${fmt(l.loan_amount)}` : ""}${l.loan_rate != null ? ` at a rate of ${Number(l.loan_rate).toFixed(2)}%` : ""}.`,
          });
        }
      });
    }

    // Authorized signer changes
    if (data.authorizedSigners && data.authorizedSigners.length > 0) {
      const priorSigners = data.priorYear.authorizedSigners || [];
      const priorNames = new Set(priorSigners.map((s: any) => s.signer_name?.toLowerCase()));

      data.authorizedSigners.forEach((s: any) => {
        if (!priorNames.has(s.signer_name?.toLowerCase())) {
          autoResolutions.push({
            purpose: `Authorize Bank Signatory`,
            text: `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has determined it is necessary to update the authorized signatories, and after discussion, it was\n\nRESOLVED, that ${s.signer_name}${s.title ? `, ${s.title},` : ""} is hereby authorized as a signatory${s.bank_name ? ` on the accounts at ${s.bank_name}` : ""}.`,
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
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      doc.text("The following resolutions were auto-generated based on changes from the prior year meeting record.", MARGIN, y);
      y += 7;

      autoResolutions.forEach((r) => {
        y = checkPageBreak(doc, y, 30);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(bt ? BLUE.r : 30, bt ? BLUE.g : 30, bt ? BLUE.b : 30);
        doc.text(r.purpose, MARGIN, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(...(bt ? BODY_COLOR : [30, 30, 30] as [number, number, number]));
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

  if (data.benefits && data.benefits.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.benefits.length * 7);
    y = section("Benefits");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the employee benefit plans of ${companyName} for the current plan year; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following benefit plans are hereby approved and adopted for the ensuing year:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Benefit Type", "Provider", "Agent/Admin", "Plan Year", "Contribution"]],
      body: data.benefits.map(b => [
        b.benefit_type || b.benefit_description || "—",
        b.provider || "—",
        b.agent_administrator || "—",
        b.plan_year?.toString() || "—",
        b.retirement_contribution != null ? fmt(b.retirement_contribution) : "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Agreements
  if (data.agreements && data.agreements.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.agreements.length * 7);
    y = section("Agreements");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the following agreements entered into by ${companyName}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following agreements are hereby ratified and approved:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Type", "Date", "With", "Purpose"]],
      body: data.agreements.map(a => [
        a.agreement_type,
        a.agreement_date ? new Date(a.agreement_date + "T00:00:00").toLocaleDateString() : "—",
        a.agreement_with || "—",
        a.agreement_purpose || "—",
      ]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Other
  if (data.other && data.other.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.other.length * 7);
    y = section("Other Notes");
    autoTable(doc, {
      startY: y,
      head: [["Notes"]],
      body: data.other.map(o => [o.notes]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Authorized Signatories
  if (data.authorizedSigners && data.authorizedSigners.length > 0) {
    y = checkPageBreak(doc, y, 20 + data.authorizedSigners.length * 7);
    y = section("Authorized Signatories");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members/authorized binders" : "Board of Directors"} has reviewed the authorized signatories on the banking accounts of ${companyName}; and`,
      `NOW, THEREFORE, BE IT RESOLVED, that the following persons are hereby authorized as signatories on the designated accounts:`,
      bt
    );
    autoTable(doc, {
      startY: y,
      head: [["Name", "Title", "Bank"]],
      body: data.authorizedSigners.map(s => [s.signer_name, s.title || "—", s.bank_name || "—"]),
      theme: "grid",
      headStyles: tableHeadStyles,
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Registered Agent Confirmation (Annual Meeting blue theme)
  if (bt && company?.registered_agent_name) {
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
  if (bt) {
    y = checkPageBreak(doc, y, 40);
    y = section("General Authorization");
    y = addWhereasResolved(doc, y,
      `WHEREAS, the ${isLLC ? "members" : "Board of Directors"} recognizes that actions may need to be taken to implement the resolutions adopted at this meeting;`,
      `NOW, THEREFORE, BE IT RESOLVED, that the ${isLLC ? "authorized binders" : "officers"} of the company are hereby authorized and directed to execute and deliver any and all documents, instruments, and certificates, and to take any and all actions as may be necessary or appropriate to carry out the intent and purposes of the foregoing resolutions.`,
      bt
    );
  }

  // Signature block
  y = checkPageBreak(doc, y, 60);
  y += 10;
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("There being no further business, the meeting was adjourned.", MARGIN, y);
  y += 14;

  doc.setFontSize(10);
  doc.line(MARGIN, y, 90, y);
  doc.text("Secretary", MARGIN, y + 5);
  doc.text("Date: _______________", 95, y + 5);

  y += 18;

  doc.line(MARGIN, y, 90, y);
  doc.text("Chairperson", MARGIN, y + 5);
  doc.text("Date: _______________", 95, y + 5);

  // Footer
  if (bt) {
    addAnnualMeetingFooter(doc, companyName);
  } else {
    addDFIFooter(doc, companyName);
  }
  return doc;
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
    autoTable(doc, {
      startY: y,
      head: [tableHead],
      body: tableBody,
      theme: "grid",
      headStyles: { fillColor: [45, 55, 72], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      margin: { left: MARGIN, right: R_MARGIN },
      styles: { overflow: "linebreak", cellWidth: "auto" },
    });
  } else {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
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

export function exportFinancialsPDF(company: any, meeting: any, financials: any) {
  const doc = new jsPDF();
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
      return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
    };

    autoTable(doc, {
      startY: y,
      head: [["", "Current Year", "Previous Year", "YoY Change"]],
      body: [
        ["Total Sales", fmt(financials.current_total_sales), fmt(financials.previous_total_sales), yoy(financials.current_total_sales, financials.previous_total_sales)],
        ["Cost of Goods", fmt(financials.current_cog), fmt(financials.previous_cog), yoy(financials.current_cog, financials.previous_cog)],
        ["Gross Profit", fmt(financials.current_gross_profit), fmt(financials.previous_gross_profit), yoy(financials.current_gross_profit, financials.previous_gross_profit)],
        ["COG Ratio (%)", financials.current_cog_ratio != null ? `${Number(financials.current_cog_ratio).toFixed(2)}%` : "—", financials.previous_cog_ratio != null ? `${Number(financials.previous_cog_ratio).toFixed(2)}%` : "—", yoy(financials.current_cog_ratio, financials.previous_cog_ratio)],
        ["Net Income", fmt(financials.current_net_income), fmt(financials.previous_net_income), yoy(financials.current_net_income, financials.previous_net_income)],
      ],
      theme: "grid",
      headStyles: { fillColor: [45, 55, 72], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 3: { halign: "center", fontSize: 9 } },
      margin: { left: MARGIN, right: R_MARGIN },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

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
      doc.setFont("helvetica", "normal");
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
  if (val == null) return "—";
  return `$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

// Save and download
export function downloadPDF(doc: jsPDF, fileName: string) {
  doc.save(fileName);
}

// Get PDF as blob URL for preview
export function getPDFPreviewUrl(doc: jsPDF): string {
  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}
