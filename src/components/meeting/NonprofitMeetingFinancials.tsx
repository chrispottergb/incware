import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Lock, Unlock } from "lucide-react";
import MeetingFinancials from "@/components/meeting/MeetingFinancials";
import NonprofitStatementView from "@/components/company/NonprofitStatementView";
import PrintPreviewButton from "@/components/meeting/PrintPreviewButton";
import { generateNonprofitFinancialStatementPDF } from "@/lib/nonprofit-financial-statement-pdf";
import { exportFinancialsPDF } from "@/lib/meeting-pdf-export";
import {
  LEGACY_MEETING_FINANCIALS_NOTE,
  amendedSinceFinalizeNotice,
  type IrsFormType,
  type NonprofitStatement,
} from "@/lib/nonprofit-financials";

interface Props {
  meetingId: string;
  meeting: any;
  company: any;
}

/**
 * Nonprofit financial display inside a meeting.
 *
 * Draft minutes read the matching fiscal year's statement live. Finalizing the
 * minutes freezes an immutable snapshot, and a finalized meeting always renders
 * from that snapshot — never from the live statement.
 */
export default function NonprofitMeetingFinancials({ meetingId, meeting, company }: Props) {
  const queryClient = useQueryClient();
  const isFinal = (meeting?.document_status ?? "").toLowerCase() === "final";
  const formType = (company?.irs_form_type ?? null) as IrsFormType | null;
  const fiscalYear: number | null =
    meeting?.tax_year ?? (meeting?.meeting_date ? new Date(`${meeting.meeting_date}T00:00:00`).getFullYear() - 1 : null);

  const { data: snapshot } = useQuery({
    queryKey: ["meeting_financial_snapshot", meetingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_financial_snapshots" as any)
        .select("*")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: statements = [] } = useQuery({
    queryKey: ["nonprofit_financial_statements", company?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("nonprofit_financial_statements" as any)
        .select("*")
        .eq("company_id", company.id)
        .order("fiscal_year", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!company?.id,
  });

  const { data: legacyFinancials } = useQuery({
    queryKey: ["meeting_financials_exists", meetingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meeting_financials")
        .select("id, current_total_sales, current_cog, current_net_income")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      return data;
    },
  });

  const statement = statements.find((s: any) => s.fiscal_year === fiscalYear) || null;
  const priorYear = statements.find((s: any) => s.fiscal_year === (fiscalYear ?? 0) - 1) || null;

  const setStatus = useMutation({
    mutationFn: async (next: "final" | "draft") => {
      if (next === "final") {
        if (statement) {
          await supabase.from("meeting_financial_snapshots" as any).upsert(
            {
              meeting_id: meetingId,
              source_statement_id: statement.id,
              source_statement_updated_at: statement.updated_at,
              snapshot_data: { statement, priorYear, formType, companyName: company?.name },
              snapshotted_at: new Date().toISOString(),
            } as any,
            { onConflict: "meeting_id" } as any,
          );
          // Board review is system-populated from the earliest finalized meeting
          // that adopted this statement.
          const reviewDate: string | null = meeting?.meeting_date || null;
          const currentLinked = statement.board_review_meeting_id;
          const currentDate = statement.board_reviewed_date;
          if (reviewDate && (!currentLinked || !currentDate || reviewDate < currentDate)) {
            await supabase
              .from("nonprofit_financial_statements" as any)
              .update({ board_reviewed_date: reviewDate, board_review_meeting_id: meetingId } as any)
              .eq("id", statement.id);
          }
        }
      } else {
        await supabase.from("meeting_financial_snapshots" as any).delete().eq("meeting_id", meetingId);
        if (statement?.board_review_meeting_id === meetingId) {
          // Fall back to the next earliest finalized meeting still adopting this statement.
          const { data: others } = await supabase
            .from("meeting_financial_snapshots" as any)
            .select("meeting_id, meetings!inner(id, meeting_date, document_status)")
            .eq("source_statement_id", statement.id)
            .neq("meeting_id", meetingId);
          const candidates = ((others as any[]) || [])
            .map((r) => r.meetings)
            .filter((m: any) => m && String(m.document_status || "").toLowerCase() === "final")
            .sort((a: any, b: any) => String(a.meeting_date).localeCompare(String(b.meeting_date)));
          const next2 = candidates[0];
          await supabase
            .from("nonprofit_financial_statements" as any)
            .update({
              board_reviewed_date: next2?.meeting_date ?? null,
              board_review_meeting_id: next2?.id ?? null,
            } as any)
            .eq("id", statement.id);
        }
      }
      const { error } = await supabase.from("meetings").update({ document_status: next }).eq("id", meetingId);
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting_financial_snapshot", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["nonprofit_snapshot_meetings", company?.id] });
      queryClient.invalidateQueries({ queryKey: ["nonprofit_financial_statements", company?.id] });
      toast.success(next === "final" ? "Minutes finalized. Figures frozen." : "Minutes returned to draft.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amended =
    isFinal &&
    snapshot?.source_statement_id &&
    statement &&
    snapshot.source_statement_updated_at &&
    new Date(statement.updated_at).getTime() > new Date(snapshot.source_statement_updated_at).getTime();

  const finalizeBar = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={isFinal ? "default" : "outline"} className="text-[10px]">
          {isFinal ? "Finalized" : "Draft"}
        </Badge>
        {isFinal && snapshot && (
          <span className="text-[11px] text-muted-foreground">
            Figures frozen {String(snapshot.snapshotted_at).slice(0, 10)}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setStatus.mutate(isFinal ? "draft" : "final")}
        disabled={setStatus.isPending}
      >
        {isFinal ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        {isFinal ? "Return to Draft" : "Finalize Minutes"}
      </Button>
    </div>
  );

  // Finalized, with a frozen snapshot → always render the snapshot.
  if (isFinal && snapshot?.snapshot_data?.statement) {
    const snap = snapshot.snapshot_data;
    return (
      <div className="space-y-4">
        {finalizeBar}
        {amended && (
          <Card className="border-l-4 border-l-warning">
            <CardContent className="py-3 text-xs flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
              {amendedSinceFinalizeNotice(statement!.fiscal_year, meeting?.meeting_date || "")}
            </CardContent>
          </Card>
        )}
        <NonprofitStatementView
          companyName={snap.companyName || company?.name || "Organization"}
          formType={snap.formType ?? formType}
          statement={snap.statement as NonprofitStatement}
          priorYear={snap.priorYear || null}
        />
      </div>
    );
  }

  // Finalized before nonprofit statement reporting existed → legacy card.
  if (isFinal && legacyFinancials) {
    return (
      <div className="space-y-4">
        {finalizeBar}
        <p className="text-xs text-muted-foreground">{LEGACY_MEETING_FINANCIALS_NOTE}</p>
        <MeetingFinancials meetingId={meetingId} />
      </div>
    );
  }

  // Draft → live read.
  return (
    <div className="space-y-4">
      {finalizeBar}
      {!formType ? (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            Select the IRS return this organization files on the{" "}
            <Link className="underline" to={`/company/${company?.id}#financial-statements`}>
              Financial Statements
            </Link>{" "}
            tab before financial figures can be shown.
          </CardContent>
        </Card>
      ) : statement ? (
        <>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-3 text-xs flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                These figures are shown here for the minutes only. Enter or change the numbers for
                FY{fiscalYear ?? "—"} on the Financial Statements tab; they update here automatically.
              </span>
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to={`/company/${company?.id}#financial-statements`}>Edit FY{fiscalYear ?? ""} figures</Link>
              </Button>
            </CardContent>
          </Card>
          <NonprofitStatementView
            companyName={company?.name || "Organization"}
            formType={formType}
            statement={statement as NonprofitStatement}
            priorYear={priorYear}
          />
        </>
      ) : (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            No financial statement recorded for FY{fiscalYear ?? "—"}.{" "}
            <Link className="underline" to={`/company/${company?.id}#financial-statements`}>
              Create it on the Financial Statements tab
            </Link>
            .
          </CardContent>
        </Card>
      )}
    </div>
  );
}
