import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("SSN_ENCRYPTION_KEY");

  if (!encryptionKey) {
    return new Response(
      JSON.stringify({ error: "SSN_ENCRYPTION_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Verify caller identity
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const userId = claimsData.claims.sub;

  // Check admin role
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    return new Response(
      JSON.stringify({ error: "Admin role required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch all shareholders with plaintext ssn_ein
  const { data: rows, error: fetchErr } = await adminClient
    .from("shareholders")
    .select("id, ssn_ein")
    .not("ssn_ein", "is", null);

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let encrypted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows || []) {
    if (!row.ssn_ein || row.ssn_ein.trim() === "") {
      skipped++;
      continue;
    }

    // pgp_sym_encrypt output stored as text would start with \\x (hex-encoded bytea)
    // or the raw value looks like binary gibberish. Plaintext SSNs/EINs are digits/dashes only.
    const isPlaintext = /^[\d\-\s]+$/.test(row.ssn_ein.trim());
    if (!isPlaintext) {
      skipped++;
      continue;
    }

    // Use encrypt_ssn_ein function directly, then update the row
    const { error: encErr } = await adminClient.rpc("encrypt_ssn_ein", {
      plain_text: row.ssn_ein.trim(),
      encryption_key: encryptionKey,
    }).then(async (res) => {
      if (res.error) return { error: res.error };
      // Update the row: set ssn_ein_encrypted and clear ssn_ein
      const { error: updErr } = await adminClient
        .from("shareholders")
        .update({ ssn_ein_encrypted: res.data, ssn_ein: null })
        .eq("id", row.id);
      return { error: updErr };
    });

    if (encErr) {
      errors.push(`Row ${row.id}: ${encErr.message}`);
    } else {
      encrypted++;
    }
  }

  console.log(`Legacy SSN encryption complete: encrypted=${encrypted}, skipped=${skipped}, errors=${errors.length}`);

  return new Response(
    JSON.stringify({ encrypted, skipped, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
