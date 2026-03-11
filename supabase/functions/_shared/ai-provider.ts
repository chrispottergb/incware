// Shared AI provider routing for edge functions
// Supports: lovable (default), gemini, claude

export type AIProvider = "lovable" | "gemini" | "claude";

interface AICallOptions {
  provider: AIProvider;
  prompt: string;
  systemPrompt?: string;
}

interface AIResult {
  content: string;
}

async function callLovable(prompt: string, systemPrompt?: string): Promise<AIResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new AIProviderError("AI rate limit exceeded. Please try again in a moment.", 429);
    if (status === 402) throw new AIProviderError("AI credits exhausted. Please add credits to continue.", 402);
    const text = await response.text();
    throw new Error(`Lovable AI error (${status}): ${text}`);
  }

  const result = await response.json();
  return { content: result.choices?.[0]?.message?.content || "" };
}

async function callGemini(prompt: string, systemPrompt?: string): Promise<AIResult> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new AIProviderError("Gemini API key is not configured. Please add your GEMINI_API_KEY.", 400);

  const contents: any[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I will follow these instructions." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    if (status === 429) throw new AIProviderError("Gemini rate limit exceeded. Please try again.", 429);
    throw new Error(`Gemini API error (${status}): ${text}`);
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content };
}

async function callClaude(prompt: string, systemPrompt?: string): Promise<AIResult> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) throw new AIProviderError("Claude API key is not configured. Please add your ANTHROPIC_API_KEY.", 400);

  const body: any = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    if (status === 429) throw new AIProviderError("Claude rate limit exceeded. Please try again.", 429);
    throw new Error(`Claude API error (${status}): ${text}`);
  }

  const result = await response.json();
  const content = result.content?.[0]?.text || "";
  return { content };
}

export class AIProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function callAI({ provider, prompt, systemPrompt }: AICallOptions): Promise<AIResult> {
  switch (provider) {
    case "gemini":
      return callGemini(prompt, systemPrompt);
    case "claude":
      return callClaude(prompt, systemPrompt);
    case "lovable":
    default:
      return callLovable(prompt, systemPrompt);
  }
}

/**
 * Call Claude with a PDF document (base64) for multimodal extraction.
 * Falls back to Lovable AI (image_url mode) if ANTHROPIC_API_KEY is not set.
 */
export async function callClaudeWithDocument({
  base64Data,
  mimeType,
  prompt,
  systemPrompt,
}: {
  base64Data: string;
  mimeType: string;
  prompt: string;
  systemPrompt?: string;
}): Promise<AIResult> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

  if (ANTHROPIC_API_KEY) {
    try {
      // Use Claude's native document support
      const body: any = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64Data,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      };
      if (systemPrompt) body.system = systemPrompt;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const status = response.status;
        const text = await response.text();
        if (status === 429) throw new AIProviderError("Claude rate limit exceeded. Please try again.", 429);
        console.warn(`Claude API error (${status}), falling back to Lovable AI: ${text}`);
        // Fall through to Lovable AI fallback below
      } else {
        const result = await response.json();
        const content = result.content?.map((b: any) => b.text || "").join("") || "";
        return { content };
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      console.warn("Claude call failed, falling back to Lovable AI:", err);
    }
  }

  // Fallback: Lovable AI with file content via multimodal input
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("Neither ANTHROPIC_API_KEY nor LOVABLE_API_KEY is configured");

  console.log("Using Lovable AI fallback for document processing");

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  // For PDFs, convert to individual page images is not feasible in edge functions,
  // so we send the document as a file part. Use image_url with data URI.
  // Some models choke on large PDFs via image_url; if the file is a PDF and large,
  // we'll use a text-extraction fallback approach.
  const isPdf = mimeType === "application/pdf";

  // For PDFs, try sending as image_url data URI with a model known to handle PDFs well
  messages.push({
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Data}` },
      },
      { type: "text", text: prompt },
    ],
  });

  // Add a 120-second timeout to prevent hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  // Use gemini-2.5-flash for document processing - it handles PDFs more reliably via the gateway
  const modelToUse = isPdf ? "google/gemini-2.5-flash" : "google/gemini-2.5-pro";

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: modelToUse, messages }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error(`Lovable AI error (${status}) with model ${modelToUse}:`, text);
      
      // If the primary model fails with "no pages" error, retry with the other model
      if (text.includes("no pages") && isPdf) {
        console.log("Retrying with google/gemini-2.5-pro...");
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 120_000);
        try {
          const retryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: "google/gemini-2.5-pro", messages }),
            signal: retryController.signal,
          });
          clearTimeout(retryTimeout);
          if (retryResponse.ok) {
            const retryResult = await retryResponse.json();
            console.log("Lovable AI retry succeeded");
            return { content: retryResult.choices?.[0]?.message?.content || "" };
          }
          const retryText = await retryResponse.text();
          console.error(`Retry also failed (${retryResponse.status}):`, retryText);
        } catch (retryErr) {
          clearTimeout(retryTimeout);
          console.error("Retry failed:", retryErr);
        }
      }
      
      if (status === 429) throw new AIProviderError("AI rate limit exceeded. Please try again in a moment.", 429);
      if (status === 402) throw new AIProviderError("AI credits exhausted. Please add credits to continue.", 402);
      throw new Error(`Lovable AI error (${status}): ${text}`);
    }

    const result = await response.json();
    console.log("Lovable AI response received successfully");
    return { content: result.choices?.[0]?.message?.content || "" };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof AIProviderError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new Error("AI processing timed out after 120 seconds. Please try with a smaller file.");
    }
    throw err;
  }
}

export function parseJsonFromAI(raw: string): any {
  const jsonStr = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(jsonStr);
}
