import { Search, ChevronDown, Bookmark, Settings2 } from "lucide-react";

interface Props {
  query: string; onQuery: (s: string) => void;
  type: string; onType: (s: string) => void;
  status: string; onStatus: (s: string) => void;
}

export function ClientsToolbar({ query, onQuery, type, onType, status, onStatus }: Props) {
  return (
    <div
      className="flex items-center gap-2 px-3 h-12 rounded-t-[10px] border border-b-0"
      style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
    >
      <label
        className="flex items-center gap-2 h-8 px-2.5 rounded-md border flex-1 max-w-[420px]"
        style={{ borderColor: "var(--v2-border)" }}
      >
        <Search size={13} style={{ color: "var(--v2-text-meta)" }} />
        <input
          data-testid="clients-search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search name, EIN, state…"
          className="flex-1 bg-transparent outline-none text-[12.5px] placeholder:text-[color:var(--v2-text-meta)]"
        />
      </label>
      <div className="flex-1" />
      <Select value={type} onChange={onType} options={["All Types", "Corporation", "LLC", "S-Corp", "Partnership", "Trust"]} testId="filter-type" />
      <Select value={status} onChange={onStatus} options={["All Status", "Current", "Due Soon", "Overdue", "Archived"]} testId="filter-status" />
      <button
        className="h-8 px-2.5 rounded-md border text-[12px] flex items-center gap-1.5"
        style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
      >
        <Bookmark size={12} /> Saved views <ChevronDown size={12} />
      </button>
      <button
        className="h-8 px-2.5 rounded-md border text-[12px] flex items-center gap-1.5"
        style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
      >
        <Settings2 size={12} /> Comfortable
      </button>
    </div>
  );
}

function Select({ value, onChange, options, testId }: { value: string; onChange: (s: string) => void; options: string[]; testId?: string }) {
  return (
    <div className="relative">
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none h-8 pl-2.5 pr-7 rounded-md border text-[12px] bg-transparent outline-none cursor-pointer"
        style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--v2-text-meta)" }} />
    </div>
  );
}
