import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { normalizeEntryText, matchKey } from "@/lib/name-normalize";

export interface AddressBookEntry {
  id: string;
  full_name: string;
  address: string | null;
  address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  company_id: string | null;
  is_hidden?: boolean;
}

export interface UpsertEntryInput {
  full_name: string;
  address?: string;
  address_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  company_id?: string;
}

type UpsertAction = "skip_hidden" | "update" | "insert";

/**
 * Decides what an upsert should do, given the rows that already exist.
 *
 * This is the fix for the re-seed loop: a value the user hid in Settings must
 * not come back to life the next time a record carrying that same name is
 * saved. Matching is done on the *normalized, case-folded* name so
 * `"  delta   dental "` and `"Delta Dental"` are the same entry.
 *
 * - hidden match  -> do nothing, keep it hidden, return its id
 * - visible match -> update in place
 * - no match      -> insert
 */
export function resolveUpsertPlan(
  fullName: string,
  existing: Pick<AddressBookEntry, "id" | "full_name" | "is_hidden">[],
): { action: UpsertAction; id: string | null } {
  const key = matchKey(fullName);
  if (!key) return { action: "skip_hidden", id: null };

  const match = existing.find((e) => matchKey(e.full_name) === key);
  if (!match) return { action: "insert", id: null };
  if (match.is_hidden) return { action: "skip_hidden", id: match.id };
  return { action: "update", id: match.id };
}

export function useAddressBook(initialCompanyId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [currentCompanyId, setCurrentCompanyId] = useState(initialCompanyId);

  const setCompanyId = useCallback((id: string | undefined) => {
    setCurrentCompanyId(id);
  }, []);

  const { data: allEntries = [], refetch, isFetched } = useQuery({
    queryKey: ["address_book", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_address_book" as any)
        .select("id, full_name, address, address_2, city, state, zip, company_id, is_hidden")
        .order("full_name");
      if (error) throw error;
      return (data as any[]) as AddressBookEntry[];
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Hidden values never feed a suggestion list. They stay in the table so the
  // Settings screen can show and restore them, and so records that already
  // carry the value keep rendering it.
  //
  // Entries belonging to a company flagged as test data are filtered out for
  // the same reason: test names must not pollute typeaheads. They remain
  // untouched in the table and fully visible inside the test company itself.
  const testCompanyIds = useTestCompanyIds();
  const entries = useMemo(
    () =>
      allEntries.filter(
        (e) => !e.is_hidden && !(e.company_id && testCompanyIds.has(e.company_id)),
      ),
    [allEntries, testCompanyIds],
  );

  // One-time auto-seed: populate address book from existing shareholders, directors, master_contacts.
  // Only runs when the book is completely empty AND the user has never performed a
  // cleanup action — otherwise entries the user hid or deleted in
  // Settings > Address Book (e.g. misspellings) would be silently re-created.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!user || seededRef.current || !isFetched || allEntries.length > 0) return;
    seededRef.current = true;


    (async () => {
      try {
        // Seed guard: any prior cleanup action means the empty book is a
        // deliberate state, not a fresh account.
        const { count: cleanupCount } = await supabase
          .from("name_cleanup_log" as any)
          .select("id", { count: "exact", head: true });
        if ((cleanupCount ?? 0) > 0) return;

        // Get user's companies
        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id);
        const companyIds = (companies || []).map((c: any) => c.id);
        if (companyIds.length === 0) return;

        // Build existing-name set (normalized) to skip dupes
        const existing = new Set(allEntries.map((e) => matchKey(e.full_name)));

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
          const trimmed = normalizeEntryText(name);
          if (!trimmed) return;
          const key = matchKey(trimmed);
          if (existing.has(key) || seenInBatch.has(key)) return;
          seenInBatch.add(key);
          rows.push({
            user_id: user.id,
            full_name: trimmed,
            address: normalizeEntryText(src?.address) || null,
            address_2: normalizeEntryText(src?.address_2) || null,
            city: normalizeEntryText(src?.city) || null,
            state: normalizeEntryText(src?.state) || null,
            zip: normalizeEntryText(src?.zip) || null,
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
  }, [user, allEntries, refetch, isFetched]);

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
    mutationFn: async (entry: UpsertEntryInput) => {
      const trimmedName = normalizeEntryText(entry.full_name);
      if (!user || !trimmedName) return;

      // Read current rows (including hidden ones) and decide on the normalized key.
      const { data: existingRows } = await supabase
        .from("user_address_book" as any)
        .select("id, full_name, is_hidden")
        .eq("user_id", user.id);

      const plan = resolveUpsertPlan(trimmedName, (existingRows as any[]) || []);
      if (plan.action === "skip_hidden") return;

      const payload = {
        full_name: trimmedName,
        address: normalizeEntryText(entry.address) || null,
        address_2: normalizeEntryText(entry.address_2) || null,
        city: normalizeEntryText(entry.city) || null,
        state: normalizeEntryText(entry.state) || null,
        zip: normalizeEntryText(entry.zip) || null,
        company_id: entry.company_id || null,
        updated_at: new Date().toISOString(),
      };

      if (plan.action === "update" && plan.id) {
        await supabase
          .from("user_address_book" as any)
          .update(payload as any)
          .eq("id", plan.id);
      } else {
        await supabase
          .from("user_address_book" as any)
          .insert({ ...payload, user_id: user.id } as any);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["address_book"] }),
  });

  return { entries, allEntries, search, getCompanySplitIndex, upsert, setCompanyId };
}
