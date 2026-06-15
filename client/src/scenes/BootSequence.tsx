import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useJarvis } from "../state/store";

const STEPS = [
  "INITIALIZING AI CORE",
  "MOUNTING MEMORY SUBSYSTEM",
  "SYNCHRONIZING MEMORY",
  "REGISTERING AGENTS",
  "REGISTERING TOOLS",
  "CALIBRATING VOICE INTERFACE",
  "ESTABLISHING UPLINK TO CORE",
  "SYSTEMS ONLINE",
];

export function BootSequence() {
  const setBooted = useJarvis((s) => s.setBooted);
  const [done, setDone] = useState<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let i = 0;
    const stepId = setInterval(() => {
      i += 1;
      setDone(i);
      if (i >= STEPS.length) {
        clearInterval(stepId);
        setTimeout(() => setBooted(true), 700);
      }
    }, 480);
    const progId = setInterval(
      () => setProgress((p) => Math.min(100, p + Math.random() * 9)),
      120
    );
    return () => {
      clearInterval(stepId);
      clearInterval(progId);
    };
  }, [setBooted]);

  const skip = () => setBooted(true);

  return (
    <motion.div
      className="boot"
      onClick={skip}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <motion.div
        className="boot-title"
        initial={{ opacity: 0, letterSpacing: "2rem" }}
        animate={{ opacity: 1, letterSpacing: "0.6rem" }}
        transition={{ duration: 1.4 }}
      >
        J.A.R.V.I.S.
      </motion.div>

      <div className="boot-steps">
        <AnimatePresence>
          {STEPS.slice(0, done).map((s, i) => (
            <motion.div
              key={s}
              className="boot-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              <span className="boot-ok">[ OK ]</span>
              <span>{s}</span>
              {i === STEPS.length - 1 && <span className="boot-online">●</span>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="boot-bar">
        <motion.div className="boot-fill" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
      </div>
      <div className="boot-pct">{Math.round(progress)}%</div>
      <div className="boot-skip">click to skip</div>
    </motion.div>
  );
}
