import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useJarvis } from "../state/store";

/**
 * Futuristic HUD-framed browser embedded inside JARVIS. When a site refuses to
 * be iframed (X-Frame-Options / CSP frame-ancestors), the load never fires and
 * we surface a "non incorporabile" panel with an "open in a new tab" button.
 */
/**
 * Rewrite a normal YouTube watch / youtu.be / shorts URL into the embeddable
 * /embed/ form (the only YouTube URL that isn't blocked by X-Frame-Options).
 * Any non-YouTube URL is returned unchanged.
 */
function toEmbeddable(raw: string): string {
  try {
    const u = new URL(raw);
    const h = u.hostname.replace(/^www\./, "");
    let id = "";
    if (h === "youtu.be") {
      id = u.pathname.slice(1);
    } else if (h.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || "";
      else if (u.pathname.startsWith("/embed/")) return raw; // already embeddable
    }
    if (id) {
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      const start = t ? `&start=${parseInt(t, 10) || 0}` : "";
      return `https://www.youtube.com/embed/${id}?autoplay=1${start}`;
    }
  } catch {
    /* not a parseable URL — leave as-is */
  }
  return raw;
}

export function SiteFrame() {
  const rawUrl = useJarvis((s) => s.embedUrl);
  const setEmbedUrl = useJarvis((s) => s.setEmbedUrl);
  const embedUrl = rawUrl ? toEmbeddable(rawUrl) : null;

  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const host = (() => {
    try {
      return embedUrl ? new URL(embedUrl).host : "";
    } catch {
      return embedUrl ?? "";
    }
  })();
  const isYouTube = /(^|\.)youtube\.com$/.test(host) || host === "youtube-nocookie.com";

  // YouTube validates the embedder via ?origin=. Missing/invalid origin is a
  // common cause of embed player error 153. Append our real origin.
  const finalUrl = (() => {
    if (!embedUrl) return null;
    if (!isYouTube) return embedUrl;
    try {
      const u = new URL(embedUrl);
      if (!u.searchParams.has("origin")) u.searchParams.set("origin", window.location.origin);
      return u.toString();
    } catch {
      return embedUrl;
    }
  })();

  // On each (re)load: reset state and start a watchdog. If onLoad hasn't fired
  // within the window, assume the site blocked embedding.
  useEffect(() => {
    if (!embedUrl) return;
    setLoaded(false);
    setBlocked(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setBlocked(true), 4000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [embedUrl, reloadKey]);

  const close = () => setEmbedUrl(null);
  const openTab = () => {
    // open the original URL (the watch page reads nicer than the embed one)
    if (rawUrl) window.open(rawUrl, "_blank", "noopener");
  };

  return (
    <AnimatePresence>
      {embedUrl && (
        <motion.div
          className="siteframe-wrap"
          initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.95, filter: "blur(8px)" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* animated corner brackets */}
          <span className="sf-corner sf-tl" />
          <span className="sf-corner sf-tr" />
          <span className="sf-corner sf-bl" />
          <span className="sf-corner sf-br" />
          <span className="sf-scan" />

          {/* top control bar */}
          <div className="sf-bar">
            <div className="sf-dot-row">
              <span className="sf-dot" />
              <span className="sf-dot" />
              <span className="sf-dot" />
            </div>
            <div className="sf-url">
              <span className="sf-lock">⌁</span>
              <span className="sf-host">{host}</span>
            </div>
            <div className="sf-actions">
              <button className="sf-btn" title="Ricarica" onClick={() => setReloadKey((k) => k + 1)}>
                ⟳
              </button>
              <button className="sf-btn" title="Apri in scheda" onClick={openTab}>
                ↗
              </button>
              <button className="sf-btn sf-close" title="Chiudi" onClick={close}>
                ✕
              </button>
            </div>
          </div>

          {/* viewport */}
          <div className="sf-view">
            {!loaded && !blocked && (
              <div className="sf-loading">
                <div className="sf-spinner" />
                <span>CONNESSIONE A {host.toUpperCase()}…</span>
              </div>
            )}

            {blocked ? (
              <div className="sf-blocked">
                <div className="sf-blocked-icon">⚠</div>
                <h3>SITO NON INCORPORABILE</h3>
                <p>
                  <b>{host}</b> rifiuta di essere visualizzato qui dentro
                  (protezione X-Frame / CSP).
                </p>
                <button className="sf-open-tab" onClick={openTab}>
                  APRI IN UNA NUOVA SCHEDA ↗
                </button>
              </div>
            ) : isYouTube ? (
              // YouTube's embed player needs a valid referrer/origin and its own
              // scripts — a tight sandbox + no-referrer triggers player error 153.
              // Render a clean, trusted iframe (no sandbox) with the right perms.
              <iframe
                key={reloadKey}
                src={finalUrl ?? embedUrl}
                title={host}
                className="sf-iframe"
                onLoad={() => {
                  setLoaded(true);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                }}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope; clipboard-write"
                allowFullScreen
              />
            ) : (
              <iframe
                key={reloadKey}
                src={embedUrl}
                title={host}
                className="sf-iframe"
                onLoad={() => {
                  setLoaded(true);
                  if (timerRef.current) window.clearTimeout(timerRef.current);
                }}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
