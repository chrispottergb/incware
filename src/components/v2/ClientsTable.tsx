import { useState } from "react";
import type { ClientRow } from "@/data/v2-clients";
import { EntityMark } from "./EntityMark";
import { StatusPill } from "./StatusPill";
import { ChevronUp, ChevronDown, Eye, Pencil, MoreHorizontal } from "lucide-react";

type SortKey = "name" | "type" | "state" | "inc" | "fye" | "status";
type SortDir = "asc" | "desc";

interface Props {
  rows: ClientRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], all: boolean) => void;
  onRowOpen: (row: ClientRow) => void;
}

const cols: { key: SortKey; label: string; w?: string; align?: "left" | "right" }[] = [
  { key: "name", label: "Company Name" },
  { key: "type", label: "Type", w: "w-[140px]" },
  { key: "state", label: "State", w: "w-[80px]" },
  { key: "inc", label: "Inc. Date", w: "w-[130px]" },
  { key: "fye", label: "Fiscal Year End", w: "w-[150px]" },
  { key: "status", label: "Status", w: "w-[140px]" },
];

export function ClientsTable({ rows, selected, onToggle, onToggleAll, onRowOpen }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = [...rows].sort((a, b) => {
    const av = (a[sortKey] || "").toString();
    const bv = (b[sortKey] || "").toString();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const allSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  return (
    <div
      className="border rounded-b-[10px] overflow-hidden"
      style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
    >
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--v2-border)" }}>
            <th className="w-10 px-3 py-2.5 text-left">
              <input
                type="checkbox"
                aria-label="Select all"
                checked={allSelected}
                onChange={(e) => onToggleAll(sorted.map((r) => r.id), e.target.checked)}
                className="h-3.5 w-3.5 accent-[color:var(--v2-brand)]"
              />
            </th>
            {cols.map((c) => {
              const active = sortKey === c.key;
              return (
                <th
                  key={c.key}
                  className={`px-3 py-2.5 text-left font-medium uppercase tracking-wider text-[10.5px] ${c.w || ""}`}
                  style={{ color: active ? "var(--v2-brand)" : "var(--v2-text-meta)" }}
                >
                  <button
                    onClick={() => handleSort(c.key)}
                    className="inline-flex items-center gap-1 hover:text-[color:var(--v2-text-primary)]"
                  >
                    {c.label}
                    {active ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronUp size={11} className="opacity-30" />}
                  </button>
                </th>
              );
            })}
            <th className="w-[120px]" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isSelected = selected.has(r.id);
            const testId = `client-row-${r.id}`;
            return (
              <tr
                key={r.id}
                data-testid={testId}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onRowOpen(r);
                  if (e.key === " ") { e.preventDefault(); onToggle(r.id); }
                }}
                onClick={() => onRowOpen(r)}
                className="group border-b cursor-pointer transition-colors duration-150"
                style={{
                  background: isSelected ? "var(--v2-brand-tint)" : (i % 2 === 1 ? "var(--v2-row-alt)" : "var(--v2-bg-card)"),
                  borderColor: "var(--v2-border)",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--v2-row-hover)"; }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = i % 2 === 1 ? "var(--v2-row-alt)" : "var(--v2-bg-card)";
                }}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={isSelected}
                    onChange={() => onToggle(r.id)}
                    className="h-3.5 w-3.5 accent-[color:var(--v2-brand)]"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <EntityMark />
                    <div>
                      <div className="font-semibold text-[13px]">{r.name}</div>
                      <div className="v2-mono text-[10.5px]" style={{ color: "var(--v2-text-meta)" }}>EIN · {r.ein}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--v2-text-secondary)" }}>{r.type}</td>
                <td className="px-3 py-2.5" style={{ color: "var(--v2-text-secondary)" }}>{r.state}</td>
                <td className="px-3 py-2.5 v2-mono" style={{ color: "var(--v2-text-secondary)" }}>{r.inc}</td>
                <td className="px-3 py-2.5 v2-mono" style={{ color: "var(--v2-text-secondary)" }}>{r.fye}</td>
                <td className="px-3 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <RowAction icon={Eye} label="View" />
                    <RowAction icon={Pencil} label="Edit" />
                    <RowAction icon={MoreHorizontal} label="More" />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowAction({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={(e) => e.stopPropagation()}
      className="h-7 w-7 rounded flex items-center justify-center hover:bg-[color:var(--v2-brand-tint)]"
      style={{ color: "var(--v2-text-secondary)" }}
    >
      <Icon size={13} />
    </button>
  );
}
