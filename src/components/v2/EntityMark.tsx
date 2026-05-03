import { Building2 } from "lucide-react";

export function EntityMark({ size = 30 }: { size?: number }) {
  return (
    <div
      className="rounded-md flex items-center justify-center shrink-0"
      style={{ background: "var(--v2-brand)", color: "white", width: size, height: size }}
      aria-hidden
    >
      <Building2 size={Math.round(size * 0.5)} />
    </div>
  );
}
