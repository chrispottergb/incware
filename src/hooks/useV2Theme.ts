import { useEffect, useState, useCallback } from "react";

const KEY = "entityiq-v2-theme";
type Mode = "light" | "dark";

export function useV2Theme(): [Mode, () => void] {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem(KEY) as Mode) || "light";
  });

  useEffect(() => {
    localStorage.setItem(KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  return [mode, toggle];
}
