interface Props { percent: number; }

export function DonutRing({ percent }: Props) {
  const size = 110;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - percent / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--v2-border)" strokeWidth={stroke}
        />
        <circle
          className="v2-donut-arc"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--v2-status-current-fg)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ ["--v2-donut-from" as any]: `${c}`, ["--v2-donut-to" as any]: `${offset}` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="v2-serif font-semibold" style={{ fontSize: 26 }}>{percent}%</span>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--v2-text-meta)" }}>Healthy</span>
      </div>
    </div>
  );
}
