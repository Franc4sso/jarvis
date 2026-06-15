import { useEffect, useRef } from "react";
import { useJarvis, type ReactorMode } from "../state/store";

// Per-mode visual targets. Frame loop lerps toward these — pure 2D canvas.
const MODE: Record<ReactorMode, { energy: number; spin: number; scale: number; turb: number }> = {
  boot: { energy: 0.15, spin: 0.1, scale: 0.55, turb: 0.1 },
  idle: { energy: 0.75, spin: 0.35, scale: 1.0, turb: 0.25 },
  listening: { energy: 1.2, spin: 0.7, scale: 1.14, turb: 0.45 },
  thinking: { energy: 1.45, spin: 1.6, scale: 1.05, turb: 1.3 },
  speaking: { energy: 1.3, spin: 0.6, scale: 1.08, turb: 0.6 },
};

export function Reactor2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    let raf = 0;
    let t = 0;

    const cur = { energy: 0.15, spin: 0.1, scale: 0.55, turb: 0.1 };

    // Fewer particles than before. No per-particle shadowBlur (that was the FPS killer).
    const STREAM = 38;
    const stream = Array.from({ length: STREAM }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: Math.random(),
      speed: 0.12 + Math.random() * 0.18,
      size: 0.8 + Math.random() * 1.6,
    }));
    const DUST = 36;
    const dust = Array.from({ length: DUST }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.02,
      vy: (Math.random() - 0.5) * 0.02,
    }));

    // Cap DPR hard — high-DPI fills 4x the pixels for no visible gain here.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let W = 0;
    let H = 0;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (dt: number) => {
      t += dt;
      const cx = W / 2;
      const cy = H * 0.46;
      const baseR = Math.min(W, H) * 0.14;

      const { reactorMode: mode, micLevel } = useJarvis.getState();
      const target = MODE[mode];
      const k = Math.min(1, dt * 3);
      cur.energy += (target.energy - cur.energy) * k;
      cur.spin += (target.spin - cur.spin) * k;
      cur.scale += (target.scale - cur.scale) * k;
      cur.turb += (target.turb - cur.turb) * k;

      const live = mode === "listening" ? micLevel : micLevel * 0.3;
      const energy = cur.energy + live * 0.9;
      const R = baseR * (cur.scale + (mode === "listening" ? live * 0.12 : 0));

      // motion-blur trail (cheap)
      ctx.fillStyle = "rgba(2,5,12,0.34)";
      ctx.fillRect(0, 0, W, H);

      // background dust — flat dots, no glow
      ctx.fillStyle = "rgba(43,214,255,0.30)";
      for (const d of dust) {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.x < 0) d.x = 1;
        else if (d.x > 1) d.x = 0;
        if (d.y < 0) d.y = 1;
        else if (d.y > 1) d.y = 0;
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = "lighter";

      // outer glow halo — one gradient per frame (cheap enough, gives the bloom feel)
      const halo = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, R * 2.4);
      halo.addColorStop(0, `rgba(22,224,255,${0.2 * energy})`);
      halo.addColorStop(1, "rgba(22,224,255,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, R * 2.4, 0, Math.PI * 2);
      ctx.fill();

      // streaming particles toward core — additive blending fakes the glow, NO shadowBlur
      ctx.fillStyle = `rgba(138,243,255,${0.85 * energy})`;
      for (const p of stream) {
        p.radius -= p.speed * dt * (0.4 + cur.turb * 0.5);
        if (p.radius <= 0) {
          p.radius = 1;
          p.angle = Math.random() * Math.PI * 2;
        }
        const pr = R * 2.2 * p.radius + R * 0.4;
        const a = p.angle + t * cur.spin * 0.5;
        const x = Math.cos(a) * pr;
        const y = Math.sin(a) * pr * 0.55;
        ctx.globalAlpha = (1 - p.radius) * energy;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // rotating rings — stroke only, NO shadowBlur (additive blend gives the glow)
      const rings = [
        { r: R * 1.15, w: 2.5, sp: 0.4, dash: null as number[] | null },
        { r: R * 1.4, w: 1.5, sp: -0.7, dash: [14, 10] },
        { r: R * 1.7, w: 3, sp: 0.3, dash: [4, 18] },
      ];
      ctx.strokeStyle = `rgba(22,224,255,${0.55 * energy})`;
      for (const ring of rings) {
        ctx.save();
        ctx.rotate(t * cur.spin * ring.sp);
        ctx.lineWidth = ring.w;
        ctx.setLineDash(ring.dash ?? []);
        ctx.beginPath();
        ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.setLineDash([]);

      // inner segmented energy ring — fewer segments, one stroke path
      const segs = 18;
      ctx.save();
      ctx.rotate(-t * cur.spin * 0.9);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(109,240,255,${0.6 * energy})`;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const n = Math.sin(t * (2 + cur.turb * 4) + i * 1.7) * 0.5 + 0.5;
        const len = 0.07 + n * 0.12 * cur.turb;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.92, a0, a0 + len);
        ctx.stroke();
      }
      ctx.restore();

      // pulsing core — the ONE place we spend a soft gradient (no shadowBlur)
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2);
      const coreR = R * (0.42 + pulse * 0.06 + live * 0.1);
      const core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 1.8);
      core.addColorStop(0, `rgba(220,250,255,${0.95 * energy})`);
      core.addColorStop(0.45, `rgba(109,240,255,${0.6 * energy})`);
      core.addColorStop(1, "rgba(22,224,255,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 0, coreR * 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    let last = performance.now();
    let acc = 0;
    const FRAME = 1000 / 40; // cap at ~40fps — plenty for this, saves CPU/GPU
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const elapsed = now - last;
      if (elapsed < FRAME) return;
      last = now - (elapsed % FRAME);
      acc = Math.min(0.05, elapsed / 1000);
      draw(acc);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="reactor-canvas" />;
}
