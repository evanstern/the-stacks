// Brave run of the plan-first-step live check (spec 064 T029) on a worktree stack with
// DM_FAKE_SCRIPT=greyhollow-plan-approach.
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<path inside a dir whose node_modules holds playwright-core>
//     node specs/064-plan-first-step/evidence/shoot-live.mjs
//
// Creds file (untracked, outside the repo): {"username","password" (operator, also at "operator"),
// "player": {"username","displayName","password"}}. Prints one PASS/FAIL/INFO line per check;
// never prints a password or token. Shots: shots/<name>-<width>-<scheme>.png.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });
const env = Object.fromEntries(
  readFileSync(join(here, "../../../.env"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = `http://localhost:${env.APP_PORT ?? "3000"}`;
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
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await a.goto(`${base}/`);
  await a.fill("#username", creds.operator.username);
  await a.fill("#password", creds.operator.password);
  await a.locator('form button[type="submit"]').first().click();
  await a.locator("#username").waitFor({ state: "detached", timeout: 15000 });
  await a.goto(`${base}/settings`);
  await a.getByRole("button", { name: "Create invitation" }).click();
  const tokenInput = a.getByLabel("Invitation token");
  await tokenInput.waitFor({ timeout: 10000 });
  const token = await tokenInput.inputValue();
  await b.goto(`${base}/`);
  await b.getByRole("button", { name: "Have an invitation?" }).click();
  await b.locator("#invite-token").waitFor({ timeout: 10000 });
  await b.fill("#invite-token", token);
  await b.fill("#invite-username", creds.player.username);
  await b.fill("#invite-display-name", creds.player.displayName);
  await b.fill("#invite-password", creds.player.password);
  await b.getByRole("button", { name: "Create account" }).click();
  await b.locator("#invite-token").waitFor({ state: "detached", timeout: 15000 });
  check(true, "setup player redeemed an invitation");

  await a.goto(`${base}/play`);
  await a.getByRole("button", { name: "Start a new table" }).click();
  await a.waitForURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const playUrl = a.url();
  const sessionId = playUrl.split("/").pop();
  info(`session ${sessionId}`);
  await b.goto(playUrl);
  await a.getByText(creds.player.displayName).first().waitFor({ timeout: 15000 });

  await a.getByRole("button", { name: "Start scene" }).click();
  await a.locator("#start-seed").waitFor({ timeout: 15000 });
  await a.locator("#start-seed").selectOption("greyhollow-ford-duo");
  const seats = a.locator('select[id^="start-seat-"]');
  const labels = await seats.first().locator("option").allInnerTexts();
  const opLabel = labels.find((t) => t !== "Choose a player" && !t.includes(creds.player.displayName));
  const plLabel = labels.find((t) => t.includes(creds.player.displayName));
  await seats.nth(0).selectOption({ label: opLabel });
  await seats.nth(1).selectOption({ label: plLabel });
  await a.getByRole("button", { name: "Start", exact: true }).click();
  await a.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 20000 });
  check(true, "step scene start: opening narration arrived");
  await a.waitForTimeout(3000);
  const beforeText = await a.locator("body").innerText();

  // Declare and commit Tamsin's plan (operator holds Tamsin; seat 0).
  const dec = (() => { try { return execFileSync("node", [join(here, "declare.mjs"), process.env.STACKS_SHOOT_CREDS, sessionId], { encoding: "utf8" }); } catch (e) { return `DECLARE FAILED ${e.stdout}${e.stderr}`; } })();
  info(`declare: ${dec.replace(/\n/g, " | ")}`);
  check(/committed act-197dae73/.test(dec), "declare.mjs declared and committed act-197dae73");
  await a.waitForTimeout(12000);
  const text = await a.locator("body").innerText();
  writeFileSync(join(here, "table-text.txt"), text.slice(0, 20000));
  const dice = text.match(/unseen: 1d20 → \d+ = \d+ vs DC \d+: \w+/g) ?? [];
  info(`stealth dice lines: ${dice.map((l) => l.trim()).join(" || ")}`);
  check(dice.length === 2, `two stealth dice lines appear (found ${dice.length})`);
  info(`mode indicators: ${(text.match(/free|encounter|turn mode|initiative|round \d+/gi) ?? []).join(",")}`);
  check(!/initiative|round \d/i.test(text) && (await a.getByRole("button", { name: /End turn|Roll initiative/i }).count()) === 0, "no encounter opens (no initiative/round UI)");
  info(`new text after declare: ${text.replace(beforeText, "").replace(/\s+/g, " ").slice(0, 900)}`);
  await shoot(a, "table-operator");
  await shoot(b, "table-player");

  await a.goto(`${playUrl}/debug`);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 15000 });
  const cards = await a.locator("[data-job-card]").allInnerTexts();
  info(`job cards: ${cards.length}`);
  // click the turn job so its detail renders
  for (let i = 0; i < cards.length; i++) {
    if (/turn/i.test(cards[i]) && !/scene-start/i.test(cards[i])) { await a.locator("[data-job-card]").nth(i).click().catch(() => {}); break; }
  }
  await a.waitForTimeout(1500);
  const dbg = await a.locator("body").innerText();
  writeFileSync(join(here, "debug-page.txt"), dbg.slice(0, 40000));
  const held = dbg.match(/"reason": "held: [^"]*",\s*"decision": "\w+"/g) ?? [];
  info(`debug held overrides: ${held.map((l) => l.replace(/\s+/g, " ")).join(" || ")}`);
  check(held.some((h) => /"turn"/.test(h)) && held.some((h) => /"tracker"/.test(h)), "debug page shows held turn and tracker overrides");
  await shoot(a, "debug");
} finally {
  await browser.close();
}
