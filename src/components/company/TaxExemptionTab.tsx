import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { DatePickerField } from "@/components/ui/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { toast } from "@/hooks/use-toast";
import { Form1023EZScreener, type ScreenerAnswers } from "./Form1023EZScreener";
import { Form1023EZResultsView } from "./Form1023EZResultsView";

interface Props {
  companyId: string;
}

type Exemption = {
  id?: string;
  company_id?: string;
  electing_501c3: boolean;
  form_selection: string | null;
  eligibility_result: string | null;
  eligibility_run_date: string | null;
  eligibility_answers: ScreenerAnswers | null;
  date_application_submitted: string | null;
  filing_fee_amount: string | null;
  filing_fee_date_paid: string | null;
  authorized_signatory: string | null;
  method_of_submission: string | null;
  application_status: string | null;
  irs_determination_letter_date: string | null;
  effective_date_of_exemption: string | null;
  public_charity_classification: string | null;
  determination_letter_path: string | null;
  form_990_version_required: string | null;
  filing_due_date: string | null;
  state_registration_required: string | null;
  registration_number: string | null;
  registration_date: string | null;
  expiration_date: string | null;
  registration_status: string | null;
  annual_renewal_due_date: string | null;
  registration_certificate_path: string | null;
};

type Filing = {
  id: string;
  company_id: string;
  year: string | null;
  form_version: string | null;
  date_filed: string | null;
  status: string | null;
  sort_order: number;
};

const EMPTY: Exemption = {
  electing_501c3: false,
  form_selection: null,
  eligibility_result: null,
  eligibility_run_date: null,
  eligibility_answers: null,
  date_application_submitted: null,
  filing_fee_amount: null,
  filing_fee_date_paid: null,
  authorized_signatory: null,
  method_of_submission: null,
  application_status: null,
  irs_determination_letter_date: null,
  effective_date_of_exemption: null,
  public_charity_classification: null,
  determination_letter_path: null,
  form_990_version_required: null,
  filing_due_date: null,
  state_registration_required: null,
  registration_number: null,
  registration_date: null,
  expiration_date: null,
  registration_status: null,
  annual_renewal_due_date: null,
  registration_certificate_path: null,
};

export function TaxExemptionTab({ companyId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Exemption>(EMPTY);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [deleteFilingId, setDeleteFilingId] = useState<string | null>(null);
  const [rerunSignal, setRerunSignal] = useState(0);

  const { data } = useQuery({
    queryKey: ["nonprofit_tax_exemption", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("nonprofit_tax_exemption")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as Exemption | null;
    },
  });

  const { data: filingsData } = useQuery({
    queryKey: ["nonprofit_form990_filings", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("nonprofit_form990_filings")
        .select("*")
        .eq("company_id", companyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Filing[];
    },
  });

  useEffect(() => {
    if (data) setForm({ ...EMPTY, ...data });
  }, [data]);

  useEffect(() => {
    if (filingsData) setFilings(filingsData);
  }, [filingsData]);

  const save = async (patch: Partial<Exemption>) => {
    const next = { ...form, ...patch };
    setForm(next);
    const payload = { ...next, company_id: companyId };
    delete (payload as any).id;
    if ("eligibility_answers" in patch || "eligibility_result" in patch) {
      // Diagnostic: verify screener answers reach the upsert payload
      // eslint-disable-next-line no-console
      console.log("[1023-EZ] saving screener payload", {
        result: payload.eligibility_result,
        run_date: payload.eligibility_run_date,
        answer_count: payload.eligibility_answers
          ? Object.keys(payload.eligibility_answers).length
          : 0,
      });
    }
    const { error } = await (supabase as any)
      .from("nonprofit_tax_exemption")
      .upsert(payload, { onConflict: "company_id" });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      qc.invalidateQueries({ queryKey: ["nonprofit_tax_exemption", companyId] });
    }
  };


  const handleUpload = async (
    field: "determination_letter_path" | "registration_certificate_path",
    file: File
  ) => {
    const path = `company-${companyId}/tax-exemption/${field}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("company-documents").upload(path, file, {
      upsert: true,
    });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      return;
    }
    await save({ [field]: path } as any);
    toast({ title: "Uploaded", description: file.name });
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("company-documents").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Download failed", description: error?.message ?? "Unknown error", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const addFiling = async () => {
    const { error } = await (supabase as any).from("nonprofit_form990_filings").insert({
      company_id: companyId,
      sort_order: filings.length,
    });
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["nonprofit_form990_filings", companyId] });
  };

  const updateFiling = async (id: string, patch: Partial<Filing>) => {
    setFilings((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await (supabase as any).from("nonprofit_form990_filings").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    }
  };

  const deleteFiling = async () => {
    if (!deleteFilingId) return;
    const { error } = await (supabase as any)
      .from("nonprofit_form990_filings")
      .delete()
      .eq("id", deleteFilingId);
    setDeleteFilingId(null);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["nonprofit_form990_filings", companyId] });
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Federal Tax Exemption */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Federal Tax Exemption</h2>
          <p className="text-xs text-muted-foreground">IRS 501(c)(3) recognition application and status.</p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="electing_501c3"
            checked={form.electing_501c3}
            onCheckedChange={(v) => save({ electing_501c3: !!v })}
          />
          <Label htmlFor="electing_501c3" className="cursor-pointer">Electing 501(c)(3) Status</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Form Selection</Label>
            <Select value={form.form_selection ?? ""} onValueChange={(v) => save({ form_selection: v })}>
              <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1023">1023</SelectItem>
                <SelectItem value="1023-EZ">1023-EZ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Eligibility Screener Result</Label>
            <Input
              readOnly
              value={
                form.eligibility_result
                  ? `${form.eligibility_result}${form.eligibility_run_date ? ` (run ${form.eligibility_run_date})` : ""}`
                  : "Not run"
              }
              className="bg-muted"
            />
            {form.form_selection === "1023-EZ" && (
              <div className="pt-1 flex flex-wrap gap-2">
                <Form1023EZScreener
                  externalOpenSignal={rerunSignal}
                  onComplete={(result, date, answers) =>
                    save({
                      eligibility_result: result,
                      eligibility_run_date: date,
                      eligibility_answers: answers,
                    })
                  }
                />
                {form.eligibility_result && (
                  <Form1023EZResultsView
                    answers={form.eligibility_answers}
                    result={form.eligibility_result}
                    runDate={form.eligibility_run_date}
                    onRerun={() => setRerunSignal((n) => n + 1)}
                  />
              </div>
            )}
            {form.form_selection === "1023-EZ" &&
              form.eligibility_result &&
              (!form.eligibility_answers ||
                Object.keys(form.eligibility_answers).length === 0) && (
                <p className="text-xs text-amber-700 pt-1">
                  This result was recorded before per-question answers were saved. Re-run the
                  screener to capture a full audit trail.
                </p>
              )}
          </div>



          <div className="space-y-1">
            <Label>Date Application Submitted</Label>
            <DatePickerField
              value={form.date_application_submitted ?? ""}
              onChange={(v) => save({ date_application_submitted: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Filing Fee Amount</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="$0.00"
              value={form.filing_fee_amount ?? ""}
              onChange={(e) => setForm({ ...form, filing_fee_amount: e.target.value })}
              onBlur={(e) => save({ filing_fee_amount: e.target.value || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Filing Fee Date Paid</Label>
            <DatePickerField
              value={form.filing_fee_date_paid ?? ""}
              onChange={(v) => save({ filing_fee_date_paid: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Authorized Signatory</Label>
            <Input
              value={form.authorized_signatory ?? ""}
              onChange={(e) => setForm({ ...form, authorized_signatory: e.target.value })}
              onBlur={(e) => save({ authorized_signatory: e.target.value || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Method of Submission</Label>
            <Select value={form.method_of_submission ?? ""} onValueChange={(v) => save({ method_of_submission: v })}>
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Mail">Mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Application Status</Label>
            <Select value={form.application_status ?? ""} onValueChange={(v) => save({ application_status: v })}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>IRS Determination Letter Date</Label>
            <DatePickerField
              value={form.irs_determination_letter_date ?? ""}
              onChange={(v) => save({ irs_determination_letter_date: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Effective Date of Exemption</Label>
            <DatePickerField
              value={form.effective_date_of_exemption ?? ""}
              onChange={(v) => save({ effective_date_of_exemption: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Public Charity Classification</Label>
            <Select
              value={form.public_charity_classification ?? ""}
              onValueChange={(v) => save({ public_charity_classification: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Public Charity">Public Charity</SelectItem>
                <SelectItem value="Private Foundation">Private Foundation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Upload Determination Letter</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload("determination_letter_path", f);
                  e.target.value = "";
                }}
              />
              {form.determination_letter_path && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadFile(form.determination_letter_path!)}
                >
                  <FileText className="h-3 w-3 mr-1" /> View
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* SECTION 2: Annual Federal Filing */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Annual Federal Filing</h2>
          <p className="text-xs text-muted-foreground">Annual Form 990 obligations and filing history.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Form 990 Version Required</Label>
            <Select
              value={form.form_990_version_required ?? ""}
              onValueChange={(v) => save({ form_990_version_required: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="990-N">990-N</SelectItem>
                <SelectItem value="990-EZ">990-EZ</SelectItem>
                <SelectItem value="990">990</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Filing Due Date</Label>
            <DatePickerField
              value={form.filing_due_date ?? ""}
              onChange={(v) => save({ filing_due_date: v || null })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Filing History</Label>
            <Button size="sm" variant="outline" onClick={addFiling}>
              <Plus className="h-3 w-3 mr-1" /> Add Row
            </Button>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Year</th>
                  <th className="text-left p-2 font-medium">Form Version</th>
                  <th className="text-left p-2 font-medium">Date Filed</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filings.length === 0 && (
                  <tr><td colSpan={5} className="p-3 text-center text-muted-foreground text-xs">No filings recorded.</td></tr>
                )}
                {filings.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">
                      <Input
                        className="h-8"
                        value={row.year ?? ""}
                        onChange={(e) => setFilings((rs) => rs.map((r) => r.id === row.id ? { ...r, year: e.target.value } : r))}
                        onBlur={(e) => updateFiling(row.id, { year: e.target.value || null })}
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={row.form_version ?? ""}
                        onValueChange={(v) => updateFiling(row.id, { form_version: v })}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Version" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="990-N">990-N</SelectItem>
                          <SelectItem value="990-EZ">990-EZ</SelectItem>
                          <SelectItem value="990">990</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <DatePickerField
                        value={row.date_filed ?? ""}
                        onChange={(v) => updateFiling(row.id, { date_filed: v || null })}
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={row.status ?? ""}
                        onValueChange={(v) => updateFiling(row.id, { status: v })}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Filed">Filed</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Late">Late</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" onClick={() => setDeleteFilingId(row.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Separator />

      {/* SECTION 3: State Charitable Registration */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">State Charitable Registration</h2>
          <p className="text-xs text-muted-foreground">State-level charitable solicitation registration.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>State Registration Required</Label>
            <Select
              value={form.state_registration_required ?? ""}
              onValueChange={(v) => save({ state_registration_required: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Registration Number</Label>
            <Input
              value={form.registration_number ?? ""}
              onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
              onBlur={(e) => save({ registration_number: e.target.value || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Registration Date</Label>
            <DatePickerField
              value={form.registration_date ?? ""}
              onChange={(v) => save({ registration_date: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Expiration Date</Label>
            <DatePickerField
              value={form.expiration_date ?? ""}
              onChange={(v) => save({ expiration_date: v || null })}
            />
          </div>

          <div className="space-y-1">
            <Label>Registration Status</Label>
            <Select
              value={form.registration_status ?? ""}
              onValueChange={(v) => save({ registration_status: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Expired">Expired</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Annual Renewal Due Date</Label>
            <DatePickerField
              value={form.annual_renewal_due_date ?? ""}
              onChange={(v) => save({ annual_renewal_due_date: v || null })}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <Label>Upload Registration Certificate</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload("registration_certificate_path", f);
                  e.target.value = "";
                }}
              />
              {form.registration_certificate_path && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => downloadFile(form.registration_certificate_path!)}
                >
                  <FileText className="h-3 w-3 mr-1" /> View
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <ConfirmDeleteDialog
        open={!!deleteFilingId}
        onOpenChange={(o) => !o && setDeleteFilingId(null)}
        onConfirm={deleteFiling}
        title="Delete filing record?"
        description="This will remove this Form 990 filing entry."
      />
    </div>
  );
}
