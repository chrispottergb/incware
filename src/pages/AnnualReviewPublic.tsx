import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Building2, Users, UserCheck, Shield, Landmark,
  Car, Wrench, HandCoins, ArrowRightLeft, Home, HeartHandshake,
  BarChart3, Gift, CalendarCheck, DollarSign, FileText,
  CheckCircle2, Send, Plus, Trash2, AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ReviewData {
  link_id: string;
  company_name: string;
  review_year: number;
  snapshot: any;
}

// Helper for repeatable entry sections
function MultiEntrySection({
  title,
  icon: Icon,
  fields,
  entries,
  setEntries,
}: {
  title: string;
  icon: any;
  fields: { key: string; label: string; type?: string; options?: string[]; showIf?: (entry: any) => boolean; fullWidth?: boolean }[];
  entries: any[];
  setEntries: (entries: any[]) => void;
}) {
  const addEntry = () => {
    const blank: any = {};
    fields.forEach((f) => (blank[f.key] = f.type === "toggle" ? false : ""));
    setEntries([...entries, blank]);
  };

  const updateEntry = (idx: number, key: string, value: any) => {
    const updated = [...entries];
    updated[idx] = { ...updated[idx], [key]: value };
    setEntries(updated);
  };

  const removeEntry = (idx: number) => {
    setEntries(entries.filter((_, i) => i !== idx));
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.map((entry, idx) => (
          <div key={idx} className="relative border border-border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Entry {idx + 1}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeEntry(idx)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fields.map((f) => {
                if (f.showIf && !f.showIf(entry)) return null;

                if (f.type === "toggle") {
                  return (
                    <div key={f.key} className={`flex items-center gap-2 ${f.fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                      <Switch
                        checked={!!entry[f.key]}
                        onCheckedChange={(val) => updateEntry(idx, f.key, val)}
                      />
                      <Label className="text-xs">{f.label}</Label>
                    </div>
                  );
                }

                if (f.type === "textarea") {
                  return (
                    <div key={f.key} className="sm:col-span-2 lg:col-span-3 space-y-1">
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Textarea
                        value={entry[f.key] || ""}
                        onChange={(e) => updateEntry(idx, f.key, e.target.value)}
                        className="text-xs min-h-[60px]"
                      />
                    </div>
                  );
                }

                if (f.type === "select" && f.options) {
                  return (
                    <div key={f.key} className={`space-y-1 ${f.fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                      <Label className="text-xs text-muted-foreground">{f.label}</Label>
                      <Select
                        value={entry[f.key] || ""}
                        onValueChange={(val) => updateEntry(idx, f.key, val)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder={`Select ${f.label}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options.map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }

                return (
                  <div key={f.key} className={`space-y-1 ${f.fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                    <Label className="text-xs text-muted-foreground">{f.label}</Label>
                    <Input
                      type={f.type || "text"}
                      value={entry[f.key] || ""}
                      onChange={(e) => updateEntry(idx, f.key, e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addEntry} className="w-full">
          <Plus className="mr-2 h-3 w-3" />
          Add Another
        </Button>
      </CardContent>
    </Card>
  );
}

// Pre-populated info row with change flag
function CurrentInfoItem({
  label,
  value,
  changeFlag,
  changeNote,
  onToggle,
  onNoteChange,
}: {
  label: string;
  value: string;
  changeFlag: boolean;
  changeNote: string;
  onToggle: () => void;
  onNoteChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground block">{label}</span>
          <span className="text-sm text-foreground break-words">{value || "—"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <Checkbox
            checked={changeFlag}
            onCheckedChange={onToggle}
            className="h-3.5 w-3.5"
          />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">Change Needed</span>
        </div>
      </div>
      {changeFlag && (
        <Textarea
          placeholder="Describe the change needed..."
          value={changeNote}
          onChange={(e) => onNoteChange(e.target.value)}
          className="text-xs min-h-[50px] mt-1"
        />
      )}
    </div>
  );
}

export default function AnnualReviewPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<ReviewData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Change flags for pre-populated data
  const [changeFlags, setChangeFlags] = useState<Record<string, { flagged: boolean; note: string }>>({});

  // New entry sections state
  const [vehiclePurchases, setVehiclePurchases] = useState<any[]>([]);
  const [equipmentPurchases, setEquipmentPurchases] = useState<any[]>([]);
  const [newLoans, setNewLoans] = useState<any[]>([]);
  const [shareTransactions, setShareTransactions] = useState<any[]>([]);
  const [newLeases, setNewLeases] = useState<any[]>([]);
  const [newBenefits, setNewBenefits] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [charitableContributions, setCharitableContributions] = useState<any[]>([]);

  // Annual meeting section
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingAttendees, setMeetingAttendees] = useState("");
  const [hasResolutions, setHasResolutions] = useState(false);
  const [resolutionsText, setResolutionsText] = useState("");

  // Excess earnings
  const [hasExcessEarnings, setHasExcessEarnings] = useState(false);
  const [excessEarningsNote, setExcessEarningsNote] = useState("");

  // Other notes
  const [otherNotes, setOtherNotes] = useState("");

  useEffect(() => {
    loadReviewData();
  }, [token]);

  const loadReviewData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/annual-review?action=load&token=${token}`,
        { headers: { apikey: SUPABASE_KEY } }
      );

      const body = await res.json();

      if (!res.ok) {
        if (body.already_submitted) {
          setSubmitted(true);
          setError("");
        } else {
          setError(body.error || "Failed to load review");
        }
        setLoading(false);
        return;
      }

      setData(body);
    } catch (err) {
      console.error(err);
      setError("Failed to connect. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = (key: string) => {
    setChangeFlags((prev) => ({
      ...prev,
      [key]: {
        flagged: !prev[key]?.flagged,
        note: prev[key]?.note || "",
      },
    }));
  };

  const setFlagNote = (key: string, note: string) => {
    setChangeFlags((prev) => ({
      ...prev,
      [key]: { ...prev[key], flagged: true, note },
    }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/annual-review?action=submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            token,
            snapshot: data?.snapshot,
            change_flags: changeFlags,
            new_entries: {
              vehicle_purchases: vehiclePurchases.filter((e) => e.make || e.model || e.year),
              equipment_purchases: equipmentPurchases.filter((e) => e.name || e.model),
              new_loans: newLoans.filter((e) => e.borrower || e.lender),
              share_transactions: shareTransactions.filter((e) => e.transaction_type),
              new_leases: newLeases.filter((e) => e.landlord_name || e.property_address),
              new_benefits: newBenefits.filter((e) => e.benefit_name),
              investments: investments.filter((e) => e.broker || e.amount),
              charitable_contributions: charitableContributions.filter((e) => e.organization),
              annual_meeting: {
                date: meetingDate,
                location: meetingLocation,
                attendees: meetingAttendees,
                has_resolutions: hasResolutions,
                resolutions_text: resolutionsText,
              },
              excess_earnings: {
                has_excess: hasExcessEarnings,
                note: excessEarningsNote,
              },
              other_notes: otherNotes,
            },
          }),
        }
      );

      const body = await res.json();
      if (!res.ok) throw new Error(body.error);

      setSubmitted(true);
      toast.success("Annual review submitted successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading your review...</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">
              Review Submitted
            </h2>
            <p className="text-sm text-muted-foreground">
              Thank you! Your annual review has been submitted successfully.
              Your administrator will review your responses and follow up if needed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">
              Unable to Load Review
            </h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { snapshot } = data;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Annual Review Worksheet — {data.review_year}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data.company_name}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground max-w-2xl">
            Please review the current information below and flag any items that need updating.
            Then fill in any new activity for the current year in the sections that follow.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ============ PRE-POPULATED CURRENT INFO ============ */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Company Information
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Review the information below. Check "Change Needed" for any item requiring an update.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <CurrentInfoItem
              label="Company Name"
              value={snapshot.company.name}
              changeFlag={!!changeFlags["company_name"]?.flagged}
              changeNote={changeFlags["company_name"]?.note || ""}
              onToggle={() => toggleFlag("company_name")}
              onNoteChange={(v) => setFlagNote("company_name", v)}
            />
            <CurrentInfoItem
              label="Entity Type"
              value={snapshot.company.entity_type}
              changeFlag={!!changeFlags["entity_type"]?.flagged}
              changeNote={changeFlags["entity_type"]?.note || ""}
              onToggle={() => toggleFlag("entity_type")}
              onNoteChange={(v) => setFlagNote("entity_type", v)}
            />
            <CurrentInfoItem
              label="Principal Address"
              value={[snapshot.company.address, snapshot.company.address_2, snapshot.company.city, snapshot.company.state, snapshot.company.zip].filter(Boolean).join(", ")}
              changeFlag={!!changeFlags["company_address"]?.flagged}
              changeNote={changeFlags["company_address"]?.note || ""}
              onToggle={() => toggleFlag("company_address")}
              onNoteChange={(v) => setFlagNote("company_address", v)}
            />
          </CardContent>
        </Card>

        {/* Shareholders/Members */}
        {snapshot.shareholders?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {snapshot.company.entity_type?.includes("LLC") ? "Members" : "Shareholders"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.shareholders.map((s: any, i: number) => {
                const isLLC = snapshot.company.entity_type?.includes("LLC");
                const sharesLabel = s.total_shares ? `${s.total_shares.toLocaleString()} shares` : "";
                const ownershipLabel = s.ownership_percentage != null ? `${s.ownership_percentage}%` : "";
                const detailParts = [sharesLabel, ownershipLabel].filter(Boolean);
                const addressStr = [s.address, s.city, s.state, s.zip].filter(Boolean).join(", ") || "No address on file";
                const valueStr = detailParts.length > 0
                  ? `${detailParts.join(" · ")} · ${addressStr}`
                  : addressStr;
                return (
                <CurrentInfoItem
                  key={i}
                  label={s.name}
                  value={valueStr}
                  changeFlag={!!changeFlags[`shareholder_${i}`]?.flagged}
                  changeNote={changeFlags[`shareholder_${i}`]?.note || ""}
                  onToggle={() => toggleFlag(`shareholder_${i}`)}
                  onNoteChange={(v) => setFlagNote(`shareholder_${i}`, v)}
                />
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Directors */}
        {snapshot.directors?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Directors
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.directors.map((d: any, i: number) => (
                <CurrentInfoItem
                  key={i}
                  label={`Director ${i + 1}`}
                  value={d.name}
                  changeFlag={!!changeFlags[`director_${i}`]?.flagged}
                  changeNote={changeFlags[`director_${i}`]?.note || ""}
                  onToggle={() => toggleFlag(`director_${i}`)}
                  onNoteChange={(v) => setFlagNote(`director_${i}`, v)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Officers */}
        {snapshot.officers && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Officers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.officers.president && (
                <CurrentInfoItem
                  label="President"
                  value={snapshot.officers.president}
                  changeFlag={!!changeFlags["officer_president"]?.flagged}
                  changeNote={changeFlags["officer_president"]?.note || ""}
                  onToggle={() => toggleFlag("officer_president")}
                  onNoteChange={(v) => setFlagNote("officer_president", v)}
                />
              )}
              {snapshot.officers.vice_president && (
                <CurrentInfoItem
                  label="Vice President"
                  value={snapshot.officers.vice_president}
                  changeFlag={!!changeFlags["officer_vp"]?.flagged}
                  changeNote={changeFlags["officer_vp"]?.note || ""}
                  onToggle={() => toggleFlag("officer_vp")}
                  onNoteChange={(v) => setFlagNote("officer_vp", v)}
                />
              )}
              {snapshot.officers.secretary && (
                <CurrentInfoItem
                  label="Secretary"
                  value={snapshot.officers.secretary}
                  changeFlag={!!changeFlags["officer_secretary"]?.flagged}
                  changeNote={changeFlags["officer_secretary"]?.note || ""}
                  onToggle={() => toggleFlag("officer_secretary")}
                  onNoteChange={(v) => setFlagNote("officer_secretary", v)}
                />
              )}
              {snapshot.officers.treasurer && (
                <CurrentInfoItem
                  label="Treasurer"
                  value={snapshot.officers.treasurer}
                  changeFlag={!!changeFlags["officer_treasurer"]?.flagged}
                  changeNote={changeFlags["officer_treasurer"]?.note || ""}
                  onToggle={() => toggleFlag("officer_treasurer")}
                  onNoteChange={(v) => setFlagNote("officer_treasurer", v)}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Registered Agent */}
        {snapshot.registered_agent?.name && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Registered Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CurrentInfoItem
                label="Agent Name"
                value={snapshot.registered_agent.name}
                changeFlag={!!changeFlags["reg_agent_name"]?.flagged}
                changeNote={changeFlags["reg_agent_name"]?.note || ""}
                onToggle={() => toggleFlag("reg_agent_name")}
                onNoteChange={(v) => setFlagNote("reg_agent_name", v)}
              />
              <CurrentInfoItem
                label="Agent Address"
                value={[snapshot.registered_agent.address, snapshot.registered_agent.city, snapshot.registered_agent.state, snapshot.registered_agent.zip].filter(Boolean).join(", ")}
                changeFlag={!!changeFlags["reg_agent_address"]?.flagged}
                changeNote={changeFlags["reg_agent_address"]?.note || ""}
                onToggle={() => toggleFlag("reg_agent_address")}
                onNoteChange={(v) => setFlagNote("reg_agent_address", v)}
              />
            </CardContent>
          </Card>
        )}

        {/* Banks */}
        {snapshot.banks?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Landmark className="h-4 w-4 text-primary" />
                Banking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.banks.map((b: any, i: number) => (
                <CurrentInfoItem
                  key={i}
                  label={b.bank_name}
                  value={`${b.account_type || "Account"} · ****${b.account_number_last4 || "N/A"}`}
                  changeFlag={!!changeFlags[`bank_${i}`]?.flagged}
                  changeNote={changeFlags[`bank_${i}`]?.note || ""}
                  onToggle={() => toggleFlag(`bank_${i}`)}
                  onNoteChange={(v) => setFlagNote(`bank_${i}`, v)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Line of Credit */}
        {snapshot.line_of_credit?.loc_enabled && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-primary" />
                Line of Credit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <CurrentInfoItem
                label="LOC Details"
                value={`${snapshot.line_of_credit.bank || "N/A"} · $${snapshot.line_of_credit.loc_amount?.toLocaleString() || "N/A"} · ${snapshot.line_of_credit.loc_interest_rate || "N/A"} · Agent: ${snapshot.line_of_credit.agent_administrator || "N/A"}`}
                changeFlag={!!changeFlags["loc"]?.flagged}
                changeNote={changeFlags["loc"]?.note || ""}
                onToggle={() => toggleFlag("loc")}
                onNoteChange={(v) => setFlagNote("loc", v)}
              />
            </CardContent>
          </Card>
        )}

        {/* Loan Balances */}
        {snapshot.loans?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HandCoins className="h-4 w-4 text-primary" />
                Loan Balances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.loans.map((l: any, i: number) => (
                <CurrentInfoItem
                  key={i}
                  label={`${l.lender_name || "Lender"} → ${l.borrower_name || "Borrower"}`}
                  value={`$${l.loan_amount?.toLocaleString() || "N/A"} · ${l.loan_rate || "N/A"}% · Balance: $${(l.balance_to_shareholder || l.balance_from_shareholder || 0).toLocaleString()}`}
                  changeFlag={!!changeFlags[`loan_${i}`]?.flagged}
                  changeNote={changeFlags[`loan_${i}`]?.note || ""}
                  onToggle={() => toggleFlag(`loan_${i}`)}
                  onNoteChange={(v) => setFlagNote(`loan_${i}`, v)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Vehicles */}
        {snapshot.vehicles?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Vehicles on Record
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {snapshot.vehicles.map((v: any, i: number) => (
                <CurrentInfoItem
                  key={i}
                  label={v.description || `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim()}
                  value={v.vin ? `VIN: ${v.vin}` : "No VIN on file"}
                  changeFlag={!!changeFlags[`vehicle_${i}`]?.flagged}
                  changeNote={changeFlags[`vehicle_${i}`]?.note || ""}
                  onToggle={() => toggleFlag(`vehicle_${i}`)}
                  onNoteChange={(v) => setFlagNote(`vehicle_${i}`, v)}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Current Leases */}
        {snapshot.leases?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                Current Leases on File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.leases.map((l: any, i: number) => (
                <div key={i} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {l.description || `Lease ${i + 1}`}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <Checkbox
                        checked={!!changeFlags[`lease_${i}`]?.flagged}
                        onCheckedChange={() => toggleFlag(`lease_${i}`)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Change Needed</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {l.landlord_name && (
                      <div><span className="font-medium text-foreground">Landlord:</span> {l.landlord_name}{l.landlord_address ? `, ${l.landlord_address}` : ""}</div>
                    )}
                    {(l.address || l.address_2) && (
                      <div><span className="font-medium text-foreground">Property:</span> {[l.address, l.address_2].filter(Boolean).join(", ")}</div>
                    )}
                    {l.monthly_payment != null && (
                      <div><span className="font-medium text-foreground">Monthly Rent:</span> ${Number(l.monthly_payment).toLocaleString()}</div>
                    )}
                    {l.lease_start_date && (
                      <div><span className="font-medium text-foreground">Start:</span> {l.lease_start_date}{l.lease_end_date ? ` — End: ${l.lease_end_date}` : ""}</div>
                    )}
                  </div>
                  {changeFlags[`lease_${i}`]?.flagged && (
                    <Textarea
                      placeholder="Describe the change (e.g. lease renewed, rent changed, terminated)..."
                      value={changeFlags[`lease_${i}`]?.note || ""}
                      onChange={(e) => setFlagNote(`lease_${i}`, e.target.value)}
                      className="text-xs min-h-[50px] mt-1"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Current Employee Benefits */}
        {snapshot.benefits?.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-primary" />
                Current Employee Benefits on File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {snapshot.benefits.map((b: any, i: number) => (
                <div key={i} className="border border-border rounded-md p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {b.benefit_description || b.benefit_type || `Benefit ${i + 1}`}
                    </span>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      <Checkbox
                        checked={!!changeFlags[`benefit_${i}`]?.flagged}
                        onCheckedChange={() => toggleFlag(`benefit_${i}`)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">Change Needed</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {b.benefit_type && (
                      <div><span className="font-medium text-foreground">Type:</span> {b.benefit_type}</div>
                    )}
                    {b.provider && (
                      <div><span className="font-medium text-foreground">Provider:</span> {b.provider}</div>
                    )}
                    {b.agent_administrator && (
                      <div><span className="font-medium text-foreground">Agent/Admin:</span> {b.agent_administrator}</div>
                    )}
                    {b.new_plan_effective_date && (
                      <div><span className="font-medium text-foreground">Effective Date:</span> {b.new_plan_effective_date}</div>
                    )}
                    {b.eligibility_comments && (
                      <div><span className="font-medium text-foreground">Eligibility:</span> {b.eligibility_comments}</div>
                    )}
                    {b.insurance_agency && (
                      <div><span className="font-medium text-foreground">Agency:</span> {b.insurance_agency}</div>
                    )}
                  </div>
                  {changeFlags[`benefit_${i}`]?.flagged && (
                    <Textarea
                      placeholder="Describe the change (e.g. provider changed, benefit discontinued, eligibility updated)..."
                      value={changeFlags[`benefit_${i}`]?.note || ""}
                      onChange={(e) => setFlagNote(`benefit_${i}`, e.target.value)}
                      className="text-xs min-h-[50px] mt-1"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ============ NEW INFORMATION SECTIONS ============ */}
        <div className="pt-4 border-t border-border">
          <h2 className="text-base font-bold text-foreground mb-1">
            New Activity — {data.review_year}
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Enter any new transactions or changes that occurred during the year.
            Use "Add Another" for multiple entries in each section.
          </p>
        </div>

        {/* 1. Vehicle Purchases */}
        <MultiEntrySection
          title="1. Vehicle Purchases"
          icon={Car}
          entries={vehiclePurchases}
          setEntries={setVehiclePurchases}
          fields={[
            { key: "make", label: "Make" },
            { key: "model", label: "Model" },
            { key: "year", label: "Year" },
            { key: "vin", label: "VIN Number" },
            { key: "purchase_date", label: "Purchase Date", type: "date" },
            { key: "purchase_amount", label: "Purchase Amount", type: "number" },
            { key: "financed", label: "Financed?", type: "toggle" },
            { key: "lender", label: "Lender", showIf: (e) => e.financed },
            { key: "loan_amount", label: "Loan Amount", type: "number", showIf: (e) => e.financed },
            { key: "loan_rate", label: "Loan Rate (%)", showIf: (e) => e.financed },
            { key: "has_trade_in", label: "Trade-in or sale of existing vehicle?", type: "toggle" },
            { key: "trade_vehicle", label: "Trade Vehicle (Make/Model/Year)", showIf: (e) => e.has_trade_in },
            { key: "trade_vin", label: "Trade VIN", showIf: (e) => e.has_trade_in },
            { key: "trade_amount", label: "Sale/Trade Amount", type: "number", showIf: (e) => e.has_trade_in },
            { key: "trade_date", label: "Sale/Trade Date", type: "date", showIf: (e) => e.has_trade_in },
          ]}
        />

        {/* 2. Equipment Purchases */}
        <MultiEntrySection
          title="2. Equipment Purchases"
          icon={Wrench}
          entries={equipmentPurchases}
          setEntries={setEquipmentPurchases}
          fields={[
            { key: "name", label: "Equipment Name/Type" },
            { key: "model", label: "Model" },
            { key: "year", label: "Year" },
            { key: "serial_number", label: "Serial Number" },
            { key: "purchase_date", label: "Purchase Date", type: "date" },
            { key: "purchase_amount", label: "Purchase Amount", type: "number" },
            { key: "financed", label: "Financed?", type: "toggle" },
            { key: "lender", label: "Lender", showIf: (e) => e.financed },
            { key: "loan_amount", label: "Loan Amount", type: "number", showIf: (e) => e.financed },
            { key: "loan_rate", label: "Loan Rate (%)", showIf: (e) => e.financed },
          ]}
        />

        {/* 3. New Loans */}
        <MultiEntrySection
          title="3. New Loans"
          icon={HandCoins}
          entries={newLoans}
          setEntries={setNewLoans}
          fields={[
            { key: "borrower", label: "Borrower" },
            { key: "lender", label: "Lender" },
            { key: "loan_amount", label: "Loan Amount", type: "number" },
            { key: "loan_date", label: "Loan Date", type: "date" },
            { key: "interest_rate", label: "Interest Rate (%)" },
            { key: "prepare_promissory_note", label: "Prepare Promissory Note?", type: "toggle" },
            { key: "loan_direction", label: "Loan Direction", type: "select", options: ["Company borrowing FROM shareholder/member", "Company lending TO shareholder/member"] },
          ]}
        />

        {/* 4. Share/Membership Interest Transactions */}
        <MultiEntrySection
          title="4. Share or Membership Interest Transactions"
          icon={ArrowRightLeft}
          entries={shareTransactions}
          setEntries={setShareTransactions}
          fields={[
            { key: "transaction_type", label: "Transaction Type", type: "select", options: ["Transfer", "New Issuance", "Redemption"] },
            { key: "from_name", label: "Transferred From" },
            { key: "to_name", label: "Transferred To" },
            { key: "num_shares", label: "Number of Shares/Units", type: "number" },
            { key: "payment_amount", label: "Payment Amount", type: "number" },
            { key: "transaction_date", label: "Transaction Date", type: "date" },
            { key: "cert_issued", label: "Certificate # Issued" },
            { key: "cert_canceled", label: "Certificate #(s) Canceled" },
          ]}
        />

        {/* 5. New Lease Agreements */}
        <MultiEntrySection
          title="5. New Lease Agreements"
          icon={Home}
          entries={newLeases}
          setEntries={setNewLeases}
          fields={[
            { key: "landlord_name", label: "Landlord Name" },
            { key: "landlord_address", label: "Landlord Address" },
            { key: "property_address", label: "Property Address", fullWidth: true },
            { key: "use_of_premises", label: "Use of Premises" },
            { key: "lease_start_date", label: "Lease Start Date", type: "date" },
            { key: "lease_term", label: "Lease Term" },
            { key: "monthly_rent", label: "Monthly Rent", type: "number" },
            { key: "security_deposit", label: "Security Deposit", type: "number" },
            { key: "legal_description", label: "Legal Description (if needed)", type: "textarea" },
          ]}
        />

        {/* 6. New Employee Benefits */}
        <MultiEntrySection
          title="6. New Employee Benefits"
          icon={HeartHandshake}
          entries={newBenefits}
          setEntries={setNewBenefits}
          fields={[
            { key: "benefit_name", label: "Benefit Name" },
            { key: "effective_date", label: "Effective Date", type: "date" },
            { key: "provider", label: "Benefit Provider" },
            { key: "agent_administrator", label: "Agent/Administrator" },
            { key: "eligibility", label: "Eligibility" },
            { key: "agency", label: "Agency" },
          ]}
        />

        {/* 7. Investment Transactions */}
        <MultiEntrySection
          title="7. Investment Transactions"
          icon={BarChart3}
          entries={investments}
          setEntries={setInvestments}
          fields={[
            { key: "broker", label: "Broker/Organization" },
            { key: "representative", label: "Representative" },
            { key: "transaction_date", label: "Transaction Date", type: "date" },
            { key: "amount", label: "Amount", type: "number" },
            { key: "investment_type", label: "Investment Type" },
            { key: "transaction_type", label: "Transaction Type", type: "select", options: ["Purchase", "Sale", "Distribution", "Reinvestment"] },
          ]}
        />

        {/* 8. Charitable Contributions */}
        <MultiEntrySection
          title="8. Charitable Contributions"
          icon={Gift}
          entries={charitableContributions}
          setEntries={setCharitableContributions}
          fields={[
            { key: "organization", label: "Organization Name" },
            { key: "ein", label: "EIN (if known)" },
            { key: "amount", label: "Contribution Amount", type: "number" },
            { key: "contribution_date", label: "Contribution Date", type: "date" },
            { key: "non_cash", label: "Non-Cash Contribution?", type: "toggle" },
            { key: "non_cash_description", label: "Description", showIf: (e) => e.non_cash },
            { key: "non_cash_value", label: "Estimated Value", type: "number", showIf: (e) => e.non_cash },
          ]}
        />

        {/* 9. Annual Meeting */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              9. Annual Meeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date of Meeting</Label>
                <Input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Place/Location</Label>
                <Input
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Who Was Present (names/titles)</Label>
              <Textarea
                value={meetingAttendees}
                onChange={(e) => setMeetingAttendees(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={hasResolutions}
                onCheckedChange={setHasResolutions}
              />
              <Label className="text-xs">Any resolutions passed?</Label>
            </div>
            {hasResolutions && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Describe resolutions</Label>
                <Textarea
                  value={resolutionsText}
                  onChange={(e) => setResolutionsText(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 10. Excess Earnings */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              10. Anticipated Excess Earnings (Over $250,000)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={hasExcessEarnings}
                onCheckedChange={setHasExcessEarnings}
              />
              <Label className="text-xs">Yes, we anticipate excess earnings</Label>
            </div>
            {hasExcessEarnings && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reason for retained earnings</Label>
                <Textarea
                  value={excessEarningsNote}
                  onChange={(e) => setExcessEarningsNote(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 11. Other Notes */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              11. Other Information / Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Anything not covered above..."
              value={otherNotes}
              onChange={(e) => setOtherNotes(e.target.value)}
              className="text-xs min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="sticky bottom-0 bg-background border-t border-border py-4 -mx-4 px-4">
          <div className="max-w-4xl mx-auto">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit Annual Review
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
