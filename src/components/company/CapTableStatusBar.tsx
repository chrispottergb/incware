import type { EntityTerminology } from "@/lib/entity-terminology";

interface Props {
  term: EntityTerminology;
  authorized: number | null;
  issued: number;
}

/**
 * Shared Authorized / Issued / Available-to-Issue status bar.
 * Reused by both corporations ("Shares") and LLCs ("Units") — the label
 * text swaps via `term.shareUnit`. Renders nothing when `authorized` is null.
 */
export default function CapTableStatusBar({ term, authorized, issued }: Props) {
  if (authorized == null) return null;
  const available = Math.max(0, authorized - issued);
  const unit = term.shareUnit;
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-6 text-xs">
      <div>
        <span className="text-muted-foreground">Authorized {unit}:</span>{" "}
        <span className="font-semibold">{authorized.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Issued:</span>{" "}
        <span className="font-semibold">{issued.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Available to Issue:</span>{" "}
        <span className="font-semibold text-primary">{available.toLocaleString()}</span>
      </div>
    </div>
  );
}
