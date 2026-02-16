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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const companyId = formData.get("company_id") as string | null;
    const mode = formData.get("mode") as string || "extract"; // "extract" or "populate"

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload file to storage
    const admin = createClient(supabaseUrl, serviceKey);
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("tax-returns")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert file to base64 for AI vision
    const uint8Array = new Uint8Array(fileBuffer);
    let base64 = "";
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      base64 += String.fromCharCode(...chunk);
    }
    base64 = btoa(base64);

    const mimeType = file.type || "application/pdf";

    const extractionPrompt = `You are a corporate tax return analyst. Analyze this tax return document and extract ALL of the following data. Return ONLY valid JSON.

Extract these fields:
{
  "form_type": "1120 | 1120-S | 1065 | 990 | unknown",
  "tax_year": number,
  "company": {
    "name": "string",
    "ein": "string (XX-XXXXXXX format)",
    "address": "string",
    "city": "string",
    "state": "string (2-letter)",
    "zip": "string",
    "incorporation_date": "YYYY-MM-DD or null",
    "fiscal_year_end": "string (e.g. December 31)",
    "business_purpose": "string or null",
    "entity_type": "Corporation | S-Corp | LLC | Partnership | Non-Profit",
    "accounting_method": "cash basis | accrual basis | other",
    "sic_code": "string or null"
  },
  "financials": {
    "total_sales": number or null,
    "cost_of_goods_sold": number or null,
    "gross_profit": number or null,
    "net_income": number or null,
    "total_assets": number or null,
    "total_liabilities": number or null,
    "cog_ratio": number or null
  },
  "officers": [
    { "name": "string", "title": "string", "compensation": number or null, "ownership_pct": number or null }
  ],
  "shareholders": [
    { "name": "string", "ssn_ein": "string or null", "ownership_pct": number or null, "address": "string or null", "city": "string or null", "state": "string or null", "zip": "string or null" }
  ],
  "vehicles": [
    { "description": "string", "year": "string or null", "make": "string or null", "model": "string or null", "cost": number or null, "date_placed_in_service": "string or null" }
  ],
  "equipment": [
    { "description": "string", "year": "string or null", "manufacturer": "string or null", "model": "string or null", "cost": number or null, "date_placed_in_service": "string or null" }
  ],
  "retirement_contributions": {
    "plan_type": "string or null (401k, SEP, SIMPLE, etc.)",
    "total_contribution": number or null,
    "employer_contribution": number or null
  },
  "depreciation_items": [
    { "description": "string", "cost": number or null, "method": "string or null", "current_deduction": number or null }
  ]
}

Rules:
- Extract numbers as raw numbers without commas or dollar signs
- If a field isn't found, use null
- For officers/shareholders, extract all listed on the return
- For vehicles, look at Form 4562 Part V and any vehicle schedules
- For equipment, look at Form 4562 Section 179 and MACRS depreciation
- For retirement, look at deductions section line items
- Return ONLY the JSON, no other text`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: extractionPrompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    let extracted: any = null;
    try {
      const jsonStr = rawContent
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      extracted = JSON.parse(jsonStr);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", rawContent);
      return new Response(JSON.stringify({ error: "Failed to parse AI response", raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If mode is "populate" and company_id provided, auto-save data
    if (mode === "populate" && companyId) {
      // Verify company ownership
      const { data: comp, error: compErr } = await admin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (compErr || !comp) {
        return new Response(JSON.stringify({ error: "Company not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const c = extracted.company || {};
      const f = extracted.financials || {};

      // Update company record
      await admin.from("companies").update({
        address: c.address || undefined,
        city: c.city || undefined,
        state: c.state || undefined,
        zip: c.zip || undefined,
        fiscal_year_end: c.fiscal_year_end || undefined,
        business_purpose: c.business_purpose || undefined,
        accounting_method: c.accounting_method || undefined,
        sic_code: c.sic_code || undefined,
      }).eq("id", companyId);

      // Create meeting with financials if we have tax year data
      if (extracted.tax_year && f.total_sales !== null) {
        const { data: newMeeting } = await admin.from("meetings").insert({
          company_id: companyId,
          meeting_date: `${extracted.tax_year}-12-31`,
          meeting_type: "Annual Meeting",
          tax_year: extracted.tax_year,
          company_name_at_meeting: c.name || null,
          company_address_at_meeting: c.address || null,
          company_city_at_meeting: c.city || null,
          company_state_at_meeting: c.state || null,
          company_zip_at_meeting: c.zip || null,
        }).select("id").single();

        if (newMeeting) {
          await admin.from("meeting_financials").insert({
            meeting_id: newMeeting.id,
            current_total_sales: f.total_sales,
            current_cog: f.cost_of_goods_sold,
            current_gross_profit: f.gross_profit,
            current_net_income: f.net_income,
            current_cog_ratio: f.cog_ratio,
          });

          // Add officers to meeting
          if (extracted.officers?.length > 0) {
            await admin.from("meeting_officers").insert(
              extracted.officers.map((o: any) => ({
                meeting_id: newMeeting.id,
                name: o.name,
                title: o.title || "Officer",
              }))
            );
          }

          // Add shareholders to meeting
          if (extracted.shareholders?.length > 0) {
            await admin.from("meeting_shareholders").insert(
              extracted.shareholders.map((s: any) => ({
                meeting_id: newMeeting.id,
                shareholder_name: s.name,
              }))
            );
          }
        }
      }

      // Add vehicles as company assets
      if (extracted.vehicles?.length > 0) {
        await admin.from("company_assets").insert(
          extracted.vehicles.map((v: any) => ({
            company_id: companyId,
            asset_type: "Vehicle",
            description: v.description || `${v.year || ""} ${v.make || ""} ${v.model || ""}`.trim() || "Vehicle",
            year: v.year || null,
            make: v.make || null,
            model: v.model || null,
            cost: v.cost || null,
          }))
        );
      }

      // Add equipment as company assets
      if (extracted.equipment?.length > 0) {
        await admin.from("company_assets").insert(
          extracted.equipment.map((eq: any) => ({
            company_id: companyId,
            asset_type: "Equipment",
            description: eq.description || `${eq.manufacturer || ""} ${eq.model || ""}`.trim() || "Equipment",
            year: eq.year || null,
            manufacturer: eq.manufacturer || null,
            model: eq.model || null,
            cost: eq.cost || null,
          }))
        );
      }

      // Add shareholders to company
      if (extracted.shareholders?.length > 0) {
        for (const s of extracted.shareholders) {
          await admin.from("shareholders").insert({
            company_id: companyId,
            name: s.name,
            ssn_ein: s.ssn_ein || null,
            address: s.address || null,
            city: s.city || null,
            state: s.state || null,
            zip: s.zip || null,
          });
        }
      }

      // Register the document
      const { data: signedUrl } = await admin.storage
        .from("tax-returns")
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      await admin.from("document_registry").insert({
        company_id: companyId,
        title: `Tax Return ${extracted.form_type || ""} — ${extracted.tax_year || "Unknown Year"}`,
        document_category: "tax",
        document_type: `Form ${extracted.form_type || "Unknown"}`,
        status: "final",
        file_name: file.name,
        file_url: signedUrl?.signedUrl || null,
      });
    }

    return new Response(
      JSON.stringify({ extracted, file_path: fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-tax-return error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
