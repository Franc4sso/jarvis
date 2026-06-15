import { useCallback, useRef } from "react";
import { useJarvis } from "../state/store";

/**
 * Opens the microphone, runs an AnalyserNode, and pushes a smoothed 0..1
 * amplitude into the store on every frame. The reactor shader reads micLevel.
 */
export function useMicAnalyser() {
  const setMicLevel = useJarvis((s) => s.setMicLevel);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const smoothed = useRef(0);

  const start = useCallback(async () => {
    if (ctxRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255; // 0..1
        smoothed.current += (avg - smoothed.current) * 0.25;
        setMicLevel(Math.min(1, smoothed.current * 2.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic denied — leave micLevel at 0; voice mode still works as visual stub
    }
  }, [setMicLevel]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    smoothed.current = 0;
    setMicLevel(0);
  }, [setMicLevel]);

  return { start, stop };
}
