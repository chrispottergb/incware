import { useState } from "react";
import { ArrowLeft, ArrowRight, X, Zap } from "lucide-react";
import {
  situations,
  guidanceCards,
  moods,
  genres,
  type Situation,
} from "@/data/damage-control";

type Step = "situation" | "cards" | "creator";

export default function DamageControl() {
  const [step, setStep] = useState<Step>("situation");
  const [selected, setSelected] = useState<Situation | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [chosenMoods, setChosenMoods] = useState<string[]>([]);
  const [chosenGenres, setChosenGenres] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [customSituation, setCustomSituation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const cards = selected ? (guidanceCards[selected.id] ?? []) : [];
  const currentCard = cards[cardIndex];
  const isLastCard = cardIndex === cards.length - 1;

  function pickSituation(s: Situation) {
    setSelected(s);
    setCardIndex(0);
    setStep("cards");
  }

  function toggleMood(m: string) {
    setChosenMoods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

  function toggleGenre(g: string) {
    setChosenGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 2200));
    setGenerating(false);
    setGenerated(true);
  }

  function reset() {
    setStep("situation");
    setSelected(null);
    setCardIndex(0);
    setChosenMoods([]);
    setChosenGenres([]);
    setDescription("");
    setCustomSituation("");
    setGenerated(false);
  }

  return (
    <div className="dc-root">
      {step !== "situation" && (
        <button
          className="dc-back"
          onClick={() => {
            if (step === "creator") { setStep("cards"); return; }
            if (step === "cards") { if (cardIndex > 0) { setCardIndex((i) => i - 1); } else { setStep("situation"); } }
          }}
        >
          <ArrowLeft size={16} />
          <span>{step === "creator" ? "Back to guide" : cardIndex > 0 ? "Previous" : "Back"}</span>
        </button>
      )}

      {step === "situation" && (
        <div className="dc-section dc-fade">
          <div className="dc-header">
            <div className="dc-pill">DAMAGE CONTROL</div>
            <h1 className="dc-h1">What's happening<br />right now?</h1>
            <p className="dc-sub">Select your situation and we'll guide you through it.</p>
          </div>

          <div className="dc-grid">
            {situations.map((s) => (
              <button key={s.id} className={`dc-situ-card dc-grad-${s.id}`} onClick={() => pickSituation(s)}>
                <span className="dc-situ-emoji">{s.emoji}</span>
                <span className="dc-situ-label">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="dc-custom-row">
            <input
              className="dc-input"
              placeholder="Or describe your situation…"
              value={customSituation}
              onChange={(e) => setCustomSituation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customSituation.trim()) {
                  setSelected({ id: "off", label: customSituation, emoji: "💬", color: "" });
                  setCardIndex(0);
                  setStep("cards");
                }
              }}
            />
            {customSituation.trim() && (
              <button
                className="dc-btn-primary"
                onClick={() => {
                  setSelected({ id: "off", label: customSituation, emoji: "💬", color: "" });
                  setCardIndex(0);
                  setStep("cards");
                }}
              >
                Start <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {step === "cards" && currentCard && (
        <div className="dc-section dc-fade">
          <div className="dc-card-context">
            <span className="dc-pill">{selected?.emoji} {selected?.label}</span>
            <span className="dc-step-counter">{cardIndex + 1} / {cards.length}</span>
          </div>

          <div className="dc-guidance-card">
            <div className="dc-card-tag">{currentCard.tag}</div>
            <h2 className="dc-card-title">{currentCard.title}</h2>
            <p className="dc-card-body">{currentCard.body}</p>
            {currentCard.action && (
              <div className="dc-card-action">
                {isLastCard
                  ? <span>{currentCard.action}</span>
                  : <span>↳ {currentCard.action}</span>
                }
              </div>
            )}
          </div>

          <div className="dc-dots">
            {cards.map((_, i) => (
              <button
                key={i}
                className={`dc-dot ${i === cardIndex ? "dc-dot-active" : ""}`}
                onClick={() => setCardIndex(i)}
              />
            ))}
          </div>

          <div className="dc-card-nav">
            {!isLastCard ? (
              <button className="dc-btn-primary" onClick={() => setCardIndex((i) => i + 1)}>
                Next <ArrowRight size={14} />
              </button>
            ) : (
              <button className="dc-btn-accent" onClick={() => setStep("creator")}>
                <Zap size={14} /> Find my sound
              </button>
            )}
          </div>
        </div>
      )}

      {step === "creator" && (
        <div className="dc-section dc-fade">
          {!generated ? (
            <>
              <div className="dc-header">
                <div className="dc-pill">{selected?.emoji} {selected?.label}</div>
                <h1 className="dc-h1">Now let's give you<br />something to anchor to.</h1>
                <p className="dc-sub">Build the sound that meets you where you are.</p>
              </div>

              <div className="dc-creator-section">
                <label className="dc-label">How do you want to feel?</label>
                <div className="dc-tags">
                  {moods.map((m) => (
                    <button
                      key={m}
                      className={`dc-tag ${chosenMoods.includes(m) ? "dc-tag-active" : ""}`}
                      onClick={() => toggleMood(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dc-creator-section">
                <label className="dc-label">Genre</label>
                <div className="dc-tags">
                  {genres.map((g) => (
                    <button
                      key={g}
                      className={`dc-tag ${chosenGenres.includes(g) ? "dc-tag-active" : ""}`}
                      onClick={() => toggleGenre(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="dc-creator-section">
                <label className="dc-label">Describe what you need <span className="dc-label-opt">(optional)</span></label>
                <textarea
                  className="dc-textarea"
                  rows={3}
                  placeholder="e.g. something that feels like rain and slowly clears… or something that gives me my power back…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <button
                className="dc-btn-generate"
                disabled={generating || (chosenMoods.length === 0 && chosenGenres.length === 0 && !description)}
                onClick={handleGenerate}
              >
                {generating ? (
                  <span className="dc-spinner" />
                ) : (
                  <><Zap size={15} /> Generate my track</>
                )}
              </button>
            </>
          ) : (
            <div className="dc-result dc-fade">
              <div className="dc-result-art">
                <div className="dc-art-ring" />
                <div className="dc-art-ring dc-art-ring-2" />
                <div className="dc-art-core">
                  <Zap size={28} color="#a78bfa" />
                </div>
              </div>
              <h2 className="dc-result-title">Your track is ready.</h2>
              <p className="dc-result-sub">
                {chosenMoods.slice(0, 2).join(" · ")}{chosenGenres[0] ? ` · ${chosenGenres[0]}` : ""}
              </p>
              <div className="dc-waveform">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="dc-bar" style={{ animationDelay: `${(i * 0.05) % 1}s`, height: `${20 + Math.abs(Math.sin(i * 0.7)) * 40}px` }} />
                ))}
              </div>
              <div className="dc-result-actions">
                <button className="dc-btn-play">▶ Play</button>
                <button className="dc-btn-ghost" onClick={reset}>
                  <X size={14} /> Start over
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{DC_STYLES}</style>
    </div>
  );
}

const DC_STYLES = `
  .dc-root {
    min-height: 100vh;
    background: #09090b;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    padding: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-x: hidden;
  }

  .dc-back {
    position: absolute;
    top: 24px;
    left: 24px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #71717a;
    font-size: 13px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    transition: color 0.15s, background 0.15s;
    z-index: 10;
  }
  .dc-back:hover { color: #f4f4f5; background: rgba(255,255,255,0.05); }

  .dc-section {
    width: 100%;
    max-width: 720px;
    padding: 80px 24px 48px;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .dc-fade {
    animation: dcFadeUp 0.4s ease both;
  }
  @keyframes dcFadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .dc-header { display: flex; flex-direction: column; gap: 12px; }

  .dc-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(167,139,250,0.12);
    border: 1px solid rgba(167,139,250,0.25);
    color: #a78bfa;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 100px;
    width: fit-content;
  }

  .dc-h1 {
    font-size: clamp(28px, 5vw, 42px);
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: #fafafa;
    margin: 0;
  }

  .dc-sub {
    font-size: 15px;
    color: #71717a;
    margin: 0;
    line-height: 1.6;
  }

  .dc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .dc-situ-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 20px 18px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s, background 0.2s, transform 0.15s;
    position: relative;
    overflow: hidden;
  }
  .dc-situ-card:hover {
    border-color: rgba(167,139,250,0.35);
    transform: translateY(-2px);
  }

  .dc-grad-breakup:hover { background: linear-gradient(135deg, rgba(136,19,55,0.3), rgba(30,10,25,0.9)); }
  .dc-grad-angry-boss:hover { background: linear-gradient(135deg, rgba(154,52,18,0.3), rgba(30,15,10,0.9)); }
  .dc-grad-family:hover { background: linear-gradient(135deg, rgba(120,53,15,0.3), rgba(25,15,5,0.9)); }
  .dc-grad-anxiety:hover { background: linear-gradient(135deg, rgba(76,29,149,0.3), rgba(15,10,30,0.9)); }
  .dc-grad-panic:hover { background: linear-gradient(135deg, rgba(30,58,138,0.3), rgba(10,15,30,0.9)); }
  .dc-grad-grief:hover { background: linear-gradient(135deg, rgba(39,39,42,0.5), rgba(10,10,12,0.95)); }
  .dc-grad-social:hover { background: linear-gradient(135deg, rgba(19,78,74,0.3), rgba(10,25,25,0.9)); }
  .dc-grad-off:hover { background: linear-gradient(135deg, rgba(39,39,42,0.4), rgba(10,10,12,0.9)); }

  .dc-situ-emoji { font-size: 26px; }
  .dc-situ-label { font-size: 13px; font-weight: 500; color: #d4d4d8; line-height: 1.3; }

  .dc-custom-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .dc-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 14px;
    color: #f4f4f5;
    outline: none;
    transition: border-color 0.2s;
    font-family: inherit;
  }
  .dc-input::placeholder { color: #52525b; }
  .dc-input:focus { border-color: rgba(167,139,250,0.5); }

  .dc-card-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .dc-step-counter {
    font-size: 12px;
    color: #52525b;
    font-variant-numeric: tabular-nums;
  }

  .dc-guidance-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 36px 32px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    backdrop-filter: blur(12px);
    min-height: 280px;
  }

  .dc-card-tag {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #a78bfa;
  }

  .dc-card-title {
    font-size: clamp(20px, 3vw, 26px);
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.015em;
    color: #fafafa;
    margin: 0;
  }

  .dc-card-body {
    font-size: 15px;
    line-height: 1.75;
    color: #a1a1aa;
    margin: 0;
    flex: 1;
  }

  .dc-card-action {
    font-size: 13px;
    font-weight: 500;
    color: #a78bfa;
    padding-top: 4px;
    border-top: 1px solid rgba(167,139,250,0.15);
  }

  .dc-dots {
    display: flex;
    gap: 6px;
    justify-content: center;
  }
  .dc-dot {
    width: 6px; height: 6px;
    border-radius: 100%;
    background: rgba(255,255,255,0.15);
    border: none;
    cursor: pointer;
    transition: background 0.2s, width 0.2s;
    padding: 0;
  }
  .dc-dot-active { background: #a78bfa; width: 18px; border-radius: 4px; }

  .dc-card-nav { display: flex; justify-content: flex-end; }

  .dc-btn-primary {
    display: inline-flex; align-items: center; gap: 6px;
    background: rgba(167,139,250,0.15);
    border: 1px solid rgba(167,139,250,0.3);
    color: #c4b5fd;
    font-size: 14px; font-weight: 500;
    padding: 10px 20px; border-radius: 10px;
    cursor: pointer; font-family: inherit;
    transition: background 0.2s, border-color 0.2s;
  }
  .dc-btn-primary:hover { background: rgba(167,139,250,0.25); border-color: rgba(167,139,250,0.5); }

  .dc-btn-accent {
    display: inline-flex; align-items: center; gap: 6px;
    background: #7c3aed;
    border: none;
    color: #fff;
    font-size: 14px; font-weight: 600;
    padding: 12px 24px; border-radius: 10px;
    cursor: pointer; font-family: inherit;
    transition: background 0.2s, transform 0.15s;
  }
  .dc-btn-accent:hover { background: #6d28d9; transform: translateY(-1px); }

  .dc-btn-ghost {
    display: inline-flex; align-items: center; gap: 6px;
    background: none; border: 1px solid rgba(255,255,255,0.1);
    color: #71717a; font-size: 13px;
    padding: 10px 18px; border-radius: 10px;
    cursor: pointer; font-family: inherit;
    transition: color 0.2s, border-color 0.2s;
  }
  .dc-btn-ghost:hover { color: #f4f4f5; border-color: rgba(255,255,255,0.2); }

  .dc-creator-section { display: flex; flex-direction: column; gap: 12px; }

  .dc-label {
    font-size: 12px; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: #71717a;
  }
  .dc-label-opt { font-weight: 400; text-transform: none; letter-spacing: 0; color: #52525b; }

  .dc-tags { display: flex; flex-wrap: wrap; gap: 8px; }

  .dc-tag {
    padding: 7px 14px;
    border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.03);
    color: #a1a1aa;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .dc-tag:hover { border-color: rgba(167,139,250,0.4); color: #c4b5fd; }
  .dc-tag-active {
    background: rgba(167,139,250,0.15);
    border-color: rgba(167,139,250,0.5);
    color: #c4b5fd;
  }

  .dc-textarea {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px; line-height: 1.6;
    color: #f4f4f5;
    resize: vertical;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s;
    min-height: 90px;
  }
  .dc-textarea::placeholder { color: #3f3f46; }
  .dc-textarea:focus { border-color: rgba(167,139,250,0.5); }

  .dc-btn-generate {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 16px;
    background: linear-gradient(135deg, #7c3aed, #4f46e5);
    border: none; border-radius: 14px;
    color: #fff; font-size: 15px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: opacity 0.2s, transform 0.15s;
    margin-top: 8px;
  }
  .dc-btn-generate:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .dc-btn-generate:disabled { opacity: 0.35; cursor: not-allowed; }

  .dc-spinner {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .dc-result {
    display: flex; flex-direction: column;
    align-items: center; gap: 20px;
    padding: 32px 0;
    text-align: center;
  }

  .dc-result-art {
    position: relative;
    width: 120px; height: 120px;
    display: flex; align-items: center; justify-content: center;
  }

  .dc-art-ring {
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 1px solid rgba(167,139,250,0.3);
    animation: pulse-ring 2s ease-in-out infinite;
  }
  .dc-art-ring-2 {
    inset: 16px;
    border-color: rgba(167,139,250,0.2);
    animation-delay: 0.4s;
  }
  @keyframes pulse-ring {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.06); opacity: 1; }
  }

  .dc-art-core {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: rgba(124,58,237,0.2);
    border: 1px solid rgba(167,139,250,0.4);
    display: flex; align-items: center; justify-content: center;
  }

  .dc-result-title { font-size: 24px; font-weight: 700; color: #fafafa; margin: 0; }
  .dc-result-sub { font-size: 13px; color: #71717a; margin: 0; }

  .dc-waveform {
    display: flex; align-items: center; gap: 3px;
    height: 60px;
  }
  .dc-bar {
    width: 3px; border-radius: 2px;
    background: linear-gradient(to top, #7c3aed, #a78bfa);
    animation: wave 1.4s ease-in-out infinite alternate;
  }
  @keyframes wave {
    0%  { transform: scaleY(0.4); }
    100% { transform: scaleY(1); }
  }

  .dc-result-actions {
    display: flex; gap: 12px; align-items: center;
    margin-top: 8px;
  }

  .dc-btn-play {
    padding: 12px 32px;
    background: #7c3aed; border: none; border-radius: 100px;
    color: #fff; font-size: 15px; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: background 0.2s, transform 0.15s;
    letter-spacing: 0.02em;
  }
  .dc-btn-play:hover { background: #6d28d9; transform: translateY(-1px); }
`;
