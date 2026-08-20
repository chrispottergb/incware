import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const key = Deno.env.get("SSN_ENCRYPTION_KEY");
    if (!key) return new Response(JSON.stringify({ error: "Encryption key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    const callerId = (claims?.claims as { sub?: string } | undefined)?.sub;
    if (claimsErr || !callerId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // The crypt helper is service_role-only; ownership is enforced in the
    // function against the caller id we just verified from the JWT.
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { bank_id } = await req.json();
    if (!bank_id) return new Response(JSON.stringify({ error: "bank_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data, error } = await supabase.rpc("decrypt_company_bank", { p_bank_id: bank_id, p_encryption_key: key, p_caller_id: callerId });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const row = Array.isArray(data) ? data[0] : data;
    return new Response(JSON.stringify({ account_number: row?.account_number ?? null, routing_number: row?.routing_number ?? null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
