import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"] as const;
const THROTTLE_MS = 60_000; // Only update lastActivity once per minute

/**
 * Monitors user activity and signs out after 30 minutes of inactivity.
 * Only active when user is authenticated.
 */
export function useSessionIdleTimeout(isAuthenticated: boolean) {
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current >= THROTTLE_MS) {
      lastActivityRef.current = now;
    }
  }, []);

  // Ensure the very first user interaction after mount is always recorded
  const firstEventRef = useRef(true);
  const wrappedHandleActivity = useCallback(() => {
    if (firstEventRef.current) {
      lastActivityRef.current = Date.now();
      firstEventRef.current = false;
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

    // Reset activity timestamp when auth state changes
    lastActivityRef.current = Date.now();

    // Attach activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Check every 60 seconds if idle timeout exceeded
    timerRef.current = setInterval(async () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        console.info("[Session] Idle timeout reached, signing out");
        await supabase.auth.signOut();
        // Clear any residual storage
        try {
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith("sb-") || key.startsWith("supabase.auth")) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith("annual_meeting_draft_")) {
              sessionStorage.removeItem(key);
            }
          });
        } catch {}
        window.location.href = "/auth";
      }
    }, 60_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAuthenticated, handleActivity]);
}
