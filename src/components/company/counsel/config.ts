import type { FirmType, ContactType } from "@/hooks/useMasterDirectory";

export const ACCOUNTING_SERVICES = [
  "Tax Preparation & Planning",
  "Bookkeeping",
  "Payroll Services",
  "Audit & Assurance",
  "Financial Statement Preparation",
  "Business Advisory",
  "Estate & Trust Planning",
  "Forensic Accounting",
  "Cost Accounting",
  "Management Consulting",
  "IRS Representation",
  "Business Valuation",
  "Succession Planning",
  "Nonprofit Accounting",
  "International Tax",
  "Sales Tax Compliance",
  "Cash Flow Management",
  "Budgeting & Forecasting",
  "Controller Services",
  "CFO Services",
];

export const LEGAL_SERVICES = [
  "Corporate Law",
  "Real Estate",
  "Litigation",
  "Estate Planning & Trusts",
  "Tax Law",
  "Employment & Labor Law",
  "Intellectual Property",
  "Mergers & Acquisitions",
  "Bankruptcy & Restructuring",
  "Securities & Capital Markets",
  "Immigration",
  "Environmental Law",
  "Healthcare Law",
  "Government Relations",
  "Contract Drafting & Review",
  "Regulatory Compliance",
  "Business Formation",
  "Commercial Transactions",
];

export interface CounselConfig {
  key: "attorney" | "accountant";
  /** Plural category heading, e.g. "Attorneys" */
  categoryLabel: string;
  /** Lowercase singular, e.g. "attorney" */
  personLabel: string;
  /** Capitalized singular, e.g. "Attorney" */
  personLabelTitle: string;
  firmTable: "attorney_firms" | "accountant_firms";
  personTable: "attorneys" | "accountants";
  nameColumn: "attorney_name" | "accountant_name";
  licenseColumn: "bar_number" | "cpa_number";
  /** Optional-license field label, e.g. "Bar number" */
  licenseLabel: string;
  /** Short prefix used in list rows, e.g. "Bar #" */
  licensePrefix: string;
  /** Firm type shown as the card subtitle; fixed at creation, not editable */
  firmTypeLabel: string;
  masterFirmType: FirmType;
  masterContactType: ContactType;
  serviceOptions: string[];
}

export const ATTORNEY_CONFIG: CounselConfig = {
  key: "attorney",
  categoryLabel: "Attorneys",
  personLabel: "attorney",
  personLabelTitle: "Attorney",
  firmTable: "attorney_firms",
  personTable: "attorneys",
  nameColumn: "attorney_name",
  licenseColumn: "bar_number",
  licenseLabel: "Bar number",
  licensePrefix: "Bar #",
  firmTypeLabel: "Law firm",
  masterFirmType: "law",
  masterContactType: "attorney",
  serviceOptions: LEGAL_SERVICES,
};

export const ACCOUNTANT_CONFIG: CounselConfig = {
  key: "accountant",
  categoryLabel: "Accountants",
  personLabel: "accountant",
  personLabelTitle: "Accountant",
  firmTable: "accountant_firms",
  personTable: "accountants",
  nameColumn: "accountant_name",
  licenseColumn: "cpa_number",
  licenseLabel: "CPA number",
  licensePrefix: "CPA #",
  firmTypeLabel: "Accounting firm",
  masterFirmType: "accounting",
  masterContactType: "accountant",
  serviceOptions: ACCOUNTING_SERVICES,
};

export const emptyFirmForm = () => ({
  firm_name: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  website: "",
});

export type FirmForm = ReturnType<typeof emptyFirmForm>;

export const emptyPersonForm = () => ({
  name: "",
  title: "",
  license: "",
  email: "",
  phone: "",
  specialty: "",
  notes: "",
});

export type PersonForm = ReturnType<typeof emptyPersonForm>;
