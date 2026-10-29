// Brave live check of the Start scene state (spec 059 tasks T025 and T026).
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/059-start-scene-queued/evidence/shoot-live.mjs <part>
//
// <part> is one of:
//   pending  T025: a human DM is seated; the header shows the pending note, a second start is 409,
//            carrying out the suggestion shows the scene.
//   dismiss  T025: a human DM dismisses the suggestion; "Start scene" comes back.
//   ai       T026: an AI-DM start from the slide-out shows the queued note, then the scene.
//            In script mode the job ends within about a second, so `ai` shoots one variant per run,
//            the instant the note appears: STACKS_VARIANT=<width>-<scheme> (default 1280-light).
// Recreate the app container before each part: each scene start spends the script's first three calls.
// Creds file (untracked, outside the repo): {"operator": {"username","password"}, "player": {"username","password","userId"}}
// It prints one PASS/FAIL line per check. It never prints a password or a token.
// Shots: shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const part = process.argv[2];
const creds = JSON.parse(readFileSync(process.env.STACKS_SHOOT_CREDS, "utf8"));
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
const PENDING = "Scene start waiting for the DM.";
const QUEUED = "Scene start queued.";
const check = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);

async function shoot(page, name, variants = VARIANTS) {
  for (const [w, h, scheme] of variants) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(300);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    await page.screenshot({ path: join(out, `${name}-${w}-${scheme}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

async function signIn(page, who) {
  await page.goto(`${base}/`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.locator('form button[type="submit"]').first().click();
  await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
}

const startButtons = (page) => page.getByRole("button", { name: "Start scene" }).count();
const startHumanDm = () => {
  const started = execFileSync("node", [join(here, "../../055-human-dm-scene-change/evidence/start-human-dm.mjs"), process.env.STACKS_SHOOT_CREDS], { encoding: "utf8" });
  return started.match(/sessionId (\S+)/)[1];
};

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  const [vw, vs] = (process.env.STACKS_VARIANT ?? "1280-light").split("-");
  const variant = VARIANTS.find(([w, , s]) => String(w) === vw && s === vs);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx.newPage();
  await signIn(a, creds.operator);

  if (part === "pending") {
    const sessionId = startHumanDm();
    console.log(`session ${sessionId}`);
    const playUrl = `${base}/play/${sessionId}`;
    await a.goto(playUrl);
    await a.getByText(PENDING).first().waitFor({ timeout: 20000 });
    check((await startButtons(a)) === 0, `pending: no Start scene button`);
    check(await a.getByRole("status").filter({ hasText: PENDING }).first().isVisible(), `pending: status note "${PENDING}"`);
    await shoot(a, "header-pending");
    await a.reload();
    await a.getByText(PENDING).first().waitFor({ timeout: 20000 });
    check((await startButtons(a)) === 0, "pending after reload: no Start scene button, note shown");
    const second = await ctx.request.post(`${base}/dm/sessions/${sessionId}/start`, {
      data: { seedId: "greyhollow-ford", seats: { tamsin: creds.player.userId } },
    });
    const body = await second.text();
    check(second.status() === 409 && body.includes("A scene start is waiting for the DM."), `second start: HTTP ${second.status()} ${body.slice(0, 120)}`);
    const state = await (await ctx.request.get(`${base}/dm/sessions/${sessionId}/start`)).json();
    check(state.state === "pending", `GET start before Apply: ${JSON.stringify(state)}`);
    await a.getByRole("button", { name: "Change scene" }).click();
    await a.locator("#scene-id").waitFor({ timeout: 15000 });
    await a.getByRole("button", { name: "Apply", exact: true }).click();
    await a.getByText("The Bell at Greyhollow Ford").first().waitFor({ timeout: 15000 });
    await a.waitForTimeout(1500);
    check((await a.getByText(PENDING).count()) === 0 && (await startButtons(a)) === 0, "after Apply: header shows the scene, no note, no button");
    const after = await (await ctx.request.get(`${base}/dm/sessions/${sessionId}/start`)).json();
    check(after.state === "started", `GET start after Apply: ${JSON.stringify(after)}`);
    await shoot(a, "header-started", [[1280, 800, "light"]]);
  } else if (part === "dismiss") {
    const sessionId = startHumanDm();
    console.log(`session ${sessionId}`);
    await a.goto(`${base}/play/${sessionId}`);
    await a.getByText(PENDING).first().waitFor({ timeout: 20000 });
    check((await startButtons(a)) === 0, "dismiss: pending note shown before Dismiss");
    await a.getByRole("button", { name: /Pending proposals/ }).click();
    const card = a.locator("section, article, li, div").filter({ hasText: "scene · from DM" }).filter({ has: a.getByRole("button", { name: "Dismiss" }) }).last();
    await card.waitFor({ timeout: 15000 });
    await card.getByRole("button", { name: "Dismiss" }).first().click();
    const t0 = Date.now();
    await a.getByRole("button", { name: "Close" }).last().click();
    await a.getByRole("button", { name: "Start scene" }).first().waitFor({ timeout: 10000 });
    const ms = Date.now() - t0;
    check(ms <= 5500, `dismiss: Start scene back after ${ms} ms (expect within 5 s)`);
    check((await a.getByText(PENDING).count()) === 0, "dismiss: pending note gone");
    const state = await (await ctx.request.get(`${base}/dm/sessions/${sessionId}/start`)).json();
    check(state.state === "none", `GET start after Dismiss: ${JSON.stringify(state)}`);
    await shoot(a, "header-dismissed", [[1280, 800, "light"]]);
  } else if (part === "ai") {
    await a.goto(`${base}/play`);
    await a.getByRole("button", { name: "Start a new table" }).click();
    await a.waitForURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 15000 });
    const sessionId = a.url().split("/").pop();
    console.log(`session ${sessionId}`);
    await a.getByRole("button", { name: "Start scene" }).click();
    await a.locator("#start-seed").waitFor({ timeout: 15000 });
    await a.locator("#start-seed").selectOption("greyhollow-ford");
    const seat = a.locator('select[id^="start-seat-"]').first();
    const labels = await seat.locator("option").allInnerTexts();
    // Seat options come from presence: only the operator is at this table.
    await seat.selectOption({ label: labels.find((t) => t !== "Choose a player") });
    // Set the variant before Start: the queued window is too short to switch it afterwards.
    await a.setViewportSize({ width: variant[0], height: variant[1] });
    await a.emulateMedia({ colorScheme: variant[2] });
    await a.evaluate((s) => document.documentElement.setAttribute("data-theme", s), variant[2]);
    await a.getByRole("button", { name: "Start", exact: true }).click();
    const sawQueued = await a.getByText(QUEUED).first().waitFor({ timeout: 3000 }).then(() => true, () => false);
    if (sawQueued) await a.screenshot({ path: join(out, `header-queued-${variant[0]}-${variant[2]}.png`) });
    // The job can commit the scene mid-capture. This read races the job too, so it is info only:
    // inspect the shot, and rerun the variant if it shows the scene title.
    const after = (await a.getByText(QUEUED).count()) > 0;
    check(sawQueued, `ai: status note "${QUEUED}" right after the 202 (${variant[0]}-${variant[2]})`);
    console.log(`info: note still shown after the shot: ${after} (inspect header-queued-${variant[0]}-${variant[2]}.png)`);
    check((await startButtons(a)) === 0, "ai: no Start scene button right after the 202");
    check((await a.locator("dialog[open],[aria-modal=true]").count()) === 0, "ai: no modal");
    await a.getByText("The Bell at Greyhollow Ford").first().waitFor({ timeout: 20000 });
    await a.waitForTimeout(1500);
    check((await a.getByText(QUEUED).count()) === 0 && (await startButtons(a)) === 0, "ai: then the scene title, no note, no button");
    if (variant[0] === 1280 && variant[2] === "light") await shoot(a, "header-ai-started", [[1280, 800, "light"]]);
  } else {
    throw new Error(`unknown part: ${part}`);
  }
  await ctx.close();
} finally {
  await browser.close();
}
