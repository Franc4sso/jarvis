interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (full: string, sessionId: string | null) => void;
  onError: (message: string) => void;
  onAction?: (action: { type: string; url?: string }) => void;
}

/**
 * Send one user prompt to the JARVIS core (Claude Code subprocess) and stream
 * the reply back over SSE. Pass the sessionId returned by the previous turn to
 * continue the same conversation.
 */
export async function streamChat(
  prompt: string,
  sessionId: string | null,
  cb: StreamCallbacks
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, sessionId }),
  });

  if (!res.ok || !res.body) {
    cb.onError(`core unreachable (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let event = "message";
      let data = "";
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        if (event === "delta") cb.onDelta(parsed.text ?? "");
        else if (event === "action") cb.onAction?.(parsed);
        else if (event === "done") cb.onDone(parsed.text ?? "", parsed.sessionId ?? null);
        else if (event === "error") cb.onError(parsed.message ?? "error");
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}
