import { AnimatePresence } from "framer-motion";
import { Reactor2D } from "./two/Reactor2D";
import { BootSequence } from "./scenes/BootSequence";
import { CommandCenter } from "./scenes/CommandCenter";
import { Confetti } from "./ui/Confetti";
import { WakeEffect } from "./ui/WakeEffect";
import { SiteFrame } from "./ui/SiteFrame";
import { SafeBoundary } from "./ui/SafeBoundary";
import { useJarvis } from "./state/store";

export default function App() {
  const booted = useJarvis((s) => s.booted);

  return (
    <div className="app">
      {/* lightweight 2D canvas reactor (no WebGL) */}
      <Reactor2D />

      {/* CommandCenter hosts the voice/wake handling — keep it OUTSIDE the
          boundary so a crash in a decorative effect can never kill the mic. */}
      <CommandCenter />

      <SafeBoundary name="SiteFrame">
        <SiteFrame />
      </SafeBoundary>
      <SafeBoundary name="Confetti">
        <Confetti />
      </SafeBoundary>
      <SafeBoundary name="WakeEffect">
        <WakeEffect />
      </SafeBoundary>

      <AnimatePresence>{!booted && <BootSequence key="boot" />}</AnimatePresence>
    </div>
  );
}
