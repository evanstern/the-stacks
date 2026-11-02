// Spec 072 D9: Brave evidence for the Party slide-out. Node built-ins only.
// Usage: node specs/072-party-slideout/evidence/shoot.mjs .handoff/072-operator.json
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const here = new URL(".", import.meta.url).pathname;
const env = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
const appPort = env.match(/^APP_PORT=(\d+)/m)[1];
const base = `http://localhost:${appPort}`;
const { username, password } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const THROUGH = 21; // last seq before the encounter.ended batch (seq 22)
const ANA = "00000000-0000-4000-8000-000000000001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
const check = (ok, name, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` ${extra}` : ""}`);
  if (!ok) failed = true;
};

const signIn = await fetch(`${base}/auth/sign-in`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
const session = /session=([^;]+)/.exec(signIn.headers.get("set-cookie") ?? "")?.[1];
check(signIn.ok && !!session, "sign-in");
if (!session) process.exit(1);

const port = await new Promise((res) => {
  const s = createServer().listen(0, () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
const profile = mkdtempSync(join(tmpdir(), "brave-072-"));
const brave = spawn(BRAVE, [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const cleanup = async () => {
  const exited = new Promise((r) => brave.once("exit", r));
  brave.kill();
  await Promise.race([exited, sleep(5000)]);
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
};

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      if (!targets.find((t) => t.type === "page")) targets = undefined;
    } catch { await sleep(200); }
  }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const n = ++id;
    pending.set(n, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return r.result.value;
  };
  const waitFor = async (expr, ms = 15000) => {
    for (let t = 0; t < ms; t += 200) { if (await ev(expr)) return true; await sleep(200); }
    return false;
  };

  await send("Page.enable");
  await send("Network.enable");
  for (const [width, height, mobile] of [[1280, 800, false], [390, 844, true]]) {
    for (const theme of ["light", "dark"]) {
      const tag = `${width}-${theme}`;
      await send("Network.setCookie", { name: "session", value: session, url: base });
      await send("Network.setCookie", { name: "stacks-theme", value: theme, url: base });
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
      await send("Page.navigate", { url: `${base}/play/fixtures/turn-mode-combat?as=${ANA}&through=${THROUGH}` });
      const ready = await waitFor(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Party')`);
      check(ready, `${tag} party trigger present`);
      await ev(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Party').click()`);
      check(await waitFor(`!!document.querySelector('#party-panel')`), `${tag} panel open`);
      await sleep(600); // slide-out transition
      const d = await ev(`(() => { const p=document.querySelector('#party-panel'); const t=p?p.textContent:'';
        return { init: !!document.querySelector('[aria-label="Initiative"]'),
          active: !!document.querySelector('[aria-label="Initiative"] [aria-current="step"]'),
          mine: t.includes('Your character'), ai: t.includes('AI companion'),
          dialogs: document.querySelectorAll('dialog, [role="dialog"][aria-modal="true"]').length,
          sh: document.scrollingElement.scrollHeight, ih: innerHeight,
          theme: document.documentElement.className }; })()`);
      check(d.init && d.active, `${tag} initiative order with active turn`);
      check(d.mine, `${tag} "Your character" badge`);
      check(d.ai, `${tag} "AI companion" label`);
      check(d.dialogs === 0, `${tag} no dialog/aria-modal`, `(count ${d.dialogs})`);
      check(d.sh <= d.ih, `${tag} no page scroll`, `(scrollHeight ${d.sh} <= innerHeight ${d.ih})`);
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(here, "shots", `party-${tag}.png`), Buffer.from(shot.data, "base64"));
    }
  }
  ws.close();
} finally {
  await cleanup();
}
process.exit(failed ? 1 : 0);
