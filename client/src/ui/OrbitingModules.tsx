import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface Mod {
  key: string;
  label: string;
  glyph: string;
  status: string;
}

const MODULES: Mod[] = [
  { key: "memory", label: "MEMORY", glyph: "◈", status: "SYNCED" },
  { key: "system", label: "SYSTEM", glyph: "⬡", status: "NOMINAL" },
  { key: "browser", label: "BROWSER", glyph: "◎", status: "IDLE" },
  { key: "calendar", label: "CALENDAR", glyph: "▦", status: "3 EVENTS" },
  { key: "agent", label: "AGENT", glyph: "⟁", status: "READY" },
  { key: "tasks", label: "TASKS", glyph: "▤", status: "0 PENDING" },
];

const RADIUS = 320; // px, elliptical
const RADIUS_Y = 180;

export function OrbitingModules({ active }: { active: boolean }) {
  const [angle, setAngle] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      // slow orbit; pause-ish when a module is selected
      setAngle((a) => a + dt * (selected ? 0.05 : 0.18));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  return (
    <div className="orbit-layer" style={{ opacity: active ? 1 : 0 }}>
      {MODULES.map((m, i) => {
        const a = angle + (i / MODULES.length) * Math.PI * 2;
        const x = Math.cos(a) * RADIUS;
        const y = Math.sin(a) * RADIUS_Y;
        const depth = (Math.sin(a) + 1) / 2; // 0 back .. 1 front
        const scale = 0.78 + depth * 0.34;
        const isSel = selected === m.key;
        return (
          <motion.button
            key={m.key}
            className={`module-panel ${isSel ? "selected" : ""}`}
            style={{
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
              zIndex: Math.round(depth * 100),
              opacity: 0.45 + depth * 0.55,
            }}
            onClick={() => setSelected((s) => (s === m.key ? null : m.key))}
            whileHover={{ filter: "brightness(1.5)" }}
          >
            <span className="module-glyph">{m.glyph}</span>
            <span className="module-label">{m.label}</span>
            <span className="module-status">{m.status}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
