import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useZipLookup } from "@/hooks/useZipLookup";
import type { SplitAddress } from "@/lib/lease-address";

interface Props {
  label: string;
  value: SplitAddress;
  onChange: (next: SplitAddress) => void;
  /** When true, renders a County field that the ZIP lookup auto-fills. */
  showCounty?: boolean;
}

/**
 * Renders a labeled group of inputs: Street, City, State, ZIP (+ optional County).
 * On ZIP entry (5 digits), auto-fills City + State (+ County) via the zip-lookup
 * edge function — but only when those fields are still empty.
 */
export function SplitAddressFields({ label, value, onChange, showCounty = false }: Props) {
  const set = (patch: Partial<SplitAddress>) => onChange({ ...value, ...patch });

  const { handleZipChange } = useZipLookup((r) => {
    // Fill only empty fields so we don't clobber user edits.
    onChange({
      ...value,
      city: value.city || r.city,
      state: value.state || r.state,
      county: value.county || r.county || "",
    });
  });

  const handleZipBlur = () => {
    const zip = (value.zip || "").trim();
    if (/^\d{5}$/.test(zip) && (!(value.city && value.state) || (showCounty && !value.county))) {
      handleZipChange(zip);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="field-label">{label}</Label>
      <Input
        className="h-8 text-sm"
        placeholder="Street"
        value={value.street}
        onChange={(e) => set({ street: e.target.value })}
      />
      <div className={`grid gap-2 ${showCounty ? "grid-cols-[1fr_80px_90px_130px]" : "grid-cols-[1fr_80px_90px]"}`}>
        <Input
          className="h-8 text-sm"
          placeholder="City"
          value={value.city}
          onChange={(e) => set({ city: e.target.value })}
        />
        <Input
          className="h-8 text-sm uppercase"
          placeholder="State"
          maxLength={2}
          value={value.state}
          onChange={(e) => set({ state: e.target.value.toUpperCase() })}
        />
        <Input
          className="h-8 text-sm"
          placeholder="ZIP"
          maxLength={10}
          value={value.zip}
          onChange={(e) => set({ zip: e.target.value })}
          onBlur={handleZipBlur}
        />
        {showCounty && (
          <Input
            className="h-8 text-sm"
            placeholder="County"
            value={value.county}
            onChange={(e) => set({ county: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}
