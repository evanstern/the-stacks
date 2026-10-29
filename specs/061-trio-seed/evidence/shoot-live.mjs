// Brave run of the three-player table on a worktree stack (spec 061 Phase 4, quickstart steps 4-10).
//
//   PLAYWRIGHT_CORE=<a path inside a dir whose node_modules holds playwright-core>
//     node specs/061-trio-seed/evidence/shoot-live.mjs <creds-file>
//
// <creds-file> is untracked and outside the repo: {"operator": {"username","password"}}. The operator
// account already exists on the stack. The script generates the two player passwords, redeems two
// invitations as player2 and player3, and writes all three accounts back into <creds-file>.
// It drives three browser contexts, checks the three refusals over HTTP, and prints one PASS/FAIL line
// per check. It never prints a password or a token.
// Shots: shots/<name>-<width>-<scheme>.png at 1280 and 390 px, light and dark.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [credsPath] = process.argv.slice(2);
if (!credsPath) {
  console.error("usage: shoot-live.mjs <creds-file>");
  process.exit(2);
}
const creds = JSON.parse(readFileSync(credsPath, "utf8"));
const pw = () => randomBytes(18).toString("base64url");
creds.player2 = { username: "player2", displayName: "Player Two", password: pw() };
creds.player3 = { username: "player3", displayName: "Player Three", password: pw() };
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

async function redeem(page, token, who) {
  await page.goto(`${base}/`);
  await page.getByRole("button", { name: "Have an invitation?" }).click();
  await page.locator("#invite-token").waitFor({ timeout: 10000 });
  await page.fill("#invite-token", token);
  await page.fill("#invite-username", who.username);
  await page.fill("#invite-display-name", who.displayName);
  await page.fill("#invite-password", who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.locator("#invite-token").waitFor({ state: "detached", timeout: 15000 });
  const links = await page.getByRole("link", { name: /Settings|Debug/ }).count();
  check(links === 0, `step 5 ${who.username} redeemed, signed in, no operator links (${links})`);
}

const browser = await chromium.launch({ executablePath: BRAVE, headless: false, timeout: 30000 });
let sessionId;
try {
  const ctx = [0, 1, 2].map(() => browser.newContext({ viewport: { width: 1280, height: 800 } }));
  const [ctxA, ctxB, ctxC] = await Promise.all(ctx);
  const [a, b, c] = await Promise.all([ctxA.newPage(), ctxB.newPage(), ctxC.newPage()]);

  // Step 4: the operator signs in and creates two invitations.
  await a.goto(`${base}/`);
  await a.fill("#username", creds.operator.username);
  await a.fill("#password", creds.operator.password);
  await a.locator('form button[type="submit"]').first().click();
  await a.locator("#username").waitFor({ state: "detached", timeout: 15000 });
  await a.goto(`${base}/settings`);
  const tokens = [];
  for (let i = 0; i < 2; i++) {
    const before = await a.getByLabel("Invitation token").inputValue().catch(() => "");
    await a.getByRole("button", { name: "Create invitation" }).click();
    await a.waitForFunction(
      (prev) => {
        const el = [...document.querySelectorAll("input")].find((x) => x.getAttribute("aria-label") === "Invitation token" || x.labels?.[0]?.textContent?.includes("Invitation token"));
        return el && el.value && el.value !== prev;
      },
      before,
      { timeout: 10000 },
    );
    tokens.push(await a.getByLabel("Invitation token").inputValue());
  }
  check(tokens.length === 2 && tokens[0] !== tokens[1], "step 4 two distinct invitations created");

  // Step 5: player2 and player3 redeem.
  await redeem(b, tokens[0], creds.player2);
  await redeem(c, tokens[1], creds.player3);

  // Step 6: a new table; all three open it.
  await a.goto(`${base}/play`);
  await a.getByRole("button", { name: "Start a new table" }).click();
  await a.waitForURL(/\/play\/[0-9a-f-]{36}$/, { timeout: 15000 });
  const playUrl = a.url();
  sessionId = playUrl.split("/").pop();
  console.log(`session ${sessionId}`);
  await b.goto(playUrl);
  await c.goto(playUrl);
  const strip = a.getByRole("list", { name: "At the table" });
  await strip.waitFor({ timeout: 15000 });
  await a.getByText("Player Two").first().waitFor({ timeout: 15000 });
  await a.getByText("Player Three").first().waitFor({ timeout: 15000 });
  const names = await strip.innerText();
  check(names.includes("Player Two") && names.includes("Player Three"), "step 6 presence strip shows three names");

  // Step 7: the trio seed offers three selects and no companion note.
  await a.getByRole("button", { name: "Start scene" }).click();
  await a.locator("#start-seed").waitFor({ timeout: 15000 });
  await a.locator("#start-seed").selectOption("greyhollow-ford-trio");
  const seats = a.locator('select[id^="start-seat-"]');
  const ids = await seats.evaluateAll((els) => els.map((e) => e.id));
  check(JSON.stringify(ids) === JSON.stringify(["start-seat-tamsin", "start-seat-odo", "start-seat-kestrel"]), `step 7 three seat selects: ${ids.join(", ")}`);
  check((await a.getByText(/AI companions:/).count()) === 0, "step 7 no AI companions note");

  // Step 8: seat rules, then Start.
  const labels = await a.locator("#start-seat-tamsin option").allInnerTexts();
  const op = labels.find((t) => t !== "Choose a player" && !t.includes("Player Two") && !t.includes("Player Three"));
  const p2 = labels.find((t) => t.includes("Player Two"));
  const p3 = labels.find((t) => t.includes("Player Three"));
  const start = a.getByRole("button", { name: "Start", exact: true });
  await a.locator("#start-seat-tamsin").selectOption({ label: op });
  await a.locator("#start-seat-odo").selectOption({ label: p2 });
  check(await start.isDisabled(), "step 8 Start disabled with two seats filled");
  await a.locator("#start-seat-kestrel").selectOption({ label: p2 });
  check(await start.isDisabled(), "step 8 Start disabled with player2 on two seats");
  await a.locator("#start-seat-kestrel").selectOption({ label: p3 });
  check(await start.isEnabled(), "step 8 Start enabled with three distinct players");
  await shoot(a, "start-scene-trio");
  await start.click();
  const queued = await a.getByText("Scene start queued.").first().waitFor({ timeout: 3000 }).then(() => true, () => false);
  check(queued, "step 8 slide-out closed and Scene start queued.");

  // Step 9: the opening narration in all three contexts; each speaker selector offers its own character.
  for (const [p, who] of [[a, "operator"], [b, "player2"], [c, "player3"]]) {
    await p.getByText(/Greyhollow Ford|bell/).first().waitFor({ timeout: 20000 });
    check(true, `step 9 opening narration in the ${who} context`);
  }
  await a.waitForTimeout(1500);
  const own = await Promise.all([a, b, c].map((p) => p.locator("select option").allInnerTexts()));
  console.log(`info: speaker options: ${own.map((o) => o.join("/")).join(" | ")}`);
  check(own.every((o) => o.length === 1) && new Set(own.map((o) => o[0])).size === 3, "step 9 each speaker selector offers only its own character");
  await shoot(a, "table-operator");
  await shoot(b, "table-player2");
  await shoot(c, "table-player3");

  // Step 10: the debug page.
  await a.goto(`${playUrl}/debug`);
  await a.locator("[data-job-card]").first().waitFor({ timeout: 15000 });
  const jobs = await (await ctxA.request.get(`${base}/dm/sessions/${sessionId}/jobs?limit=100`)).json();
  const list = jobs.jobs ?? [];
  // The scene-start turn job is the turn job whose input carries `start`.
  console.log(`info: jobs: ${JSON.stringify(list.map((j) => ({ kind: j.kind, start: Boolean(j.input?.start), status: j.status })))}`);
  check(list.some((j) => j.kind === "turn" && j.input?.start && j.status === "succeeded"), "step 10 a succeeded scene-start turn job");
  check(!list.some((j) => j.kind === "companion"), "step 10 no companion job");

  // Refusals (quickstart "Expected refusals").
  const me = async (cx) => (await (await cx.request.get(`${base}/auth/me`)).json()).user;
  const [uA, uB, uC] = await Promise.all([ctxA, ctxB, ctxC].map(me));
  const post = async (id, seatMap) => {
    const r = await ctxA.request.post(`${base}/dm/sessions/${id}/start`, { data: { seedId: "greyhollow-ford-trio", seats: seatMap } });
    return `${r.status()} ${(await r.text()).slice(0, 200)}`;
  };
  const dup = await post(randomUUID(), { tamsin: uA.id, odo: uB.id, kestrel: uB.id });
  check(dup.startsWith("400") && dup.includes("A user can hold only one seat."), `refusal one user on two seats: ${dup}`);
  const two = await post(randomUUID(), { tamsin: uA.id, odo: uB.id });
  check(two.startsWith("400") && two.includes("kestrel"), `refusal two of three seats: ${two}`);
  const again = await post(sessionId, { tamsin: uA.id, odo: uB.id, kestrel: uC.id });
  check(again.startsWith("409") && again.includes("The session already has a scene."), `refusal second start: ${again}`);
} finally {
  await browser.close();
}
