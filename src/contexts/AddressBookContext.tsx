import { createContext, useContext, type ReactNode } from "react";
import { useAddressBook, type AddressBookEntry, type UpsertEntryInput } from "@/hooks/useAddressBook";
import type { UseMutationResult } from "@tanstack/react-query";

interface AddressBookContextValue {
  entries: AddressBookEntry[];
  search: (query: string) => AddressBookEntry[];
  getCompanySplitIndex: (results: AddressBookEntry[]) => number;
  upsert: UseMutationResult<void, Error, UpsertEntryInput, unknown>;
  setCompanyId: (id: string | undefined) => void;
}

const AddressBookContext = createContext<AddressBookContextValue | null>(null);

export function AddressBookProvider({ children }: { children: ReactNode }) {
  const addressBook = useAddressBook();

  return (
    <AddressBookContext.Provider value={{ ...addressBook, setCompanyId: addressBook.setCompanyId }}>
      {children}
    </AddressBookContext.Provider>
  );
}

export function useAddressBookContext(companyId?: string) {
  const ctx = useContext(AddressBookContext);
  if (!ctx) throw new Error("useAddressBookContext must be used within AddressBookProvider");

  // Update company ID for prioritization when it changes
  if (companyId) {
    ctx.setCompanyId(companyId);
  }

  return {
    entries: ctx.entries,
    search: ctx.search,
    getCompanySplitIndex: ctx.getCompanySplitIndex,
    upsert: ctx.upsert,
  };
}

/**
 * Non-throwing accessor for the visible (non-hidden) suggestion list. Used by
 * `NameAutocomplete` to compute the near-match hint client-side; returns an
 * empty list when the component is rendered outside the provider.
 */
export function useVisibleAddressBookEntries(): AddressBookEntry[] {
  return useContext(AddressBookContext)?.entries ?? [];
}
