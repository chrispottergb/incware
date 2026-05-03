import { Sparkline } from "./Sparkline";
import type { Kpi } from "@/data/v2-kpis";
import { TrendingUp, AlertCircle } from "lucide-react";

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const valueColor = kpi.valueTone === "danger" ? "var(--v2-status-overdue-fg)" : "var(--v2-text-primary)";
  const chipBg =
    kpi.deltaTone === "up" ? "var(--v2-status-current-bg)"
    : kpi.deltaTone === "warn" ? "var(--v2-status-overdue-bg)"
    : "var(--v2-status-due-bg)";
  const chipFg =
    kpi.deltaTone === "up" ? "var(--v2-status-current-fg)"
    : kpi.deltaTone === "warn" ? "var(--v2-status-overdue-fg)"
    : "var(--v2-status-due-fg)";

  return (
    <div
      data-testid={kpi.testId}
      className="rounded-[10px] border p-4 flex flex-col gap-3"
      style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.1em]" style={{ color: "var(--v2-text-meta)" }}>
          {kpi.label}
        </span>
        {kpi.deltaTone === "warn" ? (
          <AlertCircle size={13} style={{ color: "var(--v2-status-overdue-fg)" }} />
        ) : (
          <TrendingUp size={13} style={{ color: "var(--v2-text-meta)" }} />
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="v2-serif font-semibold leading-none" style={{ fontSize: 32, color: valueColor }}>
            {kpi.value}
          </div>
          <span
            className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: chipBg, color: chipFg }}
          >
            {kpi.delta}
          </span>
        </div>
        <Sparkline data={kpi.spark} tone={kpi.sparkTone} />
      </div>
    </div>
  );
}
