// Brave run of the talk-triggers live check (spec 065 T032) on a worktree stack with
// DM_FAKE_SCRIPT=greyhollow-talk. Scene already started (start-scene.mjs, spec 053).
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<path in a node_modules holding playwright-core> \
//     node specs/065-talk-triggers/evidence/shoot-live.mjs <sessionId>
//
// Signs in, posts Odo's run-2 line through talk.mjs, then records the table and the debug page.
// Prints PASS/FAIL/INFO lines; never prints a secret. Shots: shots/<name>-<width>-<scheme>.png.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const sessionId = process.argv[2];
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  readFileSync(join(here, "../../../.env"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const port = env.APP_PORT ?? "3000";
const base = `http://localhost:${port}`;
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const VARIANTS = [[1280, 800, "light"], [1280, 800, "dark"], [390, 844, "light"], [390, 844, "dark"]];
const check = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const info = (s) => console.log(`INFO ${s}`);

async function shoot(page, name) {
  for (const [w, h, scheme] of VARIANTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(400);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    await page.screenshot({ path: join(out, `${name}-${w}-${scheme}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx.newPage();
  await a.goto(`${base}/`);
  await a.fill("#username", creds.username);
  await a.fill("#password", creds.password);
  await a.locator('form button[type="submit"]').first().click();
  await a.locator("#username").waitFor({ state: "detached", timeout: 15000 });
  const playUrl = `${base}/play/${sessionId}`;
  await a.goto(playUrl);
  await a.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 20000 });
  check(true, "scene-start narration arrived");
  await a.waitForTimeout(3000);

  const si = await fetch(`${base}/auth/sign-in`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  });
  const cookie = si.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const res = (() => { try { return execFileSync("node", [join(here, "talk.mjs"), port, sessionId], { encoding: "utf8", env: { ...process.env, STACKS_COOKIE: cookie } }); } catch (e) { return `TALK FAILED ${e.stdout}${e.stderr}`; } })();
  info(`talk.mjs: ${res.replace(/\n/g, " | ")}`);
  check(/DM narration: .*Wenna/.test(res), "talk.mjs saw Wenna's reply as ai:dm narration");
  await a.waitForTimeout(4000);
  await a.reload();
  await a.getByText(/Folk go missing at the ford/).first().waitFor({ timeout: 15000 });
  const text = await a.locator("body").innerText();
  writeFileSync(join(here, "table-text.txt"), text.slice(0, 20000));
  check(/Folk go missing at the ford/.test(text), "Wenna's reply is a narration row on the table");
  check(!/1d20|vs DC|→ \d+ = \d+/.test(text), "no dice line");
  check(/Free mode/i.test(text) && !/initiative|round \d/i.test(text) && (await a.getByRole("button", { name: /End turn|Roll initiative/i }).count()) === 0, "table still in free mode");
  await shoot(a, "table");

  await a.goto(`${playUrl}/debug`);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 15000 });
  const cards = await a.locator("[data-job-card]").allInnerTexts();
  info(`job cards: ${cards.length}`);
  for (let i = 0; i < cards.length; i++) {
    if (/turn/i.test(cards[i]) && !/scene-start/i.test(cards[i])) { await a.locator("[data-job-card]").nth(i).click().catch(() => {}); break; }
  }
  await a.waitForTimeout(1500);
  const dbg = await a.locator("body").innerText();
  writeFileSync(join(here, "debug-page.txt"), dbg.slice(0, 40000));
  // The debug page renders the turn card (trigger "talk", succeeded, shipped); the talk result
  // object itself comes from the debug jobs API the page reads. Check both.
  check(/turn\s+talk\s+succeeded\s+shipped/.test(dbg), "debug page shows the turn job with trigger talk, succeeded, shipped");
  const jobs = await (await ctx.request.get(`${base}/dm/sessions/${sessionId}/jobs`)).json();
  const talkJob = jobs.jobs.find((j) => j.input?.trigger === "talk");
  const t = talkJob?.result?.talk;
  writeFileSync(join(here, "talk-result.json"), JSON.stringify(t, null, 2));
  check(t?.outcome === "reply" && t.codeTriggers.some((x) => x.kind === "addressed" && x.actorId === "wenna"), "debug jobs API: talk result is reply with addressed: wenna");
  await shoot(a, "debug");
} finally {
  await browser.close();
}
