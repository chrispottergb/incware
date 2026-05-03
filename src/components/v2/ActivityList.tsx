import type { ActivityItem } from "@/data/v2-activity";

const toneColor = (t: ActivityItem["tone"]) =>
  t === "warn" ? "var(--v2-status-overdue-fg)"
  : t === "success" ? "var(--v2-status-current-fg)"
  : "var(--v2-text-secondary)";

export function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <li key={it.id} className="flex items-start gap-2.5">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: "var(--v2-bg-page)" }}
            >
              <Icon size={13} style={{ color: toneColor(it.tone) }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] leading-snug" style={{ color: "var(--v2-text-primary)" }}>{it.body}</div>
              <div className="v2-mono text-[10.5px] mt-0.5" style={{ color: "var(--v2-text-meta)" }}>{it.meta}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
