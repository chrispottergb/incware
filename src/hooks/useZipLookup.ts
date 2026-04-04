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
  // Store latest onResult in a ref so the lookup callback is always stable
  // but always calls the latest version of onResult
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

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
        onResultRef.current({ city: data.city, state: data.state });
        setZipError(null);
      } else {
        setZipError("ZIP code not found.");
      }
    } catch {
      setZipError("ZIP code not found.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleZipChange = useCallback(
    (zipValue: string) => {
      // Extract the 5-digit core
      const match = zipValue.match(/^(\d{5})(?:-?\d{0,4})?$/);
      if (match) {
        lookup(match[1]);
      } else {
        // User is still typing or cleared — reset so re-entry of same zip works
        lastLookedUp.current = "";
        setZipError(null);
      }
    },
    [lookup]
  );

  const clearError = useCallback(() => setZipError(null), []);
  const reset = useCallback(() => { lastLookedUp.current = ""; setZipError(null); }, []);

  return { handleZipChange, isLoading, zipError, clearError, reset };
}
