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
    // Auth check
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

    // Verify user
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
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to fetch all data
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (compErr || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found or access denied" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all related data in parallel
    const [
      officersRes,
      directorsRes,
      shareholdersRes,
      certificatesRes,
      transactionsRes,
      meetingsRes,
      billsRes,
      businessSalesRes,
      assetsRes,
      timelineRes,
      documentsRes,
      aiSystemsRes,
      aiIncidentsRes,
      aiUsageRes,
    ] = await Promise.all([
      admin.from("officers").select("*").eq("company_id", company_id),
      admin.from("directors").select("*").eq("company_id", company_id),
      admin.from("shareholders").select("*").eq("company_id", company_id),
      admin
        .from("stock_certificates")
        .select("*, shareholders(name)")
        .eq("company_id", company_id)
        .order("certificate_number"),
      admin
        .from("share_transactions")
        .select("*, shareholders(name)")
        .eq("company_id", company_id)
        .order("transaction_date"),
      admin
        .from("meetings")
        .select("*")
        .eq("company_id", company_id)
        .order("meeting_date", { ascending: false }),
      admin.from("bills_of_sale").select("*").eq("company_id", company_id),
      admin.from("business_sales").select("*").eq("company_id", company_id),
      admin.from("company_assets").select("*").eq("company_id", company_id),
      admin
        .from("timeline_events")
        .select("*")
        .eq("company_id", company_id)
        .order("event_date"),
      admin.from("document_registry").select("*").eq("company_id", company_id),
      admin.from("ai_systems").select("*").eq("company_id", company_id),
      admin.from("ai_risk_incidents").select("*").eq("company_id", company_id),
      admin.from("ai_usage_logs").select("*").eq("company_id", company_id),
    ]);

    // Fetch meeting sub-data for each meeting
    const meetingIds = (meetingsRes.data || []).map((m: any) => m.id);
    let meetingSubData: any = {};
    if (meetingIds.length > 0) {
      const [resolutions, financials, mShareholders, mDirectors, mOfficers] =
        await Promise.all([
          admin
            .from("meeting_resolutions")
            .select("*")
            .in("meeting_id", meetingIds),
          admin
            .from("meeting_financials")
            .select("*")
            .in("meeting_id", meetingIds),
          admin
            .from("meeting_shareholders")
            .select("*")
            .in("meeting_id", meetingIds),
          admin
            .from("meeting_directors")
            .select("*")
            .in("meeting_id", meetingIds),
          admin
            .from("meeting_officers")
            .select("*")
            .in("meeting_id", meetingIds),
        ]);
      meetingSubData = {
        resolutions: resolutions.data || [],
        financials: financials.data || [],
        shareholders: mShareholders.data || [],
        directors: mDirectors.data || [],
        officers: mOfficers.data || [],
      };
    }

    // AI oversight persons
    const systemIds = (aiSystemsRes.data || []).map((s: any) => s.id);
    let oversightPersons: any[] = [];
    if (systemIds.length > 0) {
      const { data } = await admin
        .from("ai_oversight_persons")
        .select("*")
        .in("ai_system_id", systemIds);
      oversightPersons = data || [];
    }

    // Build the full data payload
    const companyData = {
      company,
      officers: officersRes.data || [],
      directors: directorsRes.data || [],
      shareholders: shareholdersRes.data || [],
      certificates: certificatesRes.data || [],
      transactions: transactionsRes.data || [],
      meetings: meetingsRes.data || [],
      meetingSubData,
      bills: billsRes.data || [],
      businessSales: businessSalesRes.data || [],
      assets: assetsRes.data || [],
      timeline: timelineRes.data || [],
      documents: documentsRes.data || [],
      aiSystems: aiSystemsRes.data || [],
      aiIncidents: aiIncidentsRes.data || [],
      aiUsageLogs: aiUsageRes.data || [],
      oversightPersons,
    };

    // Build AI prompt
    const isLLC = company.entity_type === "LLC";
    const statuteRef = isLLC ? "Wis. Stat. Ch. 183" : "Wis. Stat. Ch. 180";
    const entityTerms = isLLC
      ? "members, membership units, membership interest"
      : "shareholders, shares, stock";

    const prompt = `You are a corporate compliance expert specializing in Wisconsin business entities. Generate a professional executive summary and compliance narrative for a corporate record book.

COMPANY DATA:
${JSON.stringify(companyData, null, 0)}

INSTRUCTIONS:
1. Write an "Executive Summary" (2-3 paragraphs) describing the company's corporate standing, formation history, governance structure, and current status. Reference ${statuteRef} as applicable. Use terminology: ${entityTerms}.

2. Write a "Compliance Narrative" (1-2 paragraphs) evaluating the company's record-keeping completeness. Note any gaps (missing meetings, unsigned documents, incomplete registrations). Reference specific Wisconsin statutes.

3. Write brief "Section Introductions" (1 sentence each) for these sections: Articles of ${isLLC ? "Organization" : "Incorporation"}, ${isLLC ? "Managers & Members" : "Officers & Directors"}, ${isLLC ? "Members Registry" : "Shareholders Registry"}, ${isLLC ? "Membership Interest Certificates" : "Stock Certificates"}, ${isLLC ? "Interest Ledger" : "Stock Ledger"}, Meeting Minutes, ${isLLC ? "Interest Transfers" : "Bills of Sale"}, Business Sales, Compliance Checklist, AI Compliance, Corporate Timeline, Document Registry.

Return ONLY a JSON object with keys: executiveSummary, complianceNarrative, sectionIntros (object with keys matching section names above).`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // Return data without AI content if no key
      return new Response(
        JSON.stringify({ companyData, aiContent: null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
          JSON.stringify({
            error: "AI rate limit exceeded. Please try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "AI credits exhausted. Please add credits to continue.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      // Fall through — return data without AI
      console.error("AI gateway error:", status, await aiResponse.text());
      return new Response(
        JSON.stringify({ companyData, aiContent: null }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent =
      aiResult.choices?.[0]?.message?.content || "";

    // Try to parse JSON from AI response
    let aiContent: any = null;
    try {
      // Strip markdown code fences if present
      const jsonStr = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      aiContent = JSON.parse(jsonStr);
    } catch {
      aiContent = {
        executiveSummary: rawContent,
        complianceNarrative: "",
        sectionIntros: {},
      };
    }

    return new Response(
      JSON.stringify({ companyData, aiContent }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("generate-record-book error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
