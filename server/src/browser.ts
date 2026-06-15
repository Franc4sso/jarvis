import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;
let page: Page | null = null;

async function ensure(): Promise<Page> {
  if (browser && page && !page.isClosed()) return page;

  // Visible (headed) window — WSLg provides the display. Prefer the REAL Google
  // Chrome (channel "chrome"); fall back to the bundled Chromium if it isn't
  // installed. JARVIS_HEADLESS=1 forces invisible (headless servers).
  const wantHeadless = process.env.JARVIS_HEADLESS === "1";
  const args = [
    "--start-maximized",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    // Let video/audio play without a user gesture (YouTube autoplay with sound).
    "--autoplay-policy=no-user-gesture-required",
  ];

  try {
    // real Google Chrome
    browser = await chromium.launch({ channel: "chrome", headless: wantHeadless, args });
  } catch {
    try {
      // bundled Chromium (still Chrome engine), headed
      browser = await chromium.launch({ headless: wantHeadless, args });
    } catch {
      // last resort: headless
      browser = await chromium.launch({ headless: true, args });
    }
  }
  const ctx = await browser.newContext({ viewport: null });
  page = await ctx.newPage();
  browser.on("disconnected", () => {
    browser = null;
    page = null;
  });
  return page;
}

export interface BrowserResult {
  ok: boolean;
  url?: string;
  title?: string;
  text?: string;
  error?: string;
}

/**
 * Execute one browser command. Designed to be called by JARVIS (via the
 * /api/browser endpoint hit from a bash CLI). The page persists across calls.
 */
export async function browserCommand(
  action: string,
  arg1?: string,
  arg2?: string
): Promise<BrowserResult> {
  try {
    const p = await ensure();
    switch (action) {
      case "goto": {
        if (!arg1) return { ok: false, error: "goto needs a url" };
        const url = /^https?:\/\//.test(arg1) ? arg1 : `https://${arg1}`;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        return { ok: true, url: p.url(), title: await p.title() };
      }
      case "click": {
        if (!arg1) return { ok: false, error: "click needs a selector" };
        await p.click(arg1, { timeout: 10000 });
        await p.waitForLoadState("domcontentloaded").catch(() => {});
        return { ok: true, url: p.url(), title: await p.title() };
      }
      case "type": {
        if (!arg1) return { ok: false, error: "type needs a selector and text" };
        await p.fill(arg1, arg2 ?? "", { timeout: 10000 });
        return { ok: true };
      }
      case "press": {
        // press a key, optionally in a selector (e.g. Enter to submit)
        if (arg2) await p.press(arg1!, arg2);
        else await p.keyboard.press(arg1 ?? "Enter");
        await p.waitForLoadState("domcontentloaded").catch(() => {});
        return { ok: true, url: p.url(), title: await p.title() };
      }
      case "read": {
        // Visible text of the page (or a selector), trimmed for the model.
        const raw = arg1
          ? await p.locator(arg1).first().innerText({ timeout: 10000 })
          : await p.evaluate(() => document.body?.innerText ?? "");
        const text = raw.replace(/\n{3,}/g, "\n\n").trim().slice(0, 6000);
        return { ok: true, url: p.url(), title: await p.title(), text };
      }
      case "links": {
        // List clickable link texts + hrefs (top 40) to help the model navigate.
        const links = await p.evaluate(() => {
          const out: string[] = [];
          document.querySelectorAll("a[href]").forEach((a) => {
            const t = (a.textContent ?? "").trim().replace(/\s+/g, " ");
            const h = (a as HTMLAnchorElement).href;
            if (t && h) out.push(`${t} -> ${h}`);
          });
          return out.slice(0, 40);
        });
        return { ok: true, text: links.join("\n") };
      }
      case "scroll": {
        const dir = (arg1 ?? "down").toLowerCase();
        await p.evaluate((d) => {
          window.scrollBy(0, d === "up" ? -window.innerHeight : window.innerHeight);
        }, dir);
        return { ok: true };
      }
      case "back": {
        await p.goBack({ waitUntil: "domcontentloaded" }).catch(() => {});
        return { ok: true, url: p.url(), title: await p.title() };
      }
      case "state": {
        return { ok: true, url: p.url(), title: await p.title() };
      }
      case "close": {
        await browser?.close().catch(() => {});
        browser = null;
        page = null;
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown action: ${action}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
