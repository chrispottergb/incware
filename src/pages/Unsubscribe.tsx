import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State =
  | { kind: "loading" }
  | { kind: "valid" }
  | { kind: "already" }
  | { kind: "invalid"; message: string }
  | { kind: "submitting" }
  | { kind: "success" };

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", message: "Missing unsubscribe token." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setState({ kind: "invalid", message: data.error || "Invalid token." });
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
        } else if (data.valid) {
          setState({ kind: "valid" });
        } else {
          setState({ kind: "invalid", message: "Invalid token." });
        }
      } catch (e: any) {
        setState({ kind: "invalid", message: e.message || "Network error." });
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState({ kind: "submitting" });
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if ((data as any)?.success || (data as any)?.reason === "already_unsubscribed") {
        setState({ kind: "success" });
      } else {
        setState({ kind: "invalid", message: (data as any)?.error || "Failed to unsubscribe." });
      }
    } catch (e: any) {
      setState({ kind: "invalid", message: e.message || "Failed to unsubscribe." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unsubscribe from EntityIQ Emails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && <p>Validating your link…</p>}
          {state.kind === "valid" && (
            <>
              <p>Click below to confirm you no longer want to receive these emails.</p>
              <Button onClick={confirm}>Confirm Unsubscribe</Button>
            </>
          )}
          {state.kind === "submitting" && <p>Processing…</p>}
          {state.kind === "success" && (
            <p className="text-green-600">You have been unsubscribed.</p>
          )}
          {state.kind === "already" && (
            <p>You are already unsubscribed.</p>
          )}
          {state.kind === "invalid" && (
            <p className="text-destructive">{state.message}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
