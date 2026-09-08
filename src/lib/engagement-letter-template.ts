/**
 * Engagement letter wording. ALL prose for the engagement letter lives here —
 * the PDF generator contains no prose of its own.
 *
 * Text is reproduced exactly as supplied. The draft's "Limitation of
 * Liability" placeholder section is intentionally omitted, so the remaining
 * sections are numbered 1–10.
 */

export const ENGAGEMENT_LETTER_VERSION = "v1-2026-09";

export interface EngagementLetterSection {
  heading: string;
  /** Paragraphs rendered before any bullets. */
  paragraphs?: string[];
  /** Bulleted lines. */
  bullets?: string[];
  /** Paragraphs rendered after the bullets. */
  trailingParagraphs?: string[];
}

export const ENGAGEMENT_LETTER_TEMPLATE = {
  version: ENGAGEMENT_LETTER_VERSION,
  documentTitle: "CORPORATE RECORDS SERVICES ENGAGEMENT LETTER",
  reLine: "Re: Corporate Records and Administrative Services",
  salutationFallback: "Sir or Madam",
  /** {FIRM} and {COMPANY} are replaced by the generator. */
  intro:
    'Thank you for engaging {FIRM} ("we," "us") to provide corporate records and administrative services to {COMPANY} ("you," "the Company"). This letter describes what we will do, what we will not do, and the terms of our engagement. Please review it carefully and return a signed copy.',

  /** Default services list — editable per client before generating. */
  defaultServices: [
    "Maintaining the Company's corporate record book, including minutes, consents, and organizational documents",
    "Preparing standard-form annual meeting minutes, written consents, and resolutions from templates, based on information you supply",
    "Maintaining the share or membership-unit ledger and transfer records",
    "Preparing and administratively filing the Company's annual report with the Wisconsin Department of Financial Institutions",
    "Tracking record-keeping deadlines and providing reminders",
    "Assembling and delivering standard-form documents at your request",
  ],

  defaultFeeTerms:
    "[Fee structure — flat annual, hourly, per document]. Invoices are due [terms]. Fees for filings, taxes, and government charges are your responsibility and are billed separately.",

  sections: [
    {
      heading: "Services We Will Provide",
      // bullets supplied at generation time (client-editable services list)
    },
    {
      heading: "Not a Law Firm; No Attorney-Client Relationship",
      paragraphs: [
        "We are not a law firm and we are not attorneys. No attorney-client relationship is created by this engagement.",
        "Communications between us are not protected by the attorney-client privilege and are not confidential from a legal standpoint. They may be discoverable in litigation or an audit. If you need privileged advice, obtain it from an attorney directly.",
      ],
    },
    {
      heading: "Services We Will Not Provide",
      paragraphs: ["We do not, and cannot:"],
      bullets: [
        "Give legal advice or legal opinions of any kind",
        "Advise on entity selection, structure, or conversion",
        "Interpret statutes, regulations, or your governing documents, or advise on their application to your circumstances",
        "Draft custom provisions, or modify template language to address your specific legal situation",
        "Advise on tax matters, elections, or filings",
        "Advise on securities law compliance for any issuance or transfer of shares or units",
        "Represent the Company before any court or agency",
        "Determine whether the Company is in compliance with any law",
      ],
      trailingParagraphs: [
        "Documents we prepare are standard forms populated with information you provide. Selecting the appropriate document, and confirming that its content and effect are correct for your situation, is your responsibility and your attorney's.",
      ],
    },
    {
      heading: "Your Responsibilities",
      bullets: [
        "Providing complete and accurate information, and notifying us promptly of changes in ownership, officers, directors, registered agent, or address",
        "Reviewing every document before signing, filing, or relying on it",
        "Retaining your own attorney and accountant for legal and tax matters",
        "Making all decisions regarding the Company's governance and legal compliance",
      ],
      trailingParagraphs: [
        "We rely on the information you give us and do not independently verify it.",
      ],
    },
    {
      heading: "Attorney Review Recommended",
      paragraphs: [
        "We recommend you have your attorney review any document we prepare before it is executed or filed, particularly documents affecting ownership, amending governing documents, or filed with a government agency. If you do not have an attorney, we will provide referrals on request, but the selection is yours.",
      ],
    },
    {
      heading: "Fees",
      // paragraph supplied at generation time (fee terms)
    },
    {
      heading: "Your Records",
      paragraphs: [
        "The Company's corporate records belong to the Company. On request, and on termination of this engagement, we will provide a complete copy of the Company's records in a usable format within [30] days, subject to payment of outstanding fees.",
      ],
    },
    {
      heading: "Confidentiality",
      paragraphs: [
        "We will keep the Company's information confidential and will not disclose it except as you direct or as required by law. This is a contractual obligation and is not a legal privilege — see Section 2.",
      ],
    },
    {
      heading: "Term and Termination",
      paragraphs: [
        "This engagement continues until terminated by either party on [30] days' written notice. Termination does not affect fees earned before the termination date.",
      ],
    },
    {
      heading: "Entire Agreement",
      paragraphs: [
        "This letter is the entire agreement between us regarding these services and supersedes any prior understanding. It may be amended only in writing signed by both parties.",
      ],
    },
  ] as EngagementLetterSection[],

  closing: "If the above reflects your understanding, please sign below and return one copy.",
  signOff: "Sincerely,",
  acceptanceHeading: "ACCEPTED AND AGREED:",
  acceptanceLines: ["By:", "Name:", "Title:", "Date:"],
} as const;
