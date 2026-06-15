import { AnimatePresence } from "framer-motion";
import { Reactor2D } from "./two/Reactor2D";
import { BootSequence } from "./scenes/BootSequence";
import { CommandCenter } from "./scenes/CommandCenter";
import { Confetti } from "./ui/Confetti";
import { WakeEffect } from "./ui/WakeEffect";
import { useJarvis } from "./state/store";

export default function App() {
  const booted = useJarvis((s) => s.booted);

  return (
    <div className="app">
      {/* lightweight 2D canvas reactor (no WebGL) */}
      <Reactor2D />

      <CommandCenter />
      <Confetti />
      <WakeEffect />

      <AnimatePresence>{!booted && <BootSequence key="boot" />}</AnimatePresence>
    </div>
  );
}
