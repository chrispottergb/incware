import { Home, ChevronRight, Bell, Calendar, Plus } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  crumbs: { label: string; current?: boolean }[];
  mode: "light" | "dark";
  onToggleTheme: () => void;
  primaryAction?: { label: string; onClick: () => void; testId?: string };
}

export function TopBar({ crumbs, mode, onToggleTheme, primaryAction }: Props) {
  return (
    <header
      className="sticky top-0 z-30 h-14 border-b flex items-center justify-between px-6"
      style={{ background: "var(--v2-bg-page)", borderColor: "var(--v2-border)" }}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--v2-text-secondary)" }}>
        <Home size={14} />
        <span>Workspace</span>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={13} style={{ color: "var(--v2-text-meta)" }} />
            <span style={c.current ? { color: "var(--v2-text-primary)", fontWeight: 600 } : undefined}>{c.label}</span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          className="h-9 px-3 rounded-md border text-[12.5px] flex items-center gap-1.5 hover:bg-[color:var(--v2-row-hover)] transition-colors duration-150"
          style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
        >
          <Calendar size={13} /> This quarter
        </button>
        <button
          aria-label="Notifications"
          className="relative h-9 w-9 rounded-md border flex items-center justify-center hover:bg-[color:var(--v2-row-hover)] transition-colors duration-150"
          style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
        >
          <Bell size={15} />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full" style={{ background: "var(--v2-brand)" }} />
        </button>
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
        {primaryAction && (
          <button
            data-testid={primaryAction.testId}
            onClick={primaryAction.onClick}
            className="h-9 px-3.5 rounded-md text-[13px] font-medium text-white flex items-center gap-1.5 transition-colors duration-150"
            style={{ background: "var(--v2-brand)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-brand-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--v2-brand)")}
          >
            <Plus size={14} /> {primaryAction.label}
          </button>
        )}
      </div>
    </header>
  );
}
