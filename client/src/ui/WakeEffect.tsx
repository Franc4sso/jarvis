import { useEffect, useRef, useState } from "react";
import { useJarvis } from "../state/store";

/**
 * Robotic activation burst, fired on every "ehi jarvis" wake.
 * Layers: expanding shockwave rings + sweeping scan line + corner targeting
 * brackets snapping inward + a glitchy "ATTIVO" stamp. ~1.4s, self-clearing.
 */
const DURATION = 1400; // ms

export function WakeEffect() {
  const wakeTick = useJarvis((s) => s.wakeTick);
  const [active, setActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  // Show the overlay on each wake. The canvas animation runs in the effect below,
  // which only fires once `active` is true and the <canvas> is actually mounted.
  useEffect(() => {
    if (wakeTick === 0) return;
    setActive(true);
  }, [wakeTick]);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    startRef.current = performance.now();
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = Math.hypot(W, H) / 2;

    const draw = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / DURATION);
      ctx.clearRect(0, 0, W, H);

      // 1) Two staggered expanding shockwave rings.
      for (let k = 0; k < 2; k++) {
        const lt = Math.min(1, Math.max(0, t * 1.25 - k * 0.18));
        if (lt <= 0 || lt >= 1) continue;
        const r = lt * maxR;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(22,224,255,${(1 - lt) * 0.9})`;
        ctx.lineWidth = 3 + (1 - lt) * 6;
        ctx.shadowColor = "rgba(22,224,255,0.9)";
        ctx.shadowBlur = 24;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // 2) Rotating reticle ticks around the core, snapping to full opacity.
      const appear = Math.min(1, t * 3);
      const ticks = 48;
      const ringR = 120 + Math.sin(t * Math.PI) * 18;
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2 + t * 1.6;
        const long = i % 4 === 0;
        const r1 = ringR;
        const r2 = ringR + (long ? 22 : 10);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx.strokeStyle = `rgba(109,240,255,${appear * (1 - t) * 0.9})`;
        ctx.lineWidth = long ? 2.5 : 1.2;
        ctx.stroke();
      }

      // 3) Vertical scan sweep that crosses the screen once.
      const sx = t * W;
      const grad = ctx.createLinearGradient(sx - 60, 0, sx + 60, 0);
      grad.addColorStop(0, "rgba(22,224,255,0)");
      grad.addColorStop(0.5, `rgba(22,224,255,${(1 - t) * 0.35})`);
      grad.addColorStop(1, "rgba(22,224,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(sx - 60, 0, 120, H);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        rafRef.current = null;
        setActive(false);
      }
    };

    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none" }}>
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0 }} />
      {/* Corner targeting brackets that snap inward */}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <span key={c} className={`wake-bracket wake-${c}`} />
      ))}
      {/* Glitchy activation stamp */}
      <div className="wake-stamp">
        <span className="wake-stamp-main">J.A.R.V.I.S.</span>
        <span className="wake-stamp-sub">SISTEMA ATTIVO</span>
      </div>
      <style>{`
        @keyframes wakeFlash {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.7); filter: blur(8px); letter-spacing: 0.6em; }
          18%  { opacity: 1; transform: translate(-50%, -50%) scale(1.05); filter: blur(0); }
          70%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.02); filter: blur(2px); }
        }
        @keyframes wakeGlitch {
          0%, 100% { clip-path: inset(0 0 0 0); transform: translate(-50%, -50%); }
          20% { clip-path: inset(40% 0 30% 0); transform: translate(calc(-50% + 4px), -50%); }
          22% { clip-path: inset(0 0 0 0); transform: translate(-50%, -50%); }
          55% { clip-path: inset(60% 0 10% 0); transform: translate(calc(-50% - 5px), -50%); }
          57% { clip-path: inset(0 0 0 0); transform: translate(-50%, -50%); }
        }
        .wake-stamp {
          position: fixed; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          animation: wakeFlash ${DURATION}ms ease-out forwards;
          text-shadow: 0 0 18px rgba(22,224,255,0.9), 0 0 40px rgba(22,224,255,0.5);
        }
        .wake-stamp-main {
          font-family: 'Orbitron', system-ui, sans-serif;
          font-weight: 800; font-size: clamp(28px, 6vw, 72px);
          color: #d6fbff; letter-spacing: 0.25em;
          animation: wakeGlitch ${DURATION}ms steps(1) forwards;
        }
        .wake-stamp-sub {
          font-family: 'Orbitron', system-ui, sans-serif;
          font-weight: 600; font-size: clamp(11px, 1.6vw, 18px);
          color: #16e0ff; letter-spacing: 0.5em;
        }
        @keyframes wakeBracket {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
        .wake-bracket {
          position: fixed; width: 64px; height: 64px;
          border: 3px solid #16e0ff;
          box-shadow: 0 0 16px rgba(22,224,255,0.8);
          animation: wakeBracket ${DURATION}ms ease-out forwards;
        }
        .wake-tl { top: 6vh; left: 6vw; border-right: none; border-bottom: none; }
        .wake-tr { top: 6vh; right: 6vw; border-left: none; border-bottom: none; }
        .wake-bl { bottom: 6vh; left: 6vw; border-right: none; border-top: none; }
        .wake-br { bottom: 6vh; right: 6vw; border-left: none; border-top: none; }
      `}</style>
    </div>
  );
}
