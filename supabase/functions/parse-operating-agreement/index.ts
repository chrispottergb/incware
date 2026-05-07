// Parse Operating Agreement - extract structured data via Lovable AI
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SCHEMA = {
  type: "object",
  properties: {
    company: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        entity_type: { type: ["string", "null"], description: "One of: LLC, Single Member LLC, LLC-S" },
        state_of_incorporation: { type: ["string", "null"] },
        formation_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
        address: { type: ["string", "null"] },
        address_2: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        state: { type: ["string", "null"] },
        zip: { type: ["string", "null"] },
        ein: { type: ["string", "null"] },
        business_purpose: { type: ["string", "null"] },
        fiscal_year_end: { type: ["string", "null"] },
        management_type: { type: ["string", "null"], description: "member-managed or manager-managed" },
        registered_agent_name: { type: ["string", "null"] },
        registered_agent_address: { type: ["string", "null"] },
        registered_agent_city: { type: ["string", "null"] },
        registered_agent_state: { type: ["string", "null"] },
        registered_agent_zip: { type: ["string", "null"] },
      },
      required: ["name"],
      additionalProperties: false,
    },
    members: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: { type: ["string", "null"] },
          address_2: { type: ["string", "null"] },
          city: { type: ["string", "null"] },
          state: { type: ["string", "null"] },
          zip: { type: ["string", "null"] },
          units_held: { type: ["number", "null"] },
          ownership_pct: { type: ["number", "null"] },
          capital_contribution: { type: ["number", "null"] },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    managers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          title: { type: ["string", "null"] },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  required: ["company", "members", "managers"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an expert paralegal extracting structured data from a Wisconsin LLC Operating Agreement.

Return JSON matching the provided schema. Rules:
- entity_type must be exactly one of: "LLC", "Single Member LLC", "LLC-S". Use "Single Member LLC" if only one member is listed.
- management_type must be exactly "member-managed" or "manager-managed".
- Dates in YYYY-MM-DD format. If only year is given, omit the date (return null).
- Use null for any unknown field. Never invent data.
- Capital contributions should be parsed as numbers (no $ or commas).
- ownership_pct as a number (e.g. 60 for 60%, not 0.6).
- Include every member listed (Schedule A, exhibit, or body text).`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File exceeds 20 MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    let userContent: any;

    if (ext === "pdf") {
      // Send PDF as inline data to Gemini multimodal
      const buf = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
      const b64 = btoa(binary);
      userContent = [
        { type: "text", text: "Extract the operating agreement data from this PDF." },
        { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
      ];
    } else if (ext === "docx") {
      // Extract text from DOCX using mammoth
      const mammoth = await import("https://esm.sh/mammoth@1.8.0");
      const arrayBuf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
      const text = (result.value || "").slice(0, 200_000);
      if (!text.trim()) {
        return new Response(JSON.stringify({ error: "Could not extract text from DOCX" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userContent = `Extract operating agreement data from this text:\n\n${text}`;
    } else if (ext === "doc") {
      return new Response(
        JSON.stringify({ error: "Legacy .doc not supported — please save as .docx or PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_operating_agreement",
              description: "Return structured data extracted from the OA",
              parameters: SCHEMA,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_operating_agreement" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded — try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("parse-operating-agreement error", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
