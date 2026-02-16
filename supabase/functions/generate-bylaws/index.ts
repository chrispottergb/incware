import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (compErr || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found or access denied" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const [directorsRes, officersRes, shareholdersRes] = await Promise.all([
      admin.from("directors").select("*").eq("company_id", company_id).order("name"),
      admin.from("officers").select("*").eq("company_id", company_id),
      admin.from("shareholders").select("*").eq("company_id", company_id).order("name"),
    ]);

    const directors = directorsRes.data || [];
    const officers = officersRes.data || [];
    const shareholders = shareholdersRes.data || [];
    const isSCorp = company.entity_type === "S-Corp";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ company, directors, officers, shareholders, aiDraftSections: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const directorsList = directors.map((d: any) => d.name).join(", ") || "No directors on record";
    const officerInfo = officers.length > 0
      ? `President: ${officers[0].president || "N/A"}, Secretary: ${officers[0].secretary || "N/A"}, Treasurer: ${officers[0].treasurer || "N/A"}`
      : "No officers designated";
    const shareholdersList = shareholders.map((s: any) => `${s.name} (${s.status || "active"})`).join(", ") || "No shareholders on record";

    const prompt = `You are a Wisconsin corporate attorney drafting Bylaws for a Wisconsin ${company.entity_type} under Wis. Stat. Ch. 180.

COMPANY INFORMATION:
- Name: ${company.name}
- Entity Type: ${company.entity_type}${isSCorp ? " (S-Corporation under IRC § 1362)" : ""}
- State: ${company.state_of_incorporation || "Wisconsin"}
- Incorporation Date: ${company.incorporation_date || "Not specified"}
- Business Purpose: ${company.business_purpose || "General business"}
- Registered Agent: ${company.registered_agent_name || "Not specified"}
- Address: ${[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "Not specified"}
- Fiscal Year End: ${company.fiscal_year_end || "December 31"}
- Authorized Shares: ${company.authorized_shares || "Not specified"}
- Par Value: ${company.par_value || "No par value"}
- Directors: ${directorsList}
- Officers: ${officerInfo}
- Shareholders: ${shareholdersList}
- Annual Meeting: ${company.scheduled_annual_meeting || "Not specified"}

INSTRUCTIONS:
Draft customized language for each section of the Bylaws. Each section should be 1-3 sentences, professional legal language, referencing specific Wisconsin statutes where applicable. Tailor to this specific company.

Return ONLY a JSON object with these keys (each value is a string):
- preamble
- principalOffice
- annualMeeting
- specialMeetings
- quorum
- boardPowers
- boardNumber
- boardMeetings
- officers
- stock
- dividends
- indemnification
- booksAndRecords
- amendments`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", status, await aiResponse.text());
      return new Response(
        JSON.stringify({ company, directors, officers, shareholders, aiDraftSections: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    let aiDraftSections: any = null;
    try {
      const jsonStr = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      aiDraftSections = JSON.parse(jsonStr);
    } catch {
      aiDraftSections = null;
    }

    return new Response(
      JSON.stringify({ company, directors, officers, shareholders, aiDraftSections }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-bylaws error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
