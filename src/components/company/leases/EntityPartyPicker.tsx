import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeaseParty } from "@/lib/lease-classification";

interface Props {
  label: string;
  currentCompanyId: string;
  value: LeaseParty;
  onChange: (party: LeaseParty) => void;
  /** Free-text fallback name (always editable, used in the PDF) */
  externalName: string;
  onExternalNameChange: (name: string) => void;
  /** Optional address shown for external party */
  externalAddress?: string;
  onExternalAddressChange?: (addr: string) => void;
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

  const tab = value.kind === "individual" ? "individual" : value.kind === "external" ? "external" : value.companyId === currentCompanyId ? "this" : "related";

  return (
    <div className="space-y-2">
      <Label className="field-label">{label}</Label>
      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "this") {
            onChange({ kind: "company", companyId: currentCompanyId });
          } else if (v === "related") {
            onChange({ kind: "company", companyId: undefined });
          } else if (v === "individual") {
            onChange({ kind: "individual", shareholderId: undefined });
          } else {
            onChange({ kind: "external" });
          }
        }}
      >
        <TabsList className="grid grid-cols-4 h-7">
          <TabsTrigger value="this" className="text-xs">This Company</TabsTrigger>
          <TabsTrigger value="related" className="text-xs">Related Co.</TabsTrigger>
          <TabsTrigger value="individual" className="text-xs">Individual</TabsTrigger>
          <TabsTrigger value="external" className="text-xs">External</TabsTrigger>
        </TabsList>

        <TabsContent value="this" className="mt-2">
          <p className="text-xs text-muted-foreground">
            {companies.find((c) => c.id === currentCompanyId)?.name || "Current company"}
          </p>
        </TabsContent>

        <TabsContent value="related" className="mt-2">
          <Select
            value={value.kind === "company" && value.companyId !== currentCompanyId ? value.companyId || "" : ""}
            onValueChange={(v) => onChange({ kind: "company", companyId: v, name: companies.find((c) => c.id === v)?.name })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select a related company" />
            </SelectTrigger>
            <SelectContent>
              {companies.filter((c) => c.id !== currentCompanyId).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TabsContent>

        <TabsContent value="individual" className="mt-2">
          <Select
            value={value.kind === "individual" ? value.shareholderId || "" : ""}
            onValueChange={(v) => onChange({ kind: "individual", shareholderId: v, name: shareholders.find((s) => s.id === v)?.name })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select a member/shareholder" />
            </SelectTrigger>
            <SelectContent>
              {shareholders.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {shareholders.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">No shareholders/members on file.</p>
          )}
        </TabsContent>

        <TabsContent value="external" className="mt-2 space-y-2">
          <Input
            className="h-8 text-sm"
            placeholder="Party name"
            value={externalName}
            onChange={(e) => onExternalNameChange(e.target.value)}
          />
          {onExternalAddressChange && (
            <Input
              className="h-8 text-sm"
              placeholder="Address"
              value={externalAddress || ""}
              onChange={(e) => onExternalAddressChange(e.target.value)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
