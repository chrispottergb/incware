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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import NonprofitStatementView from "@/components/company/NonprofitStatementView";
import { generateNonprofitFinancialStatementPDF } from "@/lib/nonprofit-financial-statement-pdf";
import {
  IRS_FORM_TYPES,
  SOURCE_TAGS,
  SOURCE_TAG_LABELS,
  REVENUE_FIELDS,
  REVENUE_TOTAL_FIELD,
  FUNCTIONAL_EXPENSE_FIELDS,
  EXPENSE_TOTAL_FIELD,
  NET_ASSET_FIELDS,
  amendedSinceFinalizeNotice,
  defaultFiscalYearLabel,
  getFormVisibility,
  runReconciliation,
  suggestFiscalYear,
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

export default function NonprofitFinancialStatementsTab({ companyId, company }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

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
    if (selected) setDraft({ ...selected });
  }, [selected?.id, selected?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const priorYear = useMemo(
    () =>
      draft.fiscal_year
        ? statements.find((s: any) => s.fiscal_year === Number(draft.fiscal_year) - 1) || null
        : null,
    [statements, draft.fiscal_year],
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
    return runReconciliation(
      { ...(draft as any), fiscal_year: Number(draft.fiscal_year) },
      formType,
      priorYear,
    ).filter((w) => !dismissed.has(w.code));
  }, [draft, formType, priorYear, selected]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        fiscal_year: Number(draft.fiscal_year),
        fiscal_year_label: draft.fiscal_year_label || defaultFiscalYearLabel(Number(draft.fiscal_year)),
        period_start: draft.period_start || null,
        period_end: draft.period_end || null,
        is_audited: !!draft.is_audited,
        is_draft: draft.is_draft !== false,
        return_filed_date: draft.return_filed_date || null,
        board_reviewed_date: draft.board_reviewed_date || null,
        gross_receipts_under_threshold: draft.gross_receipts_under_threshold ?? null,
        board_acknowledgment: draft.board_acknowledgment || null,
        source_tags: draft.source_tags || {},
      };
      for (const k of MONEY_KEYS) {
        const v = draft[k];
        payload[k] = v === "" || v === null || v === undefined ? null : Number(v);
      }
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
    setWarnings((prev) => prev.filter((x) => x.code !== code));
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
      statement: { ...(draft as NonprofitStatement), fiscal_year: Number(draft.fiscal_year) },
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

  const moneyRows = [
    ...(vis.showRevenueDetail
      ? [...REVENUE_FIELDS.map((f) => ({ ...f })), { ...REVENUE_TOTAL_FIELD }]
      : []),
    ...(vis.showFunctionalSplit ? FUNCTIONAL_EXPENSE_FIELDS.map((f) => ({ ...f })) : []),
    ...(vis.showStatement ? [{ ...EXPENSE_TOTAL_FIELD }] : []),
    ...(vis.showNetAssets ? NET_ASSET_FIELDS.map((f) => ({ ...f })) : []),
  ];

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
                  <Label className="text-xs">Period Start</Label>
                  <Input
                    type="date"
                    value={draft.period_start ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, period_start: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Period End</Label>
                  <Input
                    type="date"
                    value={draft.period_end ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, period_end: e.target.value }))}
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
                <div>
                  <Label className="text-xs">Board Reviewed</Label>
                  <Input
                    type="date"
                    value={draft.board_reviewed_date ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, board_reviewed_date: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    checked={!!draft.is_audited}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, is_audited: v }))}
                  />
                  <Label className="text-xs">Audited</Label>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch
                    checked={draft.is_draft === false}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, is_draft: !v }))}
                  />
                  <Label className="text-xs">Final</Label>
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
                <div className="space-y-1">
                  {vis.note && <p className="text-xs text-muted-foreground">{vis.note}</p>}
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary/10">
                        <th className="text-left px-2 py-1.5 font-medium">Line</th>
                        <th className="text-left px-2 py-1.5 font-medium w-40">Amount</th>
                        <th className="text-left px-2 py-1.5 font-medium w-40">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moneyRows.map((f) => (
                        <tr key={f.key}>
                          <td className="px-2 py-1" title={f.ref}>
                            {f.label}
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              className="h-7 text-xs"
                              aria-label={f.label}
                              inputMode="decimal"
                              value={draft[f.key] ?? ""}
                              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <Select
                              value={(draft.source_tags || {})[f.key] || "tax_return"}
                              onValueChange={(v) =>
                                setDraft((d) => ({
                                  ...d,
                                  source_tags: { ...(d.source_tags || {}), [f.key]: v as SourceTag },
                                }))
                              }
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {SOURCE_TAGS.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {SOURCE_TAG_LABELS[t]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
            statement={{ ...(draft as NonprofitStatement), fiscal_year: Number(draft.fiscal_year) }}
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
