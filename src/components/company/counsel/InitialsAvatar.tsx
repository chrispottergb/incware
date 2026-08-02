/** Initials avatar circle used for people in the Firms and Counsel section. */
export function InitialsAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initials =
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground ${className}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
