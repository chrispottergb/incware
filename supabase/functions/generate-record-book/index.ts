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
    const skipAI = ai_provider === "none";
    const provider: AIProvider = skipAI ? "lovable" : (ai_provider || "lovable");

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

    // Fetch all related data in parallel
    const [
      officersRes, directorsRes, shareholdersRes, certificatesRes,
      transactionsRes, meetingsRes, billsRes, businessSalesRes,
      assetsRes, timelineRes, documentsRes, aiSystemsRes,
      aiIncidentsRes, aiUsageRes,
    ] = await Promise.all([
      admin.from("officers").select("*").eq("company_id", company_id),
      admin.from("directors").select("*").eq("company_id", company_id),
      admin.from("shareholders").select("*").eq("company_id", company_id),
      admin.from("stock_certificates").select("*, shareholders(name)").eq("company_id", company_id).order("certificate_number"),
      admin.from("share_transactions").select("*, shareholders(name)").eq("company_id", company_id).order("transaction_date"),
      admin.from("meetings").select("*").eq("company_id", company_id).order("meeting_date", { ascending: false }),
      admin.from("bills_of_sale").select("*").eq("company_id", company_id),
      admin.from("business_sales").select("*").eq("company_id", company_id),
      admin.from("company_assets").select("*").eq("company_id", company_id),
      admin.from("timeline_events").select("*").eq("company_id", company_id).order("event_date"),
      admin.from("document_registry").select("*").eq("company_id", company_id),
      admin.from("ai_systems").select("*").eq("company_id", company_id),
      admin.from("ai_risk_incidents").select("*").eq("company_id", company_id),
      admin.from("ai_usage_logs").select("*").eq("company_id", company_id),
    ]);

    const meetingIds = (meetingsRes.data || []).map((m: any) => m.id);
    let meetingSubData: any = {};
    if (meetingIds.length > 0) {
      const [resolutions, financials, mShareholders, mDirectors, mOfficers] =
        await Promise.all([
          admin.from("meeting_resolutions").select("*").in("meeting_id", meetingIds),
          admin.from("meeting_financials").select("*").in("meeting_id", meetingIds),
          admin.from("meeting_shareholders").select("*").in("meeting_id", meetingIds),
          admin.from("meeting_directors").select("*").in("meeting_id", meetingIds),
          admin.from("meeting_officers").select("*").in("meeting_id", meetingIds),
        ]);
      meetingSubData = {
        resolutions: resolutions.data || [],
        financials: financials.data || [],
        shareholders: mShareholders.data || [],
        directors: mDirectors.data || [],
        officers: mOfficers.data || [],
      };
    }

    const systemIds = (aiSystemsRes.data || []).map((s: any) => s.id);
    let oversightPersons: any[] = [];
    if (systemIds.length > 0) {
      const { data } = await admin.from("ai_oversight_persons").select("*").in("ai_system_id", systemIds);
      oversightPersons = data || [];
    }

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

    const isLLC = company.entity_type === "LLC" || company.entity_type === "LLC-S" || company.entity_type === "Single Member LLC";
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

3. Write brief "Section Introductions" (1 sentence each) for these sections: Articles of ${isLLC ? "Organization" : "Incorporation"}, ${isLLC ? "Authorized Binders & Members" : "Officers & Directors"}, ${isLLC ? "Members Registry" : "Shareholders Registry"}, ${isLLC ? "Membership Interest Certificates" : "Stock Certificates"}, ${isLLC ? "Interest Ledger" : "Stock Ledger"}, Meeting Minutes, Equity Transactions, Business Sales, Compliance Checklist, AI Compliance, Corporate Timeline, Document Registry.

Return ONLY a JSON object with keys: executiveSummary, complianceNarrative, sectionIntros (object with keys matching section names above).`;

    if (skipAI) {
      return new Response(
        JSON.stringify({ companyData, aiContent: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const result = await callAI({ provider, prompt });

      let aiContent: any = null;
      try {
        aiContent = parseJsonFromAI(result.content);
      } catch {
        aiContent = {
          executiveSummary: result.content,
          complianceNarrative: "",
          sectionIntros: {},
        };
      }

      return new Response(
        JSON.stringify({ companyData, aiContent }),
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
        JSON.stringify({ companyData, aiContent: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("generate-record-book error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
