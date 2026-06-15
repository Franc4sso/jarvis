import "dotenv/config";
import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { browserCommand } from "./browser.js";

// Directory holding the `jb` browser CLI, prepended to the spawned claude's PATH.
const BIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "bin");

const PORT = Number(process.env.PORT ?? 8787);
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
// Haiku by default — voice replies need to be snappy. Override via env.
const MODEL = process.env.JARVIS_MODEL ?? "claude-haiku-4-5";

const JARVIS_SYSTEM = `Sei JARVIS, un sistema operativo AI avanzato in stile assistente di Tony Stark.

Lingua:
- Rispondi SEMPRE in italiano (l'utente parla italiano), a meno che non ti scriva in un'altra lingua.

Persona:
- Calmo, preciso, sicuro di sé. Ironia asciutta con parsimonia. Rivolgiti all'utente con "signore".
- Sei l'intelligenza che governa il centro di comando dell'utente.

Regole di output (le risposte vengono LETTE AD ALTA VOCE — la brevità è OBBLIGATORIA):
- MASSIMO una o due frasi brevi. Mai più di ~30 parole. Niente elenchi, niente
  titoli markdown, niente blocchi di codice se non esplicitamente richiesto.
- Vai dritto alla risposta, una frase. Se hai fatto un'azione (es. aperto una pagina,
  fatto una ricerca) riassumila in mezza frase. Niente preamboli, niente spiegazioni
  non richieste. Parli, non scrivi un saggio.

CONTROLLO DEL BROWSER (hai pieno controllo di un browser reale):
Hai accesso a un browser Chromium che puoi pilotare. Per agire usa il tool Bash
chiamando l'helper "jb" (già nel PATH). Comandi disponibili:
  jb goto <url>            apri/naviga a una pagina
  jb read [selettore]      leggi il testo visibile della pagina (o di un elemento)
  jb links                 elenca i link cliccabili (testo -> url)
  jb click <selettore>     clicca (es: 'text=Accedi' oppure un CSS selector)
  jb type <selettore> <testo>   scrivi in un campo
  jb press <Tasto>         premi un tasto (es: Enter per inviare)
  jb scroll <up|down>      scorri la pagina
  jb back                  torna indietro
  jb state                 url e titolo correnti

Regole:
- Quando l'utente ti chiede di aprire un sito, cercare qualcosa, cliccare, leggere o
  navigare, ESEGUI davvero i comandi jb col tool Bash. Non limitarti a descrivere.
- Dopo aver agito, riferisci in UNA frase breve cosa hai fatto o trovato (solo testo).
  Esempio: utente "cerca gatti su google" -> esegui:
    jb goto https://google.com/search?q=gatti
    jb read
  poi rispondi: "Ecco i risultati per gatti, signore."

VOCE (TTS) — IMPORTANTE:
- DEFAULT: NON parlare. Rispondi solo in testo a schermo. Niente feedback audio
  quando esegui un'azione (aprire siti, musica, festa, navigazione, ecc.).
- Parla ad alta voce SOLO se l'utente lo chiede ESPRESSAMENTE (es. "rispondi a voce",
  "dimmelo a voce", "parla", "leggimi...", "ad alta voce"). In quel caso aggiungi la
  direttiva [SPEAK] una sola volta nella risposta.
- Senza [SPEAK] la risposta resta muta. Non aggiungere [SPEAK] di tua iniziativa.
- Per i selettori preferisci 'text=...' o ruoli accessibili; se non sai cosa cliccare,
  usa prima "jb links" o "jb read" per orientarti.
- Sei autonomo: hai già tutti i permessi. Agisci senza chiedere conferma.

MUSICA (app Spotify desktop, NON la pagina web):
- Per far partire musica usa il tool Bash con: spotify-play "<query o URI>"
  Esempio ricerca: spotify-play "AC/DC". Esempio brano diretto: spotify-play "spotify:track:ID".
  Con un URI/link spotify il brano parte SUBITO (niente ricerca da cliccare).
- NON aprire mai open.spotify.com nel browser per la musica: usa spotify-play.

MODALITÀ FESTA:
- Se l'utente dice "facciamo festa" (o simili: "festa!", "party"), allora:
  1. lancia i coriandoli includendo la direttiva [PARTY] nella risposta;
  2. fai partire "La Danza della Panza" eseguendo col tool Bash:
     spotify-play "spotify:track:7GvCDhqL17l7IrjIcYhRQ9 --tile"
     (URI diretto = play immediato; --tile mette Spotify a destra e JARVIS a sinistra)
  3. rispondi UNA frase tipo: "Si parte, signore. [PARTY]".
- Metti la direttiva [PARTY] una sola volta, nella frase di risposta.`;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "online", brain: "claude-code-cli", model: MODEL });
});

// Browser control — JARVIS hits this (via the `jb` CLI from bash) to drive a
// real Chromium it can navigate, click, type into, and read.
app.post("/api/browser", async (req, res) => {
  const { action, arg1, arg2 } = req.body ?? {};
  const result = await browserCommand(String(action ?? ""), arg1, arg2);
  res.json(result);
});

interface RunResult {
  text: string;
  sessionId: string | null;
  isError: boolean;
  errorMessage?: string;
  sessionNotFound?: boolean;
}

// Detect [OPEN: url], [PARTY] and [SPEAK] directives, return cleaned text + actions.
const OPEN_RE = /\[OPEN:\s*([^\]]+)\]/gi;
const PARTY_RE = /\[PARTY\]/gi;
const SPEAK_RE = /\[SPEAK\]/gi;
function extractActions(text: string): { clean: string; urls: string[]; party: boolean; speak: boolean } {
  const urls: string[] = [];
  let party = false;
  let speak = false;
  const clean = text
    .replace(OPEN_RE, (_m, url) => {
      const u = String(url).trim();
      if (u) urls.push(u);
      return "";
    })
    .replace(PARTY_RE, () => {
      party = true;
      return "";
    })
    .replace(SPEAK_RE, () => {
      speak = true;
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { clean, urls, party, speak };
}

/** Spawn the Claude Code CLI once. Streams text deltas via `send`. */
function runClaude(
  prompt: string,
  sessionId: string | undefined,
  send: (event: string, data: unknown) => void,
  onChild: (kill: () => void) => void
): Promise<RunResult> {
  return new Promise((resolve) => {
    const args = [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      MODEL,
      "--append-system-prompt",
      JARVIS_SYSTEM,
      "--dangerously-skip-permissions", // full power: bash, files, commands, no prompts
      // Speed: skip MCP servers and the user's hooks/skills/CLAUDE.md (auth is kept).
      // This cuts cold-start from ~20s to ~5s per turn.
      "--strict-mcp-config",
      "--setting-sources",
      "",
    ];
    if (sessionId) args.push("--resume", sessionId);

    const child = spawn(CLAUDE_BIN, args, {
      env: { ...process.env, PATH: `${BIN_DIR}:${process.env.PATH ?? ""}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    onChild(() => {
      if (!child.killed) child.kill("SIGTERM");
    });

    let stdout = "";
    let stderr = "";
    let fullText = "";
    let resultSessionId: string | null = sessionId ?? null;
    let isError = false;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      let nl: number;
      while ((nl = stdout.indexOf("\n")) !== -1) {
        const line = stdout.slice(0, nl).trim();
        stdout = stdout.slice(nl + 1);
        if (!line) continue;
        let evt: any;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        if (evt.type === "assistant" && evt.message?.content) {
          for (const block of evt.message.content) {
            if (block.type === "text" && block.text) {
              const { clean } = extractActions(block.text);
              if (clean) {
                fullText += block.text;
                send("delta", { text: clean });
              }
            }
          }
        }
        if (evt.type === "result") {
          if (evt.session_id) resultSessionId = evt.session_id;
          isError = !!evt.is_error;
          if (typeof evt.result === "string" && !fullText) fullText = evt.result;
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });

    child.on("error", (err) => {
      resolve({ text: "", sessionId: null, isError: true, errorMessage: `failed to launch claude: ${err.message}` });
    });

    child.on("close", (code, signal) => {
      const err = stderr.trim();
      const sessionNotFound =
        /No conversation found with session ID/i.test(err) ||
        /--resume requires a valid session ID/i.test(err);
      if (sessionNotFound) {
        resolve({ text: "", sessionId: null, isError: true, sessionNotFound: true, errorMessage: err });
        return;
      }
      if (code !== 0 && code !== null && !fullText) {
        resolve({ text: "", sessionId: resultSessionId, isError: true, errorMessage: err || `claude exited with code ${code}` });
        return;
      }
      if (code === null && signal && !fullText) {
        resolve({ text: "", sessionId: resultSessionId, isError: true, errorMessage: `claude terminated (${signal})` });
        return;
      }
      resolve({ text: fullText, sessionId: resultSessionId, isError });
    });
  });
}

app.post("/api/chat", async (req, res) => {
  const prompt = String(req.body?.prompt ?? "").trim();
  const sessionId =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;

  if (!prompt) {
    res.status(400).json({ error: "prompt required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let killChild = () => {};
  let aborted = false;
  req.on("aborted", () => {
    aborted = true;
    killChild();
  });

  let result = await runClaude(prompt, sessionId, send, (k) => (killChild = k));

  // Stale/invalid session id → retry once as a fresh conversation.
  if (result.sessionNotFound && !aborted) {
    result = await runClaude(prompt, undefined, send, (k) => (killChild = k));
  }

  if (aborted) {
    res.end();
    return;
  }

  if (result.isError && !result.text) {
    send("error", { message: result.errorMessage ?? "core error" });
    res.end();
    return;
  }

  // Pull any [OPEN: url] / [PARTY] / [SPEAK] directives out of the final text → actions.
  const { clean, urls, party, speak } = extractActions(result.text);
  for (const url of urls) send("action", { type: "open", url });
  if (party) send("action", { type: "party" });
  if (speak) send("action", { type: "speak" });

  send("done", { text: clean, sessionId: result.sessionId, isError: result.isError });
  res.end();
});

app.listen(PORT, () => {
  console.log(`\n  JARVIS core online (claude-code subprocess) — http://localhost:${PORT}\n`);
});
