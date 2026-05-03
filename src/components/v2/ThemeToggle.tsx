import { Sun, Moon } from "lucide-react";

interface Props { mode: "light" | "dark"; onToggle: () => void; }

export function ThemeToggle({ mode, onToggle }: Props) {
  const Icon = mode === "light" ? Moon : Sun;
  return (
    <button
      data-testid="theme-toggle"
      onClick={onToggle}
      aria-label="Toggle theme"
      className="h-9 w-9 rounded-md border flex items-center justify-center transition-colors duration-150 hover:bg-[color:var(--v2-row-hover)]"
      style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
    >
      <Icon size={15} />
    </button>
  );
}
