import { create } from "zustand";

export type ReactorMode = "boot" | "idle" | "listening" | "thinking" | "speaking";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

interface JarvisState {
  booted: boolean;
  reactorMode: ReactorMode;
  /** 0..1 live mic amplitude, drives the reactor in listening mode */
  micLevel: number;
  turns: ChatTurn[];
  /** Claude Code session id, for multi-turn --resume continuation */
  sessionId: string | null;
  /** bumped to trigger a confetti burst ("facciamo festa") */
  partyTick: number;
  /** bumped to trigger the robotic wake activation effect ("ehi jarvis") */
  wakeTick: number;
  /** URL currently embedded in the in-UI site frame, or null when closed */
  embedUrl: string | null;

  setBooted: (b: boolean) => void;
  setMode: (m: ReactorMode) => void;
  setMicLevel: (v: number) => void;
  setSessionId: (id: string | null) => void;
  triggerParty: () => void;
  triggerWake: () => void;
  setEmbedUrl: (url: string | null) => void;

  addTurn: (turn: ChatTurn) => void;
  appendToLast: (text: string) => void;
  finishLast: () => void;
}

let counter = 0;
export const nextId = () => `t${++counter}`;

export const useJarvis = create<JarvisState>((set) => ({
  booted: false,
  reactorMode: "boot",
  micLevel: 0,
  turns: [],
  sessionId: null,
  partyTick: 0,
  wakeTick: 0,
  embedUrl: null,

  setBooted: (b) => set({ booted: b, reactorMode: b ? "idle" : "boot" }),
  setMode: (m) => set({ reactorMode: m }),
  setMicLevel: (v) => set({ micLevel: v }),
  setSessionId: (id) => set({ sessionId: id }),
  triggerParty: () => set((s) => ({ partyTick: s.partyTick + 1 })),
  triggerWake: () => set((s) => ({ wakeTick: s.wakeTick + 1 })),
  setEmbedUrl: (url) => set({ embedUrl: url }),

  addTurn: (turn) => set((s) => ({ turns: [...s.turns, turn] })),
  appendToLast: (text) =>
    set((s) => {
      const turns = s.turns.slice();
      const last = turns[turns.length - 1];
      if (last) turns[turns.length - 1] = { ...last, text: last.text + text };
      return { turns };
    }),
  finishLast: () =>
    set((s) => {
      const turns = s.turns.slice();
      const last = turns[turns.length - 1];
      if (last) turns[turns.length - 1] = { ...last, streaming: false };
      return { turns };
    }),
}));
