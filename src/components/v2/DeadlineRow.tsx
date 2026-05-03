import type { Deadline } from "@/data/v2-deadlines";
import { Building2 } from "lucide-react";

const chipStyle = (s: Deadline["status"]) => {
  if (s === "overdue") return { background: "var(--v2-status-overdue-bg)", color: "var(--v2-status-overdue-fg)" };
  if (s === "due-soon") return { background: "var(--v2-status-due-bg)", color: "var(--v2-status-due-fg)" };
  return { background: "var(--v2-bg-page)", color: "var(--v2-text-secondary)" };
};

export function DeadlineRow({ d }: { d: Deadline }) {
  const testId = `deadline-row-${d.entity.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div
      data-testid={testId}
      className="flex items-center gap-3.5 py-3"
    >
      <div
        className="h-[52px] w-[52px] rounded-[10px] border flex flex-col items-center justify-center shrink-0"
        style={{
          ...chipStyle(d.status),
          borderColor: d.status === "later" ? "var(--v2-border)" : "transparent",
        }}
      >
        <span className="text-[10px] uppercase tracking-wider leading-none">{d.month}</span>
        <span className="v2-serif font-semibold leading-none mt-1" style={{ fontSize: 20 }}>{d.day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13.5px] font-medium" style={{ color: "var(--v2-text-primary)" }}>{d.title}</span>
          {d.form && <span className="v2-mono text-[11px]" style={{ color: "var(--v2-text-meta)" }}>· {d.form}</span>}
          <span
            className="text-[10.5px] px-1.5 py-0.5 rounded-full"
            style={chipStyle(d.status)}
          >
            {d.statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 text-[12px]" style={{ color: "var(--v2-text-secondary)" }}>
          <Building2 size={12} style={{ color: "var(--v2-brand)" }} />
          <span>{d.entity}</span>
          <span style={{ color: "var(--v2-text-meta)" }}>· {d.type} · {d.state}</span>
        </div>
      </div>
      <button
        className="h-8 px-3 rounded-md border text-[12px] font-medium hover:bg-[color:var(--v2-row-hover)] transition-colors duration-150"
        style={{
          borderColor: d.status === "overdue" ? "var(--v2-brand)" : "var(--v2-border)",
          color: d.status === "overdue" ? "var(--v2-brand)" : "var(--v2-text-primary)",
        }}
      >
        {d.cta}
      </button>
    </div>
  );
}
