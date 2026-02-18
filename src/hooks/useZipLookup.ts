import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ZipLookupResult {
  city: string;
  state: string;
}

/**
 * Hook that auto-populates city and state when a 5-digit zip code is entered.
 * 
 * @param onResult - callback receiving { city, state } to update form state
 * @returns handleZipChange - pass as onChange handler for zip input (or call with zip string)
 */
export function useZipLookup(onResult: (result: ZipLookupResult) => void) {
  const lastLookedUp = useRef<string>("");

  const lookup = useCallback(async (zip: string) => {
    if (!/^\d{5}$/.test(zip) || zip === lastLookedUp.current) return;
    lastLookedUp.current = zip;

    try {
      const { data, error } = await supabase.functions.invoke("zip-lookup", {
        body: { zip },
      });

      if (error) throw error;
      if (data?.city && data?.state) {
        onResult({ city: data.city, state: data.state });
      }
    } catch {
      // Silently fail - user can still type city/state manually
    }
  }, [onResult]);

  const handleZipChange = useCallback(
    (zipValue: string) => {
      if (zipValue.length === 5) {
        lookup(zipValue);
      }
    },
    [lookup]
  );

  return { handleZipChange };
}
