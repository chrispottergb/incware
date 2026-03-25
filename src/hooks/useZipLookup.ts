import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ZipLookupResult {
  city: string;
  state: string;
}

/**
 * Hook that auto-populates city and state when a 5-digit zip code is entered.
 *
 * @param onResult - callback receiving { city, state } to update form state
 * @returns handleZipChange - pass as onChange handler for zip input (or call with zip string)
 * @returns isLoading - true while the lookup is in progress
 * @returns zipError - error message string if lookup failed, null otherwise
 */
export function useZipLookup(onResult: (result: ZipLookupResult) => void) {
  const lastLookedUp = useRef<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const lookup = useCallback(async (zip: string) => {
    if (!/^\d{5}$/.test(zip) || zip === lastLookedUp.current) return;
    lastLookedUp.current = zip;
    setIsLoading(true);
    setZipError(null);

    try {
      const { data, error } = await supabase.functions.invoke("zip-lookup", {
        body: { zip },
      });

      if (error) throw error;
      if (data?.city && data?.state) {
        onResult({ city: data.city, state: data.state });
        setZipError(null);
      } else {
        setZipError("ZIP code not found — please enter city and state manually.");
      }
    } catch {
      setZipError("ZIP code not found — please enter city and state manually.");
    } finally {
      setIsLoading(false);
    }
  }, [onResult]);

  const handleZipChange = useCallback(
    (zipValue: string) => {
      // Clear error when user is still typing
      if (!/^\d{5}$/.test(zipValue.replace(/-\d{0,4}$/, ""))) {
        setZipError(null);
      }
      // Support both 5-digit and ZIP+4 formats (e.g. "54915" or "54915-1278")
      const match = zipValue.match(/^(\d{5})(?:-?\d{0,4})?$/);
      if (match) {
        lookup(match[1]);
      }
    },
    [lookup]
  );

  const clearError = useCallback(() => setZipError(null), []);

  return { handleZipChange, isLoading, zipError, clearError };
}
