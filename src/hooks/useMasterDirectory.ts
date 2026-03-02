import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FirmType = "law" | "accounting" | "bank";
export type ContactType = "attorney" | "accountant";

export function useMasterFirms(firmType: FirmType) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: masterFirms = [] } = useQuery({
    queryKey: ["master_firms", firmType],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_firms" as any)
        .select("*")
        .eq("firm_type", firmType)
        .order("firm_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const upsertMasterFirm = useMutation({
    mutationFn: async (firm: {
      firm_name: string;
      address?: string; address_2?: string; city?: string; state?: string; zip?: string;
      phone?: string; email?: string; website?: string;
      account_number?: string; routing_number?: string; account_type?: string;
      contact_name?: string; contact_title?: string;
    }) => {
      if (!user) return;
      // Check if firm already exists in master by name
      const { data: existing } = await supabase
        .from("master_firms" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("firm_type", firmType)
        .ilike("firm_name", firm.firm_name.trim())
        .maybeSingle();

      if (existing) {
        await supabase.from("master_firms" as any).update({
          ...firm, updated_at: new Date().toISOString(),
        } as any).eq("id", (existing as any).id);
      } else {
        await supabase.from("master_firms" as any).insert({
          ...firm, firm_type: firmType, user_id: user.id,
        } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master_firms", firmType] }),
  });

  const deleteMasterFirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("master_firms" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master_firms", firmType] }),
  });

  return { masterFirms, upsertMasterFirm, deleteMasterFirm };
}

export function useMasterContacts(contactType: ContactType) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: masterContacts = [] } = useQuery({
    queryKey: ["master_contacts", contactType],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_contacts" as any)
        .select("*")
        .eq("contact_type", contactType)
        .order("contact_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const upsertMasterContact = useMutation({
    mutationFn: async (contact: {
      contact_name: string;
      title?: string; bar_number?: string; cpa_number?: string;
      specialty?: string; phone?: string; email?: string; notes?: string;
    }) => {
      if (!user) return;
      const { data: existing } = await supabase
        .from("master_contacts" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("contact_type", contactType)
        .ilike("contact_name", contact.contact_name.trim())
        .maybeSingle();

      if (existing) {
        await supabase.from("master_contacts" as any).update({
          ...contact, updated_at: new Date().toISOString(),
        } as any).eq("id", (existing as any).id);
      } else {
        await supabase.from("master_contacts" as any).insert({
          ...contact, contact_type: contactType, user_id: user.id,
        } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["master_contacts", contactType] }),
  });

  return { masterContacts, upsertMasterContact };
}
