import { useRef, useCallback, useEffect, useState } from "react";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveOptions<T> {
  /** The current form data */
  data: T;
  /** Async function to persist the data. Receives the current snapshot. */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 2000) */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true). Disable during initial load. */
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Call to immediately trigger a save if there are pending changes */
  saveNow: () => void;
  /** Attach to a container's onBlur to trigger save on field exit */
  handleBlur: (e: React.FocusEvent) => void;
  /** Call when a Select/Checkbox/DatePicker changes (immediate save) */
  triggerSave: () => void;
  /** True when the current data differs from the last saved/baselined snapshot */
  hasPendingChanges: () => boolean;
  /**
   * Re-baseline the auto-save snapshot to the CURRENT data without saving.
   * Call after hydrating form state from the server so the hydration itself
   * is not treated as a user edit (which would echo server data back as a save).
   */
  resetBaseline: () => void;
}

/**
 * Reusable auto-save hook.
 * Saves on:
 * 1. Inactivity debounce (2s after last change)
 * 2. Field blur
 * 3. Component unmount / navigation
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const lastSavedSnapshotRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Initialize baseline on first render / when enabled changes
  const initializedRef = useRef(false);
  useEffect(() => {
    if (enabled && !initializedRef.current) {
      lastSavedSnapshotRef.current = JSON.stringify(data);
      initializedRef.current = true;
    }
  }, [enabled, data]);

  const doSave = useCallback(async () => {
    if (!enabledRef.current || savingRef.current) return;
    const snapshot = JSON.stringify(dataRef.current);
    if (snapshot === lastSavedSnapshotRef.current) return;

    savingRef.current = true;
    setStatus("saving");

    try {
      await onSaveRef.current(dataRef.current);
      lastSavedSnapshotRef.current = JSON.stringify(dataRef.current);
      setLastSavedAt(new Date());
      setStatus("saved");
      // Clear retry timer on success
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } catch {
      setStatus("error");
      // Auto-retry after 5s
      retryTimerRef.current = setTimeout(() => {
        savingRef.current = false;
        doSave();
      }, 5000);
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Debounce timer: restart on every data change
  useEffect(() => {
    if (!enabled || !initializedRef.current) return;
    const snapshot = JSON.stringify(data);
    if (snapshot === lastSavedSnapshotRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, debounceMs, enabled, doSave]);

  // Save on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      // Sync save attempt on unmount
      const snapshot = JSON.stringify(dataRef.current);
      if (snapshot !== lastSavedSnapshotRef.current && enabledRef.current) {
        // Fire-and-forget save
        onSaveRef.current(dataRef.current).catch(() => {});
      }
    };
  }, []);

  const saveNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    doSave();
  }, [doSave]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.getAttribute("role") === "combobox" ||
        target.getAttribute("role") === "checkbox"
      ) {
        if (timerRef.current) clearTimeout(timerRef.current);
        // Short delay to let React state settle
        timerRef.current = setTimeout(doSave, 150);
      }
    },
    [doSave]
  );

  const triggerSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, 200);
  }, [doSave]);

  const hasPendingChanges = useCallback(
    () => JSON.stringify(dataRef.current) !== lastSavedSnapshotRef.current,
    []
  );

  const resetBaseline = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastSavedSnapshotRef.current = JSON.stringify(dataRef.current);
    initializedRef.current = true;
  }, []);

  return { status, lastSavedAt, saveNow, handleBlur, triggerSave, hasPendingChanges, resetBaseline };
}
