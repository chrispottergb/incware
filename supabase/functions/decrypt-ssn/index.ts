import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const encryptionKey = Deno.env.get("SSN_ENCRYPTION_KEY");

    if (!encryptionKey) {
      return new Response(
        JSON.stringify({ error: "Encryption key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    const { shareholder_ids } = await req.json();

    if (!Array.isArray(shareholder_ids) || shareholder_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "shareholder_ids array required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to prevent abuse
    if (shareholder_ids.length > 100) {
      return new Response(
        JSON.stringify({ error: "Maximum 100 IDs per request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to decrypt but verify ownership first
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify user owns all requested shareholders' companies
    const { data: shareholders, error: fetchError } = await adminClient
      .from("shareholders")
      .select("id, ssn_ein_encrypted, company_id, companies!inner(user_id)")
      .in("id", shareholder_ids);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch shareholders" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter to only shareholders owned by the requesting user
    const results: Record<string, string | null> = {};
    for (const s of shareholders || []) {
      const company = s.companies as any;
      if (company?.user_id !== userId) continue;

      if (s.ssn_ein_encrypted) {
        // Decrypt using SQL function
        const { data: decrypted, error: decErr } = await adminClient.rpc(
          "decrypt_ssn_ein",
          { shareholder_id: s.id, encryption_key: encryptionKey }
        );
        if (!decErr) {
          results[s.id] = decrypted;
        } else {
          results[s.id] = null;
        }
      } else {
        results[s.id] = null;
      }
    }

    return new Response(JSON.stringify({ data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
