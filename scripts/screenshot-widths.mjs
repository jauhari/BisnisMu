/**
 * Screenshot halaman produksi/lokal pada lebar HP memakai Chrome headless
 * dengan cookie sesi yang disuntikkan lewat header CDP via file profil.
 *
 * Pemakaian:
 *   node scripts/screenshot-widths.mjs <url> <token> <lebar,lebar,...> [port]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const [url, token, widthsArg, portArg] = process.argv.slice(2);
const widths = (widthsArg || "390").split(",").map(Number);
const port = Number(portArg || 9222);
const outDir = "/tmp/shot";
mkdirSync(outDir, { recursive: true });

const profile = `/tmp/chrome-cdp-${port}`;
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore", detached: true },
);

async function waitForDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch {
      /* belum siap */
    }
    await delay(250);
  }
  throw new Error("DevTools tidak siap");
}

async function newTarget() {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  return res.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;
    ws.addEventListener("open", () =>
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((res, rej) => pending.set(messageId, { res, rej }));
        },
        close: () => ws.close(),
      }),
    );
    ws.addEventListener("error", reject);
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message));
        else res(msg.result);
      }
    });
  });
}

let cdp;
try {
  await waitForDevtools();
  const target = await newTarget();
  cdp = await connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  // Suntikkan cookie sesi untuk origin target.
  const origin = new URL(url).origin;
  await cdp.send("Network.setCookie", { name: "better-auth.session_token", value: token, domain: new URL(url).hostname, path: "/", secure: url.startsWith("https") });

  for (const width of widths) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: 1200, deviceScaleFactor: 2, mobile: width < 768 });
    await cdp.send("Page.navigate", { url });
    await delay(6000);
    const metrics = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const row = document.querySelector('li.coa-row');
        const de = document.documentElement;
        return JSON.stringify({
          viewport: window.innerWidth,
          rowCols: row ? getComputedStyle(row).gridTemplateColumns.split(' ').length : null, headSpans: document.querySelectorAll('.coa-head > span').length,
          rowH: row ? Math.round(row.getBoundingClientRect().height) : null,
          overflow: de.scrollWidth > de.clientWidth + 1,
          sw: de.scrollWidth, cw: de.clientWidth
        });
      })()`,
      returnByValue: true,
    });
    const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 80, captureBeyondViewport: true });
    const file = `${outDir}/${width}.jpg`;
    writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log(`${width}px  ${metrics.result.value}  -> ${file}`);
  }
} finally {
  cdp?.close();
  try {
    process.kill(-chrome.pid);
  } catch {
    /* sudah mati */
  }
}
