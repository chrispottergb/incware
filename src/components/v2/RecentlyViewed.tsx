import { EntityMark } from "./EntityMark";
import { StatusPill } from "./StatusPill";
import type { ClientRow } from "@/data/v2-clients";

export function RecentlyViewed({ rows }: { rows: ClientRow[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-2.5 py-1">
          <EntityMark size={28} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{r.name}</div>
            <div className="v2-mono text-[10.5px]" style={{ color: "var(--v2-text-meta)" }}>
              EIN {r.ein} · {r.state}
            </div>
          </div>
          <StatusPill status={r.status} />
        </li>
      ))}
    </ul>
  );
}
