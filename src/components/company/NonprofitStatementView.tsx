import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildStatementHeader,
  computeRatios,
  getFormVisibility,
  formatMoney,
  hasBoardReviewFigures,
  yoyPercent,
  BOARD_REVIEW_FIELDS,
  EMPTY_STATEMENT_NOTE,
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
 * Read-only rendering of a nonprofit annual financial review. Used on the
 * company Financial Statements tab and inside nonprofit meetings (live for
 * drafts, from the frozen snapshot for finalized minutes).
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

  const hasFigures = hasBoardReviewFigures(statement);
  const ratios = vis.showRatios ? computeRatios(statement) : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">{companyName}</CardTitle>
          <p className="text-sm font-medium">{header.title}</p>
          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            <p>{header.fiscalYearLine}</p>
            {header.periodLine && <p>{header.periodLine}</p>}
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
            {!hasFigures ? (
              <p className="text-xs text-muted-foreground">{EMPTY_STATEMENT_NOTE}</p>
            ) : (
              <>
                {renderTable("Annual Financial Review", BOARD_REVIEW_FIELDS.map((f) => ({ ...f })) as Row[])}

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
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
