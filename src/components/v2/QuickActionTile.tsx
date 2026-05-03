import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  sub: string;
  testId?: string;
  onClick?: () => void;
}

export function QuickActionTile({ icon: Icon, title, sub, testId, onClick }: Props) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="group h-[72px] px-3.5 rounded-[10px] border bg-[color:var(--v2-bg-card)] flex items-center gap-3 text-left transition-[transform,border-color,background-color] duration-150 hover:-translate-y-0.5"
      style={{ borderColor: "var(--v2-border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--v2-brand)";
        e.currentTarget.style.background = "var(--v2-brand-tint)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--v2-border)";
        e.currentTarget.style.background = "var(--v2-bg-card)";
      }}
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
        style={{ background: "var(--v2-brand-tint)", color: "var(--v2-brand)" }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--v2-text-primary)" }}>{title}</div>
        <div className="text-[11.5px] leading-tight mt-1" style={{ color: "var(--v2-text-secondary)" }}>{sub}</div>
      </div>
    </button>
  );
}
