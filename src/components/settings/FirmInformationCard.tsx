import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const OWN_FIRM_TYPE = "own_firm";

export interface OwnFirmRecord {
  id?: string;
  firm_name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  contact_name: string;
  contact_title: string;
  default_fee_terms: string;
}

const EMPTY: OwnFirmRecord = {
  firm_name: "",
  address: "",
  address_2: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  email: "",
  contact_name: "",
  contact_title: "",
  default_fee_terms: "",
};

export function useOwnFirm() {
  return useQuery({
    queryKey: ["own_firm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_firms" as any)
        .select("*")
        .eq("firm_type", OWN_FIRM_TYPE)
        .maybeSingle();
      if (error) throw error;
      return (data as any) || null;
    },
  });
}

export default function FirmInformationCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: firm, isLoading } = useOwnFirm();
  const [form, setForm] = useState<OwnFirmRecord>(EMPTY);

  useEffect(() => {
    if (firm) {
      setForm({
        id: firm.id,
        firm_name: firm.firm_name ?? "",
        address: firm.address ?? "",
        address_2: firm.address_2 ?? "",
        city: firm.city ?? "",
        state: firm.state ?? "",
        zip: firm.zip ?? "",
        phone: firm.phone ?? "",
        email: firm.email ?? "",
        contact_name: firm.contact_name ?? "",
        contact_title: firm.contact_title ?? "",
        default_fee_terms: firm.default_fee_terms ?? "",
      });
    }
  }, [firm]);

  const save = useMutation({
    mutationFn: async (values: OwnFirmRecord) => {
      const payload = {
        firm_name: values.firm_name,
        firm_type: OWN_FIRM_TYPE,
        address: values.address || null,
        address_2: values.address_2 || null,
        city: values.city || null,
        state: values.state || null,
        zip: values.zip || null,
        phone: values.phone || null,
        email: values.email || null,
        contact_name: values.contact_name || null,
        contact_title: values.contact_title || null,
        default_fee_terms: values.default_fee_terms || null,
      };
      if (values.id) {
        const { error } = await supabase
          .from("master_firms" as any)
          .update(payload as any)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("master_firms" as any)
          .insert({ ...payload, user_id: user!.id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["own_firm"] });
      toast.success("Firm information saved");
    },
    onError: (err: any) => toast.error(err?.message ?? "Could not save firm information"),
  });

  const field = (key: keyof OwnFirmRecord, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 text-xs"
        value={(form[key] as string) ?? ""}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Firm Information
        </CardTitle>
        <CardDescription className="text-xs">
          Used on engagement letters and other firm-issued documents. Entered once for your firm, not per client.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {field("firm_name", "Firm Name")}
              {field("phone", "Phone")}
              {field("address", "Address")}
              {field("address_2", "Address Line 2")}
              {field("city", "City")}
              {field("state", "State")}
              {field("zip", "ZIP")}
              {field("email", "Email")}
              {field("contact_name", "Signer Name")}
              {field("contact_title", "Signer Title")}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Fee Terms</Label>
              <Textarea
                className="text-xs min-h-[70px]"
                value={form.default_fee_terms}
                placeholder="Flat annual fee of $X, invoiced each January, due on receipt…"
                onChange={(e) => setForm((f) => ({ ...f, default_fee_terms: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" className="h-8 text-xs" disabled={save.isPending} onClick={() => save.mutate(form)}>
                {save.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save Firm Information
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
