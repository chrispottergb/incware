/**
 * Nonprofit financial reporting — pure logic.
 *
 * Nothing in this file touches the network or React. It is the single source
 * of truth for: who counts as a nonprofit, which fields a given IRS form
 * exposes, the oversight ratios, the reconciliation checks, and the wording of
 * the statement header.
 */

/** The entity_type values that qualify as a nonprofit. */
export const NONPROFIT_ENTITY_TYPES = ["Non-Profit"] as const;

/** Single gate for nonprofit behavior. Never compare entity_type directly. */
export function isNonprofit(company: { entity_type?: string | null } | null | undefined): boolean {
  const raw = company?.entity_type;
  if (typeof raw !== "string") return false;
  const norm = raw.trim().toLowerCase();
  if (!norm) return false;
  return NONPROFIT_ENTITY_TYPES.some((t) => t.toLowerCase() === norm);
}

export type IrsFormType = "990" | "990-EZ" | "990-N" | "990-PF" | "none";

export const IRS_FORM_TYPES: { value: IrsFormType; label: string }[] = [
  { value: "990", label: "Form 990" },
  { value: "990-EZ", label: "Form 990-EZ" },
  { value: "990-N", label: "Form 990-N (e-Postcard)" },
  { value: "990-PF", label: "Form 990-PF" },
  { value: "none", label: "No return filed" },
];

export const SOURCE_TAGS = ["tax_return", "audited_financials", "internal", "manual"] as const;
export type SourceTag = (typeof SOURCE_TAGS)[number];

export const SOURCE_TAG_LABELS: Record<SourceTag, string> = {
  tax_return: "Tax Return",
  audited_financials: "Audited",
  internal: "Internal",
  manual: "Manual",
};

export const REVENUE_FIELDS = [
  { key: "contributions_grants", label: "Contributions & Grants", ref: "990 Part VIII line 1h" },
  { key: "program_service_revenue", label: "Program Service Revenue", ref: "990 Part VIII line 2g" },
  { key: "membership_dues", label: "Membership Dues", ref: "990 Part VIII line 1b" },
  { key: "investment_income", label: "Investment Income", ref: "990 Part VIII line 3" },
  { key: "fundraising_events_net", label: "Special Events, Net", ref: "990 Part VIII line 8c" },
  { key: "in_kind_contributions", label: "In-Kind Contributions", ref: "990 Part VIII line 1g" },
  { key: "other_revenue", label: "Other Revenue", ref: "990 Part VIII line 11e" },
] as const;

export const REVENUE_TOTAL_FIELD = {
  key: "total_revenue",
  label: "TOTAL SUPPORT & REVENUE",
  ref: "990 Part VIII line 12",
} as const;

export const FUNCTIONAL_EXPENSE_FIELDS = [
  { key: "program_services_expense", label: "Program Services", ref: "990 Part IX line 25 col B" },
  { key: "management_general_expense", label: "Management & General", ref: "990 Part IX line 25 col C" },
  { key: "fundraising_expense", label: "Fundraising", ref: "990 Part IX line 25 col D" },
] as const;

export const EXPENSE_TOTAL_FIELD = {
  key: "total_expenses",
  label: "TOTAL EXPENSES",
  ref: "990 Part IX line 25 col A",
} as const;

export const NET_ASSET_FIELDS = [
  { key: "net_assets_beginning", label: "Net Assets, Beginning of Year", ref: "990 Part XI line 4" },
  { key: "change_in_net_assets", label: "Change in Net Assets", ref: "990 Part XI line 3" },
  { key: "net_assets_ending", label: "NET ASSETS, END OF YEAR", ref: "990 Part XI line 10", total: true },
  { key: "net_assets_without_restrictions", label: "Without Donor Restrictions", ref: "990 Part X line 27", indent: true },
  { key: "net_assets_with_restrictions", label: "With Donor Restrictions", ref: "990 Part X line 28", indent: true },
  { key: "total_assets", label: "Total Assets", ref: "990 Part X line 16" },
  { key: "total_liabilities", label: "Total Liabilities", ref: "990 Part X line 26" },
] as const;

export interface NonprofitStatement {
  id?: string;
  company_id?: string;
  fiscal_year: number;
  fiscal_year_label?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  /** @deprecated Retired — the Source selector is the single source of truth. */
  is_audited?: boolean | null;
  has_irregular_period?: boolean | null;
  board_review_meeting_id?: string | null;
  is_draft?: boolean | null;
  return_filed_date?: string | null;
  documented_date?: string | null;
  board_reviewed_date?: string | null;
  gross_receipts_under_threshold?: boolean | null;
  board_acknowledgment?: string | null;
  source_tags?: Record<string, SourceTag> | null;
  dismissed_warnings?: DismissedWarning[] | null;
  updated_at?: string | null;
  [key: string]: any;
}

export interface DismissedWarning {
  code: string;
  message: string;
  dismissed_by?: string | null;
  dismissed_at?: string | null;
}

export function defaultFiscalYearLabel(year: number): string {
  return `FY${year}`;
}

// ------------------------------------------------------------ period dates

export interface DerivedPeriod {
  start: string;
  end: string;
  /** True when the company has no usable fiscal year end and we fell back to the calendar year. */
  usedCalendarFallback: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Period start/end derived from the company's fiscal year end (month/day) and
 * the statement's fiscal year. The period ENDS in `fiscalYear`.
 */
export function derivePeriod(
  fiscalYearEnd: string | null | undefined,
  fiscalYear: number,
): DerivedPeriod {
  const m = String(fiscalYearEnd ?? "").match(/(\d{1,2})[-/](\d{1,2})$/);
  if (!m || !Number.isFinite(fiscalYear)) {
    return {
      start: `${fiscalYear}-01-01`,
      end: `${fiscalYear}-12-31`,
      usedCalendarFallback: true,
    };
  }
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const end = new Date(Date.UTC(fiscalYear, month - 1, day));
  const start = new Date(Date.UTC(fiscalYear - 1, month - 1, day));
  start.setUTCDate(start.getUTCDate() + 1);
  return { start: iso(start), end: iso(end), usedCalendarFallback: false };
}

export const NO_FISCAL_YEAR_END_NOTE =
  "Fiscal year end not set on this company. Using calendar year.";

/**
 * Resolve the period actually stored on a statement: user-entered when the
 * period is short or irregular, derived otherwise.
 */
export function resolvePeriod(
  s: { fiscal_year: number; has_irregular_period?: boolean | null; period_start?: string | null; period_end?: string | null },
  fiscalYearEnd: string | null | undefined,
): { start: string | null; end: string | null } {
  if (s.has_irregular_period) {
    return { start: s.period_start || null, end: s.period_end || null };
  }
  const d = derivePeriod(fiscalYearEnd, Number(s.fiscal_year));
  return { start: d.start, end: d.end };
}

// --------------------------------------------------- source consistency note

export function sourceConsistencyNote(
  sourceTag: SourceTag | null | undefined,
  returnFiledDate: string | null | undefined,
): string | null {
  if (sourceTag === "tax_return" && !returnFiledDate) {
    return "No filing date entered. If the return has not been filed, consider 'Internal Records — Unaudited' as the source.";
  }
  if (sourceTag === "internal" && returnFiledDate) {
    return "A filing date is recorded. Consider 'Form 990 as filed' as the source.";
  }
  return null;
}

export const MANUAL_REVIEW_DATE_NOTE = "Entered manually. Not linked to a meeting.";

/** True for a legacy review date typed by a user rather than sourced from a meeting. */
export function isManualReviewDate(s: NonprofitStatement): boolean {
  return !!s.board_reviewed_date && !s.board_review_meeting_id;
}

/** The single source selection that applies to a statement's figures. */
export function primarySourceTag(s: NonprofitStatement): SourceTag | null {
  const tags = (s.source_tags || {}) as Record<string, SourceTag>;
  const first = Object.values(tags).find((t) => SOURCE_TAGS.includes(t));
  return (first as SourceTag) ?? null;
}

/**
 * Suggest a fiscal year from the company's fiscal year end (MM-DD or a date)
 * and a reference date. The fiscal year is the year the period ENDS in.
 */
export function suggestFiscalYear(fiscalYearEnd: string | null | undefined, today: Date = new Date()): number {
  const y = today.getUTCFullYear();
  if (!fiscalYearEnd) return y - 1;
  const m = String(fiscalYearEnd).match(/(\d{1,2})[-/](\d{1,2})$/);
  if (!m) return y - 1;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const endThisYear = new Date(Date.UTC(y, month - 1, day));
  return today.getTime() >= endThisYear.getTime() ? y : y - 1;
}

// ---------------------------------------------------------------- visibility

export interface FormVisibility {
  showStatement: boolean;
  showRevenueDetail: boolean;
  showFunctionalSplit: boolean;
  showNetAssets: boolean;
  showRatios: boolean;
  showChart: boolean;
  showConfirmationBlock: boolean;
  unsupportedMessage: string | null;
  note: string | null;
}

export function getFormVisibility(formType: IrsFormType | null | undefined): FormVisibility {
  const base: FormVisibility = {
    showStatement: true,
    showRevenueDetail: true,
    showFunctionalSplit: true,
    showNetAssets: true,
    showRatios: true,
    showChart: true,
    showConfirmationBlock: false,
    unsupportedMessage: null,
    note: null,
  };
  switch (formType) {
    case "990":
      return base;
    case "990-EZ":
      return {
        ...base,
        showFunctionalSplit: false,
        showChart: false,
        note: "Form 990-EZ does not report a functional expense allocation.",
      };
    case "990-N":
      return {
        ...base,
        showStatement: false,
        showRevenueDetail: false,
        showFunctionalSplit: false,
        showNetAssets: false,
        showRatios: false,
        showChart: false,
        showConfirmationBlock: true,
      };
    case "990-PF":
      return {
        ...base,
        showStatement: false,
        showRevenueDetail: false,
        showFunctionalSplit: false,
        showNetAssets: false,
        showRatios: false,
        showChart: false,
        unsupportedMessage: "Private foundation reporting (Form 990-PF) is not yet supported.",
      };
    default:
      return {
        ...base,
        showStatement: false,
        showRevenueDetail: false,
        showFunctionalSplit: false,
        showNetAssets: false,
        showRatios: false,
        showChart: false,
      };
  }
}

// -------------------------------------------------------------------- ratios

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export interface RatioCard {
  key: string;
  label: string;
  display: string;
  formula: string;
}

export function computeRatios(s: NonprofitStatement): RatioCard[] {
  const cards: RatioCard[] = [];
  const program = num(s.program_services_expense);
  const totalExp = num(s.total_expenses);
  const fundraising = num(s.fundraising_expense);
  const contributions = num(s.contributions_grants);
  const unrestricted = num(s.net_assets_without_restrictions);
  const totalRev = num(s.total_revenue);

  if (program != null && totalExp != null && totalExp !== 0) {
    cards.push({
      key: "program_expense_ratio",
      label: "Program Expense Ratio",
      display: `${((program / totalExp) * 100).toFixed(1)}%`,
      formula: "Program Services ÷ Total Expenses",
    });
  }
  if (fundraising != null && contributions != null && contributions !== 0) {
    cards.push({
      key: "fundraising_efficiency",
      label: "Fundraising Efficiency",
      display: `$${(fundraising / contributions).toFixed(2)} cost per $1.00 raised`,
      formula: "Fundraising Expense ÷ Contributions & Grants",
    });
  }
  if (unrestricted != null && totalExp != null && totalExp > 0) {
    cards.push({
      key: "operating_reserve",
      label: "Months of Operating Reserve",
      display: `${(unrestricted / (totalExp / 12)).toFixed(1)} months`,
      formula: "Net Assets Without Donor Restrictions ÷ (Total Expenses ÷ 12)",
    });
  }
  if (totalRev != null && totalRev !== 0) {
    const lines = REVENUE_FIELDS.map((f) => num(s[f.key])).filter((v): v is number => v != null);
    if (lines.length > 0) {
      const largest = Math.max(...lines);
      cards.push({
        key: "revenue_concentration",
        label: "Revenue Concentration",
        display: `${((largest / totalRev) * 100).toFixed(1)}%`,
        formula: "Largest single revenue line ÷ Total Revenue",
      });
    }
  }
  return cards;
}

// ----------------------------------------------------------- reconciliation

export interface ReconciliationWarning {
  code: string;
  label: string;
  left: string;
  right: string;
  difference: number;
  message: string;
  prominent?: boolean;
}

export function toleranceFor(endingNetAssets: number | null): number {
  const base = endingNetAssets == null ? 0 : Math.abs(endingNetAssets) * 0.001;
  return Math.max(10, base);
}

const money = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function runReconciliation(
  s: NonprofitStatement,
  formType: IrsFormType | null | undefined,
  priorYear?: NonprofitStatement | null,
): ReconciliationWarning[] {
  const out: ReconciliationWarning[] = [];
  const ending = num(s.net_assets_ending);
  const tol = toleranceFor(ending);

  const check = (
    code: string,
    label: string,
    leftVal: number | null,
    rightVal: number | null,
    leftText: string,
    rightText: string,
    prominent = false,
  ) => {
    if (leftVal == null || rightVal == null) return;
    const diff = leftVal - rightVal;
    if (Math.abs(diff) <= tol) return;
    out.push({
      code,
      label,
      left: `${leftText} = ${money(leftVal)}`,
      right: `${rightText} = ${money(rightVal)}`,
      difference: diff,
      message: `${label}: ${leftText} (${money(leftVal)}) does not equal ${rightText} (${money(rightVal)}); difference ${money(diff)}.`,
      prominent,
    });
  };

  const beginning = num(s.net_assets_beginning);
  const change = num(s.change_in_net_assets);
  const totalRev = num(s.total_revenue);
  const totalExp = num(s.total_expenses);

  if (beginning != null && change != null) {
    check("A", "Net asset roll-forward", beginning + change, ending, "Beginning + Change", "Ending net assets");
  }
  if (totalRev != null && totalExp != null) {
    check("B", "Change in net assets", totalRev - totalExp, change, "Revenue − Expenses", "Change in net assets");
  }
  if (formType === "990") {
    const p = num(s.program_services_expense);
    const m = num(s.management_general_expense);
    const f = num(s.fundraising_expense);
    if (p != null && m != null && f != null) {
      check("C", "Functional expense split", p + m + f, totalExp, "Program + M&G + Fundraising", "Total expenses");
    }
  }
  const detail = REVENUE_FIELDS.map((f) => num(s[f.key])).filter((v): v is number => v != null);
  if (detail.length > 0 && totalRev != null) {
    check("D", "Revenue detail", detail.reduce((a, b) => a + b, 0), totalRev, "Sum of revenue lines", "Total revenue");
  }
  const without = num(s.net_assets_without_restrictions);
  const withR = num(s.net_assets_with_restrictions);
  if (without != null && withR != null) {
    check("E", "Net asset classes", without + withR, ending, "Without + With donor restrictions", "Ending net assets");
  }
  const assets = num(s.total_assets);
  const liabilities = num(s.total_liabilities);
  if (assets != null && liabilities != null) {
    check("F", "Balance sheet", assets - liabilities, ending, "Total assets − Total liabilities", "Ending net assets");
  }
  // G — cross-year continuity. Skipped silently when there is no prior record.
  if (priorYear) {
    check(
      "G",
      "Cross-year continuity",
      beginning,
      num(priorYear.net_assets_ending),
      "This year's beginning net assets",
      `FY${priorYear.fiscal_year} ending net assets`,
      true,
    );
  }
  return out;
}

// -------------------------------------------------------------------- header

export interface StatementHeader {
  title: string;
  fiscalYearLine: string;
  sourceLine: string;
  statusLine: string;
  documentedLine: string;
  boardReviewedLine: string;
  /** Informational only — never a warning. */
  postFilingNote: string | null;
}

const fmtDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

export function buildStatementHeader(s: NonprofitStatement): StatementHeader {
  const filed = s.return_filed_date || null;
  const reviewed = s.board_reviewed_date || null;
  const manualReview = isManualReviewDate(s);
  const tag = primarySourceTag(s);

  let sourceLine: string;
  let postFilingNote: string | null = null;

  if (filed && reviewed) {
    if (reviewed <= filed) {
      sourceLine = `Reviewed by the governing body prior to filing on ${fmtDate(filed)}.`;
    } else {
      sourceLine = `Ratified and adopted as filed. Return filed ${fmtDate(filed)}; reviewed and adopted by the governing body ${fmtDate(reviewed)}.`;
      postFilingNote =
        "Board review occurred after the return was filed. This record supports ratification of the return as filed; it does not evidence pre-filing review under Form 990 Part VI.";
    }
    if (manualReview) sourceLine += " (review date entered manually)";
  } else if (tag === "audited_financials") {
    sourceLine = "Source: Audited Financial Statements";
  } else if (tag === "tax_return" || filed) {
    sourceLine = filed ? `Source: Form 990 as filed ${fmtDate(filed)}` : "Source: Form 990 as filed";
  } else {
    sourceLine = "Source: Internal Records — Unaudited";
  }

  const periodLine =
    s.period_start && s.period_end
      ? `Period: ${fmtDate(s.period_start)} – ${fmtDate(s.period_end)}`
      : null;

  return {
    title: "Statement of Activities and Changes in Net Assets",
    fiscalYearLine: `Fiscal Year Ended: ${s.period_end ? fmtDate(s.period_end) : `FY${s.fiscal_year}`}`,
    periodLine,
    sourceLine,
    statusLine: `Status: ${s.is_draft === false ? "Final" : "Draft"}`,
    documentedLine: `Documented: ${fmtDate(s.documented_date) || "—"}`,
    boardReviewedLine: `Board Reviewed: ${reviewed ? fmtDate(reviewed) : "Pending Review"}${
      reviewed && manualReview ? ` — ${MANUAL_REVIEW_DATE_NOTE}` : ""
    }`,
    postFilingNote,
  };
}

export const LEGACY_MEETING_FINANCIALS_NOTE =
  "This meeting predates nonprofit financial statement reporting. Figures shown are as originally recorded.";

export function amendedSinceFinalizeNotice(fiscalYear: number, meetingDate: string): string {
  return `The FY${fiscalYear} statement has been amended since this meeting was finalized. These minutes show the figures as reviewed on ${fmtDate(meetingDate)}. A ratification of the amended figures may be required.`;
}

export function entityTypeChangeWarning(count: number): string {
  return `This company has ${count} saved financial statement${count === 1 ? "" : "s"}. Changing the entity type will hide the Financial Statements tab. The records will be retained and will reappear if the entity type is changed back.`;
}

export function formatMoney(v: any): string {
  const n = num(v);
  if (n == null) return "";
  return money(n);
}

export function yoyPercent(current: any, prior: any): number | null {
  const c = num(current);
  const p = num(prior);
  if (c == null || p == null || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}
