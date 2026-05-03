import { Sparkles, Send } from "lucide-react";

export function CopilotCard() {
  const suggestions = ["Which entities are at risk?", "Summarize Q1 filings"];
  return (
    <div
      className="rounded-[10px] border p-4 flex flex-col h-full"
      style={{
        background: "linear-gradient(135deg, var(--v2-brand-tint) 0%, var(--v2-violet-tint) 100%)",
        borderColor: "var(--v2-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{ background: "var(--v2-bg-card)" }}
        >
          <Sparkles size={14} style={{ color: "var(--v2-violet)" }} />
        </div>
        <span className="v2-serif text-[15px] font-semibold">EntityIQ Copilot</span>
      </div>
      <p className="text-[12.5px] leading-snug mt-2" style={{ color: "var(--v2-text-secondary)" }}>
        Ask about any client, filing, or compliance status.
        Drafts answers grounded in your portfolio data.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            className="text-[11.5px] px-2.5 py-1 rounded-full border bg-[color:var(--v2-bg-card)] hover:bg-[color:var(--v2-row-hover)] transition-colors duration-150"
            style={{ borderColor: "var(--v2-border)", color: "var(--v2-text-secondary)" }}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div
        className="mt-3 flex items-center gap-1.5 h-9 px-2.5 rounded-md border"
        style={{ background: "var(--v2-bg-card)", borderColor: "var(--v2-border)" }}
      >
        <input
          placeholder="Ask about any client or filing…"
          className="flex-1 bg-transparent outline-none text-[12.5px] placeholder:text-[color:var(--v2-text-meta)]"
        />
        <button
          aria-label="Send"
          className="h-7 w-7 rounded text-white flex items-center justify-center"
          style={{ background: "var(--v2-brand)" }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}
