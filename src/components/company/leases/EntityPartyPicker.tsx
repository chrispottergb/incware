import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Building2, Building, User, Globe, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaseParty } from "@/lib/lease-classification";

type PartyOption = "this" | "related" | "individual" | "external";

interface Props {
  label: string;
  currentCompanyId: string;
  value: LeaseParty;
  onChange: (party: LeaseParty) => void;
  externalName: string;
  onExternalNameChange: (name: string) => void;
  externalAddress?: string;
  onExternalAddressChange?: (addr: string) => void;
}

const OPTIONS: Array<{ id: PartyOption; title: string; helper: string; Icon: any }> = [
  { id: "this", title: "This Company", helper: "Automatically uses your primary entity", Icon: Building2 },
  { id: "related", title: "Related Company", helper: "Select another entity you control", Icon: Building },
  { id: "individual", title: "Individual", helper: "Select or enter a person", Icon: User },
  { id: "external", title: "External Entity", helper: "Third-party outside your organization", Icon: Globe },
];

function deriveOption(value: LeaseParty, currentCompanyId: string): PartyOption | null {
  if (value.kind === "individual") return "individual";
  if (value.kind === "external") return "external";
  if (value.kind === "company") {
    if (!value.companyId) return "related"; // chosen related but not picked yet
    return value.companyId === currentCompanyId ? "this" : "related";
  }
  return null;
}

export function EntityPartyPicker({
  label,
  currentCompanyId,
  value,
  onChange,
  externalName,
  onExternalNameChange,
  externalAddress,
  onExternalAddressChange,
}: Props) {
  const { data: companies = [] } = useQuery({
    queryKey: ["my_companies_for_picker"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: shareholders = [] } = useQuery({
    queryKey: ["shareholders_for_picker", currentCompanyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shareholders")
        .select("id, name")
        .eq("company_id", currentCompanyId)
        .order("name");
      return data || [];
    },
  });

  const [option, setOption] = useState<PartyOption | null>(() => deriveOption(value, currentCompanyId));

  // Keep local option in sync if parent value changes externally (e.g. edit-mode hydration)
  useEffect(() => {
    const next = deriveOption(value, currentCompanyId);
    if (next && next !== option) setOption(next);
  }, [value, currentCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentCompanyName = useMemo(
    () => companies.find((c) => c.id === currentCompanyId)?.name || "Current company",
    [companies, currentCompanyId],
  );

  const handleSelectOption = (id: PartyOption) => {
    setOption(id);
    if (id === "this") {
      onChange({ kind: "company", companyId: currentCompanyId, name: currentCompanyName });
    } else if (id === "related") {
      onChange({ kind: "company", companyId: undefined });
    } else if (id === "individual") {
      onChange({ kind: "individual", shareholderId: undefined });
    } else {
      onChange({ kind: "external" });
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>

      {/* STEP 1 — Party type radio cards */}
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const selected = option === opt.id;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectOption(opt.id)}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors",
                "hover:border-primary/50 hover:bg-primary/5",
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border bg-background",
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
              <div className="min-w-0">
                <div className={cn("text-xs font-semibold", selected ? "text-primary" : "text-foreground")}>
                  {opt.title}
                </div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.helper}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* STEP 2 — Entity selector (progressive disclosure) */}
      {option && (
        <div className="pt-1 border-t border-border">
          {option === "this" && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">{currentCompanyName}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Auto</span>
            </div>
          )}

          {option === "related" && (
            <SearchableCombobox
              placeholder="Search related companies..."
              emptyText="No related companies found."
              items={companies.filter((c) => c.id !== currentCompanyId).map((c) => ({ value: c.id, label: c.name }))}
              value={value.kind === "company" && value.companyId !== currentCompanyId ? value.companyId || "" : ""}
              onChange={(v, label) => onChange({ kind: "company", companyId: v, name: label })}
            />
          )}

          {option === "individual" && (
            <div className="space-y-2">
              <SearchableCombobox
                placeholder="Search members/shareholders..."
                emptyText="No people on file."
                items={shareholders.map((s) => ({ value: s.id, label: s.name }))}
                value={value.kind === "individual" ? value.shareholderId || "" : ""}
                onChange={(v, label) => onChange({ kind: "individual", shareholderId: v, name: label })}
              />
              {shareholders.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Tip: add members on the Members/Shareholders tab to make them selectable here.
                </p>
              )}
            </div>
          )}

          {option === "external" && (
            <div className="space-y-2">
              <Input
                className="h-9 text-sm"
                placeholder="Party name (e.g. ABC Properties LLC)"
                value={externalName}
                onChange={(e) => onExternalNameChange(e.target.value)}
              />
              {onExternalAddressChange && (
                <Input
                  className="h-9 text-sm"
                  placeholder="Address (optional)"
                  value={externalAddress || ""}
                  onChange={(e) => onExternalAddressChange(e.target.value)}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ComboboxProps {
  items: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string, label: string) => void;
  placeholder: string;
  emptyText: string;
}

function SearchableCombobox({ items, value, onChange, placeholder, emptyText }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 text-sm font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.label}
                  onSelect={() => {
                    onChange(item.value, item.label);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === item.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
