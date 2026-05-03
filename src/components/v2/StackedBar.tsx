interface Segment { label: string; value: number; color: string; }
interface Props { segments: Segment[]; total: number; }

export function StackedBar({ segments, total }: Props) {
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "var(--v2-border)" }}>
        {segments.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--v2-text-secondary)" }}>
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1">{s.label}</span>
            <span className="v2-mono text-[11.5px]" style={{ color: "var(--v2-text-primary)" }}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
