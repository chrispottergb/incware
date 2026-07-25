import { useRef, useState } from "react";
import { ExternalLink, Eye, EyeOff, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface StateCharitableRegistrationValues {
  state_registration_required: string | null;
  registration_number: string | null;
  pin: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  annual_renewal_due_date: string | null;
  registration_status: string | null;
  registration_certificate_path: string | null;
}

interface Props {
  values: StateCharitableRegistrationValues;
  onChange: (patch: Partial<StateCharitableRegistrationValues>) => void;
  onUploadFile: (file: File) => Promise<void> | void;
  onViewFile: (path: string) => void;
}

const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  Expired: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  Pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  "Not Required": "bg-muted text-muted-foreground border-border",
};

function suggestJuly31(): string {
  const today = new Date();
  const year = today.getMonth() > 6 || (today.getMonth() === 6 && today.getDate() > 31)
    ? today.getFullYear() + 1
    : today.getFullYear();
  return `${year}-07-31`;
}

function DateWithClear({
  value,
  onChange,
  onFocusEmpty,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  onFocusEmpty?: () => void;
}) {
  return (
    <div
      className="relative"
      onFocus={() => {
        if (!value && onFocusEmpty) onFocusEmpty();
      }}
    >
      <DatePickerField value={value ?? ""} onChange={(v) => onChange(v || null)} />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-9 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function StateCharitableRegistrationCard({
  values,
  onChange,
  onUploadFile,
  onViewFile,
}: Props) {
  const [showPin, setShowPin] = useState(false);
  const [pinLocal, setPinLocal] = useState(values.pin ?? "");
  const [credLocal, setCredLocal] = useState(values.registration_number ?? "");
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const status = values.registration_status ?? "";
  const filePath = values.registration_certificate_path;
  const derivedName =
    uploadedName ?? (filePath ? filePath.split("/").pop() ?? null : null);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">State Charitable Registration</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            State-level charitable solicitation registration. Wisconsin non-profits must file annually by July 31.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="shrink-0 h-9 gap-1.5"
        >
          <a
            href="https://dfi.wi.gov/Pages/BusinessServices/CharitableProfessionalOrganizations/UserLogin.aspx"
            target="_blank"
            rel="noopener noreferrer"
          >
            WDFI Charitable Org Login
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              State Registration Required
            </Label>
            <Select
              value={values.state_registration_required ?? "Yes"}
              onValueChange={(v) => onChange({ state_registration_required: v })}
            >
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              Credential Number
            </Label>
            <Input
              className="h-10 rounded-lg"
              placeholder="e.g. 18871-800"
              value={credLocal}
              onChange={(e) => setCredLocal(e.target.value)}
              onBlur={(e) => onChange({ registration_number: e.target.value || null })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">PIN#</Label>
            <div className="relative">
              <Input
                type={showPin ? "text" : "password"}
                className="h-10 rounded-lg pr-9"
                placeholder="e.g. 4821"
                value={pinLocal}
                onChange={(e) => setPinLocal(e.target.value)}
                onBlur={(e) => onChange({ pin: e.target.value || null })}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              Registration Date
            </Label>
            <DateWithClear
              value={values.registration_date}
              onChange={(v) => onChange({ registration_date: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              Expiration Date
            </Label>
            <DateWithClear
              value={values.expiration_date}
              onChange={(v) => onChange({ expiration_date: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-muted-foreground">
              Annual Renewal Due Date
            </Label>
            <DateWithClear
              value={values.annual_renewal_due_date}
              onChange={(v) => onChange({ annual_renewal_due_date: v })}
              onFocusEmpty={() => onChange({ annual_renewal_due_date: suggestJuly31() })}
            />
          </div>
        </div>

        {/* Row 3 */}
        <div className="max-w-[280px] space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Registration Status
            </Label>
            {status && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  STATUS_STYLES[status] ?? "bg-muted text-muted-foreground border-border"
                )}
              >
                {status}
              </span>
            )}
          </div>
          <Select
            value={status}
            onValueChange={(v) => onChange({ registration_status: v })}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Not Required">Not Required</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 4 */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-muted-foreground">
            Upload Registration Certificate
          </Label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  await onUploadFile(f);
                  setUploadedName(f.name);
                  setUploadedAt(new Date());
                }
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-lg gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Choose File
            </Button>
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {derivedName ?? "No file chosen"}
            </span>
            {filePath && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 rounded-lg gap-1.5"
                onClick={() => onViewFile(filePath)}
              >
                <FileText className="h-4 w-4" />
                View
              </Button>
            )}
          </div>
          {derivedName && (
            <p className="text-xs text-muted-foreground">
              Uploaded: {derivedName}
              {uploadedAt && ` · ${uploadedAt.toLocaleDateString()}`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default StateCharitableRegistrationCard;
