import { useEffect, useRef, useState } from "react";
import { useJarvis } from "../state/store";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
  shape: "rect" | "circle" | "streamer";
}

const COLORS = ["#16e0ff", "#6df0ff", "#ffb347", "#ff5d8f", "#4dff9e", "#c77dff", "#ffffff", "#ffe14d"];
const DANCERS = ["🕺", "💃", "🪩", "🎉", "🎊", "🤖", "🥳", "👯"];

/** How long the whole party lasts, in seconds. */
const PARTY_DURATION = 28;

export function Confetti() {
  const partyTick = useJarvis((s) => s.partyTick);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);
  // Time (ms) at which the continuous emission should stop. 0 = idle.
  const emitUntilRef = useRef<number>(0);
  const lastFireworkRef = useRef<number>(0);

  const [dancing, setDancing] = useState(false);

  // Set up the canvas + render loop once.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    let emitAccum = 0; // throttles the continuous rain

    const spawnFirework = (cx: number, cy: number) => {
      const n = 60 + ((Math.random() * 40) | 0);
      const hue = COLORS[(Math.random() * COLORS.length) | 0];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.3;
        const sp = 160 + Math.random() * 320;
        piecesRef.current.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 14,
          w: 4 + Math.random() * 5,
          h: 4 + Math.random() * 5,
          color: Math.random() < 0.5 ? hue : COLORS[(Math.random() * COLORS.length) | 0],
          life: 1.6 + Math.random() * 1.4,
          shape: "circle",
        });
      }
    };

    const rainRow = (n: number) => {
      const W = canvas.width;
      for (let i = 0; i < n; i++) {
        const streamer = Math.random() < 0.18;
        piecesRef.current.push({
          x: Math.random() * W,
          y: -20,
          vx: (Math.random() - 0.5) * 160,
          vy: 40 + Math.random() * 120,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 10,
          w: streamer ? 3 + Math.random() * 3 : 6 + Math.random() * 8,
          h: streamer ? 26 + Math.random() * 30 : 8 + Math.random() * 12,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          life: 4 + Math.random() * 3,
          shape: streamer ? "streamer" : Math.random() < 0.4 ? "circle" : "rect",
        });
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Continuous emission while the party window is open.
      const partying = now < emitUntilRef.current;
      if (partying) {
        emitAccum += dt;
        // ~40 confetti per ~60ms => dense, continuous rain
        while (emitAccum > 0.06) {
          emitAccum -= 0.06;
          rainRow(40);
        }
        // Fireworks roughly every 550ms at random spots up top.
        if (now - lastFireworkRef.current > 550) {
          lastFireworkRef.current = now;
          spawnFirework(
            canvas.width * (0.15 + Math.random() * 0.7),
            canvas.height * (0.12 + Math.random() * 0.3),
          );
        }
      }

      const g = 520;
      const pieces = piecesRef.current;
      for (const p of pieces) {
        p.vy += g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      piecesRef.current = pieces.filter((p) => p.life > 0 && p.y < canvas.height + 60);

      if (partying || piecesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    };

    (canvas as any).__startLoop = () => {
      if (rafRef.current == null) {
        last = performance.now();
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Kick off a long, continuous party whenever partyTick increments.
  useEffect(() => {
    if (partyTick === 0) return;
    const canvas = canvasRef.current!;
    emitUntilRef.current = performance.now() + PARTY_DURATION * 1000;
    lastFireworkRef.current = 0;
    (canvas as any).__startLoop?.();

    setDancing(true);
    const t = window.setTimeout(() => setDancing(false), PARTY_DURATION * 1000);
    return () => window.clearTimeout(t);
  }, [partyTick]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: "none" }}
      />
      {dancing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 51,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {DANCERS.concat(DANCERS).map((emoji, i) => {
            const left = (i * 8.3 + (i % 3) * 4) % 96;
            const dur = 0.5 + (i % 5) * 0.12;
            const size = 42 + (i % 4) * 18;
            const delay = (i % 7) * 0.09;
            const bottom = 2 + (i % 4) * 3;
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  bottom: `${bottom}%`,
                  fontSize: `${size}px`,
                  animation: `jarvisDance ${dur}s ease-in-out ${delay}s infinite alternate`,
                  filter: "drop-shadow(0 0 12px rgba(22,224,255,0.7))",
                }}
              >
                {emoji}
              </span>
            );
          })}
          <style>{`
            @keyframes jarvisDance {
              0%   { transform: translateY(0) rotate(-14deg) scale(1); }
              50%  { transform: translateY(-26px) rotate(0deg) scale(1.15); }
              100% { transform: translateY(0) rotate(14deg) scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
