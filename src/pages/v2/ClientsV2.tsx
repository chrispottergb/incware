import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { TopBar } from "@/components/v2/TopBar";
import { FilterChip } from "@/components/v2/FilterChip";
import { QuickActionTile } from "@/components/v2/QuickActionTile";
import { ClientsToolbar } from "@/components/v2/ClientsToolbar";
import { ClientsTable } from "@/components/v2/ClientsTable";
import { ClientDrawer } from "@/components/v2/ClientDrawer";
import { BulkActionBar } from "@/components/v2/BulkActionBar";
import { v2Clients, v2Counts, type ClientRow } from "@/data/v2-clients";
import { Plus, Upload, FolderOpen, ClipboardCheck, SearchCheck, ChevronLeft, ChevronRight } from "lucide-react";

type Ctx = { mode: "light" | "dark"; toggle: () => void };
type Filter = "active" | "archived" | "attention";

export default function ClientsV2() {
  const { mode, toggle } = useOutletContext<Ctx>();
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("All Types");
  const [status, setStatus] = useState("All Status");
  const [page, setPage] = useState(1);
  const [perPage] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<ClientRow | null>(null);

  const filtered = useMemo(() => {
    return v2Clients.filter((r) => {
      if (filter === "active" && r.status === "Archived") return false;
      if (filter === "archived" && r.status !== "Archived") return false;
      if (filter === "attention" && r.status !== "Overdue" && r.status !== "Due Soon") return false;
      if (type !== "All Types" && r.type !== type) return false;
      if (status !== "All Status" && r.status !== status) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!r.name.toLowerCase().includes(q) && !r.ein.includes(query) && !r.state.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [filter, type, status, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);

  const onToggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const onToggleAll = (ids: string[], all: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (all) ids.forEach((i) => next.add(i));
      else ids.forEach((i) => next.delete(i));
      return next;
    });
  };

  return (
    <>
      <TopBar
        crumbs={[{ label: "Clients", current: true }]}
        mode={mode}
        onToggleTheme={toggle}
      />

      <main className="px-7 py-6 space-y-5">
        {/* Header */}
        <section className="flex items-end justify-between gap-4">
          <div>
            <h1 className="v2-serif font-semibold leading-tight" style={{ fontSize: 30 }}>Client Companies</h1>
            <div className="flex items-center gap-2 mt-2.5">
              <FilterChip
                testId="filter-chip-active"
                label="active" count={v2Counts.active}
                active={filter === "active"} onClick={() => { setFilter("active"); setPage(1); }}
              />
              <FilterChip
                testId="filter-chip-archived"
                label="archived" count={v2Counts.archived}
                active={filter === "archived"} onClick={() => { setFilter("archived"); setPage(1); }}
              />
              <FilterChip
                testId="filter-chip-attention"
                label="need attention" count={v2Counts.needAttention} attention
                active={filter === "attention"} onClick={() => { setFilter("attention"); setPage(1); }}
              />
            </div>
          </div>
          <button
            data-testid="add-company-btn"
            className="h-9 px-3.5 rounded-md text-white text-[13px] font-medium flex items-center gap-1.5 transition-colors duration-150"
            style={{ background: "var(--v2-brand)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-brand-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--v2-brand)")}
          >
            <Plus size={14} /> Add Company
          </button>
        </section>

        {/* Quick actions */}
        <section>
          <div className="text-[10.5px] uppercase tracking-[0.12em] mb-2" style={{ color: "var(--v2-text-meta)" }}>
            Quick Actions
          </div>
          <div className="grid grid-cols-5 gap-3">
            <QuickActionTile testId="qa-new" icon={Plus} title="New Entity" sub="Set up a new client" />
            <QuickActionTile testId="qa-import" icon={Upload} title="Import" sub="Upload & auto-extract" />
            <QuickActionTile testId="qa-existing" icon={FolderOpen} title="Existing" sub="View & manage entities" />
            <QuickActionTile testId="qa-review" icon={ClipboardCheck} title="EntityIQ Review" sub="Annual compliance review" />
            <QuickActionTile testId="qa-find" icon={SearchCheck} title="Quick Find" sub="Find a company fast" />
          </div>
        </section>

        {/* Toolbar + Table */}
        <section>
          <ClientsToolbar
            query={query} onQuery={(s) => { setQuery(s); setPage(1); }}
            type={type} onType={(s) => { setType(s); setPage(1); }}
            status={status} onStatus={(s) => { setStatus(s); setPage(1); }}
          />
          <ClientsTable
            rows={visible} selected={selected}
            onToggle={onToggle} onToggleAll={onToggleAll}
            onRowOpen={(r) => setDrawer(r)}
          />
          {/* Footer */}
          <div
            className="flex items-center justify-between px-3 py-2.5 border border-t-0 rounded-b-[10px] text-[12px]"
            style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
          >
            <div>Showing {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + perPage, filtered.length)} of {filtered.length}</div>
            <div className="flex items-center gap-1">
              <PagerBtn disabled={safePage === 1} onClick={() => setPage(safePage - 1)} aria="Previous">
                <ChevronLeft size={13} />
              </PagerBtn>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 4).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="h-7 min-w-[28px] px-2 rounded text-[12px] font-medium"
                  style={{
                    background: p === safePage ? "var(--v2-brand)" : "transparent",
                    color: p === safePage ? "white" : "var(--v2-text-secondary)",
                  }}
                >
                  {p}
                </button>
              ))}
              <PagerBtn disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)} aria="Next">
                <ChevronRight size={13} />
              </PagerBtn>
            </div>
            <div>Rows: {perPage} ▾</div>
          </div>
        </section>
      </main>

      <ClientDrawer row={drawer} onClose={() => setDrawer(null)} />
      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())} />
    </>
  );
}

function PagerBtn({ children, disabled, onClick, aria }: { children: React.ReactNode; disabled?: boolean; onClick: () => void; aria: string }) {
  return (
    <button
      aria-label={aria}
      disabled={disabled}
      onClick={onClick}
      className="h-7 w-7 rounded flex items-center justify-center disabled:opacity-30"
      style={{ color: "var(--v2-text-secondary)" }}
    >
      {children}
    </button>
  );
}
