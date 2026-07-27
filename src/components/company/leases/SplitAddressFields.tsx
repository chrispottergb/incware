import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useZipLookup } from "@/hooks/useZipLookup";
import type { SplitAddress } from "@/lib/lease-address";

interface Props {
  label: string;
  value: SplitAddress;
  onChange: (next: SplitAddress) => void;
}

/**
 * Renders a labeled group of four inputs: Street, City, State, ZIP.
 * On ZIP entry (5 digits), auto-fills City + State via the zip-lookup edge
 * function — but only when those fields are still empty.
 */
export function SplitAddressFields({ label, value, onChange }: Props) {
  const set = (patch: Partial<SplitAddress>) => onChange({ ...value, ...patch });

  const { lookup } = useZipLookup((r) => {
    // Fill only empty city/state so we don't clobber user edits.
    onChange({
      ...value,
      city: value.city || r.city,
      state: value.state || r.state,
    });
  });

  const handleZipBlur = () => {
    const zip = (value.zip || "").trim();
    if (/^\d{5}$/.test(zip) && !(value.city && value.state)) {
      lookup(zip);
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
      <div className="grid grid-cols-[1fr_80px_90px] gap-2">
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
      </div>
    </div>
  );
}
