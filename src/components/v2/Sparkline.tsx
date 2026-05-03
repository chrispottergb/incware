interface Props {
  data: number[];
  tone: "brand" | "success" | "warn" | "danger";
  width?: number;
  height?: number;
}

const toneColor = (t: Props["tone"]) =>
  t === "brand" ? "var(--v2-brand)"
  : t === "success" ? "var(--v2-status-current-fg)"
  : t === "warn" ? "var(--v2-status-due-fg)"
  : "var(--v2-status-overdue-fg)";

export function Sparkline({ data, tone, width = 112, height = 36 }: Props) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const path = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="v2-sparkline" aria-hidden>
      <path d={path} fill="none" stroke={toneColor(tone)} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
