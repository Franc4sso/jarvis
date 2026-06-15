import { motion } from "framer-motion";
import { useJarvis } from "../state/store";
import { HudOverlay } from "../ui/HudOverlay";
import { OrbitingModules } from "../ui/OrbitingModules";
import { ChatPanel } from "../ui/ChatPanel";

export function CommandCenter() {
  const booted = useJarvis((s) => s.booted);

  return (
    <motion.div
      className="command-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: booted ? 1 : 0 }}
      transition={{ duration: 1.2, delay: 0.2 }}
    >
      <HudOverlay />
      <OrbitingModules active={booted} />
      <ChatPanel />
    </motion.div>
  );
}
