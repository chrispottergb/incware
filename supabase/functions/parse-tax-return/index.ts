import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-dist@4.9.155/legacy/build/pdf.mjs";
import { callAI, callClaudeWithDocument, parseJsonFromAI, AIProviderError } from "../_shared/ai-provider.ts";

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
    const mode = formData.get("mode") as string || "extract";
    const pdfPasswordRaw = formData.get("pdf_password") as string | null;
    const pdfPassword = pdfPasswordRaw?.trim() || null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Upload file to storage
    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const fileBuffer = await file.arrayBuffer();
    console.log(`Processing ${file.name} (${(fileBuffer.byteLength / 1024).toFixed(0)} KB, mode=${mode})`);

    const { error: uploadError } = await admin.storage
      .from("tax-returns")
      .upload(fileName, fileBuffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job record
    const { data: job, error: jobErr } = await admin
      .from("tax_return_jobs")
      .insert({
        user_id: user.id,
        company_id: companyId,
        status: "processing",
        mode,
        file_path: fileName,
        file_name: file.name,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      console.error("Job creation error:", jobErr);
      return new Response(JSON.stringify({ error: "Failed to create job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return job_id immediately, process in background
    // Use EdgeRuntime.waitUntil so the response is sent immediately
    // while the AI processing continues in the background
    const backgroundPromise = processInBackground(admin, job.id, user.id, fileBuffer, file.type, file.name, fileName, companyId, mode, pdfPassword);

    // Try EdgeRuntime.waitUntil for Deno Deploy / Supabase Edge
    try {
      // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(backgroundPromise);
      } else {
        // Fallback: just let it run (may get cancelled when response is sent)
        backgroundPromise.catch((err) => console.error("Background processing error:", err));
      }
    } catch {
      backgroundPromise.catch((err) => console.error("Background processing error:", err));
    }

    return new Response(
      JSON.stringify({ job_id: job.id, status: "processing" }),
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

async function processInBackground(
  admin: any,
  jobId: string,
  userId: string,
  fileBuffer: ArrayBuffer,
  fileType: string,
  originalFileName: string,
  storagePath: string,
  companyId: string | null,
  mode: string,
  pdfPassword: string | null,
) {
  try {
    // Convert to base64
    const uint8Array = new Uint8Array(fileBuffer);
    let binaryStr = "";
    const chunkSize = 1024;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, uint8Array.length);
      for (let j = i; j < end; j++) {
        binaryStr += String.fromCharCode(uint8Array[j]);
      }
    }
    const base64 = btoa(binaryStr);
    const mimeType = fileType || "application/pdf";

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
    "naics_code": "string or null"
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

    // Prefer native text extraction first (supports password-protected PDFs)
    let result;
    if (mimeType === "application/pdf") {
      let extractedText = "";
      try {
        extractedText = await extractPdfText(fileBuffer, pdfPassword || undefined);
        console.log(`pdf.js extracted ${extractedText.length} chars`);
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        if (/no password given|incorrect password|password/i.test(msg)) {
          throw new Error("This PDF is password-protected. Enter the PDF password and retry, or upload an unlocked PDF.");
        }
        console.warn("pdf.js extraction failed:", pdfErr);
      }

      const letters = (extractedText.match(/[a-zA-Z]/g) || []).length;
      const hasGoodText = extractedText.length > 120 && letters > 40;

      if (hasGoodText) {
        console.log("Using text extraction path");
        result = await callAI({
          provider: "lovable",
          systemPrompt: extractionPrompt,
          prompt: `Extract structured JSON from this tax return text. Return only valid JSON.\n\n${extractedText.slice(0, 300000)}`,
        });
      } else {
        console.log("Insufficient extracted text, trying multimodal document APIs");
        try {
          result = await callClaudeWithDocument({
            base64Data: base64,
            mimeType,
            prompt: "Extract all entity data from this tax return and return the JSON object.",
            systemPrompt: extractionPrompt,
          });
        } catch (docErr) {
          const msg = docErr instanceof Error ? docErr.message : String(docErr);
          if (/document has no pages/i.test(msg)) {
            throw new Error("Unable to read this PDF. If it's password-protected, enter the PDF password. If it's a scanned PDF, upload a clearer copy.");
          }
          throw new Error(`Unable to read this PDF. ${msg}`);
        }
      }
    } else {
      // Non-PDF files: use multimodal directly
      result = await callClaudeWithDocument({
        base64Data: base64,
        mimeType,
        prompt: "Extract all entity data from this tax return and return the JSON object.",
        systemPrompt: extractionPrompt,
      });
    }

    const extracted = parseJsonFromAI(result.content);

    // If mode is "populate" and company_id provided, auto-save data
    if (mode === "populate" && companyId) {
      const { data: comp } = await admin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("user_id", userId)
        .maybeSingle();

      if (comp) {
        await populateCompanyData(admin, companyId, userId, extracted, originalFileName, storagePath);
      }
    }

    // Update job as completed
    await admin.from("tax_return_jobs").update({
      status: "completed",
      extracted,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.log(`Job ${jobId} completed successfully`);
  } catch (err) {
    const errorMsg = err instanceof AIProviderError
      ? err.message
      : err instanceof Error ? err.message : "Unknown error";
    console.error(`Job ${jobId} failed:`, errorMsg);

    await admin.from("tax_return_jobs").update({
      status: "failed",
      error: errorMsg,
      updated_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}


async function populateCompanyData(
  admin: any,
  companyId: string,
  userId: string,
  extracted: any,
  originalFileName: string,
  storagePath: string,
) {
  const c = extracted.company || {};
  const f = extracted.financials || {};

  // Update company record with all extracted fields
  const companyUpdate: Record<string, any> = {};
  if (c.address) companyUpdate.address = c.address;
  if (c.city) companyUpdate.city = c.city;
  if (c.state) {
    companyUpdate.state = c.state;
    companyUpdate.state_of_incorporation = c.state;
  }
  if (c.zip) companyUpdate.zip = c.zip;
  if (c.fiscal_year_end) companyUpdate.fiscal_year_end = c.fiscal_year_end;
  if (c.business_purpose) companyUpdate.business_purpose = c.business_purpose;
  if (c.entity_type) companyUpdate.entity_type = c.entity_type;
  if (c.accounting_method) companyUpdate.accounting_method = c.accounting_method;
  if (c.naics_code) companyUpdate.naics_code = c.naics_code;
  if (c.incorporation_date) companyUpdate.incorporation_date = c.incorporation_date;
  if (c.ein) companyUpdate.phone = companyUpdate.phone; // preserve existing phone

  if (Object.keys(companyUpdate).length > 0) {
    await admin.from("companies").update(companyUpdate).eq("id", companyId);
  }

  // Create meeting with financials
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

      if (extracted.officers?.length > 0) {
        await admin.from("meeting_officers").insert(
          extracted.officers.map((o: any) => ({
            meeting_id: newMeeting.id,
            name: o.name,
            title: o.title || "Officer",
          }))
        );
      }

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

  // Add shareholders
  if (extracted.shareholders?.length > 0) {
    const encryptionKey = Deno.env.get("SSN_ENCRYPTION_KEY");
    for (const s of extracted.shareholders) {
      const { data: newShareholder } = await admin.from("shareholders").insert({
        company_id: companyId,
        name: s.name,
        address: s.address || null,
        city: s.city || null,
        state: s.state || null,
        zip: s.zip || null,
      }).select("id").single();

      if (newShareholder && s.ssn_ein && encryptionKey) {
        await admin.rpc("encrypt_shareholder_ssn", {
          p_shareholder_id: newShareholder.id,
          p_ssn_ein: s.ssn_ein,
          p_encryption_key: encryptionKey,
        });
      }
    }
  }

  // Register document
  const { data: signedUrl } = await admin.storage
    .from("tax-returns")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  await admin.from("document_registry").insert({
    company_id: companyId,
    title: `Tax Return ${extracted.form_type || ""} — ${extracted.tax_year || "Unknown Year"}`,
    document_category: "tax",
    document_type: `Form ${extracted.form_type || "Unknown"}`,
    status: "final",
    file_name: originalFileName,
    file_url: signedUrl?.signedUrl || null,
  });
}
