import { useEffect, useRef } from "react";

const getCtor = () =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export const voiceSupported = () => getCtor() !== null;

// Wake phrase: "ehi jarvis" (+ common mishearings of "jarvis").
const WAKE =
  /\b(ehi|ei|hey|hei|ok|okay|e)\s+(jarvis|jervis|giarvis|giarvis|garvis|jarviz|jarvi|service)\b/i;

interface Opts {
  enabled: boolean;
  /** fired when the wake phrase is detected (UI: enter listening mode) */
  onWake: () => void;
  /** fired with the captured command once the user stops speaking */
  onCommand: (text: string) => void;
  /** live interim transcript while capturing a command (for the input box) */
  onInterim?: (text: string) => void;
  /** fired when the user ends the conversation ("basta"/"stop") */
  onSleep?: () => void;
  lang?: string;
}

/**
 * A SINGLE always-on recognizer that does both jobs — no two-instance mic
 * conflict. It idles scanning for the wake phrase; once heard it switches to
 * "capturing" and forwards the next utterance as the command, then returns to
 * scanning. The caller can also force capture (mic button) via `armCommand()`.
 */
export function useVoice({ enabled, onWake, onCommand, onInterim, onSleep, lang = "it-IT" }: Opts) {
  const recRef = useRef<SpeechRecognition | null>(null);
  const wantRef = useRef(false);
  const capturingRef = useRef(false);
  const mutedRef = useRef(false); // muted while JARVIS is speaking (avoid self-hearing)
  const ignoreUntilRef = useRef(0); // ignore results until this timestamp (post-speech cooldown)
  const skipPhraseRef = useRef(false); // ignore the wake-word utterance itself, wait for the next
  // Conversation mode: once awake, every utterance is a command (no wake word
  // needed) until the user says "basta"/"stop" or toggles the mic off.
  const conversationRef = useRef(false);
  const cb = useRef({ onWake, onCommand, onInterim, onSleep: undefined as undefined | (() => void) });
  cb.current = { onWake, onCommand, onInterim, onSleep: onSleep };

  useEffect(() => {
    const Ctor = getCtor();
    if (!Ctor || !enabled) return;

    wantRef.current = true;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;

    let restart: ReturnType<typeof setTimeout> | null = null;

    const EXIT = /\b(basta|stop|stoppa|esci|ferma(ti)?|chiudi|silenzio|a dopo|spegniti)\b/i;
    const handleExit = (text: string): boolean => {
      if (EXIT.test(text)) {
        capturingRef.current = false;
        conversationRef.current = false;
        cb.current.onSleep?.();
        return true;
      }
      return false;
    };

    rec.onresult = (ev) => {
      // Drop everything while JARVIS is speaking, and for a short cooldown after,
      // so the TTS tail is never transcribed back as user input.
      if (mutedRef.current || Date.now() < ignoreUntilRef.current) return;

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;

        if (!capturingRef.current) {
          // --- scanning for the wake phrase ---
          if (WAKE.test(text)) {
            capturingRef.current = true;
            // No conversation mode: each command needs a fresh "ehi jarvis".
            // After one command we drop back to scanning for the wake word.
            conversationRef.current = false;
            const after = text.replace(WAKE, "").trim();
            if (after) {
              // user said the command in the same breath ("ehi jarvis, apri google")
              if (r.isFinal) {
                if (!handleExit(after)) cb.current.onCommand(after);
              } else {
                cb.current.onWake();
                cb.current.onInterim?.(after);
              }
            } else {
              // ONLY the wake word so far → wake up and WAIT for the next utterance.
              // Don't treat this utterance (even when it finalizes) as a command.
              cb.current.onWake();
              skipPhraseRef.current = true;
            }
          }
        } else {
          // --- capturing the command ---
          if (skipPhraseRef.current) {
            // This is still the wake-word utterance finalizing — ignore it,
            // keep waiting for what the user says NEXT.
            if (r.isFinal) skipPhraseRef.current = false;
            continue;
          }
          if (r.isFinal) {
            if (handleExit(text)) {
              // conversation ended
            } else if (text) {
              cb.current.onCommand(text);
              capturingRef.current = conversationRef.current;
            } else {
              capturingRef.current = conversationRef.current;
            }
          } else {
            cb.current.onInterim?.(text);
          }
        }
      }
    };

    rec.onend = () => {
      if (wantRef.current) {
        restart = setTimeout(() => {
          try {
            rec.start();
          } catch {
            /* already running */
          }
        }, 200);
      }
    };
    rec.onerror = () => {
      /* onend handles restart */
    };

    try {
      rec.start();
    } catch {
      /* ignore */
    }

    return () => {
      wantRef.current = false;
      if (restart) clearTimeout(restart);
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, lang]);

  /** Manually arm command capture + enter conversation mode (mic button on). */
  const armCommand = () => {
    capturingRef.current = true;
    conversationRef.current = true;
    skipPhraseRef.current = false; // no wake word here — capture immediately
  };
  /** Stop capturing and leave conversation mode (mic button off / "basta"). */
  const disarmCommand = () => {
    capturingRef.current = false;
    conversationRef.current = false;
    skipPhraseRef.current = false;
  };
  /** Mute recognition while JARVIS is speaking so it doesn't hear itself. */
  const setMuted = (m: boolean) => {
    mutedRef.current = m;
    // On unmute, ignore the next 800ms (TTS audio tail / echo) before listening.
    if (!m) ignoreUntilRef.current = Date.now() + 800;
  };

  return { armCommand, disarmCommand, setMuted };
}
