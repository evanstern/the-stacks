// Brave run of the human-DM Table mode controls on a worktree stack (spec 060 Phase 4, quickstart steps 4-12).
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/060-human-dm-encounter-mode/evidence/shoot-live.mjs
//
// Creds file (untracked, outside the repo): {"operator": {"username","password"}, "player": {"username","password","userId"}}
// Both accounts already exist on the stack, which runs DM_FAKE_SCRIPT=greyhollow-human-dm.
// The script runs start-human-dm.mjs (spec 055) for a fresh session, carries out the scene suggestion,
// approves the scene-start suggestions, runs start-encounter.mjs, then drives the Table mode slide-out.
// It prints one PASS/FAIL line per check. It never prints a password or a token.
// Shots: shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const credsPath = process.env.STACKS_SHOOT_CREDS;
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
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

async function shoot(page, name, variants = VARIANTS) {
  for (const [w, h, scheme] of variants) {
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

async function signIn(page, who) {
  await page.goto(`${base}/`);
  await page.fill("#username", who.username);
  await page.fill("#password", who.password);
  await page.locator('form button[type="submit"]').first().click();
  await page.locator("#username").waitFor({ state: "detached", timeout: 15000 });
}

const started = execFileSync("node", [join(here, "../../055-human-dm-scene-change/evidence/start-human-dm.mjs"), credsPath], { encoding: "utf8" });
const sessionId = started.match(/sessionId (\S+)/)[1];
console.log(`session ${sessionId}`);
const playUrl = `${base}/play/${sessionId}`;

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctxA.newPage();
  await signIn(a, creds.operator);
  const api = async (path) => (await ctxA.request.get(`${base}/dm/sessions/${sessionId}${path}`)).json();
  const tableMode = () => a.getByRole("button", { name: "Table mode" }).first();
  const turnOrder = () => a.getByRole("list", { name: "Turn order" }).or(a.locator('[aria-label="Turn order"]'));
  const openPanel = async () => {
    await tableMode().click();
    await a.locator("#table-mode-panel").getByText(/^(Turn|Free) mode\./).first().waitFor({ timeout: 10000 });
  };
  const panel = () => a.locator("#table-mode-panel");
  // The slide-out closes after an action that sent; wait out the close, then open it again.
  const reopen = async () => {
    await panel().getByText(/^(Turn|Free) mode\./).first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
    await a.waitForTimeout(500);
    await openPanel();
  };

  // Step 5: carry out the scene suggestion, then approve the scene-start suggestions.
  await a.goto(playUrl);
  await a.getByText("No scene yet").first().waitFor({ timeout: 20000 });
  await a.getByRole("button", { name: "Change scene" }).click();
  await a.locator("#scene-id").waitFor({ timeout: 15000 });
  await a.getByRole("button", { name: "Apply", exact: true }).click();
  await a.getByText("The Bell at Greyhollow Ford").first().waitFor({ timeout: 15000 });
  await a.waitForTimeout(2000);
  await a.getByRole("button", { name: /Pending proposals/ }).click();
  await a.getByRole("button", { name: "Approve" }).first().waitFor({ timeout: 15000 });
  let approved = 0;
  for (let n = 0; n < 15; n++) {
    const b = a.getByRole("button", { name: "Approve" });
    const c = await b.count();
    if (c <= 1) break;
    await b.first().click();
    await a.waitForFunction((k) => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Approve").length < k, c, { timeout: 15000 });
    approved++;
  }
  console.log(`info: approved ${approved} scene-start suggestions (narration left pending)`);
  await a.waitForTimeout(3000);

  // Step 6: start the encounter as the seated DM.
  console.log(execFileSync("node", [join(here, "start-encounter.mjs"), credsPath, sessionId], { encoding: "utf8" }).trim());
  const jobsBefore = (await api("/jobs?limit=100")).jobs ?? [];

  // Step 7: turn mode, the panel's turn state.
  await a.reload();
  await a.getByText("Turn mode · Tamsin Vale's turn").first().waitFor({ timeout: 20000 });
  check(true, "step 7 badge: Turn mode · Tamsin Vale's turn");
  check((await turnOrder().count()) > 0, "step 7 turn-order strip shown");
  await openPanel();
  const pt = await panel().innerText();
  check(/Turn mode\. Encounter active\./.test(pt), "step 7 panel: Turn mode. Encounter active.");
  check((await panel().getByRole("button", { name: "End encounter" }).count()) === 1, "step 7 panel: End encounter");
  check((await panel().getByRole("button", { name: "Switch to free mode" }).count()) === 1, "step 7 panel: Switch to free mode");
  check(pt.includes("The encounter stays active."), "step 7 panel: The encounter stays active.");
  check((await panel().getByRole("button", { name: "Switch to turn mode" }).count()) === 0, "step 7 panel: no Switch to turn mode");
  await shoot(a, "panel-turn");

  // Step 8: free mode with the encounter kept.
  await panel().getByRole("button", { name: "Switch to free mode" }).click();
  await a.getByText("Free mode", { exact: true }).first().waitFor({ timeout: 15000 });
  await a.waitForTimeout(1000);
  check((await turnOrder().count()) === 0, "step 8 badge Free mode, no turn-order strip");
  await reopen();
  const pf = await panel().innerText();
  check(/Free mode\. Encounter active\./.test(pf), "step 8 panel: Free mode. Encounter active.");
  check((await panel().getByRole("button", { name: "Switch to turn mode" }).count()) === 1, "step 8 panel: Switch to turn mode");
  check((await panel().getByRole("button", { name: "End encounter" }).count()) === 1, "step 8 panel: End encounter");
  await shoot(a, "panel-free-encounter");

  // Step 9: back to turn mode at the active combatant.
  await panel().getByRole("button", { name: "Switch to turn mode" }).click();
  await a.getByText("Turn mode · Tamsin Vale's turn").first().waitFor({ timeout: 15000 });
  check(true, "step 9 badge names Tamsin again");

  // Step 10: end the encounter with a typed reason.
  await reopen();
  await a.locator("#table-mode-reason").fill("The bandits scatter into the reeds");
  const headBefore = (await api("/events?limit=1")).headSeq;
  await panel().getByRole("button", { name: "End encounter" }).click();
  await a.getByText("Free mode", { exact: true }).first().waitFor({ timeout: 15000 });
  await a.waitForTimeout(1500);
  check((await turnOrder().count()) === 0, "step 10 badge Free mode, no turn-order strip");
  const tail = (await api(`/events?after=${headBefore}&limit=50`)).events;
  const types = tail.map((e) => e.type);
  console.log(`info: rows after End encounter: ${types.join(", ")}`);
  const ended = tail.find((e) => e.type === "encounter.ended");
  const freed = tail.find((e) => e.type === "table-mode.changed");
  check(!!ended && !!freed && types.indexOf("encounter.ended") < types.indexOf("table-mode.changed"), "step 10 encounter.ended then table-mode.changed");
  check(freed?.payload?.after?.mode === "free", "step 10 table-mode.changed after.mode free");
  check(JSON.stringify(ended?.actor) === JSON.stringify(freed?.actor), `step 10 both rows by the same actor: ${JSON.stringify(ended?.actor)}`);
  console.log(`info: reasons: ${ended?.payload?.reason} | ${freed?.payload?.reason}`);
  await reopen();
  const pe = await panel().innerText();
  check(/Free mode\. No encounter\./.test(pe), "step 10 panel: Free mode. No encounter.");
  check(pe.includes("Turn mode needs an encounter. The AI DM starts one."), "step 10 panel: Turn mode needs an encounter.");
  check((await panel().getByRole("button").filter({ hasText: /End encounter|Switch to/ }).count()) === 0, "step 10 panel: no action buttons");
  await shoot(a, "ended");

  // Step 11: no turn job queued by the human DM's requests.
  const jobsAfter = (await api("/jobs?limit=100")).jobs ?? [];
  const fresh = jobsAfter.filter((j) => !jobsBefore.some((k) => k.id === j.id));
  console.log(`info: jobs before ${jobsBefore.length}, after ${jobsAfter.length}; new: ${JSON.stringify(fresh.map((j) => ({ kind: j.kind, trigger: j.trigger, status: j.status })))}`);
  check(fresh.length === 0, "step 11 no job queued after step 6");

  // Step 12: the player sees the badge and no Table mode button.
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const b = await ctxB.newPage();
  await signIn(b, creds.player);
  await b.goto(playUrl);
  await b.getByText("Free mode", { exact: true }).first().waitFor({ timeout: 20000 });
  await b.waitForTimeout(1500);
  check((await b.getByRole("button", { name: "Table mode" }).count()) === 0, "step 12 player has no Table mode button");
  await shoot(b, "player-no-control", [[1280, 800, "light"]]);
  await ctxA.close();
  await ctxB.close();
} finally {
  await browser.close();
}
