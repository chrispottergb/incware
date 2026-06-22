import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const WARNING_BEFORE_MS = 10 * 60 * 1000; // Warn 10 minutes before sign-out
const ACTIVITY_EVENTS = ["mousedown", "pointerdown", "keydown", "touchstart", "scroll", "mousemove", "input", "change", "focus"] as const;
const THROTTLE_MS = 30_000; // Update lastActivity at most every 30s

const isEditingFormField = () => {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  const tag = active.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    active.isContentEditable ||
    active.getAttribute("role") === "combobox" ||
    active.getAttribute("role") === "checkbox"
  );
};

/**
 * Monitors user activity and signs out after extended inactivity.
 * Shows a warning toast before sign-out so users filling out long forms
 * can keep their session alive and avoid losing in-progress work.
 */
export function useSessionIdleTimeout(isAuthenticated: boolean) {
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current >= THROTTLE_MS) {
      lastActivityRef.current = now;
      warnedRef.current = false;
    }
  }, []);

  const firstEventRef = useRef(true);
  const wrappedHandleActivity = useCallback(() => {
    if (firstEventRef.current) {
      lastActivityRef.current = Date.now();
      firstEventRef.current = false;
      warnedRef.current = false;
    } else {
      handleActivity();
    }
  }, [handleActivity]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastActivityRef.current = Date.now();
    warnedRef.current = false;

    const handleVisibilityChange = () => {
      if (!document.hidden) wrappedHandleActivity();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, wrappedHandleActivity, { passive: true, capture: true } as AddEventListenerOptions);
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    timerRef.current = setInterval(async () => {
      if (document.hidden || isEditingFormField()) {
        lastActivityRef.current = Date.now();
        warnedRef.current = false;
        return;
      }

      const elapsed = Date.now() - lastActivityRef.current;

      // Warning window: alert the user so they can move the mouse / type to keep session
      if (
        !warnedRef.current &&
        elapsed >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS &&
        elapsed < IDLE_TIMEOUT_MS
      ) {
        warnedRef.current = true;
        try {
          toast({
            title: "Session expiring soon",
            description:
              "You'll be signed out in about 2 minutes due to inactivity. Move the mouse or press a key to stay signed in.",
            duration: 60_000,
          });
        } catch {}
        return;
      }

      if (elapsed >= IDLE_TIMEOUT_MS) {
        console.info("[Session] Idle timeout reached, signing out");
        await supabase.auth.signOut();
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("sb-") || key.startsWith("supabase.auth")) {
              localStorage.removeItem(key);
            }
          });
        } catch {}
        window.location.href = "/auth";
      }
    }, 30_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, wrappedHandleActivity, { capture: true } as AddEventListenerOptions);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated, wrappedHandleActivity]);
}
