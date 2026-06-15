# J.A.R.V.I.S. — Ultra Cinematic AI Operating System

A real Claude-powered assistant wrapped in an Iron-Man-HUD interface: animated arc
reactor, orbiting holographic modules, boot sequence, voice mode, and streaming chat.

Not a dashboard. A command center.

## Stack

- **client** — Vite + React 18 + TypeScript. Reactor rendered in **Canvas 2D**
  (no WebGL — runs on low-end GPUs). Framer Motion for UI, Web Speech API for voice
  with a hands-free **"Ehi JARVIS" / "Hey JARVIS"** wake word.
- **server** — Express that drives the **Claude Code CLI** (`claude -p
  --output-format stream-json`) as a subprocess, parses its stream-json events,
  and forwards them to the client over SSE. Multi-turn via `--resume <session_id>`.
  No API key — uses your existing `claude` login. Model: `claude-opus-4-8`.

## Run

Prerequisites:
- the `claude` CLI installed and logged in (run `claude` once interactively). No API key.
- **Browser control** (JARVIS piloting a real Chromium) needs Playwright + its system
  libraries. One-time, requires sudo:
  ```bash
  cd server
  npx playwright install chromium
  sudo npx playwright install-deps chromium   # installs libasound2, fonts, xvfb, etc.
  ```
  On WSL a visible window uses WSLg (DISPLAY must be set). Set `JARVIS_HEADLESS=1`
  to run the browser invisibly on headless servers.

```bash
# 1. server
cd server
cp .env.example .env          # optional — only PORT / model overrides live here
npm install
npm run dev                    # → http://localhost:8787

# 2. client (new terminal)
cd client
npm install
npm run dev                    # → http://localhost:5180
```

Open the client URL Vite prints. Watch the boot sequence (click to skip), then either
say **"Ehi JARVIS"** (hands-free — JARVIS starts listening on its own), click the mic,
or type a command. The reactor reacts: pulse on idle, audio-reactive while listening,
turbulent while thinking, pulsing while JARVIS speaks back.

Voice + wake word require a Chromium-based browser (Web Speech API) and mic permission.
Text input works everywhere.

## Layout

```
client/src/
  three/      Reactor (GLSL shader core), particle field, R3F scene + postprocessing
  scenes/     BootSequence, CommandCenter
  ui/         HudOverlay, OrbitingModules, ChatPanel
  audio/      Web Speech (STT/TTS), mic AnalyserNode → reactor
  state/      reactor-mode + conversation store (zustand)
  api/        SSE chat client
server/src/   Express SSE /api/chat → Claude
```

## Roadmap

- Knowledge graph 3D (living neural network, orbit/zoom camera)
- Real module backends via Claude tool use (memory, calendar, tasks, browser)

See `docs/superpowers/specs/` for the full design.
