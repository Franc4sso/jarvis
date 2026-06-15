# JARVIS — Ultra Cinematic AI Operating System

**Date:** 2026-06-15
**Status:** Approved — Round 1 (vertical slice)

## Goal

A real AI assistant wrapped in a cinematic, holographic, Iron-Man-HUD interface.
The moment a user opens it they should think "THIS IS JARVIS." Visual impact is the
top priority; underneath it is a working Claude-powered assistant with voice.

NOT a SaaS dashboard. NOT an admin panel. No Stripe/Linear/Notion-style cards or tables.

## Architecture

Two processes:

```
jarvis/
├── client/                      Vite + React 18 + TypeScript (cinematic SPA)
│   ├── src/
│   │   ├── three/               GPU layer
│   │   │   ├── Reactor.tsx          Arc-reactor core (rings + shader + particle stream)
│   │   │   ├── shaders/             GLSL: fresnel glow, noise pulse, energy
│   │   │   ├── ParticleField.tsx    Ambient nebula particles
│   │   │   └── Scene.tsx            R3F Canvas + postprocessing (Bloom etc.)
│   │   ├── scenes/
│   │   │   ├── BootSequence.tsx     Cinematic startup
│   │   │   └── CommandCenter.tsx    Main screen
│   │   ├── ui/
│   │   │   ├── OrbitingModules.tsx   Memory/System/Browser/Calendar/Agent/Tasks
│   │   │   ├── HudOverlay.tsx        Corner telemetry, scanlines, glitch
│   │   │   └── ChatPanel.tsx         Holographic conversation panel
│   │   ├── audio/
│   │   │   ├── useSpeech.ts          Web Speech API: STT + TTS
│   │   │   └── useMicAnalyser.ts     mic → AnalyserNode → reactor uniform
│   │   ├── api/chat.ts              SSE client → server
│   │   └── state/                   reactor mode store (idle/listening/thinking/speaking)
│   └── package.json
└── server/                      Express + @anthropic-ai/sdk
    ├── src/index.ts                 SSE /api/chat, conversation state
    └── .env                         ANTHROPIC_API_KEY
```

## Tech Stack

- **Frontend:** Vite, React 18, TypeScript
- **3D/GPU:** three, @react-three/fiber, @react-three/drei, @react-three/postprocessing
- **Animation:** framer-motion (2D UI), custom GLSL + useFrame (3D)
- **Audio:** Web Speech API (SpeechRecognition + SpeechSynthesis), Web Audio AnalyserNode
- **Backend:** Node + Express + @anthropic-ai/sdk
- **Model:** `claude-opus-4-8`, `thinking: {type: "adaptive"}`, SSE streaming

## Components (Round 1 — vertical slice)

### 1. BootSequence
Movie-style startup. Typewriter status lines (AI CORE STARTUP → MEMORY SYNC →
AGENT REGISTRATION → TOOL REGISTRATION → VOICE INIT), energy bars filling, reactor
fading in from dark. ~5s, skippable (click / key). Hands off to CommandCenter.

### 2. AI Command Center
- **Reactor (centerpiece, masterpiece):** rotating concentric rings, procedural
  shader core (simplex noise + fresnel rim glow), particle stream flowing inward,
  intense bloom. Reacts to a global `reactorMode`:
  - `idle` — slow pulse
  - `listening` — expands, audio-reactive rings driven by mic amplitude uniform
  - `thinking` — fast turbulent rotation
  - `speaking` — pulses to TTS cadence
- **Orbiting modules:** Memory, System, Browser, Calendar, Agent, Tasks — holographic
  panels orbiting the core on slow elliptical paths, clickable, hover glow.
- **HUD overlay:** animated corner telemetry, scanlines, occasional holographic glitch,
  neon energy lines. Always in motion.

### 3. Voice Mode
Mic button → SpeechRecognition transcribes. mic AnalyserNode amplitude feeds the
reactor `listening` uniform (real-time audio-reactive waves/rings). On final transcript
→ send to Claude. Response streams back → reactor `speaking` + SpeechSynthesis reads it.

### Chat data flow
```
user (voice or text) → client → POST /api/chat (SSE)
  → server: Claude streaming, adaptive thinking, multi-turn history
  → token stream → client: reactor mode transitions + HUD text + TTS
```

## Server

Express. `POST /api/chat` returns `text/event-stream`. Body: `{messages}`.
Uses `client.messages.stream({model: "claude-opus-4-8", thinking: {type: "adaptive"},
max_tokens: 64000, system: <JARVIS persona>, messages})`. Emits `delta` SSE events per
text chunk, `done` at end. In-memory conversation per session (round 1). Tool-use
predisposed (empty tool array now) for real modules later (memory/calendar/tasks).
`ANTHROPIC_API_KEY` from `.env`; never hardcoded.

## Aesthetic

- Palette: cyan / electric-blue primary, amber accents, deep-space black background
- Glassmorphism panels, neon energy lines, holographic flicker
- Post-processing: Bloom, vignette, subtle chromatic aberration, scanlines
- Every screen moves — nothing static

## Out of scope (round 1)

- Knowledge graph 3D (living neural network) — next module
- Real module backends (memory store, browser, calendar) — mocked panels now,
  tool-use wiring later

## Performance

GPU post-processing, instanced particles, throttled useFrame work, lazy-load for the
future 3D graph. Target 60fps on a mid GPU.

## Non-negotiable

Prioritize visual impact over implementation simplicity. Reusable architecture, but
maximize the WOW. Must feel like a real JARVIS OS, not a web dashboard.
