import type { ClientStatus } from "@/data/v2-clients";

const map: Record<ClientStatus, { bg: string; fg: string; dot: string }> = {
  Current: { bg: "var(--v2-status-current-bg)", fg: "var(--v2-status-current-fg)", dot: "var(--v2-status-current-fg)" },
  "Due Soon": { bg: "var(--v2-status-due-bg)", fg: "var(--v2-status-due-fg)", dot: "var(--v2-status-due-fg)" },
  Overdue: { bg: "var(--v2-status-overdue-bg)", fg: "var(--v2-status-overdue-fg)", dot: "var(--v2-status-overdue-fg)" },
  Archived: { bg: "var(--v2-status-archived-bg)", fg: "var(--v2-status-archived-fg)", dot: "var(--v2-status-archived-fg)" },
};

export function StatusPill({ status }: { status: ClientStatus }) {
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {status}
    </span>
  );
}
