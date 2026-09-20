import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Download, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import NonprofitStatementView from "@/components/company/NonprofitStatementView";
import { generateNonprofitFinancialStatementPDF } from "@/lib/nonprofit-financial-statement-pdf";
import {
  IRS_FORM_TYPES,
  REVENUE_FIELDS,
  REVENUE_TOTAL_FIELD,
  FUNCTIONAL_EXPENSE_FIELDS,
  EXPENSE_TOTAL_FIELD,
  NET_ASSET_FIELDS,
  amendedSinceFinalizeNotice,
  defaultFiscalYearLabel,
  derivePeriod,
  getFormVisibility,
  primarySourceTag,
  runReconciliation,
  sourceConsistencyNote,
  suggestFiscalYear,
  MANUAL_REVIEW_DATE_NOTE,
  NO_FISCAL_YEAR_END_NOTE,
  type IrsFormType,
  type NonprofitStatement,
  type SourceTag,
} from "@/lib/nonprofit-financials";

interface Props {
  companyId: string;
  company: any;
}

const MONEY_KEYS = [
  ...REVENUE_FIELDS.map((f) => f.key),
  REVENUE_TOTAL_FIELD.key,
  ...FUNCTIONAL_EXPENSE_FIELDS.map((f) => f.key),
  EXPENSE_TOTAL_FIELD.key,
  ...NET_ASSET_FIELDS.map((f) => f.key),
] as string[];

const STATEMENT_SOURCES: { value: SourceTag; label: string }[] = [
  { value: "tax_return", label: "Form 990 as filed" },
  { value: "audited_financials", label: "Audited Financial Statements" },
  { value: "internal", label: "Internal Records — Unaudited" },
];

export default function NonprofitFinancialStatementsTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [sourceTag, setSourceTag] = useState<SourceTag>("internal");


  const formType = (company?.irs_form_type ?? null) as IrsFormType | null;

  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["nonprofit_financial_statements", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nonprofit_financial_statements" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("fiscal_year", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: finalizedMeetings = [] } = useQuery({
    queryKey: ["nonprofit_snapshot_meetings", companyId],
    queryFn: async () => {
      const { data: meetings } = await supabase
        .from("meetings")
        .select("id, meeting_date, meeting_type, document_status")
        .eq("company_id", companyId);
      const ids = (meetings || []).map((m) => m.id);
      if (!ids.length) return [];
      const { data: snaps } = await supabase
        .from("meeting_financial_snapshots" as any)
        .select("*")
        .in("meeting_id", ids);
      return ((snaps as any[]) || []).map((s) => ({
        ...s,
        meeting: (meetings || []).find((m) => m.id === s.meeting_id),
      }));
    },
  });

  const selected = useMemo(
    () => statements.find((s: any) => s.id === selectedId) || null,
    [statements, selectedId],
  );

  useEffect(() => {
    if (!selectedId && statements.length) setSelectedId(statements[0].id);
  }, [statements, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setDraft({ ...selected });
    const firstTag = primarySourceTag(selected);
    setSourceTag(
      (firstTag && STATEMENT_SOURCES.some((o) => o.value === firstTag) ? firstTag : null) ??
        (selected.return_filed_date ? "tax_return" : "internal"),
    );
    setTier2Open(
      TIER2_KEYS.some((k) => selected[k] !== null && selected[k] !== undefined && selected[k] !== ""),
    );
  }, [selected?.id, selected?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const priorYear = useMemo(
    () =>
      draft.fiscal_year
        ? statements.find((s: any) => s.fiscal_year === Number(draft.fiscal_year) - 1) || null
        : null,
    [statements, draft.fiscal_year],
  );

  const derived = useMemo(() => {
    const v = getFormVisibility(formType);
    const n = (x: any) => {
      if (x === "" || x === null || x === undefined) return null;
      const p = Number(x);
      return Number.isFinite(p) ? p : null;
    };
    const sum = (keys: string[]) => {
      const vals = keys.map((k) => n(draft[k])).filter((x): x is number => x != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    };
    const revenueDetailTotal = v.showRevenueDetail ? sum(REVENUE_FIELDS.map((f) => f.key)) : null;
    const expenseDetailTotal = v.showFunctionalSplit
      ? sum(FUNCTIONAL_EXPENSE_FIELDS.map((f) => f.key))
      : null;
    const totalRevenue = revenueDetailTotal ?? n(draft.total_revenue);
    const totalExpenses = expenseDetailTotal ?? n(draft.total_expenses);
    const changeInNetAssets =
      totalRevenue != null && totalExpenses != null ? totalRevenue - totalExpenses : null;
    const beginning = n(draft.net_assets_beginning);
    const ending = beginning != null && changeInNetAssets != null ? beginning + changeInNetAssets : null;
    const restrictionTotal = sum(["net_assets_without_restrictions", "net_assets_with_restrictions"]);
    const assets = n(draft.total_assets);
    const liabilities = n(draft.total_liabilities);
    const assetsLessLiabilities = assets != null && liabilities != null ? assets - liabilities : null;
    return {
      revenueDetailTotal,
      expenseDetailTotal,
      totalRevenue,
      totalExpenses,
      changeInNetAssets,
      ending,
      restrictionTotal,
      assetsLessLiabilities,
    };
  }, [draft, formType]);

  const derivedPeriod = useMemo(
    () => derivePeriod(company?.fiscal_year_end, Number(draft.fiscal_year)),
    [company?.fiscal_year_end, draft.fiscal_year],
  );

  const resolvedPeriod = useMemo(
    () =>
      draft.has_irregular_period
        ? { start: draft.period_start || null, end: draft.period_end || null }
        : { start: derivedPeriod.start, end: derivedPeriod.end },
    [draft.has_irregular_period, draft.period_start, draft.period_end, derivedPeriod],
  );

  const consistencyNote = useMemo(
    () => sourceConsistencyNote(sourceTag, draft.return_filed_date),
    [sourceTag, draft.return_filed_date],
  );

  const effectiveStatement = useMemo(
    () => ({
      ...(draft as NonprofitStatement),
      fiscal_year: Number(draft.fiscal_year),
      period_start: resolvedPeriod.start,
      period_end: resolvedPeriod.end,
      total_revenue: derived.totalRevenue,
      total_expenses: derived.totalExpenses,
      change_in_net_assets: derived.changeInNetAssets,
      net_assets_ending: derived.ending,
    }),
    [draft, derived, resolvedPeriod],
  );

  const setFormType = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ irs_form_type: value } as any)
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("IRS form type saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createYear = useMutation({
    mutationFn: async () => {
      const suggested = suggestFiscalYear(company?.fiscal_year_end);
      let year = suggested;
      while (statements.some((s: any) => s.fiscal_year === year)) year -= 1;
      const { data, error } = await supabase
        .from("nonprofit_financial_statements" as any)
        .insert({
          company_id: companyId,
          fiscal_year: year,
          fiscal_year_label: defaultFiscalYearLabel(year),
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: (row: any) => {
      queryClient.invalidateQueries({ queryKey: ["nonprofit_financial_statements", companyId] });
      setSelectedId(row.id);
      toast.success("Fiscal year added.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Warnings are derived from the figures currently on screen so they are also
  // visible when a saved statement is re-opened, not only right after a save.
  // Differences the user has already accepted stay out of the active list.
  const warnings = useMemo(() => {
    if (!selected) return [];
    const dismissed = new Set(((selected.dismissed_warnings as any[]) || []).map((w) => w.code));
    return runReconciliation(effectiveStatement, formType, priorYear).filter(
      (w) => !dismissed.has(w.code),
    );
  }, [effectiveStatement, formType, priorYear, selected]);

  const save = useMutation({
    mutationFn: async () => {
      const tags: Record<string, SourceTag> = {};
      const payload: Record<string, any> = {
        fiscal_year: Number(draft.fiscal_year),
        fiscal_year_label: draft.fiscal_year_label || defaultFiscalYearLabel(Number(draft.fiscal_year)),
        period_start: resolvedPeriod.start,
        period_end: resolvedPeriod.end,
        has_irregular_period: !!draft.has_irregular_period,
        is_audited: sourceTag === "audited_financials",
        is_draft: draft.is_draft !== false,
        return_filed_date: draft.return_filed_date || null,
        gross_receipts_under_threshold: draft.gross_receipts_under_threshold ?? null,
        board_acknowledgment: draft.board_acknowledgment || null,
      };
      for (const k of MONEY_KEYS) {
        const v = (effectiveStatement as any)[k];
        const parsed = v === "" || v === null || v === undefined ? null : Number(v);
        payload[k] = parsed;
        if (parsed !== null) tags[k] = sourceTag;
      }
      payload.source_tags = tags;
      const { error } = await supabase
        .from("nonprofit_financial_statements" as any)
        .update(payload as any)
        .eq("id", selected!.id);
      if (error) throw error;
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ["nonprofit_financial_statements", companyId] });
      const found = runReconciliation(
        { ...(payload as any), fiscal_year: Number(draft.fiscal_year) },
        formType,
        priorYear,
      );
      toast.success(found.length ? "Saved with reconciliation warnings." : "Financial statement saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissWarning = async (code: string) => {
    const w = warnings.find((x) => x.code === code);
    if (!w || !selected) return;
    const { data: sess } = await supabase.auth.getUser();
    const next = [
      ...((selected.dismissed_warnings as any[]) || []),
      {
        code: w.code,
        message: w.message,
        dismissed_by: sess?.user?.email ?? null,
        dismissed_at: new Date().toISOString(),
      },
    ];
    const { error } = await supabase
      .from("nonprofit_financial_statements" as any)
      .update({ dismissed_warnings: next } as any)
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    setDraft((d) => ({ ...d, dismissed_warnings: next }));
    queryClient.invalidateQueries({ queryKey: ["nonprofit_financial_statements", companyId] });
  };

  const affectedMeetings = (statementId: string, updatedAt: string | null) =>
    finalizedMeetings.filter(
      (snap: any) =>
        snap.source_statement_id === statementId &&
        updatedAt &&
        snap.source_statement_updated_at &&
        new Date(updatedAt).getTime() > new Date(snap.source_statement_updated_at).getTime(),
    );

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("nonprofit_financial_statements" as any)
      .delete()
      .eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    setDeleteTarget(null);
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["nonprofit_financial_statements", companyId] });
    toast.success("Statement deleted. Finalized minutes keep their recorded figures.");
  };

  const exportPdf = async () => {
    if (!selected) return;
    const doc = generateNonprofitFinancialStatementPDF({
      companyName: company?.name || "Organization",
      formType,
      statement: effectiveStatement,
      priorYear,
    });
    const { savePdfReliably } = await import("@/lib/pdf-save");
    await savePdfReliably(
      doc,
      `${(company?.name || "Organization").replace(/[^a-zA-Z0-9]/g, "_")}_FY${draft.fiscal_year}_Financial_Statement.pdf`,
    );
  };

  const vis = getFormVisibility(formType);

  if (!formType) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Financial Statements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Select the IRS return this organization files. It determines which figures are reported.
          </p>
          <div className="w-72">
            <Select onValueChange={(v) => setFormType.mutate(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select IRS form filed" />
              </SelectTrigger>
              <SelectContent>
                {IRS_FORM_TYPES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  const fmtPeriodDate = (d: string | null) => {
    if (!d) return "—";
    const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
    return Number.isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  const fmtAmt = (v: number | null) =>
    v == null ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const amountRow = (
    label: string,
    key: string,
    opts: { ref?: string; locked?: boolean; lockedValue?: number | null } = {},
  ) => (
    <div key={key} className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-xs" title={opts.ref}>
        {label}
        {opts.locked && (
          <span className="ml-2 text-[10px] text-muted-foreground">From Form 990 detail below.</span>
        )}
      </span>
      {opts.locked ? (
        <div className="w-40 rounded-md bg-muted px-2 py-1 text-right text-xs font-semibold tabular-nums">
          {fmtAmt(opts.lockedValue ?? null)}
        </div>
      ) : (
        <Input
          className="h-7 w-40 text-xs text-right"
          aria-label={label}
          inputMode="decimal"
          value={draft[key] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  const computedRow = (label: string, value: number | null, opts: { total?: boolean } = {}) => (
    <div
      key={label}
      className={`flex items-center justify-between gap-3 bg-muted/40 px-3 py-1.5 ${opts.total ? "border-t-2" : ""}`}
    >
      <span className="text-xs font-semibold">{label}</span>
      <div className="w-40 rounded-md bg-muted px-2 py-1 text-right text-xs font-bold tabular-nums">
        {fmtAmt(value)}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-display">Financial Statements</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-56">
                <Select value={formType} onValueChange={(v) => setFormType.mutate(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IRS_FORM_TYPES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={() => createYear.mutate()} disabled={createYear.isPending}>
                <Plus className="h-3.5 w-3.5" /> Add Fiscal Year
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : statements.length === 0 ? (
            <p className="text-xs text-muted-foreground">No fiscal years recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {statements.map((s: any) => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={s.id === selectedId ? "default" : "outline"}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.fiscal_year_label || `FY${s.fiscal_year}`}
                  {s.is_draft === false && <Badge variant="outline" className="ml-2 text-[9px]">Final</Badge>}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {vis.unsupportedMessage && (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">{vis.unsupportedMessage}</CardContent>
        </Card>
      )}

      {selected && !vis.unsupportedMessage && (
        <>
          {affectedMeetings(selected.id, selected.updated_at).length > 0 && (
            <Card className="border-l-4 border-l-warning">
              <CardContent className="py-3 space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Finalized minutes affected by amendments to this statement
                </p>
                {affectedMeetings(selected.id, selected.updated_at).map((snap: any) => (
                  <p key={snap.id} className="text-xs text-muted-foreground">
                    <Link
                      className="underline"
                      to={`/company/${companyId}/meetings/${snap.meeting_id}`}
                    >
                      {snap.meeting?.meeting_type || "Meeting"} — {snap.meeting?.meeting_date}
                    </Link>
                    {": "}
                    {amendedSinceFinalizeNotice(selected.fiscal_year, snap.meeting?.meeting_date || "")}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display">
                  {draft.fiscal_year_label || `FY${draft.fiscal_year}`} — Details
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={exportPdf}>
                    <Download className="h-3.5 w-3.5" /> Export PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteTarget(selected)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                  <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                    {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Fiscal Year (year period ends)</Label>
                  <Input
                    type="number"
                    value={draft.fiscal_year ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, fiscal_year: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Display Label</Label>
                  <Input
                    value={draft.fiscal_year_label ?? ""}
                    placeholder={defaultFiscalYearLabel(Number(draft.fiscal_year) || 0)}
                    onChange={(e) => setDraft((d) => ({ ...d, fiscal_year_label: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Return Filed</Label>
                  <Input
                    type="date"
                    value={draft.return_filed_date ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, return_filed_date: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    checked={draft.is_draft === false}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, is_draft: !v }))}
                  />
                  <Label className="text-xs">Final</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border px-3 py-2.5 space-y-2">
                  <Label className="text-xs font-medium">Period</Label>
                  {draft.has_irregular_period ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        aria-label="Period Start"
                        className="h-8 text-xs"
                        value={draft.period_start ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, period_start: e.target.value }))}
                      />
                      <span className="text-xs text-muted-foreground">–</span>
                      <Input
                        type="date"
                        aria-label="Period End"
                        className="h-8 text-xs"
                        value={draft.period_end ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, period_end: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <p className="text-xs">
                      Period: {fmtPeriodDate(derivedPeriod.start)} – {fmtPeriodDate(derivedPeriod.end)}
                    </p>
                  )}
                  {derivedPeriod.usedCalendarFallback && !draft.has_irregular_period && (
                    <p className="text-[10px] text-muted-foreground">
                      {NO_FISCAL_YEAR_END_NOTE}{" "}
                      <Link className="underline" to={`/company/${companyId}#incorporation`}>
                        Company record
                      </Link>
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="irregular-period"
                      checked={!!draft.has_irregular_period}
                      onCheckedChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          has_irregular_period: !!v,
                          period_start: !!v ? (d.period_start ?? derivedPeriod.start) : d.period_start,
                          period_end: !!v ? (d.period_end ?? derivedPeriod.end) : d.period_end,
                        }))
                      }
                    />
                    <Label htmlFor="irregular-period" className="text-xs font-normal">
                      Short or irregular fiscal period
                    </Label>
                  </div>
                </div>

                <div className="rounded-md border px-3 py-2.5 space-y-1">
                  <Label className="text-xs font-medium">Board Reviewed</Label>
                  {selected.board_reviewed_date ? (
                    <>
                      <p className="text-xs">{selected.board_reviewed_date}</p>
                      {selected.board_review_meeting_id ? (
                        <Link
                          className="text-[11px] underline"
                          to={`/company/${companyId}/meetings/${selected.board_review_meeting_id}`}
                        >
                          View the meeting that adopted these figures
                        </Link>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">{MANUAL_REVIEW_DATE_NOTE}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pending Review</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Set automatically when a meeting reviewing this fiscal year is finalized.
                  </p>
                </div>
              </div>

              {vis.showConfirmationBlock ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 pt-5">
                    <Switch
                      checked={!!draft.gross_receipts_under_threshold}
                      onCheckedChange={(v) => setDraft((d) => ({ ...d, gross_receipts_under_threshold: v }))}
                    />
                    <Label className="text-xs">Gross receipts under the filing threshold</Label>
                  </div>
                  <div>
                    <Label className="text-xs">Board Acknowledgment</Label>
                    <Input
                      value={draft.board_acknowledgment ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, board_acknowledgment: e.target.value }))}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {vis.note && <p className="text-xs text-muted-foreground">{vis.note}</p>}

                  <div className="rounded-md border bg-muted/30 px-3 py-2.5">
                    <Label className="text-xs font-medium">Source of these figures</Label>
                    <RadioGroup
                      className="mt-2 flex flex-wrap gap-5"
                      value={sourceTag}
                      onValueChange={(v) => setSourceTag(v as SourceTag)}
                    >
                      {STATEMENT_SOURCES.map((o) => (
                        <div key={o.value} className="flex items-center gap-2">
                          <RadioGroupItem value={o.value} id={`src-${o.value}`} />
                          <Label htmlFor={`src-${o.value}`} className="text-xs font-normal">
                            {o.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Applies to every figure in this statement.
                    </p>
                    {consistencyNote && (
                      <p className="mt-1 text-[10px] text-muted-foreground">{consistencyNote}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Board Review Figures
                    </p>
                    <div className="rounded-md border divide-y">
                      {amountRow("Total Revenue", "total_revenue", {
                        locked: derived.revenueDetailTotal != null,
                        lockedValue: derived.totalRevenue,
                      })}
                      {amountRow("Total Expenses", "total_expenses", {
                        locked: derived.expenseDetailTotal != null,
                        lockedValue: derived.totalExpenses,
                      })}
                      {computedRow("Change in Net Assets", derived.changeInNetAssets)}
                      {amountRow("Net Assets, Beginning of Year", "net_assets_beginning", {
                        ref: "990 Part XI line 4",
                      })}
                      {computedRow("Net Assets, End of Year", derived.ending, { total: true })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTier2Open((o) => !o)}
                    >
                      {tier2Open ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                      Add detail from Form 990
                    </Button>

                    {tier2Open && (
                      <div className="space-y-5">
                        {vis.showRevenueDetail && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Support &amp; Revenue{" "}
                              <span className="font-normal normal-case text-muted-foreground">
                                (Form 990 Part VIII)
                              </span>
                            </p>
                            <div className="rounded-md border divide-y">
                              {REVENUE_FIELDS.map((f) => amountRow(f.label, f.key, { ref: f.ref }))}
                              {computedRow("TOTAL SUPPORT & REVENUE", derived.revenueDetailTotal, {
                                total: true,
                              })}
                            </div>
                          </div>
                        )}

                        {vis.showFunctionalSplit && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Expenses by Function{" "}
                              <span className="font-normal normal-case text-muted-foreground">
                                (Form 990 Part IX)
                              </span>
                            </p>
                            <div className="rounded-md border divide-y">
                              {FUNCTIONAL_EXPENSE_FIELDS.map((f) =>
                                amountRow(f.label, f.key, { ref: f.ref }),
                              )}
                              {computedRow("TOTAL EXPENSES", derived.expenseDetailTotal, { total: true })}
                            </div>
                          </div>
                        )}

                        {vis.showNetAssets && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              Net Assets &amp; Balance Sheet{" "}
                              <span className="font-normal normal-case text-muted-foreground">
                                (Form 990 Part X)
                              </span>
                            </p>
                            <div className="rounded-md border divide-y">
                              {amountRow("Without Donor Restrictions", "net_assets_without_restrictions", {
                                ref: "990 Part X line 27",
                              })}
                              {amountRow("With Donor Restrictions", "net_assets_with_restrictions", {
                                ref: "990 Part X line 28",
                              })}
                              {computedRow("Net Assets (restriction split total)", derived.restrictionTotal)}
                              {amountRow("Total Assets", "total_assets", { ref: "990 Part X line 16" })}
                              {amountRow("Total Liabilities", "total_liabilities", {
                                ref: "990 Part X line 26",
                              })}
                              {computedRow(
                                "Net Assets (assets − liabilities)",
                                derived.assetsLessLiabilities,
                                { total: true },
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-md border border-warning/40 bg-warning/5 p-3 space-y-2">
                  <p className="text-xs font-medium flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Reconciliation warnings
                  </p>
                  {warnings.map((w) => (
                    <div key={w.code} className="flex items-start justify-between gap-3">
                      <p className={`text-xs ${w.prominent ? "font-medium" : ""}`}>
                        {w.label}: {w.left} vs {w.right} — difference{" "}
                        {w.difference.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => dismissWarning(w.code)}>
                        Accept
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {(selected.dismissed_warnings || []).length > 0 && (
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <p className="font-medium">Previously accepted differences:</p>
                  {(selected.dismissed_warnings as any[]).map((w, i) => (
                    <p key={i}>
                      {w.message} {w.dismissed_by ? `(accepted by ${w.dismissed_by})` : ""}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <NonprofitStatementView
            companyName={company?.name || "Organization"}
            formType={formType}
            statement={effectiveStatement}
            priorYear={priorYear}
          />
        </>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Delete financial statement"
        description={
          deleteTarget && finalizedMeetings.some((s: any) => s.source_statement_id === deleteTarget.id)
            ? "This statement is referenced by finalized minutes. Those minutes will keep the figures recorded at the time they were finalized. Delete the statement?"
            : "Delete this fiscal year's financial statement?"
        }
      />
    </div>
  );
}
