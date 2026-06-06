import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, parseJsonFromAI, AIProviderError, type AIProvider } from "../_shared/ai-provider.ts";

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

    const { company_id, ai_provider } = await req.json();
    const provider: AIProvider = ai_provider || "lovable";

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

    const [directorsRes, officersRes] = await Promise.all([
      admin.from("directors").select("*").eq("company_id", company_id).order("name"),
      admin.from("officers").select("*").eq("company_id", company_id),
    ]);

    const directors = directorsRes.data || [];
    const officers = officersRes.data || [];

    const directorsList = directors.map((d: any) => d.name).join(", ") || "No directors on record";
    const officerInfo = officers.length > 0
      ? `President: ${officers[0].president || "N/A"}, Secretary: ${officers[0].secretary || "N/A"}, Treasurer: ${officers[0].treasurer || "N/A"}`
      : "No officers designated";

    const prompt = `You are a Wisconsin nonprofit attorney drafting Bylaws for a Wisconsin Non-Profit Corporation under Wis. Stat. Ch. 181 (Nonstock Corporation Law).

COMPANY INFORMATION:
- Name: ${company.name}
- Entity Type: Non-Profit Corporation
- State: ${company.state_of_incorporation || "Wisconsin"}
- Incorporation Date: ${company.incorporation_date || "Not specified"}
- Business Purpose: ${company.business_purpose || "Charitable, educational, religious, scientific, or literary purposes under IRC § 501(c)(3)"}
- Registered Agent: ${company.registered_agent_name || "Not specified"}
- Address: ${[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "Not specified"}
- Fiscal Year End: ${company.fiscal_year_end || "December 31"}
- Directors: ${directorsList}
- Officers: ${officerInfo}

INSTRUCTIONS:
Draft customized language for each section of the Non-Profit Bylaws. Each section should be 1-3 sentences, professional legal language, referencing Wis. Stat. Ch. 181 where applicable. Include IRS 501(c)(3) compliance language. Tailor to this specific organization.

Return ONLY a JSON object with these keys (each value is a string):
- preamble
- purpose
- powers
- principalOffice
- membership
- memberMeetings
- boardPowers
- boardNumber
- boardElection
- boardMeetings
- officers
- committees
- conflictDisclosure
- conflictDetermination
- indemnification
- booksAndRecords
- nonDiscrimination
- dissolution
- amendments`;

    try {
      const result = await callAI({ provider, prompt });

      let aiDraftSections: any = null;
      try {
        aiDraftSections = parseJsonFromAI(result.content);
      } catch {
        aiDraftSections = null;
      }

      return new Response(
        JSON.stringify({ company, directors, officers, aiDraftSections }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err) {
      if (err instanceof AIProviderError) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI error:", err);
      return new Response(
        JSON.stringify({ company, directors, officers, aiDraftSections: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("generate-nonprofit-bylaws error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
