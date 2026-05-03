import { motion } from "framer-motion";

interface Props {
  label: string;
  count: number;
  active?: boolean;
  attention?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function FilterChip({ label, count, active, attention, onClick, testId }: Props) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] transition-colors duration-150"
      style={{
        background: active ? "var(--v2-brand-tint)" : "transparent",
        borderColor: active ? "var(--v2-brand)" : "var(--v2-border)",
        color: attention ? "var(--v2-status-due-fg)" : "var(--v2-text-secondary)",
      }}
    >
      <motion.span
        key={count}
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="v2-mono font-semibold"
        style={{ color: attention ? "var(--v2-status-due-fg)" : "var(--v2-text-primary)" }}
      >
        {count}
      </motion.span>
      <span>{label}</span>
    </button>
  );
}
