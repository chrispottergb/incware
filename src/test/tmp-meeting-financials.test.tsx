import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MeetingFinancials from "@/components/meeting/MeetingFinancials";

const state: any = {
  financials: null,
  meeting: { id: "m1", company_id: "c1", meeting_date: "2026-06-04", meeting_type: "Annual Meeting" },
};
const calls: any[] = [];

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("recharts", () => ({
  BarChart: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: () => null,
  LabelList: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

function makeBuilder(table: string) {
  const b: any = { _op: "select", _neq: false };
  b.select = () => b;
  b.eq = () => b;
  b.neq = () => { b._neq = true; return b; };
  b.order = () => b;
  b.limit = () => b;
  b.maybeSingle = async () => {
    if (table === "meeting_financials") return { data: state.financials, error: null };
    if (table === "meetings") return { data: state.meeting, error: null };
    return { data: null, error: null };
  };
  b.update = (payload: any) => {
    b._op = "update";
    calls.push({ table, op: "update", payload });
    if (table === "meeting_financials") {
      state.financials = { ...state.financials, ...payload, updated_at: `bump-${calls.length}` };
    }
    return b;
  };
  b.insert = (payload: any) => {
    b._op = "insert";
    calls.push({ table, op: "insert", payload });
    return b;
  };
  b.delete = () => { b._op = "delete"; return b; };
  b.then = (res: any, rej: any) => {
    const out =
      b._op === "select"
        ? { data: [], error: null } // list queries: NR items, prior meetings
        : { error: null };
    return Promise.resolve(out).then(res, rej);
  };
  return b;
}

describe("MeetingFinancials YoY", () => {
  it("recomputes YoY when values are corrected (live, after refetch, no clobber, no echo save)", async () => {
    state.financials = {
      id: "f1",
      meeting_id: "m1",
      current_total_sales: 11319673,
      current_cog: 9023033,
      current_gross_profit: 2296640,
      current_cog_ratio: 79.71,
      current_net_income: 461942,
      previous_total_sales: 12083877,
      previous_cog: 10325370,
      previous_gross_profit: 1758507,
      previous_cog_ratio: 85.45,
      previous_net_income: 100499,
      updated_at: "t1",
    };

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MeetingFinancials meetingId="m1" />
      </QueryClientProvider>
    );

    // 1) Initial hydration + YoY
    await screen.findByDisplayValue("$461,942.00");
    expect(screen.getByText(/359\.6%/)).toBeTruthy();

    // 2) No echo save: viewing the tab must not write anything back
    await new Promise((r) => setTimeout(r, 2600));
    expect(calls.filter((c) => c.table === "meeting_financials")).toHaveLength(0);

    // 3) Server-side correction arrives (e.g. saved from another mount / stale cache refresh)
    state.financials = { ...state.financials, current_net_income: 561942, updated_at: "t2" };
    await qc.invalidateQueries({ queryKey: ["meeting_financials", "m1"] });
    await screen.findByDisplayValue("$561,942.00");
    expect(screen.getByText(/459\.2%/)).toBeTruthy(); // (561942-100499)/100499 = 459.15%

    // 4) Live typing updates YoY immediately
    const input = screen.getByDisplayValue("$561,942.00");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "200998" } });
    expect(screen.getByText(/100\.0%/)).toBeTruthy(); // (200998-100499)/100499 = 100%

    // 5) Blur triggers save with the corrected number, and refetch doesn't clobber it
    fireEvent.blur(input);
    await waitFor(() => {
      const upd = calls.find((c) => c.table === "meeting_financials" && c.op === "update");
      expect(upd?.payload.current_net_income).toBe(200998);
    }, { timeout: 4000 });
    await waitFor(() => {
      expect(screen.getByDisplayValue("$200,998.00")).toBeTruthy();
      expect(screen.getByText(/100\.0%/)).toBeTruthy();
    }, { timeout: 4000 });
  }, 20000);
});
