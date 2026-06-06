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

    const { company_id, management_type, ai_provider, is_single_member, form_overrides } = await req.json();
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

    const [membersRes, officersRes] = await Promise.all([
      admin.from("shareholders").select("*").eq("company_id", company_id).order("name"),
      admin.from("officers").select("*").eq("company_id", company_id),
    ]);

    const members = membersRes.data || [];
    const officers = officersRes.data || [];
    const mgmtType = management_type || "member-managed";
    const isManagerManaged = mgmtType === "manager-managed";
    const isSM = is_single_member === true;

    // Use form overrides if provided (for SM LLC)
    const companyName = form_overrides?.company_name || company.name;
    const memberName = form_overrides?.member_name || (members.length > 0 ? members[0].name : "Not specified");
    const filingDate = form_overrides?.filing_date || company.filing_date || "Not specified";
    const businessPurpose = form_overrides?.business_purpose || company.business_purpose || "General business";
    const fiscalYearEnd = form_overrides?.fiscal_year_end || company.fiscal_year_end || "December 31";

    const membersList = members.map((m: any) => `${m.name} (${m.ownership_percentage || "N/A"}%)`).join(", ") || "No members on record";
    const officerInfo = officers.length > 0
      ? `President: ${officers[0].president || "N/A"}, Secretary: ${officers[0].secretary || "N/A"}, Treasurer: ${officers[0].treasurer || "N/A"}`
      : "No officers designated";

    let prompt: string;

    if (isSM) {
      prompt = `You are a Wisconsin corporate attorney drafting a Sole Member Operating Agreement for a Wisconsin Single Member LLC under Wis. Stat. Ch. 183.

COMPANY INFORMATION:
- Name: ${companyName}
- Entity Type: Single Member LLC
- Sole Member: ${memberName}
- State: ${company.state_of_incorporation || "Wisconsin"}
- Filing Date: ${filingDate}
- Business Purpose: ${businessPurpose}
- Registered Agent: ${company.registered_agent_name || "Not specified"}
- Address: ${[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "Not specified"}
- Fiscal Year End: ${fiscalYearEnd}

INSTRUCTIONS:
Draft customized language for each section of the Sole Member Operating Agreement. Each section should be professional legal language specific to a single-member LLC, referencing Wisconsin statutes where applicable.

Return ONLY a JSON object with these keys (each value is a string):
- preamble
- formation
- purpose
- capitalContributions
- booksAndRecords
- memberRights
- indemnification
- dissolution
- miscellaneous`;
    } else {
      prompt = `You are a Wisconsin corporate attorney drafting an Operating Agreement for a Wisconsin LLC under Wis. Stat. Ch. 183.

COMPANY INFORMATION:
- Name: ${companyName}
- Entity Type: ${company.entity_type}
- Management Type: ${isManagerManaged ? "Manager-Managed" : "Member-Managed"} (Wis. Stat. § 183.0401)
- State: ${company.state_of_incorporation || "Wisconsin"}
- Filing Date: ${filingDate}
- Business Purpose: ${businessPurpose}
- Registered Agent: ${company.registered_agent_name || "Not specified"}
- Address: ${[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ") || "Not specified"}
- Fiscal Year End: ${fiscalYearEnd}
- Members: ${membersList}
- Officers: ${officerInfo}

INSTRUCTIONS:
Draft customized language for each section of the Operating Agreement. Each section should be 1-3 sentences, professional legal language, referencing specific Wisconsin statutes where applicable.

Return ONLY a JSON object with these keys (each value is a string):
- preamble
- formation
- purpose
- term
- members
- capitalContributions
- distributions
- management
- meetings
- transfer
- dissolution
- booksAndRecords
- tax
- indemnification`;
    }

    try {
      const result = await callAI({ provider, prompt });

      let aiDraftSections: any = null;
      try {
        aiDraftSections = parseJsonFromAI(result.content);
      } catch {
        aiDraftSections = null;
      }

      return new Response(
        JSON.stringify({ company, members, officers, managementType: mgmtType, aiDraftSections }),
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
        JSON.stringify({ company, members, officers, managementType: mgmtType, aiDraftSections: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("generate-operating-agreement error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
