import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export interface AddressSuggestion {
  id: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: { line1: string; line2: string; city: string; state: string; zip: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  companyId?: string;
  /** Query shareholders table instead of companies */
  source?: "companies" | "shareholders";
}

export default function DbAddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  className,
  disabled,
  companyId,
  source = "companies",
}: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchSuggestions = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      const pattern = `%${query}%`;

      if (source === "shareholders") {
        let q = supabase
          .from("shareholders")
          .select("id, address, address_2, city, state, zip")
          .not("address", "is", null)
          .ilike("address", pattern)
          .limit(5);
        if (companyId) q = q.neq("id", companyId);

        const { data } = await q;
        if (!data) return;

        // Deduplicate by address+city+state+zip
        const seen = new Set<string>();
        const suggestions: AddressSuggestion[] = [];
        for (const row of data) {
          if (!row.address) continue;
          const key = `${row.address}|${row.city}|${row.state}|${row.zip}`;
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push({
            id: row.id,
            line1: row.address || "",
            line2: row.address_2 || "",
            city: row.city || "",
            state: row.state || "",
            zip: row.zip || "",
            label: [row.address, row.city, `${row.state || ""} ${row.zip || ""}`.trim()]
              .filter(Boolean)
              .join(", "),
          });
        }
        setResults(suggestions.slice(0, 5));
        setOpen(suggestions.length > 0);
      } else {
        let q = supabase
          .from("companies")
          .select("id, address, address_2, city, state, zip")
          .not("address", "is", null)
          .ilike("address", pattern)
          .limit(5);
        if (companyId) q = q.neq("id", companyId);

        const { data } = await q;
        if (!data) return;

        const seen = new Set<string>();
        const suggestions: AddressSuggestion[] = [];
        for (const row of data) {
          if (!row.address) continue;
          const key = `${row.address}|${row.city}|${row.state}|${row.zip}`;
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push({
            id: row.id,
            line1: row.address || "",
            line2: row.address_2 || "",
            city: row.city || "",
            state: row.state || "",
            zip: row.zip || "",
            label: [row.address, row.city, `${row.state || ""} ${row.zip || ""}`.trim()]
              .filter(Boolean)
              .join(", "),
          });
        }
        setResults(suggestions.slice(0, 5));
        setOpen(suggestions.length > 0);
      }
      setHighlightIdx(-1);
    },
    [companyId, source]
  );

  const handleChange = useCallback(
    (val: string) => {
      onChange(val);
      if (suppressRef.current) {
        suppressRef.current = false;
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
    },
    [onChange, fetchSuggestions]
  );

  const handleSelect = useCallback(
    (entry: AddressSuggestion) => {
      suppressRef.current = true;
      onSelect({
        line1: entry.line1,
        line2: entry.line2,
        city: entry.city,
        state: entry.state,
        zip: entry.zip,
      });
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => {
          if (value.length >= 2) fetchSuggestions(value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div className="absolute z-[60] mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map((entry, i) => (
            <button
              key={entry.id + entry.line1}
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
              <span className="font-medium">{entry.line1}</span>
              {(entry.city || entry.state || entry.zip) && (
                <span className="text-muted-foreground ml-1.5">
                  — {[entry.city, `${entry.state || ""} ${entry.zip || ""}`.trim()]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
