import { useEffect, useState } from "react";
import logo from "@/assets/logo-entityiq-new.png";

const DURATION = 10500;
const EXIT_DURATION = 800;

interface SplashScreenProps {
  duration?: number;
  onComplete?: () => void;
}

interface CornerProps {
  pos: "tl" | "tr" | "bl" | "br";
  color: string;
  flipX?: boolean;
  flipY?: boolean;
}

function Corner({ pos, color, flipX, flipY }: CornerProps) {
  const styles: Record<string, React.CSSProperties> = {
    tl: { top: 28, left: 28 },
    tr: { top: 28, right: 28 },
    bl: { bottom: 28, left: 28 },
    br: { bottom: 28, right: 28 },
  };
  return (
    <div style={{
      position: "absolute",
      width: 52, height: 52,
      opacity: 0,
      animation: "eiq-fadeIn 0.8s ease 0.4s forwards",
      transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
      ...styles[pos],
    }}>
      <svg viewBox="0 0 52 52" fill="none" width="52" height="52">
        <path d="M2 50 L2 2 L50 2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function SplashScreen({ duration = DURATION, onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"visible" | "exiting" | "done">("visible");

  useEffect(() => {
    const exitTimer = setTimeout(() => setPhase("exiting"), duration);
    const doneTimer = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, duration + EXIT_DURATION);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [duration, onComplete]);

  if (phase === "done") return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Rajdhani:wght@300;400;500&display=swap');

        @keyframes eiq-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes eiq-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes eiq-ruleExpand {
          from { width: 0; }
          to   { width: 200px; }
        }
        @keyframes eiq-progressFill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes eiq-pulse {
          0%,100% { filter: drop-shadow(0 0 16px rgba(90,180,255,0.5)); }
          50%     { filter: drop-shadow(0 0 28px rgba(167,139,250,0.7)); }
        }
        @keyframes eiq-blink {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.4; transform: scale(0.6); }
        }
        @keyframes eiq-wordPop1 {
          0%   { opacity: 0.2; letter-spacing: 4px; }
          60%  { opacity: 0.7; letter-spacing: 7px; }
          100% { opacity: 1;   letter-spacing: 6px; }
        }
        @keyframes eiq-splashExit {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.03); }
        }

        .eiq-iq {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 96px;
          letter-spacing: 4px;
          line-height: 1;
          background: linear-gradient(135deg, #5ab4ff 0%, #a78bfa 50%, #38d9a9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: eiq-pulse 3s ease-in-out infinite;
        }

        .eiq-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: linear-gradient(135deg, #5ab4ff, #a78bfa);
          position: absolute;
          bottom: 12px; right: -20px;
          box-shadow: 0 0 10px rgba(90,180,255,0.8);
          animation: eiq-blink 2.4s ease-in-out infinite;
        }

        .eiq-word1 { animation: eiq-wordPop1 0.5s ease 1.5s both; }
        .eiq-word2 { animation: eiq-wordPop1 0.5s ease 1.9s both; }
        .eiq-word3 { animation: eiq-wordPop1 0.5s ease 2.3s both; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#0a0a0f",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          animation: phase === "exiting"
            ? `eiq-splashExit ${EXIT_DURATION}ms ease-in-out forwards`
            : "none",
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `
            radial-gradient(ellipse 55% 40% at 50% 42%, rgba(90,180,255,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 20% 80%, rgba(167,139,250,0.05) 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 80% 20%, rgba(56,217,169,0.04) 0%, transparent 60%)
          `,
        }} />

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }} />

        {/* Corner brackets */}
        <Corner pos="tl" color="rgba(90,180,255,0.3)" />
        <Corner pos="tr" color="rgba(90,180,255,0.3)" flipX />
        <Corner pos="bl" color="rgba(167,139,250,0.3)" flipY />
        <Corner pos="br" color="rgba(167,139,250,0.3)" flipX flipY />

        {/* Logo */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          opacity: 0, transform: "translateY(20px)",
          animation: "eiq-fadeUp 1s ease 0.5s forwards",
          position: "relative", zIndex: 2,
        }}>
          <img
            src={logo}
            alt="ENTITY IQ"
            style={{
              width: 380,
              height: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 40px rgba(180, 60, 50, 0.3))",
            }}
          />

          {/* Logo divider */}
          <div style={{
            width: "100%", height: 1, marginTop: 12,
            background: "linear-gradient(90deg, transparent, rgba(90,180,255,0.4), rgba(167,139,250,0.4), transparent)",
          }} />

          {/* Tagline */}
          <div style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 300,
            fontSize: 13,
            letterSpacing: 6,
            color: "rgba(180,190,220,0.9)",
            textTransform: "uppercase",
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span className="eiq-word1">Clarity</span>
            <span style={{ color: "rgba(90,180,255,0.4)", fontSize: 10 }}>·</span>
            <span className="eiq-word2">Structure</span>
            <span style={{ color: "rgba(90,180,255,0.4)", fontSize: 10 }}>·</span>
            <span className="eiq-word3">Control</span>
          </div>
        </div>

        {/* Statement */}
        <div style={{
          opacity: 0, transform: "translateY(14px)",
          animation: "eiq-fadeUp 0.9s ease 2.8s forwards",
          marginTop: 52,
          textAlign: "center",
          maxWidth: 500,
          padding: "0 28px",
          position: "relative", zIndex: 2,
        }}>
          <div style={{
            height: 1, margin: "0 auto 28px",
            background: "linear-gradient(90deg, transparent, rgba(90,180,255,0.3), rgba(167,139,250,0.3), transparent)",
            animation: "eiq-ruleExpand 0.7s ease 2.6s forwards",
            width: 0,
          }} />

          <p style={{
            fontFamily: "'Rajdhani', sans-serif",
            fontWeight: 300,
            fontSize: "1rem",
            lineHeight: 1.85,
            letterSpacing: "0.04em",
            color: "rgba(180,190,220,0.6)",
          }}>
            <strong style={{
              color: "rgba(90,180,255,0.85)",
              fontWeight: 500,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: "0.8rem",
              display: "block",
              marginBottom: 12,
            }}>
              Accurate Records. Protected Entities.
            </strong>
            Corporate and company records form the legal backbone of every organization.
            Keeping them current safeguards compliance, preserves ownership rights,
            and ensures your business can act with confidence at every critical moment.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{
          position: "absolute", bottom: 44,
          width: 160, height: 1,
          background: "rgba(255,255,255,0.07)",
          overflow: "hidden",
          opacity: 0,
          animation: "eiq-fadeIn 0.4s ease 1s forwards",
        }}>
          <div style={{
            height: "100%", width: 0,
            background: "linear-gradient(90deg, #5ab4ff, #a78bfa, #38d9a9)",
            animation: `eiq-progressFill ${(duration / 1000).toFixed(1)}s cubic-bezier(0.4,0,0.2,1) 0.6s forwards`,
          }} />
        </div>
      </div>
    </>
  );
}
