import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { findNearMatch } from "@/lib/name-normalize";
import { useVisibleAddressBookEntries } from "@/contexts/AddressBookContext";
import type { AddressBookEntry } from "@/hooks/useAddressBook";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (entry: AddressBookEntry) => void;
  search: (query: string) => AddressBookEntry[];
  getCompanySplitIndex: (results: AddressBookEntry[]) => number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function NameAutocomplete({
  value,
  onChange,
  onSelect,
  search,
  getCompanySplitIndex,
  placeholder,
  className,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AddressBookEntry[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dismissedHint, setDismissedHint] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressRef = useRef(false);

  // Near-match hint runs client-side over the already-loaded list — no query
  // per keystroke. Hidden entries are already filtered out upstream.
  const allEntries = useVisibleAddressBookEntries();
  const nearMatch = useMemo(() => {
    if (!value || value.trim().length < 3) return null;
    if (dismissedHint && dismissedHint === value) return null;
    return findNearMatch(value, allEntries);
  }, [value, allEntries, dismissedHint]);

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }
      const r = search(val);
      setResults(r);
      setOpen(r.length > 0);
      setHighlightIdx(-1);
    },
    [onChange, search]
  );

  const handleSelect = useCallback(
    (entry: AddressBookEntry) => {
      suppressRef.current = true;
      onSelect(entry);
      setOpen(false);
      setResults([]);
    },
    [onSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((p) => (p + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((p) => (p <= 0 ? results.length - 1 : p - 1));
      } else if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        handleSelect(results[highlightIdx]);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [open, results, highlightIdx, handleSelect]
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const splitIdx = getCompanySplitIndex(results);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (value.length >= 2) {
            const r = search(value);
            setResults(r);
            setOpen(r.length > 0);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Part B — normalize on save: trim, collapse internal whitespace and
          // strip trailing commas/periods. Case and abbreviations are untouched.
          const normalized = normalizeEntryText(value);
          if (normalized !== value) onChange(normalized);
        }}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="new-password"
      />
      {open && results.length > 0 && (
        <div className="absolute z-[60] mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map((entry, i) => (
            <div key={entry.id}>
              {i === splitIdx && (
                <div className="border-t border-border mx-2 my-0.5" />
              )}
              <button
                type="button"
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs cursor-pointer transition-colors",
                  i === highlightIdx
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50 text-popover-foreground"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(entry);
                }}
                onMouseEnter={() => setHighlightIdx(i)}
              >
                <span className="font-medium">{entry.full_name}</span>
                {entry.city && (
                  <span className="text-muted-foreground ml-1.5">
                    — {[entry.city, entry.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {nearMatch && !disabled && (
        <div
          className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
          data-testid="near-match-hint"
        >
          <span>
            Similar existing entry: <span className="font-medium text-foreground">"{nearMatch.full_name}"</span>
          </span>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(nearMatch);
            }}
          >
            Use this
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              setDismissedHint(value);
            }}
          >
            Keep what I typed
          </button>
        </div>
      )}
    </div>
  );
}
