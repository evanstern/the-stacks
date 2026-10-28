// Brave run of the human-DM scene change on a worktree stack (spec 055 Phase 5, quickstart steps 4-10).
//
//   STACKS_SHOOT_CREDS=<creds json> STACKS_PLAYER_CREDS=<{"username","password"} json>
//   PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/055-human-dm-scene-change/evidence/shoot-live.mjs
//
// Creds file (untracked, outside the repo): {"operator": {"username","password"}, "player": {"username","password","userId"}}
// Both accounts already exist on the stack. The script runs start-human-dm.mjs for a fresh session,
// then drives the operator through: seeded panel (shots BEFORE Apply), Apply, approvals, the player's
// declare/commit (declare.mjs), the roll approval, a second scene change, and the player's view.
// It prints one PASS/FAIL line per check. It never prints a password or a token.
// Shots: shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const credsPath = process.env.STACKS_SHOOT_CREDS;
const playerCredsPath = process.env.STACKS_PLAYER_CREDS;
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

// Fresh session: dm.seat, then start.
const started = execFileSync("node", [join(here, "start-human-dm.mjs"), credsPath], { encoding: "utf8" });
const sessionId = started.match(/sessionId (\S+)/)[1];
console.log(`session ${sessionId}`);
const playUrl = `${base}/play/${sessionId}`;

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctxA.newPage();
  await signIn(a, creds.operator);

  // Step 5: debug page shows the scene-start turn.
  await a.goto(`${playUrl}/debug`);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 20000 });
  console.log(`debug first job card: ${(await a.locator("[data-job-card]").first().innerText()).replace(/\s+/g, " ").slice(0, 160)}`);

  // Step 6: open the panel; shoot BEFORE Apply.
  await a.goto(playUrl);
  await a.getByText("No scene yet").first().waitFor({ timeout: 15000 });
  check(true, "step 5 header: No scene yet");
  await a.getByRole("button", { name: "Change scene" }).click();
  await a.locator("#scene-id").waitFor({ timeout: 15000 });
  const f = async (id) => a.locator(`#${id}`).inputValue();
  check((await f("scene-id")) === "greyhollow-ford", "step 6 Scene id greyhollow-ford");
  check((await f("scene-title")) === "The Bell at Greyhollow Ford", "step 6 title seeded");
  check((await f("scene-location")) === "Greyhollow Ford", "step 6 location seeded");
  check((await f("scene-summary")).length > 0 && (await f("scene-reason")).length > 0, "step 6 summary and reason seeded");
  await shoot(a, "scene-panel-seeded");

  // Step 7: edit the summary and Apply.
  await a.locator("#scene-summary").fill(`${await f("scene-summary")} (edited by the DM)`);
  await a.getByRole("button", { name: "Apply", exact: true }).click();
  await a.getByText("The Bell at Greyhollow Ford").first().waitFor({ timeout: 15000 });
  await a.waitForTimeout(1500);
  check(await a.getByText("Greyhollow Ford", { exact: true }).first().isVisible(), "step 7 header shows scene title and location");
  await shoot(a, "scene-applied");

  // Step 8: debug page, approval turn.
  await a.goto(`${playUrl}/debug`);
  await a.waitForTimeout(4000);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 20000 });
  await shoot(a, "debug-approval-turn", [[1280, 800, "light"]]);

  // Step 8b: approve the scene-start suggestions (all but the narration, which is last).
  await a.goto(playUrl);
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
  check(approved === 10, `step 8b approved ${approved} suggestions (expect 10; narration left pending)`);
  await a.waitForTimeout(4000);

  // Step 8c: the player declares and commits; the commit turn pauses on a roll proposal.
  console.log(execFileSync("node", [join(here, "../../053-env-fake-dm-script/evidence/declare.mjs"), playerCredsPath, sessionId], { encoding: "utf8" }).trim());
  const roll = a.locator("section, article, li, div").filter({ hasText: "Tamsin studies the chained ferry" }).filter({ has: a.getByRole("button", { name: "Approve" }) }).last();
  await roll.waitFor({ timeout: 30000 });
  check(true, "step 8c commit turn paused on a check.roll proposal");
  await roll.getByRole("button", { name: "Approve" }).first().click();
  await a.waitForTimeout(8000);
  // Close the proposals sheet and read the table.
  await a.getByRole("button", { name: "Close" }).last().click();
  await a.waitForTimeout(1000);
  const body = await a.locator("body").innerText();
  check(/rusted|chain/i.test(body), "step 8c narration of the search is on the table");
  check(!/DM runtime stopped/.test(body), "step 8c no runtime failure notice");

  // T032: a second scene change on the same session.
  await a.getByRole("button", { name: "Change scene" }).click();
  await a.locator("#scene-id").waitFor({ timeout: 15000 });
  await a.getByRole("button", { name: "Use: Current scene" }).click();
  await a.locator("#scene-location").fill("Greyhollow Ford, the ferry-house");
  await a.locator("#scene-reason").fill("The DM moves the party into the ferry-house");
  await shoot(a, "scene-panel-current", [[1280, 800, "light"]]);
  await a.getByRole("button", { name: "Apply", exact: true }).click();
  await a.getByText("the ferry-house", { exact: false }).first().waitFor({ timeout: 15000 });
  check(true, "T032 second scene change applied (header shows the new location)");

  // Step 10: the player sees no Change scene control.
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const b = await ctxB.newPage();
  await signIn(b, JSON.parse(readFileSync(playerCredsPath, "utf8")));
  await b.goto(playUrl);
  await b.getByText("Ledger").first().waitFor({ timeout: 15000 });
  await b.waitForTimeout(2000);
  check((await b.getByRole("button", { name: "Change scene" }).count()) === 0, "step 10 player has no Change scene button");
  await shoot(b, "player-no-control", [[1280, 800, "light"]]);
  await ctxA.close();
  await ctxB.close();
} finally {
  await browser.close();
}
