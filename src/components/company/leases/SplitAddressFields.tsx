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
 * On ZIP entry (5 digits), auto-fills City + State via zippopotam.us lookup
 * if those fields are still empty.
 */
export function SplitAddressFields({ label, value, onChange }: Props) {
  const { lookup } = useZipLookup();

  const set = (patch: Partial<SplitAddress>) => onChange({ ...value, ...patch });

  const handleZipBlur = async () => {
    const zip = (value.zip || "").trim();
    if (!/^\d{5}$/.test(zip)) return;
    if (value.city && value.state) return;
    try {
      const res = await lookup(zip);
      if (res) {
        set({
          city: value.city || res.city,
          state: value.state || res.state,
        });
      }
    } catch {
      /* ignore */
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
