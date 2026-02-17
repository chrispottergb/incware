import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import MDBReader from "mdb-reader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Upload,
  Database,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  TableIcon,
  Columns3,
  AlertCircle,
  XCircle,
  Eye,
  Lock,
  Info,
} from "lucide-react";

// Target fields grouped by destination table
const TARGET_FIELDS: Record<string, { label: string; fields: { key: string; label: string }[] }> = {
  company: {
    label: "Company Info",
    fields: [
      { key: "company.name", label: "Company Name" },
      { key: "company.entity_type", label: "Entity Type" },
      { key: "company.state_of_incorporation", label: "State of Inc." },
      { key: "company.address", label: "Address" },
      { key: "company.city", label: "City" },
      { key: "company.state", label: "State" },
      { key: "company.zip", label: "ZIP" },
      { key: "company.phone", label: "Phone" },
      { key: "company.incorporation_date", label: "Inc. Date" },
      { key: "company.fiscal_year_end", label: "Fiscal Year End" },
      { key: "company.business_purpose", label: "Business Purpose" },
      { key: "company.accounting_method", label: "Accounting Method" },
      { key: "company.sic_code", label: "SIC Code" },
      { key: "company.authorized_shares", label: "Authorized Shares" },
      { key: "company.par_value", label: "Par Value" },
      { key: "company.registered_agent_name", label: "Reg. Agent Name" },
      { key: "company.registered_agent_address", label: "Reg. Agent Address" },
      { key: "company.registered_agent_city", label: "Reg. Agent City" },
      { key: "company.registered_agent_state", label: "Reg. Agent State" },
      { key: "company.registered_agent_zip", label: "Reg. Agent ZIP" },
    ],
  },
  shareholders: {
    label: "Shareholders / Members",
    fields: [
      { key: "shareholder.name", label: "Shareholder Name" },
      { key: "shareholder.address", label: "Address" },
      { key: "shareholder.city", label: "City" },
      { key: "shareholder.state", label: "State" },
      { key: "shareholder.zip", label: "ZIP" },
      { key: "shareholder.ssn_ein", label: "SSN / EIN" },
    ],
  },
  directors: {
    label: "Directors",
    fields: [
      { key: "director.name", label: "Director Name" },
      { key: "director.address", label: "Address" },
      { key: "director.city", label: "City" },
      { key: "director.state", label: "State" },
      { key: "director.zip", label: "ZIP" },
    ],
  },
  officers: {
    label: "Officers",
    fields: [
      { key: "officer.president", label: "President" },
      { key: "officer.vice_president", label: "Vice President" },
      { key: "officer.secretary", label: "Secretary" },
      { key: "officer.treasurer", label: "Treasurer" },
    ],
  },
  meetings: {
    label: "Meetings",
    fields: [
      { key: "meeting.date", label: "Meeting Date" },
      { key: "meeting.type", label: "Meeting Type" },
      { key: "meeting.sub_type", label: "Sub Type" },
      { key: "meeting.tax_year", label: "Tax Year" },
      { key: "meeting.location", label: "Location" },
      { key: "meeting.chairperson", label: "Chairperson" },
      { key: "meeting.secretary", label: "Secretary" },
    ],
  },
  mtg_officers: {
    label: "Meeting Officers",
    fields: [
      { key: "mtg_officer.title", label: "Title" },
      { key: "mtg_officer.name", label: "Name" },
      { key: "mtg_officer.salary", label: "Salary" },
      { key: "mtg_officer.bonus", label: "Bonus" },
    ],
  },
  mtg_directors: {
    label: "Meeting Directors",
    fields: [
      { key: "mtg_director.name", label: "Director Name" },
    ],
  },
  mtg_shareholders: {
    label: "Meeting Shareholders",
    fields: [
      { key: "mtg_shareholder.name", label: "Name" },
      { key: "mtg_shareholder.common_shares", label: "Common Shares" },
      { key: "mtg_shareholder.preferred_shares", label: "Preferred Shares" },
      { key: "mtg_shareholder.distribution", label: "Distribution" },
    ],
  },
  benefits: {
    label: "Benefits",
    fields: [
      { key: "benefit.type", label: "Benefit Type" },
      { key: "benefit.provider", label: "Provider" },
      { key: "benefit.agent", label: "Agent/Admin" },
      { key: "benefit.agency", label: "Insurance Agency" },
      { key: "benefit.transaction_type", label: "Transaction Type" },
      { key: "benefit.plan_year", label: "Plan Year" },
      { key: "benefit.effective_date", label: "Effective Date" },
      { key: "benefit.contribution", label: "Contribution" },
      { key: "benefit.eligibility", label: "Eligibility" },
    ],
  },
  amendments: {
    label: "Amendments",
    fields: [
      { key: "amendment.type", label: "Amendment Type" },
      { key: "amendment.text", label: "Amendment Text" },
    ],
  },
  resolutions: {
    label: "Resolutions",
    fields: [
      { key: "resolution.purpose", label: "Purpose" },
      { key: "resolution.text", label: "Resolution Text" },
    ],
  },
  loans: {
    label: "Loans",
    fields: [
      { key: "loan.type", label: "Loan Type" },
      { key: "loan.rate", label: "Rate" },
      { key: "loan.amount", label: "Amount" },
      { key: "loan.date", label: "Date" },
    ],
  },
  agreements: {
    label: "Agreements",
    fields: [
      { key: "agreement.type", label: "Agreement Type" },
      { key: "agreement.date", label: "Date" },
      { key: "agreement.with", label: "With" },
      { key: "agreement.purpose", label: "Purpose" },
    ],
  },
  auth_signers: {
    label: "Auth Signers",
    fields: [
      { key: "auth_signer.name", label: "Signer Name" },
      { key: "auth_signer.title", label: "Title" },
      { key: "auth_signer.bank", label: "Bank" },
    ],
  },
  banks: {
    label: "Banks",
    fields: [
      { key: "bank.name", label: "Bank Name" },
      { key: "bank.address", label: "Address" },
      { key: "bank.city", label: "City" },
      { key: "bank.state", label: "State" },
      { key: "bank.zip", label: "ZIP" },
      { key: "bank.account_number", label: "Account #" },
      { key: "bank.routing_number", label: "Routing #" },
      { key: "bank.account_type", label: "Account Type" },
    ],
  },
  atty_firms: {
    label: "Attorney Firms",
    fields: [
      { key: "atty_firm.name", label: "Firm Name" },
      { key: "atty_firm.address", label: "Address" },
      { key: "atty_firm.city", label: "City" },
      { key: "atty_firm.state", label: "State" },
      { key: "atty_firm.zip", label: "ZIP" },
      { key: "atty_firm.phone", label: "Phone" },
      { key: "atty_firm.email", label: "Email" },
    ],
  },
  attorneys: {
    label: "Attorneys",
    fields: [
      { key: "attorney.name", label: "Attorney Name" },
      { key: "attorney.bar_number", label: "Bar Number" },
      { key: "attorney.specialty", label: "Specialty" },
      { key: "attorney.phone", label: "Phone" },
      { key: "attorney.email", label: "Email" },
    ],
  },
  acct_firms: {
    label: "Accountant Firms",
    fields: [
      { key: "acct_firm.name", label: "Firm Name" },
      { key: "acct_firm.address", label: "Address" },
      { key: "acct_firm.city", label: "City" },
      { key: "acct_firm.state", label: "State" },
      { key: "acct_firm.zip", label: "ZIP" },
      { key: "acct_firm.phone", label: "Phone" },
      { key: "acct_firm.email", label: "Email" },
    ],
  },
  accountants: {
    label: "Accountants",
    fields: [
      { key: "accountant.name", label: "Accountant Name" },
      { key: "accountant.cpa_number", label: "CPA Number" },
      { key: "accountant.specialty", label: "Specialty" },
      { key: "accountant.phone", label: "Phone" },
      { key: "accountant.email", label: "Email" },
    ],
  },
  vehicles: {
    label: "Vehicles",
    fields: [
      { key: "vehicle.year", label: "Year" },
      { key: "vehicle.make", label: "Make" },
      { key: "vehicle.model", label: "Model" },
      { key: "vehicle.vin", label: "VIN" },
      { key: "vehicle.cost", label: "Cost" },
      { key: "vehicle.ownership_type", label: "Ownership" },
      { key: "vehicle.purchase_date", label: "Purchase Date" },
      { key: "vehicle.purchase_amount", label: "Purchase Amount" },
    ],
  },
  equipment: {
    label: "Equipment",
    fields: [
      { key: "equipment.year", label: "Year" },
      { key: "equipment.make", label: "Make" },
      { key: "equipment.model", label: "Model" },
      { key: "equipment.manufacturer", label: "Manufacturer" },
      { key: "equipment.running_hours", label: "Running Hours" },
      { key: "equipment.ownership_type", label: "Ownership" },
    ],
  },
  leases: {
    label: "Leases",
    fields: [
      { key: "lease.description", label: "Description" },
      { key: "lease.value", label: "Value" },
      { key: "lease.address", label: "Address" },
    ],
  },
  property: {
    label: "Property",
    fields: [
      { key: "property.address", label: "Address" },
      { key: "property.finance_company", label: "Finance Company" },
      { key: "property.escrow", label: "Escrow" },
      { key: "property.mortgage", label: "Mortgage" },
      { key: "property.taxes", label: "Taxes" },
    ],
  },
  certificates: {
    label: "Stock Certificates",
    fields: [
      { key: "certificate.number", label: "Cert. Number" },
      { key: "certificate.share_class", label: "Share Class" },
      { key: "certificate.num_shares", label: "Shares" },
      { key: "certificate.issue_date", label: "Issue Date" },
      { key: "certificate.status", label: "Status" },
    ],
  },
  transactions: {
    label: "Share Transactions",
    fields: [
      { key: "transaction.type", label: "Type" },
      { key: "transaction.date", label: "Date" },
      { key: "transaction.from", label: "From" },
      { key: "transaction.to", label: "To" },
      { key: "transaction.shares", label: "Shares" },
      { key: "transaction.share_class", label: "Share Class" },
      { key: "transaction.price_per_share", label: "Price/Share" },
    ],
  },
  bills_of_sale: {
    label: "Bills of Sale",
    fields: [
      { key: "bill.seller", label: "Seller" },
      { key: "bill.buyer", label: "Buyer" },
      { key: "bill.date", label: "Date" },
      { key: "bill.shares", label: "Shares" },
      { key: "bill.share_class", label: "Share Class" },
      { key: "bill.price_per_share", label: "Price/Share" },
      { key: "bill.total_price", label: "Total Price" },
    ],
  },
  timeline: {
    label: "Timeline",
    fields: [
      { key: "timeline.date", label: "Event Date" },
      { key: "timeline.title", label: "Event Title" },
      { key: "timeline.description", label: "Description" },
    ],
  },
};

const ALL_TARGET_OPTIONS = Object.values(TARGET_FIELDS).flatMap((g) =>
  g.fields.map((f) => ({ value: f.key, label: `${g.label} → ${f.label}` }))
);

type Step = "upload" | "tables" | "mapping" | "preview" | "importing" | "done";

interface AccessTable {
  name: string;
  columns: string[];
  rowCount: number;
  data: Record<string, unknown>[];
}

interface ColumnMapping {
  sourceTable: string;
  sourceColumn: string;
  targetField: string;
}

interface DbDiagnostics {
  userTableCount: number;
  systemTableCount: number;
  creationDate?: string;
}

export default function ImportAccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [tables, setTables] = useState<AccessTable[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [previewTable, setPreviewTable] = useState<string | null>(null);

  // New state for password & diagnostics
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [dbPassword, setDbPassword] = useState("");
  const [pendingBuffer, setPendingBuffer] = useState<ArrayBuffer | null>(null);
  const [diagnostics, setDiagnostics] = useState<DbDiagnostics | null>(null);
  const [showSystemTables, setShowSystemTables] = useState(false);
  const [allTables, setAllTables] = useState<AccessTable[]>([]);

  const parseAccessFile = useCallback((buffer: ArrayBuffer, password?: string) => {
    try {
      const options: any = {};
      if (password) options.password = password;
      const reader = new MDBReader(Buffer.from(buffer), options);

      const allTableNames = reader.getTableNames();
      const systemTableNames = allTableNames.filter(
        (n) => n.startsWith("MSys") || n.startsWith("~")
      );
      const userTableNames = allTableNames.filter(
        (n) => !n.startsWith("MSys") && !n.startsWith("~")
      );

      // Get creation date if available
      let creationDate: string | undefined;
      try {
        const d = (reader as any).getCreationDate?.();
        if (d) creationDate = new Date(d).toLocaleDateString();
      } catch {}

      setDiagnostics({
        userTableCount: userTableNames.length,
        systemTableCount: systemTableNames.length,
        creationDate,
      });

      // Parse all tables (user + system) for the system table toggle
      const parsedAll: AccessTable[] = allTableNames.map((name) => {
        try {
          const table = reader.getTable(name);
          const columns = table.getColumnNames();
          const data = table.getData({ columns, rowLimit: 5000 }) as Record<string, unknown>[];
          return { name, columns, rowCount: data.length, data };
        } catch {
          return { name, columns: [], rowCount: 0, data: [] };
        }
      });

      const parsedUser = parsedAll.filter(
        (t) => !t.name.startsWith("MSys") && !t.name.startsWith("~")
      );

      setAllTables(parsedAll);
      setTables(parsedUser);
      setSelectedTables(new Set(parsedUser.filter((t) => t.rowCount > 0).map((t) => t.name)));

      if (userTableNames.length === 0) {
        if (systemTableNames.length > 0) {
          toast.warning(
            `No user tables found. The database contains ${systemTableNames.length} system table(s) only. Try enabling "Show system tables" or check if the file is password-protected.`
          );
        } else {
          toast.error(
            "No tables found. The file may be corrupted or in an unsupported format."
          );
        }
        // Still show the tables step so user can toggle system tables
        setStep("tables");
        return;
      }

      setStep("tables");
      toast.success(`Loaded ${parsedUser.length} tables from ${fileName}`);
    } catch (err: any) {
      console.error(err);
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("password") || msg.includes("encrypt") || msg.includes("credentials")) {
        toast.error("This database appears to be password-protected.");
        setPendingBuffer(buffer);
        setShowPasswordDialog(true);
      } else {
        toast.error(`Failed to parse Access file: ${err.message}`);
      }
    }
  }, [fileName]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".accdb") && !ext.endsWith(".mdb")) {
      toast.error("Please upload a .accdb or .mdb file");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("File must be under 500MB");
      return;
    }

    setFileName(file.name);
    setStep("upload");
    setDiagnostics(null);
    setShowSystemTables(false);

    const buffer = await file.arrayBuffer();
    setPendingBuffer(buffer);
    parseAccessFile(buffer);
  }, [parseAccessFile]);

  const handlePasswordSubmit = () => {
    if (!pendingBuffer) return;
    setShowPasswordDialog(false);
    parseAccessFile(pendingBuffer, dbPassword);
    setDbPassword("");
  };

  // Toggle between showing user tables only vs all tables
  const displayedTables = showSystemTables ? allTables : tables;

  const autoMapColumns = useCallback(() => {
    const newMappings: ColumnMapping[] = [];
    const keywords: Record<string, string> = {
      "company_name": "company.name", "companyname": "company.name", "corp_name": "company.name", "client_name": "company.name", "clientname": "company.name", "name": "company.name",
      "entity_type": "company.entity_type", "entitytype": "company.entity_type", "type": "company.entity_type",
      "state_of_inc": "company.state_of_incorporation", "inc_state": "company.state_of_incorporation", "stateofincorporation": "company.state_of_incorporation",
      "address": "company.address", "street": "company.address", "address1": "company.address",
      "city": "company.city",
      "state": "company.state",
      "zip": "company.zip", "zipcode": "company.zip", "zip_code": "company.zip", "postal": "company.zip",
      "phone": "company.phone", "telephone": "company.phone",
      "inc_date": "company.incorporation_date", "incorporation_date": "company.incorporation_date", "date_incorporated": "company.incorporation_date",
      "fiscal_year": "company.fiscal_year_end", "fye": "company.fiscal_year_end",
      "business_purpose": "company.business_purpose", "purpose": "company.business_purpose",
      "sic": "company.sic_code", "sic_code": "company.sic_code",
      "authorized_shares": "company.authorized_shares", "shares_authorized": "company.authorized_shares",
      "par_value": "company.par_value",
      "reg_agent": "company.registered_agent_name", "registered_agent": "company.registered_agent_name",
      "shareholder_name": "shareholder.name", "stockholder": "shareholder.name", "member_name": "shareholder.name",
      "ssn": "shareholder.ssn_ein", "ein": "shareholder.ssn_ein", "ssn_ein": "shareholder.ssn_ein", "tax_id": "shareholder.ssn_ein",
      "director_name": "director.name", "director": "director.name",
      "president": "officer.president",
      "vice_president": "officer.vice_president", "vp": "officer.vice_president",
      "secretary": "officer.secretary",
      "treasurer": "officer.treasurer",
    };

    for (const tableName of selectedTables) {
      const table = (showSystemTables ? allTables : tables).find((t) => t.name === tableName);
      if (!table) continue;
      for (const col of table.columns) {
        const normalized = col.toLowerCase().replace(/[\s\-_]+/g, "_").replace(/[^a-z0-9_]/g, "");
        const match = keywords[normalized];
        if (match) {
          if (!newMappings.some((m) => m.targetField === match)) {
            newMappings.push({ sourceTable: tableName, sourceColumn: col, targetField: match });
          }
        }
      }
    }

    setMappings(newMappings);
  }, [selectedTables, tables, allTables, showSystemTables]);

  const handleProceedToMapping = () => {
    autoMapColumns();
    setStep("mapping");
  };

  const updateMapping = (index: number, targetField: string) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, targetField } : m))
    );
  };

  const removeMapping = (index: number) => {
    setMappings((prev) => prev.filter((_, i) => i !== index));
  };

  const addMapping = (sourceTable: string, sourceColumn: string) => {
    setMappings((prev) => [...prev, { sourceTable, sourceColumn, targetField: "" }]);
  };

  const handleImport = async () => {
    if (!user) { toast.error("Please log in first"); return; }
    setStep("importing");
    setImporting(true);
    setImportProgress(0);
    setImportedCount(0);

    try {
      const companyMappings = mappings.filter((m) => m.targetField.startsWith("company."));
      const shareholderMappings = mappings.filter((m) => m.targetField.startsWith("shareholder."));
      const directorMappings = mappings.filter((m) => m.targetField.startsWith("director."));
      const officerMappings = mappings.filter((m) => m.targetField.startsWith("officer."));

      const companyNameMapping = companyMappings.find((m) => m.targetField === "company.name");
      if (!companyNameMapping) {
        toast.error("You must map at least a Company Name field");
        setStep("mapping");
        setImporting(false);
        return;
      }

      const activeTables = showSystemTables ? allTables : tables;
      const mainTable = activeTables.find((t) => t.name === companyNameMapping.sourceTable);
      if (!mainTable) {
        toast.error("Source table not found");
        setStep("mapping");
        setImporting(false);
        return;
      }

      const totalRows = mainTable.data.length;
      let imported = 0;

      for (let i = 0; i < mainTable.data.length; i++) {
        const row = mainTable.data[i];

        const companyRecord: Record<string, unknown> = { user_id: user.id };
        for (const m of companyMappings) {
          const field = m.targetField.replace("company.", "");
          const val = m.sourceTable === mainTable.name
            ? row[m.sourceColumn]
            : activeTables.find((t) => t.name === m.sourceTable)?.data[i]?.[m.sourceColumn];
          if (val !== null && val !== undefined && val !== "") {
            companyRecord[field] = String(val);
          }
        }

        if (!companyRecord.name) continue;
        if (!companyRecord.entity_type) companyRecord.entity_type = "Corporation";

        const { data: newComp, error: compErr } = await supabase
          .from("companies")
          .insert(companyRecord as any)
          .select("id")
          .single();

        if (compErr) {
          console.error(`Row ${i}: ${compErr.message}`);
          continue;
        }

        const companyId = newComp.id;

        if (shareholderMappings.length > 0) {
          const shNameMapping = shareholderMappings.find((m) => m.targetField === "shareholder.name");
          if (shNameMapping) {
            const shTable = activeTables.find((t) => t.name === shNameMapping.sourceTable);
            if (shTable) {
              const shRows = shNameMapping.sourceTable === mainTable.name ? [row] : shTable.data;
              for (const shRow of shRows) {
                const shRecord: Record<string, unknown> = { company_id: companyId };
                for (const m of shareholderMappings) {
                  const field = m.targetField.replace("shareholder.", "");
                  const val = shRow[m.sourceColumn];
                  if (val !== null && val !== undefined && val !== "") {
                    shRecord[field] = String(val);
                  }
                }
                if (shRecord.name) {
                  await supabase.from("shareholders").insert(shRecord as any);
                }
              }
            }
          }
        }

        if (directorMappings.length > 0) {
          const dirNameMapping = directorMappings.find((m) => m.targetField === "director.name");
          if (dirNameMapping) {
            const dirTable = activeTables.find((t) => t.name === dirNameMapping.sourceTable);
            if (dirTable) {
              const dirRows = dirNameMapping.sourceTable === mainTable.name ? [row] : dirTable.data;
              for (const dirRow of dirRows) {
                const dirRecord: Record<string, unknown> = { company_id: companyId };
                for (const m of directorMappings) {
                  const field = m.targetField.replace("director.", "");
                  const val = dirRow[m.sourceColumn];
                  if (val !== null && val !== undefined && val !== "") {
                    dirRecord[field] = String(val);
                  }
                }
                if (dirRecord.name) {
                  await supabase.from("directors").insert(dirRecord as any);
                }
              }
            }
          }
        }

        if (officerMappings.length > 0) {
          const officerRecord: Record<string, unknown> = { company_id: companyId };
          for (const m of officerMappings) {
            const field = m.targetField.replace("officer.", "");
            const val = m.sourceTable === mainTable.name
              ? row[m.sourceColumn]
              : activeTables.find((t) => t.name === m.sourceTable)?.data[i]?.[m.sourceColumn];
            if (val !== null && val !== undefined && val !== "") {
              officerRecord[field] = String(val);
            }
          }
          if (Object.keys(officerRecord).length > 1) {
            await supabase.from("officers").insert(officerRecord as any);
          }
        }

        imported++;
        setImportProgress(((i + 1) / totalRows) * 100);
        setImportedCount(imported);
      }

      queryClient.invalidateQueries({ queryKey: ["companies"] });
      setStep("done");
      toast.success(`Successfully imported ${imported} companies!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Import failed");
      setStep("mapping");
    } finally {
      setImporting(false);
    }
  };

  const previewData = previewTable ? displayedTables.find((t) => t.name === previewTable) : null;

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password-Protected Database
            </DialogTitle>
            <DialogDescription>
              This Access database appears to be password-protected. Enter the password to decrypt and read the file.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="db-password" className="text-sm">Database Password</Label>
            <Input
              id="db-password"
              type="password"
              value={dbPassword}
              onChange={(e) => setDbPassword(e.target.value)}
              placeholder="Enter database password…"
              className="mt-1.5"
              onKeyDown={(e) => { if (e.key === "Enter") handlePasswordSubmit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordDialog(false); setDbPassword(""); }}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={!dbPassword}>
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Unlock & Parse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Import from Access Database</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Upload a .accdb or .mdb file to import client data</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {[
          { key: "upload", label: "Upload" },
          { key: "tables", label: "Select Tables" },
          { key: "mapping", label: "Map Fields" },
          { key: "preview", label: "Preview" },
          { key: "importing", label: "Import" },
        ].map((s, i, arr) => {
          const stepOrder = ["upload", "tables", "mapping", "preview", "importing", "done"];
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx = stepOrder.indexOf(s.key);
          const isActive = thisIdx === currentIdx;
          const isDone = thisIdx < currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${
                isActive ? "bg-primary text-primary-foreground" :
                isDone ? "bg-success/10 text-success" :
                "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <CheckCircle2 className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}
                {s.label}
              </div>
              {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div
          className="border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer border-border hover:border-primary/30 hover:bg-muted/30"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".accdb,.mdb"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <div className="flex flex-col items-center gap-4">
            <Database className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">Drop your Access database here or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .accdb and .mdb files (Access 97–2019, all versions)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step: Select Tables */}
      {step === "tables" && (
        <div className="space-y-4">
          {/* Diagnostics info */}
          {diagnostics && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 border text-xs">
              <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium">Database Info</p>
                {diagnostics.creationDate && (
                  <p className="text-muted-foreground">Created: {diagnostics.creationDate}</p>
                )}
                <p className="text-muted-foreground">
                  Tables: {diagnostics.userTableCount} user / {diagnostics.systemTableCount} system
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TableIcon className="h-4 w-4 text-primary" />
                  Tables Found in {fileName}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-system"
                    checked={showSystemTables}
                    onCheckedChange={(checked) => setShowSystemTables(checked === true)}
                  />
                  <Label htmlFor="show-system" className="text-xs text-muted-foreground cursor-pointer">
                    Include system tables
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {displayedTables.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">No tables found in this file.</p>
                  <p className="text-xs text-muted-foreground">
                    The file may be corrupted, empty, or password-protected.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      if (pendingBuffer) {
                        setShowPasswordDialog(true);
                      } else {
                        setStep("upload");
                      }
                    }}
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Try with Password
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select the tables that contain your client data. Deselect system or irrelevant tables.
                  </p>
                  {displayedTables.map((t) => {
                    const isSystem = t.name.startsWith("MSys") || t.name.startsWith("~");
                    return (
                      <div key={t.name} className={`flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors ${isSystem ? "opacity-60" : ""}`}>
                        <input
                          type="checkbox"
                          checked={selectedTables.has(t.name)}
                          onChange={(e) => {
                            const next = new Set(selectedTables);
                            if (e.target.checked) next.add(t.name);
                            else next.delete(t.name);
                            setSelectedTables(next);
                          }}
                          className="rounded border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {t.name}
                            {isSystem && (
                              <Badge variant="outline" className="ml-2 text-[9px] py-0">system</Badge>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {t.columns.length} columns · {t.rowCount} rows
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPreviewTable(previewTable === t.name ? null : t.name)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> Preview
                        </Button>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>

          {/* Table preview */}
          {previewData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-primary" />
                  Preview: {previewData.name} (first 10 rows)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.columns.map((col) => (
                          <TableHead key={col} className="text-[10px] whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.data.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          {previewData.columns.map((col) => (
                            <TableCell key={col} className="text-[11px] whitespace-nowrap max-w-[200px] truncate">
                              {row[col] != null ? String(row[col]) : <span className="text-muted-foreground/40">null</span>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setStep("upload"); setTables([]); setAllTables([]); setDiagnostics(null); }}>
              Back
            </Button>
            <Button onClick={handleProceedToMapping} disabled={selectedTables.size === 0}>
              Continue to Mapping <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Map Fields */}
      {step === "mapping" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Columns3 className="h-4 w-4 text-primary" />
                Map Access Columns to EntityIQ Fields
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                We auto-detected some mappings. Adjust as needed. Unmapped columns will be skipped.
              </p>

              {mappings.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="shrink-0 text-[10px]">{m.sourceTable}</Badge>
                  <span className="font-medium truncate min-w-0">{m.sourceColumn}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Select value={m.targetField} onValueChange={(v) => updateMapping(idx, v)}>
                    <SelectTrigger className="h-7 text-xs w-56">
                      <SelectValue placeholder="Select target field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_TARGET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeMapping(idx)}>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              <Accordion type="multiple" className="mt-4">
                {Array.from(selectedTables).map((tableName) => {
                  const table = displayedTables.find((t) => t.name === tableName);
                  if (!table) return null;
                  const unmapped = table.columns.filter(
                    (col) => !mappings.some((m) => m.sourceTable === tableName && m.sourceColumn === col)
                  );
                  if (unmapped.length === 0) return null;
                  return (
                    <AccordionItem key={tableName} value={tableName}>
                      <AccordionTrigger className="text-xs py-2">
                        Unmapped from "{tableName}" ({unmapped.length} columns)
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-1">
                          {unmapped.map((col) => (
                            <div key={col} className="flex items-center gap-2 text-xs pl-2">
                              <span className="text-muted-foreground truncate flex-1">{col}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px]"
                                onClick={() => addMapping(tableName, col)}
                              >
                                + Map
                              </Button>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 pt-2 border-t">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              {mappings.filter((m) => m.targetField).length} fields mapped. At minimum, map "Company Name" to proceed.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setStep("tables")}>Back</Button>
            <Button variant="outline" onClick={autoMapColumns}>Re-detect Mappings</Button>
            <Button
              onClick={() => setStep("preview")}
              disabled={!mappings.some((m) => m.targetField === "company.name")}
            >
              Preview Import <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (() => {
        const companyNameMapping = mappings.find((m) => m.targetField === "company.name");
        const activeTables = showSystemTables ? allTables : tables;
        const mainTable = companyNameMapping ? activeTables.find((t) => t.name === companyNameMapping.sourceTable) : null;
        const previewRows = mainTable?.data.slice(0, 5) || [];

        return (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Import Preview — {mainTable?.data.length || 0} companies will be created
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Showing first 5 records. Review the mapped data before importing.
                </p>
                {previewRows.map((row, i) => {
                  const name = companyNameMapping ? String(row[companyNameMapping.sourceColumn] || "—") : "—";
                  return (
                    <div key={i} className="border rounded-md p-3 space-y-1.5 text-xs">
                      <p className="font-medium text-sm">{name}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {mappings.filter((m) => m.targetField && m.targetField !== "company.name").map((m) => {
                          const val = m.sourceTable === mainTable?.name
                            ? row[m.sourceColumn]
                            : null;
                          const label = ALL_TARGET_OPTIONS.find((o) => o.value === m.targetField)?.label || m.targetField;
                          return (
                            <p key={m.targetField}>
                              <span className="text-muted-foreground">{label}:</span>{" "}
                              {val != null && val !== "" ? String(val) : "—"}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("mapping")}>Back</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-1.5" />
                Import {mainTable?.data.length || 0} Companies
              </Button>
            </div>
          </div>
        );
      })()}

      {/* Step: Importing */}
      {step === "importing" && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Importing companies…</p>
            <Progress value={importProgress} className="w-64 h-2" />
            <p className="text-xs text-muted-foreground">{importedCount} imported so far</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm font-medium">Import Complete!</p>
            <p className="text-xs text-muted-foreground">{importedCount} companies imported successfully.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/")}>
                Go to Dashboard
              </Button>
              <Button onClick={() => { setStep("upload"); setTables([]); setAllTables([]); setMappings([]); setFileName(""); setDiagnostics(null); }}>
                Import Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
