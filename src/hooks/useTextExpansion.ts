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
 * Attach to a textarea/input ref to auto-expand shortcodes on Space, Tab, Enter,
 * or when the field loses focus.
 * Skips elements with className "no-expansion".
 */
export function useTextExpansion(
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>,
  _value: string,
  onChange: (newValue: string) => void,
) {
  const { data: shortcodes } = useShortcodes();
  const shortcodesRef = useRef(shortcodes);
  shortcodesRef.current = shortcodes;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const applyExpansion = useCallback(
    (trigger: "space" | "tab" | "enter" | "blur") => {
      const el = ref.current;
      if (!el || el.classList.contains("no-expansion")) return false;

      const map = shortcodesRef.current;
      if (!map || Object.keys(map).length === 0) return false;

      const currentValue = el.value;
      const cursorPos = el.selectionStart ?? currentValue.length;
      const textBefore = currentValue.slice(0, cursorPos);
      const match = textBefore.match(/(\S+)$/);
      if (!match) return false;

      const token = match[1].toLowerCase();
      const expansion = map[token];
      if (!expansion) return false;

      const before = textBefore.slice(0, textBefore.length - match[1].length);
      const after = currentValue.slice(cursorPos);
      const suffix = trigger === "space" ? " " : trigger === "enter" ? "\n" : "";
      const newValue = before + expansion + suffix + after;

      if (newValue === currentValue) return false;

      onChangeRef.current(newValue);

      const newPos = before.length + expansion.length + suffix.length;
      requestAnimationFrame(() => {
        if (document.activeElement === el) {
          el.setSelectionRange(newPos, newPos);
        }
      });

      return true;
    },
    [ref],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === " " && applyExpansion("space")) {
        e.preventDefault();
        return;
      }

      if (e.key === "Tab" && applyExpansion("tab")) {
        e.preventDefault();
        return;
      }

      if (e.key === "Enter" && applyExpansion("enter")) {
        e.preventDefault();
      }
    },
    [applyExpansion],
  );

  const handleBlur = useCallback(() => {
    applyExpansion("blur");
  }, [applyExpansion]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("blur", handleBlur);

    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("blur", handleBlur);
    };
  }, [handleBlur, handleKeyDown, ref]);
}
