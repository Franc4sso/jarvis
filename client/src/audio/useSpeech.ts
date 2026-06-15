import { useCallback, useEffect, useRef } from "react";

const getRecognitionCtor = () =>
  window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;

export const speechSupported = () => getRecognitionCtor() !== null;

interface UseSpeechOpts {
  lang?: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Web Speech recognition (STT) + synthesis (TTS). */
export function useSpeech({ lang = "it-IT", onResult, onStart, onEnd }: UseSpeechOpts) {
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onresult = (ev) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) onResult(final, true);
      else if (interim) onResult(interim, false);
    };
    rec.onstart = () => onStart?.();
    rec.onend = () => onEnd?.();
    rec.onerror = () => onEnd?.();

    recRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [lang, onResult, onStart, onEnd]);

  const start = useCallback(() => {
    try {
      recRef.current?.start();
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return { start, stop };
}

// Female Italian voice names across engines.
const FEMALE = /female|donna|femmin|Elsa|Alice|Federica|Paola|Carla|Bianca|Giorgia|Isabella|Samantha|Lucia/i;
// "Natural" / "Online" / "Neural" = the high-quality non-robotic voices (Edge/Win).
const NEURAL = /natural|neural|online|premium|enhanced|google/i;

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const base = lang.split("-")[0];
  const it = voices.filter((v) => v.lang.toLowerCase().startsWith(base));

  const chosen =
    // 1. Italian + neural + female → the best case (Microsoft Elsa Online Natural, etc.)
    it.find((v) => NEURAL.test(v.name) && FEMALE.test(v.name)) ??
    // 2. Italian + neural (Google italiano is neural+female on Chrome)
    it.find((v) => NEURAL.test(v.name)) ??
    // 3. Italian + female name
    it.find((v) => FEMALE.test(v.name)) ??
    // 4. any Italian voice
    it[0] ??
    // 5. any neural female voice in any language
    voices.find((v) => NEURAL.test(v.name) && FEMALE.test(v.name)) ??
    voices[0];

  return chosen;
}

/**
 * Speak text aloud. Robust against the common gotchas: waits for voices to load,
 * chunks long text (some engines truncate > ~200 chars), prefers an Italian voice.
 */
export function speak(text: string, onActive: (active: boolean) => void, lang = "it-IT") {
  if (!("speechSynthesis" in window)) {
    onActive(false);
    return;
  }
  const clean = text.trim();
  if (!clean) {
    onActive(false);
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  const run = () => {
    // split into sentence-ish chunks to avoid truncation on long replies
    const chunks = clean.match(/[^.!?\n]+[.!?\n]*/g) ?? [clean];
    const voice = pickVoice(lang);
    let started = false;

    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk.trim());
      u.lang = lang;
      u.rate = 1.0;
      u.pitch = 1.0; // neural voices sound most natural untouched
      if (voice) u.voice = voice;
      u.onstart = () => {
        if (!started) {
          started = true;
          onActive(true);
        }
      };
      if (i === chunks.length - 1) {
        u.onend = () => onActive(false);
        u.onerror = () => onActive(false);
      }
      synth.speak(u);
    });

    // safety: if nothing ever started, clear the active flag
    setTimeout(() => {
      if (!started && !synth.speaking) onActive(false);
    }, 1500);
  };

  // Voices may not be loaded yet on first call — wait for them once.
  if (synth.getVoices().length === 0) {
    const once = () => {
      synth.removeEventListener("voiceschanged", once);
      run();
    };
    synth.addEventListener("voiceschanged", once);
    // fallback in case the event never fires
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", once);
      run();
    }, 600);
  } else {
    run();
  }
}
