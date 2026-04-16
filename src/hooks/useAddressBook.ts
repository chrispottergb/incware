import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useState, useEffect, useRef } from "react";

export interface AddressBookEntry {
  id: string;
  full_name: string;
  address: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  company_id: string | null;
}

export function useAddressBook(initialCompanyId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentCompanyId, setCurrentCompanyId] = useState(initialCompanyId);

  const setCompanyId = useCallback((id: string | undefined) => {
    setCurrentCompanyId(id);
  }, []);

  const { data: entries = [], refetch } = useQuery({
    queryKey: ["address_book", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .select("id, full_name, address, address_2, city, state, zip, company_id")
        .order("full_name");
      if (error) throw error;
      return (data as any[]) as AddressBookEntry[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // One-time auto-seed: populate address book from existing shareholders, directors, master_contacts
  const seededRef = useRef(false);
  useEffect(() => {
    if (!user || seededRef.current) return;
    seededRef.current = true;

    (async () => {
      try {
        // Get user's companies
        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id);
        const companyIds = (companies || []).map((c: any) => c.id);
        if (companyIds.length === 0) return;

        // Build existing-name set (case-insensitive) to skip dupes
        const existing = new Set(entries.map((e) => e.full_name.toLowerCase().trim()));

        const [{ data: shareholders }, { data: directors }, { data: contacts }] = await Promise.all([
          supabase
            .from("shareholders")
            .select("name, address, address_2, city, state, zip, company_id")
            .in("company_id", companyIds),
          supabase
            .from("directors")
            .select("name, address, address_2, city, state, zip, company_id")
            .in("company_id", companyIds),
          supabase
            .from("master_contacts")
            .select("contact_name")
            .eq("user_id", user.id),
        ]);

        const rows: any[] = [];
        const seenInBatch = new Set<string>();
        const addRow = (name: string | null | undefined, src: any, company_id: string | null) => {
          const trimmed = (name || "").trim();
          if (!trimmed) return;
          const key = trimmed.toLowerCase();
          if (existing.has(key) || seenInBatch.has(key)) return;
          seenInBatch.add(key);
          rows.push({
            user_id: user.id,
            full_name: trimmed,
            address: src?.address || null,
            address_2: src?.address_2 || null,
            city: src?.city || null,
            state: src?.state || null,
            zip: src?.zip || null,
            company_id,
          });
        };

        (shareholders || []).forEach((s: any) => addRow(s.name, s, s.company_id));
        (directors || []).forEach((d: any) => addRow(d.name, d, d.company_id));
        (contacts || []).forEach((c: any) => addRow(c.contact_name, null, null));

        if (rows.length > 0) {
          await supabase.from("user_address_book" as any).insert(rows as any);
          refetch();
        }
      } catch (err) {
        console.error("Address book seed failed:", err);
      }
    })();
  }, [user, entries, refetch]);

  // Search entries: current company first, then rest
  const search = useCallback(
    (query: string): AddressBookEntry[] => {
      if (!query || query.length < 2) return [];
      const q = query.toLowerCase().trim();
      const matches = entries.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          (e.address && e.address.toLowerCase().includes(q))
      );
      if (!currentCompanyId) return matches.slice(0, 10);
      const companyMatches = matches.filter((e) => e.company_id === currentCompanyId);
      const otherMatches = matches.filter((e) => e.company_id !== currentCompanyId);
      return [...companyMatches, ...otherMatches].slice(0, 10);
    },
    [entries, currentCompanyId]
  );

  const getCompanySplitIndex = useCallback(
    (results: AddressBookEntry[]) => {
      if (!currentCompanyId) return -1;
      let lastCompany = -1;
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i].company_id === currentCompanyId) { lastCompany = i; break; }
      }
      if (lastCompany === -1 || lastCompany === results.length - 1) return -1;
      return lastCompany + 1;
    },
    [currentCompanyId]
  );

  const upsert = useMutation({
    mutationFn: async (entry: {
      full_name: string;
      address?: string;
      address_2?: string;
      city?: string;
      state?: string;
      zip?: string;
      company_id?: string;
    }) => {
      if (!user || !entry.full_name.trim()) return;
      const trimmedName = entry.full_name.trim();
      const trimmedAddr = (entry.address || "").trim() || null;

      // Check existing
      const { data: existing } = await supabase
        .from("user_address_book" as any)
        .select("id")
        .eq("user_id", user.id)
        .ilike("full_name", trimmedName)
        .maybeSingle();

      const payload = {
        full_name: trimmedName,
        address: trimmedAddr,
        address_2: entry.address_2?.trim() || null,
        city: entry.city?.trim() || null,
        state: entry.state?.trim() || null,
        zip: entry.zip?.trim() || null,
        company_id: entry.company_id || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from("user_address_book" as any)
          .update(payload as any)
          .eq("id", (existing as any).id);
      } else {
        await supabase
          .from("user_address_book" as any)
          .insert({ ...payload, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["address_book"] }),
  });

  return { entries, search, getCompanySplitIndex, upsert, setCompanyId };
}
