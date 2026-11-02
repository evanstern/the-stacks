// Brave run of the Table landing list on a worktree stack (spec 069 Phase 3, plan.md "Quickstart" steps 2-6).
//
//   PLAYWRIGHT_CORE=<a package.json path inside a playwright-core install>
//     node specs/069-table-landing-list/evidence/shoot.mjs <creds-file>
//
// <creds-file> is untracked and outside the repo: {"operator": {"username","password"}}. The operator
// account exists on the stack, and the stack runs with DM_FAKE_SCRIPT=greyhollow-live. The script
// invites and redeems player2 (password generated, written back to <creds-file>), starts table A
// (greyhollow-ford-duo: operator + player2) and table B (greyhollow-ford: operator only) over HTTP,
// then checks the landing for both accounts. It prints one PASS/FAIL line per check and never prints
// a password or a token. Shots: shots/landing-<account>-<width>-<scheme>.png.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [credsPath] = process.argv.slice(2);
if (!credsPath) {
  console.error("usage: shoot.mjs <creds-file>");
  process.exit(2);
}
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
creds.player2 = { username: "player2", displayName: "Player Two", password: randomBytes(18).toString("base64url") };
writeFileSync(credsPath, JSON.stringify(creds), { mode: 0o600 });

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  readFileSync(join(here, "../../../.env"), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = `http://localhost:${env.APP_PORT ?? "3000"}`;
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const VARIANTS = [
  [1280, 800, "light"],
  [1280, 800, "dark"],
  [390, 844, "light"],
  [390, 844, "dark"],
];
const check = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name) {
  for (const [w, h, scheme] of VARIANTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(400);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    await page.screenshot({ path: join(out, `landing-${name}-${w}-${scheme}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: true, timeout: 30000 });
try {
  const [ctxA, ctxB] = await Promise.all([browser.newContext({ viewport: { width: 1280, height: 800 } }), browser.newContext({ viewport: { width: 1280, height: 800 } })]);
  const [a, b] = await Promise.all([ctxA.newPage(), ctxB.newPage()]);

  // Operator signs in through the UI.
  await a.goto(`${base}/`);
  await a.fill("#username", creds.operator.username);
  await a.fill("#password", creds.operator.password);
  await a.locator('form button[type="submit"]').first().click();
  await a.locator("#username").waitFor({ state: "detached", timeout: 15000 });

  // Step 2: invite player2 over HTTP, redeem in the second context through the UI.
  const inv = await ctxA.request.post(`${base}/auth/invitations`, { data: {} });
  const { token } = await inv.json();
  await b.goto(`${base}/`);
  await b.getByRole("button", { name: "Have an invitation?" }).click();
  await b.locator("#invite-token").waitFor({ timeout: 10000 });
  await b.fill("#invite-token", token);
  await b.fill("#invite-username", creds.player2.username);
  await b.fill("#invite-display-name", creds.player2.displayName);
  await b.fill("#invite-password", creds.player2.password);
  await b.getByRole("button", { name: "Create account" }).click();
  await b.locator("#invite-token").waitFor({ state: "detached", timeout: 15000 });
  const me = async (cx) => (await (await cx.request.get(`${base}/auth/me`)).json()).user;
  const [uA, uB] = await Promise.all([me(ctxA), me(ctxB)]);
  check(uB?.username !== undefined || uB?.role === "player", "step 2 player2 redeemed and signed in");

  // Step 3: table A (duo: operator + player2), then table B (operator only).
  const start = async (seedId, seats) => {
    const id = randomUUID();
    const r = await ctxA.request.post(`${base}/dm/sessions/${id}/start`, { data: { seedId, seats } });
    if (r.status() !== 202) throw new Error(`start ${seedId}: HTTP ${r.status()}`);
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const jobs = (await (await ctxA.request.get(`${base}/dm/sessions/${id}/jobs?limit=100`)).json()).jobs ?? [];
      const turn = jobs.find((j) => j.kind === "turn");
      if (turn && turn.status !== "queued" && turn.status !== "running") {
        if (!jobs.some((j) => j.status === "queued" || j.status === "running")) break;
      }
    }
    return id;
  };
  const tableA = await start("greyhollow-ford-duo", { tamsin: uA.id, kestrel: uB.id });
  await sleep(1500);
  const tableB = await start("greyhollow-ford", { tamsin: uA.id });
  await sleep(1500);
  console.log(`tables A=${tableA} B=${tableB}`);

  // Step 4: the lists, through the API in each context.
  const list = async (cx) => (await (await cx.request.get(`${base}/api/tables`)).json()).tables;
  const opList = await list(ctxA);
  const opIds = opList.map((t) => t.sessionId);
  const ia = opIds.indexOf(tableA);
  const ib = opIds.indexOf(tableB);
  check(ia >= 0 && ib >= 0 && ib < ia, `step 4 operator lists B before A (newest first): B@${ib} A@${ia}`);
  check(opList.every((t) => t.title), "step 4 operator rows carry scene titles");
  const p2List = await list(ctxB);
  check(p2List.length === 1 && p2List[0].sessionId === tableA && p2List[0].relation === "player", `step 4 player2 lists A only, marked player (${p2List.length} rows)`);
  check(!p2List.some((t) => t.sessionId === tableB), "step 4 player2 never lists B");
  const anon = await fetch(`${base}/api/tables`);
  check(anon.status === 401, `step 4 GET /api/tables with no cookie is ${anon.status}`);

  // Step 4-5: the landing renders it; an entry navigates.
  await a.goto(`${base}/play`);
  await a.getByRole("heading", { name: "Your tables" }).waitFor({ timeout: 15000 });
  const links = await a.locator('a[href^="/play/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  check(links.indexOf(`/play/${tableB}`) >= 0 && links.indexOf(`/play/${tableB}`) < links.indexOf(`/play/${tableA}`), "step 4 operator landing links B then A");
  await b.goto(`${base}/play`);
  await b.getByRole("heading", { name: "Your tables" }).waitFor({ timeout: 15000 });
  const bl = await b.locator('a[href^="/play/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  check(bl.includes(`/play/${tableA}`) && !bl.includes(`/play/${tableB}`), "step 4 player2 landing links A and not B");

  await shoot(a, "operator");
  await shoot(b, "player2");

  await b.locator(`a[href="/play/${tableA}"]`).click();
  await b.waitForURL(new RegExp(`/play/${tableA}$`), { timeout: 15000 });
  check(true, "step 5 entry navigates to /play/<sessionId>");
} finally {
  await browser.close();
}
