import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useJarvis, nextId } from "../state/store";
import { streamChat } from "../api/chat";
import { speak } from "../audio/useSpeech";
import { useMicAnalyser } from "../audio/useMicAnalyser";
import { useVoice, voiceSupported } from "../audio/useVoice";

export function ChatPanel() {
  const { turns, addTurn, appendToLast, finishLast, setMode, setSessionId, triggerParty, triggerWake, setEmbedUrl } = useJarvis();
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const sending = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mic = useMicAnalyser();
  const booted = useJarvis((s) => s.booted);
  // true while in hands-free conversation mode (after "ehi jarvis", until "basta")
  const convoRef = useRef(false);
  // set true for the current turn only when the server emits a [SPEAK] action,
  // i.e. the user explicitly asked for a spoken reply. Default: stay silent.
  const speakNextRef = useRef(false);

  // forward-declared so the voice hook (defined below) can be controlled from send()
  const voiceCtl = useRef<{ setMuted: (m: boolean) => void; disarmCommand: () => void }>({
    setMuted: () => {},
    disarmCommand: () => {},
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending.current) return;
      sending.current = true;
      setDraft("");
      setListening(false);
      mic.stop();

      addTurn({ id: nextId(), role: "user", text: trimmed });
      addTurn({ id: nextId(), role: "assistant", text: "", streaming: true });
      setMode("thinking");

      const sessionId = useJarvis.getState().sessionId;
      let gotText = false;
      speakNextRef.current = false; // silent unless this turn gets a [SPEAK] action

      await streamChat(trimmed, sessionId, {
        onDelta: (d) => {
          gotText = true;
          if (useJarvis.getState().reactorMode === "thinking") setMode("speaking");
          appendToLast(d);
        },
        onAction: (a) => {
          if (a.type === "open" && a.url) {
            try {
              window.open(a.url, "_blank", "noopener");
            } catch {
              /* popup blocked */
            }
          } else if (a.type === "party") {
            triggerParty();
          } else if (a.type === "embed" && a.url) {
            setEmbedUrl(a.url);
          } else if (a.type === "speak") {
            speakNextRef.current = true;
          }
        },
        onDone: (full, newSessionId) => {
          if (!gotText && full) appendToLast(full);
          finishLast();
          if (newSessionId) setSessionId(newSessionId);

          // Resume listening (conversation mode) or go idle. Shared by both the
          // spoken and silent paths.
          const settle = () => {
            setDraft("");
            voiceCtl.current.setMuted(false);
            if (convoRef.current) {
              setListening(true);
              setMode("listening");
              mic.start();
            } else {
              setMode("idle");
            }
          };

          if (speakNextRef.current) {
            const spoken = useJarvis.getState().turns.at(-1)?.text ?? full;
            // mute the mic while JARVIS speaks so it doesn't transcribe itself
            voiceCtl.current.setMuted(true);
            speak(spoken, (active) => {
              if (active) setMode("speaking");
              else settle();
            });
          } else {
            // Silent by default: no TTS feedback unless explicitly requested.
            settle();
          }
          sending.current = false;
        },
        onError: (msg) => {
          appendToLast(`[core error: ${msg}]`);
          finishLast();
          setMode("idle");
          voiceCtl.current.setMuted(false);
          sending.current = false;
        },
      });
    },
    [addTurn, appendToLast, finishLast, setMode, setSessionId, mic, triggerParty]
  );

  const voice = useVoice({
    enabled: booted,
    onWake: () => {
      // One-shot activation: each command requires a fresh "ehi jarvis".
      // Do NOT enter persistent conversation mode.
      convoRef.current = false;
      if (sending.current) return;
      window.speechSynthesis?.cancel();
      triggerWake(); // robotic activation effect
      setListening(true);
      setMode("listening");
      mic.start();
    },
    onInterim: (t) => setDraft(t),
    onCommand: (t) => {
      setListening(false);
      mic.stop();
      send(t);
    },
    onSleep: () => {
      convoRef.current = false;
      setListening(false);
      mic.stop();
      window.speechSynthesis?.cancel();
      setMode("idle");
    },
  });
  voiceCtl.current = { setMuted: voice.setMuted, disarmCommand: voice.disarmCommand };

  const toggleMic = useCallback(() => {
    if (listening) {
      convoRef.current = false;
      setListening(false);
      voice.disarmCommand();
      mic.stop();
      setMode("idle");
    } else {
      if (sending.current) return;
      convoRef.current = true;
      window.speechSynthesis?.cancel();
      setListening(true);
      setMode("listening");
      voice.armCommand();
      mic.start();
    }
  }, [listening, voice, mic, setMode]);

  return (
    <div className="chat-panel">
      <div className="chat-log" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div
              key={t.id}
              className={`bubble ${t.role}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="bubble-tag">{t.role === "user" ? "YOU" : "JARVIS"}</span>
              <span className="bubble-text">
                {t.text}
                {t.streaming && <span className="caret">▊</span>}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {turns.length === 0 && (
          <div className="chat-hint">
            Di’ <b>“Ehi schiavo”</b> per attivarmi — poi resto in ascolto.
            Di’ <b>“basta”</b> per fermarmi, signore.
          </div>
        )}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <button
          type="button"
          className={`mic-btn ${listening ? "active" : ""}`}
          onClick={toggleMic}
          disabled={!voiceSupported()}
          title={voiceSupported() ? "Voice" : "Voice not supported in this browser"}
        >
          {listening ? "◉" : "🎙"}
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? "In ascolto…" : "Scrivi un comando…"}
          spellCheck={false}
        />
        <button type="submit" className="send-btn">
          ▸
        </button>
      </form>
    </div>
  );
}
