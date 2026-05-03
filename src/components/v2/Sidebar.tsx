import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid, Building2, FileText, ClipboardCheck, FolderClosed,
  GitBranch, BarChart3, Search, HelpCircle, Settings, MoreVertical,
} from "lucide-react";
import { motion } from "framer-motion";

const nav = [
  { to: "/v2", label: "Dashboard", icon: LayoutGrid, testId: "sidebar-dashboard-link", end: true },
  { to: "/v2/clients", label: "Clients", icon: Building2, testId: "sidebar-clients-link", count: 34 },
  { to: "/v2/filings", label: "Filings", icon: FileText, testId: "sidebar-filings-link", count: 7, attention: true },
  { to: "/v2/pending", label: "Pending Reviews", icon: ClipboardCheck, testId: "sidebar-pending-link", count: 3 },
  { to: "/v2/documents", label: "Documents", icon: FolderClosed, testId: "sidebar-documents-link" },
  { to: "/v2/org-chart", label: "Org Chart", icon: GitBranch, testId: "sidebar-orgchart-link" },
  { to: "/v2/reports", label: "Reports", icon: BarChart3, testId: "sidebar-reports-link" },
];

const pinned = [
  { name: "ABC Inc.", id: "abc-inc" },
  { name: "Cedar & Stone Co.", id: "cedar-stone" },
  { name: "Everline Partners", id: "everline-partners" },
];

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside
      className="sticky top-0 h-screen w-[244px] shrink-0 overflow-y-auto border-r flex flex-col"
      style={{ background: "var(--v2-bg-sidebar)", borderColor: "var(--v2-border)" }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center text-white v2-serif font-semibold"
          style={{ background: "var(--v2-brand)" }}
          aria-hidden
        >
          E
        </div>
        <span className="v2-serif text-[19px] font-semibold tracking-tight">EntityIQ</span>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <label
          className="flex items-center gap-2 h-9 px-2.5 rounded-md border text-[13px]"
          style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
        >
          <Search size={14} />
          <input
            data-testid="global-search"
            placeholder="Quick find…"
            className="bg-transparent outline-none flex-1 placeholder:text-[color:var(--v2-text-meta)]"
          />
          <kbd className="v2-mono text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--v2-border)" }}>⌘K</kbd>
        </label>
      </div>

      {/* Workspace */}
      <div className="px-3">
        <div
          className="v2-serif text-[10.5px] uppercase tracking-[0.12em] px-2 pt-2 pb-1.5"
          style={{ color: "var(--v2-text-meta)" }}
        >
          Workspace
        </div>
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = item.end ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  data-testid={item.testId}
                  className="relative flex items-center gap-2.5 h-9 pl-3 pr-2 rounded-md text-[13.5px] transition-colors duration-150"
                  style={{
                    background: active ? "var(--v2-brand-tint)" : "transparent",
                    color: active ? "var(--v2-text-primary)" : "var(--v2-text-secondary)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="v2-sidebar-accent"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r"
                      style={{ background: "var(--v2-brand)" }}
                    />
                  )}
                  <Icon size={16} style={{ color: active ? "var(--v2-brand)" : "var(--v2-text-secondary)" }} />
                  <span className="flex-1">{item.label}</span>
                  {typeof item.count === "number" && (
                    <span
                      className="v2-mono text-[10.5px] px-1.5 py-0.5 rounded-full border"
                      style={{
                        background: item.attention ? "var(--v2-status-due-bg)" : "var(--v2-bg-card)",
                        color: item.attention ? "var(--v2-status-due-fg)" : "var(--v2-text-secondary)",
                        borderColor: item.attention ? "transparent" : "var(--v2-border)",
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>

        {/* Pinned clients */}
        <div
          className="v2-serif text-[10.5px] uppercase tracking-[0.12em] px-2 pt-5 pb-1.5"
          style={{ color: "var(--v2-text-meta)" }}
        >
          Pinned Clients
        </div>
        <ul className="space-y-0.5">
          {pinned.map((p) => (
            <li key={p.id}>
              <button
                className="w-full flex items-center gap-2.5 h-8 px-3 rounded-md text-[13px] transition-colors duration-150 hover:bg-[color:var(--v2-row-hover)]"
                style={{ color: "var(--v2-text-secondary)" }}
              >
                <span className="h-2 w-2 rounded-sm" style={{ background: "var(--v2-brand)" }} aria-hidden />
                <span className="truncate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1" />

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 h-9 px-3 rounded-md text-[13px] hover:bg-[color:var(--v2-row-hover)]"
          style={{ color: "var(--v2-text-secondary)" }}>
          <HelpCircle size={16} /> Help & docs
        </button>
        <button className="w-full flex items-center gap-2.5 h-9 px-3 rounded-md text-[13px] hover:bg-[color:var(--v2-row-hover)]"
          style={{ color: "var(--v2-text-secondary)" }}>
          <Settings size={16} /> Settings
        </button>
        <div className="h-px my-2" style={{ background: "var(--v2-border)" }} />
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center text-[11.5px] font-semibold"
            style={{ background: "var(--v2-brand-tint)", color: "var(--v2-brand)" }}
          >
            JD
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium leading-tight truncate">Jordan Diaz</div>
            <div className="text-[11px] leading-tight" style={{ color: "var(--v2-text-meta)" }}>Owner · CPA</div>
          </div>
          <button className="p-1 rounded hover:bg-[color:var(--v2-row-hover)]" aria-label="Account menu">
            <MoreVertical size={14} style={{ color: "var(--v2-text-meta)" }} />
          </button>
        </div>
      </div>
    </aside>
  );
}
