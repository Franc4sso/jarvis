import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useJarvis } from "../state/store";

const MODE_LABEL: Record<string, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "RESPONDING",
  boot: "INITIALIZING",
};

function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Telemetry() {
  const [vals, setVals] = useState([62, 41, 88, 30]);
  useEffect(() => {
    const id = setInterval(
      () => setVals((v) => v.map((x) => Math.max(8, Math.min(99, x + (Math.random() - 0.5) * 16)))),
      900
    );
    return () => clearInterval(id);
  }, []);
  const labels = ["PWR", "MEM", "NET", "CPU"];
  return (
    <div className="telemetry">
      {vals.map((v, i) => (
        <div className="tele-row" key={labels[i]}>
          <span>{labels[i]}</span>
          <div className="tele-bar">
            <motion.div className="tele-fill" animate={{ width: `${v}%` }} transition={{ duration: 0.8 }} />
          </div>
          <span className="tele-num">{Math.round(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function HudOverlay() {
  const mode = useJarvis((s) => s.reactorMode);
  const clock = useClock();

  return (
    <div className="hud">
      {/* corner frames */}
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />

      <div className="hud-top">
        <div className="hud-brand">
          <span className="brand-main">J.A.R.V.I.S.</span>
          <span className="brand-sub">JUST A RATHER VERY INTELLIGENT SYSTEM</span>
        </div>
        <div className="hud-status">
          <span className={`status-dot ${mode}`} />
          <span className="status-text">{MODE_LABEL[mode] ?? mode.toUpperCase()}</span>
        </div>
      </div>

      <div className="hud-left">
        <Telemetry />
      </div>

      <div className="hud-bottom">
        <span>{clock.toLocaleTimeString([], { hour12: false })}</span>
        <span className="scan-text">SYSTEMS NOMINAL · ALL MODULES ONLINE</span>
        <span>SEC: STARK INDUSTRIES</span>
      </div>
    </div>
  );
}
