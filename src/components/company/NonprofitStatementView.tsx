import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildStatementHeader,
  computeRatios,
  getFormVisibility,
  formatMoney,
  yoyPercent,
  REVENUE_FIELDS,
  REVENUE_TOTAL_FIELD,
  FUNCTIONAL_EXPENSE_FIELDS,
  EXPENSE_TOTAL_FIELD,
  NET_ASSET_FIELDS,
  SOURCE_TAG_LABELS,
  type IrsFormType,
  type NonprofitStatement,
  type SourceTag,
} from "@/lib/nonprofit-financials";

interface Row {
  key: string;
  label: string;
  ref: string;
  total?: boolean;
  indent?: boolean;
}

interface Props {
  companyName: string;
  formType: IrsFormType | null;
  statement: NonprofitStatement;
  priorYear?: NonprofitStatement | null;
}

/**
 * Read-only rendering of a nonprofit financial statement. Used on the company
 * Financial Statements tab and inside nonprofit meetings (live for drafts,
 * from the frozen snapshot for finalized minutes).
 */
export default function NonprofitStatementView({ companyName, formType, statement, priorYear }: Props) {
  const vis = getFormVisibility(formType);
  const header = buildStatementHeader(statement);
  const tags = (statement.source_tags || {}) as Record<string, SourceTag>;

  const renderTable = (title: string, rows: Row[]) => (
    <div className="space-y-1">
      <h4 className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-primary/10">
            <th className="text-left font-medium px-2 py-1.5">Line</th>
            <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">Current Year</th>
            <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">Prior Year</th>
            <th className="text-right font-medium px-2 py-1.5 whitespace-nowrap">YoY %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const yoy = priorYear ? yoyPercent(statement[r.key], priorYear[r.key]) : null;
            return (
              <tr key={r.key} className={r.total ? "border-t border-border font-semibold" : ""}>
                <td className={`px-2 py-1 ${r.indent ? "pl-6" : ""}`}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{r.label}</span>
                      </TooltipTrigger>
                      <TooltipContent>{r.ref}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {tags[r.key] && (
                    <Badge variant="outline" className="ml-2 text-[9px] py-0">
                      {SOURCE_TAG_LABELS[tags[r.key]]}
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">{formatMoney(statement[r.key]) || "—"}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap">
                  {priorYear ? formatMoney(priorYear[r.key]) || "—" : "—"}
                </td>
                <td className="px-2 py-1 text-right whitespace-nowrap">{yoy == null ? "—" : `${yoy.toFixed(1)}%`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (vis.unsupportedMessage) {
    return (
      <Card>
        <CardContent className="py-4 text-xs text-muted-foreground">{vis.unsupportedMessage}</CardContent>
      </Card>
    );
  }

  const ratios = vis.showRatios ? computeRatios(statement) : [];

  const split = FUNCTIONAL_EXPENSE_FIELDS.map((f) => {
    const v = statement[f.key];
    return v === null || v === undefined || v === "" ? null : Number(v);
  });
  const splitComplete = split.every((v) => v != null);
  const splitTotal = splitComplete ? (split as number[]).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">{companyName}</CardTitle>
          <p className="text-sm font-medium">{header.title}</p>
          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            <p>{header.fiscalYearLine}</p>
            <p>{header.sourceLine}</p>
            <p>{header.statusLine}</p>
            <p>{header.documentedLine}</p>
            <p>{header.boardReviewedLine}</p>
          </div>
          {header.postFilingNote && (
            <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded px-2 py-1.5 mt-2">
              {header.postFilingNote}
            </p>
          )}
        </CardHeader>
        {vis.showConfirmationBlock ? (
          <CardContent className="text-xs space-y-1">
            <p>Fiscal Year: FY{statement.fiscal_year}</p>
            <p>
              Gross receipts under the filing threshold:{" "}
              {statement.gross_receipts_under_threshold ? "Yes" : "No"}
            </p>
            <p>Board acknowledgment: {statement.board_acknowledgment || "—"}</p>
          </CardContent>
        ) : (
          <CardContent className="space-y-5">
            {vis.showRevenueDetail &&
              renderTable("Support & Revenue", [
                ...REVENUE_FIELDS.map((f) => ({ ...f })),
                { ...REVENUE_TOTAL_FIELD, total: true },
              ] as Row[])}

            {renderTable(
              vis.showFunctionalSplit ? "Expenses by Function" : "Expenses",
              (vis.showFunctionalSplit
                ? [...FUNCTIONAL_EXPENSE_FIELDS.map((f) => ({ ...f })), { ...EXPENSE_TOTAL_FIELD, total: true }]
                : [{ ...EXPENSE_TOTAL_FIELD, label: "Total Expenses", total: true }]) as Row[],
            )}
            {vis.note && <p className="text-xs text-muted-foreground">{vis.note}</p>}

            {vis.showNetAssets && renderTable("Net Assets", NET_ASSET_FIELDS.map((f) => ({ ...f })) as Row[])}

            {ratios.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {ratios.map((r) => (
                  <TooltipProvider key={r.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-md border border-border p-3 cursor-help">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.label}</p>
                          <p className="text-sm font-semibold mt-1">{r.display}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{r.formula}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            )}

            {vis.showChart && splitComplete && splitTotal > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-display font-semibold uppercase tracking-wide text-muted-foreground">
                  Functional Expense Allocation
                </h4>
                {[
                  { label: `FY${statement.fiscal_year}`, src: statement },
                  ...(priorYear ? [{ label: `FY${priorYear.fiscal_year}`, src: priorYear }] : []),
                ].map((row) => {
                  const vals = FUNCTIONAL_EXPENSE_FIELDS.map((f) => Number(row.src[f.key] ?? 0));
                  const tot = vals.reduce((a, b) => a + b, 0);
                  if (!tot) return null;
                  return (
                    <div key={row.label}>
                      <p className="text-[10px] text-muted-foreground mb-1">{row.label}</p>
                      <div className="flex h-7 w-full overflow-hidden rounded">
                        {FUNCTIONAL_EXPENSE_FIELDS.map((f, i) => {
                          const pct = (vals[i] / tot) * 100;
                          if (pct <= 0) return null;
                          const shade = ["bg-primary", "bg-primary/60", "bg-primary/30"][i];
                          return (
                            <div
                              key={f.key}
                              className={`${shade} flex items-center justify-center text-[9px] text-primary-foreground overflow-hidden whitespace-nowrap`}
                              style={{ width: `${pct}%` }}
                              title={`${f.label}: ${formatMoney(vals[i])} (${pct.toFixed(1)}%)`}
                            >
                              {pct > 12 ? `${f.label} ${pct.toFixed(0)}%` : ""}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
