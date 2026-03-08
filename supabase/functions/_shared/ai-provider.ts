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
      throw new Error(`Claude API error (${status}): ${text}`);
    }

    const result = await response.json();
    const content = result.content?.map((b: any) => b.text || "").join("") || "";
    return { content };
  }

  // Fallback: Lovable AI with image_url (works for PDFs sent as data URIs)
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("Neither ANTHROPIC_API_KEY nor LOVABLE_API_KEY is configured");

  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
    ],
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
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

export function parseJsonFromAI(raw: string): any {
  const jsonStr = raw
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  return JSON.parse(jsonStr);
}
