// Brave run of the two-player kit on a worktree stack (spec 054 Phase 6, quickstart steps 4-10).
//
//   STACKS_SHOOT_CREDS=<creds json> PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/054-two-player-alpha-kit/evidence/shoot-live.mjs
//
// Creds file (untracked, outside the repo):
//   {"operator": {"username","password"}, "player": {"username","displayName","password"}}
// The operator account already exists on the stack. The script redeems an invitation as the player.
// It drives two browser contexts and prints one PASS/FAIL line per check. It never prints a password
// or a token. It writes shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const check = (ok, label) => console.log(`${ok ? "PASS" : "FAIL"} ${label}`);

async function shoot(page, name) {
  for (const [w, h, scheme] of VARIANTS) {
    await page.setViewportSize({ width: w, height: h });
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate((s) => document.documentElement.setAttribute("data-theme", s), scheme);
    await page.waitForTimeout(400);
    const modal = await page.locator("dialog[open],[aria-modal=true]").count();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(modal === 0, `${name} ${w}-${scheme} no-modal: ${modal} dialogs`);
    check(over <= 0, `${name} ${w}-${scheme} no-overflow: ${over} px`);
    const file = join(out, `${name}-${w}-${scheme}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
try {
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctxA.addCookies([{ name: "stacks-theme", value: "light", url: base }]);
  await ctxB.addCookies([{ name: "stacks-theme", value: "light", url: base }]);
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  // Step 4: operator signs in, creates an invitation on Settings.
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
  check(token.length > 0, "step 4 invitation token shown");
  check(await a.getByText(/Expires /).first().isVisible(), "step 4 expiry shown");
  await shoot(a, "invite-section");

  // Step 5: player redeems from the sign-in card.
  await b.goto(`${base}/`);
  await b.getByRole("button", { name: "Have an invitation?" }).click();
  await b.locator("#invite-token").waitFor({ timeout: 10000 });
  await shoot(b, "redeem-form");
  await b.fill("#invite-token", token);
  await b.fill("#invite-username", creds.player.username);
  await b.fill("#invite-display-name", creds.player.displayName);
  await b.fill("#invite-password", creds.player.password);
  await b.getByRole("button", { name: "Create account" }).click();
  await b.locator("#invite-token").waitFor({ state: "detached", timeout: 15000 });
  const operatorLinks = await b.getByRole("link", { name: /Settings|Debug/ }).count();
  check(true, `step 5 player redeemed and signed in (operator-only links visible: ${operatorLinks})`);

  // Step 6: a second redeem of the same token in a fresh signed-out context.
  const ctxC = await browser.newContext();
  const c = await ctxC.newPage();
  await c.goto(`${base}/`);
  await c.getByRole("button", { name: "Have an invitation?" }).click();
  await c.fill("#invite-token", token);
  await c.fill("#invite-username", "player3");
  await c.fill("#invite-display-name", "Player Three");
  await c.fill("#invite-password", creds.player.password);
  await c.getByRole("button", { name: "Create account" }).click();
  const used = c.getByText("This invitation is invalid, expired, or already redeemed.");
  await used.waitFor({ timeout: 10000 });
  check(true, "step 6 second redeem refused: invalid, expired, or already redeemed");
  await ctxC.close();

  // Step 7: operator starts a table; both open it.
  await a.goto(`${base}/play`);
  await a.getByRole("button", { name: "Start a new table" }).click();
  await a.waitForURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const playUrl = a.url();
  const sessionId = playUrl.split("/").pop();
  await b.goto(playUrl);
  await a.getByRole("list", { name: "At the table" }).waitFor({ timeout: 15000 });
  await a.getByText(creds.player.displayName).first().waitFor({ timeout: 15000 });
  const names = await a.getByRole("list", { name: "At the table" }).innerText();
  check(names.includes(creds.player.displayName), "step 7 presence strip shows both users");
  console.log(`session ${sessionId}`);

  // Refusal: player GET /dm/seeds.
  const seedsPlayer = await ctxB.request.get(`${base}/dm/seeds`);
  check(seedsPlayer.status() === 403, `refusal GET /dm/seeds as player: ${seedsPlayer.status()}`);

  // Step 8: Start scene slide-out.
  await a.getByRole("button", { name: "Start scene" }).click();
  await a.locator("#start-seed").waitFor({ timeout: 15000 });
  await a.locator("#start-seed").selectOption("greyhollow-ford-duo");
  const seatSelects = a.locator('select[id^="start-seat-"]');
  const seatCount = await seatSelects.count();
  check(seatCount === 2, `step 8 two human seats shown: ${seatCount}`);
  const optionLabels = await seatSelects.first().locator("option").allInnerTexts();
  const operatorLabel = optionLabels.find((t) => t !== "Choose a player" && !t.includes(creds.player.displayName));
  const playerLabel = optionLabels.find((t) => t.includes(creds.player.displayName));
  // Same user on both seats first: Start must be disabled.
  await seatSelects.nth(0).selectOption({ label: operatorLabel });
  await seatSelects.nth(1).selectOption({ label: operatorLabel });
  const startBtn = a.getByRole("button", { name: "Start", exact: true });
  check(await startBtn.isDisabled(), "step 8 Start disabled with one user on both seats");
  await seatSelects.nth(1).selectOption({ label: playerLabel });
  check(await startBtn.isEnabled(), "step 8 Start enabled with distinct users");
  check(await a.getByText("AI companions: Brother Odo.").isVisible(), "step 8 note: AI companions: Brother Odo.");
  await shoot(a, "start-scene");

  // Step 9: press Start.
  await startBtn.click();
  await a.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 20000 });
  await b.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 20000 });
  check(true, "step 9 opening narration arrived in both contexts");
  check((await a.locator("dialog[open],[aria-modal=true]").count()) === 0, "step 9 no modal after Start");
  await a.waitForTimeout(1500);
  await shoot(a, "table-operator");
  await shoot(b, "table-player");
  const ownA = await a.locator("select option").allInnerTexts();
  const ownB = await b.locator("select option").allInnerTexts();
  check(ownA.length === 1 && ownB.length === 1 && ownA[0] !== ownB[0], `step 9 each speaker selector offers only that player's character: ${ownA} / ${ownB}`);
  const odoShown = /Odo/.test(await b.locator("body").innerText());
  console.log(`info: Brother Odo visible in the player's table text: ${odoShown}`);

  // The duplicate-seat 400 and second-start 409 refusals run in refusals.mjs (they need real user ids).

  // Step 10: debug page.
  await a.goto(`${playUrl}/debug`);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 15000 });
  const jobText = await a.locator("[data-job-card]").first().innerText();
  console.log(`debug first job card: ${jobText.replace(/\s+/g, " ").slice(0, 160)}`);
  await ctxA.close();
  await ctxB.close();
} finally {
  await browser.close();
}
