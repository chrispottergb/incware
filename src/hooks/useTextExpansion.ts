import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type ShortcodeMap = Record<string, string>;

export function useShortcodes() {
  return useQuery({
    queryKey: ["shortcode_expansions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shortcode_expansions" as any)
        .select("shortcode, expansion_text");
      if (error) throw error;
      const map: ShortcodeMap = {};
      for (const row of data as any[]) {
        map[row.shortcode.toLowerCase()] = row.expansion_text;
      }
      return map;
    },
    staleTime: 60_000,
  });
}

/**
 * Attach to a textarea/input ref to auto-expand shortcodes on Space or Tab.
 * Skips elements with className "no-expansion".
 */
export function useTextExpansion(
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  value: string,
  onChange: (newValue: string) => void,
) {
  const { data: shortcodes } = useShortcodes();
  const shortcodesRef = useRef(shortcodes);
  shortcodesRef.current = shortcodes;

  // Use refs to avoid stale closures — the keydown event can fire
  // before React re-attaches a new handler after a state change.
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Tab") return;
      const el = ref.current;
      if (!el || el.classList.contains("no-expansion")) return;
      const map = shortcodesRef.current;
      if (!map || Object.keys(map).length === 0) return;

      const cursorPos = el.selectionStart ?? 0;
      // Read current value from the DOM element directly for reliability
      const currentValue = el.value;
      const textBefore = currentValue.slice(0, cursorPos);

      // Find the last word (token) before cursor
      const match = textBefore.match(/(\S+)$/);
      if (!match) return;

      const token = match[1].toLowerCase();
      const expansion = map[token];
      if (!expansion) return;

      e.preventDefault();
      const before = textBefore.slice(0, textBefore.length - match[1].length);
      const after = currentValue.slice(cursorPos);
      const newValue = before + expansion + (e.key === " " ? " " : "") + after;
      onChangeRef.current(newValue);

      // Restore cursor position after React re-render
      const newPos = before.length + expansion.length + (e.key === " " ? 1 : 0);
      requestAnimationFrame(() => {
        el.setSelectionRange(newPos, newPos);
      });
    },
    [ref],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, ref]);
}
