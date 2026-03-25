import { Check, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface Props {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  className?: string;
}

function getRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function SaveStatusIndicator({ status, lastSavedAt, className = "" }: Props) {
  const [, setTick] = useState(0);

  // Update relative time every 30s
  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  if (status === "idle" && !lastSavedAt) return null;

  return (
    <div className={`flex items-center gap-1.5 text-[11px] select-none ${className}`}>
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      )}
      {status === "saved" && lastSavedAt && (
        <>
          <Check className="h-3 w-3 text-success" />
          <span className="text-muted-foreground">Saved {getRelativeTime(lastSavedAt)}</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertTriangle className="h-3 w-3 text-warning" />
          <span className="text-warning">Unable to save — retrying…</span>
        </>
      )}
      {status === "idle" && lastSavedAt && (
        <>
          <Check className="h-3 w-3 text-success" />
          <span className="text-muted-foreground">Saved {getRelativeTime(lastSavedAt)}</span>
        </>
      )}
    </div>
  );
}
