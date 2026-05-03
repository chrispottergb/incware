import { useOutletContext } from "react-router-dom";
import { TopBar } from "@/components/v2/TopBar";
import { KpiCard } from "@/components/v2/KpiCard";
import { DonutRing } from "@/components/v2/DonutRing";
import { StackedBar } from "@/components/v2/StackedBar";
import { DeadlineRow } from "@/components/v2/DeadlineRow";
import { ActivityList } from "@/components/v2/ActivityList";
import { RecentlyViewed } from "@/components/v2/RecentlyViewed";
import { CopilotCard } from "@/components/v2/CopilotCard";
import { v2Kpis } from "@/data/v2-kpis";
import { v2Deadlines } from "@/data/v2-deadlines";
import { v2Activity } from "@/data/v2-activity";
import { v2Clients } from "@/data/v2-clients";
import { Download, Zap } from "lucide-react";

type Ctx = { mode: "light" | "dark"; toggle: () => void };

export default function DashboardV2() {
  const { mode, toggle } = useOutletContext<Ctx>();
  const recent = v2Clients.slice(0, 4);
  const segments = [
    { label: "LLC 12", value: 12, color: "var(--v2-brand)" },
    { label: "Corp 10", value: 10, color: "var(--v2-info-blue-fg)" },
    { label: "S-Corp 7", value: 7, color: "var(--v2-status-current-fg)" },
    { label: "Partnership 3", value: 3, color: "var(--v2-status-due-fg)" },
    { label: "Trust 2", value: 2, color: "var(--v2-violet)" },
  ];

  return (
    <>
      <TopBar
        crumbs={[{ label: "Dashboard", current: true }]}
        mode={mode}
        onToggleTheme={toggle}
        primaryAction={{ label: "New", onClick: () => console.log("new"), testId: "topbar-new-btn" }}
      />

      <main className="px-7 py-6 space-y-6">
        {/* Hero */}
        <section className="flex items-end justify-between gap-6">
          <div>
            <h1 className="v2-serif font-semibold leading-tight" style={{ fontSize: 32 }}>Good morning, Jordan.</h1>
            <p className="text-[13.5px] mt-1.5" style={{ color: "var(--v2-text-secondary)" }}>
              You have <span style={{ color: "var(--v2-status-due-fg)", fontWeight: 600 }}>2 filings due this week</span>{" "}
              and <span style={{ color: "var(--v2-status-overdue-fg)", fontWeight: 600 }}>1 overdue</span>{" "}
              across 34 active clients.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 px-3 rounded-md border text-[12.5px] flex items-center gap-1.5 hover:bg-[color:var(--v2-row-hover)] transition-colors duration-150"
              style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
            >
              <Download size={13} /> Export report
            </button>
            <button
              data-testid="run-review-btn"
              className="h-9 px-3.5 rounded-md text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
              style={{ background: "var(--v2-brand)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-brand-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--v2-brand)")}
            >
              <Zap size={13} /> Run EntityIQ Review
            </button>
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-4 gap-3.5">
          {v2Kpis.map((k) => <KpiCard key={k.id} kpi={k} />)}
        </section>

        {/* Deadlines + Compliance */}
        <section className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
          <Card>
            <CardHeader title="Upcoming deadlines" sub="Next 14 days · sorted by urgency" link="View all filings →" />
            <div className="px-4 divide-y" style={{ borderColor: "var(--v2-border)" }}>
              {v2Deadlines.map((d) => (
                <div key={d.id} className="border-t first:border-t-0" style={{ borderColor: "var(--v2-border)" }}>
                  <DeadlineRow d={d} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Compliance health" sub="Across 34 active entities" />
            <div className="p-5 flex items-center gap-5">
              <DonutRing percent={90} />
              <ul className="flex-1 space-y-1.5 text-[12.5px]">
                <Legend dot="var(--v2-status-current-fg)" label="Current" value={27} />
                <Legend dot="var(--v2-status-due-fg)" label="Due soon" value={5} />
                <Legend dot="var(--v2-status-overdue-fg)" label="Overdue" value={1} />
                <Legend dot="var(--v2-violet)" label="Needs review" value={1} />
              </ul>
            </div>
            <div className="px-5 pb-5">
              <div className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: "var(--v2-text-meta)" }}>By entity type</div>
              <StackedBar segments={segments} total={34} />
            </div>
          </Card>
        </section>

        {/* Bottom row */}
        <section className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader title="Recent activity" sub="Last 24 hours" />
            <div className="p-5 pt-3"><ActivityList items={v2Activity} /></div>
          </Card>
          <Card>
            <CardHeader title="Recently viewed" />
            <div className="p-5 pt-3"><RecentlyViewed rows={recent} /></div>
          </Card>
          <CopilotCard />
        </section>
      </main>
    </>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[10px] border flex flex-col"
      style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, sub, link }: { title: string; sub?: string; link?: string }) {
  return (
    <div className="flex items-start justify-between p-5 pb-3">
      <div>
        <h3 className="v2-serif text-[16px] font-semibold leading-tight">{title}</h3>
        {sub && <p className="text-[12px] mt-1" style={{ color: "var(--v2-text-meta)" }}>{sub}</p>}
      </div>
      {link && (
        <button className="text-[12px] hover:underline" style={{ color: "var(--v2-brand)" }}>{link}</button>
      )}
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2" style={{ color: "var(--v2-text-secondary)" }}>
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="flex-1">{label}</span>
      <span className="v2-mono" style={{ color: "var(--v2-text-primary)" }}>{value}</span>
    </li>
  );
}
