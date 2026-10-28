// Brave run of the human-DM roll resume on a worktree stack (spec 057, quickstart steps 5-10).
//
//   PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core> \
//     node specs/057-human-dm-roll-resume/evidence/live-resume.mjs <creds-file>
//
// <creds-file> is a JSON file OUTSIDE the repo, as in spec 055:
//   {"operator": {"username","password"}, "player": {"username","password","userId"}}
// Both accounts already exist on the stack. The stack runs `DM_FAKE_SCRIPT=greyhollow-human-dm`
// (10 calls). Optional: STACKS_APP_URL overrides the app origin (default http://localhost:<APP_PORT>).
// The script: seats the operator as human DM and starts greyhollow-ford (055 start-human-dm.mjs),
// carries out the scene suggestion ("Change scene" > "Apply"), approves the 10 other scene-start suggestions, has the player declare and commit `act-search`
// (053 declare.mjs), approves the one check.roll, approves the resumed turn's narration, and
// reads the player's table. It asserts 0 modals in every shot and prints job ids, outcomes,
// call purposes, the action.resolved row and the check.roll proposal count from the /dm debug
// routes. It never prints a password or a token. Run it once per fresh stack (a re-run seats a
// new session, but the script's call counter has moved on).
// Shots: shots/<name>-<width>-<scheme>.png.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const credsPath = process.argv[2];
if (!credsPath) {
  console.error("usage: live-resume.mjs <creds-file>");
  process.exit(2);
}
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "shots");
mkdirSync(out, { recursive: true });
const envText = readFileSync(join(here, "../../../.env"), "utf8");
const appPort = envText.match(/^APP_PORT=(\S+)$/m)?.[1] ?? "3000";
const base = process.env.STACKS_APP_URL ?? `http://localhost:${appPort}`;
const require = createRequire(process.env.PLAYWRIGHT_CORE ?? import.meta.url);
const { chromium } = require("playwright-core");
const STEP_MS = 30000;
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const ALL = [
  [1280, 800, "light"],
  [1280, 800, "dark"],
  [390, 844, "light"],
  [390, 844, "dark"],
];
let failures = 0;
const check = (ok, label) => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shoot(page, name, variants = ALL) {
  for (const [w, h, scheme] of variants) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(400);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    await page.screenshot({ path: join(out, `${name}-${w}-${scheme}.png`) });
    console.log(join(out, `${name}-${w}-${scheme}.png`));
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

// Operator cookie for the /dm debug routes (no output of the cookie).
const si = await fetch(`${base}/auth/sign-in`, {
  signal: AbortSignal.timeout(STEP_MS),
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: creds.operator.username, password: creds.operator.password }),
});
if (!si.ok) {
  console.error(`operator sign-in refused: HTTP ${si.status}`);
  process.exit(1);
}
const cookie = si.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const api = async (path) => {
  const r = await fetch(`${base}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(STEP_MS) });
  if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
  return r.json();
};

// Steps 5: fresh session with the operator seated as human DM.
const started = execFileSync("node", [join(here, "../../055-human-dm-scene-change/evidence/start-human-dm.mjs"), credsPath], { encoding: "utf8", timeout: 60000 });
const sessionId = started.match(/sessionId (\S+)/)[1];
console.log(`session ${sessionId}`);
const playUrl = `${base}/play/${sessionId}`;

const turns = async () => {
  const { turns: t } = await api(`/dm/sessions/${sessionId}/turns?limit=100`);
  return t.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};
const trig = (t) => JSON.stringify(t.trigger ?? "");
const settled = (t) => t.status === "succeeded" || t.status === "failed";
async function waitTurns(label, pred, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < end) {
    last = await turns();
    if (pred(last)) return last;
    await sleep(1500);
  }
  check(false, `${label}: timed out; turns: ${last.map((t) => `${t.status}/${t.outcome}`).join(",")}`);
  return last;
}
const purposes = (t) => t.calls.map((c) => c.purpose);

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
const tmp = mkdtempSync(join(tmpdir(), "live-resume-"));
const bounded = async (ctx) => {
  ctx.setDefaultTimeout(STEP_MS);
  ctx.setDefaultNavigationTimeout(STEP_MS);
  return ctx;
};
try {
  try {
  const ctxA = await bounded(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const a = await ctxA.newPage();
  await signIn(a, creds.operator);

  // Step 6 (spec 055 shoot-live.mjs steps 6 to 8b): carry out the scene suggestion, then approve the rest.
  // The Apply closes the scene suggestion (proposal.rejected), so 10 suggestions stay: 3 combatant adds,
  // 3 party members, 2 trackers, 2 presence removals. The opening narration stays pending.
  await waitTurns("scene-start turn", (t) => t.some((x) => x.kind === "turn" && settled(x)));
  await a.goto(playUrl);
  await a.getByText("No scene yet").first().waitFor();
  await a.getByRole("button", { name: "Change scene" }).click();
  await a.locator("#scene-id").waitFor();
  check((await a.locator("#scene-id").inputValue()) === "greyhollow-ford", "step 6 scene panel seeded with greyhollow-ford");
  await a.getByRole("button", { name: "Apply", exact: true }).click();
  await a.getByText("The Bell at Greyhollow Ford").first().waitFor();
  await waitTurns("scene approval turn", (t) => t.filter((x) => x.kind === "turn").length >= 2 && t.filter((x) => x.kind === "turn").every(settled));
  await a.goto(playUrl);
  await a.getByRole("button", { name: /Pending proposals/ }).click();
  await a.getByRole("button", { name: "Approve" }).first().waitFor();
  let approved = 0;
  for (let n = 0; n < 15; n++) {
    const b = a.getByRole("button", { name: "Approve" });
    const c = await b.count();
    if (c <= 1) break;
    await b.first().click();
    await a.waitForFunction((k) => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Approve").length < k, c, { timeout: STEP_MS });
    approved++;
  }
  check(approved === 10, `step 6 approved ${approved} suggestions (expect 10 after Apply; opening narration left pending)`);
  await waitTurns("approval turns drained", (t) => t.filter((x) => x.kind === "turn").every(settled));
  await a.getByRole("button", { name: "Close" }).last().click().catch(() => {});

  // Step 7: the player declares and commits; the commit turn pauses on one check.roll.
  const playerFile = join(tmp, "player.json");
  writeFileSync(playerFile, JSON.stringify({ username: creds.player.username, password: creds.player.password }), { mode: 0o600 });
  console.log(execFileSync("node", [join(here, "../../053-env-fake-dm-script/evidence/declare.mjs"), playerFile, sessionId], { encoding: "utf8", timeout: 60000 }).trim());
  await a.goto(playUrl);
  await a.getByRole("button", { name: /Pending proposals/ }).click();
  const rollCard = a.locator("section, article, li, div").filter({ hasText: "Tamsin studies the chained ferry" }).filter({ has: a.getByRole("button", { name: "Approve" }) }).last();
  await rollCard.waitFor({ timeout: 30000 });
  check(true, "step 7 commit turn paused on a check.roll proposal");
  const afterCommit = await waitTurns("commit turn", (t) => t.some((x) => trig(x).includes("commit") && settled(x)));
  const commit = afterCommit.find((x) => trig(x).includes("commit"));
  check(commit?.outcome === "completed", `step 7 commit turn outcome ${commit?.outcome}`);
  check(purposes(commit ?? { calls: [] }).join() === "dm.director,dm.interpret", `step 7 commit calls ${purposes(commit ?? { calls: [] }).join()}`);
  await shoot(a, "roll-pending", [[1280, 800, "light"]]);

  // Step 8: approve the roll; the approval turn resumes and narrates without a second roll.
  const before = afterCommit.length;
  await rollCard.getByRole("button", { name: "Approve" }).first().click();
  const afterRoll = await waitTurns("resumed approval turn", (t) => t.length > before && t.slice(before).some((x) => settled(x) && purposes(x).length > 0), 90000);
  const resumed = afterRoll.slice(before).find((x) => purposes(x).length > 0);
  check(resumed?.status === "succeeded" && resumed?.outcome === "completed", `step 8 resumed turn ${resumed?.status}/${resumed?.outcome}`);
  check(purposes(resumed ?? { calls: [] }).join() === "dm.director,dm.narrate,dm.audit", `step 8 resumed calls ${purposes(resumed ?? { calls: [] }).join()} (no dm.interpret)`);
  await a.waitForTimeout(2000);
  const rollsLeft = await a.locator("section, article, li, div").filter({ hasText: "Tamsin studies the chained ferry" }).filter({ has: a.getByRole("button", { name: "Approve" }) }).count();
  check(rollsLeft === 0, `step 8 no second check.roll in the approvals slide-out (${rollsLeft})`);
  const narrCard = a.locator("section, article, li, div").filter({ hasText: "rusted alike" }).filter({ has: a.getByRole("button", { name: "Approve" }) }).last();
  await narrCard.waitFor({ timeout: 15000 });
  const narrText = await narrCard.innerText();
  check(/act-search/.test(narrText) || /rusted alike/.test(narrText), "step 8 one pending narration proposal for the search");
  await shoot(a, "narration-pending", [[1280, 800, "light"]]);

  // Step 9: approve the narration; the DM's and the player's tables show it.
  const beforeNarr = (await turns()).length;
  await narrCard.getByRole("button", { name: "Approve" }).first().click();
  await waitTurns("post-narration approval turn", (t) => t.length > beforeNarr && t.slice(beforeNarr).some((x) => x.kind === "turn" && settled(x)), 60000);
  await a.getByRole("button", { name: "Close" }).last().click().catch(() => {});
  await a.waitForTimeout(1500);
  const bodyA = await a.locator("body").innerText();
  check(/rusted alike/.test(bodyA), "step 9 DM table shows the narration");
  check(/\bd20\b|1d20|rolled|roll/i.test(bodyA), "step 9 DM table shows the dice line");
  check(!/DM runtime stopped/.test(bodyA), "step 9 no runtime failure notice");

  const ctxB = await bounded(await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const b = await ctxB.newPage();
  await signIn(b, creds.player);
  await b.goto(playUrl);
  await b.getByText("rusted alike", { exact: false }).first().waitFor({ timeout: 20000 });
  const bodyB = await b.locator("body").innerText();
  check(/rusted alike/.test(bodyB), "step 9 player table shows the narration");
  check(/\bd20\b|1d20|rolled|roll/i.test(bodyB), "step 9 player table shows the dice line");
  await shoot(b, "narrated");

  // Step 10: record.
  await sleep(4000);
  const finalTurns = await turns();
  const last = finalTurns.filter((x) => x.kind === "turn").at(-1);
  check(last?.outcome === "empty-beat" && purposes(last).length === 0, `step 9 next approval turn ${last?.status}/${last?.outcome}, calls [${purposes(last ?? { calls: [] }).join()}]`);
  console.log("--- jobs ---");
  for (const t of finalTurns) console.log(`${t.id} kind=${t.kind} trigger=${trig(t)} status=${t.status} outcome=${t.outcome} calls=[${purposes(t).join(",")}]${t.error ? ` error=${t.error}` : ""}`);
  console.log("--- calls ---");
  const { calls } = await api(`/dm/sessions/${sessionId}/calls?limit=200`);
  for (const c of calls) console.log(`${c.jobId} ${c.jobKind} ${c.purpose} ${c.outcome}${c.errorKind ? ` ${c.errorKind}` : ""}`);
  console.log("--- events ---");
  const { events } = await api(`/dm/sessions/${sessionId}/events?limit=1000`);
  const resolved = events.filter((e) => e.type === "action.resolved");
  for (const e of resolved) console.log(`action.resolved seq=${e.seq} actor=${e.actor} payload=${JSON.stringify(e.payload)}`);
  check(resolved.length >= 1 && resolved.some((e) => JSON.stringify(e.payload).includes("applied")), "step 10 action.resolved row has outcome applied");
  const rollEvents = events.filter((e) => JSON.stringify(e.payload ?? {}).includes('"check.roll"'));
  const proposedRolls = rollEvents.filter((e) => e.type === "proposal.created");
  const byType = {};
  for (const e of rollEvents) byType[e.type] = (byType[e.type] ?? 0) + 1;
  console.log(`check.roll events by type: ${JSON.stringify(byType)}`);
  check(proposedRolls.length === 1, `step 10 check.roll proposals: ${proposedRolls.length} (expect 1)`);
  await ctxA.close();
  await ctxB.close();
  } catch (e) {
    check(false, `script aborted: ${String(e?.message ?? e).split("\n")[0]}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
  await browser.close().catch(() => {});
}
console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
